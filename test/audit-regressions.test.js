// Regression tests for defects found in the v2.1.4 backend audit and for the
// review-workflow APIs added afterwards (takes, filters, export, abandon).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");
const { once } = require("node:events");
const { spawn } = require("node:child_process");
const { harness, settle, deferred } = require("./helpers/scheduler-harness");
const { classifyError, createContext } = require("../src/providers/base");
const { parseRetryAfterMs, MAX_RETRY_AFTER_MS } = require("../src/providers/retry");
const { resolveBatchOutputPath, writeOutput, sanitizeFilename } = require("../src/files/output");
const { redactLocalPaths } = require("../src/http/errors");
const { Application } = require("../src/application");

const laneA = { provider: "mock", region: "a", baseUrl: "https://a.example/v1" };
const geminiPayload = (directory, extra = {}) => ({ provider: "gemini", region: "global", model: "gemini-omni-1.1-flash", outputDir: path.join(directory, "out"), params: { durationSeconds: 3, resolution: "720p", aspectRatio: "16:9" }, ...extra });

function finish(app, id) {
  const target = app.store.get(id).targetPath;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, "video");
  app.store.update(id, { state: "submitting", attempts: { create: 1, poll: 0, download: 0 }, estimatedCharges: 1 });
  app.store.update(id, { state: "running", remote: { id: `v1_${id.slice(0, 8)}` } });
  app.store.update(id, { state: "downloading" });
  return app.store.update(id, { state: "succeeded", output: { path: target, bytes: 5, contentType: "video/mp4", sha256: "b".repeat(64) } });
}

