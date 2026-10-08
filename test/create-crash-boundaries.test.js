const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { Application } = require("../src/application");
const { startMockServer, mockBytes } = require("./fixtures/mock-provider-server");

const root = path.resolve(__dirname, "..");
const payload = { provider: "openai-compatible", region: "custom", model: "custom-model", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9" }, prompt: "boundary-job" };
const childSource = `
const { Application } = require('./src/application');
(async () => {
  const app = new Application({ directory: process.env.BOUNDARY_DIR });
  app.store.onCheckpoint = (name, event) => {
    const beforeCreate = process.env.BOUNDARY_MODE === 'before-create' && name === 'append:fsynced' && event?.state === 'submitting';
    const beforeIdSync = process.env.BOUNDARY_MODE === 'before-id-sync' && name === 'append:written' && event?.remote?.id;
    if (beforeCreate || beforeIdSync) { require('node:fs').writeSync(1, 'boundary:' + process.env.BOUNDARY_MODE); process.kill(process.pid, 'SIGKILL'); }
  };
  await app.start();
  await app.prepare(JSON.parse(process.env.BOUNDARY_PAYLOAD));
  setInterval(() => {}, 1000);
})().catch(error => { console.error(error.message); process.exit(1); });
`;

for (const mode of ["before-create", "before-id-sync"]) {
  test(`paid create remains single after SIGKILL at ${mode}`, { timeout: 35000 }, async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-boundary-"));
    const mock = await startMockServer({ renderDelayMs: 20 });
    t.after(async () => { await mock.close(); fs.rmSync(directory, { recursive: true, force: true }); });
    fs.writeFileSync(path.join(directory, "catalog.local.json"), JSON.stringify({ providers: [{ provider: "openai-compatible", regions: [{ id: "custom", baseUrl: `${mock.url}/v1` }], models: [{ id: "custom-model", pollIntervalSec: 0.005 }] }] }));
    const child = spawn(process.execPath, ["-e", childSource], { cwd: root, env: { ...process.env, BOUNDARY_DIR: directory, BOUNDARY_MODE: mode, BOUNDARY_PAYLOAD: JSON.stringify({ ...payload, outputDir: path.join(directory, "out") }) }, stdio: ["ignore", "pipe", "pipe"] });
    let errors = "";
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { errors += data; });
    // The worker must still kill itself at the exact checkpoint. The watchdog
    // only bounds a broken worker; close also drains the checkpoint's pipe.
    const timeout = setTimeout(() => child.kill("SIGKILL"), 15000);
    let code, signal;
    try { [code, signal] = await once(child, "close"); }
    finally { clearTimeout(timeout); if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }
    if (process.platform === "win32") assert.ok(signal === "SIGKILL" || Number.isInteger(code) && code !== 0, errors);
    else { assert.equal(code, null, errors); assert.equal(signal, "SIGKILL"); }
    assert.equal(output, `boundary:${mode}`, `the targeted boundary, not the test timeout, killed the process: ${JSON.stringify({ code, signal, stderr: errors.slice(-4000) })}`);
    const app = new Application({ directory });
    t.after(() => app.close());
    await app.start();
    const job = [...app.store.jobs.values()][0];
    assert.ok(job, "the durability barrier exists before network creation");
    if (mode === "before-create") {
      assert.equal(job.state, "needs_review");
      assert.equal(mock.stats.accepted.length, 0);
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(mock.stats.requestCounts[payload.prompt] || 0, 0);
    } else {
      assert.equal(mock.stats.accepted.length, 1);
      const deadline = performance.now() + 10000;
      while (app.store.get(job.id).state !== "succeeded" && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
      const recovered = app.store.get(job.id);
      assert.equal(recovered.state, "succeeded", JSON.stringify({ state: recovered.state, attempts: recovered.attempts, error: recovered.error, requests: mock.stats.requestCounts }));
      assert.equal(recovered.remote.id, mock.stats.accepted[0].id);
      assert.deepEqual(fs.readFileSync(recovered.output.path), mockBytes(payload.prompt));
      assert.equal(mock.stats.requestCounts[payload.prompt], 1);
    }
  });
}
