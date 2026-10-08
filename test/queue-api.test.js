const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { JobStore } = require("../src/store/job-store");
const { observeProcess } = require("./fixtures/process-observer.cjs");

const root = path.resolve(__dirname, "..");
const secret = "sk-or-offline-api-contract-secret-873";

async function availablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function request(port, pathname, { method = "GET", payload, origin = true, chunks, headers = {} } = {}, diagnostics = () => "") {
  return new Promise((resolve, reject) => {
    const body = payload === undefined ? undefined : JSON.stringify(payload);
    const timer = setTimeout(() => req.destroy(new Error(`HTTP deadline: ${method} ${pathname}; ${diagnostics()}`)), 10000);
    const finish = (error, result) => { clearTimeout(timer); error ? reject(error) : resolve(result); };
    const req = http.request({ hostname: "127.0.0.1", port, path: pathname, method, headers: {
      ...(origin ? { origin: `http://127.0.0.1:${port}` } : {}),
      ...(body !== undefined || chunks ? { "content-type": "application/json" } : {}),
      ...(body !== undefined ? { "content-length": Buffer.byteLength(body) } : {}),
      ...headers,
    } }, (res) => {
      const parts = [];
      res.on("data", (part) => parts.push(part));
      res.on("end", () => {
        const text = Buffer.concat(parts).toString("utf8");
        let data;
        try { data = JSON.parse(text); } catch {}
        finish(null, { status: res.statusCode, headers: res.headers, text, data });
      });
      res.on("error", finish);
      res.on("aborted", () => finish(new Error(`HTTP response aborted: ${method} ${pathname}; ${diagnostics()}`)));
    });
    req.on("error", finish);
    if (chunks) for (const chunk of chunks) req.write(chunk);
    req.end(body);
  });
}

async function openEvents(port, headers = {}, diagnostics = () => "") {
  return new Promise((resolve, reject) => {
    let settled = false, status, text = "";
    // Start before connecting: waiting for response headers must also be bounded.
    const timer = setTimeout(() => fail("SSE initial event deadline exceeded"), 10000);
    const fail = message => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      reject(new Error(`${message}; ${diagnostics({ status, eventReceived: Boolean(text) })}`));
      req.destroy();
    };
    const req = http.get({ hostname: "127.0.0.1", port, path: "/api/events", headers }, (res) => {
      status = res.statusCode;
      res.on("data", (part) => {
        text += part;
        if (settled || !text.includes("\n\n")) return;
        settled = true; clearTimeout(timer);
        resolve({ status, headers: res.headers, text, close: () => req.destroy() });
      });
      res.on("error", () => fail("SSE response error"));
      res.on("aborted", () => fail("SSE response aborted"));
      res.on("end", () => fail("SSE ended before the initial event"));
    });
    req.on("error", error => fail(`SSE request failed (${error.code || "unknown"})`));
  });
}

