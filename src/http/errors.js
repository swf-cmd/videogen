const { HOME_DIR } = require("../config");
const { normalizeDirectoryPath } = require("../files/output");
const { redactDiagnostics } = require("../queue/keys");

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
const HOME_PATTERN = (() => {
  const home = normalizeDirectoryPath(HOME_DIR);
  // A root or drive-root home (some service accounts) would rewrite every
  // separator; and /home/al must not match inside /home/alice.
  if (!home || home === require("node:path").parse(home).root) return null;
  return new RegExp(`${escapeRegExp(home)}(?=$|[\\\\/\\s"'),;:\\]])`, "g");
})();

function redactLocalPaths(value, depth = 0) {
  if (typeof value === "string") return HOME_PATTERN ? value.replace(HOME_PATTERN, "~") : value;
  if (!value || typeof value !== "object") return value;
  if (depth > 30) return "[Truncated]";
  if (Array.isArray(value)) return value.map((item) => redactLocalPaths(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactLocalPaths(item, depth + 1)]),
  );
}

function safeError(error) {
  return redactLocalPaths(redactDiagnostics({
    message: error instanceof Error ? error.message : String(error),
    details: error && typeof error === "object" && "details" in error ? error.details : undefined,
  }));
}

module.exports = {
  redactLocalPaths,
  safeError,
};
