const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { Application } = require("../src/application");
const { startMockServer, mockBytes } = require("./fixtures/mock-provider-server");

function setup(directory, baseUrl) {
  fs.writeFileSync(path.join(directory, "catalog.local.json"), JSON.stringify({ providers: [{ provider: "openai-compatible", regions: [{ id: "custom", baseUrl }], models: [{ id: "custom-model", pollIntervalSec: 0.01 }] }] }));
}
async function waitFor(app, state) {
  const deadline = Date.now() + 3000;
  while (![...app.store.jobs.values()].every((job) => job.state === state) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok([...app.store.jobs.values()].every((job) => job.state === state));
}

test("persistent compatible queue records every create, streams exact bytes and retains history across restart", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-application-"));
  const mock = await startMockServer({ renderDelayMs: 20 });
  setup(directory, `${mock.url}/v1`);
  let app = new Application({ directory });
  t.after(async () => { await app.close(); await mock.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const key = "test-application-secret-90210";
  const payload = { provider: "openai-compatible", region: "custom", model: "custom-model", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9" }, prompt: "test-one\n\ntest-two\n\ntest-three", outputDir: path.join(directory, "output"), filename: "clip" };
  app.setKey({ lane: app.selection(payload).lane, key });
  await app.prepare(payload);
  await app.start();
  await waitFor(app, "succeeded");
  // A succeeded record is durable before its recovery marker is unlinked.
  // Wait for the actual publication cleanup, not an arbitrary timer or only
  // the earlier state transition, before asserting there are no .part files.
  await Promise.all([...app.scheduler.work.values()].filter(entry => entry.phase === "download").map(entry => entry.promise));
  assert.equal(app.store.jobs.size, 3);
  for (const job of app.store.jobs.values()) {
    assert.equal(job.attempts.create, 1);
    assert.equal(mock.stats.createCounts[job.prompt], 1);
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

test("ambiguous creates survive restart as needs_review without automatic resubmission", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-unknown-"));
  const mock = await startMockServer({ faults: { ambiguous: "500" } });
  setup(directory, `${mock.url}/v1`);
  let app = new Application({ directory });
  t.after(async () => { await app.close(); await mock.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  await app.prepare({ provider: "openai-compatible", region: "custom", model: "custom-model", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9" }, prompt: "ambiguous", outputDir: path.join(directory, "out") });
  await app.start();
  await waitFor(app, "needs_review");
  const job = [...app.store.jobs.values()][0];
  assert.equal(job.attempts.create, 1);
  await app.close();
  app = new Application({ directory });
  await app.start();
  assert.equal(app.store.get(job.id).state, "needs_review");
  assert.equal(mock.stats.requestCounts.ambiguous, 1);
});