async function waitUntil(read, predicate, message, diagnostics) {
  const deadline = Date.now() + 15000;
  let last;
  do {
    last = await read();
    if (predicate(last)) return last;
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (Date.now() < deadline);
  throw new Error(`${message}; ${diagnostics({ last: last?.data, status: last?.status })}`);
}

async function stopServer(observed) {
  if (!observed) return;
  const child = observed.child;
  let failure;
  try {
    if (!observed.exited()) {
      if (child.connected) child.send({ type: "videogen:shutdown" }, () => {});
      else child.kill("SIGTERM");
    }
    // The service may legitimately take up to 15 seconds to drain paid work.
    await observed.waitForClose(20000);
    assert.equal(child.exitCode, 0, observed.diagnostics());
  } catch (error) { failure = error; throw error; }
  finally { await observed.cleanup({ primaryError: failure }); }
}

async function harness(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-queue-api-"));
  const dataDir = path.join(directory, "data");
  const outputDir = path.join(directory, "output");
  const calls = [];
  const provider = http.createServer((req, res) => {
    calls.push({ method: req.method, url: req.url });
    req.resume();
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { code: "unexpectedTestProviderContact" } }));
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const port = await availablePort();
  const lane = { provider: "openrouter", region: "global", baseUrl: `http://127.0.0.1:${provider.address().port}/api/v1` };
  let child, observed;
  let output = "";
  const responses = [];
  const diagnostics = extra => observed?.diagnostics(extra) || "server not started";
  const api = async (pathname, options) => {
    const result = await request(port, pathname, options, diagnostics);
    responses.push(result.text);
    return result;
  };
  async function start() {
    child = spawn(process.execPath, ["server.js"], { cwd: root, env: {
      ...process.env, PORT: String(port), VIDEOGEN_DATA_DIR: dataDir,
      HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "", http_proxy: "", https_proxy: "", all_proxy: "", NO_PROXY: "*",
    }, stdio: ["ignore", "pipe", "pipe", "ipc"], detached: process.platform !== "win32" });
    observed = observeProcess(child, { label: "queue API server", paths: [directory, root], secrets: [secret], processGroup: true });
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    // The real service sends readiness only after application startup finishes.
    await observed.readyMessage("videogen:ready");
  }

  async function stop() { await stopServer(observed); }
  t.after(async () => {
    try { await stop(); } finally {
      provider.closeAllConnections();
      await new Promise(resolve => provider.close(resolve));
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
  await start();
  const payload = (prompt) => ({ ...lane, model: "alibaba/wan-3.0", prompt, params: { durationSeconds: 2, resolution: "480p", aspectRatio: "16:9", audio: false }, outputDir, filename: "api-contract" });
  return { api, port, lane, payload, calls, start, stop, dataDir, responses, diagnostics, output: () => output };
}

// Three complete starts and drains must fit the outer budget as well as requests.
test("queue HTTP contracts preserve local security and keyless restart semantics", { timeout: 120000 }, async (t) => {
  const app = await harness(t);
  let batch;
  let jobs;

  await t.test("retired stream and one-shot endpoints are unavailable", async () => {
    for (const route of ["/api/generate", "/api/generate-stream", "/api/generate-batch-stream", "/api/recover", "/api/download"]) {
      const result = await app.api(route, { method: "POST", payload: {} });
      assert.equal(result.status, 405);
      assert.notEqual(result.headers["content-type"], "application/x-ndjson; charset=utf-8");
    }
    for (const route of ["/api/options", "/api/status"]) assert.equal((await app.api(route)).status, 404);
  });

  await t.test("GET endpoints neither contact the provider nor mutate persistent jobs", async () => {
    const before = (await app.api("/api/jobs")).data.seq;
    for (const route of ["/api/catalog", "/api/jobs", "/api/batches", "/api/keys", "/api/lanes"]) {
      const result = await app.api(route);
      assert.equal(result.status, 200, route);
      assert.equal(result.headers["access-control-allow-origin"], undefined);
    }
    assert.equal((await app.api("/api/jobs")).data.seq, before);
    assert.equal(app.calls.length, 0);
  });

  await t.test("batch validation rejects credentials and invalid capabilities before persistence", async () => {
    for (const patch of [{ apiKey: secret }, { key: secret }, { params: { durationSeconds: 999, resolution: "480p", aspectRatio: "16:9" } }, { provider: "unknown-provider" }]) {
      const result = await app.api("/api/batches", { method: "POST", payload: { ...app.payload("not-created"), ...patch } });
      assert.equal(result.status, 400);
      assert.ok(!result.text.includes(secret));
    }
    assert.equal((await app.api("/api/jobs")).data.jobs.length, 0);
    assert.equal((await app.api("/api/batches")).data.batches.length, 0);
  });

  await t.test("queued work accepts no key and batch controls remain durable", async () => {
    const result = await app.api("/api/batches", { method: "POST", payload: app.payload("waiting-one\n\nwaiting-two\n\nwaiting-three") });
    assert.equal(result.status, 201);
    assert.equal(result.data.count, 3);
    batch = result.data.id;
    jobs = (await app.api(`/api/jobs?batch=${batch}`)).data.jobs;
    assert.equal(jobs.length, 3);
    assert.ok(jobs.every((job) => job.state === "queued" && job.attempts.create === 0));
    const lanes = await waitUntil(() => app.api("/api/lanes"), (result) => result.data.lanes.some((lane) => lane.state === "needs_key"), "Missing needs_key lane", app.diagnostics);
    assert.ok(lanes.data.lanes.some((lane) => lane.state === "needs_key"));
    assert.equal((await app.api(`/api/batches/${batch}/pause`, { method: "POST", payload: {} })).status, 200);
    assert.equal((await app.api(`/api/batches/${batch}`)).data.state, "paused");
    assert.equal((await app.api(`/api/batches/${batch}/resume`, { method: "POST", payload: {} })).status, 200);
    assert.equal((await app.api(`/api/batches/${batch}`)).data.state, "active");
    assert.equal((await app.api(`/api/batches/${batch}/pause`, { method: "POST", payload: {} })).status, 200);
    assert.equal(app.calls.length, 0);
  });

  await t.test("DELETE keys requires Origin and secrets never appear in responses or files", async () => {
    const added = await app.api("/api/keys", { method: "POST", payload: { lane: app.lane, key: secret } });
    assert.equal(added.status, 200);
    const laneId = added.data.lane.id;
    const listed = await app.api("/api/keys");
    assert.equal(listed.data[0].present, true);
    assert.ok(!listed.text.includes(secret));
    assert.equal((await app.api(`/api/keys/${laneId}`, { method: "DELETE", origin: false })).status, 403);
    assert.equal((await app.api("/api/keys")).data.length, 1);
    assert.equal((await app.api(`/api/keys/${laneId}`, { method: "DELETE" })).status, 200);
    assert.equal((await app.api("/api/keys")).data.length, 0);
    assert.equal((await app.api("/api/keys", { method: "POST", payload: { lane: app.lane, key: secret } })).status, 200);
    assert.equal(app.calls.length, 0, "Paused batches must not dispatch after key insertion");
    for (const name of fs.readdirSync(app.dataDir)) {
      const filename = path.join(app.dataDir, name);
      if (fs.statSync(filename).isFile()) assert.ok(!fs.readFileSync(filename).includes(Buffer.from(secret)), name);
    }
  });

  await t.test("restarting forgets keys and paused queued work resumes only to needs_key", async () => {
    await app.stop();
    await app.start();
    assert.deepEqual((await app.api("/api/keys")).data, []);
    assert.equal((await app.api(`/api/batches/${batch}`)).data.state, "paused");
    assert.equal((await app.api(`/api/batches/${batch}/resume`, { method: "POST", payload: {} })).status, 200);
    await waitUntil(() => app.api("/api/lanes"), (result) => result.data.lanes.some((lane) => lane.state === "needs_key"), "Restarted work did not wait for key", app.diagnostics);
    jobs = (await app.api(`/api/jobs?batch=${batch}`)).data.jobs;
    assert.equal(jobs.length, 3);
    assert.ok(jobs.every((job) => job.state === "queued" && job.attempts.create === 0));
    assert.equal(app.calls.length, 0);
  });

  await t.test("SSE exposes incremental metadata without CORS and honors replay cursors", async () => {
    const initial = await openEvents(app.port, {}, app.diagnostics);
    try {
      assert.equal(initial.status, 200);
      assert.match(initial.headers["content-type"], /^text\/event-stream/);
      assert.equal(initial.headers["access-control-allow-origin"], undefined);
      assert.match(initial.text, /event: ready/);
      assert.ok(!initial.text.includes("waiting-one"));
      const cursor = /^id: (\d+)$/m.exec(initial.text)[1];
      await app.api(`/api/batches/${batch}/pause`, { method: "POST", payload: {} });
      const replay = await openEvents(app.port, { "last-event-id": cursor }, app.diagnostics);
      try { assert.match(replay.text, /event: change/); assert.ok(Number(/^id: (\d+)$/m.exec(replay.text)[1]) > Number(cursor)); }
      finally { replay.close(); }
    } finally { initial.close(); }
  });

  await t.test("chunked bodies exceeding each route's limit receive HTTP 413", async () => {
    const chunk = Buffer.alloc(65536, "x");
    for (const [route, count] of [["/api/keys", 17], ["/api/batches", 257]]) {
      const result = await app.api(route, { method: "POST", chunks: Array(count).fill(chunk) });
      assert.equal(result.status, 413, route);
      assert.equal(result.headers["access-control-allow-origin"], undefined);
    }
    assert.equal((await app.api(`/api/jobs?batch=${batch}`)).data.jobs.length, 3);
  });

  await t.test("batch cancellation affects only queued local work", async () => {
    assert.equal((await app.api(`/api/batches/${batch}/cancel`, { method: "POST", payload: {} })).status, 200);
    const cancelled = (await app.api(`/api/jobs?batch=${batch}`)).data.jobs;
    assert.equal(cancelled.length, 3);
    assert.ok(cancelled.every((job) => job.state === "cancelled" && job.attempts.create === 0));
    assert.equal(app.calls.length, 0);
  });

  await t.test("needs_review resolution validates remote IDs and makes every choice explicit", async () => {
    const created = await app.api("/api/batches", { method: "POST", payload: app.payload("review-attach\n\nreview-abandon\n\nreview-resubmit") });
    assert.equal(created.status, 201);
    const pending = (await app.api(`/api/jobs?batch=${created.data.id}`)).data.jobs;
    await app.stop();
    const store = new JobStore(app.dataDir);
    try {
      for (const job of pending) store.update(job.id, { state: "submitting", attempts: { ...job.attempts, create: 1 } }, { sync: true });
    } finally { store.close(); }
    await app.start();
    for (const job of pending) assert.equal((await app.api(`/api/jobs/${job.id}`)).data.state, "needs_review");
    const [attach, abandon, resubmit] = pending;
    for (const remoteId of ["", "has space", "line\nbreak", "x".repeat(513), 123, {}]) {
      const result = await app.api(`/api/jobs/${attach.id}/resolve`, { method: "POST", payload: { action: "attach_remote_id", remoteId } });
      assert.equal(result.status, 400, JSON.stringify(remoteId));
      assert.equal((await app.api(`/api/jobs/${attach.id}`)).data.state, "needs_review");
    }
    assert.equal((await app.api(`/api/jobs/${attach.id}/resolve`, { method: "POST", payload: { action: "not-a-choice" } })).status, 400);
    assert.equal((await app.api(`/api/jobs/${attach.id}/resolve`, { method: "POST", payload: { action: "attach_remote_id", remoteId: "remote-found-001" } })).status, 200);
    const attached = (await app.api(`/api/jobs/${attach.id}`)).data;
    assert.equal(attached.remote.id, "remote-found-001");
    assert.equal(attached.state, "running");
    assert.equal(attached.attempts.create, 1);
    assert.equal((await app.api(`/api/jobs/${abandon.id}/resolve`, { method: "POST", payload: { action: "abandon" } })).status, 200);
    assert.equal((await app.api(`/api/jobs/${abandon.id}`)).data.state, "cancelled");
    assert.equal((await app.api(`/api/jobs/${resubmit.id}/resolve`, { method: "POST", payload: { action: "resubmit" } })).status, 200);
    const resubmitted = (await app.api(`/api/jobs/${resubmit.id}`)).data;
    assert.equal(resubmitted.state, "queued");
    assert.equal(resubmitted.attempts.create, 1);
    assert.equal(app.calls.length, 0, "Keyless resolution must not create or poll remotely");
  });

  assert.ok(!app.output().includes(secret));
  assert.ok(app.responses.every((text) => !text.includes(secret)));
  assert.equal(app.calls.length, 0);
});


test("SSE initial-frame deadline covers missing response headers and rejects an early EOF", { timeout: 10000 }, async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let emptyResponse = false;
  const server = http.createServer((req, res) => { if (emptyResponse) res.end(); });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const received = once(server, "request");
  const timedOut = assert.rejects(openEvents(server.address().port, {}, () => "safe process state"), /SSE initial event deadline exceeded; safe process state/);
  await received;
  t.mock.timers.tick(10000);
  await timedOut;
  emptyResponse = true;
  await assert.rejects(openEvents(server.address().port, {}, () => "safe process state"), /SSE ended before the initial event/);
});


test("restart stopping rejects a service that already closed with an abnormal exit", async () => {
  for (const exitCode of [0, 7]) {
    let cleanups = 0;
    const observed = { child: { exitCode }, closed: true, exited: () => true,
      waitForClose: async () => {}, diagnostics: () => "closed service state",
      cleanup: async () => { cleanups += 1; } };
    if (exitCode === 0) await stopServer(observed);
    else await assert.rejects(stopServer(observed), error => {
      assert.equal(error.actual, 7); assert.equal(error.expected, 0);
      assert.match(error.message, /closed service state/); return true;
    });
    assert.equal(cleanups, 1, "a failed stop still executes cleanup");
  }
});
