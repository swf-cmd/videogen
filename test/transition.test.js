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

test("transitional compatible queue records every create and streams exact bytes", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-transition-"));
  const mock = await startMockServer({ renderDelayMs: 20 });
  setup(directory, `${mock.url}/v1`);
  const app = new Application({ directory });
  t.after(async () => { await app.close(); await mock.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const key = "test-transition-secret-90210";
  const events = [];
  const payload = { provider: "openai-compatible", region: "custom", model: "custom-model", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9" }, prompt: "test-one\n\ntest-two\n\ntest-three", outputDir: path.join(directory, "output"), filename: "clip", apiKey: key };
  await app.generate(payload, null, (event) => events.push(event));
  assert.equal(app.store.jobs.size, 3);
  for (const job of app.store.jobs.values()) {
    assert.equal(job.state, "succeeded");
    assert.equal(job.attempts.create, 1);
    assert.equal(mock.stats.createCounts[job.prompt], 1);
    assert.deepEqual(fs.readFileSync(job.output.path), mockBytes(job.prompt));
    assert.equal(job.output.sha256, crypto.createHash("sha256").update(mockBytes(job.prompt)).digest("hex"));
  }
  assert.equal(mock.stats.maxInFlight.default, 1);
  assert.ok(!JSON.stringify(events).includes(key));
  assert.ok(!fs.readFileSync(path.join(directory, "jobs.ndjson"), "utf8").includes(key));
  assert.ok(!fs.readdirSync(payload.outputDir).some((name) => name.endsWith(".part")));
  const before = mock.stats.accepted.length;
  const remoteId = [...app.store.jobs.values()][0].remote.id;
  await app.generate({ ...payload, remoteId, filename: "recovered" }, null, () => {}, true);
  assert.equal(mock.stats.accepted.length, before, "recovery cannot create a new paid job");
  assert.equal(app.clearHistory().count, 4);
  assert.equal(app.store.jobs.size, 0);
  assert.ok(!fs.readFileSync(path.join(directory, "jobs.snapshot.json"), "utf8").includes("test-one"));
  assert.equal(fs.readFileSync(path.join(directory, "jobs.ndjson"), "utf8"), "");
});

test("ambiguous creates survive restart as needs_review without automatic resubmission", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-unknown-"));
  const mock = await startMockServer({ faults: { ambiguous: "500" } });
  setup(directory, `${mock.url}/v1`);
  let app = new Application({ directory });
  t.after(async () => { await app.close(); await mock.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  await app.generate({ provider: "openai-compatible", region: "custom", model: "custom-model", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9" }, prompt: "ambiguous", outputDir: path.join(directory, "out") }, null, () => {});
  const job = [...app.store.jobs.values()][0];
  assert.equal(job.state, "needs_review");
  assert.equal(job.attempts.create, 1);
  await app.close();
  app = new Application({ directory });
  assert.equal(app.store.get(job.id).state, "needs_review");
  assert.equal(mock.stats.requestCounts.ambiguous, 1);
});
