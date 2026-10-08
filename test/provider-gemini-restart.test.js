const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { once } = require("node:events");
const { spawn } = require("node:child_process");
const { observeProcess } = require("./fixtures/process-observer.cjs");

function workerMessage(output, state) {
  // A pipe chunk is not a record: retain the unfinished final line until the
  // next chunk arrives, even when it already includes the expected state.
  const line = output.split("\n").slice(0, -1).find(value => value.includes(`"state":"${state}"`));
  return line ? JSON.parse(line) : undefined;
}

test("worker status parsing waits for every fragment of a complete JSON line", () => {
  const line = JSON.stringify({ state: "done", output: { path: "offline-video.mp4" }, attempts: { create: 1 } }) + "\n";
  for (let end = 1; end < line.length; end += 1) assert.equal(workerMessage(line.slice(0, end), "done"), undefined);
  assert.deepEqual(workerMessage(line, "done"), JSON.parse(line));
  assert.equal(workerMessage('{"state":"saved"}\n' + line.slice(0, -1), "done"), undefined);
});

async function killWorker(observed) {
  if (observed.exited()) throw new Error(`Worker exited before checkpoint SIGKILL; ${observed.diagnostics()}`);
  assert.equal(observed.child.kill("SIGKILL"), true, observed.diagnostics());
  await observed.waitForClose(5000);
  const { exitCode, signalCode } = observed.child;
  if (process.platform === "win32") assert.ok(signalCode === "SIGKILL" || Number.isInteger(exitCode) && exitCode !== 0, observed.diagnostics());
  else { assert.equal(exitCode, null, observed.diagnostics()); assert.equal(signalCode, "SIGKILL", observed.diagnostics()); }
}

test("checkpoint shutdown rejects a worker that already closed after buffering its status", { timeout: 20000 }, async t => {
  const child = spawn(process.execPath, ["-e", 'require("node:fs").writeSync(1, JSON.stringify({state:"saved",id:"v1_durable"})+"\\n");'], { stdio: ["ignore", "pipe", "pipe"] });
  const observed = observeProcess(child, { label: "naturally exited checkpoint worker" });
  t.after(() => observed.cleanup());
  await observed.waitForClose(15000);
  assert.equal(child.exitCode, 0, observed.diagnostics());
  assert.equal(workerMessage(observed.stdout, "saved").id, "v1_durable");
  // A late close waiter must finish, while natural exit must never count as the
  // intentional crash even though the requested status remains in stdout.
  await observed.waitForClose(1000);
  await assert.rejects(killWorker(observed), /exited before checkpoint SIGKILL/);
});

const worker = `
const { Application } = require('./src/application');
const path = require('node:path');
// This fixture has no HTTP listener. Scheduler polling timers are deliberately
// unref'ed, so keep it alive until the parent performs the checkpoint SIGKILL.
setInterval(() => {}, 1000);
(async () => {
  const app = new Application({ directory: process.env.TEST_DIRECTORY });
  const lane = { provider: 'gemini', region: 'global', baseUrl: process.env.TEST_BASE_URL };
  app.setKey({ lane, key: 'AIza-offline-test-key' });
  app.store.on('event', (event) => {
    const job = app.store.get(event.jobId);
    if (job?.state === 'running' && job.remote?.id) console.log(JSON.stringify({ state: 'saved', id: job.remote.id }));
    if (job?.state === 'running' && job.remote?.pollingUrl) console.log(JSON.stringify({ state: 'file_saved', pollingUrl: job.remote.pollingUrl }));
    if (job?.state === 'succeeded') console.log(JSON.stringify({ state: 'done', output: job.output, attempts: job.attempts }));
  });
  if (!app.store.jobs.size) {
    const model = app.catalog.providers.find(p => p.provider === 'gemini').models[0];
    model.pollIntervalSec = 0.01;
    await app.prepare({ ...lane, model: model.id, prompt: 'Offline restart fixture', params: { durationSeconds: 3, resolution: '720p', aspectRatio: '16:9' }, outputDir: path.join(process.env.TEST_DIRECTORY, 'output') });
  }
  await app.start();
})().catch(error => { console.error(error); process.exit(1); });
`;

