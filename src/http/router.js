const fsp = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");
const { PORT, PUBLIC_DIR } = require("../config");
const { safeError } = require("./errors");
const { sendJson, sendText } = require("./responses");
const { handleSelectOutputDir } = require("./handlers/select-dir");
const {
  handleGenerate,
  handleGenerateStream,
  handleGenerateBatchStream,
  handleStatus,
  handleDownload,
  handleOptions,
} = require("./handlers/legacy");

const LOCAL_BASE_URL = new URL(`http://127.0.0.1:${PORT}`);
const LOCALHOST_ORIGIN = new URL(`http://localhost:${PORT}`).origin;
const ALLOWED_HOST_ORIGINS = new Map([
  [`127.0.0.1:${PORT}`, LOCAL_BASE_URL.origin],
  [`localhost:${PORT}`, LOCALHOST_ORIGIN],
  ...(PORT === 80 ? [
    ["127.0.0.1", LOCAL_BASE_URL.origin],
    ["localhost", LOCALHOST_ORIGIN],
  ] : []),
]);

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
  }[ext] || "application/octet-stream";
}

async function serveStatic(req, res, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const resolved = path.resolve(PUBLIC_DIR, relativePath);
  const relativeToPublic = path.relative(PUBLIC_DIR, resolved);
  if (relativeToPublic.startsWith("..") || path.isAbsolute(relativeToPublic)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const data = await fsp.readFile(resolved);
    res.writeHead(200, { "content-type": contentTypeFor(resolved) });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

function requestHostAllowed(req) {
  return ALLOWED_HOST_ORIGINS.has(String(req.headers.host || "").toLowerCase());
}

function requestOriginAllowed(req) {
  const host = String(req.headers.host || "").toLowerCase();
  const origin = String(req.headers.origin || "").toLowerCase();
  return Boolean(origin) && origin === ALLOWED_HOST_ORIGINS.get(host);
}

async function handleRequest(req, res) {
  try {
    if (!requestHostAllowed(req)) {
      sendText(res, 403, "Forbidden");
      return;
    }

    const url = new URL(req.url || "/", LOCAL_BASE_URL);
    if (url.origin !== LOCAL_BASE_URL.origin) {
      sendText(res, 400, "Bad request");
      return;
    }
    if (req.method === "POST" && url.pathname.startsWith("/api/") && !requestOriginAllowed(req)) {
      sendText(res, 403, "Forbidden");
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/generate-batch-stream") await handleGenerateBatchStream(req, res);
    else if (req.method === "POST" && url.pathname === "/api/generate-stream") await handleGenerateStream(req, res);
    else if (req.method === "POST" && url.pathname === "/api/generate") await handleGenerate(req, res);
    else if (req.method === "POST" && url.pathname === "/api/status") await handleStatus(req, res);
    else if (req.method === "POST" && url.pathname === "/api/download") await handleDownload(req, res);
    else if (req.method === "POST" && url.pathname === "/api/select-output-dir") await handleSelectOutputDir(req, res);
    else if (req.method === "GET" && url.pathname === "/api/options") handleOptions(req, res);
    else if (req.method === "GET" || req.method === "HEAD") await serveStatic(req, res, url.pathname);
    else sendText(res, 405, "Method not allowed");
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    sendJson(res, 400, { ok: false, error: safeError(error) });
  }
}

module.exports = {
  contentTypeFor,
  serveStatic,
  requestHostAllowed,
  requestOriginAllowed,
  handleRequest,
};
