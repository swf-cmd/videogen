const fsp = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
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

const activePartialPaths = new Set();

function outputCandidate(desiredPath, index) {
  if (index === 1) return desiredPath;
  const extension = path.extname(desiredPath);
  return `${desiredPath.slice(0, -extension.length)} (${index})${extension}`;
}

function checkDownloadSignal(signal) {
  if (signal?.aborted) {
    throw signal.reason || Object.assign(new Error("downloadAborted"), { name: "AbortError" });
  }
}

async function syncOutputDirectory(directory) {
  let handle;
  try {
    handle = await fsp.open(directory, "r");
    await handle.sync();
  } catch (error) {
    if (!["EINVAL", "ENOTSUP", "EISDIR", "EPERM", "EBADF"].includes(error.code)) throw error;
  } finally {
    await handle?.close();
  }
}

async function recoverPublishedOutput(partialPath, desiredPath, contentType, signal) {
  let partial;
  try {
    partial = await fsp.lstat(partialPath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (!partial.isFile() || partial.nlink < 2) return null;
  const directory = path.dirname(desiredPath);
  const filename = path.basename(desiredPath);
  const extension = path.extname(filename);
  const stem = filename.slice(0, -extension.length);
  for (const name of await fsp.readdir(directory)) {
    if (name !== filename && !(name.startsWith(`${stem} (`) && name.endsWith(`)${extension}`))) continue;
    const candidate = path.join(directory, name);
    const stats = await fsp.lstat(candidate).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!stats?.isFile() || stats.dev !== partial.dev || stats.ino !== partial.ino) continue;
    const hash = crypto.createHash("sha256");
    let bytes = 0;
    for await (const chunk of createReadStream(candidate, { signal })) {
      hash.update(chunk);
      bytes += chunk.length;
    }
    return { path: candidate, bytes, contentType, sha256: hash.digest("hex") };
  }
  return null;
}

async function writeOutput(response, desiredPath, { jobId = crypto.randomUUID(), signal, onPublished } = {}) {
  if (response?.ok === false || !response?.body) {
    throw Object.assign(new Error("downloadFailed"), { code: "downloadFailed", status: response?.status });
  }
  checkDownloadSignal(signal);
  const directory = path.dirname(path.resolve(desiredPath));
  const target = path.join(directory, sanitizeFilename(path.basename(desiredPath)));
  const owner = /^[a-zA-Z0-9_-]{1,100}$/.test(String(jobId))
    ? String(jobId)
    : crypto.createHash("sha256").update(String(jobId)).digest("hex");
  const partialPath = `${target}.${owner}.part`;
  if (activePartialPaths.has(partialPath)) {
    throw Object.assign(new Error("downloadAlreadyRunning"), { code: "downloadAlreadyRunning" });
  }
  activePartialPaths.add(partialPath);
  let handle;
  let source;
  let abortDownload;
  let ownsPartial = false;
  let published = false;
  try {
    await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
    const contentType = response.headers?.get?.("content-type") || "application/octet-stream";
    const recovered = await recoverPublishedOutput(partialPath, target, contentType, signal);
    if (recovered) {
      onPublished?.(recovered);
      if (typeof response.body.cancel === "function") await response.body.cancel();
      else response.body.destroy?.();
      await fsp.unlink(partialPath);
      await syncOutputDirectory(directory);
      return recovered;
    }
    await fsp.unlink(partialPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    handle = await fsp.open(partialPath, "wx", 0o600);
    ownsPartial = true;
    source = typeof response.body.getReader === "function"
      ? Readable.fromWeb(response.body, { signal })
      : response.body instanceof Readable ? response.body : Readable.from(response.body, { signal });
    abortDownload = () => source.destroy(signal.reason instanceof Error
      ? signal.reason
      : Object.assign(new Error("downloadAborted"), { name: "AbortError" }));
    signal?.addEventListener("abort", abortDownload, { once: true });
    checkDownloadSignal(signal);
    const hash = crypto.createHash("sha256");
    let bytes = 0;
    for await (const chunk of source) {
      checkDownloadSignal(signal);
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      let offset = 0;
      while (offset < buffer.length) {
        const result = await handle.write(buffer, offset, buffer.length - offset);
        offset += result.bytesWritten;
      }
      hash.update(buffer);
      bytes += buffer.length;
    }
    await handle.sync();
    await handle.close();
    handle = null;
    const sha256 = hash.digest("hex");
    let output;
    for (let index = 1; ; index += 1) {
      checkDownloadSignal(signal);
      output = { path: outputCandidate(target, index), bytes, contentType, sha256 };
      try {
        // Unlike rename, linking fails atomically if a destination already exists.
        await fsp.link(partialPath, output.path);
        published = true;
        break;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    onPublished?.(output);
    await syncOutputDirectory(directory);
    await fsp.unlink(partialPath);
    ownsPartial = false;
    await syncOutputDirectory(directory);
    return output;
  } finally {
    if (abortDownload) signal?.removeEventListener("abort", abortDownload);
    await handle?.close().catch(() => {});
    if (ownsPartial && !published) await fsp.unlink(partialPath).catch(() => {});
    activePartialPaths.delete(partialPath);
  }
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
  writeOutput,
};