// Three 15s status waits, two 5s crash waits, and bounded startup/cleanup must
// report their own phase failures before the outer test deadline.
test("Gemini survives process kills after interaction ID and Files URI fsync with exactly one create", { timeout: 75000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-gemini-restart-"));
  const children = new Set(), sockets = new Set(), requests = [], bytes = Buffer.from("offline-video-original-bytes");
  let ready = false, fileReady = false;
  const server = http.createServer(async (req, res) => {
    requests.push(`${req.method} ${req.url}`);
    const json = (value) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
    if (req.method === "POST" && req.url === "/v1beta/interactions") {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks));
      assert.equal(body.background, true); assert.equal(body.store, true);
      return json({ id: "v1_durable", status: "in_progress" });
    }
    if (req.url === "/v1beta/interactions/v1_durable?stream=true") {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const event = ready ? { event_type: "step.delta", delta: { type: "video", uri: "files/output-1" } } : { event_type: "interaction.created", interaction: { id: "v1_durable", status: "in_progress" } };
      return res.end(`data: ${JSON.stringify(event)}\n\n`);
    }
    if (req.url === "/v1beta/files/output-1") return json({ name: "files/output-1", state: fileReady ? "ACTIVE" : "PROCESSING" });
    if (req.url === "/v1beta/files/output-1:download?alt=media") { res.writeHead(200, { "content-type": "video/mp4" }); return res.end(bytes); }
    res.writeHead(404); res.end();
  });
  server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  t.after(async () => {
    const results = await Promise.allSettled([...children].map(observed => observed.cleanup({ timeoutMs: 5000 })));
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Gemini fixture server close deadline; ${JSON.stringify({ sockets: sockets.size, requests })}`)), 5000);
        server.close(error => { clearTimeout(timer); error && error.code !== "ERR_SERVER_NOT_RUNNING" ? reject(error) : resolve(); });
        server.closeAllConnections();
        for (const socket of sockets) socket.destroy();
      });
    } catch (reason) { results.push({ status: "rejected", reason }); }
    finally { fs.rmSync(directory, { recursive: true, force: true }); }
    const failures = results.filter(result => result.status === "rejected").map(result => result.reason);
    if (failures.length) throw new AggregateError(failures, "Gemini fixture cleanup failed");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening", { signal: AbortSignal.timeout(5000) });
  function launch() {
    const child = spawn(process.execPath, ["-e", worker], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, TEST_DIRECTORY: directory, TEST_BASE_URL: `http://127.0.0.1:${server.address().port}/v1beta` }, stdio: ["ignore", "pipe", "pipe"] });
    const observed = observeProcess(child, { label: `Gemini checkpoint worker ${children.size + 1}`, paths: [directory, path.resolve(__dirname, "..")], secrets: ["AIza-offline-test-key"] });
    children.add(observed);
    const diagnostics = () => observed.diagnostics({ requests });
    return { observed, async wait(state) {
      const end = performance.now() + 15000;
      while (performance.now() < end) {
        if (observed.exited()) throw new Error(`Worker exited before ${state}: ${diagnostics()}`);
        const message = workerMessage(observed.stdout, state);
        if (message) return message;
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      throw new Error(`Timed out waiting for ${state}: ${diagnostics()}`);
    } };
  }
  const first = launch();
  assert.equal((await first.wait("saved")).id, "v1_durable");
  await killWorker(first.observed);
  assert.match(fs.readFileSync(path.join(directory, "jobs.ndjson"), "utf8"), /"id":"v1_durable"/);
  ready = true;
  const second = launch();
  assert.match((await second.wait("file_saved")).pollingUrl, /\/files\/output-1$/);
  await killWorker(second.observed);
  const replayRequests = requests.filter(value => value.includes("/interactions/v1_durable?stream=true")).length;
  fileReady = true;
  const third = launch(), done = await third.wait("done");
  assert.equal(requests.filter(value => value.includes("/interactions/v1_durable?stream=true")).length, replayRequests, "restart with a saved Files URI never replays the interaction");
  assert.equal(done.attempts.create, 1);
  assert.deepEqual(fs.readFileSync(done.output.path), bytes);
  assert.equal(requests.filter((value) => value.startsWith("POST ")).length, 1);
  assert.ok(requests.includes("GET /v1beta/interactions/v1_durable?stream=true"));
});
