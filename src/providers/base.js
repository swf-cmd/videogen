const { parseRetryAfterMs } = require("./retry");

/**
 * Provider adapter contract. Adapters translate HTTP only; the caller owns disk,
 * state transitions, retries and fsync barriers. Pure methods use catalog data.
 *
 * @typedef {Object} ProviderAdapter
 * @property {string} id
 * @property {string} displayNameKey Four-language UI translation key.
 * @property {"async"|"blocking"} createMode
 * @property {boolean} supportsIdempotencyKey True only with verified guarantees.
 * @property {function(string): (string|null)} validateKey Error translation key.
 * @property {function(Object, Object): {ok:boolean,value:Object,errors:Array}} normalizeParams
 * @property {function(Object, Object): {amount:(number|null),currency:(string|null),basis:string}} estimateCost
 * @property {function(Object, Object, Object): Promise<Array>} prepareAssets Safe before paid create.
 * @property {function(Object, Object, Object): Promise<{remoteId:string,pollingUrl?:string,status?:string}>} create
 * @property {function(Object, Object, Object): Promise<Object>} poll Normalized status, progress, result and error.
 * @property {function(Object, Object, Object, Object): Promise<Response>} download Original bytes.
 * @property {function(Object, string): string} classifyError Phase is prepare/create/poll/download.
 * @property {function(Object, Object): Promise<unknown>} [cancel]
 * @property {function(Object): Promise<Object>} [listModels]
 * @property {function(Object): Promise<unknown>} [checkKey] Must never incur generation charges.
 * @property {function(Object, Object): Promise<Array>} [reconcile] Candidates require manual association.
 * @property {function(Object, Object): (string|null)} [validateLane]
 * @property {function(string, Object): (string|null)} [validateRemoteId]
 *
 * ctx contains lane, key, fetch, log, catalog, assets and remoteAssets. assets are
 * ephemeral {buffer,mimeType,filename,width,height}; remoteAssets are memory-only.
 * fetch enforces origin-scoped credentials, timeouts and redaction. Call options
 * contain signal and, for create, the local UUID as idempotencyKey. Once create
 * has an ID it must return without another await, so the scheduler can fsync it.
 * Poll options may include synchronous onRemote({pollingUrl}); call it before
 * another await when discovering a durable polling address. A returned
 * pollingUrl is also merged into the saved remote descriptor.
 * poll statuses are queued/running/succeeded/failed/cancelled/expired. Its result
 * is {url,needsAuth,contentType?,expiresAt?}; polling and downloads never create.
 */
class ProviderError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ProviderError";
    Object.assign(this, details);
  }
}

function validateKey(key, prefix, optional = false) {
  if (optional && !key) return null;
  if (typeof key !== "string" || !key || /[\s\x00-\x1f\x7f]/.test(key)) return "invalidApiKey";
  return prefix && !key.startsWith(prefix) ? "invalidApiKey" : null;
}

function classifyError(error, phase = "poll") {
  if (error?.category) return error.category;
  const status = Number(error?.status);
  const code = String(error?.code || error?.cause?.code || "");
  if (phase === "create" && (status >= 500 || status === 408)) return "unknown_outcome";
  if (status === 402 || /^(?:Arrearage|InsufficientBalance|PrepaidBillOverdue|CommodityNotPurchased)$/.test(code)) return "quota";
  if (status === 429 || /^Throttling\./.test(code) || code === "THROTTLED") return "rate_limited";
  if (status === 401 || status === 403) return "auth";
  if (/moderation|content_policy|DataInspection|SensitiveContent|ContentRisk|ResponsibleAIPolicy/i.test(code)) return "moderation";
  if (status === 400 || status === 422 || status === 413) return "invalid_request";
  if (status === 404 && phase === "create") return "model_unavailable";
  if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "ENETDOWN", "EHOSTDOWN", "EADDRNOTAVAIL", "UND_ERR_CONNECT_TIMEOUT"].includes(code)) return "local_offline";
  return phase === "create" ? "unknown_outcome" : "transient";
}

