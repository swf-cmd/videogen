const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { configurePortable, choosePort } = require("../scripts/launcher.cjs");
const { redactDiagnostics } = require("../src/queue/keys");

function observeLauncher(child, privatePaths = []) {
  let stdout = "", stderr = "", error, closed = false;
  const changed = new Set();
  const notify = () => { for (const listener of changed) listener(); };
  child.stdout.on("data", chunk => { stdout += chunk; notify(); });
  child.stderr.on("data", chunk => { stderr += chunk; notify(); });
  child.on("error", cause => { error = cause; notify(); });
  child.on("exit", notify);
  child.on("close", () => { closed = true; notify(); });
  const sanitize = value => {
    let text = redactDiagnostics(String(value));
    for (const filename of [...privatePaths, os.homedir()].filter(Boolean).sort((a, b) => b.length - a.length)) {
      for (const spelling of [filename, filename.replaceAll("\\", "/")]) text = text.split(spelling).join("[PATH]");
    }
    // Redact before truncation so the boundary cannot expose part of a secret.
    return text.slice(-12000);
  };
  const diagnostics = () => JSON.stringify({ pid: child.pid, exitCode: child.exitCode, signalCode: child.signalCode,
    killed: child.killed, connected: child.connected, closed, stdout: sanitize(stdout), stderr: sanitize(stderr),
    ...(error ? { error: { code: error.code, message: sanitize(error.message) } } : {}) });
  const exited = () => child.exitCode !== null || child.signalCode !== null;
  function waitFor(phase, condition, timeoutMs, rejectExit = false) {
    return new Promise((resolve, reject) => {
      const finish = failure => {
        clearTimeout(timer);
        changed.delete(check);
        if (failure) reject(new Error(`${phase}: ${failure}; ${diagnostics()}`));
        else resolve();
      };
      const check = () => {
        if (error) finish("child process error");
        else if (rejectExit && exited()) finish("launcher exited before readiness");
        else if (condition()) finish();
      };
      const timer = setTimeout(() => finish(`deadline exceeded (${timeoutMs} ms)`), timeoutMs);
      changed.add(check);
      check();
    });
  }
  return { child, diagnostics, exited, get closed() { return closed; }, get stdout() { return stdout; },
    ready: () => waitFor("launcher ready", () => /(?:^|\n)Ready at /.test(stdout), 15000, true),
    exit: (timeoutMs = 10000) => waitFor("launcher exit", exited, timeoutMs),
    close: (timeoutMs = 3000) => waitFor("launcher pipes closed", () => closed, timeoutMs),
  };
}

async function cleanupLauncher(observed, directory, knownServicePid) {
  const { child } = observed, servicePids = new Set([knownServicePid]);
  try { servicePids.add(JSON.parse(fs.readFileSync(path.join(directory, "lock"), "utf8")).pid); } catch {}
  if (!observed.closed) {
    if (process.platform === "win32" && !observed.exited() && child.pid) {
      // The service is detached on Windows. Kill the owned process tree while
      // its parent still exists, including failures before its PID was logged.
      const { spawnSync } = require("node:child_process");
      const taskkill = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");
      spawnSync(taskkill, ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, timeout: 3000 });
    } else if (process.platform !== "win32" && child.pid) {
      // Each test launcher owns its process group, so pre-ready failures cannot
      // strand a service whose lock file has not been observed yet.
      try { process.kill(-child.pid, "SIGKILL"); } catch {}
    }
    if (!observed.exited()) child.kill("SIGKILL");
    for (const pid of servicePids) {
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) { try { process.kill(pid, "SIGKILL"); } catch {} }
    }
    await observed.close().catch(() => {});
  }
  child.stdout.destroy(); child.stderr.destroy();
  fs.rmSync(directory, { recursive: true, force: true });
}

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

