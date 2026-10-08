const { st } = require("../../i18n/server-messages");

function parseBatchCount(value, defaultCount = 1, language = "zh") {
  const rawCount = value === undefined || value === null || String(value).trim() === ""
    ? defaultCount
    : value;
  const count = Number(rawCount);
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error(st(language, "invalidBatchCount"));
  }
  return count;
}

function parseBatchPrompts(prompt, batchCount, language = "zh") {
  const prompts = String(prompt || "")
    .trim()
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (prompts.length === 0) {
    throw new Error(st(language, "missingBatchPrompt"));
  }
  const requestedCount = parseBatchCount(batchCount, prompts.length, language);
  if (prompts.length === 1) {
    return Array.from({ length: requestedCount }, () => prompts[0]);
  }
  if (requestedCount > prompts.length) {
    throw new Error(st(language, "promptQueueTooShort", { count: prompts.length }));
  }
  return prompts.slice(0, requestedCount);
}

module.exports = { parseBatchCount, parseBatchPrompts };
