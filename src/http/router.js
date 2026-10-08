const fsp = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");
const { PORT, PUBLIC_DIR } = require("../config");
const { safeError } = require("./errors");
const { proxyInfo } = require("../runtime");
const { sendJson, sendText } = require("./responses");
const { handleSelectOutputDir } = require("./handlers/select-dir");
const { readBody } = require("./body");
const { languageFromRequest, st, SERVER_MESSAGES } = require("../i18n/server-messages");
const { MAX_BATCH_BYTES } = require("../config");
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
    if (req.method === "GET" && url.pathname === "/api/catalog") {
      return sendJson(res, 200, { ...application.catalog, platform: process.platform, proxy: proxyInfo() });
    }
    if (req.method === "GET" && url.pathname === "/api/jobs") return sendJson(res, 200, application.store.list(Object.fromEntries(url.searchParams)));
    if (req.method === "GET" && url.pathname === "/api/events") return application.events.connect(req, res);
    if (req.method === "GET" && url.pathname === "/api/keys") return sendJson(res, 200, application.keys.list());
    if (req.method === "GET" && url.pathname === "/api/lanes") return sendJson(res, 200, { lanes: application.scheduler.laneList() });
    if (req.method === "GET" && url.pathname === "/api/batches") return sendJson(res, 200, application.batches(Object.fromEntries(url.searchParams)));
    const resource = /^\/api\/(jobs|batches)\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && resource) {
      const value = resource[1] === "jobs" ? application.store.get(resource[2]) : application.batch(resource[2]);
      if (!value) throw Object.assign(new Error("jobNotFound"), { status: 404 });
      return sendJson(res, 200, value);
    }
    if (req.method === "DELETE" && /^\/api\/keys\/[^/]+$/.test(url.pathname)) {
      return sendJson(res, 200, application.deleteKey(url.pathname.split("/").at(-1)));
    }
    if (req.method === "POST" && url.pathname === "/api/keys") {
      const { payload } = await readBody(req, languageFromRequest(req));
      return sendJson(res, 200, application.setKey(payload));
    }
    if (req.method === "POST" && url.pathname === "/api/batches") {
      const { payload, file } = await readBody(req, languageFromRequest(req), MAX_BATCH_BYTES);
      if (payload.apiKey !== undefined || payload.key !== undefined) throw new Error("useKeysEndpoint");
      payload.language = languageFromRequest(req);
      const result = await application.prepare(payload, file);
      return sendJson(res, 201, { id: result.id, count: result.count });
    }
    const action = /^\/api\/(jobs|batches)\/([^/]+)\/(cancel|retry|resolve|pause|resume)$/.exec(url.pathname);
    if (req.method === "POST" && action) {
      const { payload } = await readBody(req, languageFromRequest(req));
      const result = action[1] === "jobs"
        ? await application.scheduler.jobAction(action[2], action[3], payload)
        : await application.scheduler.batchAction(action[2], action[3]);
      return sendJson(res, 200, result);
    }
    const laneAction = /^\/api\/lanes\/([^/]+)$/.exec(url.pathname);
    if (req.method === "POST" && laneAction) {
      const { payload } = await readBody(req, languageFromRequest(req));
      const entry = application.scheduler.laneList().find((lane) => lane.id === laneAction[1]);
      if (!entry) throw new Error("invalidLane");
      return sendJson(res, 200, application.scheduler.setLane(entry.lane || entry, payload));
    }
    const refresh = /^\/api\/catalog\/refresh\/([^/]+)$/.exec(url.pathname);
    if (req.method === "POST" && refresh) {
      const { payload } = await readBody(req, languageFromRequest(req));
      return sendJson(res, 200, await application.refreshCatalog(refresh[1], payload));
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
