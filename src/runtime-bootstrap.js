const { spawn } = require("node:child_process");
const { initializeRuntime, runtimeErrorMessage } = require("./runtime");

function prepareServer() {
  let proxy;
  try { proxy = initializeRuntime(); }
  catch (error) { console.error(runtimeErrorMessage(error)); process.exit(1); }
  // Node 22.21 initializes native proxy agents even before --require preloads.
  // The documented npm entry disables that first pass, validates the environment,
  // and starts the actual server with native proxies and safe bypass settings.
  // Unflagged direct invocations remain a single process (including crash tests).
  if (!process.execArgv.includes("--no-use-env-proxy") || !(proxy.http || proxy.https)) return true;
  const child = spawn(process.execPath, ["--use-env-proxy", process.argv[1], ...process.argv.slice(2)], { env: process.env, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { if (!child.killed) child.kill(signal); });
  child.once("error", () => { console.error(runtimeErrorMessage({ code: "runtimeStartFailed" })); process.exit(1); });
  child.once("exit", (code, signal) => process.exit(signal ? 1 : code ?? 0));
  return false;
}

module.exports = { prepareServer };
