const http = require("node:http");
const { execFile } = require("node:child_process");
const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const { URL } = require("node:url");

const execFileAsync = promisify(execFile);

function readPort() {
  const rawPort = process.env.PORT || "5177";
  const parsedPort = Number(rawPort);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }
  return parsedPort;
}

const PORT = readPort();
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const HOME_DIR = os.homedir();
const DEFAULT_OUTPUT_DIR = path.join(HOME_DIR, "Downloads", "SoraVideos");
const DEFAULT_OUTPUT_DIR_DISPLAY = "~/Downloads/SoraVideos";
const DEFAULT_POLL_INTERVAL_SECONDS = 10;
const DEFAULT_POLL_INTERVAL_MS = DEFAULT_POLL_INTERVAL_SECONDS * 1000;
const DEFAULT_BATCH_POLL_INTERVAL_SECONDS = 15;
const DEFAULT_BATCH_POLL_INTERVAL_MS = DEFAULT_BATCH_POLL_INTERVAL_SECONDS * 1000;
const OFFICIAL_BATCH_LIMITS = {
  maxRequests: 50000,
  maxInputFileBytes: 200 * 1024 * 1024,
};
const MAX_BATCH_REQUESTS = OFFICIAL_BATCH_LIMITS.maxRequests;
const MAX_BATCH_INPUT_FILE_BYTES = OFFICIAL_BATCH_LIMITS.maxInputFileBytes;

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
const SUPPORTED_LANGUAGES = new Set(["zh", "ja", "en", "ko"]);
const SERVER_MESSAGES = {
  zh: {
    requestTooLarge: "请求太大了，请缩短提示词或参数。",
    invalidJson: "请求 JSON 格式不正确。",
    invalidApiKey: "请输入有效的 OpenAI API key。",
    missingPrompt: "请输入视频提示词。",
    invalidModel: "模型只能选择 sora-2 或 sora-2-pro。",
    invalidSeconds: "时长只能选择 4、8、12、16 或 20 秒。",
    invalidSize: "{model} 支持的分辨率为：{sizes}。",
    invalidBatchCount: "Batch 提交条数必须是大于 0 的整数。",
    batchTooMany: "Batch 模式一次最多提交 {max} 条任务。",
    missingBatchPrompt: "请输入至少一条视频提示词。",
    promptQueueTooShort: "提示词队列只有 {count} 条，请降低提交条数；如需重复生成同一提示词，请只保留一条提示词。",
    selectDirUnsupported: "当前目录选择按钮只支持 macOS。",
    selectDirPrompt: "选择 Sora 视频输出目录",
    noDirSelected: "没有选择目录。",
    openaiRequestFailed: "OpenAI API 请求失败：HTTP {status}",
    openaiUploadFailed: "OpenAI 文件上传失败：HTTP {status}",
    batchLineFailed: "Batch 请求 {id} 失败。",
    batchInvalidResponse: "Batch 请求 {id} 没有返回有效响应。",
    batchHttpResponse: "Batch 请求 {id} 返回 HTTP {status}。",
    batchMissingVideoId: "Batch 请求 {id} 没有返回 video id。",
    batchVideoTerminal: "Batch 视频 {id} 结束状态为 {status}。",
    videoTerminal: "视频任务结束状态为 {status}",
    videoSubmitted: "已提交视频生成任务。",
    videoCreated: "任务已创建。",
    progressUpdated: "进度已更新。",
    videoDownloading: "视频已完成，正在下载 MP4。",
    savedMp4: "已保存 MP4。",
    batchInputTooLarge: "Batch 输入文件不能超过 200 MB，请减少提交条数或缩短提示词。",
    batchPrepared: "已准备 {count} 条 Batch 视频任务。",
    batchInputUploaded: "Batch 输入文件已上传。",
    batchCreated: "Batch 任务已创建。",
    batchProgressUpdated: "Batch 进度已更新。",
    batchTerminal: "Batch 任务结束状态为 {status}。",
    batchMissingOutput: "Batch 已完成，但没有返回输出文件。",
    batchReadingResults: "Batch 已完成，正在读取结果。",
    batchPartialFailed: "Batch 有 {count} 条请求失败，其余结果继续下载。",
    batchVideoCreated: "第 {index} 个视频任务已创建，等待渲染完成。",
    batchVideoProgress: "第 {index} 个视频进度已更新。",
    batchDownloadingMp4: "正在下载第 {index} 个 MP4。",
    batchVideoFailed: "第 {index} 个视频失败：{message}",
    batchAllFailed: "Batch 全部请求失败。",
    batchDoneWithFailures: "Batch 已保存 {count} 个 MP4，{failed} 条失败。",
    batchDone: "Batch 已保存 {count} 个 MP4。",
    missingApiKeyAndVideoId: "需要 API key 和 video id。",
  },
  ja: {
    requestTooLarge: "リクエストが大きすぎます。プロンプトまたは設定を短くしてください。",
    invalidJson: "リクエスト JSON の形式が正しくありません。",
    invalidApiKey: "有効な OpenAI API key を入力してください。",
    missingPrompt: "動画プロンプトを入力してください。",
    invalidModel: "モデルは sora-2 または sora-2-pro のみ選択できます。",
    invalidSeconds: "長さは 4、8、12、16、20 秒のみ選択できます。",
    invalidSize: "{model} が対応する解像度は {sizes} です。",
    invalidBatchCount: "Batch 送信件数は 1 以上の整数にしてください。",
    batchTooMany: "Batch モードでは一度に最大 {max} 件まで送信できます。",
    missingBatchPrompt: "少なくとも1件の動画プロンプトを入力してください。",
    promptQueueTooShort: "プロンプトキューは {count} 件のみです。送信件数を減らしてください。同じプロンプトを繰り返す場合は、プロンプトを1件だけ残してください。",
    selectDirUnsupported: "フォルダ選択ボタンは現在 macOS のみ対応しています。",
    selectDirPrompt: "Sora 動画の出力フォルダを選択",
    noDirSelected: "フォルダが選択されていません。",
    openaiRequestFailed: "OpenAI API リクエスト失敗：HTTP {status}",
    openaiUploadFailed: "OpenAI ファイルアップロード失敗：HTTP {status}",
    batchLineFailed: "Batch リクエスト {id} が失敗しました。",
    batchInvalidResponse: "Batch リクエスト {id} は有効なレスポンスを返しませんでした。",
    batchHttpResponse: "Batch リクエスト {id} が HTTP {status} を返しました。",
    batchMissingVideoId: "Batch リクエスト {id} は video id を返しませんでした。",
    batchVideoTerminal: "Batch 動画 {id} の終了状態は {status} です。",
    videoTerminal: "動画タスクの終了状態は {status} です",
    videoSubmitted: "動画生成タスクを送信しました。",
    videoCreated: "タスクを作成しました。",
    progressUpdated: "進捗を更新しました。",
    videoDownloading: "動画が完了しました。MP4 をダウンロードしています。",
    savedMp4: "MP4 を保存しました。",
    batchInputTooLarge: "Batch 入力ファイルは 200 MB を超えられません。送信件数を減らすかプロンプトを短くしてください。",
    batchPrepared: "{count} 件の Batch 動画タスクを準備しました。",
    batchInputUploaded: "Batch 入力ファイルをアップロードしました。",
    batchCreated: "Batch タスクを作成しました。",
    batchProgressUpdated: "Batch 進捗を更新しました。",
    batchTerminal: "Batch タスクの終了状態は {status} です。",
    batchMissingOutput: "Batch は完了しましたが、出力ファイルが返されませんでした。",
    batchReadingResults: "Batch が完了しました。結果を読み取っています。",
    batchPartialFailed: "Batch で {count} 件のリクエストが失敗しました。残りの結果は続けてダウンロードします。",
    batchVideoCreated: "{index} 件目の動画タスクを作成しました。レンダリング完了を待っています。",
    batchVideoProgress: "{index} 件目の動画進捗を更新しました。",
    batchDownloadingMp4: "{index} 件目の MP4 をダウンロードしています。",
    batchVideoFailed: "{index} 件目の動画が失敗しました：{message}",
    batchAllFailed: "Batch の全リクエストが失敗しました。",
    batchDoneWithFailures: "Batch で {count} 個の MP4 を保存しました。{failed} 件失敗しました。",
    batchDone: "Batch で {count} 個の MP4 を保存しました。",
    missingApiKeyAndVideoId: "API key と video id が必要です。",
  },
  en: {
    requestTooLarge: "The request is too large. Shorten the prompt or parameters.",
    invalidJson: "The request JSON is invalid.",
    invalidApiKey: "Enter a valid OpenAI API key.",
    missingPrompt: "Enter a video prompt.",
    invalidModel: "Model must be sora-2 or sora-2-pro.",
    invalidSeconds: "Duration must be 4, 8, 12, 16, or 20 seconds.",
    invalidSize: "{model} supports these resolutions: {sizes}.",
    invalidBatchCount: "Batch request count must be an integer greater than 0.",
    batchTooMany: "Batch mode can submit up to {max} requests at once.",
    missingBatchPrompt: "Enter at least one video prompt.",
    promptQueueTooShort: "The prompt queue only has {count} prompts. Lower the request count; to repeat one prompt, keep only that prompt.",
    selectDirUnsupported: "The folder picker button currently supports macOS only.",
    selectDirPrompt: "Choose the Sora video output folder",
    noDirSelected: "No folder was selected.",
    openaiRequestFailed: "OpenAI API request failed: HTTP {status}",
    openaiUploadFailed: "OpenAI file upload failed: HTTP {status}",
    batchLineFailed: "Batch request {id} failed.",
    batchInvalidResponse: "Batch request {id} did not return a valid response.",
    batchHttpResponse: "Batch request {id} returned HTTP {status}.",
    batchMissingVideoId: "Batch request {id} did not return a video id.",
    batchVideoTerminal: "Batch video {id} ended with status {status}.",
    videoTerminal: "Video task ended with status {status}",
    videoSubmitted: "Submitted the video generation task.",
    videoCreated: "Task created.",
    progressUpdated: "Progress updated.",
    videoDownloading: "Video completed. Downloading MP4.",
    savedMp4: "Saved MP4.",
    batchInputTooLarge: "Batch input file cannot exceed 200 MB. Reduce the request count or shorten prompts.",
    batchPrepared: "Prepared {count} Batch video tasks.",
    batchInputUploaded: "Batch input file uploaded.",
    batchCreated: "Batch task created.",
    batchProgressUpdated: "Batch progress updated.",
    batchTerminal: "Batch task ended with status {status}.",
    batchMissingOutput: "Batch completed but did not return an output file.",
    batchReadingResults: "Batch completed. Reading results.",
    batchPartialFailed: "{count} Batch requests failed. Continuing to download the remaining results.",
    batchVideoCreated: "Video task {index} was created. Waiting for rendering to finish.",
    batchVideoProgress: "Video {index} progress updated.",
    batchDownloadingMp4: "Downloading MP4 {index}.",
    batchVideoFailed: "Video {index} failed: {message}",
    batchAllFailed: "All Batch requests failed.",
    batchDoneWithFailures: "Batch saved {count} MP4 files, with {failed} failures.",
    batchDone: "Batch saved {count} MP4 files.",
    missingApiKeyAndVideoId: "API key and video id are required.",
  },
  ko: {
    requestTooLarge: "요청이 너무 큽니다. 프롬프트 또는 매개변수를 줄여 주세요.",
    invalidJson: "요청 JSON 형식이 올바르지 않습니다.",
    invalidApiKey: "유효한 OpenAI API key 를 입력하세요.",
    missingPrompt: "동영상 프롬프트를 입력하세요.",
    invalidModel: "모델은 sora-2 또는 sora-2-pro 만 선택할 수 있습니다.",
    invalidSeconds: "길이는 4, 8, 12, 16, 20초만 선택할 수 있습니다.",
    invalidSize: "{model} 이 지원하는 해상도는 {sizes} 입니다.",
    invalidBatchCount: "Batch 제출 수는 0보다 큰 정수여야 합니다.",
    batchTooMany: "Batch 모드는 한 번에 최대 {max}개까지 제출할 수 있습니다.",
    missingBatchPrompt: "동영상 프롬프트를 하나 이상 입력하세요.",
    promptQueueTooShort: "프롬프트 대기열에는 {count}개만 있습니다. 제출 수를 줄여 주세요. 같은 프롬프트를 반복하려면 프롬프트 하나만 남겨 주세요.",
    selectDirUnsupported: "폴더 선택 버튼은 현재 macOS 에서만 지원됩니다.",
    selectDirPrompt: "Sora 동영상 출력 폴더 선택",
    noDirSelected: "폴더가 선택되지 않았습니다.",
    openaiRequestFailed: "OpenAI API 요청 실패: HTTP {status}",
    openaiUploadFailed: "OpenAI 파일 업로드 실패: HTTP {status}",
    batchLineFailed: "Batch 요청 {id} 이 실패했습니다.",
    batchInvalidResponse: "Batch 요청 {id} 이 유효한 응답을 반환하지 않았습니다.",
    batchHttpResponse: "Batch 요청 {id} 이 HTTP {status} 를 반환했습니다.",
    batchMissingVideoId: "Batch 요청 {id} 이 video id 를 반환하지 않았습니다.",
    batchVideoTerminal: "Batch 동영상 {id} 의 종료 상태는 {status} 입니다.",
    videoTerminal: "동영상 작업 종료 상태는 {status} 입니다",
    videoSubmitted: "동영상 생성 작업을 제출했습니다.",
    videoCreated: "작업이 생성되었습니다.",
    progressUpdated: "진행률이 업데이트되었습니다.",
    videoDownloading: "동영상이 완료되었습니다. MP4 를 다운로드하는 중입니다.",
    savedMp4: "MP4 를 저장했습니다.",
    batchInputTooLarge: "Batch 입력 파일은 200 MB 를 초과할 수 없습니다. 제출 수를 줄이거나 프롬프트를 짧게 해 주세요.",
    batchPrepared: "Batch 동영상 작업 {count}개를 준비했습니다.",
    batchInputUploaded: "Batch 입력 파일을 업로드했습니다.",
    batchCreated: "Batch 작업이 생성되었습니다.",
    batchProgressUpdated: "Batch 진행률이 업데이트되었습니다.",
    batchTerminal: "Batch 작업 종료 상태는 {status} 입니다.",
    batchMissingOutput: "Batch 가 완료되었지만 출력 파일을 반환하지 않았습니다.",
    batchReadingResults: "Batch 가 완료되었습니다. 결과를 읽는 중입니다.",
    batchPartialFailed: "Batch 요청 {count}개가 실패했습니다. 나머지 결과는 계속 다운로드합니다.",
    batchVideoCreated: "{index}번째 동영상 작업이 생성되었습니다. 렌더링 완료를 기다리는 중입니다.",
    batchVideoProgress: "{index}번째 동영상 진행률이 업데이트되었습니다.",
    batchDownloadingMp4: "{index}번째 MP4 를 다운로드하는 중입니다.",
    batchVideoFailed: "{index}번째 동영상 실패: {message}",
    batchAllFailed: "Batch 요청이 모두 실패했습니다.",
    batchDoneWithFailures: "Batch 에서 MP4 {count}개를 저장했고 {failed}개가 실패했습니다.",
    batchDone: "Batch 에서 MP4 {count}개를 저장했습니다.",
    missingApiKeyAndVideoId: "API key 와 video id 가 필요합니다.",
  },
};

