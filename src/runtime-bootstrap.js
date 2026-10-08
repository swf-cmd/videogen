const { spawn } = require("node:child_process");
const { initializeRuntime, runtimeErrorMessage } = require("./runtime");

const SHUTDOWN_MESSAGE = "videogen:shutdown";
const READY_MESSAGE = "videogen:ready";

// Node's child.kill() terminates Windows processes immediately. Use an IPC
// request on every platform, giving accepted provider work time to be persisted.
function shutdownEvents(shutdown, owner = process) {
  const signals = ["SIGINT", "SIGTERM", "SIGHUP", ...(process.platform === "win32" ? ["SIGBREAK"] : [])];
  const message = (value) => { if (value?.type === SHUTDOWN_MESSAGE) shutdown(); };
  for (const signal of signals) owner.on(signal, shutdown);
  owner.on("message", message);
  // IPC closes even if the launcher is forcibly killed, unlike signal forwarding.
  if (owner.channel) owner.on("disconnect", shutdown);
  return () => {
    for (const signal of signals) owner.removeListener(signal, shutdown);
    owner.removeListener("message", message);
    owner.removeListener("disconnect", shutdown);
  };
}

function superviseChild(child, { owner = process, timeoutMs = 20000 } = {}) {
  let stopping = false, timer;
  const shutdown = () => {
    if (stopping || child.exitCode !== null || child.signalCode !== null) return;
    stopping = true;
    if (child.connected) child.send({ type: SHUTDOWN_MESSAGE }, () => {});
    // An IPC disconnect is itself a shutdown request in the service. This
    // fallback only applies if the service cannot finish its bounded drain.
    timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    timer.unref();
  };
  const cleanup = shutdownEvents(shutdown, owner);
  const finished = new Promise((resolve) => {
    let settled = false;
    const complete = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(code);
    };
    child.once("error", () => { console.error(runtimeErrorMessage({ code: "runtimeStartFailed" })); complete(1); });
    child.once("exit", (code, signal) => complete(signal ? 1 : code ?? 0));
  });
  return { finished, shutdown };
}

function prepareServer() {
  let proxy;
  try { proxy = initializeRuntime(); }
  catch (error) { console.error(runtimeErrorMessage(error)); process.exit(1); }
  // Node 22.21 initializes native proxy agents even before --require preloads.
  // Validate in the unproxied parent before loading HTTP in the actual service.
  // Unflagged direct invocations remain a single process (including crash tests).
  if (!process.execArgv.includes("--no-use-env-proxy") || !(proxy.http || proxy.https)) return true;
  const child = spawn(process.execPath, ["--use-env-proxy", process.argv[1], ...process.argv.slice(2)], {
    env: process.env, stdio: ["inherit", "inherit", "inherit", "ipc"], detached: process.platform === "win32", windowsHide: true,
  });
  child.on("message", (value) => {
    if (value?.type !== READY_MESSAGE) return;
    if (process.connected) process.send(value, () => {});
    else console.log(`videogen running at http://127.0.0.1:${value.port}`);
  });
  superviseChild(child).finished.then((code) => process.exit(code));
  return false;
}

module.exports = { prepareServer, superviseChild, shutdownEvents, SHUTDOWN_MESSAGE, READY_MESSAGE };