function application(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-regress-"));
  const app = new Application({ directory });
  t.after(async () => { await app.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return { app, directory };
}

test("re-entering a key after an auth error terminates and writes one record per running job", async (t) => {
  const f = harness(t, { async poll(ctx, job) { f.calls.poll.push(job.id); throw Object.assign(new Error("401"), { status: 401, category: "auth" }); } });
  f.add("paid", "a", { state: "running", remote: { id: "remote-paid" }, attempts: { create: 1, poll: 0, download: 0 } });
  f.scheduler.start(); await settle();
  assert.equal(f.scheduler.laneList()[0].state, "needs_key");
  const append = f.store.append.bind(f.store);
  let appends = 0;
  f.store.append = (...args) => { if (++appends > 100) throw new Error("runaway journal writes"); return append(...args); };
  try { f.scheduler.keysChanged(laneA); } finally { f.store.append = append; }
  assert.ok(appends <= 1, `keysChanged wrote ${appends} records for one running job`);
});

test("a replacement key clears only the authentication stop, never a manual pause", async (t) => {
  let downloads = 0;
  const success = { status: "succeeded", result: { url: "https://a.example/v1/content", needsAuth: true } };
  const f = harness(t, {
    async poll() { return success; },
    async download(ctx, job) { f.calls.download.push(job.id); if (++downloads === 1) throw Object.assign(new Error("401"), { status: 401, category: "auth" }); return {}; },
  });
  f.add("paid", "a", { state: "running", remote: { id: "remote-paid" }, attempts: { create: 1, poll: 0, download: 0 } });
  f.store.update("paid", { state: "downloading", result: success.result });
  f.add("queued");
  f.scheduler.setLane(f.scheduler.laneList()[0].id, { action: "pause" });
  f.scheduler.start(); await settle();
  assert.equal(downloads, 1);
  const stopped = f.scheduler.laneList()[0];
  assert.equal(stopped.paused, true, "lane list reports the manual pause separately from needs_key");
  f.scheduler.keysChanged(laneA);
  await settle(); await f.clock.advance(2000);
  const lane = f.scheduler.laneList()[0];
  assert.equal(lane.state, "paused");
  assert.equal(lane.paused, true);
  assert.equal(f.calls.create.length, 0, "no paid create on a manually paused lane");
});

test("cancelling during a create that is then definitely rejected ends cancelled, not re-created", async (t) => {
  const first = deferred();
  const f = harness(t, {
    async create(ctx, job) {
      f.calls.create.push(job.id);
      if (f.calls.create.length === 1) { await first.promise; throw Object.assign(new Error("429"), { category: "rate_limited", status: 429, accepted: false, retryAfterMs: 1000 }); }
      return { remoteId: `remote-${job.id}` };
    },
  });
  f.add("one"); f.scheduler.start(); await settle();
  assert.equal(f.store.get("one").state, "submitting");
  await f.scheduler.jobAction("one", "cancel");
  first.resolve(); await settle();
  await f.clock.advance(5000);
  assert.equal(f.calls.create.length, 1);
  assert.equal(f.store.get("one").state, "cancelled");
  assert.equal(f.store.get("one").estimatedCharges, 0, "the rejected create is not counted as a charge");
});

test("a 403 from a presigned download URL neither needs a key nor stops other polls", async (t) => {
  const f = harness(t, {
    classifyError,
    async poll(ctx, job) { f.calls.poll.push(job.id); return { status: "running" }; },
    async download(ctx, job) {
      f.calls.download.push(job.id);
      const error = Object.assign(new Error("Forbidden"), { status: 403, accepted: false });
      error.category = classifyError(error, "download");
      throw error;
    },
  });
  f.keys.set(laneA, "a-valid-provider-key-123", f.adapter);
  const model = { concurrencyDefault: 3, pollIntervalSec: 10 };
  f.add("cdn", "a", { state: "running", remote: { id: "r-cdn" }, attempts: { create: 1, poll: 0, download: 0 }, requiresKey: true, modelConfig: model });
  f.store.update("cdn", { state: "downloading", result: { url: "https://cdn.example/v.mp4?sig=x", needsAuth: false }, resultExpiresAt: new Date(f.clock.now() + 86400000).toISOString() });
  f.add("other", "a", { state: "running", remote: { id: "r-other" }, attempts: { create: 1, poll: 0, download: 0 }, requiresKey: true, modelConfig: model, startedAt: new Date(f.clock.now()).toISOString() });
  f.scheduler.start(); await settle();
  const pollsBefore = f.calls.poll.length;
  for (let i = 0; i < 12; i += 1) await f.clock.advance(10000);
  assert.equal(f.scheduler.laneList()[0].state, "active");
  assert.ok(f.calls.poll.length > pollsBefore);
  assert.equal(f.store.get("cdn").state, "downloading", "the paid result keeps retrying until it really expires");
});

test("a 4xx while downloading a paid result is retried instead of failing it", async (t) => {
  let attempts = 0;
  const f = harness(t, {
    classifyError,
    async download() {
      attempts += 1;
      if (attempts === 1) { const error = Object.assign(new Error("Bad Request"), { status: 400, accepted: false }); error.category = classifyError(error, "download"); throw error; }
      return {};
    },
  });
  f.add("paid", "a", { state: "running", remote: { id: "remote-paid" }, attempts: { create: 1, poll: 0, download: 0 }, estimatedCharges: 1 });
  f.store.update("paid", { state: "downloading", result: { url: "https://cdn.example/v.mp4", needsAuth: false }, resultExpiresAt: new Date(f.clock.now() + 86400000).toISOString() });
  f.scheduler.start(); await settle();
  for (let i = 0; i < 5; i += 1) await f.clock.advance(30000);
  assert.equal(f.store.get("paid").state, "succeeded");
});

test("a remote task that stays 404 stops tracking after a grace period, and running jobs can be abandoned", async (t) => {
  const f = harness(t, {
    classifyError,
    async poll(ctx, job) {
      f.calls.poll.push(job.remote.id);
      if (job.remote.id === "gone") { const error = Object.assign(new Error("Not Found"), { status: 404 }); error.category = classifyError(error, "poll"); throw error; }
      return { status: "running" };
    },
  });
  const model = { concurrencyDefault: 1, pollIntervalSec: 10, typicalRenderSec: 60 };
  f.add("stale", "a", { state: "running", remote: { id: "gone" }, attempts: { create: 1, poll: 0, download: 0 }, modelConfig: model });
  f.add("typo", "b", { state: "running", remote: { id: "gone" }, attempts: { create: 1, poll: 0, download: 0 }, modelConfig: model });
  f.add("waiting", "a", { modelConfig: model });
  f.scheduler.start(); await settle();
  await f.clock.advance(60000);
  assert.equal(f.store.get("stale").state, "running", "a short 404 streak keeps tracking (eventual consistency)");
  const abandoned = await f.scheduler.jobAction("typo", "resolve", { action: "abandon" });
  assert.equal(abandoned.state, "cancelled");
  assert.equal(abandoned.abandoned, true);
  for (let i = 0; i < 40; i += 1) await f.clock.advance(30000);
  assert.equal(f.store.get("stale").state, "failed");
  assert.equal(f.store.get("stale").error.category, "remote_not_found");
  assert.equal(f.store.get("stale").remote.id, "gone", "the remote ID is kept for manual checks");
  assert.notEqual(f.store.get("waiting").state, "queued", "the freed slot dispatches queued work");
  await assert.rejects(f.scheduler.jobAction("stale", "retry"), { code: "unsafeCreateRetry" });
});

test("a huge Retry-After is clamped and never makes the scheduler fatal", async (t) => {
  assert.equal(parseRetryAfterMs("9999999999999"), MAX_RETRY_AFTER_MS);
  assert.equal(parseRetryAfterMs("120"), 120000);
  const f = harness(t, { async poll() { throw Object.assign(new Error("429"), { status: 429, category: "rate_limited", retryAfterMs: 1e300 }); } });
  f.add("paid", "a", { state: "running", remote: { id: "r" }, attempts: { create: 1, poll: 0, download: 0 } });
  f.scheduler.start(); await settle();
  assert.equal(f.scheduler.fatalError, undefined);
  assert.ok(Date.parse(f.store.get("paid").nextPollAt) <= f.clock.now() + MAX_RETRY_AFTER_MS);
});

test("an explicit resubmit inside a cancelled batch reopens it and is dispatched", async (t) => {
  const f = harness(t, {
    async create(ctx, job) {
      f.calls.create.push(job.id);
      if (f.calls.create.length === 1) throw Object.assign(new Error("reset"), { code: "ECONNRESET" });
      return { remoteId: `remote-${job.id}` };
    },
  });
  f.add("ambiguous"); f.add("other");
  f.scheduler.start(); await settle();
  assert.equal(f.store.get("ambiguous").state, "needs_review");
  await f.scheduler.batchAction("batch-a", "cancel");
  assert.equal(f.store.get("other").state, "cancelled");
  await f.scheduler.jobAction("ambiguous", "resolve", { action: "resubmit" });
  assert.equal(f.store.batches.get("batch-a").state, "active");
  for (let i = 0; i < 3; i += 1) await f.clock.advance(60000);
  assert.equal(f.calls.create.length, 2);
  assert.equal(f.store.get("other").state, "cancelled", "reopening does not revive cancelled siblings");
});

test("cancelling a large batch uses a bounded number of journal fsyncs", async (t) => {
  const f = harness(t);
  const first = f.add("j0");
  f.store.addMany(Array.from({ length: 2000 }, (_, i) => ({ ...first, id: `job-${i + 1}`, prompt: `p${i}` })));
  const sync = fs.fsyncSync;
  let syncs = 0;
  fs.fsyncSync = (fd) => { if (fd === f.store.fd) syncs += 1; return sync(fd); };
  try { await f.scheduler.batchAction("batch-a", "cancel"); } finally { fs.fsyncSync = sync; }
  assert.ok(syncs <= 8, `batch cancel performed ${syncs} fsyncs`);
  assert.ok([...f.store.jobs.values()].every((job) => job.state === "cancelled"));
});

test("frame uploads prepared for a create are not retained once the job leaves the queue", async (t) => {
  const image = { buffer: Buffer.alloc(1024 * 1024, 1), mimeType: "image/png", filename: "first-frame.png", width: 1280, height: 720, role: "first_frame" };
  const f = harness(t, {
    async prepareAssets() { return [image]; },
    async create(ctx, job) { f.calls.create.push(job.id); throw Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }); },
  });
  for (let i = 0; i < 5; i += 1) f.add(`j${i}`, "a", { modelConfig: { concurrencyDefault: 5 } });
  f.scheduler.start(); await settle(200);
  assert.equal([...f.store.jobs.values()].filter((job) => job.state === "needs_review").length, 5);
  assert.equal(f.scheduler.assetCache.size, 0);
});

