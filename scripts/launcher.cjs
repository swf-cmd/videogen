// Run with --no-use-env-proxy so validation precedes Node's HTTP initialization.
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { initializeRuntime, runtimeErrorMessage } = require("../src/runtime");
const { superviseChild, READY_MESSAGE } = require("../src/runtime-bootstrap");
const appDir = path.resolve(__dirname, "..");

function configurePortable(env = process.env, directory = appDir) {
  if (!fs.existsSync(path.join(directory, ".portable"))) return false;
  env.VIDEOGEN_DATA_DIR ||= path.join(directory, "portable-data");
  env.VIDEOGEN_OUTPUT_DIR ||= path.join(directory, "portable-output");
  for (const name of ["VIDEOGEN_DATA_DIR", "VIDEOGEN_OUTPUT_DIR"]) {
    fs.mkdirSync(env[name], { recursive: true, mode: 0o700 });
    fs.accessSync(env[name], fs.constants.W_OK);
  }
  return true;
}

async function choosePort(requestedPort, explicit, net = require("node:net")) {
  if (!/^\d+$/.test(String(requestedPort)) || Number(requestedPort) < 1 || Number(requestedPort) > 65535) {
    throw new Error("Invalid PORT; use an integer from 1 to 65535.");
  }
  const start = Number(requestedPort);
  for (let port = start; port <= Math.min(65535, explicit ? start : start + 99); port += 1) {
    const result = await new Promise((resolve) => {
      const probe = net.createServer();
      probe.once("error", (error) => resolve(error.code));
      probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(null)));
    });
    if (!result) return port;
    if (result !== "EADDRINUSE") throw new Error(`Cannot open local port ${port} (${result}).`);
  }
  throw new Error("Local port is busy. Close the other instance or set a different PORT.");
}

function openBrowser(url) {
  if (process.env.OPEN_BROWSER === "0") return;
  const executable = process.platform === "win32"
    ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe") : "/usr/bin/open";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "start", url] : [url];
  const opener = spawn(executable, args, { detached: true, stdio: "ignore" });
  opener.once("error", () => console.log(`Open this address in your browser: ${url}`));
  opener.unref();
}

async function run() {
  try { initializeRuntime(); }
  catch (error) { console.error(runtimeErrorMessage(error)); return 1; }
  const portable = configurePortable();
  const port = await choosePort(process.env.PORT || "5177", Boolean(process.env.PORT));
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["--use-env-proxy", path.join(appDir, "server.js")], {
    cwd: appDir, env: { ...process.env, PORT: String(port) }, stdio: ["inherit", "inherit", "inherit", "ipc"], detached: process.platform === "win32", windowsHide: true,
  });
  const managed = superviseChild(server);
  let ready = false;
  server.on("message", (message) => {
    if (message?.type !== READY_MESSAGE || ready) return;
    ready = true;
    console.log(`videogen ${require("../package.json").version}${portable ? " (portable)" : ""}`);
    console.log(`Ready at ${url}\nKeep this window open while the queue is running. Press Ctrl+C to stop.`);
    openBrowser(url);
  });
  return managed.finished;
}

if (require.main === module) run().then((code) => { process.exitCode = code; }).catch((error) => {
  console.error(error.code === "EACCES" || error.code === "EPERM"
    ? "Extract the whole app into a writable folder before starting it." : error.message);
  process.exitCode = 1;
});
module.exports = { configurePortable, choosePort };
