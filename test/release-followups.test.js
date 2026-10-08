const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');
const { Application } = require('../src/application');
const { JobStore } = require('../src/store/job-store');
const { configureApplication, handleRequest } = require('../src/http/router');
const { PORT } = require('../src/config');
const { SERVER_MESSAGES, st } = require('../src/i18n/server-messages');

function directory(t) {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), 'videogen-followups-'));
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}
function job(id, patch = {}) {
  return { id, batchId: 'batch', state: 'queued', provider: 'openai-compatible', region: 'custom', baseUrl: 'http://127.0.0.1:9000/v1', prompt: 'A red fox', attempts: { create: 0, poll: 0, download: 0 }, ...patch };
}

test('health HTTP status agrees with scheduler health in both states', async t => {
  let healthy = true;
  configureApplication({ scheduler: { health: () => ({ healthy }) } });
  const server = http.createServer(handleRequest);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  for (const expected of [true, false]) {
    healthy = expected;
    const response = await new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port: server.address().port, path: '/api/health', headers: { host: `127.0.0.1:${PORT}` } }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }).on('error', reject);
    });
    assert.equal(response.status, expected ? 200 : 503);
    assert.deepEqual(response.body, { healthy: expected });
  }
});

test('damaged saved endpoints fail with recovery guidance before recovery writes', t => {
  for (const source of ['job', 'settings', 'json']) {
    const dir = directory(t), log = path.join(dir, 'jobs.ndjson');
    const store = new JobStore(dir, { recover: false });
    store.add(job('paid-pending', { baseUrl: source === 'job' ? 'http://[REDACTED]27.0.0.[REDACTED]' : 'http://127.0.0.1/v1' }));
    store.update('paid-pending', { state: 'submitting', attempts: { create: 1, poll: 0, download: 0 } }, { sync: true });
    store.close();
    if (source === 'settings') fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ lanes: { old: { lane: { provider: 'openai-compatible', region: 'custom', baseUrl: 'http://[REDACTED]27.0.0.[REDACTED]' }, concurrency: 1 } } }));
    if (source === 'json') fs.appendFileSync(log, '{broken}\n');
    const before = fs.readFileSync(log);
    assert.throws(() => new Application({ directory: dir }), error => {
      assert.equal(error.code, 'dataRecoveryRequired');
      assert.equal(error.directory, path.resolve(dir));
      assert.ok(error.cause);
      return true;
    });
    assert.deepEqual(fs.readFileSync(log), before);
    assert.equal(fs.existsSync(path.join(dir, 'lock')), false);
    for (const language of Object.keys(SERVER_MESSAGES)) {
      assert.match(st(language, 'dataRecoveryRequired', { directory: dir }), /VIDEOGEN_DATA_DIR/);
      assert.ok(st(language, 'dataRecoveryRequired', { directory: dir }).includes(dir));
      assert.notEqual(st(language, 'serviceStarting'), 'serviceStarting');
    }
    if (source === 'job') {
      const child = spawnSync(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, VIDEOGEN_DATA_DIR: dir, VIDEOGEN_LANGUAGE: 'en', PORT: '5188' }, encoding: 'utf8', timeout: 10000 });
      assert.equal(child.status, 1, child.stderr);
      assert.ok(child.stderr.includes(dir), child.stderr);
      assert.match(child.stderr, /complete backup/);
      assert.match(child.stderr, /Do not resubmit/);
      assert.doesNotMatch(child.stdout, /running at/);
      assert.deepEqual(fs.readFileSync(log), before);
    }
  }
});

test('startup explains unverifiable lock ownership without changing the old lock', t => {
  const dir = directory(t), filename = path.join(dir, 'lock');
  const saved = JSON.stringify({ pid: process.pid, token: 'legacy-owner-without-identity' });
  fs.writeFileSync(filename, saved);
  const child = spawnSync(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, VIDEOGEN_DATA_DIR: dir, VIDEOGEN_LANGUAGE: 'en', PORT: '5188' }, encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stderr, /could not be verified/);
  assert.doesNotMatch(child.stdout, /running at/);
  assert.equal(fs.readFileSync(filename, 'utf8'), saved);
  for (const language of Object.keys(SERVER_MESSAGES)) {
    assert.notEqual(st(language, 'dataLockOwnerUncertain'), 'dataLockOwnerUncertain');
    assert.match(st(language, 'dataRecoveryRequired', { directory: dir }), /recover-data\.cjs/);
  }
});