test("downloads time out on inactivity rather than total transfer time", async (t) => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "video/mp4" });
    if (req.url === "/stalled") { res.write(Buffer.alloc(1024)); return; }
    let sent = 0;
    const timer = setInterval(() => { res.write(Buffer.alloc(1024, 7)); if (++sent === 12) { clearInterval(timer); res.end(); } }, 60);
    req.on("close", () => clearInterval(timer));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-regress-dl-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const ctx = createContext({ lane: { provider: "ark", baseUrl: `http://127.0.0.1:${server.address().port}` } });
  const slow = await ctx.fetch("/steady.mp4", { needsAuth: false, phase: "download", timeoutMs: 300 });
  const saved = await writeOutput(slow, path.join(directory, "steady.mp4"), { jobId: "steady" });
  assert.equal(saved.bytes, 12 * 1024, "a steady 720 ms transfer completes with a 300 ms inactivity limit");
  const stalled = await ctx.fetch("/stalled", { needsAuth: false, phase: "download", timeoutMs: 300 });
  await assert.rejects(writeOutput(stalled, path.join(directory, "stalled.mp4"), { jobId: "stalled" }), (error) => error.code === "downloadStalled" || error.cause?.code === "downloadStalled" || /stalled|timeout/i.test(`${error.name} ${error.message}`));
  assert.deepEqual(fs.readdirSync(directory).sort(), ["steady.mp4"], "the stalled partial is removed");
});

