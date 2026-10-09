const fsp = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { ROOT, HOME_DIR, DEFAULT_OUTPUT_DIR } = require("../config");

function expandHome(inputPath) {
  if (!inputPath || inputPath === "~") return os.homedir();
  // Windows paths are shown as "~\\Downloads\\videogen"; accept that form there.
  if (inputPath.startsWith("~/") || process.platform === "win32" && inputPath.startsWith("~\\")) return path.join(os.homedir(), inputPath.slice(2));
  return inputPath;
}

// Leave room under the common 255-byte component limit for collision suffixes,
// a 100-byte job owner and the durable .part publication marker.
const MAX_FILENAME_BYTES = 128;
function truncateUtf8(value, maximum) {
  let text = "";
  let bytes = 0;
  for (const character of value) {
    const size = Buffer.byteLength(character);
    if (bytes + size > maximum) break;
    text += character;
    bytes += size;
  }
  return text;
}

function sanitizeFilename(name) {
  const base = path.basename(String(name || "").trim());
  const fallback = `videogen-${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`;
  let cleaned = (base || fallback).replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/[. ]+$/, "");
  if (!cleaned) cleaned = fallback;
  if (/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:[. ]|$)/i.test(cleaned)) cleaned = `_${cleaned}`;
  const extension = /\.(?:mp4|webm)$/i.exec(cleaned)?.[0] || ".mp4";
  let stem = cleaned.endsWith(extension) ? cleaned.slice(0, -extension.length) : cleaned;
  // ".mp4" alone has no usable stem (and no extname); never publish a dotfile.
  if (!stem.replace(/^[. ]+/, "")) stem = fallback.slice(0, -".mp4".length);
  return `${truncateUtf8(stem, MAX_FILENAME_BYTES - Buffer.byteLength(extension))}${extension}`;
}

