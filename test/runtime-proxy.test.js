const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");
const https = require("node:https");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { supportsRuntime, configureProxyEnvironment, proxyInfo, runtimeErrorMessage } = require("../src/runtime");
const { createTlsFixture } = require("./helpers/tls-fixture");
const root = path.resolve(__dirname, "..");
const runtimePath = path.join(root, "src/runtime.js");

function cleanEnv(extra = {}) {
  const env = { ...process.env };
  for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "NODE_USE_ENV_PROXY", "NODE_OPTIONS", "NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED"]) delete env[name];
  return { ...env, ...extra };
}
function temporary(t) { const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-proxy-")); t.after(() => fs.rmSync(directory, { recursive: true, force: true })); return directory; }
function run(args, env, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (value) => { stdout += value; }); child.stderr.on("data", (value) => { stderr += value; });
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Child timed out")); }, 5000);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
async function networkFixture(t) {
  const directory = temporary(t); const fixture = createTlsFixture();
  const certPath = path.join(directory, "public-ca.pem"); fs.writeFileSync(certPath, fixture.cert, { mode: 0o600 });
  const origin = https.createServer(fixture, (req, res) => { res.setHeader("content-type", "text/plain"); res.end(`verified:${req.url}`); });
  origin.listen(0, "127.0.0.1"); await once(origin, "listening");
  const connects = []; const sockets = new Set();
  const proxy = net.createServer((client) => {
    sockets.add(client); client.on("close", () => sockets.delete(client)); client.on("error", () => {});
    let input = Buffer.alloc(0);
    const inspect = (chunk) => {
      input = Buffer.concat([input, chunk]); const end = input.indexOf("\r\n\r\n"); if (end < 0) return;
      client.off("data", inspect); connects.push(input.subarray(0, end).toString("latin1"));
      if (!/^CONNECT provider\.test:\d+ HTTP\/1\.1/.test(connects.at(-1))) { client.end("HTTP/1.1 502 Unexpected destination\r\n\r\n"); return; }
      const remote = net.connect(origin.address().port, "127.0.0.1", () => { client.write("HTTP/1.1 200 Connection established\r\n\r\n"); if (input.length > end + 4) remote.write(input.subarray(end + 4)); client.pipe(remote); remote.pipe(client); });
      sockets.add(remote); remote.on("close", () => sockets.delete(remote)); remote.on("error", () => client.destroy()); client.on("close", () => remote.destroy());
    };
    client.on("data", inspect);
  });
  proxy.listen(0, "127.0.0.1"); await once(proxy, "listening");
  t.after(async () => { for (const socket of sockets) socket.destroy(); origin.closeAllConnections(); await Promise.all([new Promise((resolve) => proxy.close(resolve)), new Promise((resolve) => origin.close(resolve))]); });
  return { directory, certPath, connects, originPort: origin.address().port, proxyUrl: `http://127.0.0.1:${proxy.address().port}` };
}
const childFetch = `
const {initializeRuntime,proxyInfo,runtimeErrorMessage}=require(${JSON.stringify(runtimePath)});
try { initializeRuntime(); } catch(error) { console.error(runtimeErrorMessage(error));process.exit(1); }
const dns=require('node:dns'); const lookup=dns.lookup;
dns.lookup=function(host,options,callback){if(host!=='provider.test')return lookup.apply(this,arguments);if(typeof options==='function'){callback=options;options={}}process.nextTick(()=>options?.all?callback(null,[{address:'127.0.0.1',family:4}]):callback(null,'127.0.0.1',4));};
(async()=>{const response=await fetch(process.env.PROXY_TEST_URL);console.log(JSON.stringify({status:response.status,body:await response.text(),proxy:proxyInfo()}))})().catch(error=>{console.error(error.message);process.exitCode=1});`;

test("runtime version predicates reject unsupported minor versions and expose four safe languages", () => {
  for (const version of ["18.20.0", "22.20.9", "23.11.0", "24.4.9", "24.5.0-rc.1", "invalid"]) assert.equal(supportsRuntime(version), false, version);
  for (const version of ["22.21.0", "22.99.0", "24.5.0", "24.21.0", "25.0.0", "26.0.0"]) assert.equal(supportsRuntime(version), true, version);
  const messages = ["zh", "en", "ja", "ko"].map((language) => runtimeErrorMessage({ code: "invalidProxy" }, { VIDEOGEN_LANGUAGE: language }));
  assert.equal(new Set(messages).size, 4); assert.equal(runtimeErrorMessage({ code: "invalidProxy" }, {}), messages[0]);
});

test("proxy environment normalizes lowercase precedence, safe metadata, HTTPS fallback and mandatory loopbacks", () => {
  const env = { HTTP_PROXY: "http://ignored.example:99", http_proxy: "http://proxy-user:proxy-password@chosen.example:8080/private", HTTPS_PROXY: "", NO_PROXY: "ignored.example", no_proxy: ".aliyuncs.com,.volces.com", NODE_USE_ENV_PROXY: "1" };
  configureProxyEnvironment(env); const info = proxyInfo(env, []);
  assert.equal(env.HTTP_PROXY, env.http_proxy); assert.equal(info.http, "http://[REDACTED]@chosen.example:8080"); assert.equal(info.https, info.http); assert.equal(info.enabled, true);
  assert.ok(info.noProxy.includes(".aliyuncs.com")); for (const host of ["localhost", "127.0.0.1", "[::1]"]) assert.ok(info.noProxy.includes(host));
  assert.ok(!JSON.stringify(info).includes("proxy-password")); assert.ok(!JSON.stringify(info).includes("proxy-user"));
  const empty = { http_proxy: "", HTTP_PROXY: "http://uppercase.example:80" }; configureProxyEnvironment(empty); assert.equal(proxyInfo(empty, ["--use-env-proxy"]).http, "http://uppercase.example");
  assert.equal(proxyInfo(configureProxyEnvironment({}), ["--use-env-proxy"]).enabled, false);
});

test("native fetch uses authenticated HTTPS CONNECT with flag or environment activation and HTTP_PROXY fallback", async (t) => {
  const fixture = await networkFixture(t);
  const authenticated = fixture.proxyUrl.replace("http://", "http://proxy-test-user:proxy-test-password@");
  for (const mode of ["https", "http-fallback", "lowercase"]) {
    const start = fixture.connects.length;
    const env = cleanEnv({ NODE_EXTRA_CA_CERTS: fixture.certPath, PROXY_TEST_URL: `https://provider.test:${fixture.originPort}/${mode}`, ...(mode === "http-fallback" ? { HTTP_PROXY: authenticated, NODE_USE_ENV_PROXY: "1" } : mode === "lowercase" ? { HTTPS_PROXY: "http://127.0.0.1:1", https_proxy: authenticated, NO_PROXY: "*", no_proxy: ".unmatched.example" } : { HTTPS_PROXY: authenticated }) });
    configureProxyEnvironment(env);
    const result = await run([...(mode === "http-fallback" ? [] : ["--use-env-proxy"]), "-e", childFetch], env);
    assert.equal(result.code, 0, result.stderr); const data = JSON.parse(result.stdout);
    assert.equal(data.status, 200); assert.equal(data.body, `verified:/${mode}`); assert.equal(fixture.connects.length - start, 1);
    assert.ok(fixture.connects.at(-1).toLowerCase().includes(`proxy-authorization: basic ${Buffer.from("proxy-test-user:proxy-test-password").toString("base64").toLowerCase()}`));
    assert.equal(data.proxy.https, authenticated.replace("proxy-test-user:proxy-test-password", "[REDACTED]"));
    for (const value of ["proxy-test-user", "proxy-test-password"]) assert.ok(!(result.stdout + result.stderr).includes(value));
  }
});

test("native fetch honors a user NO_PROXY suffix and always bypasses localhost and IPv4 loopback", async (t) => {
  const fixture = await networkFixture(t);
  for (const [host, bypass] of [["provider.test", ".test"], ["localhost", ".aliyuncs.com"], ["127.0.0.1", ".volces.com"]]) {
    const result = await run(["--use-env-proxy", "-e", childFetch], configureProxyEnvironment(cleanEnv({ HTTPS_PROXY: fixture.proxyUrl, NO_PROXY: bypass, NODE_EXTRA_CA_CERTS: fixture.certPath, PROXY_TEST_URL: `https://${host}:${fixture.originPort}/bypass` })));
    assert.equal(result.code, 0, result.stderr); assert.equal(JSON.parse(result.stdout).body, "verified:/bypass"); assert.equal(fixture.connects.length, 0);
  }
});

test("invalid proxy credentials never appear in server startup stdout or stderr", async () => {
  for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]) {
    const result = await run(["--no-use-env-proxy", "server.js"], cleanEnv({ [name]: "http://fake-user:fake-pass@bad host", VIDEOGEN_LANGUAGE: "en" }));
    assert.equal(result.code, 1); assert.match(result.stderr, /Invalid proxy configuration/);
    for (const value of ["fake-user", "fake-pass", "ERR_INVALID_URL"]) assert.ok(!(result.stdout + result.stderr).includes(value));
  }
});

