// Honor long provider cooldowns, but never beyond a week: an absurd value must
// not overflow Date arithmetic or park a paid job indefinitely.
const MAX_RETRY_AFTER_MS = 7 * 24 * 3600 * 1000;

function parseRetryAfterMs(value) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(MAX_RETRY_AFTER_MS, seconds * 1000);
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.min(MAX_RETRY_AFTER_MS, Math.max(0, retryAt - Date.now())) : undefined;
}

module.exports = { parseRetryAfterMs, MAX_RETRY_AFTER_MS };
