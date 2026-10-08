const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const { Application } = require("../src/application");
const { redactDiagnostics, rememberSecret } = require("../src/queue/keys");
const { startMockServer, mockBytes } = require("./fixtures/mock-provider-server");

function setup(directory, baseUrl) {
  fs.writeFileSync(path.join(directory, "catalog.local.json"), JSON.stringify({ providers: [{ provider: "openai-compatible", regions: [{ id: "custom", baseUrl }], models: [{ id: "custom-model", pollIntervalSec: 0.01 }] }] }));
}
function queueDiagnostic(app, state, expectedCount, reason) {
  let text = JSON.stringify(redactDiagnostics({
    reason, expectedState: state, expectedCount, actualCount: app.store.jobs.size,
    jobs: [...app.store.jobs.values()].map(job => ({ id: job.id, state: job.state, attempts: job.attempts, remoteId: job.remote?.id, error: job.error })),
    health: app.scheduler.health(),
    work: [...app.scheduler.work].map(([id, entry]) => ({ id, phase: entry.phase })),
    lanes: app.scheduler.laneList().map(lane => ({ id: lane.id, state: lane.state, reason: lane.reason, queued: lane.queued, running: lane.running, downloading: lane.downloading, needsReview: lane.needsReview })),
  }));
  const paths = [app.directory, path.resolve(__dirname, ".."), os.homedir()].filter(Boolean).flatMap(value => [value, value.replaceAll("\\", "/"), JSON.stringify(value).slice(1, -1)]).sort((a, b) => b.length - a.length);
  for (const value of paths) text = text.split(value).join("[PATH]");
  return text;
}
function waitFor(app, state, expectedCount, { timeoutMs = 15000 } = {}) {
  assert.ok(Number.isSafeInteger(expectedCount) && expectedCount > 0, "queue waits require a positive expected job count");
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      app.store.off("event", check);
      app.store.off("failure", failed);
      app.scheduler.off("fatal", failed);
      if (reason) reject(new Error(`Queue wait failed: ${queueDiagnostic(app, state, expectedCount, reason)}`));
      else resolve();
    };
    const check = () => {
      if (!app.scheduler.health().healthy) return finish("scheduler unhealthy");
      const jobs = [...app.store.jobs.values()];
      if (jobs.length === expectedCount && jobs.every(job => job.state === state)) finish();
    };
    const failed = () => finish("store or scheduler failure");
    const timer = setTimeout(() => finish(`deadline exceeded (${timeoutMs}ms)`), timeoutMs);
    app.store.on("event", check);
    app.store.on("failure", failed);
    app.scheduler.on("fatal", failed);
    check(); // Also handle a transition completed before listeners were added.
  });
}

