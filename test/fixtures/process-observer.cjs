const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { redactDiagnostics } = require("../../src/queue/keys");

function observeProcess(child, { label = "test child", paths = [], secrets = [], processGroup = false } = {}) {
  let stdout = "", stderr = "", error, closed = false;
  const listeners = new Set(), messages = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  child.stdout?.setEncoding("utf8"); child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", chunk => { stdout += chunk; notify(); });
  child.stderr?.on("data", chunk => { stderr += chunk; notify(); });
  child.on("error", cause => { error = cause; notify(); });
  child.on("exit", notify);
  child.on("message", message => { if (typeof message?.type === "string") messages.add(message.type); notify(); });
  child.on("close", () => { closed = true; notify(); });
  function sanitize(value) {
    let text = String(value);
    for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) text = text.split(secret).join("[REDACTED]");
    text = redactDiagnostics(text);
    for (const filename of [...paths, os.homedir()].filter(Boolean).sort((a, b) => b.length - a.length)) {
      for (const spelling of [filename, filename.replaceAll("\\", "/"), JSON.stringify(filename).slice(1, -1)]) text = text.split(spelling).join("[PATH]");
    }
    return text.slice(-16000);
  }
  const clean = value => typeof value === "string" ? sanitize(value) : Array.isArray(value) ? value.map(clean)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)])) : value;
  const diagnostics = extra => JSON.stringify(clean({ label, pid: child.pid, exitCode: child.exitCode,
    signalCode: child.signalCode, connected: child.connected, closed, ...extra,
    stdout, stderr, ...(error ? { error: { code: error.code, message: error.message } } : {}) }));
  const exited = () => child.exitCode !== null || child.signalCode !== null;
  function waitFor(condition, { phase, timeoutMs, rejectExit = false, ignoreError = false }) {
    return new Promise((resolve, reject) => {
      const finish = failure => {
        clearTimeout(timer); listeners.delete(check);
        failure ? reject(new Error(`${phase}: ${failure}; ${diagnostics()}`)) : resolve();
      };
      const check = () => {
        if (error && !ignoreError) finish("child process error");
        else if (rejectExit && exited()) finish("child exited before readiness");
        else if (condition()) finish();
      };
      const timer = setTimeout(() => finish(`deadline exceeded (${timeoutMs} ms)`), timeoutMs);
      listeners.add(check); check();
    });
  }
  const waitForClose = (timeoutMs = 20000, ignoreError = false) =>
    waitFor(() => closed, { phase: `${label} close`, timeoutMs, ignoreError });
  async function cleanup({ pids = [], timeoutMs = 5000, primaryError } = {}) {
    try {
      // These callers inherit the service pipes. Close confirms the whole pipe
      // chain is gone; a saved PID must not be signalled after it may be reused.
      if (closed) return;
      if (process.platform === "win32" && !exited() && child.pid) {
        const taskkill = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");
        spawnSync(taskkill, ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, timeout: 3000 });
      } else if (processGroup && process.platform !== "win32" && child.pid) {
        try { process.kill(-child.pid, "SIGKILL"); } catch (cause) { if (cause.code !== "ESRCH") throw cause; }
      }
      if (!exited()) child.kill("SIGKILL");
      for (const pid of pids) {
        if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
          try { process.kill(pid, "SIGKILL"); } catch (cause) { if (cause.code !== "ESRCH") throw cause; }
        }
      }
      await waitForClose(timeoutMs, true);
    } catch (cleanupError) {
      const message = `${label} cleanup failed; ${diagnostics()}`;
      throw primaryError ? new AggregateError([primaryError, cleanupError], message) : new Error(message, { cause: cleanupError });
    }
  }
  return { child, diagnostics, sanitize, exited, cleanup, waitForClose,
    get stdout() { return stdout; }, get stderr() { return stderr; }, get closed() { return closed; },
    readyMessage: (type, timeoutMs = 15000) => waitFor(() => messages.has(type),
      { phase: `${label} IPC ready`, timeoutMs, rejectExit: true }),
    ready: (pattern, timeoutMs = 15000) => waitFor(() => pattern.test(stdout),
      { phase: `${label} ready`, timeoutMs, rejectExit: true }),
  };
}

module.exports = { observeProcess };