test('compaction retries temporary busy replacements and preserves concurrent tail', async t => {
  for (const code of ['EPERM', 'EBUSY']) {
    const dir = directory(t);
    let store = new JobStore(dir);
    store.add(job('before'));
    const original = fs.renameSync, attempts = new Map();
    fs.renameSync = (from, to) => {
      if (path.dirname(to) === dir) {
        const count = (attempts.get(to) || 0) + 1;
        attempts.set(to, count);
        if (count < 3) throw Object.assign(new Error(code), { code });
      }
      return original(from, to);
    };
    try {
      const pending = store.compactAsync();
      store.add(job('during'));
      await pending;
      store.add(job('after'));
      assert.equal(store.failed, undefined);
    } finally { fs.renameSync = original; store.close(); }
    assert.equal(attempts.get(path.join(dir, 'jobs.ndjson')), 3);
    assert.equal(attempts.get(path.join(dir, 'jobs.snapshot.ndjson')), 3);
    store = new JobStore(dir);
    assert.deepEqual([...store.jobs.keys()], ['before', 'during', 'after']);
    store.close();
  }
});

test('persistent busy replacement defers maintenance; storage failures stay fatal', async t => {
  for (const code of ['EPERM', 'ENOSPC']) {
    const dir = directory(t);
    let store = new JobStore(dir);
    store.add(job('saved'));
    const original = fs.renameSync;
    let calls = 0;
    fs.renameSync = (from, to) => {
      if (to === path.join(dir, 'jobs.ndjson')) { calls++; throw Object.assign(new Error(code), { code }); }
      return original(from, to);
    };
    try {
      if (code === 'EPERM') {
        await store.compactAsync();
        assert.equal(store.failed, undefined);
        assert.ok(store.compactionRetryAt > Date.now());
        store.add(job('still-writable'));
      } else {
        await assert.rejects(store.compactAsync(), { code });
        assert.equal(store.failed, true);
      }
    }
    finally { fs.renameSync = original; store.close(); }
    assert.equal(calls, code === 'EPERM' ? 6 : 1);
    store = new JobStore(dir);
    assert.equal(store.get('saved').prompt, 'A red fox');
    if (code === 'EPERM') assert.equal(store.get('still-writable').prompt, 'A red fox');
    store.add(job('reopened'));
    store.close();
  }
});

test('busy snapshots and journals retry in the background without losing paid IDs', async t => {
  for (const name of ['jobs.snapshot.ndjson', 'jobs.ndjson']) {
    const dir = directory(t), store = new JobStore(dir);
    store.add(job('paid'));
    const original = fs.renameSync, notices = [];
    let held = true, calls = 0;
    store.on('maintenance', notice => notices.push(notice));
    fs.renameSync = (from, to) => {
      if (to === path.join(dir, name)) {
        calls++;
        if (held) throw Object.assign(new Error('scanner hold'), { code: 'EBUSY' });
      }
      return original(from, to);
    };
    try {
      const compacting = store.compactAsync();
      store.add(job('during'));
      await compacting;
      assert.equal(calls, 6);
      assert.equal(notices.length, 1);
      assert.equal(notices[0].retryAfterMs, 1000);
      store.update('paid', { state: 'submitting', attempts: { create: 1, poll: 0, download: 0 } });
      store.update('paid', { state: 'running', remote: { id: 'already-charged' } });
      store.flush();
      // Read the on-disk pair during deferral, without changing the active log.
      const restored = new JobStore(dir, { lock: false, recover: false });
      assert.equal(restored.get('paid').remote.id, 'already-charged');
      assert.ok(restored.get('during'));
      restored.close();
      held = false;
      const deadline = Date.now() + 5000;
      while (store.compactionRetryAt && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 30));
      if (store.compacting) await store.compacting;
      assert.equal(store.compactionRetryAt, 0, 'background maintenance must recover');
      assert.equal(store.failed, undefined);
      assert.ok(calls > 6);
      store.add(job('after'));
    } finally { fs.renameSync = original; store.close(); }
    const restored = new JobStore(dir);
    assert.equal(restored.get('paid').remote.id, 'already-charged');
    assert.ok(restored.get('during'));
    assert.ok(restored.get('after'));
    restored.close();
  }
});