test("a failed output write releases the provider response body", async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(16)); }, cancel() { cancelled = true; } });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-regress-leak-"));
  try {
    fs.writeFileSync(path.join(directory, "file"), "x");
    await assert.rejects(writeOutput(new Response(body, { headers: { "content-type": "video/mp4" } }), path.join(directory, "file", "out.mp4"), { jobId: "j" }));
    assert.equal(cancelled, true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("a dot-only filename stays inside the output folder", async (t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-regress-out-"));
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
  assert.match(sanitizeFilename(".mp4"), /^videogen-.+\.mp4$/);
  assert.match(sanitizeFilename(". .webm"), /^videogen-.+\.webm$/);
  const { filePath } = resolveBatchOutputPath(outputDir, ".mp4", 0, 1, "job-id");
  for (const jobId of ["job-a", "job-b"]) {
    const result = await writeOutput(new Response(Buffer.from(jobId), { headers: { "content-type": "video/mp4" } }), filePath, { jobId });
    assert.equal(path.dirname(result.path), outputDir);
    assert.ok(!path.basename(result.path).startsWith("."));
  }
});

test("home-folder redaction respects path boundaries", () => {
  const home = os.homedir();
  assert.equal(redactLocalPaths(path.join(home, "Downloads", "a.mp4")), path.join("~", "Downloads", "a.mp4"));
  assert.equal(redactLocalPaths(`${home}x/other`), `${home}x/other`, "a sibling folder sharing the prefix is untouched");
  assert.deepEqual(redactLocalPaths({ path: home, nested: [`"${home}"`] }), { path: "~", nested: ['"~"'] });
});

test("startup continues when a historical output folder became unreadable", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-regress-start-"));
  const outputs = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-regress-out-"));
  t.after(() => { fs.rmSync(directory, { recursive: true, force: true }); fs.rmSync(outputs, { recursive: true, force: true }); });
  let app = new Application({ directory });
  const { jobs } = await app.prepare({ ...geminiPayload(directory), prompt: "history", outputDir: path.join(outputs, "old") });
  finish(app, jobs[0].id);
  await app.close();
  fs.rmSync(path.join(outputs, "old"), { recursive: true, force: true });
  fs.writeFileSync(path.join(outputs, "old"), "not a directory");
  app = new Application({ directory });
  t.after(() => app.close());
  await app.start();
  assert.equal(app.scheduler.started, true);
});

test("clearing history keeps the budget already committed by removed takes", async (t) => {
  const f = harness(t);
  f.store.updateBatch("batch-a", { id: "batch-a", state: "active", budget: { amount: 3, currency: "USD" } });
  const modelConfig = { concurrencyDefault: 5, pollIntervalSec: 10, typicalRenderSec: 30 };
  f.add("done", "a", { state: "running", remote: { id: "r-done" }, attempts: { create: 1, poll: 0, download: 0 }, estimatedCharges: 1, modelConfig });
  f.store.update("done", { state: "downloading" });
  f.store.update("done", { state: "succeeded", output: { path: "/tmp/x.mp4" } });
  for (let i = 0; i < 4; i += 1) f.add(`q${i}`, "a", { modelConfig });
  f.store.clearHistory();
  assert.deepEqual(f.store.batches.get("batch-a").clearedCharges, { USD: 1 });
  f.scheduler.start(); await settle();
  for (let i = 0; i < 20; i += 1) await f.clock.advance(1000);
  assert.equal(f.calls.create.length, 2, "$1 already spent + 2 × $1 fits a $3 budget; the rest pause");
  assert.equal(f.store.batches.get("batch-a").pauseReason, "budget");
});

test("clearing history during an import keeps frames of rows not yet persisted", async (t) => {
  const { app, directory } = application(t);
  const image = (salt) => {
    const buffer = Buffer.alloc(32); Buffer.from("89504e470d0a1a0a", "hex").copy(buffer);
    buffer.writeUInt32BE(1280, 16); buffer.writeUInt32BE(720, 20); buffer.writeUInt32BE(salt, 28);
    return new File([buffer], "frame.png", { type: "image/png" });
  };
  const rows = Array.from({ length: 300 }, (_, i) => ({ prompt: `row ${i}`, firstFrame: i < 150 ? "a" : "b" }));
  const pending = app.prepare(geminiPayload(directory, { rows }), null, new Map([["a", image(1)], ["b", image(2)]]));
  while (![...app.store.batches.values()].some((batch) => batch.state === "preparing")) await new Promise((resolve) => setImmediate(resolve));
  app.clearHistory();
  const result = await pending;
  for (const job of result.jobs) for (const asset of job.assets) app.assets.read(asset);
  assert.equal(fs.readdirSync(path.join(directory, "assets")).filter((name) => !name.endsWith(".part")).length, 2, "each shared frame is stored once");
});

test("a regeneration the batch budget cannot dispatch is refused up front", async (t) => {
  const { app, directory } = application(t);
  const { jobs } = await app.prepare({ ...geminiPayload(directory), prompt: "budgeted", budget: 0.31 });
  finish(app, jobs[0].id);
  const { confirmationToken } = app.gallery.estimate(jobs[0].id);
  assert.throws(() => app.gallery.regenerate(jobs[0].id, { confirmed: true, confirmationToken }), (error) => error.code === "regenerateExceedsBudget" && error.status === 409);
  const { jobs: open } = await app.prepare({ ...geminiPayload(directory), prompt: "roomy", budget: 1 });
  finish(app, open[0].id);
  const second = app.gallery.estimate(open[0].id);
  const take = app.gallery.regenerate(open[0].id, { confirmed: true, confirmationToken: second.confirmationToken });
  assert.equal(take.state, "queued");
  assert.equal(take.shot, 0, "a regenerated take stays grouped with its shot");
});

test("takes multiply every row with shot/take fields, estimates and file names", async (t) => {
  const { app, directory } = application(t);
  const estimate = app.estimate({ ...geminiPayload(directory), rows: [{ prompt: "a", filename: "alpha.mp4" }, { prompt: "b", filename: "beta" }], takes: 3 });
  assert.equal(estimate.count, 6);
  assert.equal(estimate.takes, 3);
  assert.equal(estimate.rows.length, 2, "row statuses stay per source row");
  const single = app.estimate({ ...geminiPayload(directory), rows: [{ prompt: "a" }] });
  assert.ok(Math.abs(estimate.costs[0].amount - single.costs[0].amount * 6) < 1e-9);
  const summary = app.estimate({ ...geminiPayload(directory), prompt: "x", takes: 4, summaryOnly: true });
  assert.equal(summary.count, 4);
  const { jobs } = await app.prepare({ ...geminiPayload(directory), rows: [{ prompt: "a", filename: "alpha.mp4" }, { prompt: "b", filename: "beta" }], takes: 3 });
  assert.deepEqual(jobs.map((job) => [job.shot, job.take, job.index]), [[0, 1, 0], [0, 2, 1], [0, 3, 2], [1, 1, 3], [1, 2, 4], [1, 3, 5]]);
  assert.deepEqual(jobs.map((job) => path.basename(job.targetPath)), ["alpha-01-t1.mp4", "alpha-01-t2.mp4", "alpha-01-t3.mp4", "beta-02-t1.mp4", "beta-02-t2.mp4", "beta-02-t3.mp4"]);
  const one = await app.prepare({ ...geminiPayload(directory), prompt: "solo", filename: "solo.mp4", takes: 2 });
  assert.deepEqual(one.jobs.map((job) => path.basename(job.targetPath)), ["solo-t1.mp4", "solo-t2.mp4"]);
  for (const takes of [0, 21, 1.5, "x"]) assert.throws(() => app.estimate({ ...geminiPayload(directory), prompt: "x", takes }), { code: "invalidTakes" });
});

test("job lists filter by review selection and page newest first", async (t) => {
  const { app, directory } = application(t);
  const { jobs } = await app.prepare({ ...geminiPayload(directory), prompt: "p", batchCount: 4 });
  for (const job of jobs.slice(0, 3)) finish(app, job.id);
  app.gallery.curate(jobs[0].id, { selection: "keep" });
  app.gallery.curate(jobs[1].id, { selection: "reject" });
  assert.deepEqual(app.store.list({ selection: "keep" }).jobs.map((job) => job.id), [jobs[0].id]);
  assert.deepEqual(app.store.list({ selection: "unreviewed" }).jobs.map((job) => job.id), [jobs[2].id], "queued jobs are not 'unreviewed' takes");
  const first = app.store.list({ order: "desc", limit: 2 });
  assert.deepEqual(first.jobs.map((job) => job.id), [jobs[3].id, jobs[2].id]);
  const next = app.store.list({ order: "desc", limit: 2, cursor: first.nextCursor });
  assert.deepEqual(next.jobs.map((job) => job.id), [jobs[1].id, jobs[0].id]);
  assert.equal(next.nextCursor, null);
  assert.throws(() => app.store.list({ selection: "maybe" }), { code: "invalidParams" });
});

test("the export manifest lists finished takes with absolute paths and safe CSV cells", async (t) => {
  const { app, directory } = application(t);
  const { id: batchId, jobs } = await app.prepare({ ...geminiPayload(directory), rows: [{ prompt: "=HYPERLINK(\"x\")" }, { prompt: "plain, \"quoted\"" }], takes: 2 });
  for (const job of jobs) finish(app, job.id);
  app.gallery.curate(jobs[0].id, { selection: "keep" });
  app.gallery.curate(jobs[3].id, { selection: "keep" });
  const csv = app.exportManifest({ batch: batchId, selection: "keep", format: "csv" });
  assert.match(csv.filename, /^videogen-keep-[0-9a-f]{8}-.+\.csv$/);
  const lines = csv.body.replace(/^﻿/, "").trim().split("\r\n");
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^batch_id,job_id,shot,take,selection,/);
  assert.match(lines[1], /"'=HYPERLINK\(""x""\)"/, "formulas are neutralized");
  assert.match(lines[2], /"plain, ""quoted"""/);
  assert.ok(lines[1].includes(`"${jobs[0].targetPath}"`), "paths are absolute");
  const json = JSON.parse(app.exportManifest({ batch: batchId, selection: "all", format: "json" }).body);
  assert.deepEqual(json.takes.map((row) => [row.shot, row.take, row.selection]), [[1, 1, "keep"], [1, 2, "unreviewed"], [2, 1, "unreviewed"], [2, 2, "keep"]]);
  assert.throws(() => app.exportManifest({ selection: "bogus" }), /invalidParams/);
  assert.throws(() => app.exportManifest({ batch: "missing" }), (error) => error.status === 404);
});

