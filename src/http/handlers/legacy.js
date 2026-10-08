const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");
const {
  DEFAULT_OUTPUT_DIR,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_BATCH_POLL_INTERVAL_MS,
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
  MAX_MULTIPART_BYTES,
  IMAGE_REFERENCE_FILE_EXPIRY_SECONDS,
} = require("../../config");
const { languageFromRequest, languageFromPayload, st } = require("../../i18n/server-messages");
const { normalizeInputReference } = require("../../media/image");
const {
  resolveOutputPath,
  resolveBatchOutputPath,
  assertOutputFileAvailable,
  assertBatchOutputFilesAvailable,
  displayPathForUser,
  outputInfoForUser,
} = require("../../files/output");
const { safeError } = require("../errors");
const { sleep, parseRetryAfterMs, withIdempotentRetry } = require("../../providers/retry");
const { sendJson, writeNdjson } = require("../responses");

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

function isMultipartRequest(req) {
  return /^multipart\/form-data\b/i.test(String(req.headers["content-type"] || ""));
}

function requestHeaders(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

async function readMultipartForm(req, language = "zh") {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
    throw new Error(st(language, "requestTooLarge"));
  }

  const request = new Request("http://127.0.0.1/", {
    method: req.method,
    headers: requestHeaders(req),
    body: req,
    duplex: "half",
  });
  return request.formData();
}

function formText(form, name) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function formFile(form, name) {
  const value = form.get(name);
  if (!value || typeof value !== "object") return null;
  if (typeof value.arrayBuffer !== "function" || typeof value.size !== "number") return null;
  return value.size > 0 ? value : null;
}

function rawPayloadFromForm(form) {
  return {
    language: formText(form, "language"),
    apiKey: formText(form, "apiKey"),
    prompt: formText(form, "prompt"),
    model: formText(form, "model"),
    seconds: formText(form, "seconds"),
    size: formText(form, "size"),
    batchCount: formText(form, "batchCount"),
    filename: formText(form, "filename"),
    outputDir: formText(form, "outputDir"),
  };
}

async function readGenerateRequest(req, fallbackLanguage = "zh") {
  if (!isMultipartRequest(req)) {
    return {
      payload: validateGeneratePayload(await readJson(req, fallbackLanguage), fallbackLanguage),
      inputReference: null,
    };
  }

  const form = await readMultipartForm(req, fallbackLanguage);
  const payload = validateGeneratePayload(rawPayloadFromForm(form), fallbackLanguage);
  const inputReference = await normalizeInputReference(formFile(form, "input_reference"), payload.size, payload.language);
  return { payload, inputReference };
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
  const rawCount = value === undefined || value === null || String(value).trim() === ""
    ? defaultCount
    : value;
  const count = Number(rawCount);
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

async function openaiRequest(apiKey, url, options = {}, language = "zh") {
  const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(options.body && !isFormDataBody ? { "content-type": "application/json" } : {}),
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
    error.status = response.status;
    error.retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    throw error;
  }

  return response;
}

function videoJsonBody(payload) {
  const body = {
    model: payload.model,
    prompt: payload.prompt,
    seconds: payload.seconds,
    size: payload.size,
  };
  if (payload.inputReference) body.input_reference = payload.inputReference;
  return body;
}

function videoFormBody(payload, inputReference) {
  const form = new FormData();
  form.append("model", payload.model);
  form.append("prompt", payload.prompt);
  form.append("seconds", payload.seconds);
  form.append("size", payload.size);
  form.append(
    "input_reference",
    new Blob([inputReference.buffer], { type: inputReference.mimeType }),
    inputReference.filename,
  );
  return form;
}

async function createVideo(apiKey, payload, inputReference = null) {
  if (inputReference) {
    const response = await openaiRequest(apiKey, "https://api.openai.com/v1/videos", {
      method: "POST",
      body: videoFormBody(payload, inputReference),
    }, payload.language);
    return response.json();
  }

  const response = await openaiRequest(apiKey, "https://api.openai.com/v1/videos", {
    method: "POST",
    body: JSON.stringify(videoJsonBody(payload)),
  }, payload.language);
  return response.json();
}

async function retrieveVideo(apiKey, videoId, language = "zh") {
  return withIdempotentRetry(async () => {
    const response = await openaiRequest(apiKey, `https://api.openai.com/v1/videos/${encodeURIComponent(videoId)}`, {}, language);
    return response.json();
  });
}

