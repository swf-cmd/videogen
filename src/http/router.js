const fsp = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");
const { PORT, PUBLIC_DIR } = require("../config");
const { safeError } = require("./errors");
const { sendJson, sendText } = require("./responses");
const { handleSelectOutputDir } = require("./handlers/select-dir");
const { readBody } = require("./body");
const { languageFromRequest, st, SERVER_MESSAGES } = require("../i18n/server-messages");
const { MAX_BATCH_BYTES } = require("../config");
const { writeNdjson } = require("./responses");
const { redact } = require("../queue/keys");
let application;
function configureApplication(value) { application = value; }

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
    if (!["GET", "HEAD"].includes(req.method) && url.pathname.startsWith("/api/") && !requestOriginAllowed(req)) {
      sendText(res, 403, "Forbidden");
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/select-output-dir") return await handleSelectOutputDir(req, res);
    if (req.method === "GET" && ["/api/catalog", "/api/options"].includes(url.pathname)) {
      return sendJson(res, 200, { ...application.catalog, platform: process.platform });
    }
    if (req.method === "GET" && url.pathname === "/api/jobs") return sendJson(res, 200, application.store.list(Object.fromEntries(url.searchParams)));
    if (req.method === "POST" && ["/api/generate-batch-stream", "/api/generate-stream", "/api/generate", "/api/recover", "/api/download"].includes(url.pathname)) {
      const language = languageFromRequest(req);
      const { payload, file } = await readBody(req, language, MAX_BATCH_BYTES);
      payload.language = language;
      res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" });
      const emit = (event) => { if (!res.destroyed) writeNdjson(res, redact(event)); };
      const operation = application.generate(payload, file, emit, ["/api/recover", "/api/download"].includes(url.pathname));
      application.work.add(operation);
      try { await operation; }
      catch (error) { emit({ type: "error", error: localizedError(error, language) }); }
      finally { application.work.delete(operation); res.end(); }
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/estimate") {
      const { payload } = await readBody(req, languageFromRequest(req));
      return sendJson(res, 200, application.estimate(payload));
    }
    if (req.method === "POST" && url.pathname === "/api/history/clear") return sendJson(res, 200, application.clearHistory());
    if (req.method === "GET" || req.method === "HEAD") return await serveStatic(req, res, url.pathname);
    sendText(res, 405, "Method not allowed");
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    sendJson(res, error.status || 400, { ok: false, error: localizedError(error, languageFromRequest(req)) });
  }
}

function localizedError(error, language) {
  const code = error.code || error.message;
  return SERVER_MESSAGES.zh[code] ? { code, message: st(language, code) } : safeError(error);
}

module.exports = {
  configureApplication,
  localizedError,
  contentTypeFor,
  serveStatic,
  requestHostAllowed,
  requestOriginAllowed,
  handleRequest,
};