function normalizeLanguage(language) {
  const base = String(language || "").toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.has(base) ? base : "zh";
}

function languageFromRequest(req) {
  return normalizeLanguage(req.headers["x-sora-language"]);
}

function languageFromPayload(payload, fallback = "zh") {
  return normalizeLanguage(payload?.language || fallback);
}

function st(language, key, replacements = {}) {
  const template = SERVER_MESSAGES[normalizeLanguage(language)]?.[key] || SERVER_MESSAGES.zh[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(replacements[name] ?? ""));
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function redactLocalPaths(value) {
  if (typeof value === "string") {
    return value.split(HOME_DIR).join("~");
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactLocalPaths(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactLocalPaths(item)]),
    );
  }
  return value;
}

function safeError(error) {
  return {
    message: redactLocalPaths(error instanceof Error ? error.message : String(error)),
    details: error && typeof error === "object" && "details" in error ? redactLocalPaths(error.details) : undefined,
  };
}

function writeNdjson(res, event) {
  res.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

async function readJson(req, language = "zh") {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    chunks.push(chunk);
    totalBytes += chunk.length;
    if (totalBytes > MAX_JSON_BYTES) {
      throw new Error(st(language, "requestTooLarge"));
    }
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new Error(st(language, "invalidJson"));
  }
}

