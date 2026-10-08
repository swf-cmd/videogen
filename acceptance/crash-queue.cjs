const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { createHash, randomUUID } = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const prompt = (index) => `e2e-job-${String(index).padStart(4, "0")}`;
const done = (job) => ["succeeded", "failed", "needs_review"].includes(job.state);

async function until(label, fn, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let last;
  do {
    last = await fn();
    if (last) return last;
    await pause(15);
  } while (Date.now() < deadline);
  throw new Error(`Timed out: ${label}`);
}

async function unusedPort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(filename) : entry.isFile() ? [filename] : [];
  });
}

const { durableJobs } = require("./durable-jobs.cjs");
const { failureDiagnostics } = require("./failure-diagnostics.cjs");

test("100 jobs survive three process crashes without duplicate paid creates or lost outputs", { timeout: 75000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-crash-queue-"));
  const dataDir = path.join(directory, "data");
  const outputs = [path.join(directory, "output-a"), path.join(directory, "output-b")];
  for (const target of [dataDir, ...outputs]) fs.mkdirSync(target);
  const secrets = [0, 1].map((index) => `e2e-secret-lane-${index}-${randomUUID()}`);
  const captured = [];
  const processOutput = [];
  const processes = new Set();
  const sseConnections = new Set();
  let app;
  let appOrigin;
  let sseDisconnects = 0;
  let sseBytes = 0;
  let seed = Number(process.env.VIDEOGEN_E2E_SEED || 20261008) >>> 0;
  const initialSeed = seed;
  const randomDelay = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return 10 + seed % 26; };
  const kills = [];
  const killedSubmissions = new Set();

  function child(script, env) {
    const proc = spawn(process.execPath, [script], { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    processes.add(proc);
    proc.output = "";
    for (const stream of [proc.stdout, proc.stderr]) stream.on("data", (bytes) => {
      const text = bytes.toString("utf8");
      proc.output += text;
      captured.push(text);
    });
    proc.once("exit", () => { processes.delete(proc); processOutput.push(proc.output); });
    return proc;
  }

  async function stop(proc, signal = "SIGTERM") {
    if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
    const exited = once(proc, "exit");
    proc.kill(signal);
    let timer;
    await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(() => { proc.kill("SIGKILL"); resolve(); }, 1500); })]);
    clearTimeout(timer);
    if (proc.exitCode === null && proc.signalCode === null) await exited;
  }

  t.after(async () => {
    for (const connection of sseConnections) connection.controller.abort();
    await Promise.all([...processes].map((proc) => stop(proc)));
    if (process.env.VIDEOGEN_E2E_KEEP === "1") t.diagnostic(`Temporary acceptance files: ${directory}`);
    else fs.rmSync(directory, { recursive: true, force: true });
  });

  const dropped = new Set([prompt(25), prompt(75)]);
  const moderated = new Set([15, 35, 55, 80, 95].map(prompt));
  const throttled = new Set([10, 12, 40, 60, 90].map(prompt));
  const faults = Object.fromEntries([
    ...[...dropped].map((value) => [value, "drop_response"]),
    ...[...moderated].map((value) => [value, "moderation"]),
    ...[...throttled].map((value) => [value, ["429"]]),
  ]);
  const mock = child("test/fixtures/mock-provider-server.js", { MOCK_CONFIG: JSON.stringify({
    requireKey: true, faults, retryAfterSec: 0.04,
    renderDelayMs: 2500, createDelayMs: 2, pollDelayMs: 20, downloadDelayMs: 800,
    delays: { [prompt(0)]: { create: 1500, render: 2500 } },
  }) });
  const mockOrigin = await until("mock process ready", () => {
    if (mock.exitCode !== null) throw new Error(`Mock exited: ${mock.output}`);
    const line = mock.output.split("\n").find((text) => text.startsWith('{"url":'));
    return line && JSON.parse(line).url;
  });
  async function mockApi(route, value) {
    const response = await fetch(`${mockOrigin}${route}`, { method: value === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, body: value === undefined ? undefined : JSON.stringify(value), signal: AbortSignal.timeout(3000) });
    const text = await response.text();
    captured.push(text);
    assert.equal(response.status, 200);
    return JSON.parse(text);
  }
  const stats = () => mockApi("/stats");

  fs.writeFileSync(path.join(dataDir, "catalog.local.json"), JSON.stringify({ providers: [{ provider: "openai-compatible", models: [{ id: "custom-model", pollIntervalSec: 0.01, requestTimeoutMs: 600, typicalRenderSec: 1 }] }] }));
  const port = await unusedPort();
  appOrigin = `http://127.0.0.1:${port}`;
  async function api(route, value, method = value === undefined ? "GET" : "POST") {
    const response = await fetch(`${appOrigin}${route}`, { method, headers: { origin: appOrigin, "content-type": "application/json", "x-videogen-language": "en" }, body: value === undefined ? undefined : JSON.stringify(value), signal: AbortSignal.timeout(5000) });
    const text = await response.text();
    captured.push(text);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.ok(response.ok, `${method} ${route}: ${response.status} ${text}`);
    return JSON.parse(text);
  }
  async function startApp() {
    app = child("server.js", { PORT: String(port), VIDEOGEN_DEV: "1", VIDEOGEN_DATA_DIR: dataDir, NO_PROXY: "127.0.0.1,localhost" });
    await until("videogen ready", async () => {
      if (app.exitCode !== null) throw new Error(`Videogen exited: ${app.output}`);
      if (!app.output.includes(appOrigin)) return false;
      try { await api("/api/catalog"); return true; } catch (error) { if (error.name === "AssertionError") throw error; return false; }
    });
    assert.deepEqual(await api("/api/keys"), [], "restart forgets every lane secret");
  }
  const lanes = ["lane-a", "lane-b"].map((name) => ({ provider: "openai-compatible", region: "custom", baseUrl: `${mockOrigin}/${name}/v1` }));
  const laneIds = [];
  async function restoreKeys() {
    for (let index = 0; index < lanes.length; index += 1) {
      const result = await api("/api/keys", { lane: lanes[index], key: secrets[index] });
      assert.equal(result.present, true);
      if (laneIds[index]) assert.equal(result.lane.id, laneIds[index]);
      else laneIds[index] = result.lane.id;
    }
  }
  async function openEvents() {
    const controller = new AbortController();
    const response = await fetch(`${appOrigin}/api/events`, { signal: controller.signal });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.match(response.headers.get("content-type"), /text\/event-stream/);
    const connection = { controller, chunks: [] };
    sseConnections.add(connection);
    connection.reading = (async () => {
      try {
        for await (const bytes of response.body) { sseBytes += bytes.length; connection.chunks.push(Buffer.from(bytes)); }
      } catch (error) {
        if (!controller.signal.aborted && !["TypeError", "AbortError"].includes(error.name)) throw error;
      } finally { captured.push(Buffer.concat(connection.chunks).toString("utf8")); sseConnections.delete(connection); }
    })();
    return connection;
  }
  async function disconnect(connection) {
    connection.controller.abort();
    await connection.reading;
    sseDisconnects += 1;
  }
  async function jobs(limit = 500) {
    const all = [];
    let cursor = null;
    do {
      const result = await api(`/api/jobs?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      assert.ok(Number.isSafeInteger(result.seq));
      all.push(...result.jobs);
      cursor = result.nextCursor;
    } while (cursor);
    return all;
  }
  async function killInPhase(phase, predicate) {
    let observation;
    await until(`${phase} crash window`, async () => {
      const before = await stats();
      if (!predicate(before, durableJobs(dataDir))) return false;
      await pause(randomDelay());
      observation = await stats();
      return predicate(observation, durableJobs(dataDir));
    }, 15000);
    await stop(app, "SIGKILL");
    assert.equal(app.signalCode, "SIGKILL");
    const interrupted = durableJobs(dataDir).filter((job) => job.state === "submitting" && !job.remote?.id);
    for (const job of interrupted) killedSubmissions.add(job.prompt);
    kills.push({ phase, createPending: Object.keys(observation.createPending).length, pollsActive: Object.keys(observation.pollsActive).length, downloadsActive: Object.keys(observation.downloadsActive).length, interruptedCreates: interrupted.length });
  }

  await startApp();
  await restoreKeys();
  for (let index = 0; index < lanes.length; index += 1) await api(`/api/lanes/${laneIds[index]}`, { concurrency: index ? 5 : 3, action: "pause" });
  const sentinel = path.join(outputs[0], "batch-a-02.mp4");
  const sentinelBytes = Buffer.from("Existing user file; acceptance must not overwrite this.\n");
  fs.writeFileSync(sentinel, sentinelBytes);
  let eventClient = await openEvents();
  for (let index = 0; index < lanes.length; index += 1) {
    const result = await api("/api/batches", { ...lanes[index], model: "custom-model", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9", audio: false, requestFormat: "json" }, prompt: Array.from({ length: 50 }, (_, offset) => prompt(index * 50 + offset)).join("\n\n"), filename: index ? "batch-b" : "batch-a", outputDir: outputs[index] });
    assert.equal(result.count, 50);
  }
  assert.equal((await jobs(17)).length, 100, "paginated snapshot includes the whole submission");
  await disconnect(eventClient);
  eventClient = await openEvents();
  for (const id of laneIds) await api(`/api/lanes/${id}`, { action: "resume" });

  await killInPhase("accepted create before response", (value, current) => {
    const submitting = current.filter((job) => job.state === "submitting");
    return value.accepted.length === 8 && Object.values(value.createPending).some((job) => job.prompt === prompt(0))
      && submitting.length === 1 && submitting[0].prompt === prompt(0)
      && current.filter((job) => job.remote?.id).length === 7;
  });
  assert.ok(killedSubmissions.has(prompt(0)), "the accepted create was durably submitting when killed");
  await disconnect(eventClient);

  await mockApi("/control", { pollDelayMs: 500 });
  await startApp();
  // Freeze only new submissions before restoring credentials. Otherwise a
  // completed poll can free a slot between the observation and SIGKILL, turning
  // the poll/download crash into an unintended fourth lost-create scenario.
  // Paid polls and downloads must continue throughout this persisted pause.
  for (const id of laneIds) await api(`/api/lanes/${id}`, { action: "pause" });
  await restoreKeys();
  eventClient = await openEvents();
  await killInPhase("poll", (value, current) => Object.keys(value.pollsActive).length > 0 && Object.keys(value.createPending).length === 0 && !current.some((job) => job.state === "submitting"));
  assert.equal(kills.at(-1).interruptedCreates, 0, "poll crash cannot interrupt a new paid create");
  await disconnect(eventClient);

  await mockApi("/control", { pollDelayMs: 5, renderDelayMs: 1000, downloadDelayMs: 800 });
  await startApp();
  await restoreKeys();
  eventClient = await openEvents();
  await killInPhase("download", (value, current) => Object.keys(value.downloadsActive).length > 0 && Object.keys(value.createPending).length === 0 && !current.some((job) => job.state === "submitting"));
  assert.equal(kills.at(-1).interruptedCreates, 0, "download crash cannot interrupt a new paid create");
  assert.ok(outputs.flatMap(filesUnder).some((filename) => filename.endsWith(".part")), "download SIGKILL leaves an actual partial file to recover");
  await disconnect(eventClient);

  await mockApi("/control", { pollDelayMs: 1, renderDelayMs: 25, createDelayMs: 0, downloadDelayMs: 5 });
  await startApp();
  const waiting = await api("/api/lanes");
  assert.ok(waiting.lanes.some((lane) => lane.state === "needs_key"), "unfinished lanes need fresh keys after restart");
  for (let index = 0; index < laneIds.length; index += 1) assert.equal(waiting.lanes.find((lane) => lane.id === laneIds[index]).concurrency, index ? 5 : 3, "lane limits persist across process crashes");
  await restoreKeys();
  for (const id of laneIds) await api(`/api/lanes/${id}`, { action: "resume" });
  eventClient = await openEvents();
  let finalJobs;
  try {
    finalJobs = await until("all 100 jobs reach acceptance terminal states", async () => {
      const current = await jobs();
      return current.length === 100 && current.every(done) && current;
    }, 40000);
  } catch (error) {
    const names = ["jobs", "lanes", "health", "mock"];
    const inspections = await Promise.allSettled([jobs(), api("/api/lanes"), api("/api/health"), stats()]);
    const details = { seed: initialSeed, phase: "final completion", kills, killedSubmissions: [...killedSubmissions], logs: [...processOutput, app?.output, mock.output], secrets, inspectionErrors: {} };
    for (let index = 0; index < inspections.length; index += 1) {
      const result = inspections[index], name = names[index];
      if (result.status === "fulfilled") details[name] = result.value;
      else details.inspectionErrors[name] = result.reason?.message || String(result.reason);
    }
    if (!details.jobs) {
      try { details.jobs = durableJobs(dataDir); }
      catch (cause) { details.inspectionErrors.durableJobs = cause.message; }
    }
    t.diagnostic(JSON.stringify(failureDiagnostics(details)));
    throw error;
  }
  await disconnect(eventClient);
  const observed = await stats();
  const succeeded = finalJobs.filter((job) => job.state === "succeeded");
  const failures = finalJobs.filter((job) => job.state === "failed");
  const reviews = finalJobs.filter((job) => job.state === "needs_review");
  assert.equal(new Set(finalJobs.map((job) => job.prompt)).size, 100);
  assert.equal(failures.length, moderated.size);
  assert.ok(failures.every((job) => job.error?.category === "moderation" && moderated.has(job.prompt)));
  assert.ok(finalJobs.every(done)); // (a)
  const duplicateCreates = Object.values(observed.createCounts).filter((count) => count > 1).length;
  assert.equal(duplicateCreates, 0); // (b): definite 429 rejections are not paid creates.
  const untracked = observed.jobs.filter((remote) => !finalJobs.some((local) => local.remote?.id === remote.id || local.prompt === remote.prompt && local.state === "needs_review"));
  assert.equal(untracked.length, 0); // (c)
  const unexplained = reviews.filter((job) => !dropped.has(job.prompt) && !killedSubmissions.has(job.prompt));
  assert.equal(unexplained.length, 0); // (d)
  assert.ok([...dropped].every((value) => reviews.some((job) => job.prompt === value)));
  const newFiles = outputs.flatMap(filesUnder).filter((filename) => filename !== sentinel);
  assert.equal(newFiles.length, succeeded.length);
  assert.equal(new Set(succeeded.map((job) => job.output.path)).size, succeeded.length);
  for (const job of succeeded) {
    const remote = observed.jobs.find((value) => value.id === job.remote.id);
    assert.ok(newFiles.includes(job.output.path));
    assert.equal(hash(fs.readFileSync(job.output.path)), remote.sha256);
    assert.equal(job.output.sha256, remote.sha256);
    assert.equal(job.output.bytes, remote.bytes);
  }
  const partialFiles = outputs.flatMap(filesUnder).filter((filename) => filename.endsWith(".part"));
  assert.equal(partialFiles.length, 0);
  assert.deepEqual(fs.readFileSync(sentinel), sentinelBytes); // (e)
  // Stop before scanning so the scan includes shutdown output and final store flushes.
  await stop(app);
  const scan = [...captured, ...processOutput, ...[dataDir, ...outputs].flatMap(filesUnder).flatMap((filename) => [filename, fs.readFileSync(filename).toString("utf8")])];
  const secretOccurrences = scan.reduce((count, text) => count + secrets.filter((secret) => text.includes(secret)).length, 0);
  assert.equal(secretOccurrences, 0); // (f)
  assert.ok(observed.maxInFlight["/lane-a"] <= 3);
  assert.ok(observed.maxInFlight["/lane-b"] <= 5); // (g)
  assert.ok(observed.maxDownloadsActive <= 3, "the independent mock observes the download pool limit");
  assert.equal(observed.faults.filter((fault) => fault.type === "rate_limit").length, throttled.size);
  for (const value of throttled) assert.equal(observed.requestCounts[value], 2);
  assert.equal(kills.length, 3);
  assert.ok(kills[0].createPending > 0);
  assert.ok(sseBytes > 0);
  t.diagnostic(JSON.stringify({
    seed: initialSeed, submitted: 100,
    a: { succeeded: succeeded.length, failedModeration: failures.length, needsReview: reviews.length, nonterminal: finalJobs.filter((job) => !done(job)).length },
    b: { duplicatePaidCreates: duplicateCreates, acceptedCreates: observed.jobs.length },
    c: { untrackedRemoteJobs: untracked.length },
    d: { unexplainedReviews: unexplained.length, injectedLostResponses: dropped.size, interruptedCreates: killedSubmissions.size },
    e: { newOutputFiles: newFiles.length, matchingHashes: succeeded.length, partialFiles: partialFiles.length, overwrittenFiles: 0 },
    f: { secretOccurrences, scannedResponsesAndChunks: captured.length },
    g: { maxInFlight: observed.maxInFlight, configured: { "/lane-a": 3, "/lane-b": 5 }, maxDownloadsActive: observed.maxDownloadsActive },
    rateLimitResponses: throttled.size, sseDisconnects, sigkills: kills,
  }));
});
