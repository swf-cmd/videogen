const crypto = require('node:crypto');
const path = require('node:path');
const { MAX_BATCH_BYTES } = require('../config');
const { normalizeInputReference } = require('../media/image');
const { resolveBatchOutputPath, preflightOutputDirectory } = require('../files/output');

function failure(code) { return Object.assign(new Error(code), { code }); }
const MAX_TAKES = 20;
const MAX_BATCH_JOBS = 100000;
// Every source row (or prompt) is rendered this many times. Takes share the
// row's settings and frames and are grouped by shot for review.
function parseTakes(value) {
  if (value === undefined || value === null || value === '') return 1;
  const takes = Number(value);
  if (!Number.isSafeInteger(takes) || takes < 1 || takes > MAX_TAKES) throw failure('invalidTakes');
  return takes;
}
function takeFilename(filename, take, takes) {
  if (takes <= 1 || !filename) return filename;
  const name = String(filename);
  const extension = /\.(?:mp4|webm)$/i.exec(name)?.[0] || '';
  return `${extension ? name.slice(0, -extension.length) : name}-t${take}${extension}`;
}
function frameRef(row, payload, key) {
  const value = Object.hasOwn(row, key) ? row[key] : payload[key];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 1024 || /[\x00-\x1f]/.test(value)) throw failure('invalidAsset');
  return value;
}
function sourceRows(app, payload) {
  if (Buffer.byteLength(JSON.stringify(payload)) > MAX_BATCH_BYTES) throw failure('requestTooLarge');
  if (payload.rows === undefined) return app.prompts(payload).map(prompt => ({ prompt }));
  if (!Array.isArray(payload.rows) || !payload.rows.length) throw failure('missingBatchPrompt');
  return payload.rows;
}
function selectRow(app, payload, row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw failure('invalidParams');
  if (row.apiKey !== undefined || row.key !== undefined) throw failure('useKeysEndpoint');
  if (typeof row.prompt !== 'string' || !row.prompt.trim()) throw failure('missingPrompt');
  const input = { ...payload, params: { ...payload.params, ...row.params } };
  for (const key of ['provider', 'region', 'baseUrl', 'model', 'customCapabilities']) if (row[key] !== undefined) input[key] = row[key];
  if (row.baseUrl === undefined && (row.provider !== undefined && row.provider !== payload.provider || row.region !== undefined && row.region !== payload.region)) delete input.baseUrl;
  const selected = app.selection(input);
  const firstFrame = frameRef(row, payload, 'firstFrame');
  const lastFrame = frameRef(row, payload, 'lastFrame');
  const roles = [firstFrame && 'first_frame', lastFrame && 'last_frame'].filter(Boolean);
  if (firstFrame && !selected.model.capabilities.firstFrame) throw failure('unsupportedFirstFrame');
  if (lastFrame && (!selected.model.capabilities.lastFrame || selected.provider.provider === 'openai-compatible')) throw failure('unsupportedLastFrame');
  if (lastFrame && !firstFrame) throw failure('lastFrameRequiresFirst');
  const assetError = selected.adapter.validateAssets?.(selected.model, selected.params, roles);
  if (assetError) throw failure(assetError);
  selected.cost = { ...selected.adapter.estimateCost(selected.model, { ...selected.params, frameCount: roles.length }), catalogAsOf: selected.provider.asOf };
  return { ...selected, prompt: row.prompt.trim(), firstFrame, lastFrame, filename: row.filename ?? payload.filename };
}
function summarizeCosts(costs) {
  const currencies = new Map();
  for (const cost of costs) {
    const currency = cost?.currency || null;
    if (!currencies.has(currency)) currencies.set(currency, { currency, amount: 0, unknownCount: 0 });
    const item = currencies.get(currency);
    if (Number.isFinite(cost?.amount)) item.amount += cost.amount;
    else item.unknownCount += 1;
  }
  return [...currencies.values()].map(item => ({ ...item, amount: item.unknownCount ? null : Math.round(item.amount * 1e6) / 1e6 }));
}
function planBatch(app, payload, { summaryOnly = false } = {}) {
  const takes = parseTakes(payload.takes);
  const inputs = sourceRows(app, payload);
  // Takes multiply rows without adding request bytes, so bound their product.
  if (takes > 1 && inputs.length * takes > MAX_BATCH_JOBS) throw failure('requestTooLarge');
  // A normal batch shares all settings. Validate/price the model once, even
  // for 50,000 repeated prompts; row mode still validates every override.
  const common = payload.rows === undefined ? selectRow(app, payload, inputs[0]) : null;
  if (summaryOnly && common) {
    const count = inputs.length * takes;
    const amount = Number.isFinite(common.cost.amount) ? Math.round(common.cost.amount * count * 1e6) / 1e6 : null;
    const cost = { ...common.cost, amount, unknownCount: amount === null ? count : 0 };
    const concurrency = app.settings.lanes[common.lane.id]?.concurrency || common.model.concurrencyDefault;
    const typical = app.scheduler.lanes.get(common.lane.id)?.typicalSeconds || common.model.typicalRenderSec;
    return { estimate: { valid: true, cost, costs: [{ currency: cost.currency, amount, unknownCount: cost.unknownCount }], count, concurrency, etaSeconds: Math.ceil(count / concurrency) * typical } };
  }
  const selected = [];
  const rows = inputs.map((row, index) => {
    try {
      const value = common ? { ...common, prompt: row.prompt.trim() } : selectRow(app, payload, row); selected.push(value);
      return { index, valid: true, errors: [], cost: value.cost, model: value.model.id, params: value.params };
    } catch (error) {
      selected.push(null);
      // Legacy callers retain their existing localized error behavior.
      if (payload.rows === undefined) throw error;
      return { index, valid: false, errors: [error.code || error.message], cost: { amount: null, currency: null, basis: 'unknown' } };
    }
  });
  // Row statuses stay per source row; totals count every take.
  const costs = summarizeCosts(rows.flatMap(row => Array.from({ length: takes }, () => row.cost)));
  const laneWork = new Map();
  for (const value of selected.filter(Boolean)) {
    const concurrency = app.settings.lanes[value.lane.id]?.concurrency || value.model.concurrencyDefault;
    const typical = app.scheduler.lanes.get(value.lane.id)?.typicalSeconds || value.model.typicalRenderSec;
    const previous = laneWork.get(value.lane.id) || { count: 0, typical: 0, concurrency };
    previous.count += takes; previous.typical = Math.max(previous.typical, typical); laneWork.set(value.lane.id, previous);
  }
  const cost = costs.length === 1 ? { ...(selected.find(Boolean)?.cost || {}), ...costs[0] } : { amount: null, currency: null, basis: 'mixed' };
  return { selected, takes, estimate: { valid: rows.every(row => row.valid), rows, costs, cost, count: rows.length * takes, takes,
    etaSeconds: Math.max(0, ...[...laneWork.values()].map(lane => Math.ceil(lane.count / lane.concurrency) * lane.typical)),
    concurrency: [...laneWork.values()].reduce((sum, lane) => sum + lane.concurrency, 0) } };
}
async function prepareBatch(app, payload, file, files = new Map(), pixelSize) {
  if (app.stopping) throw failure('serviceStopping');
  app.scheduler.assertHealthy();
  const references = new Map(files);
  if (file?.size) references.set('input_reference', file);
  const input = { ...payload };
  if (file?.size && input.firstFrame === undefined) input.firstFrame = 'input_reference';
  const { selected, estimate, takes } = planBatch(app, input);
  if (!estimate.valid) throw failure('invalidImportRows');
  let budget = null;
  if (payload.budget !== undefined && payload.budget !== null && payload.budget !== '') {
    const amount = Number(typeof payload.budget === 'object' ? payload.budget.amount : payload.budget);
    const currency = payload.budget.currency || estimate.cost.currency;
    if (!Number.isFinite(amount) || amount <= 0 || estimate.cost.amount === null || !currency || currency !== estimate.cost.currency) throw failure('invalidBudget');
    budget = { amount, currency };
  }
  const normalized = new Map();
  const batchId = crypto.randomUUID();
  const jobs = [];
  // Validate every upload before persisting any batch/job or dispatching paid work.
  const total = selected.length * takes;
  for (const [shot, row] of selected.entries()) {
    if (shot && shot % 128 === 0) await new Promise(resolve => setImmediate(resolve));
    if (app.stopping) throw failure('serviceStopping');
    const images = [];
    for (const [role, name] of [['first_frame', row.firstFrame], ['last_frame', row.lastFrame]]) {
      if (!name) continue;
      const upload = references.get(name);
      if (!upload?.size || typeof upload.arrayBuffer !== 'function') throw failure('missingFrameFile');
      const size = row.lane.provider === 'openai-compatible' ? pixelSize(row.params) : ''; // Native video APIs accept image dimensions independently of output resolution.
      const cacheKey = JSON.stringify([name, size]);
      if (!normalized.has(cacheKey)) normalized.set(cacheKey, await normalizeInputReference(upload, size, payload.language));
      images.push({ role, image: normalized.get(cacheKey) });
    }
    const imageError = row.adapter.validateLocalAssets?.(images.map(({ role, image }) => ({ ...image, role })));
    if (imageError) throw failure(imageError);
    for (let take = 1; take <= takes; take += 1) {
      const id = crypto.randomUUID();
      const index = shot * takes + take - 1;
      // Per-row names keep the row number suffix; takes add "-tN" after it.
      const rowPath = resolveBatchOutputPath(payload.outputDir, row.filename, shot, selected.length, id).filePath;
      const targetPath = row.filename && takes > 1 ? path.join(path.dirname(rowPath), takeFilename(path.basename(rowPath), take, takes)) : rowPath;
      jobs.push({
        id, batchId, index, shot, ...(takes > 1 ? { take, takes } : {}), provider: row.lane.provider, region: row.lane.region, baseUrl: row.lane.baseUrl, laneId: row.lane.id,
        model: row.model.id, modelConfig: row.model, params: row.params, prompt: row.prompt, assets: [], images,
        state: 'queued', progress: 0, selection: 'unreviewed', remote: null,
        attempts: { create: 0, poll: 0, download: 0 }, costEstimate: row.cost,
        targetPath,
        createdAt: new Date().toISOString(), language: payload.language || 'zh', requiresKey: Boolean(app.keys.get(row.lane)) || row.adapter.validateKey('') !== null,
      });
    }
  }
  if (jobs.length !== total) throw failure('invalidParams');
  await preflightOutputDirectory(path.dirname(jobs[0].targetPath));
  app.scheduler.assertHealthy();
  if (app.stopping) throw failure('serviceStopping');
  // A frame shared by many rows is stored and verified once, not once per row.
  const stored = new Map();
  for (const job of jobs) {
    job.assets = job.images.map(({ role, image }) => {
      let byRole = stored.get(image);
      if (!byRole) { byRole = new Map(); stored.set(image, byRole); }
      if (!byRole.has(role)) byRole.set(role, app.assets.put(image, role));
      return byRole.get(role);
    });
    delete job.images;
  }
  // Clearing history while these jobs are being persisted must not collect
  // the frames they reference.
  const pending = { assets: [...stored.values()].flatMap((byRole) => [...byRole.values()]) };
  app.pendingAssets?.add(pending);
  try {
    const laneIds = [...new Set(selected.map(row => row.lane.id))];
    app.store.updateBatch(batchId, { state: 'preparing', laneId: laneIds.length === 1 ? laneIds[0] : null, laneIds, budget, total: jobs.length, ...(takes > 1 ? { takes } : {}), createdAt: new Date().toISOString() });
    try {
      await app.store.addManyAsync(jobs, { shouldStop: () => app.stopping });
      app.scheduler.assertHealthy();
      if (app.stopping) throw failure('serviceStopping');
      app.store.updateBatch(batchId, { state: 'active' });
    } catch (error) {
      if (!app.store.failed && app.store.fd !== undefined) {
        const persisted = jobs.reduce((count, job) => count + Number(Boolean(app.store.get(job.id))), 0);
        app.store.updateBatch(batchId, { state: 'paused', pauseReason: 'interrupted_enqueue', total: persisted });
      }
      throw error;
    }
  } finally { app.pendingAssets?.delete(pending); }
  app.scheduler.kick();
  return { ...selected[0], jobs, id: batchId, count: jobs.length };
}
module.exports = { planBatch, selectRow, prepareBatch, summarizeCosts, failure, parseTakes, MAX_TAKES };