function expandHome(inputPath) {
  if (!inputPath || inputPath === "~") return os.homedir();
  if (inputPath.startsWith("~/")) return path.join(os.homedir(), inputPath.slice(2));
  return inputPath;
}

function sanitizeFilename(name) {
  const base = path.basename(String(name || "").trim());
  const fallback = `sora-${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`;
  const cleaned = (base || fallback).replace(/[<>:"/\\|?*\x00-\x1f]/g, "-");
  return cleaned.toLowerCase().endsWith(".mp4") ? cleaned : `${cleaned}.mp4`;
}

function appendFilenameIndex(filename, index) {
  const ext = path.extname(filename);
  const stem = ext ? filename.slice(0, -ext.length) : filename;
  return `${stem}-${String(index + 1).padStart(2, "0")}${ext || ".mp4"}`;
}

function resolveOutputPath(outputDir, filename) {
  const dir = path.resolve(ROOT, expandHome(String(outputDir || DEFAULT_OUTPUT_DIR).trim()));
  return {
    dir,
    filePath: path.join(dir, sanitizeFilename(filename)),
  };
}

function fileOutput(filePath, bytes, extra = {}) {
  return {
    ...extra,
    path: redactLocalPaths(filePath),
    bytes,
  };
}

function resolveBatchOutputPath(outputDir, filename, index, total, fallbackName) {
  if (total <= 1) return resolveOutputPath(outputDir, filename || fallbackName);
  const baseName = filename ? appendFilenameIndex(sanitizeFilename(filename), index) : `${fallbackName}.mp4`;
  return resolveOutputPath(outputDir, baseName);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateGeneratePayload(payload, fallbackLanguage = "zh") {
  const language = languageFromPayload(payload, fallbackLanguage);
  const apiKey = String(payload.apiKey || "").trim();
  const prompt = String(payload.prompt || "").trim();
  const model = String(payload.model || "sora-2").trim();
  const seconds = String(payload.seconds || "4").trim();
  const size = String(payload.size || "720x1280").trim();
  const batchCount = payload.batchCount;
  const filename = String(payload.filename || "").trim();
  const outputDir = String(payload.outputDir || DEFAULT_OUTPUT_DIR).trim();

  if (!apiKey.startsWith("sk-")) {
    throw new Error(st(language, "invalidApiKey"));
  }
  if (!prompt) {
    throw new Error(st(language, "missingPrompt"));
  }
  if (!MODEL_OPTIONS[model]) {
    throw new Error(st(language, "invalidModel"));
  }
  if (!ALLOWED_SECONDS.has(seconds)) {
    throw new Error(st(language, "invalidSeconds"));
  }
  if (!MODEL_OPTIONS[model].sizes.has(size)) {
    const supportedSizes = [...MODEL_OPTIONS[model].sizes].join("、");
    throw new Error(st(language, "invalidSize", { model: MODEL_OPTIONS[model].label, sizes: supportedSizes }));
  }

  return { language, apiKey, prompt, model, seconds, size, batchCount, filename, outputDir };
}

function parseBatchCount(value, defaultCount = 1, language = "zh") {
  if (value === undefined || value === null || String(value).trim() === "") return defaultCount;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(st(language, "invalidBatchCount"));
  }
  if (count > MAX_BATCH_REQUESTS) {
    throw new Error(st(language, "batchTooMany", { max: MAX_BATCH_REQUESTS }));
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

function officialOptionsPayload() {
  return {
    defaults: {
      model: "sora-2",
      seconds: "4",
      size: "720x1280",
    },
    seconds: OFFICIAL_SECONDS,
    models: Object.values(OFFICIAL_MODELS),
    pricing: OFFICIAL_PRICING,
    batch: OFFICIAL_BATCH_LIMITS,
  };
}

function isAppleScriptCancel(error) {
  const text = [error?.message, error?.stdout, error?.stderr].filter(Boolean).join("\n");
  return /user canceled|cancelled|canceled|\(-128\)/i.test(text);
}

function normalizeDirectoryPath(inputPath) {
  const resolved = path.resolve(inputPath);
  const root = path.parse(resolved).root;
  return resolved === root ? resolved : resolved.replace(/[\\/]+$/, "");
}

async function handleSelectOutputDir(req, res) {
  const language = languageFromRequest(req);
  if (process.platform !== "darwin") {
    sendJson(res, 400, { ok: false, error: { message: st(language, "selectDirUnsupported") } });
    return;
  }

  try {
    const { stdout } = await execFileAsync("/usr/bin/osascript", [
      "-e",
      `POSIX path of (choose folder with prompt ${JSON.stringify(st(language, "selectDirPrompt"))})`,
    ], { timeout: 120000 });
    const selectedPath = stdout.trim();
    if (!selectedPath) {
      throw new Error(st(language, "noDirSelected"));
    }
    sendJson(res, 200, { ok: true, path: normalizeDirectoryPath(selectedPath) });
  } catch (error) {
    if (isAppleScriptCancel(error)) {
      sendJson(res, 200, { ok: true, canceled: true });
      return;
    }
    sendJson(res, 500, { ok: false, error: safeError(error) });
  }
}

async function openaiRequest(apiKey, url, options = {}, language = "zh") {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let details = text;
    try {
      details = JSON.parse(text);
    } catch {
      // Keep plain text details.
    }
    const message = details?.error?.message || st(language, "openaiRequestFailed", { status: response.status });
    const error = new Error(message);
    error.details = details;
    throw error;
  }

  return response;
}

async function createVideo(apiKey, payload) {
  const response = await openaiRequest(apiKey, "https://api.openai.com/v1/videos", {
    method: "POST",
    body: JSON.stringify({
      model: payload.model,
      prompt: payload.prompt,
      seconds: payload.seconds,
      size: payload.size,
    }),
  }, payload.language);
  return response.json();
}

async function retrieveVideo(apiKey, videoId, language = "zh") {
  const response = await openaiRequest(apiKey, `https://api.openai.com/v1/videos/${encodeURIComponent(videoId)}`, {}, language);
  return response.json();
}

async function downloadVideo(apiKey, videoId, filePath, language = "zh") {
  const response = await openaiRequest(apiKey, `https://api.openai.com/v1/videos/${encodeURIComponent(videoId)}/content`, {}, language);
  const arrayBuffer = await response.arrayBuffer();
  await fsp.writeFile(filePath, Buffer.from(arrayBuffer));
}

async function uploadBatchInputFile(apiKey, jsonl, language = "zh") {
  const form = new FormData();
  form.append("purpose", "batch");
  form.append("file", new Blob([jsonl], { type: "application/jsonl" }), "sora2-batch-input.jsonl");

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    let details = text;
    try {
      details = JSON.parse(text);
    } catch {
      // Keep plain text details.
    }
    const message = details?.error?.message || st(language, "openaiUploadFailed", { status: response.status });
    const error = new Error(message);
    error.details = details;
    throw error;
  }

  return response.json();
}

async function createBatch(apiKey, inputFileId, language = "zh") {
  const response = await openaiRequest(apiKey, "https://api.openai.com/v1/batches", {
    method: "POST",
    body: JSON.stringify({
      input_file_id: inputFileId,
      endpoint: "/v1/videos",
      completion_window: "24h",
      metadata: {
        app: "sora2app",
      },
    }),
  }, language);
  return response.json();
}

async function retrieveBatch(apiKey, batchId, language = "zh") {
  const response = await openaiRequest(apiKey, `https://api.openai.com/v1/batches/${encodeURIComponent(batchId)}`, {}, language);
  return response.json();
}

async function downloadFileText(apiKey, fileId, language = "zh") {
  const response = await openaiRequest(apiKey, `https://api.openai.com/v1/files/${encodeURIComponent(fileId)}/content`, {}, language);
  return response.text();
}

function batchProgress(batch) {
  const counts = batch?.request_counts || {};
  if (counts.total > 0) {
    return Math.round(((counts.completed || 0) + (counts.failed || 0)) / counts.total * 92);
  }
  return batch?.status === "validating" ? 12 : 5;
}

function buildBatchInputLines(payload, prompts) {
  const runId = crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now());
  return prompts.map((prompt, index) => {
    const customId = `sora2-${runId}-${String(index + 1).padStart(2, "0")}`;
    return {
      customId,
      prompt,
      line: JSON.stringify({
        custom_id: customId,
        method: "POST",
        url: "/v1/videos",
        body: {
          model: payload.model,
          prompt,
          seconds: payload.seconds,
          size: payload.size,
        },
      }),
    };
  });
}

function parseJsonl(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function videoFromBatchLine(line, language = "zh") {
  if (line.error) {
    const error = new Error(line.error.message || st(language, "batchLineFailed", { id: line.custom_id || "" }));
    error.details = line.error;
    throw error;
  }
  const statusCode = line.response?.status_code;
  if (typeof statusCode !== "number") {
    const error = new Error(st(language, "batchInvalidResponse", { id: line.custom_id || "" }));
    error.details = line;
    throw error;
  }
  if (statusCode < 200 || statusCode >= 300) {
    const error = new Error(line.response?.body?.error?.message || st(language, "batchHttpResponse", { id: line.custom_id || "", status: statusCode }));
    error.details = line.response?.body || line;
    throw error;
  }
  const video = line.response?.body;
  if (!video?.id) {
    const error = new Error(st(language, "batchMissingVideoId", { id: line.custom_id || "" }));
    error.details = line;
    throw error;
  }
  if (video.status && TERMINAL_STATUSES.has(video.status) && video.status !== "completed") {
    const error = new Error(video.error?.message || st(language, "batchVideoTerminal", { id: video.id, status: video.status }));
    error.details = video;
    throw error;
  }
  return video;
}

async function waitForCompletedVideo(apiKey, initialVideo, onProgress, language = "zh") {
  let video = initialVideo;
  while (!TERMINAL_STATUSES.has(video.status)) {
    await sleep(DEFAULT_POLL_INTERVAL_MS);
    video = await retrieveVideo(apiKey, video.id, language);
    onProgress?.(video);
  }
  if (video.status !== "completed") {
    const errorMessage = video.error?.message || st(language, "videoTerminal", { status: video.status });
    const error = new Error(errorMessage);
    error.details = video;
    throw error;
  }
  return video;
}

async function handleGenerate(req, res) {
  const requestLanguage = languageFromRequest(req);
  try {
    const payload = validateGeneratePayload(await readJson(req, requestLanguage), requestLanguage);
    const { dir, filePath } = resolveOutputPath(payload.outputDir, payload.filename);
    await fsp.mkdir(dir, { recursive: true });

    const events = [];
    const push = (message, extra = {}) => {
      events.push({ at: new Date().toISOString(), message, ...extra });
    };

    push(st(payload.language, "videoSubmitted"));
    let video = await createVideo(payload.apiKey, payload);
    push(st(payload.language, "videoCreated"), { id: video.id, status: video.status, progress: video.progress ?? 0 });

    while (!TERMINAL_STATUSES.has(video.status)) {
      await sleep(DEFAULT_POLL_INTERVAL_MS);
      video = await retrieveVideo(payload.apiKey, video.id, payload.language);
      push(st(payload.language, "progressUpdated"), { id: video.id, status: video.status, progress: video.progress ?? 0 });
    }

    if (video.status !== "completed") {
      const errorMessage = video.error?.message || st(payload.language, "videoTerminal", { status: video.status });
      const error = new Error(errorMessage);
      error.details = video;
      throw error;
    }

    push(st(payload.language, "videoDownloading"), { id: video.id, status: video.status, progress: 100 });
    await downloadVideo(payload.apiKey, video.id, filePath, payload.language);
    const stats = await fsp.stat(filePath);

    sendJson(res, 200, {
      ok: true,
      video,
      output: fileOutput(filePath, stats.size),
      events,
    });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: safeError(error) });
  }
}