test("persistent compatible queue records every create, streams exact bytes and retains history across restart", { timeout: 40000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-application-"));
  const mock = await startMockServer({ renderDelayMs: 20, delays: { "test-one": { create: 3200 } } });
  setup(directory, `${mock.url}/v1`);
  let app = new Application({ directory });
  t.after(async () => {
    // Close fixture sockets first so a failed test cannot wait on a withheld
    // create response while the application performs its bounded shutdown.
    try { await mock.close(); } finally {
      try { await app.close(); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
    }
  });
  const key = "test-application-secret-90210";
  const payload = { provider: "openai-compatible", region: "custom", model: "custom-model", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9" }, prompt: "test-one\n\ntest-two\n\ntest-three", outputDir: path.join(directory, "output"), filename: "clip" };
  app.setKey({ lane: app.selection(payload).lane, key });
  await app.prepare(payload);
  await app.start();
  await waitFor(app, "succeeded", 3);
  // A succeeded record is durable before its recovery marker is unlinked.
  // Wait for the actual publication cleanup, not an arbitrary timer or only
  // the earlier state transition, before asserting there are no .part files.
  await Promise.all([...app.scheduler.work.values()].filter(entry => entry.phase === "download").map(entry => entry.promise));
  assert.equal(app.store.jobs.size, 3);
  assert.equal(mock.stats.accepted.length, 3);
  const delayed = [...mock.jobs.values()].find(job => job.prompt === "test-one");
  assert.ok(delayed.responseSentAt - delayed.createdAt >= 3000, "the normal create response deliberately exceeds the former three-second test deadline");
  for (const job of app.store.jobs.values()) {
    assert.equal(job.attempts.create, 1);
    assert.equal(mock.stats.createCounts[job.prompt], 1);
    assert.equal(job.remote.id, mock.stats.accepted.find(remote => remote.prompt === job.prompt).id);
    assert.deepEqual(fs.readFileSync(job.output.path), mockBytes(job.prompt));
    assert.equal(job.output.sha256, crypto.createHash("sha256").update(mockBytes(job.prompt)).digest("hex"));
  }
  assert.equal(mock.stats.maxInFlight.default, 1);
  assert.ok(!fs.readFileSync(path.join(directory, "jobs.ndjson"), "utf8").includes(key));
  assert.ok(!fs.readdirSync(payload.outputDir).some((name) => name.endsWith(".part")));
  const before = mock.stats.accepted.length;
  await app.close();
  app = new Application({ directory });
  await app.start();
  assert.deepEqual(app.keys.list(), []);
  assert.equal(mock.stats.accepted.length, before, "restart cannot recreate paid jobs");
  assert.equal(app.clearHistory().count, 3);
  assert.equal(app.store.jobs.size, 0);
  assert.ok(!fs.readFileSync(path.join(directory, "jobs.snapshot.ndjson"), "utf8").includes("test-one"));
  assert.equal(fs.readFileSync(path.join(directory, "jobs.ndjson"), "utf8"), "");
  assert.equal(fs.readdirSync(payload.outputDir).length, 3, "history cleanup preserves videos");
});

test("ambiguous creates survive restart as needs_review without automatic resubmission", { timeout: 40000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-unknown-"));
  const mock = await startMockServer({ faults: { ambiguous: "500" } });
  setup(directory, `${mock.url}/v1`);
  let app = new Application({ directory });
  t.after(async () => {
    try { await mock.close(); } finally {
      try { await app.close(); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
    }
  });
  await app.prepare({ provider: "openai-compatible", region: "custom", model: "custom-model", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9" }, prompt: "ambiguous", outputDir: path.join(directory, "out") });
  await app.start();
  await waitFor(app, "needs_review", 1);
  const job = [...app.store.jobs.values()][0];
  assert.equal(job.attempts.create, 1);
  await app.close();
  app = new Application({ directory });
  await app.start();
  assert.equal(app.store.get(job.id).state, "needs_review");
  assert.equal(mock.stats.requestCounts.ambiguous, 1);
});

test("queue waits reject empty snapshots and report redacted state on deadlines or fatal events", async () => {
  const store = Object.assign(new EventEmitter(), { jobs: new Map() });
  const scheduler = Object.assign(new EventEmitter(), { health: () => ({ healthy: true }), work: new Map(), laneList: () => [] });
  const app = { store, scheduler, directory: path.join(os.tmpdir(), "private-queue-test") };
  await assert.rejects(waitFor(app, "succeeded", 1, { timeoutMs: 10 }), error => {
    const details = JSON.parse(error.message.slice("Queue wait failed: ".length));
    assert.equal(details.actualCount, 0); assert.equal(details.expectedCount, 1);
    assert.match(details.reason, /deadline exceeded/);
    return true;
  });
  const secret = "private-transition-fixture-secret";
  rememberSecret(secret);
  store.jobs.set("pending", { id: "pending", state: "submitting", attempts: { create: 1, poll: 0, download: 0 }, error: { providerMessage: `${secret} at ${app.directory}` } });
  scheduler.work.set("pending", { phase: "create" });
  const failed = waitFor(app, "succeeded", 1);
  scheduler.emit("fatal");
  await assert.rejects(failed, error => {
    assert.equal(error.message.includes(secret), false); assert.equal(error.message.includes(app.directory), false);
    const details = JSON.parse(error.message.slice("Queue wait failed: ".length));
    assert.equal(details.jobs[0].state, "submitting"); assert.equal(details.jobs[0].attempts.create, 1);
    assert.equal(details.work[0].phase, "create"); assert.equal(details.jobs[0].error.providerMessage, "[REDACTED] at [PATH]");
    return true;
  });
  const completed = waitFor(app, "succeeded", 1);
  store.jobs.set("pending", { id: "pending", state: "succeeded" });
  store.emit("event", { type: "job", jobId: "pending" });
  await completed;
  assert.equal(store.listenerCount("event"), 0); assert.equal(store.listenerCount("failure"), 0); assert.equal(scheduler.listenerCount("fatal"), 0);
});