test('busy journal replacement fails closed if the original log cannot be reopened', async t => {
  const dir = directory(t), store = new JobStore(dir);
  store.add(job('saved'));
  const rename = fs.renameSync, open = fs.openSync;
  let closed = false;
  store.onCheckpoint = name => { if (name === 'asyncCompact:journalClosed') closed = true; };
  fs.renameSync = (from, to) => {
    if (to === path.join(dir, 'jobs.ndjson')) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
    return rename(from, to);
  };
  fs.openSync = (name, ...args) => {
    if (closed && name === path.join(dir, 'jobs.ndjson')) throw Object.assign(new Error('cannot write'), { code: 'EACCES' });
    return open(name, ...args);
  };
  try {
    await assert.rejects(store.compactAsync(), { code: 'EACCES' });
    assert.equal(store.failed, true);
    assert.throws(() => store.add(job('unsafe')), { code: 'storeClosed' });
  } finally { fs.renameSync = rename; fs.openSync = open; store.close(); }
  const restored = new JobStore(dir);
  assert.ok(restored.get('saved'));
  assert.equal(restored.get('unsafe'), undefined);
  restored.close();
});

test('model discovery strips raw provider fields and credentials', async t => {
  const app = new Application({ directory: directory(t) });
  t.after(() => app.close());
  const adapter = app.adapters['openai-compatible'];
  const original = adapter.listModels;
  adapter.listModels = async () => ({ data: [{ id: 'video-1', name: 'Video 1', api_key: 'leaked', metadata: { password: 'secret' } }], debug: 'raw response' });
  try {
    const result = await app.refreshCatalog('openai-compatible', {});
    assert.deepEqual(result, { models: [{ id: 'video-1', label: 'Video 1' }], refreshed: true });
  } finally { adapter.listModels = original; }
});

test('short proxy credentials redact diagnostics without changing schema or user content', () => {
  const script = `
    const { redact, redactDiagnostics, sanitizeRecord } = require('./src/queue/keys');
    const { safeError } = require('./src/http/errors');
    const input = { id:'fox', remote:{id:'1'}, prompt:'fox and 1 at http://127.0.0.1', error:{code:'1',category:'transient',providerMessage:'proxy user fox password 1; 127 remains'} };
    process.stdout.write(JSON.stringify({ raw: redact(input.prompt), clean:sanitizeRecord(input), error:safeError(new Error('proxy fox rejected password 1')), standalone:redactDiagnostics('fox 1 127 foxes') }));
  `;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, HTTP_PROXY: 'http://fox:1@127.0.0.1:8080', HTTPS_PROXY: '', ALL_PROXY: '', http_proxy: '', https_proxy: '', all_proxy: '' }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.raw, 'fox and 1 at http://127.0.0.1');
  assert.equal(data.clean.prompt, data.raw);
  assert.equal(data.clean.id, 'fox');
  assert.equal(data.clean.remote.id, '1');
  assert.equal(data.clean.error.code, '1');
  assert.equal(data.clean.error.category, 'transient');
  assert.equal(data.clean.error.providerMessage, 'proxy user [REDACTED] password [REDACTED]; 127 remains');
  assert.equal(data.standalone, '[REDACTED] [REDACTED] 127 foxes');
  assert.equal(data.error.message, 'proxy [REDACTED] rejected password [REDACTED]');
});
