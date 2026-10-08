const { IDEMPOTENT_RETRY_LIMIT, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } = require("../config");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : undefined;
}

function isRetryableIdempotentError(error) {
  if (["transient", "rate_limited"].includes(error?.category)) return true;
  const status = Number(error?.status);
  if (Number.isInteger(status)) return status === 408 || status === 429 || status >= 500;
  if (["TypeError", "SyntaxError", "AbortError"].includes(error?.name)) return true;
  const code = String(error?.code || error?.cause?.code || "");
  return new Set([
    "ECONNRESET",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "ENOTFOUND",
    "ECONNREFUSED",
    "UND_ERR_SOCKET",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_BODY_TIMEOUT",
  ]).has(code);
}

async function withIdempotentRetry(operation) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableIdempotentError(error)) throw error;
      if (attempt >= IDEMPOTENT_RETRY_LIMIT) {
        error.retryExhausted = true;
        throw error;
      }
      const retryAfterMs = Number(error?.retryAfterMs);
      const delayMs = Number.isFinite(retryAfterMs) && retryAfterMs >= 0
        ? retryAfterMs
        : Math.min(RETRY_BASE_DELAY_MS * (2 ** attempt), RETRY_MAX_DELAY_MS);
      await sleep(delayMs);
    }
  }
}

module.exports = {
  sleep,
  parseRetryAfterMs,
  isRetryableIdempotentError,
  withIdempotentRetry,
};