function appendFilenameIndex(filename, index) {
  const ext = path.extname(filename) || ".mp4";
  const stem = path.extname(filename) ? filename.slice(0, -ext.length) : filename;
  const suffix = `-${String(index + 1).padStart(2, "0")}`;
  return `${truncateUtf8(stem, MAX_FILENAME_BYTES - Buffer.byteLength(ext + suffix))}${suffix}${ext}`;
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

async function preflightOutputDirectory(directory) {
  const probe = path.join(directory, `.videogen-check-${crypto.randomUUID()}`);
  const linked = `${probe}.link`;
  let handle;
  let ownsProbe = false;
  let ownsLink = false;
  try {
    await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
    handle = await fsp.open(probe, "wx", 0o600);
    ownsProbe = true;
    await handle.writeFile("videogen output check");
    await handle.sync();
    await handle.close();
    handle = null;
    // Publication requires atomic no-overwrite hardlinks for crash recovery.
    // Reject unsupported filesystems before a paid request can be submitted.
    await fsp.link(probe, linked);
    ownsLink = true;
    await syncOutputDirectory(directory);
  } catch (cause) {
    throw Object.assign(new Error("outputDirectoryUnavailable", { cause }), { code: "outputDirectoryUnavailable", status: 400, details: { filesystemCode: cause.code } });
  } finally {
    await handle?.close().catch(() => {});
    if (ownsLink) await fsp.unlink(linked).catch(() => {});
    if (ownsProbe) await fsp.unlink(probe).catch(() => {});
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
    // The partial keeps the originally requested name while the published
    // extension follows the actual response. Recover either container format.
    const extensions = new Set([extension, ".mp4", ".webm"]);
    if (![...extensions].some((ext) => name === `${stem}${ext}` || name.startsWith(`${stem} (`) && name.endsWith(`)${ext}`))) continue;
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
    return { path: candidate, bytes, contentType: /\.webm$/i.test(candidate) ? "video/webm" : /\.mp4$/i.test(candidate) ? "video/mp4" : contentType, sha256: hash.digest("hex") };
  }
  return null;
}

function outputPaths(desiredPath, jobId) {
  const directory = path.dirname(path.resolve(desiredPath));
  const target = path.join(directory, sanitizeFilename(path.basename(desiredPath)));
  const owner = /^[a-zA-Z0-9_-]{1,100}$/.test(String(jobId))
    ? String(jobId)
    : crypto.createHash("sha256").update(String(jobId)).digest("hex");
  return { directory, target, partialPath: `${target}.${owner}.part` };
}

async function finishRecoveredOutput(paths, { signal, onPublished, contentType }) {
  const recovered = await recoverPublishedOutput(paths.partialPath, paths.target, contentType, signal);
  if (!recovered) return null;
  await syncOutputDirectory(paths.directory);
  onPublished?.(recovered);
  await fsp.unlink(paths.partialPath);
  await syncOutputDirectory(paths.directory);
  return recovered;
}

// Run before remote polling/downloading: a published file remains recoverable
// even when the provider is offline or its result URL has expired.
async function recoverOutput(desiredPath, { jobId, signal, onPublished, contentType = "video/mp4" } = {}) {
  checkDownloadSignal(signal);
  if (jobId === undefined) return null;
  const paths = outputPaths(desiredPath, jobId);
  if (activePartialPaths.has(paths.partialPath)) throw Object.assign(new Error("downloadAlreadyRunning"), { code: "downloadAlreadyRunning" });
  activePartialPaths.add(paths.partialPath);
  try {
    return await finishRecoveredOutput(paths, { signal, onPublished, contentType });
  } finally {
    activePartialPaths.delete(paths.partialPath);
  }
}

// The succeeded record may have been fsynced just before a crash interrupted
// marker cleanup. Only remove a marker proven to be the saved file's hardlink.
async function cleanupPublishedPartial(desiredPath, { jobId, output, signal } = {}) {
  checkDownloadSignal(signal);
  if (jobId === undefined || !output?.path) return false;
  const paths = outputPaths(desiredPath, jobId);
  if (activePartialPaths.has(paths.partialPath)) return false;
  activePartialPaths.add(paths.partialPath);
  try {
    const stat = async (filename) => fsp.lstat(filename).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    const [partial, final] = await Promise.all([stat(paths.partialPath), stat(output.path)]);
    if (!partial?.isFile() || !final?.isFile() || partial.dev !== final.dev || partial.ino !== final.ino) return false;
    checkDownloadSignal(signal);
    await fsp.unlink(paths.partialPath);
    await syncOutputDirectory(paths.directory);
    return true;
  } finally {
    activePartialPaths.delete(paths.partialPath);
  }
}

async function writeOutput(response, desiredPath, { jobId = crypto.randomUUID(), signal, onPublished } = {}) {
  checkDownloadSignal(signal);
  const paths = outputPaths(desiredPath, jobId);
  const { directory, target, partialPath } = paths;
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
    const contentType = response?.ok !== false && response?.headers?.get?.("content-type") || "video/mp4";
    const recovered = await finishRecoveredOutput(paths, { signal, onPublished, contentType });
    if (recovered) {
      if (typeof response?.body?.cancel === "function") await response.body.cancel().catch(() => {});
      else response?.body?.destroy?.();
      return recovered;
    }
    if (response?.ok === false || !response?.body) {
      throw Object.assign(new Error("downloadFailed"), { code: "downloadFailed", status: response?.status });
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
    const mediaType = contentType.split(";")[0].trim().toLowerCase();
    const currentExtension = /\.(?:mp4|webm)$/i.exec(target)?.[0] || "";
    const extension = mediaType === "video/webm" ? ".webm" : mediaType === "video/mp4" ? ".mp4" : currentExtension || ".mp4";
    const publishTarget = `${currentExtension ? target.slice(0, -currentExtension.length) : target}${extension}`;
    if (!path.isAbsolute(publishTarget) || path.dirname(publishTarget) !== directory) throw Object.assign(new Error("invalidOutputPath"), { code: "EINVAL" });
    let output;
    for (let index = 1; ; index += 1) {
      checkDownloadSignal(signal);
      output = { path: outputCandidate(publishTarget, index), bytes, contentType, sha256 };
      try {
        // Unlike rename, linking fails atomically if a destination already exists.
        await fsp.link(partialPath, output.path);
        published = true;
        break;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    await syncOutputDirectory(directory);
    onPublished?.(output);
    await fsp.unlink(partialPath);
    ownsPartial = false;
    await syncOutputDirectory(directory);
    return output;
  } finally {
    if (abortDownload) signal?.removeEventListener("abort", abortDownload);
    // A failure before the body was read (mkdir, open, recovery) must still
    // release the provider connection instead of leaving it streaming.
    if (!source) {
      if (typeof response?.body?.cancel === "function") await response.body.cancel().catch(() => {});
      else response?.body?.destroy?.();
    }
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
  preflightOutputDirectory,
  normalizeDirectoryPath,
  displayPathForUser,
  recoverOutput,
  cleanupPublishedPartial,
  writeOutput,
};
