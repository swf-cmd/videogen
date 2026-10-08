const os = require("node:os");
const path = require("node:path");

function readPort() {
  const rawPort = process.env.PORT || "5177";
  const parsedPort = Number(rawPort);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error("Invalid PORT value");
  }
  return parsedPort;
}

function dataDirectory() {
  if (process.env.VIDEOGEN_DATA_DIR) return path.resolve(process.env.VIDEOGEN_DATA_DIR);
  const home = os.homedir();
  if (process.platform === "darwin") return path.join(home, "Library", "Application Support", "videogen");
  if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "videogen");
  return path.join(process.env.XDG_DATA_HOME || path.join(home, ".local", "share"), "videogen");
}

const ROOT = path.resolve(__dirname, "..");
module.exports = {
  readPort, dataDirectory, ROOT, PORT: readPort(), PUBLIC_DIR: path.join(ROOT, "public"),
  HOME_DIR: os.homedir(), DEFAULT_OUTPUT_DIR: process.env.VIDEOGEN_OUTPUT_DIR ? path.resolve(process.env.VIDEOGEN_OUTPUT_DIR) : path.join(os.homedir(), "Downloads", "videogen"),
  IDEMPOTENT_RETRY_LIMIT: 4, RETRY_BASE_DELAY_MS: 1000, RETRY_MAX_DELAY_MS: 30000,
  MAX_JSON_BYTES: 1024 * 1024, MAX_BATCH_BYTES: 16 * 1024 * 1024,
  MAX_BATCH_UPLOAD_BYTES: 128 * 1024 * 1024,
  MAX_IMAGE_REFERENCE_BYTES: 25 * 1024 * 1024,
  SUPPORTED_REFERENCE_IMAGE_TYPES: new Set(["image/jpeg", "image/png", "image/webp"]),
};