async function handleGenerateStream(req, res) {
  const requestLanguage = languageFromRequest(req);
  res.writeHead(200, {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-store",
    connection: "keep-alive",
  });

  try {
    const payload = validateGeneratePayload(await readJson(req, requestLanguage), requestLanguage);
    const { dir, filePath } = resolveOutputPath(payload.outputDir, payload.filename);
    await fsp.mkdir(dir, { recursive: true });

    writeNdjson(res, { type: "status", message: st(payload.language, "videoSubmitted"), status: "queued", progress: 0 });
    let video = await createVideo(payload.apiKey, payload);
    writeNdjson(res, {
      type: "status",
      message: st(payload.language, "videoCreated"),
      id: video.id,
      status: video.status,
      progress: video.progress ?? 0,
    });

    while (!TERMINAL_STATUSES.has(video.status)) {
      await sleep(DEFAULT_POLL_INTERVAL_MS);
      video = await retrieveVideo(payload.apiKey, video.id, payload.language);
      writeNdjson(res, {
        type: "status",
        message: st(payload.language, "progressUpdated"),
        id: video.id,
        status: video.status,
        progress: video.progress ?? 0,
      });
    }

    if (video.status !== "completed") {
      const errorMessage = video.error?.message || st(payload.language, "videoTerminal", { status: video.status });
      const error = new Error(errorMessage);
      error.details = video;
      throw error;
    }

    writeNdjson(res, {
      type: "status",
      message: st(payload.language, "videoDownloading"),
      id: video.id,
      status: video.status,
      progress: 100,
    });
    await downloadVideo(payload.apiKey, video.id, filePath, payload.language);
    const stats = await fsp.stat(filePath);

    writeNdjson(res, {
      type: "done",
      message: st(payload.language, "savedMp4"),
      video,
      output: fileOutput(filePath, stats.size),
    });
  } catch (error) {
    writeNdjson(res, { type: "error", error: safeError(error) });
  } finally {
    res.end();
  }
}

