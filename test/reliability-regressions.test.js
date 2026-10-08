const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Application } = require('../src/application');
const { KeyStore, redact, normalizeLane } = require('../src/queue/keys');
const { writeJson, readSettings } = require('../src/store/settings');
const compatible = require('../src/providers/openai-compatible');
const router = require('../src/providers/openrouter');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'videogen-regression-'));
  const app = new Application({ directory });
  t.after(async () => { await app.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return app;
}
const selection = { provider: 'openai-compatible', region: 'custom', baseUrl: 'http://127.0.0.1:1234/v1', model: 'custom-model', prompt: 'A red fox at sunset test local EMPTY 123' };

test('rejected keys never enter redaction and short local keys preserve tasks, URLs and settings through restart', async t => {
  const app = fixture(t);
  const lane = normalizeLane(selection);
  const keys = new KeyStore();
  for (const key of ['test', 'rejected-openrouter-key-123456']) {
    assert.throws(() => keys.set({ ...lane, provider: 'openrouter' }, key, router));
    assert.equal(redact(key), key);
  }
  for (const key of ['fox', '1', 'EMPTY', 'local', '123']) {
    app.setKey({ lane, key });
    const result = await app.prepare({ ...selection, outputDir: path.join(app.directory, 'fox-test-output') });
    const saved = app.store.get(result.jobs[0].id);
    assert.equal(saved.prompt, selection.prompt);
    assert.equal(saved.baseUrl, selection.baseUrl);
    assert.match(saved.targetPath, /fox-test-output/);
    const context = app.context(saved);
    assert.equal(context.redact(saved.baseUrl), selection.baseUrl);
    assert.equal(context.redact('remote-123'), 'remote-123');
  }
  writeJson(app.directory, 'settings.json', { lanes: { [lane.id]: { lane, concurrency: 1, paused: false } } });
  assert.equal(readSettings(app.directory).lanes[lane.id].lane.baseUrl, selection.baseUrl);
  await app.close();
  const restored = new Application({ directory: app.directory });
  assert.equal(restored.store.jobs.size, 5);
  assert.ok([...restored.store.jobs.values()].every(job => job.prompt === selection.prompt));
  await restored.close();
});

test('even accepted long key substrings cannot rewrite a user prompt or path', async t => {
  const app = fixture(t), key = 'long-local-secret-123456';
  app.setKey({ lane: selection, key });
  const prompt = `User intentionally typed ${key}`;
  const result = await app.prepare({ ...selection, prompt, outputDir: path.join(app.directory, key) });
  const saved = app.store.get(result.jobs[0].id);
  assert.equal(saved.prompt, prompt);
  assert.match(saved.targetPath, new RegExp(key));
  app.store.update(saved.id, { error: { message: `Provider echoed ${key}`, authorization: key } });
  assert.equal(app.store.get(saved.id).error.message, 'Provider echoed [REDACTED]');
});

test('summary estimate for 50000 prompts selects once and returns bounded data with identical cost', t => {
  const app = fixture(t);
  const payload = { provider: 'openrouter', region: 'global', model: 'alibaba/wan-3.0', prompt: 'fox', batchCount: 50000 };
  let selections = 0;
  const original = app.selection.bind(app);
  app.selection = input => { selections += 1; return original(input); };
  const estimate = app.estimate({ ...payload, summaryOnly: true });
  assert.equal(selections, 1);
  assert.equal(estimate.rows, undefined);
  assert.equal(estimate.count, 50000);
  assert.ok(Buffer.byteLength(JSON.stringify(estimate)) < 2048);
  const one = app.estimate({ ...payload, batchCount: 1 });
  assert.equal(estimate.cost.amount, Math.round(one.cost.amount * 50000 * 1e6) / 1e6);
});

test('fatal scheduler refuses new batches before writing any job', async t => {
  const app = fixture(t);
  app.scheduler.logger = () => {};
  app.scheduler.fatal(new Error('synthetic scheduler bug'));
  await assert.rejects(app.prepare({ ...selection, outputDir: path.join(app.directory, 'out') }), { status: 503 });
  assert.equal(app.store.jobs.size, 0);
});

test('newest batches appear first and deleting a cursor batch preserves the next page', t => {
  const app = fixture(t);
  for (const id of ['old', 'middle', 'new']) app.store.updateBatch(id, { state: 'active' });
  const first = app.batches({ limit: 1 });
  assert.equal(first.batches[0].id, 'new');
  app.store.append('new', 'delete_batch', {}, { sync: true });
  assert.deepEqual(app.batches({ cursor: first.nextCursor }).batches.map(batch => batch.id), ['middle', 'old']);
});

test('shutdown during chunked enqueue preserves only a paused batch and waits for its records', async t => {
  const app = fixture(t);
  const original = app.store.addManyAsync.bind(app.store);
  let closing;
  app.store.addManyAsync = async (...args) => {
    const pending = original(...args);
    closing = new Promise(resolve => setImmediate(() => resolve(app.close())));
    return pending;
  };
  await assert.rejects(app.prepare({ ...selection, batchCount: 1000, outputDir: path.join(app.directory, 'out') }), { code: 'serviceStopping' });
  await closing;
  const restored = new Application({ directory: app.directory });
  const batch = [...restored.store.batches.values()][0];
  assert.equal(batch.state, 'paused');
  assert.equal(batch.pauseReason, 'interrupted_enqueue');
  assert.equal(batch.total, restored.store.jobs.size);
  assert.ok(batch.total > 0 && batch.total < 1000);
  assert.ok([...restored.store.jobs.values()].every(job => job.attempts.create === 0));
  await restored.close();
});
