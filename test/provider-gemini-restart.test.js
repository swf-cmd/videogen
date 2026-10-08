const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { once } = require("node:events");
const { spawn } = require("node:child_process");

const worker = `
const { Application } = require('./src/application');
const path = require('node:path');
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

test("Gemini survives process kills after interaction ID and Files URI fsync with exactly one create", { timeout: 20000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-gemini-restart-"));
  const children = new Set(), requests = [], bytes = Buffer.from("offline-video-original-bytes");
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
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => {
    for (const child of children) { const closed = once(child, "close"); child.kill("SIGKILL"); await closed; }
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  function launch() {
    const child = spawn(process.execPath, ["-e", worker], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, TEST_DIRECTORY: directory, TEST_BASE_URL: `http://127.0.0.1:${server.address().port}/v1beta` }, stdio: ["ignore", "pipe", "pipe"] });
    children.add(child); child.once("close", () => children.delete(child));
    let output = "", errors = "";
    child.stdout.on("data", (chunk) => { output += chunk; }); child.stderr.on("data", (chunk) => { errors += chunk; });
    return { child, async wait(state) {
      const end = Date.now() + 10000;
      while (Date.now() < end) {
        const line = output.split("\n").find((value) => value.includes(`"state":"${state}"`));
        if (line) return JSON.parse(line);
        if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Worker exited before ${state}: ${errors}`);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      throw new Error(`Timed out waiting for ${state}: ${errors}`);
    } };
  }
  const first = launch();
  assert.equal((await first.wait("saved")).id, "v1_durable");
  const closed = once(first.child, "close"); first.child.kill("SIGKILL"); await closed;
  assert.match(fs.readFileSync(path.join(directory, "jobs.ndjson"), "utf8"), /"id":"v1_durable"/);
  ready = true;
  const second = launch();
  assert.match((await second.wait("file_saved")).pollingUrl, /\/files\/output-1$/);
  const secondClosed = once(second.child, "close"); second.child.kill("SIGKILL"); await secondClosed;
  const replayRequests = requests.filter(value => value.includes("/interactions/v1_durable?stream=true")).length;
  fileReady = true;
  const third = launch(), done = await third.wait("done");
  assert.equal(requests.filter(value => value.includes("/interactions/v1_durable?stream=true")).length, replayRequests, "restart with a saved Files URI never replays the interaction");
  assert.equal(done.attempts.create, 1);
  assert.deepEqual(fs.readFileSync(done.output.path), bytes);
  assert.equal(requests.filter((value) => value.startsWith("POST ")).length, 1);
  assert.ok(requests.includes("GET /v1beta/interactions/v1_durable?stream=true"));
});
