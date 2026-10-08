const crypto = require("node:crypto");

const knownSecrets = new Set();
const sensitiveFields = new Set([
  "authorization", "proxyauthorization", "xgoogapikey", "xapikey", "apikey",
  "accesstoken", "refreshtoken", "clientsecret", "password",
]);

function keyError(code) {
  return Object.assign(new Error(code), { code });
}

function rememberSecret(value) {
  if (typeof value === "string" && value.length >= 16) knownSecrets.add(value);
}

function normalizeLane(lane) {
  const provider = String(lane?.provider || "");
  const region = String(lane?.region || "");
  const rawUrl = String(lane?.baseUrl || "");
  if (!provider || !region || !rawUrl || /[\s\x00-\x1f\x7f-\x9f]/.test(provider + region + rawUrl)) {
    throw keyError("invalidLane");
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw keyError("invalidLane");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || rawUrl.includes("?") || rawUrl.includes("#")) {
    throw keyError("invalidLane");
  }
  const baseUrl = url.href.replace(/\/+$/, "");
  const id = crypto.createHash("sha256").update(JSON.stringify([provider, region, baseUrl])).digest("hex").slice(0, 24);
  return { id, provider, region, baseUrl };
}

class KeyStore {
  #entries = new Map();

  set(lane, key, adapter) {
    if (typeof key !== "string" || /[\s\x00-\x1f\x7f-\x9f]/.test(key)) throw keyError("invalidKey");
    const normalized = normalizeLane(lane);
    if (typeof adapter?.validateKey !== "function") throw keyError("invalidKey");
    const validationError = adapter.validateKey(key);
    if (validationError !== null) throw keyError(typeof validationError === "string" ? validationError : "invalidKey");
    rememberSecret(key);
    this.#entries.set(normalized.id, { lane: normalized, key });
    return { ...normalized };
  }

  get(laneOrId) {
    const id = typeof laneOrId === "string" ? laneOrId : normalizeLane(laneOrId).id;
    return this.#entries.get(id)?.key;
  }

  delete(laneOrId) {
    const id = typeof laneOrId === "string" ? laneOrId : normalizeLane(laneOrId).id;
    return this.#entries.delete(id);
  }

  has(laneOrId) {
    const id = typeof laneOrId === "string" ? laneOrId : normalizeLane(laneOrId).id;
    return this.#entries.has(id);
  }

  list() {
    return [...this.#entries.values()].map(({ lane }) => ({ lane: { ...lane }, present: true }));
  }
}

function redactText(value) {
  let text = value;
  for (const secret of [...knownSecrets].sort((left, right) => right.length - left.length)) {
    text = text.replaceAll(secret, "[REDACTED]");
  }
  text = text.replace(/([a-z][a-z\d+.-]*:\/\/)[^/\s?#]*@/gi, "$1[REDACTED]@");
  return text.replace(
    /\b(authorization|proxy[-_]?authorization|x[-_]goog[-_]api[-_]key|x[-_]api[-_]key|api[-_]?key)(["']?\s*[:=]\s*)("[^"\r\n]*"|'[^'\r\n]*'|[^\r\n,;}]+)/gi,
    (_, field, separator, secret) => {
      const quote = /^["']/.test(secret) ? secret[0] : "";
      return `${field}${separator}${quote}[REDACTED]${quote}`;
    },
  );
}

function redact(value, seen = new WeakSet()) {
  if (typeof value === "string") return redactText(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => redact(item, seen));
    const entries = value instanceof Headers ? [...value.entries()] : Object.entries(value);
    return Object.fromEntries(entries.map(([key, item]) => [
      key,
      sensitiveFields.has(key.toLowerCase().replace(/[-_\s]/g, "")) ? "[REDACTED]" : redact(item, seen),
    ]));
  } finally {
    seen.delete(value);
  }
}

for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) {
  try {
    const url = new URL(process.env[name]);
    for (const value of [url.username, url.password]) {
      rememberSecret(value);
      rememberSecret(decodeURIComponent(value));
    }
  } catch {
    // Missing or malformed proxy settings have nothing to redact here.
  }
}

// Only diagnostic/provider-owned content receives substring redaction. User
// prompts, identifiers, paths, endpoints and model configurations are data.
function sanitizeRecord(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map(item => sanitizeRecord(item, seen));
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name,
      sensitiveFields.has(name.toLowerCase().replace(/[-_\s]/g, "")) ? "[REDACTED]"
        : ["error", "details", "message", "providerMessage"].includes(name) ? redact(item)
        : sanitizeRecord(item, seen),
    ]));
  } finally { seen.delete(value); }
}
module.exports = { normalizeLane, KeyStore, rememberSecret, redact, sanitizeRecord };