async function downloadVideo(apiKey, videoId, filePath, language = "zh") {
  await assertOutputFileAvailable(filePath, language);
  const arrayBuffer = await withIdempotentRetry(async () => {
    const response = await openaiRequest(apiKey, `https://api.openai.com/v1/videos/${encodeURIComponent(videoId)}/content`, {}, language);
    return response.arrayBuffer();
  });
  let fileHandle;
  try {
    fileHandle = await fsp.open(filePath, "wx");
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(st(language, "outputFileExists", { path: displayPathForUser(filePath) }));
    }
    throw error;
  }

  try {
    await fileHandle.writeFile(Buffer.from(arrayBuffer));
    await fileHandle.close();
  } catch (error) {
    await fileHandle.close().catch(() => {});
    await fsp.unlink(filePath).catch(() => {});
    throw error;
  }
}

async function uploadBatchInputFile(apiKey, jsonlParts, language = "zh") {
  const form = new FormData();
  form.append("purpose", "batch");
  form.append("file", new Blob(jsonlParts, { type: "application/jsonl" }), "sora2-batch-input.jsonl");

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

async function uploadInputReferenceFile(apiKey, inputReference, language = "zh") {
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("expires_after[anchor]", "created_at");
  form.append("expires_after[seconds]", String(IMAGE_REFERENCE_FILE_EXPIRY_SECONDS));
  form.append(
    "file",
    new Blob([inputReference.buffer], { type: inputReference.mimeType }),
    inputReference.filename,
  );

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
  return withIdempotentRetry(async () => {
    const response = await openaiRequest(apiKey, `https://api.openai.com/v1/batches/${encodeURIComponent(batchId)}`, {}, language);
    return response.json();
  });
}

async function downloadJsonlFile(apiKey, fileId, language = "zh") {
  return withIdempotentRetry(async () => {
    const response = await openaiRequest(apiKey, `https://api.openai.com/v1/files/${encodeURIComponent(fileId)}/content`, {}, language);
    return parseJsonl(await response.text());
  });
}

function clampProgress(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function standardVideoProgress(video) {
  if (video?.status === "completed") return STANDARD_VIDEO_COMPLETED_PROGRESS;
  return Math.min(clampProgress(video?.progress), STANDARD_VIDEO_RENDER_PROGRESS_MAX);
}

function batchProgress(batch) {
  const counts = batch?.request_counts || {};
  const statusProgress = {
    validating: 8,
    in_progress: 14,
    finalizing: 30,
    completed: BATCH_JOB_PROGRESS_MAX,
  };
  const baseProgress = statusProgress[batch?.status] || 10;
  if (counts.total > 0) {
    const requestProgress = Math.round(((counts.completed || 0) + (counts.failed || 0)) / counts.total * BATCH_JOB_PROGRESS_MAX);
    return Math.max(baseProgress, requestProgress);
  }
  return baseProgress;
}

function batchVideoOverallProgress(index, total, videoProgress = 0) {
  const safeTotal = Math.max(1, Number(total) || 0);
  const safeIndex = Math.max(0, Math.min(safeTotal - 1, Number(index) || 0));
  const safeVideoProgress = clampProgress(videoProgress);
  const renderedShare = (safeIndex + safeVideoProgress / 100) / safeTotal;
  const progressRange = BATCH_VIDEO_PROGRESS_END - BATCH_VIDEO_PROGRESS_START;
  return Math.min(BATCH_VIDEO_PROGRESS_END, BATCH_VIDEO_PROGRESS_START + Math.round(renderedShare * progressRange));
}

function activeBatchVideoStatus(status) {
  return TERMINAL_STATUSES.has(status) ? "running" : status || "running";
}

function activeBatchStatus(status) {
  return status === "completed" ? "finalizing" : status || "running";
}

function buildBatchInput(payload, prompts) {
  const runId = crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now());
  const requests = [];
  const jsonlParts = [];
  let jsonlBytes = 0;

  for (const [index, prompt] of prompts.entries()) {
    const customId = `sora2-${runId}-${String(index + 1).padStart(2, "0")}`;
    const body = videoJsonBody({
      ...payload,
      prompt,
    });
    const line = JSON.stringify({
      custom_id: customId,
      method: "POST",
      url: "/v1/videos",
      body,
    });
    const lineBytes = Buffer.byteLength(line, "utf8") + 1;
    if (jsonlBytes + lineBytes > MAX_BATCH_INPUT_FILE_BYTES) {
      throw new Error(st(payload.language, "batchInputTooLarge"));
    }
    jsonlBytes += lineBytes;
    requests.push({ customId });
    jsonlParts.push(`${line}\n`);
  }

  return { requests, jsonlParts };
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
    const { payload, inputReference } = await readGenerateRequest(req, requestLanguage);
    const { dir, filePath } = resolveOutputPath(payload.outputDir, payload.filename);
    await fsp.mkdir(dir, { recursive: true });
    await assertOutputFileAvailable(filePath, payload.language);

    const events = [];
    const push = (message, extra = {}) => {
      events.push({ at: new Date().toISOString(), message, ...extra });
    };

    push(st(payload.language, "videoSubmitted"));
    if (inputReference) push(st(payload.language, "imageReferenceAttached"), { status: "uploading", progress: 1 });
    let video = await createVideo(payload.apiKey, payload, inputReference);
    push(st(payload.language, "videoCreated"), { id: video.id, status: video.status, progress: standardVideoProgress(video) });

    while (!TERMINAL_STATUSES.has(video.status)) {
      await sleep(DEFAULT_POLL_INTERVAL_MS);
      video = await retrieveVideo(payload.apiKey, video.id, payload.language);
      push(st(payload.language, "progressUpdated"), { id: video.id, status: video.status, progress: standardVideoProgress(video) });
    }

    if (video.status !== "completed") {
      const errorMessage = video.error?.message || st(payload.language, "videoTerminal", { status: video.status });
      const error = new Error(errorMessage);
      error.details = video;
      throw error;
    }

    push(st(payload.language, "videoDownloading"), { id: video.id, status: "downloading", progress: STANDARD_VIDEO_DOWNLOAD_PROGRESS });
    await downloadVideo(payload.apiKey, video.id, filePath, payload.language);
    const stats = await fsp.stat(filePath);

    sendJson(res, 200, {
      ok: true,
      video,
      output: outputInfoForUser(filePath, stats),
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
    const { payload, inputReference } = await readGenerateRequest(req, requestLanguage);
    const { dir, filePath } = resolveOutputPath(payload.outputDir, payload.filename);
    await fsp.mkdir(dir, { recursive: true });
    await assertOutputFileAvailable(filePath, payload.language);

    writeNdjson(res, { type: "status", message: st(payload.language, "videoSubmitted"), status: "queued", progress: 0 });
    if (inputReference) {
      writeNdjson(res, {
        type: "status",
        message: st(payload.language, "imageReferenceAttached"),
        status: "uploading",
        progress: 1,
      });
    }
    let video = await createVideo(payload.apiKey, payload, inputReference);
    writeNdjson(res, {
      type: "status",
      message: st(payload.language, "videoCreated"),
      id: video.id,
      status: video.status,
      progress: standardVideoProgress(video),
    });

    while (!TERMINAL_STATUSES.has(video.status)) {
      await sleep(DEFAULT_POLL_INTERVAL_MS);
      video = await retrieveVideo(payload.apiKey, video.id, payload.language);
      writeNdjson(res, {
        type: "status",
        message: st(payload.language, "progressUpdated"),
        id: video.id,
        status: video.status,
        progress: standardVideoProgress(video),
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
      status: "downloading",
      progress: STANDARD_VIDEO_DOWNLOAD_PROGRESS,
    });
    await downloadVideo(payload.apiKey, video.id, filePath, payload.language);
    const stats = await fsp.stat(filePath);

    writeNdjson(res, {
      type: "done",
      message: st(payload.language, "savedMp4"),
      video,
      output: outputInfoForUser(filePath, stats),
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
    const { payload, inputReference } = await readGenerateRequest(req, requestLanguage);
    const prompts = parseBatchPrompts(payload.prompt, payload.batchCount, payload.language);
    const { dir } = resolveOutputPath(payload.outputDir, payload.filename || "batch-placeholder.mp4");
    await fsp.mkdir(dir, { recursive: true });
    await assertBatchOutputFilesAvailable(payload, prompts.length);

    if (inputReference) {
      writeNdjson(res, {
        type: "status",
        message: st(payload.language, "imageReferenceUploading"),
        status: "uploading",
        progress: 2,
      });
      const uploadedReference = await uploadInputReferenceFile(payload.apiKey, inputReference, payload.language);
      payload.inputReference = { file_id: uploadedReference.id };
      writeNdjson(res, {
        type: "status",
        message: st(payload.language, "imageReferenceUploaded"),
        inputFileId: uploadedReference.id,
        status: "uploaded",
        progress: 3,
      });
    }

    const { requests, jsonlParts } = buildBatchInput(payload, prompts);
    prompts.length = 0;

    writeNdjson(res, {
      type: "status",
      message: st(payload.language, "batchPrepared", { count: requests.length }),
      status: "uploading",
      progress: 4,
    });

    let inputFile;
    try {
      inputFile = await uploadBatchInputFile(payload.apiKey, jsonlParts, payload.language);
    } finally {
      jsonlParts.length = 0;
    }
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
      status: activeBatchStatus(batch.status),
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
        status: activeBatchStatus(batch.status),
        progress: batchProgress(batch),
        requestCounts: batch.request_counts,
      });
    }

    if (batch.status !== "completed") {
      const error = new Error(st(payload.language, "batchTerminal", { status: batch.status }));
      error.details = batch;
      throw error;
    }
    if (!batch.output_file_id && !batch.error_file_id) {
      const error = new Error(st(payload.language, "batchMissingOutput"));
      error.details = batch;
      throw error;
    }

    writeNdjson(res, {
      type: "status",
      message: st(payload.language, "batchReadingResults"),
      batchId: batch.id,
      status: "finalizing",
      progress: BATCH_READING_RESULTS_PROGRESS,
      requestCounts: batch.request_counts,
    });

    const sortedLines = batch.output_file_id
      ? await downloadJsonlFile(payload.apiKey, batch.output_file_id, payload.language)
      : [];
    let failedCount = Math.max(0, Number(batch.request_counts?.failed) || 0);
    let failedSamples = [];
    let firstFailure = null;
    if (batch.error_file_id) {
      const batchFailures = await downloadJsonlFile(payload.apiKey, batch.error_file_id, payload.language);
      failedCount = Math.max(failedCount, batchFailures.length);
      firstFailure = batchFailures[0] || null;
      failedSamples = batchFailures.slice(0, MAX_BATCH_RESULT_PATHS);
      batchFailures.length = 0;
      if (failedCount > 0) {
        writeNdjson(res, {
          type: "status",
          message: st(payload.language, "batchPartialFailed", { count: failedCount }),
          batchId: batch.id,
          status: "partial",
          progress: BATCH_READING_RESULTS_PROGRESS,
          requestCounts: batch.request_counts,
        });
      }
    }
    if (sortedLines.length === 0 && failedCount === 0) {
      const error = new Error(st(payload.language, "batchMissingOutput"));
      error.details = batch;
      throw error;
    }
    const totalRequests = requests.length;
    const requestIndexByCustomId = new Map(requests.map((request, index) => [request.customId, index]));
    requests.length = 0;
    sortedLines.sort((a, b) => {
      const indexA = requestIndexByCustomId.get(a.custom_id) ?? Number.MAX_SAFE_INTEGER;
      const indexB = requestIndexByCustomId.get(b.custom_id) ?? Number.MAX_SAFE_INTEGER;
      return indexA - indexB;
    });
    let savedCount = 0;
    const outputPaths = [];
    let consecutiveRetryExhaustions = 0;
    let retryCircuitOpen = false;

    for (let position = 0; position < sortedLines.length; position += 1) {
      const line = sortedLines[position];
      sortedLines[position] = null;
      const index = requestIndexByCustomId.get(line.custom_id) ?? position;
      try {
        let video = videoFromBatchLine(line, payload.language);
        writeNdjson(res, {
          type: "status",
          message: st(payload.language, "batchVideoCreated", { index: index + 1 }),
          batchId: batch.id,
          id: video.id,
          status: activeBatchVideoStatus(video.status),
          progress: batchVideoOverallProgress(index, totalRequests, video.progress ?? 0),
        });

        video = await waitForCompletedVideo(payload.apiKey, video, (updatedVideo) => {
          writeNdjson(res, {
            type: "status",
            message: st(payload.language, "batchVideoProgress", { index: index + 1 }),
            batchId: batch.id,
            id: updatedVideo.id,
            status: activeBatchVideoStatus(updatedVideo.status),
            progress: batchVideoOverallProgress(index, totalRequests, updatedVideo.progress ?? 0),
          });
        }, payload.language);

        const { filePath } = resolveBatchOutputPath(payload.outputDir, payload.filename, index, totalRequests, line.custom_id || video.id);
        const downloadProgress = Math.min(
          BATCH_VIDEO_PROGRESS_END + 1,
          batchVideoOverallProgress(index, totalRequests, 100) + 1,
        );
        writeNdjson(res, {
          type: "status",
          message: st(payload.language, "batchDownloadingMp4", { index: index + 1 }),
          batchId: batch.id,
          id: video.id,
          status: "downloading",
          progress: downloadProgress,
        });
        await downloadVideo(payload.apiKey, video.id, filePath, payload.language);
        consecutiveRetryExhaustions = 0;
        savedCount += 1;
        if (outputPaths.length < MAX_BATCH_RESULT_PATHS) {
          outputPaths.push(displayPathForUser(filePath));
        }
      } catch (error) {
        if (error?.retryExhausted) consecutiveRetryExhaustions += 1;
        const safe = safeError(error);
        const failure = {
          custom_id: line.custom_id,
          error: safe,
        };
        failedCount += 1;
        if (!firstFailure) firstFailure = failure;
        if (failedSamples.length < MAX_BATCH_RESULT_PATHS) failedSamples.push(failure);
        writeNdjson(res, {
          type: "status",
          message: st(payload.language, "batchVideoFailed", { index: index + 1, message: safe.message }),
          batchId: batch.id,
          status: "partial",
          progress: batchVideoOverallProgress(index, totalRequests, 100),
        });
        if (consecutiveRetryExhaustions >= MAX_CONSECUTIVE_RETRY_EXHAUSTIONS) {
          retryCircuitOpen = true;
          break;
        }
      }
    }
    sortedLines.length = 0;
    failedCount = Math.max(0, totalRequests - savedCount);

    if (savedCount === 0 && failedCount > 0) {
      const firstError = firstFailure?.error;
      const error = new Error(firstError?.message || st(payload.language, "batchAllFailed"));
      error.details = {
        count: failedCount,
        samples: failedSamples,
        retryExhausted: retryCircuitOpen,
      };
      throw error;
    }

    writeNdjson(res, {
      type: "done",
      message: failedCount
        ? st(payload.language, "batchDoneWithFailures", { count: savedCount, failed: failedCount })
        : st(payload.language, "batchDone", { count: savedCount }),
      batch: {
        id: batch.id,
        status: batch.status,
        request_counts: batch.request_counts,
      },
      output: {
        count: savedCount,
        failedCount,
        paths: outputPaths,
        pathsTruncated: savedCount > outputPaths.length,
        retryExhausted: retryCircuitOpen,
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
    await assertOutputFileAvailable(filePath, language);
    await downloadVideo(apiKey, videoId, filePath, language);
    const stats = await fsp.stat(filePath);
    sendJson(res, 200, {
      ok: true,
      output: outputInfoForUser(filePath, stats),
    });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: safeError(error) });
  }
}

function handleOptions(req, res) {
  sendJson(res, 200, officialOptionsPayload());
}

module.exports = {
  readJson,
  isMultipartRequest,
  requestHeaders,
  readMultipartForm,
  formText,
  formFile,
  rawPayloadFromForm,
  readGenerateRequest,
  validateGeneratePayload,
  parseBatchCount,
  parseBatchPrompts,
  officialOptionsPayload,
  openaiRequest,
  videoJsonBody,
  videoFormBody,
  createVideo,
  retrieveVideo,
  downloadVideo,
  uploadBatchInputFile,
  uploadInputReferenceFile,
  createBatch,
  retrieveBatch,
  downloadJsonlFile,
  clampProgress,
  standardVideoProgress,
  batchProgress,
  batchVideoOverallProgress,
  activeBatchVideoStatus,
  activeBatchStatus,
  buildBatchInput,
  parseJsonl,
  videoFromBatchLine,
  waitForCompletedVideo,
  handleGenerate,
  handleGenerateStream,
  handleGenerateBatchStream,
  handleStatus,
  handleDownload,
  handleOptions,
};