function normalizeParams(model, params = {}) {
  const caps = model?.capabilities || {};
  const errors = [];
  const value = {};
  for (const [key, capability] of [["durationSeconds", "durations"], ["resolution", "resolutions"], ["aspectRatio", "aspectRatios"]]) {
    const allowed = caps[capability] || [];
    let selected = params[key] ?? allowed[0];
    if (key === "durationSeconds") selected = Number(selected);
    if (selected === undefined || selected === "" || (key === "durationSeconds" && (!Number.isInteger(selected) || selected <= 0))) {
      errors.push({ key, code: "invalidParameter" });
    } else if (allowed.length && !allowed.includes(selected)) {
      errors.push({ key, code: "unsupportedParameter" });
    } else value[key] = selected;
  }
  if (params.audio !== undefined && typeof params.audio !== "boolean") errors.push({ key: "audio", code: "invalidParameter" });
  else if (caps.audioFixed === true && params.audio === false) errors.push({ key: "audio", code: "unsupportedParameter" });
  else if (params.audio === true && !caps.audio) errors.push({ key: "audio", code: "unsupportedParameter" });
  else value.audio = Boolean(caps.audio && (params.audio ?? true));
  if (params.seed !== undefined && params.seed !== "" && params.seed !== null) {
    const seed = Number(params.seed);
    if (!Number.isSafeInteger(seed) || seed < -1 || seed > 2147483647 || caps.seed === false) errors.push({ key: "seed", code: "unsupportedParameter" });
    else value.seed = seed;
  }
  return { ok: errors.length === 0, value, errors };
}

function estimateCost(model, params = {}) {
  const pricing = model?.pricing;
  const unknown = { amount: null, currency: pricing?.currency || null, basis: "unknown" };
  if (!pricing) return unknown;
  const rate = pricing.rates?.[`${params.resolution}:${params.audio ? "audio" : "silent"}`]
    ?? pricing.rates?.[params.resolution] ?? pricing.rates?.default;
  let amount;
  if (pricing.unit === "second") amount = Number(rate) * Number(params.durationSeconds);
  if (pricing.unit === "video") amount = Number(rate);
  if (pricing.unit === "token") {
    const formula = pricing.formula;
    const tokensPerSecond = formula?.tokensPerSecond?.[params.resolution];
    if (Number.isFinite(tokensPerSecond) && Number.isFinite(formula?.pricePerMillion)) {
      amount = Number(params.durationSeconds) * tokensPerSecond * formula.pricePerMillion / 1000000;
    } else {
      const dimensions = formula?.dimensions?.[params.resolution]?.[params.aspectRatio];
      const price = formula?.pricePerMillionByResolution?.[params.resolution];
      if (Array.isArray(dimensions) && dimensions.length === 2 && dimensions.every((value) => Number.isFinite(value) && value > 0)
        && Number.isFinite(price) && Number.isFinite(formula.frameRate) && formula.frameRate > 0 && Number.isFinite(formula.pixelsPerToken) && formula.pixelsPerToken > 0) {
        amount = Number(params.durationSeconds) * dimensions[0] * dimensions[1] * formula.frameRate / formula.pixelsPerToken * price / 1000000;
      }
    }
  }
  if (rate === null || !Number.isFinite(amount) || amount < 0) return unknown;
  return { amount: Math.round(amount * 1000000) / 1000000, currency: pricing.currency, basis: pricing.unit };
}

