const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Application } = require("../src/application");
const { startMockServer } = require("./fixtures/mock-provider-server");

async function until(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(predicate(), "the explicitly injected fault reached its expected state");
}

for (const fault of ["drop_response", "accepted_no_response"]) {
  test(`accepted create stays single after explicit ${fault === "drop_response" ? "reply disconnect" : "response timeout"} and restart`, { timeout: 15000 }, async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-create-fault-"));
    const prompt = `accepted-${fault}`;
    const mock = await startMockServer({ faults: { [prompt]: fault } });
    fs.writeFileSync(path.join(directory, "catalog.local.json"), JSON.stringify({ providers: [{ provider: "openai-compatible", regions: [{ id: "custom", baseUrl: `${mock.url}/v1` }], models: [{ id: "custom-model", pollIntervalSec: 0.01 }] }] }));
    let app = new Application({ directory });
    t.after(async () => { await app.close(); await mock.close(); fs.rmSync(directory, { recursive: true, force: true }); });
    const abort = new AbortController();
    if (fault === "accepted_no_response") {
      const context = app.context.bind(app);
      app.context = (job, phase) => {
        const ctx = context(job, phase);
        if (phase === "create") {
          const fetch = ctx.fetch;
          ctx.fetch = (url, options) => fetch(url, { ...options, signal: AbortSignal.any([options.signal, abort.signal]) });
        }
        return ctx;
      };
    }
    await app.prepare({ provider: "openai-compatible", region: "custom", model: "custom-model", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9" }, prompt, outputDir: path.join(directory, "out") });
    await app.start();
    await until(() => mock.stats.accepted.length === 1);
    if (fault === "accepted_no_response") {
      assert.equal(Object.keys(mock.stats.createPending).length, 1, "the timeout starts only after the provider accepted and withheld its reply");
      const timeout = AbortSignal.timeout(20);
      await new Promise(resolve => timeout.addEventListener("abort", () => { abort.abort(timeout.reason); resolve(); }, { once: true }));
    }
    await until(() => [...app.store.jobs.values()][0]?.state === "needs_review");
    const job = [...app.store.jobs.values()][0];
    assert.equal(job.attempts.create, 1);
    assert.equal(job.error.category, "unknown_outcome");
    assert.equal(job.error.definitelyNotAccepted, false);
    assert.equal(mock.stats.faults[0].type, fault);
    if (fault === "accepted_no_response") assert.match(job.error.providerMessage, /timeout/i);
    else assert.match(job.error.providerCode, /SOCKET|ECONNRESET/);
    await app.close();
    app = new Application({ directory });
    await app.start();
    assert.equal(app.store.get(job.id).state, "needs_review");
    assert.equal(mock.stats.accepted.length, 1);
    assert.equal(mock.stats.createCounts[prompt], 1);
    assert.equal(mock.stats.requestCounts[prompt], 1, "neither uncertain outcome authorizes an automatic second paid create");
  });
}
