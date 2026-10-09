const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Scheduler } = require("../../src/queue/scheduler");
const { JobStore } = require("../../src/store/job-store");
const { KeyStore, normalizeLane } = require("../../src/queue/keys");

function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function settle(n = 80) { for (let index = 0; index < n; index += 1) await Promise.resolve(); }

// Deterministic clock: timers fire only when the test advances time.
class Clock {
  constructor() { this.value = Date.parse("2026-10-08T00:00:00Z"); this.timers = new Map(); this.next = 0; }
  now = () => this.value;
  setTimer = (callback, ms) => { const id = ++this.next; this.timers.set(id, { callback, at: this.value + ms }); return id; };
  clearTimer = (id) => this.timers.delete(id);
  async advance(ms) {
    this.value += ms;
    for (const [id, item] of [...this.timers]) if (item.at <= this.value) { this.timers.delete(id); item.callback(); }
    await settle();
  }
}

// A real store and scheduler with a scripted "mock" adapter and no disk output.
function harness(t, overrides = {}, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-harness-"));
  const clock = new Clock();
  const store = new JobStore(directory);
  const keys = new KeyStore();
  const calls = { create: [], poll: [], download: [] };
  const logs = [];
  const adapter = {
    validateKey: () => null,
    supportsIdempotencyKey: false,
    classifyError: (error) => error.category || "transient",
    async create(ctx, job) { calls.create.push(job.id); return { remoteId: `remote-${job.id}`, status: "running" }; },
    async poll(ctx, job) { calls.poll.push(job.id); return { status: "running" }; },
    async download(ctx, job) { calls.download.push(job.id); return {}; },
    ...overrides,
  };
  const scheduler = new Scheduler({
    store, keys, adapters: { mock: adapter }, context: (job) => ({ lane: normalizeLane(job), key: keys.get(job) }),
    settings: { lanes: {} }, onSettings: () => {}, now: clock.now, random: () => 0.5, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    logger: { warn: (line) => logs.push(JSON.parse(line)), error: (line) => logs.push(JSON.parse(line)) },
    writeOutput: async (response, targetPath, { onPublished }) => { const output = { path: targetPath, bytes: 12, sha256: "a".repeat(64) }; onPublished(output); return output; },
    ...options,
  });
  function add(id, laneName = "a", patch = {}) {
    const lane = normalizeLane({ provider: "mock", region: laneName, baseUrl: `https://${laneName}.example/v1` });
    const batchId = patch.batchId || `batch-${laneName}`;
    if (!store.batches.has(batchId)) store.updateBatch(batchId, { id: batchId, laneId: lane.id, state: "active", budget: null });
    return store.add({
      batchId, ...lane, id, laneId: lane.id, model: "model", modelConfig: { concurrencyDefault: 1, pollIntervalSec: 0.01, typicalRenderSec: 30 },
      state: "queued", prompt: id, params: {}, assets: [], remote: null, attempts: { create: 0, poll: 0, download: 0 },
      costEstimate: { amount: 1, currency: "USD" }, targetPath: path.join(directory, `${id}.mp4`), language: "en",
      createdAt: new Date(clock.now()).toISOString(), ...patch,
    });
  }
  t.after(async () => {
    try { await scheduler.close(0); } catch {}
    try { store.close(); } catch {}
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { directory, clock, store, keys, adapter, scheduler, calls, logs, add };
}

module.exports = { harness, deferred, settle, Clock };
