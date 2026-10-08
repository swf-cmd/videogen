const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { Application } = require('../src/application');
const { configureApplication, handleRequest } = require('../src/http/router');
const { PORT } = require('../src/config');
const { parseRange } = require('../src/http/handlers/media');
function appFor(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'videogen-v21-'));
  const app = new Application({ directory });
  t.after(async () => { await app.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return app;
}
const basePayload = { provider:'gemini', region:'global', model:'gemini-omni-1.1-flash', prompt:'offline only', params:{durationSeconds:3,resolution:'720p',aspectRatio:'16:9'} };
function payload(app, extra={}) { return {...basePayload,outputDir:path.join(app.directory,'output'),...extra}; }
function image(width=1280,height=720) {
  const buffer=Buffer.alloc(24); Buffer.from('89504e470d0a1a0a','hex').copy(buffer); buffer.writeUInt32BE(width,16); buffer.writeUInt32BE(height,20);
  return new File([buffer],'test.png',{type:'image/png'});
}
function succeed(app, id, bytes=Buffer.from('offline-video')) {
  let job=app.store.get(id);
  fs.mkdirSync(path.dirname(job.targetPath),{recursive:true}); fs.writeFileSync(job.targetPath,bytes);
  app.store.update(id,{state:'submitting',attempts:{create:1,poll:0,download:0},estimatedCharges:1});
  app.store.update(id,{state:'running',remote:{id:'offline-id'}});
  app.store.update(id,{state:'downloading'});
  return app.store.update(id,{state:'succeeded',output:{path:job.targetPath,bytes:bytes.length,contentType:'video/mp4'}});
}
test('row estimates isolate invalid rows, preserve currency and reject the batch before persistence', async t=>{
  const app=appFor(t);
  const input=payload(app,{rows:[{prompt:'valid'},{prompt:'invalid',params:{durationSeconds:999}},{prompt:''}]});
  const estimate=app.estimate(input);
  assert.deepEqual(estimate.rows.map(x=>x.valid),[true,false,false]); assert.equal(estimate.rows[0].cost.amount,0.30408);
  assert.equal(estimate.valid,false); assert.equal(estimate.cost.amount,null);
  await assert.rejects(app.prepare(input),{code:'invalidImportRows'});
  assert.equal(app.store.jobs.size,0); assert.equal(app.store.batches.size,0);
  const cross=app.estimate(payload(app,{baseUrl:'https://generativelanguage.googleapis.com/v1beta',rows:[{prompt:'other provider',provider:'openrouter',region:'global',model:'google/veo-3.1-lite',params:{durationSeconds:4,resolution:'720p',aspectRatio:'16:9',audio:true}}]}));
  assert.equal(cross.valid,true);
  const switched=await app.prepare(payload(app,{baseUrl:'https://generativelanguage.googleapis.com/v1beta',rows:[{prompt:'provider switch',provider:'openrouter',region:'global',model:'google/veo-3.1-lite',params:{durationSeconds:4,resolution:'720p',aspectRatio:'16:9',audio:true}}]}));
  assert.equal(switched.jobs[0].baseUrl,app.catalog.providers.find(p=>p.provider==='openrouter').regions[0].baseUrl);
});
test('first and last frame uploads are independent per row and survive restart without binary log data', async t=>{
  const app=appFor(t); const first=image(1024,1024),last=image(1024,1024);
  const input=payload(app,{firstFrame:'shared',rows:[{prompt:'both',lastFrame:'last'},{prompt:'text only',firstFrame:null},{prompt:'own',firstFrame:'own'}]});
  const result=await app.prepare(input,null,new Map([['shared',first],['last',last],['own',image()]]));
  assert.deepEqual(result.jobs.map(j=>j.assets.map(a=>a.role)),[['first_frame','last_frame'],[],['first_frame']]);
  assert.equal(result.jobs[0].assets[0].sha256,result.jobs[0].assets[1].sha256);
  assert.equal(app.context(result.jobs[0]).assets[1].filename,'last-frame.png');
  const filename=path.join(app.directory,'jobs.ndjson'); const log=fs.readFileSync(filename,'utf8'); assert.ok(!log.includes('"buffer"'));
  await app.close(); const reopened=new Application({directory:app.directory});
  try { assert.deepEqual(reopened.store.get(result.jobs[0].id).assets.map(a=>a.role),['first_frame','last_frame']); }
  finally { await reopened.close(); }
});
test('missing images, unsupported tails and tail-only jobs cannot reach queue',async t=>{
  const app=appFor(t);
  await assert.rejects(app.prepare(payload(app,{rows:[{prompt:'one',firstFrame:'missing'}]})),{code:'missingFrameFile'});
  assert.equal(app.estimate(payload(app,{rows:[{prompt:'tail only',lastFrame:'last'}]})).rows[0].errors[0],'lastFrameRequiresFirst');
  const compatible={provider:'openai-compatible',region:'custom',model:'test',customCapabilities:{durations:[4],resolutions:['1280x720'],aspectRatios:['16:9'],firstFrame:true,lastFrame:true,audio:false,seed:false},params:{durationSeconds:4,resolution:'1280x720',aspectRatio:'16:9'}};
  // Resolve catalog region so this assertion remains about capabilities.
  compatible.region=app.catalog.providers.find(p=>p.provider==='openai-compatible').regions[0].id;
  assert.equal(app.estimate(payload(app,{...compatible,rows:[{prompt:'unsupported',firstFrame:'a',lastFrame:'b'}]})).rows[0].errors[0],'unsupportedLastFrame');
  assert.equal(app.store.jobs.size,0);
});
test('an invalid image on a later import row prevents every job and asset from being persisted', async t=>{
  const app=appFor(t);
  const input=payload(app,{provider:'ark',region:'byteplus',model:'dreamina-seedance-2-5-260628',
    params:{durationSeconds:4,resolution:'720p',aspectRatio:'16:9',audio:true},
    rows:[{prompt:'valid first row',firstFrame:'good'},{prompt:'invalid second row',firstFrame:'too-small'}]});
  const uploads=new Map([['good',image(1024,1024)],['too-small',image(299,299)]]);
  assert.equal(app.estimate(input).valid,true,'parameter validation cannot infer uploaded image dimensions');
  await assert.rejects(app.prepare(input,null,uploads),{code:'invalidAsset'});
  assert.equal(app.store.jobs.size,0);
  assert.equal(app.store.batches.size,0);
  assert.deepEqual(fs.readdirSync(path.join(app.directory,'assets')),[]);
  await app.close(); const reopened=new Application({directory:app.directory});
  try {
    assert.equal(reopened.store.jobs.size,0,'restart must not dispatch an earlier valid row from the rejected import');
    uploads.set('too-small',image(1024,1024));
    const accepted=await reopened.prepare(input,null,uploads);
    assert.equal(accepted.jobs.length,2);
    assert.ok(accepted.jobs.every(job=>job.state==='queued' && job.assets[0].width===1024));
  } finally { await reopened.close(); }
});
test('gallery costs include discarded and uncertain paid takes, remain per currency and persist selections',async t=>{
  const app=appFor(t); const {jobs,id}=await app.prepare(payload(app,{rows:[{prompt:'keep'},{prompt:'reject'},{prompt:'uncertain'},{prompt:'unstarted'}]}));
  succeed(app,jobs[0].id); succeed(app,jobs[1].id);
  app.gallery.curate(jobs[0].id,{selection:'keep'}); app.gallery.curate(jobs[1].id,{selection:'reject'});
  app.store.update(jobs[2].id,{state:'submitting',attempts:{create:1,poll:0,download:0},estimatedCharges:2}); app.store.update(jobs[2].id,{state:'needs_review'});
  const result=app.gallery.summary({batchId:id});
  assert.equal(result.kept,1);assert.equal(result.rejected,1);assert.equal(result.costs[0].costPerKept,1.21632);
  app.store.update(jobs[1].id,{costEstimate:{currency:'CNY',amount:2}});
  assert.equal(app.gallery.summary({batchId:id}).costs.length,2);
  app.store.update(jobs[2].id,{costEstimate:{currency:'USD',amount:null}});
  assert.equal(app.gallery.summary({batchId:id}).costs.find(c=>c.currency==='USD').costPerKept,null);
  assert.throws(()=>app.gallery.curate(jobs[2].id,{selection:'keep'}),{code:'invalidSelection'});
  await app.close(); const reopened=new Application({directory:app.directory});
  try{assert.equal(reopened.store.get(jobs[0].id).selection,'keep');}finally{await reopened.close();}
});
test('regeneration requires a fresh single-job confirmation, preserves source and is idempotent on replay',async t=>{
  const app=appFor(t); const {jobs}=await app.prepare(payload(app)); const source=succeed(app,jobs[0].id);
  assert.throws(()=>app.gallery.regenerate(source.id,{confirmed:true}),{code:'regenerateConfirmationRequired'});
  const quote=app.gallery.estimate(source.id); assert.equal(quote.cost.amount,0.30408);
  assert.throws(()=>app.gallery.regenerate(source.id,{...quote,confirmed:false}),{code:'regenerateConfirmationRequired'});
  const request={confirmationToken:quote.confirmationToken,confirmed:true}; const take=app.gallery.regenerate(source.id,request);
  assert.notEqual(take.id,source.id);assert.notEqual(take.targetPath,source.targetPath);assert.equal(take.parentJobId,source.id);assert.equal(take.state,'queued');
  assert.equal(app.store.get(source.id).state,'succeeded');assert.equal(app.gallery.regenerate(source.id,request).id,take.id);assert.equal(app.store.jobs.size,2);
  const stale=app.gallery.estimate(source.id);
  app.catalog.providers.find(p=>p.provider==='gemini').models[0].typicalRenderSec+=1;
  assert.throws(()=>app.gallery.regenerate(source.id,{confirmed:true,confirmationToken:stale.confirmationToken}),{code:'confirmationExpired'});
  await app.close();const reopened=new Application({directory:app.directory});
  try{assert.equal(reopened.gallery.regenerate(source.id,request).id,take.id);assert.equal(reopened.store.jobs.size,2);}finally{await reopened.close();}
});
test('local media supports seeking and HEAD and refuses traversal, external embeds and symlink replacement',async t=>{
  const app=appFor(t);const {jobs}=await app.prepare(payload(app));const job=succeed(app,jobs[0].id,Buffer.from('0123456789'));
  configureApplication(app);const server=http.createServer(handleRequest);server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async (url,options={})=>{
    let body=options.body; const headers={host:`127.0.0.1:${PORT}`,origin:`http://127.0.0.1:${PORT}`,...options.headers};
    if(body instanceof FormData){const encoded=new Request(base,{method:'POST',body});headers['content-type']=encoded.headers.get('content-type');body=Buffer.from(await encoded.arrayBuffer());}
    return new Promise((resolve,reject)=>{const req=http.request(base+url,{method:options.method||'GET',headers},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:new Headers(res.headers),text:async()=>Buffer.concat(chunks).toString(),json:async()=>JSON.parse(Buffer.concat(chunks).toString())}));});req.on('error',reject);req.end(body);});
  };
  let res=await request(`/api/jobs/${job.id}/media`,{headers:{range:'bytes=2-5'}}); assert.equal(res.status,206);assert.equal(res.headers.get('content-range'),'bytes 2-5/10');assert.equal(await res.text(),'2345');
  res=await request(`/api/jobs/${job.id}/media`,{method:'HEAD'});assert.equal(res.status,200);assert.equal(res.headers.get('content-length'),'10');assert.equal(await res.text(),'');
  res=await request(`/api/jobs/${job.id}/media`,{headers:{range:'bytes=11-'}});assert.equal(res.status,416);
  res=await request(`/api/jobs/${job.id}/media`,{headers:{'sec-fetch-site':'cross-site'}});assert.equal(res.status,403);
  res=await request('/api/jobs/unknown/media?path=/etc/passwd');assert.equal(res.status,404);
  fs.unlinkSync(job.output.path);
  try { fs.symlinkSync(path.join(app.directory,'jobs.ndjson'),job.output.path); }
  catch(error) { if(process.platform!=='win32'||error.code!=='EPERM')throw error; t.diagnostic('Symlink replacement subcase unavailable without Windows symlink privilege; missing-file check still applies.'); }
  res=await request(`/api/jobs/${job.id}/media`);assert.equal(res.status,404);
  const form=new FormData();form.set('payload',JSON.stringify(payload(app,{rows:[{prompt:'multipart',firstFrame:'frame'}]})));form.set('frame',image());
  res=await request('/api/batches',{method:'POST',body:form});assert.equal(res.status,201);const created=await res.json();assert.equal(app.store.list({batch:created.id}).jobs[0].assets.length,1);
});
test('range parser rejects ambiguous or impossible byte ranges',()=>{
  assert.deepEqual(parseRange('bytes=-4',10),{start:6,end:9,partial:true});assert.deepEqual(parseRange('bytes=8-99',10),{start:8,end:9,partial:true});
  for(const range of ['bytes=-0','bytes=5-2','bytes=0-1,3-4','bytes=-','bytes=999999999999999999999-'])assert.equal(parseRange(range,10),null);
});