async function handleGenerateBatchStream(req, res) {
  const requestLanguage = languageFromRequest(req);
  res.writeHead(200, {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-store",
    connection: "keep-alive",
  });

  try {
    const payload = validateGeneratePayload(await readJson(req, requestLanguage), requestLanguage);
    const prompts = parseBatchPrompts(payload.prompt, payload.batchCount, payload.language);
    const requests = buildBatchInputLines(payload, prompts);
    const jsonl = `${requests.map((request) => request.line).join("\n")}\n`;
    const jsonlBytes = Buffer.byteLength(jsonl, "utf8");
    if (jsonlBytes > MAX_BATCH_INPUT_FILE_BYTES) {
      throw new Error(st(payload.language, "batchInputTooLarge"));
    }

    const { dir } = resolveOutputPath(payload.outputDir, payload.filename || "batch-placeholder.mp4");
    await fsp.mkdir(dir, { recursive: true });

    writeNdjson(res, {
      type: "status",
      message: st(payload.language, "batchPrepared", { count: requests.length }),
      status: "uploading",
      progress: 4,
    });

    const inputFile = await uploadBatchInputFile(payload.apiKey, jsonl, payload.language);
    writeNdjson(res, {
      type: "status",
      message: st(payload.language, "batchInputUploaded"),
      inputFileId: inputFile.id,
      status: "uploaded",
      progress: 8,
    });

    let batch = await createBatch(payload.apiKey, inputFile.id, payload.language);
    writeNdjson(res, {
      type: "status",
      message: st(payload.language, "batchCreated"),
      batchId: batch.id,
      status: batch.status,
      progress: batchProgress(batch),
      requestCounts: batch.request_counts,
    });

    while (!BATCH_TERMINAL_STATUSES.has(batch.status)) {
      await sleep(DEFAULT_BATCH_POLL_INTERVAL_MS);
      batch = await retrieveBatch(payload.apiKey, batch.id, payload.language);
      writeNdjson(res, {
        type: "status",
        message: st(payload.language, "batchProgressUpdated"),
        batchId: batch.id,
        status: batch.status,
        progress: batchProgress(batch),
        requestCounts: batch.request_counts,
      });
    }

    if (batch.status !== "completed") {
      const error = new Error(st(payload.language, "batchTerminal", { status: batch.status }));
      error.details = batch;
      throw error;
    }
    if (!batch.output_file_id) {
      const error = new Error(st(payload.language, "batchMissingOutput"));
      error.details = batch;
      throw error;
    }

    writeNdjson(res, {
      type: "status",
      message: st(payload.language, "batchReadingResults"),
      batchId: batch.id,
      status: batch.status,
      progress: 94,
      requestCounts: batch.request_counts,
    });

    const outputText = await downloadFileText(payload.apiKey, batch.output_file_id, payload.language);
    const lines = parseJsonl(outputText);
    let failedLines = [];
    if ((batch.request_counts?.failed || 0) > 0 && batch.error_file_id) {
      failedLines = parseJsonl(await downloadFileText(payload.apiKey, batch.error_file_id, payload.language));
      writeNdjson(res, {
        type: "status",
        message: st(payload.language, "batchPartialFailed", { count: failedLines.length }),
        batchId: batch.id,
        status: "partial",
        progress: 94,
        requestCounts: batch.request_counts,
      });
    }
    const requestIndexByCustomId = new Map(requests.map((request, index) => [request.customId, index]));
    const outputs = [];
    const videos = [];

    for (const line of lines) {
      const index = requestIndexByCustomId.get(line.custom_id) ?? outputs.length;
      try {
        let video = videoFromBatchLine(line, payload.language);
        writeNdjson(res, {
          type: "status",
          message: st(payload.language, "batchVideoCreated", { index: index + 1 }),
          batchId: batch.id,
          id: video.id,
          status: video.status || "queued",
          progress: video.progress ?? 0,
        });

        video = await waitForCompletedVideo(payload.apiKey, video, (updatedVideo) => {
          writeNdjson(res, {
            type: "status",
            message: st(payload.language, "batchVideoProgress", { index: index + 1 }),
            batchId: batch.id,
            id: updatedVideo.id,
            status: updatedVideo.status,
            progress: updatedVideo.progress ?? 0,
          });
        }, payload.language);

        const { filePath } = resolveBatchOutputPath(payload.outputDir, payload.filename, index, requests.length, line.custom_id || video.id);
        writeNdjson(res, {
          type: "status",
          message: st(payload.language, "batchDownloadingMp4", { index: index + 1 }),
          batchId: batch.id,
          id: video.id,
          status: "downloading",
          progress: 95 + Math.round((outputs.length / Math.max(lines.length, 1)) * 4),
        });
        await downloadVideo(payload.apiKey, video.id, filePath, payload.language);
        const stats = await fsp.stat(filePath);
        videos.push(video);
        outputs.push({
          ...fileOutput(filePath, stats.size, {
            customId: line.custom_id,
            videoId: video.id,
          }),
        });
      } catch (error) {
        failedLines.push({
          custom_id: line.custom_id,
          error: safeError(error),
        });
        writeNdjson(res, {
          type: "status",
          message: st(payload.language, "batchVideoFailed", { index: index + 1, message: error.message }),
          batchId: batch.id,
          status: "failed",
          progress: 95,
        });
      }
    }

    if (outputs.length === 0 && failedLines.length > 0) {
      const firstError = failedLines[0]?.error;
      const error = new Error(firstError?.message || st(payload.language, "batchAllFailed"));
      error.details = failedLines;
      throw error;
    }

    writeNdjson(res, {
      type: "done",
      message: failedLines.length
        ? st(payload.language, "batchDoneWithFailures", { count: outputs.length, failed: failedLines.length })
        : st(payload.language, "batchDone", { count: outputs.length }),
      batch,
      videos,
      output: {
        count: outputs.length,
        failedCount: failedLines.length,
        paths: outputs.map((output) => output.path),
        files: outputs,
        errors: failedLines,
      },
    });
  } catch (error) {
    writeNdjson(res, { type: "error", error: safeError(error) });
  } finally {
    res.end();
  }
}

