const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const { once } = require("node:events");
const test = require("node:test");
const { loadLegacyServer, root } = require("./helpers/legacy-server");

async function availablePort() {
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

function request(port, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1", port, path: "/", method: "GET", ...options,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.setTimeout(3000, () => req.destroy(new Error("HTTP request timed out")));
    req.end();
  });
}

async function startServer(t, port) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-security-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), VIDEOGEN_DATA_DIR: directory },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  let didClose = false;
  const closed = new Promise(resolve => child.once("close", () => { didClose = true; resolve(); }));
  const waitForClose = async timeoutMs => {
    let timer;
    try { await Promise.race([closed, new Promise(resolve => { timer = setTimeout(resolve, timeoutMs); })]); }
    finally { clearTimeout(timer); }
    return didClose;
  };
  t.after(async () => {
    try {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
      if (!await waitForClose(5000)) { child.kill("SIGKILL"); await waitForClose(3000); }
    } finally {
      child.stdout.destroy(); child.stderr.destroy();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
  await new Promise((resolve, reject) => {
    const diagnostics = () => JSON.stringify({ exitCode: child.exitCode, signalCode: child.signalCode, output: output.slice(-8000) });
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Server startup timed out: ${diagnostics()}`)); }, 15000);
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off("data", ready);
      child.off("exit", exited);
      child.off("error", failed);
    };
    const ready = () => { if (output.includes(`http://127.0.0.1:${port}`)) { cleanup(); resolve(); } };
    const exited = () => { cleanup(); reject(new Error(`Server exited before listening: ${diagnostics()}`)); };
    const failed = (error) => { cleanup(); reject(error); };
    child.stdout.on("data", ready);
    child.once("exit", exited);
    child.once("error", failed);
    ready();
  });
}

test("child-process HTTP server preserves localhost security boundaries", { timeout: 35000 }, async (t) => {
  const port = await availablePort();
  await startServer(t, port);
  const health = await request(port, { path: "/api/health" });
  assert.equal(health.status, 200);
  assert.equal(JSON.parse(health.body).healthy, true);

  await t.test("only configured loopback Host headers can load the page", async () => {
    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`, `LOCALHOST:${port}`]) {
      const response = await request(port, { headers: { host } });
      assert.equal(response.status, 200, host);
      assert.match(response.body, /<html/);
      assert.equal(response.headers["access-control-allow-origin"], undefined);
    }
    for (const host of ["example.com", `evil.localhost:${port}`, `127.0.0.1:${port + 1}`, "127.0.0.1", `[::1]:${port}`]) {
      const response = await request(port, { headers: { host } });
      assert.equal(response.status, 403, host);
    }
    const missingHost = await request(port, { setHost: false });
    assert.ok([400, 403].includes(missingHost.status));
  });

  await t.test("API POST requires an Origin matching its Host", async () => {
    for (const origin of [undefined, "null", "https://example.com", `http://localhost:${port}`, `https://127.0.0.1:${port}`, `http://127.0.0.1:${port + 1}`]) {
      const headers = origin === undefined ? {} : { origin };
      for (const method of ["POST", "DELETE", "PUT", "PATCH"]) {
        const response = await request(port, { path: "/api/not-a-route", method, headers });
        assert.equal(response.status, 403, `${method}: ${String(origin)}`);
      }
    }
    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`]) {
      const response = await request(port, { path: "/api/not-a-route", method: "POST", headers: { host, origin: `http://${host}` } });
      assert.equal(response.status, 405);
      assert.equal(response.headers["access-control-allow-origin"], undefined);
    }
  });

  await t.test("static traversal never exposes repository files", async () => {
    for (const pathname of ["/../server.js", "/../../package.json", "/%2e%2e/server.js", "/%2e%2e%2fserver.js", "/..%2fserver.js", "/%252e%252e%252fserver.js", "/..\\server.js", "/%00"]) {
      const response = await request(port, { path: pathname });
      assert.ok([400, 403, 404].includes(response.status), `${pathname}: ${response.status}`);
      assert.doesNotMatch(response.body, /const http = require|"scripts"/);
    }
    const absolute = await request(port, { path: "http://example.com/server.js" });
    assert.equal(absolute.status, 400);
    const head = await request(port, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers['x-frame-options'], 'DENY');
    assert.equal(head.headers['content-security-policy'], "frame-ancestors 'none'");
    assert.equal(head.body, "");
  });
});

test("static file resolver rejects traversal before touching disk", async () => {
  const { serveStatic } = loadLegacyServer();
  for (const pathname of ["/../server.js", "/../../package.json"]) {
    let status;
    let body;
    await serveStatic({ method: "GET" }, { writeHead: (value) => { status = value; }, end: (value) => { body = value; } }, pathname);
    assert.equal(status, 403);
    assert.equal(body, "Forbidden");
  }
});
