const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { configurePortable, choosePort } = require("../scripts/launcher.cjs");

test("portable mode keeps private records and outputs with app; source preserves defaults", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen portable "));
  try {
    const source = {};
    assert.equal(configurePortable(source, directory), false);
    assert.deepEqual(source, {});
    fs.writeFileSync(path.join(directory, ".portable"), "1");
    const env = {};
    assert.equal(configurePortable(env, directory), true);
    assert.equal(env.VIDEOGEN_DATA_DIR, path.join(directory, "portable-data"));
    assert.equal(env.VIDEOGEN_OUTPUT_DIR, path.join(directory, "portable-output"));
    assert.ok(fs.statSync(env.VIDEOGEN_DATA_DIR).isDirectory());
    assert.ok(fs.statSync(env.VIDEOGEN_OUTPUT_DIR).isDirectory());
    const override = { VIDEOGEN_DATA_DIR: path.join(directory, "custom data"), VIDEOGEN_OUTPUT_DIR: path.join(directory, "custom output") };
    configurePortable(override, directory);
    assert.ok(override.VIDEOGEN_DATA_DIR.endsWith("custom data"));
    assert.ok(fs.statSync(override.VIDEOGEN_OUTPUT_DIR).isDirectory());
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("explicit busy port fails; automatic port selection skips occupied port", async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    await assert.rejects(choosePort(port, true), /busy/);
    if (port < 65535) assert.ok(await choosePort(port, false) > port);
    await assert.rejects(choosePort("proxy-user-secret", false), /Invalid PORT/);
    await assert.rejects(choosePort(65536, false), /Invalid PORT/);
    await assert.rejects(choosePort(0, false), /Invalid PORT/);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("launcher forwards termination and releases service lock", { skip: process.platform === "win32" }, async () => {
  const { spawn } = require("node:child_process");
  const { once } = require("node:events");
  const root = path.resolve(__dirname, "..");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen launcher stop "));
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const env = { ...process.env, VIDEOGEN_DATA_DIR: directory, OPEN_BROWSER: "0", PORT: String(port) };
  for (const key of Object.keys(env)) if (/proxy/i.test(key) || ["NODE_OPTIONS", "NODE_USE_ENV_PROXY"].includes(key)) delete env[key];
  const child = spawn(process.execPath, ["--no-use-env-proxy", path.join(root, "scripts/launcher.cjs")], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "", servicePid;
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  try {
    for (let index = 0; index < 100 && !output.includes("Ready at"); index += 1) {
      if (child.exitCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.match(output, /Ready at/, output);
    servicePid = JSON.parse(fs.readFileSync(path.join(directory, "lock"), "utf8")).pid;
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
    const [code] = await exited;
    clearTimeout(timer);
    assert.equal(code, 0, output);
    assert.equal(fs.existsSync(path.join(directory, "lock")), false);
    assert.throws(() => process.kill(servicePid, 0), { code: "ESRCH" });
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    if (servicePid) { try { process.kill(servicePid, "SIGKILL"); } catch {} }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("shutdown supervision requests IPC drain instead of Windows-style process termination", async () => {
  const { EventEmitter } = require("node:events");
  const { superviseChild, SHUTDOWN_MESSAGE } = require("../src/runtime-bootstrap");
  for (const event of ["SIGINT", "SIGHUP", "disconnect", "message"]) {
    const owner = new EventEmitter(); owner.channel = {};
    const child = new EventEmitter();
    Object.assign(child, { exitCode: null, signalCode: null, connected: true });
    const sent = [], killed = [];
    child.send = (message, callback) => { sent.push(message); callback(); };
    child.kill = (signal) => killed.push(signal);
    const supervised = superviseChild(child, { owner });
    owner.emit(event, { type: SHUTDOWN_MESSAGE });
    assert.deepEqual(sent, [{ type: SHUTDOWN_MESSAGE }], event);
    assert.deepEqual(killed, [], event);
    child.emit("exit", 0, null);
    assert.equal(await supervised.finished, 0);
    assert.equal(owner.listenerCount(event), 0);
  }
});

for (const stop of ["ipc", "SIGHUP", "SIGKILL"]) test(`launcher ${stop} shutdown leaves no orphan or data lock`, { skip: stop !== "ipc" && process.platform === "win32", timeout: 12000 }, async () => {
  const { spawn } = require("node:child_process");
  const { once } = require("node:events");
  const root = path.resolve(__dirname, "..");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen parent exit "));
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const env = { ...process.env, VIDEOGEN_DATA_DIR: directory, OPEN_BROWSER: "0", PORT: String(port), VIDEOGEN_LANGUAGE: "en" };
  for (const key of Object.keys(env)) if (/proxy/i.test(key) || ["NODE_OPTIONS", "NODE_USE_ENV_PROXY"].includes(key)) delete env[key];
  const child = spawn(process.execPath, ["--no-use-env-proxy", path.join(root, "scripts/launcher.cjs")], { cwd: root, env, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  let output = "", servicePid;
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  try {
    for (let index = 0; index < 250 && !output.includes("Ready at") && child.exitCode === null; index += 1) await new Promise(resolve => setTimeout(resolve, 20));
    assert.match(output, /Ready at/, output);
    servicePid = JSON.parse(fs.readFileSync(path.join(directory, "lock"), "utf8")).pid;
    const exited = once(child, "exit");
    if (stop === "ipc") child.send({ type: "videogen:shutdown" });
    else child.kill(stop);
    const [code] = await exited;
    if (stop !== "SIGKILL") assert.equal(code, 0, output);
    for (let index = 0; index < 250 && fs.existsSync(path.join(directory, "lock")); index += 1) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(fs.existsSync(path.join(directory, "lock")), false, output);
    // A killed parent can leave a momentary zombie until the system reaps it;
    // the closed listener and released ownership are the useful invariants.
    assert.equal(await choosePort(port, true), port);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    if (servicePid) { try { process.kill(servicePid, "SIGKILL"); } catch {} }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("invalid PORT reports an actionable message without a crash stack", () => {
  const { spawnSync } = require("node:child_process");
  const env = { ...process.env, PORT: "not-a-port" };
  for (const key of Object.keys(env)) if (/proxy/i.test(key) || ["NODE_OPTIONS", "NODE_USE_ENV_PROXY"].includes(key)) delete env[key];
  const result = spawnSync(process.execPath, ["server.js"], { cwd: path.resolve(__dirname, ".."), env, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid PORT; use an integer from 1 to 65535/);
  assert.doesNotMatch(result.stderr, /\n\s+at |throw new Error/);
  assert.doesNotMatch(result.stdout, /http:\/\//);
});

test("unsupported data-directory hard links fail clearly before printing readiness", () => {
  const { spawnSync } = require("node:child_process");
  const root = path.resolve(__dirname, "..");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen unsupported fs "));
  try {
    const preload = path.join(directory, "unsupported.cjs");
    fs.writeFileSync(preload, 'require("node:fs").linkSync = () => { throw Object.assign(new Error("operation unsupported"), {code:"ENOTSUP",syscall:"link"}); };');
    const env = { ...process.env, VIDEOGEN_DATA_DIR: path.join(directory, "data"), VIDEOGEN_LANGUAGE: "en" };
    for (const key of Object.keys(env)) if (/proxy/i.test(key) || ["NODE_OPTIONS", "NODE_USE_ENV_PROXY"].includes(key)) delete env[key];
    const result = spawnSync(process.execPath, ["--require", preload, "server.js"], { cwd: root, env, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /hard links.*exFAT/);
    assert.match(result.stderr, /VIDEOGEN_DATA_DIR/);
    assert.doesNotMatch(result.stdout, /http:\/\//);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("runtime preflight explains unsupported Node before a new CLI flag is used", () => {
  const { spawnSync } = require("node:child_process");
  const root = path.resolve(__dirname, "..");
  const code = 'Object.defineProperty(process.versions,"node",{value:"20.0.0"});require("./scripts/check-runtime.cjs")';
  const result = spawnSync(process.execPath, ["-e", code], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported Node.js 20\.0\.0.*22\.21.*24\.5/);
  assert.doesNotMatch(result.stderr, /bad option|\n\s+at /);
});

test("a second launcher reports a localized lock error without advertising an unusable URL", async () => {
  const { spawnSync } = require("node:child_process");
  const { InstanceLock } = require("../src/store/lock");
  const root = path.resolve(__dirname, "..");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen already running "));
  const lock = new InstanceLock(directory, 0);
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  try {
    lock.acquire();
    const env = { ...process.env, PORT: String(port), VIDEOGEN_DATA_DIR: directory, VIDEOGEN_LANGUAGE: "en", OPEN_BROWSER: "0" };
    for (const key of Object.keys(env)) if (/proxy/i.test(key) || ["NODE_OPTIONS", "NODE_USE_ENV_PROXY"].includes(key)) delete env[key];
    const result = spawnSync(process.execPath, ["--no-use-env-proxy", "scripts/launcher.cjs"], { cwd: root, env, encoding: "utf8", timeout: 5000 });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /already|locked|another/i);
    assert.doesNotMatch(result.stderr, /[\u4e00-\u9fff]/);
    assert.doesNotMatch(result.stdout, /http:\/\//);
  } finally { lock.release(); fs.rmSync(directory, { recursive: true, force: true }); }
});