async function handleStatus(req, res) {
  const requestLanguage = languageFromRequest(req);
  try {
    const payload = await readJson(req, requestLanguage);
    const language = languageFromPayload(payload, requestLanguage);
    const apiKey = String(payload.apiKey || "").trim();
    const videoId = String(payload.videoId || "").trim();
    if (!apiKey || !videoId) throw new Error(st(language, "missingApiKeyAndVideoId"));
    const video = await retrieveVideo(apiKey, videoId, language);
    sendJson(res, 200, { ok: true, video });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: safeError(error) });
  }
}

async function handleDownload(req, res) {
  const requestLanguage = languageFromRequest(req);
  try {
    const payload = await readJson(req, requestLanguage);
    const language = languageFromPayload(payload, requestLanguage);
    const apiKey = String(payload.apiKey || "").trim();
    const videoId = String(payload.videoId || "").trim();
    if (!apiKey || !videoId) throw new Error(st(language, "missingApiKeyAndVideoId"));

    const { filePath } = resolveOutputPath(payload.outputDir, payload.filename || `${videoId}.mp4`);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await downloadVideo(apiKey, videoId, filePath, language);
    const stats = await fsp.stat(filePath);
    sendJson(res, 200, { ok: true, output: fileOutput(filePath, stats.size) });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: safeError(error) });
  }
}

