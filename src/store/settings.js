const fs = require("node:fs");
const path = require("node:path");
const { normalizeLane, redact } = require("../queue/keys");
const { syncDirectory } = require("./job-store");

function writeJson(directory, filename, value) {
  const target = path.join(directory, filename);
  const temporary = `${target}.tmp`;
  const fd = fs.openSync(temporary, "w", 0o600);
  try { fs.fchmodSync(fd, 0o600); fs.writeFileSync(fd, JSON.stringify(redact(value))); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temporary, target);
  syncDirectory(directory);
}

function normalizeSettings(value) {
  if (!value || typeof value !== "object" || !value.lanes || typeof value.lanes !== "object") throw new Error("invalidSettings");
  const lanes = {};
  for (const [id, entry] of Object.entries(value.lanes)) {
    const lane = normalizeLane(entry.lane);
    if (lane.id !== id || !Number.isInteger(entry.concurrency) || entry.concurrency < 1 || entry.concurrency > 1000) throw new Error("invalidSettings");
    lanes[id] = { lane, concurrency: entry.concurrency, paused: Boolean(entry.paused) };
  }
  return { lanes };
}

function readSettings(directory) {
  const filename = path.join(directory, "settings.json");
  if (!fs.existsSync(filename)) return { lanes: {} };
  return normalizeSettings(JSON.parse(fs.readFileSync(filename, "utf8")));
}

module.exports = { writeJson, readSettings, normalizeSettings };
