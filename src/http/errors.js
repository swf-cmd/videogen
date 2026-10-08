const { HOME_DIR } = require("../config");
const { normalizeDirectoryPath } = require("../files/output");
const { redact } = require("../queue/keys");

function redactLocalPaths(value, depth = 0) {
  if (typeof value === "string") {
    const home = normalizeDirectoryPath(HOME_DIR);
    return value
      .replaceAll(home, "~")
      .replaceAll(HOME_DIR, "~");
  }
  if (!value || typeof value !== "object") return value;
  if (depth > 30) return "[Truncated]";
  if (Array.isArray(value)) return value.map((item) => redactLocalPaths(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactLocalPaths(item, depth + 1)]),
  );
}

function safeError(error) {
  return redactLocalPaths(redact({
    message: error instanceof Error ? error.message : String(error),
    details: error && typeof error === "object" && "details" in error ? error.details : undefined,
  }));
}

module.exports = {
  redactLocalPaths,
  safeError,
};