function normalizeStatus(status, { phase = "poll" } = {}) {
  const states = { pending: "queued", queued: "queued", in_progress: "running", running: "running", completed: "succeeded", succeeded: "succeeded", failed: "failed", cancelled: "cancelled", canceled: "cancelled", expired: "expired" };
  const value = typeof status === "string" ? status.toLowerCase() : "";
  if (Object.hasOwn(states, value)) return states[value];
  // A returned create ID is sufficient to recover by polling. Poll responses,
  // however, must not hide a protocol change as perpetual running or expiry.
  if (phase === "create") return "running";
  throw new ProviderError("invalidProviderResponse", { code: "unknownProviderStatus", category: "transient" });
}

function createContext({ lane, key = "", catalog, fetchImpl = globalThis.fetch, redact = (value) => value, assets = [], log = () => {} }) {
  const base = new URL(lane.baseUrl);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new ProviderError("invalidBaseUrl", { category: "invalid_request", accepted: false });
  const clean = (value) => {
    let result = String(redact(String(value)));
    if (key.length >= 16) result = result.split(key).join("[REDACTED]");
    return result.replace(/((?:authorization|x-goog-api-key|api-key)["'\s:=]+)(?:Bearer\s+)?[^\s,"'}]+/gi, "$1[REDACTED]");
  };
  const cleanValues = (value) => {
    if (typeof value === "string") return clean(value);
    if (Array.isArray(value)) return value.map(cleanValues);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name,
      /^(?:authorization|proxy[-_]?authorization|x[-_]goog[-_]api[-_]key|x[-_]api[-_]key|api[-_]?key)$/i.test(name) ? "[REDACTED]" : cleanValues(item),
    ]));
  };
  const validateUrl = (url) => {
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
      || [...url.searchParams.keys()].some((name) => /^(?:key|api_key|api-key|token|authorization|x-goog-api-key|x-api-key)$/i.test(name))) {
      throw new ProviderError("unsafeProviderUrl", { category: "invalid_request", accepted: false });
    }
    // Public route names may coincide with short local keys. Query values and
    // external URLs have no such schema exemption; inspect decoded forms too.
    let candidate = url.origin === base.origin ? `${url.search}${url.hash}` : url.href;
    for (let depth = 0; depth < 8; depth += 1) {
      if (clean(candidate) !== candidate) throw new ProviderError("unsafeProviderUrl", { category: "invalid_request", accepted: false });
      let decoded;
      try { decoded = decodeURIComponent(candidate); } catch { break; }
      if (decoded === candidate) break;
      candidate = decoded;
    }
  };
  const ctx = { lane, key, catalog, assets, redact: clean, redactValues: (value) => cleanValues(redact(value)), log: (...values) => log(...values.map(clean)) };
  ctx.fetch = async (path, options = {}) => {
    const { needsAuth = true, timeoutMs = 60000, phase = "poll", ...requestOptions } = options;
    let url = new URL(path, `${base.href.replace(/\/$/, "")}/`);
    validateUrl(url);
    if (needsAuth && url.origin !== base.origin) throw new ProviderError("unsafeProviderUrl", { category: "invalid_request", accepted: false });
    const headers = new Headers(requestOptions.headers || {});
    const credentialHeaders = ["authorization", "proxy-authorization", "x-goog-api-key", "x-api-key", "api-key", "cookie"];
    for (const name of credentialHeaders) headers.delete(name);
    if (needsAuth && key) headers.set(lane.provider === "gemini" ? "x-goog-api-key" : "authorization", lane.provider === "gemini" ? key : `Bearer ${key}`);
    // Downloads bound time-to-headers and then inactivity, never the whole
    // transfer: a large clip on a slow but healthy link must be able to finish.
    // Other phases keep a total deadline because their bodies are small JSON.
    const streaming = phase === "download";
    const deadline = new AbortController();
    const expire = () => deadline.abort(Object.assign(new Error(streaming ? "downloadStalled" : "The operation was aborted due to timeout"), { name: "TimeoutError", code: streaming ? "downloadStalled" : undefined }));
    let timer = setTimeout(expire, timeoutMs);
    timer.unref?.();
    const signal = requestOptions.signal ? AbortSignal.any([deadline.signal, requestOptions.signal]) : deadline.signal;
    try {
      let response;
      for (let redirect = 0; redirect < 6; redirect += 1) {
        response = await fetchImpl(url, { ...requestOptions, headers, signal, redirect: "manual" });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const next = response.headers.get("location");
        if (!next || !["GET", "HEAD"].includes((requestOptions.method || "GET").toUpperCase())) throw new ProviderError("unexpectedProviderRedirect", { category: phase === "create" ? "unknown_outcome" : "transient" });
        await response.body?.cancel();
        url = new URL(next, url);
        validateUrl(url);
        if (base.protocol === "https:" && url.protocol !== "https:") throw new ProviderError("unsafeProviderUrl", { category: "invalid_request" });
        for (const name of credentialHeaders) headers.delete(name);
      }
      if (!response.ok) {
        let body = "";
        if (response.body) {
          const reader = response.body.getReader();
          while (body.length < 32768) {
            const part = await reader.read();
            if (part.done) break;
            body += Buffer.from(part.value).toString("utf8");
          }
          await reader.cancel();
        }
        let parsed;
        try { parsed = JSON.parse(body); } catch {}
        const details = parsed?.error || parsed || {};
        const error = new ProviderError(clean(details.message || (typeof details === "string" ? details : "providerRequestFailed")), {
          status: response.status, code: clean(details.code || ""), retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")),
          accepted: [400, 401, 402, 403, 404, 413, 422, 429].includes(response.status) ? false : undefined,
        });
        error.category = classifyError(error, phase);
        throw error;
      }
      if (!streaming || !response.body || typeof response.body.getReader !== "function") return response;
      clearTimeout(timer);
      timer = null;
      const reader = response.body.getReader();
      const body = new ReadableStream({
        async pull(controller) {
          const idle = setTimeout(expire, timeoutMs);
          idle.unref?.();
          try {
            const part = await reader.read();
            if (part.done) controller.close();
            else controller.enqueue(part.value);
          } catch (error) {
            controller.error(deadline.signal.aborted && !requestOptions.signal?.aborted ? deadline.signal.reason : error);
          } finally { clearTimeout(idle); }
        },
        cancel(reason) { return reader.cancel(reason); },
      });
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (source) {
      if (source instanceof ProviderError) throw source;
      const code = source?.code || source?.cause?.code;
      const error = new ProviderError(clean(source?.message || "providerRequestFailed"), { code, status: source?.status });
      error.name = source?.name || error.name;
      error.accepted = ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "ENETDOWN", "EHOSTDOWN", "EADDRNOTAVAIL", "UND_ERR_CONNECT_TIMEOUT"].includes(code) ? false : undefined;
      error.category = classifyError(error, phase);
      throw error;
    } finally {
      // Non-download responses keep their total deadline while the adapter
      // reads the JSON body; the timer is unref'd and harmless afterwards.
      if (timer && (streaming || deadline.signal.aborted)) clearTimeout(timer);
    }
  };
  return ctx;
}

async function parseJson(ctx, response, phase = "poll") {
  try {
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.length;
        if (bytes > 8 * 1024 * 1024) throw new Error("responseTooLarge");
        chunks.push(Buffer.from(part.value));
      }
    } finally { await reader.cancel(); }
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return ctx.redactValues ? ctx.redactValues(value) : value;
  } catch (error) { throw new ProviderError("invalidProviderResponse", { category: phase === "create" ? "unknown_outcome" : "transient" }); }
}

function requireRemoteId(id, redact = (value) => value) {
  if (typeof id !== "string" || !id.trim() || id.includes("[REDACTED]") || redact(id) !== id) throw new ProviderError("missingRemoteId", { category: "unknown_outcome" });
  return id;
}

module.exports = { ProviderError, validateKey, classifyError, normalizeParams, estimateCost, normalizeStatus, createContext, parseJson, requireRemoteId };
