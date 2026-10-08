const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Scheduler } = require("../src/queue/scheduler");
const { JobStore } = require("../src/store/job-store");
const { KeyStore, normalizeLane } = require("../src/queue/keys");

function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
async function settle() { for (let index = 0; index < 80; index += 1) await Promise.resolve(); }
class Clock {
  constructor() { this.value = Date.parse("2026-10-08T00:00:00Z"); this.timers = new Map(); this.next = 0; }
  now = () => this.value;
  setTimer = (callback, ms) => { const id = ++this.next; this.timers.set(id, { callback, at: this.value + ms }); return id; };
  clearTimer = (id) => this.timers.delete(id);
  async advance(ms) { this.value += ms; for (const [id, item] of [...this.timers]) if (item.at <= this.value) { this.timers.delete(id); item.callback(); } await settle(); }
}
function fixture(t, overrides = {}, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-scheduler-"));
  const clock = new Clock();
  const store = new JobStore(directory);
  const keys = new KeyStore();
  const calls = { create: [], poll: [], download: [] };
  const forever = deferred();
  const adapter = {
    validateKey: () => null,
    supportsIdempotencyKey: false,
    classifyError: (error) => error.category || "transient",
    async create(ctx, job) { calls.create.push(job.id); return { remoteId: `remote-${job.id}`, status: "running" }; },
    async poll(ctx, job) { calls.poll.push(job.id); return forever.promise; },
    async download(ctx, job) { calls.download.push(job.id); return {}; },
    ...overrides,
  };
  const settings = { lanes: {} };
  const scheduler = new Scheduler({ store, keys, adapters: { mock: adapter }, context: (job) => ({ lane: normalizeLane(job), key: keys.get(job) }), settings, onSettings: () => {}, now: clock.now, random: () => 0.5, setTimer: clock.setTimer, clearTimer: clock.clearTimer, writeOutput: async (response, targetPath, { onPublished }) => { const output = { path: targetPath, bytes: 12, sha256: "a".repeat(64) }; onPublished(output); return output; }, ...options });
  function add(id, laneName = "a", patch = {}) {
    const lane = normalizeLane({ provider: "mock", region: laneName, baseUrl: `https://${laneName}.example/v1` });
    const batchId = patch.batchId || `batch-${laneName}`;
    if (!store.batches.has(batchId)) store.updateBatch(batchId, { id: batchId, laneId: lane.id, state: "active", budget: null });
    const job = { id, batchId, ...lane, id, laneId: lane.id, model: "model", modelConfig: { concurrencyDefault: 1, pollIntervalSec: 0.01, typicalRenderSec: 30 }, state: "queued", prompt: id, params: {}, assets: [], remote: null, attempts: { create: 0, poll: 0, download: 0 }, costEstimate: { amount: 1, currency: "USD" }, targetPath: path.join(directory, `${id}.mp4`), language: "en", createdAt: new Date(clock.now()).toISOString(), ...patch };
    return store.add(job);
  }
  t.after(async () => { await scheduler.close(0); store.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return { directory, clock, store, keys, adapter, scheduler, calls, add, forever };
}
const success = { status: "succeeded", result: { url: "https://cdn.example/output.mp4", needsAuth: false } };

test("model defaults apply after key registration; whole render holds 3/5 slots and downloads have a global pool of 3", async (t) => {
  const render = deferred(); const download = deferred();
  const active = { a: 0, b: 0 }; const maximum = { a: 0, b: 0 };
  let downloading = 0; let maxDownloading = 0;
  const f = fixture(t, {
    async create(ctx, job) { f.calls.create.push(job.id); active[job.region] += 1; maximum[job.region] = Math.max(maximum[job.region], active[job.region]); return { remoteId: `r-${job.id}` }; },
    async poll(ctx, job) { await render.promise; active[job.region] -= 1; return success; },
    async download(ctx, job) { f.calls.download.push(job.id); downloading += 1; maxDownloading = Math.max(maxDownloading, downloading); await download.promise; downloading -= 1; return {}; },
  });
  for (const name of ["a", "b"]) {
    f.scheduler.keysChanged({ provider: "mock", region: name, baseUrl: `https://${name}.example/v1` });
    for (let i = 0; i < 10; i += 1) f.add(`${name}-${i}`, name, { modelConfig: { concurrencyDefault: name === "a" ? 3 : 5, pollIntervalSec: 0.01, typicalRenderSec: 42 } });
  }
  f.scheduler.start(); await settle();
  assert.deepEqual(f.scheduler.laneList().map((lane) => [lane.concurrency, lane.typicalRenderSec]), [[3, 42], [5, 42]]);
  assert.equal(f.calls.create.length, 8);
  await f.clock.advance(1000); assert.equal(f.calls.create.length, 8, "HTTP completion must not release render slots");
  render.resolve(); await settle();
  assert.equal(f.calls.create.length, 20, "downloads must not occupy provider slots");
  assert.equal(f.calls.download.length, 3);
  assert.deepEqual(maximum, { a: 3, b: 5 });
  download.resolve(); await settle();
  assert.equal(maxDownloading, 3);
  assert.ok([...f.store.jobs.values()].every((job) => job.state === "succeeded"));
});

test("429 cools the whole lane until Retry-After, then safely retries the unaccepted create", async (t) => {
  const f = fixture(t, { async create(ctx, job) { f.calls.create.push([job.id, f.clock.now()]); if (f.calls.create.length === 1) throw Object.assign(new Error("429"), { category: "rate_limited", retryAfterMs: 5000 }); return { remoteId: job.id }; } });
  f.add("one"); f.add("two"); f.scheduler.start(); await settle();
  assert.equal(f.store.get("one").state, "queued"); assert.equal(f.scheduler.laneList()[0].state, "cooldown");
  await f.clock.advance(4999); assert.equal(f.calls.create.length, 1);
  await f.clock.advance(1); assert.equal(f.calls.create.length, 2);
  assert.equal(f.calls.create[1][1] - f.calls.create[0][1], 5000);
});

test("401 waits for a new key without failing jobs; lane RPM bucket is initialized when its first model arrives", async (t) => {
  const f = fixture(t, { validateKey: (key) => key ? null : "invalidKey", async create(ctx, job) { f.calls.create.push(job.id); if (ctx.key === "old-scheduler-test-key") throw Object.assign(new Error("401"), { category: "auth", retryAfterMs: 0 }); return { remoteId: job.id }; } });
  const descriptor = { provider: "mock", region: "a", baseUrl: "https://a.example/v1" };
  f.keys.set(descriptor, "old-scheduler-test-key", f.adapter); f.scheduler.keysChanged(descriptor);
  f.add("one", "a", { requiresKey: true, modelConfig: { concurrencyDefault: 2, rpm: 60 } }); f.add("two", "a", { requiresKey: true, modelConfig: { concurrencyDefault: 2, rpm: 60 } });
  f.scheduler.start(); await settle(); assert.equal(f.calls.create.length, 2);
  assert.equal(f.scheduler.laneList()[0].state, "needs_key");
  assert.ok([...f.store.jobs.values()].every((job) => job.state === "queued"));
  await f.clock.advance(10000); assert.equal(f.calls.create.length, 2);
  f.keys.set(descriptor, "new-scheduler-test-key", f.adapter); f.scheduler.keysChanged(descriptor); await settle();
  assert.equal(f.calls.create.length, 4);
  assert.ok([...f.store.jobs.values()].every((job) => job.state === "running"));
});

test("RPM tokens limit dispatch even when lane concurrency permits more tasks", async (t) => {
  const f = fixture(t); for (let i = 0; i < 4; i += 1) f.add(String(i), "a", { modelConfig: { concurrencyDefault: 4, rpm: 2 } });
  f.scheduler.start(); await settle(); assert.equal(f.calls.create.length, 2);
  await f.clock.advance(29999); assert.equal(f.calls.create.length, 2);
  await f.clock.advance(1); assert.equal(f.calls.poll.length, 1, "refilled token also limits poll requests");
  assert.equal(f.calls.create.length, 2);
});

test("moderation fails only its task; invalid provider poll responses eventually open the circuit", async (t) => {
  const f = fixture(t, { async create(ctx, job) { f.calls.create.push(job.id); if (job.id === "blocked") throw Object.assign(new Error("moderation"), { category: "moderation" }); return { remoteId: job.id }; }, async poll(ctx, job) { f.calls.poll.push(job.id); return { status: "succeeded" }; } });
  f.add("blocked"); f.add("rendering"); f.add("queued"); f.scheduler.start(); await settle();
  assert.equal(f.store.get("blocked").state, "failed"); assert.equal(f.store.get("blocked").error.category, "moderation");
  await f.clock.advance(1100); await f.clock.advance(2200);
  assert.equal(f.calls.poll.length, 3); assert.equal(f.calls.create.length, 2);
  assert.equal(f.scheduler.laneList()[0].reason, "circuit_open"); assert.equal(f.store.get("rendering").state, "running");
});

test("budget counts reserved and possibly charged jobs, pausing only future creates", async (t) => {
  const f = fixture(t); for (let i = 0; i < 5; i += 1) f.add(String(i), "a", { modelConfig: { concurrencyDefault: 5 } });
  f.store.updateBatch("batch-a", { budget: { amount: 2, currency: "USD" } });
  f.scheduler.start(); await settle(); assert.equal(f.calls.create.length, 2);
  assert.equal(f.store.batches.get("batch-a").pauseReason, "budget");
  assert.equal([...f.store.jobs.values()].filter((job) => job.state === "queued").length, 3);
  assert.equal([...f.store.jobs.values()].reduce((sum, job) => sum + (job.estimatedCharges || 0), 0), 2);
});

test("ambiguous create reserves a slot, batch cancellation preserves review, and explicit association never creates", async (t) => {
  const f = fixture(t, { async create(ctx, job) { f.calls.create.push(job.id); throw Object.assign(new Error("connection reset after accept"), { code: "ECONNRESET" }); }, async poll() { return success; } });
  f.add("unknown"); f.add("queued"); f.scheduler.start(); await settle();
  assert.equal(f.store.get("unknown").state, "needs_review"); assert.equal(f.calls.create.length, 1);
  await f.clock.advance(100000); assert.equal(f.calls.create.length, 1);
  await f.scheduler.batchAction("batch-a", "cancel");
  assert.equal(f.store.get("unknown").state, "needs_review"); assert.equal(f.store.get("queued").state, "cancelled");
  await assert.rejects(f.scheduler.jobAction("unknown", "cancel"), { code: "invalidTransition" });
  await f.scheduler.jobAction("unknown", "resolve", { action: "attach_remote_id", remoteId: "found-id" }); await settle();
  assert.equal(f.store.get("unknown").state, "succeeded"); assert.equal(f.calls.create.length, 1);
});

test("explicit resubmit grants exactly one new create; verified idempotent retry reuses the key and charge estimate", async (t) => {
  const f = fixture(t, { async create(ctx, job, options) { f.calls.create.push(options.idempotencyKey); if (f.calls.create.length < 3) throw Object.assign(new Error("unknown"), { category: "unknown_outcome", retryAfterMs: 0 }); return { remoteId: "accepted" }; } });
  f.add("one"); f.scheduler.start(); await settle();
  await f.scheduler.jobAction("one", "resolve", { action: "resubmit" }); await settle();
  assert.equal(f.calls.create.length, 2); assert.equal(f.store.get("one").state, "needs_review");
  assert.equal(f.store.get("one").estimatedCharges, 2);
  f.adapter.supportsIdempotencyKey = true;
  await f.scheduler.jobAction("one", "resolve", { action: "resubmit" }); await settle();
  assert.equal(f.store.get("one").state, "running"); assert.equal(f.calls.create.length, 3);
  const second = fixture(t, { supportsIdempotencyKey: true, async create(ctx, job, options) { second.calls.create.push(options.idempotencyKey); if (second.calls.create.length === 1) throw Object.assign(new Error("unknown"), { category: "unknown_outcome", retryAfterMs: 0 }); return { remoteId: "same-remote" }; } });
  second.add("idempotent"); second.scheduler.start(); await settle();
  assert.deepEqual(second.calls.create, ["idempotent", "idempotent"]); assert.equal(second.store.get("idempotent").estimatedCharges, 1);
});

test("remote cancellation waits for poll and preserves a completed paid result", async (t) => {
  const polled = deferred(); let cancels = 0;
  const f = fixture(t, { async poll() { return polled.promise; }, async cancel() { cancels += 1; } });
  f.add("one"); f.scheduler.start(); await settle();
  const cancellation = f.scheduler.jobAction("one", "cancel"); await settle(); assert.equal(cancels, 0);
  polled.resolve(success); await cancellation; await settle();
  assert.equal(cancels, 0); assert.equal(f.store.get("one").state, "succeeded"); assert.equal(f.scheduler.fatalError, undefined);
});

test("paused/cancelled batches stop queued creates while uncancellable paid work finishes", async (t) => {
  const polled = deferred(); const f = fixture(t, { async poll() { return polled.promise; } });
  f.add("one"); f.add("two"); await f.scheduler.batchAction("batch-a", "pause"); f.scheduler.start(); await settle(); assert.equal(f.calls.create.length, 0);
  await f.scheduler.batchAction("batch-a", "resume"); await settle(); assert.equal(f.calls.create.length, 1);
  await f.scheduler.batchAction("batch-a", "cancel"); assert.equal(f.store.get("two").state, "cancelled"); assert.equal(f.store.get("one").state, "running");
  polled.resolve(success); await settle(); assert.equal(f.store.get("one").state, "succeeded");
});

test("expired download is terminal, download retries never create, and signed result downloads continue without a key", async (t) => {
  const f = fixture(t, { async poll() { return { ...success, result: { ...success.result, expiresAt: new Date(f.clock.now() - 1).toISOString() } }; }, async download() { throw Object.assign(new Error("403"), { status: 403, category: "auth" }); } });
  f.add("one"); f.scheduler.start(); await settle(); assert.equal(f.store.get("one").state, "result_expired"); assert.equal(f.calls.create.length, 1);
  const second = fixture(t, { validateKey: (key) => key ? null : "invalidKey", async download(ctx, job) { second.calls.download.push(job.id); if (second.calls.download.length === 1) throw Object.assign(new Error("503"), { category: "transient", retryAfterMs: 1 }); return {}; } });
  const job = second.add("restored", "a", { state: "running", remote: { id: "paid" }, requiresKey: true }); second.store.update(job.id, { state: "downloading", result: success.result });
  second.scheduler.start(); await settle(); await second.clock.advance(1);
  assert.equal(second.store.get(job.id).state, "succeeded"); assert.equal(second.calls.create.length, 0); assert.equal(second.calls.download.length, 2);
});

test("shutdown drains a pending create ID; timeout leaves durable review and ignores late responses", async (t) => {
  const created = deferred(); const f = fixture(t, { async create() { return created.promise; } }); f.add("one"); f.add("two"); f.scheduler.start(); await settle();
  const closing = f.scheduler.close(1000); created.resolve({ remoteId: "paid" }); await closing;
  assert.equal(f.store.get("one").remote.id, "paid"); assert.equal(f.store.get("two").state, "queued");
  const late = deferred(); const second = fixture(t, { async create() { return late.promise; } }); second.add("late"); second.scheduler.start(); await settle(); await second.scheduler.close(0);
  assert.equal(second.store.get("late").state, "needs_review"); late.resolve({ remoteId: "late-remote" }); await settle(); assert.equal(second.store.get("late").state, "needs_review");
});

test("fatal store closure stops dispatch and is visible as a paused lane", async (t) => {
  const f = fixture(t); f.add("one"); f.store.close(); f.scheduler.start(); await settle();
  assert.equal(f.calls.create.length, 0); assert.equal(f.scheduler.laneList()[0].reason, "storeClosed");
});

test("download pool prioritizes expiring results and lane counters include keyless pending downloads", async (t) => {
  const f = fixture(t, { validateKey: (key) => key ? null : "invalidKey" }, { downloadConcurrency: 1 });
  for (const [id, milliseconds] of [["later", 60000], ["urgent", 1000], ["middle", 10000]]) {
    f.add(id, "a", { state: "running", remote: { id: `paid-${id}` }, requiresKey: true });
    f.store.update(id, { state: "downloading", result: success.result, resultExpiresAt: new Date(f.clock.now() + milliseconds).toISOString() });
  }
  const lane = f.scheduler.laneList()[0];
  assert.equal(lane.downloading, 3); assert.equal(lane.pending, 3); assert.equal(lane.waitingForKey, 3); assert.equal(lane.inFlight, 0);
  f.scheduler.start(); await settle();
  assert.deepEqual(f.calls.download, ["urgent", "middle", "later"]); assert.equal(f.calls.create.length, 0);
});

test("quota and unavailable models pause the lane and resume only after an explicit action", async (t) => {
  for (const category of ["quota", "model_unavailable"]) {
    const f = fixture(t, { async create(ctx, job) { f.calls.create.push(job.id); if (f.calls.create.length === 1) throw Object.assign(new Error(category), { category, retryAfterMs: 0 }); return { remoteId: job.id }; } });
    f.add("one"); f.add("two"); f.scheduler.start(); await settle();
    assert.equal(f.scheduler.laneList()[0].reason, category); assert.equal(f.store.get("one").state, "queued");
    await f.clock.advance(60000); assert.equal(f.calls.create.length, 1);
    f.scheduler.setLane(f.scheduler.laneList()[0].id, { action: "resume" }); await settle(); assert.equal(f.calls.create.length, 2);
  }
});

test("safe asset uploads retry before create, cache only in memory and refresh expired references", async (t) => {
  let uploaded = 0;
  const f = fixture(t, {
    async prepareAssets() { uploaded += 1; if (uploaded === 1) throw Object.assign(new Error("upload transient"), { category: "transient", retryAfterMs: 1 }); return [{ uri: `upload-${uploaded}`, expiresAt: new Date(f.clock.now() + 100).toISOString() }]; },
    async create(ctx, job) { f.calls.create.push(ctx.remoteAssets[0].uri); if (f.calls.create.length < 3) throw Object.assign(new Error("429"), { category: "rate_limited", retryAfterMs: f.calls.create.length === 1 ? 10 : 200 }); return { remoteId: job.id }; },
  });
  f.add("one"); f.scheduler.start(); await settle(); assert.equal(f.store.get("one").attempts.create, 0);
  await f.clock.advance(1); assert.equal(uploaded, 2);
  await f.clock.advance(10); assert.equal(uploaded, 2, "unexpired references survive a safe rejected create retry");
  await f.clock.advance(200); assert.equal(uploaded, 3);
  assert.deepEqual(f.calls.create, ["upload-2", "upload-2", "upload-3"]); assert.equal(f.store.get("one").state, "running");
  assert.ok(!fs.readFileSync(path.join(f.directory, "jobs.ndjson"), "utf8").includes("upload-"));
});

test("remote cancellation is issued once after an active poll finishes and prevents subsequent polling", async (t) => {
  const polled = deferred(); let cancels = 0;
  const f = fixture(t, { async poll() { f.calls.poll.push("poll"); return polled.promise; }, async cancel() { cancels += 1; } });
  f.add("one"); f.scheduler.start(); await settle();
  const first = f.scheduler.jobAction("one", "cancel"); const second = f.scheduler.jobAction("one", "cancel"); await settle();
  assert.equal(cancels, 0); polled.resolve({ status: "running" }); await Promise.all([first, second]); await settle();
  assert.equal(cancels, 1); assert.equal(f.store.get("one").state, "cancelled");
  await f.clock.advance(60000); assert.equal(f.calls.poll.length, 1); assert.equal(f.scheduler.fatalError, undefined);
});

test("a budget pause still permits an already charged idempotent recovery without another charge", async (t) => {
  const f = fixture(t, { supportsIdempotencyKey: true, async create(ctx, job) { f.calls.create.push(job.id); if (f.calls.create.length === 1) throw Object.assign(new Error("lost response"), { category: "unknown_outcome", retryAfterMs: 1 }); return { remoteId: "original-remote" }; } });
  f.add("one", "a", { modelConfig: { concurrencyDefault: 3 } }); f.add("two", "a", { modelConfig: { concurrencyDefault: 3 } });
  f.store.updateBatch("batch-a", { budget: { amount: 1, currency: "USD" } });
  f.scheduler.start(); await settle(); await f.clock.advance(1);
  assert.deepEqual(f.calls.create, ["one", "one"]); assert.equal(f.store.get("one").state, "running"); assert.equal(f.store.get("one").estimatedCharges, 1); assert.equal(f.store.get("two").state, "queued");
});

test("a failed batch flush never dispatches a paid create even if the disk immediately recovers", async (t) => {
  const f = fixture(t); const first = f.add("template"); f.scheduler.setLane(first.laneId, { action: "pause" });
  f.scheduler.start(); await settle();
  const sync = fs.fsyncSync; let failures = 0;
  fs.fsyncSync = (fd) => { if (fd === f.store.fd && failures++ === 0) throw Object.assign(new Error("one-shot fsync failure"), { code: "EIO" }); return sync(fd); };
  try { assert.throws(() => f.store.addMany([{ ...first, id: "batch-one" }, { ...first, id: "batch-two" }]), { code: "EIO" }); }
  finally { fs.fsyncSync = sync; }
  f.scheduler.setLane(first.laneId, { action: "resume" }); await settle();
  assert.equal(f.calls.create.length, 0); assert.equal(f.scheduler.laneList()[0].reason, "storeClosed");
});

test("a failed settings resume stops the scheduler so later events cannot activate the lane", async (t) => {
  let fail = false;
  const f = fixture(t, {}, { onSettings: () => { if (fail) throw Object.assign(new Error("settings disk failure"), { code: "ENOSPC" }); } });
  const job = f.add("one"); f.scheduler.setLane(job.laneId, { action: "pause" }); f.scheduler.start(); await settle();
  fail = true; assert.throws(() => f.scheduler.setLane(job.laneId, { action: "resume" }), { code: "ENOSPC" });
  f.add("two"); await settle(); await f.clock.advance(60000);
  assert.equal(f.calls.create.length, 0); assert.equal(f.scheduler.laneList()[0].state, "paused"); assert.equal(f.scheduler.laneList()[0].reason, "storeWriteFailed");
});
