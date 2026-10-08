const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { ROOT, HOME_DIR, DEFAULT_OUTPUT_DIR } = require("../config");
const { st } = require("../i18n/server-messages");

function expandHome(inputPath) {
  if (!inputPath || inputPath === "~") return os.homedir();
  if (inputPath.startsWith("~/")) return path.join(os.homedir(), inputPath.slice(2));
  return inputPath;
}

function sanitizeFilename(name) {
  const base = path.basename(String(name || "").trim());
  const fallback = `sora-${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`;
  const cleaned = (base || fallback).replace(/[<>:"/\\|?*\x00-\x1f]/g, "-");
  return cleaned.toLowerCase().endsWith(".mp4") ? cleaned : `${cleaned}.mp4`;
}

function appendFilenameIndex(filename, index) {
  const ext = path.extname(filename);
  const stem = ext ? filename.slice(0, -ext.length) : filename;
  return `${stem}-${String(index + 1).padStart(2, "0")}${ext || ".mp4"}`;
}

function resolveOutputPath(outputDir, filename) {
  const dir = path.resolve(ROOT, expandHome(String(outputDir || DEFAULT_OUTPUT_DIR).trim()));
  return {
    dir,
    filePath: path.join(dir, sanitizeFilename(filename)),
  };
}

function resolveBatchOutputPath(outputDir, filename, index, total, fallbackName) {
  if (total <= 1) return resolveOutputPath(outputDir, filename || fallbackName);
  const baseName = filename ? appendFilenameIndex(sanitizeFilename(filename), index) : `${fallbackName}.mp4`;
  return resolveOutputPath(outputDir, baseName);
}

async function assertOutputFileAvailable(filePath, language = "zh") {
  try {
    await fsp.lstat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(st(language, "outputFileExists", { path: displayPathForUser(filePath) }));
}

async function assertBatchOutputFilesAvailable(payload, total) {
  if (!payload.filename) return;
  for (let index = 0; index < total; index += 1) {
    const { filePath } = resolveBatchOutputPath(
      payload.outputDir,
      payload.filename,
      index,
      total,
      "batch-output",
    );
    await assertOutputFileAvailable(filePath, payload.language);
  }
}

function normalizeDirectoryPath(inputPath) {
  const resolved = path.resolve(inputPath);
  const root = path.parse(resolved).root;
  return resolved === root ? resolved : resolved.replace(/[\\/]+$/, "");
}

function displayPathForUser(inputPath) {
  const resolved = normalizeDirectoryPath(path.resolve(expandHome(String(inputPath || ""))));
  const home = normalizeDirectoryPath(HOME_DIR);
  if (resolved === home) return "~";

  const relativeToHome = path.relative(home, resolved);
  if (relativeToHome && !relativeToHome.startsWith("..") && !path.isAbsolute(relativeToHome)) {
    return path.join("~", relativeToHome).replace(/\\/g, "/");
  }

  return resolved;
}

function outputInfoForUser(filePath, stats) {
  return {
    path: displayPathForUser(filePath),
    bytes: stats.size,
  };
}

module.exports = {
  expandHome,
  sanitizeFilename,
  appendFilenameIndex,
  resolveOutputPath,
  resolveBatchOutputPath,
  assertOutputFileAvailable,
  assertBatchOutputFilesAvailable,
  normalizeDirectoryPath,
  displayPathForUser,
  outputInfoForUser,
};
