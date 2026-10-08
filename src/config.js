const os = require("node:os");
const path = require("node:path");

function readPort() {
  const rawPort = process.env.PORT || "5177";
  const parsedPort = Number(rawPort);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }
  return parsedPort;
}

const PORT = readPort();
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const HOME_DIR = os.homedir();
const DEFAULT_OUTPUT_DIR = path.join(HOME_DIR, "Downloads", "SoraVideos");
const DEFAULT_POLL_INTERVAL_SECONDS = 10;
const DEFAULT_POLL_INTERVAL_MS = DEFAULT_POLL_INTERVAL_SECONDS * 1000;
const DEFAULT_BATCH_POLL_INTERVAL_SECONDS = 15;
const DEFAULT_BATCH_POLL_INTERVAL_MS = DEFAULT_BATCH_POLL_INTERVAL_SECONDS * 1000;
const IDEMPOTENT_RETRY_LIMIT = 4;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;
const MAX_CONSECUTIVE_RETRY_EXHAUSTIONS = 3;
const STANDARD_VIDEO_RENDER_PROGRESS_MAX = 94;
const STANDARD_VIDEO_COMPLETED_PROGRESS = 96;
const STANDARD_VIDEO_DOWNLOAD_PROGRESS = 98;
const BATCH_JOB_PROGRESS_MAX = 35;
const BATCH_READING_RESULTS_PROGRESS = 36;
const BATCH_VIDEO_PROGRESS_START = 36;
const BATCH_VIDEO_PROGRESS_END = 96;
const OFFICIAL_BATCH_LIMITS = {
  maxRequests: 50000,
  maxInputFileBytes: 200 * 1024 * 1024,
};
const MAX_BATCH_REQUESTS = OFFICIAL_BATCH_LIMITS.maxRequests;
const MAX_BATCH_INPUT_FILE_BYTES = OFFICIAL_BATCH_LIMITS.maxInputFileBytes;
const MAX_BATCH_RESULT_PATHS = 20;

const OFFICIAL_SECONDS = ["4", "8", "12", "16", "20"];
const OFFICIAL_MODELS = {
  "sora-2": {
    label: "Sora 2",
    value: "sora-2",
    sizes: [
      { value: "720x1280", label: "720 x 1280 竖屏" },
      { value: "1280x720", label: "1280 x 720 横屏" },
    ],
  },
  "sora-2-pro": {
    label: "Sora 2 Pro",
    value: "sora-2-pro",
    sizes: [
      { value: "720x1280", label: "720 x 1280 竖屏" },
      { value: "1280x720", label: "1280 x 720 横屏" },
      { value: "1024x1792", label: "1024 x 1792 竖屏" },
      { value: "1792x1024", label: "1792 x 1024 横屏" },
      { value: "1080x1920", label: "1080 x 1920 竖屏" },
      { value: "1920x1080", label: "1920 x 1080 横屏" },
    ],
  },
};
const OFFICIAL_PRICING = {
  currency: "USD",
  unit: "second",
  standard: {
    "sora-2": {
      "720x1280": 0.1,
      "1280x720": 0.1,
    },
    "sora-2-pro": {
      "720x1280": 0.3,
      "1280x720": 0.3,
      "1024x1792": 0.5,
      "1792x1024": 0.5,
      "1080x1920": 0.7,
      "1920x1080": 0.7,
    },
  },
};
const MODEL_OPTIONS = Object.fromEntries(
  Object.entries(OFFICIAL_MODELS).map(([model, config]) => [
    model,
    {
      label: config.label,
      sizes: new Set(config.sizes.map((size) => size.value)),
    },
  ]),
);
const ALLOWED_SECONDS = new Set(OFFICIAL_SECONDS);
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "expired"]);
const BATCH_TERMINAL_STATUSES = new Set(["completed", "failed", "expired", "cancelled"]);
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_IMAGE_REFERENCE_BYTES = 25 * 1024 * 1024;
const MAX_MULTIPART_OVERHEAD_BYTES = 256 * 1024;
const MAX_MULTIPART_BYTES = MAX_JSON_BYTES + MAX_IMAGE_REFERENCE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;
const IMAGE_REFERENCE_FILE_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
const SUPPORTED_REFERENCE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

module.exports = {
  readPort,
  PORT,
  ROOT,
  PUBLIC_DIR,
  HOME_DIR,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_BATCH_POLL_INTERVAL_SECONDS,
  DEFAULT_BATCH_POLL_INTERVAL_MS,
  IDEMPOTENT_RETRY_LIMIT,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
  MAX_CONSECUTIVE_RETRY_EXHAUSTIONS,
  STANDARD_VIDEO_RENDER_PROGRESS_MAX,
  STANDARD_VIDEO_COMPLETED_PROGRESS,
  STANDARD_VIDEO_DOWNLOAD_PROGRESS,
  BATCH_JOB_PROGRESS_MAX,
  BATCH_READING_RESULTS_PROGRESS,
  BATCH_VIDEO_PROGRESS_START,
  BATCH_VIDEO_PROGRESS_END,
  OFFICIAL_BATCH_LIMITS,
  MAX_BATCH_REQUESTS,
  MAX_BATCH_INPUT_FILE_BYTES,
  MAX_BATCH_RESULT_PATHS,
  OFFICIAL_SECONDS,
  OFFICIAL_MODELS,
  OFFICIAL_PRICING,
  MODEL_OPTIONS,
  ALLOWED_SECONDS,
  TERMINAL_STATUSES,
  BATCH_TERMINAL_STATUSES,
  MAX_JSON_BYTES,
  MAX_IMAGE_REFERENCE_BYTES,
  MAX_MULTIPART_OVERHEAD_BYTES,
  MAX_MULTIPART_BYTES,
  IMAGE_REFERENCE_FILE_EXPIRY_SECONDS,
  SUPPORTED_REFERENCE_IMAGE_TYPES,
};
