const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "../..");
const filename = path.join(root, "server.js");
const exportedNames = [
  "pngDimensions", "jpegDimensions", "webpDimensions", "imageDimensions",
  "normalizeInputReference", "sanitizeFilename", "appendFilenameIndex",
  "parseBatchPrompts", "parseRetryAfterMs", "isRetryableIdempotentError",
  "withIdempotentRetry", "serveStatic",
];

function loadLegacyServer(overrides = {}) {
  const source = fs.readFileSync(filename, "utf8");
  const boundary = source.indexOf("const server = http.createServer");
  if (boundary < 0) throw new Error("Server bootstrap boundary was not found");
  const context = vm.createContext({
    require: createRequire(filename),
    __dirname: root,
    process: { env: { PORT: "5177" } },
    Buffer,
    Blob,
    Date,
    URL,
    setTimeout,
    console,
    ...overrides,
  });
  return vm.runInContext(
    `${source.slice(0, boundary)}\n({ ${exportedNames.join(", ")} });`,
    context,
    { filename },
  );
}

module.exports = { loadLegacyServer, root };