async function availablePort() {
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

function get(port, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: pathname, headers: { host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("the export route downloads same-origin only and lanes report pauses", async (t) => {
  const port = await availablePort();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-regress-http-"));
  const child = spawn(process.execPath, ["--no-use-env-proxy", "server.js"], { cwd: path.join(__dirname, ".."), env: { ...process.env, PORT: String(port), VIDEOGEN_DATA_DIR: directory }, stdio: ["ignore", "pipe", "pipe"] });
  const closed = once(child, "close");
  t.after(async () => { child.kill("SIGTERM"); await closed; fs.rmSync(directory, { recursive: true, force: true }); });
  const deadline = Date.now() + 20000;
  for (;;) {
    try { if ((await get(port, "/api/health")).status === 200) break; } catch {}
    if (Date.now() > deadline) throw new Error("server did not start");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const download = await get(port, "/api/export?selection=all&format=csv", { "sec-fetch-site": "same-origin" });
  assert.equal(download.status, 200);
  assert.match(download.headers["content-type"], /^text\/csv/);
  assert.match(download.headers["content-disposition"], /^attachment; filename="videogen-all-all-.+\.csv"$/);
  assert.equal((await get(port, "/api/export?selection=all", { "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal((await get(port, "/api/export?selection=all", { origin: "https://evil.example" })).status, 403);
  assert.equal((await get(port, "/api/export?selection=nope")).status, 400);
  const lanes = JSON.parse((await get(port, "/api/lanes")).body).lanes;
  assert.ok(lanes.every((lane) => typeof lane.paused === "boolean"));
});

test("OpenRouter requests carry app attribution headers unless disabled, and never on downloads", async (t) => {
  const openrouter = require("../src/providers/openrouter");
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push({ url: String(url), headers: new Headers(options.headers) });
    if (String(url).endsWith("/videos")) return Response.json({ id: "gen-vid-1", status: "pending" }, { status: 202 });
    if (String(url).includes("/content")) return new Response("bytes", { headers: { "content-type": "video/mp4" } });
    return Response.json({ id: "gen-vid-1", status: "in_progress" });
  };
  const model = { id: "m", capabilities: { durations: [5], resolutions: ["720p"], aspectRatios: ["16:9"], firstFrame: true, lastFrame: false, audio: false } };
  const ctx = createContext({ lane: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1" }, key: "sk-or-v1-test-key-0000000000", catalog: { models: [model] }, fetchImpl });
  const job = { model: "m", prompt: "p", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9", audio: false }, assets: [], remote: { id: "gen-vid-1" } };
  await openrouter.create(ctx, job);
  await openrouter.poll(ctx, job);
  await openrouter.download(ctx, job, { url: "https://openrouter.ai/api/v1/videos/gen-vid-1/content?index=0", needsAuth: true });
  assert.equal(seen[0].headers.get("x-openrouter-title"), "videogen");
  assert.equal(seen[0].headers.get("x-openrouter-categories"), "video-gen");
  assert.equal(seen[0].headers.get("http-referer"), "https://github.com/swf-cmd/videogen");
  assert.equal(seen[1].headers.get("x-openrouter-title"), "videogen");
  assert.equal(seen[2].headers.get("x-openrouter-title"), null);
  process.env.VIDEOGEN_OPENROUTER_ATTRIBUTION = "0";
  t.after(() => { delete process.env.VIDEOGEN_OPENROUTER_ATTRIBUTION; });
  await openrouter.create(ctx, job);
  assert.equal(seen[3].headers.get("x-openrouter-title"), null);
  assert.equal(seen[3].headers.get("http-referer"), null);
});