test("launcher forwards termination and releases service lock", { skip: process.platform === "win32", timeout: 35000 }, async () => {
  const { spawn } = require("node:child_process");
  const root = path.resolve(__dirname, "..");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen launcher stop "));
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const env = { ...process.env, VIDEOGEN_DATA_DIR: directory, OPEN_BROWSER: "0", PORT: String(port) };
  for (const key of Object.keys(env)) if (/proxy/i.test(key) || ["NODE_OPTIONS", "NODE_USE_ENV_PROXY"].includes(key)) delete env[key];
  const child = spawn(process.execPath, ["--no-use-env-proxy", path.join(root, "scripts/launcher.cjs")], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  const observed = observeLauncher(child, [directory, root]);
  let servicePid;
  try {
    await observed.ready();
    servicePid = JSON.parse(fs.readFileSync(path.join(directory, "lock"), "utf8")).pid;
    const exited = observed.exit();
    child.kill("SIGTERM");
    await exited;
    assert.equal(child.exitCode, 0, observed.diagnostics());
    assert.equal(fs.existsSync(path.join(directory, "lock")), false, observed.diagnostics());
    assert.throws(() => process.kill(servicePid, 0), { code: "ESRCH" }, observed.diagnostics());
  } finally {
    await cleanupLauncher(observed, directory, servicePid);
  }
});

test("readiness waits for a delayed child beyond two seconds before requesting shutdown", { timeout: 35000 }, async () => {
  const { spawn } = require("node:child_process");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen delayed ready "));
  const child = spawn(process.execPath, ["-e", `
    const started = performance.now();
    let ready = false;
    console.error("authorization: Bearer fixture-private-secret");
    console.error(process.argv[1]);
    process.on("message", message => {
      if (message?.type !== "shutdown") return;
      require("node:fs").writeSync(1, JSON.stringify({ shutdownAfterReady: ready, elapsedMs: Math.round(performance.now() - started) }) + "\\n");
      process.exit(ready ? 0 : 9);
    });
    setTimeout(() => { ready = true; console.log("Ready at fixture"); }, 2300);
  `, directory], { stdio: ["ignore", "pipe", "pipe", "ipc"], detached: process.platform !== "win32" });
  const observed = observeLauncher(child, [directory]);
  try {
    await observed.ready();
    const exited = observed.exit();
    child.send({ type: "shutdown" });
    await exited;
    await observed.close();
    assert.equal(child.exitCode, 0, observed.diagnostics());
    const state = JSON.parse(observed.stdout.trim().split("\n").at(-1));
    assert.equal(state.shutdownAfterReady, true);
    assert.ok(state.elapsedMs >= 2200, observed.diagnostics());
    assert.doesNotMatch(observed.diagnostics(), /fixture-private-secret/);
    assert.equal(observed.diagnostics().includes(directory), false);
    assert.match(observed.diagnostics(), /\[REDACTED\]/);
    assert.match(observed.diagnostics(), /\[PATH\]/);
  } finally { await cleanupLauncher(observed, directory); }
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

for (const stop of ["ipc", "SIGHUP", "SIGKILL"]) test(`launcher ${stop} shutdown leaves no orphan or data lock`, { skip: stop !== "ipc" && process.platform === "win32", timeout: 35000 }, async () => {
  const { spawn } = require("node:child_process");
  const root = path.resolve(__dirname, "..");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen parent exit "));
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const env = { ...process.env, VIDEOGEN_DATA_DIR: directory, OPEN_BROWSER: "0", PORT: String(port), VIDEOGEN_LANGUAGE: "en" };
  for (const key of Object.keys(env)) if (/proxy/i.test(key) || ["NODE_OPTIONS", "NODE_USE_ENV_PROXY"].includes(key)) delete env[key];
  const child = spawn(process.execPath, ["--no-use-env-proxy", path.join(root, "scripts/launcher.cjs")], { cwd: root, env, stdio: ["ignore", "pipe", "pipe", "ipc"], detached: process.platform !== "win32" });
  const observed = observeLauncher(child, [directory, root]);
  let servicePid;
  try {
    await observed.ready();
    servicePid = JSON.parse(fs.readFileSync(path.join(directory, "lock"), "utf8")).pid;
    const exited = observed.exit();
    if (stop === "ipc") child.send({ type: "videogen:shutdown" });
    else child.kill(stop);
    await exited;
    if (stop !== "SIGKILL") assert.equal(child.exitCode, 0, observed.diagnostics());
    for (let index = 0; index < 250 && fs.existsSync(path.join(directory, "lock")); index += 1) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(fs.existsSync(path.join(directory, "lock")), false, observed.diagnostics());
    // A killed parent can leave a momentary zombie until the system reaps it;
    // the closed listener and released ownership are the useful invariants.
    assert.equal(await choosePort(port, true), port);
  } finally {
    await cleanupLauncher(observed, directory, servicePid);
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

test("a second launcher reports a localized lock error without advertising an unusable URL", { timeout: 20000 }, async () => {
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
    // A legitimate foreign-owner identity query alone may consume five seconds.
    const result = spawnSync(process.execPath, ["--no-use-env-proxy", "scripts/launcher.cjs"], { cwd: root, env, encoding: "utf8", timeout: 15000 });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /already|locked|another/i);
    assert.doesNotMatch(result.stderr, /[\u4e00-\u9fff]/);
    assert.doesNotMatch(result.stdout, /http:\/\//);
  } finally { lock.release(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test("Windows source version failures pause visibly and preserve status, with noninteractive opt-outs", { skip: process.platform !== "win32", timeout: 20000 }, () => {
  const { spawnSync } = require("node:child_process");
  const root = path.resolve(__dirname, "..");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen source runtime failure "));
  try {
    fs.copyFileSync(path.join(root, "Start videogen.cmd"), path.join(directory, "Start videogen.cmd"));
    fs.writeFileSync(path.join(directory, "server.js"), "");
    fs.mkdirSync(path.join(directory, "scripts"));
    fs.writeFileSync(path.join(directory, "scripts/check-runtime.cjs"), 'console.error("synthetic unsupported Node version");process.exit(37);');
    fs.writeFileSync(path.join(directory, "scripts/launcher.cjs"), 'require("node:fs").writeFileSync("unexpected-launch", "1");');
    const systemRoot = process.env.SystemRoot || "C:\\Windows";
    for (const [mode, overrides] of [["interactive", {}], ["noninteractive", { VIDEOGEN_NO_PAUSE: "1" }], ["smoke", { OPEN_BROWSER: "0" }]]) {
      const env = { ...process.env, PATH: `${path.dirname(process.execPath)};${path.join(systemRoot, "System32")}`, OPEN_BROWSER: "1", VIDEOGEN_NO_PAUSE: "0", ...overrides };
      delete env.SOURCE_NODE;
      const result = spawnSync(process.env.ComSpec || path.join(systemRoot, "System32/cmd.exe"), ["/d", "/s", "/c", `""${path.join(directory, "Start videogen.cmd")}""`], {
        cwd: directory, env, input: "\r\n", encoding: "utf8", timeout: 5000, windowsVerbatimArguments: true,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 37, `${mode}: ${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /synthetic unsupported Node version/);
      // The pause prompt is localized by cmd.exe; any additional stdout proves
      // it was displayed without depending on the machine's display language.
      assert.equal(Boolean(result.stdout.trim()), mode === "interactive", mode);
      assert.equal(fs.existsSync(path.join(directory, "unexpected-launch")), false);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
