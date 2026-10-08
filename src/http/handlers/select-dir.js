const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { languageFromRequest, st } = require("../../i18n/server-messages");
const { normalizeDirectoryPath, displayPathForUser } = require("../../files/output");
const { safeError } = require("../errors");
const { sendJson } = require("../responses");

const execFileAsync = promisify(execFile);

function isAppleScriptCancel(error) {
  const text = [error?.message, error?.stdout, error?.stderr].filter(Boolean).join("\n");
  return /user canceled|cancelled|canceled|\(-128\)/i.test(text);
}

async function handleSelectOutputDir(req, res) {
  const language = languageFromRequest(req);
  if (process.platform !== "darwin") {
    sendJson(res, 400, { ok: false, error: { message: st(language, "selectDirUnsupported") } });
    return;
  }

  try {
    const { stdout } = await execFileAsync("/usr/bin/osascript", [
      "-e",
      `POSIX path of (choose folder with prompt ${JSON.stringify(st(language, "selectDirPrompt"))})`,
    ], { timeout: 120000 });
    const selectedPath = stdout.trim();
    if (!selectedPath) {
      throw new Error(st(language, "noDirSelected"));
    }
    const normalizedPath = normalizeDirectoryPath(selectedPath);
    const displayPath = displayPathForUser(normalizedPath);
    sendJson(res, 200, {
      ok: true,
      path: displayPath,
      displayPath,
    });
  } catch (error) {
    if (isAppleScriptCancel(error)) {
      sendJson(res, 200, { ok: true, canceled: true });
      return;
    }
    sendJson(res, 500, { ok: false, error: safeError(error) });
  }
}

module.exports = {
  isAppleScriptCancel,
  handleSelectOutputDir,
};