function handleOptions(req, res) {
  sendJson(res, 200, officialOptionsPayload());
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
  }[ext] || "application/octet-stream";
}

async function serveStatic(req, res, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const resolved = path.resolve(PUBLIC_DIR, relativePath);
  const relativeToPublic = path.relative(PUBLIC_DIR, resolved);
  if (relativeToPublic.startsWith("..") || path.isAbsolute(relativeToPublic)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const data = await fsp.readFile(resolved);
    res.writeHead(200, { "content-type": contentTypeFor(resolved) });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "POST" && url.pathname === "/api/generate-batch-stream") return handleGenerateBatchStream(req, res);
  if (req.method === "POST" && url.pathname === "/api/generate-stream") return handleGenerateStream(req, res);
  if (req.method === "POST" && url.pathname === "/api/generate") return handleGenerate(req, res);
  if (req.method === "POST" && url.pathname === "/api/status") return handleStatus(req, res);
  if (req.method === "POST" && url.pathname === "/api/download") return handleDownload(req, res);
  if (req.method === "POST" && url.pathname === "/api/select-output-dir") return handleSelectOutputDir(req, res);
  if (req.method === "GET" && url.pathname === "/api/options") return handleOptions(req, res);
  if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res, url.pathname);
  res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
  res.end("Method not allowed");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Sora2App running at http://127.0.0.1:${PORT}`);
  console.log(`Default output folder: ${DEFAULT_OUTPUT_DIR_DISPLAY}`);
});
