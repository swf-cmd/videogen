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
