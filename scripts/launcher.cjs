// Run with --no-use-env-proxy so validation precedes Node's HTTP initialization.
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { initializeRuntime, runtimeErrorMessage } = require("../src/runtime");
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
  // HTTP must only be loaded after proxy configuration has been validated.
  const http = require("node:http");
  const portable = configurePortable();
  const port = await choosePort(process.env.PORT || "5177", Boolean(process.env.PORT));
  const url = `http://127.0.0.1:${port}`;
  console.log(`videogen ${require("../package.json").version}${portable ? " (portable)" : ""}`);
  console.log(`URL: ${url}\nKeep this window open while the queue is running. Press Ctrl+C to stop.`);
  const server = spawn(process.execPath, ["--use-env-proxy", path.join(appDir, "server.js")], {
    cwd: appDir, env: { ...process.env, PORT: String(port) }, stdio: "inherit",
  });
  let stopped = false;
  const forwardSignal = (signal) => { stopped = true; if (!server.killed) server.kill(signal); };
  const interrupt = () => forwardSignal("SIGINT");
  const terminate = () => forwardSignal("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  const finished = new Promise((resolve) => {
    server.once("error", () => { stopped = true; console.error("Failed to start the bundled service."); resolve(1); });
    server.once("exit", (code, signal) => { stopped = true; resolve(signal ? 1 : code ?? 0); });
  });
  for (let index = 0; index < 50 && !stopped; index += 1) {
    const ready = await new Promise((resolve) => {
      const request = http.get(`${url}/api/catalog`, { agent: false }, (response) => {
        response.resume(); resolve(response.statusCode === 200);
      });
      request.once("error", () => resolve(false));
      request.setTimeout(500, () => { request.destroy(); resolve(false); });
    });
    if (ready && !stopped) { console.log(`Ready at ${url}`); openBrowser(url); break; }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const code = await finished;
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", terminate);
  return code;
}

if (require.main === module) run().then((code) => { process.exitCode = code; }).catch((error) => {
  console.error(error.code === "EACCES" || error.code === "EPERM"
    ? "Extract the whole app into a writable folder before starting it." : error.message);
  process.exitCode = 1;
});
module.exports = { configurePortable, choosePort };