async function availablePort() { const server = net.createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening"); const port = server.address().port; await new Promise((resolve) => server.close(resolve)); return port; }
function getJson(port) { return new Promise((resolve, reject) => { const req = http.get({ host: "127.0.0.1", port, path: "/api/catalog", agent: false }, (res) => { let text = ""; res.on("data", (data) => { text += data; }); res.on("end", () => { try { resolve(JSON.parse(text)); } catch (error) { reject(error); } }); }); req.on("error", reject); }); }
function launcherDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  fs.copyFileSync(path.join(root, "Start videogen.command"), path.join(directory, "Start videogen.command"));
  fs.copyFileSync(path.join(root, "server.js"), path.join(directory, "server.js"));
  fs.symlinkSync(path.join(root, "src"), path.join(directory, "src"), "dir");
  const node = path.join(directory, "runtime", `node-darwin-${process.arch}`, "node"); fs.mkdirSync(path.dirname(node), { recursive: true });
  fs.writeFileSync(node, `#!/bin/sh\nexec '${process.execPath.replaceAll("'", "'\\''")}' "$@"\n`, { mode: 0o700 });
  return directory;
}
async function smoke(t, kind, withProxy) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-proxy-start-")); const port = await availablePort(); let connects = 0;
  const proxy = net.createServer((socket) => { connects += 1; socket.end("HTTP/1.1 502 Local request must bypass\r\n\r\n"); });
  proxy.listen(0, "127.0.0.1"); await once(proxy, "listening");
  const data = path.join(directory, "data");
  const env = cleanEnv({ PORT: String(port), VIDEOGEN_DATA_DIR: data, OPEN_BROWSER: "0", PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ""}`, ...(withProxy ? { HTTP_PROXY: `http://smoke-user:smoke-pass@127.0.0.1:${proxy.address().port}`, HTTPS_PROXY: `http://smoke-user:smoke-pass@127.0.0.1:${proxy.address().port}`, no_proxy: ".aliyuncs.com" } : {}) });
  let command = process.execPath; let args; let cwd = root;
  if (kind === "npm") {
    const npm = [process.env.npm_execpath, path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"), ...String(process.env.PATH || "").split(path.delimiter).map((directory) => path.join(directory, "npm"))].filter(Boolean).find((filename) => fs.existsSync(filename));
    assert.ok(npm && fs.existsSync(npm), "npm CLI must accompany the supported runtime"); args = [fs.realpathSync(npm), "start", "--silent"];
  } else { command = "/bin/zsh"; cwd = launcherDirectory(path.join(directory, "app")); args = [path.join(cwd, "Start videogen.command")]; }
  const child = spawn(command, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] }); let output = "";
  child.stdout.on("data", (value) => { output += value; }); child.stderr.on("data", (value) => { output += value; }); child.stdin.on("error", () => {});
  t.after(async () => {
    try { const lock = JSON.parse(fs.readFileSync(path.join(data, "lock"), "utf8")); if (lock.pid) process.kill(lock.pid, "SIGTERM"); } catch {}
    child.stdin.end("\n"); if (child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); const timer = setTimeout(() => child.kill("SIGKILL"), 2000); await exited; clearTimeout(timer); }
    await new Promise((resolve) => proxy.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  let catalog;
  for (let count = 0; count < 150; count += 1) { try { catalog = await getJson(port); break; } catch {} if (child.exitCode !== null) break; await new Promise((resolve) => setTimeout(resolve, 20)); }
  assert.ok(catalog, output); assert.equal(catalog.proxy.enabled, withProxy); assert.ok(catalog.proxy.noProxy.includes("127.0.0.1")); assert.equal(connects, 0);
  for (const value of ["smoke-user", "smoke-pass"]) assert.ok(!JSON.stringify(catalog).includes(value) && !output.includes(value));
}

for (const kind of ["npm", "launcher"]) for (const withProxy of [false, true]) test(`${kind} starts with ${withProxy ? "proxy" : "direct"} networking and local API bypass`, { skip: kind === "launcher" && process.platform !== "darwin" }, async (t) => smoke(t, kind, withProxy));

test("launcher rejects invalid proxy configuration before native HTTP imports without exposing userinfo", { skip: process.platform !== "darwin" }, async (t) => {
  const directory = launcherDirectory(path.join(temporary(t), "app"));
  const child = spawn("/bin/zsh", [path.join(directory, "Start videogen.command")], { cwd: directory, env: cleanEnv({ HTTPS_PROXY: "http://fake-user:fake-pass@bad host", OPEN_BROWSER: "0", VIDEOGEN_LANGUAGE: "en" }), stdio: ["pipe", "pipe", "pipe"] });
  let output = ""; child.stdout.on("data", (data) => { output += data; }); child.stderr.on("data", (data) => { output += data; }); child.stdin.end("\n");
  const [code] = await once(child, "exit"); assert.equal(code, 1); assert.match(output, /Invalid proxy configuration/); for (const value of ["fake-user", "fake-pass"]) assert.ok(!output.includes(value));
});

test("displayed proxy activation matches native NODE_OPTIONS and ordered CLI flag precedence", async (t) => {
  const fixture = await networkFixture(t);
  for (const [options, flags, enabled] of [["--no-use-env-proxy", [], false], ["--no-use-env-proxy", ["--no-use-env-proxy", "--use-env-proxy"], true], ["--use-env-proxy", ["--use-env-proxy", "--no-use-env-proxy"], false]]) {
    const before = fixture.connects.length;
    const result = await run([...flags, "-e", childFetch], configureProxyEnvironment(cleanEnv({ HTTPS_PROXY: fixture.proxyUrl, NODE_USE_ENV_PROXY: "1", NODE_OPTIONS: options, NODE_EXTRA_CA_CERTS: fixture.certPath, PROXY_TEST_URL: `https://provider.test:${fixture.originPort}/flags` })));
    assert.equal(result.code, 0, result.stderr); assert.equal(JSON.parse(result.stdout).proxy.enabled, enabled); assert.equal(fixture.connects.length - before, enabled ? 1 : 0);
  }
});

for (const guarded of [true, false]) test(`${guarded ? "guarded proxy bootstrap forwards signals" : "unflagged direct startup stays in one process"} and releases the data lock`, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-runtime-signal-")); const port = await availablePort();
  const child = spawn(process.execPath, [...(guarded ? ["--no-use-env-proxy"] : []), "server.js"], { cwd: root, env: cleanEnv({ PORT: String(port), VIDEOGEN_DATA_DIR: directory, HTTPS_PROXY: "http://127.0.0.1:1" }), stdio: ["ignore", "pipe", "pipe"] });
  let output = ""; let servicePid; child.stdout.on("data", (data) => { output += data; }); child.stderr.on("data", (data) => { output += data; });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); if (servicePid && servicePid !== child.pid) { try { process.kill(servicePid, "SIGKILL"); } catch {} } fs.rmSync(directory, { recursive: true, force: true }); });
  let catalog;
  for (let count = 0; count < 150; count += 1) { try { catalog = await getJson(port); break; } catch {} if (child.exitCode !== null) break; await new Promise((resolve) => setTimeout(resolve, 20)); }
  assert.ok(catalog, output); servicePid = JSON.parse(fs.readFileSync(path.join(directory, "lock"), "utf8")).pid;
  assert.equal(servicePid === child.pid, !guarded); assert.equal(catalog.proxy.enabled, guarded);
  const exited = once(child, "exit"); const timer = setTimeout(() => child.kill("SIGKILL"), 3000); child.kill("SIGTERM"); const [code] = await exited; clearTimeout(timer);
  assert.equal(code, 0, output); assert.equal(fs.existsSync(path.join(directory, "lock")), false);
  if (guarded) assert.throws(() => process.kill(servicePid, 0), { code: "ESRCH" });
});
