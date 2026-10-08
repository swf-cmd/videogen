const { parseRetryAfterMs } = require("./retry");

/**
 * Adapters translate requests only; the caller owns persistence and scheduling.
 * create(ctx, job, {idempotencyKey, signal}) returns {remoteId, pollingUrl?, status}.
 * poll(ctx, job, {signal}) returns {status, progress?, result?, error?}.
 * Result is {url, needsAuth, contentType?, expiresAt?}; download returns a Response.
 * ctx.assets holds ephemeral {buffer, mimeType, filename} uploads, never credentials.
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
  if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "UND_ERR_CONNECT_TIMEOUT"].includes(code)) return "transient";
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
    }
  }
  if (rate === null || !Number.isFinite(amount) || amount < 0) return unknown;
  return { amount: Math.round(amount * 1000000) / 1000000, currency: pricing.currency, basis: pricing.unit };
}

function normalizeStatus(status) {
  const states = { pending: "queued", queued: "queued", in_progress: "running", running: "running", completed: "succeeded", succeeded: "succeeded", failed: "failed", cancelled: "cancelled", canceled: "cancelled", expired: "expired", unknown: "expired" };
  return states[String(status || "").toLowerCase()] || "running";
}

function createContext({ lane, key = "", catalog, fetchImpl = globalThis.fetch, redact = (value) => value, assets = [], log = () => {} }) {
  const base = new URL(lane.baseUrl);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new ProviderError("invalidBaseUrl", { category: "invalid_request", accepted: false });
  const clean = (value) => {
    let result = String(redact(String(value)));
    if (key) result = result.split(key).join("[REDACTED]");
    return result.replace(/((?:authorization|x-goog-api-key|api-key)["'\s:=]+)(?:Bearer\s+)?[^\s,"'}]+/gi, "$1[REDACTED]");
  };
  const ctx = { lane, key, catalog, assets, redact: clean, log: (...values) => log(...values.map(clean)) };
  ctx.fetch = async (path, options = {}) => {
    const { needsAuth = true, timeoutMs = 60000, phase = "poll", ...requestOptions } = options;
    let url = new URL(path, `${base.href.replace(/\/$/, "")}/`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || [...url.searchParams.keys()].some((name) => /^(?:key|api_key|api-key|token|authorization)$/i.test(name))) throw new ProviderError("unsafeProviderUrl", { category: "invalid_request", accepted: false });
    if (needsAuth && url.origin !== base.origin) throw new ProviderError("unsafeProviderUrl", { category: "invalid_request", accepted: false });
    const headers = new Headers(requestOptions.headers || {});
    for (const name of ["authorization", "x-goog-api-key", "api-key"]) headers.delete(name);
    if (needsAuth && key) headers.set(lane.provider === "gemini" ? "x-goog-api-key" : "authorization", lane.provider === "gemini" ? key : `Bearer ${key}`);
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = requestOptions.signal ? AbortSignal.any([timeout, requestOptions.signal]) : timeout;
    try {
      let response;
      for (let redirect = 0; redirect < 6; redirect += 1) {
        response = await fetchImpl(url, { ...requestOptions, headers, signal, redirect: "manual" });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const next = response.headers.get("location");
        if (!next || !["GET", "HEAD"].includes((requestOptions.method || "GET").toUpperCase())) throw new ProviderError("unexpectedProviderRedirect", { category: phase === "create" ? "unknown_outcome" : "transient" });
        await response.body?.cancel();
        url = new URL(next, url);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (base.protocol === "https:" && url.protocol !== "https:")) throw new ProviderError("unsafeProviderUrl", { category: "invalid_request" });
        for (const name of ["authorization", "x-goog-api-key", "api-key"]) headers.delete(name);
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
      return response;
    } catch (source) {
      if (source instanceof ProviderError) throw source;
      const code = source?.code || source?.cause?.code;
      const error = new ProviderError(clean(source?.message || "providerRequestFailed"), { code, status: source?.status });
      error.name = source?.name || error.name;
      error.accepted = ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "UND_ERR_CONNECT_TIMEOUT"].includes(code) ? false : undefined;
      error.category = classifyError(error, phase);
      throw error;
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
    return JSON.parse(ctx.redact(Buffer.concat(chunks).toString("utf8")));
  } catch (error) { throw new ProviderError("invalidProviderResponse", { category: phase === "create" ? "unknown_outcome" : "transient" }); }
}

function requireRemoteId(id) {
  if (typeof id !== "string" || !id.trim()) throw new ProviderError("missingRemoteId", { category: "unknown_outcome" });
  return id;
}

module.exports = { ProviderError, validateKey, classifyError, normalizeParams, estimateCost, normalizeStatus, createContext, parseJson, requireRemoteId };
