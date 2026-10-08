const form = document.querySelector("#generateForm");
const providerInput = document.querySelector("#provider");
const baseUrlInput = document.querySelector("#baseUrl");
const apiKeyInput = document.querySelector("#apiKey");
const modelInput = document.querySelector("#model");
const customModelInput = document.querySelector("#customModelId");
const customModelFields = document.querySelector("#customModelFields");
const customCapabilitiesPanel = document.querySelector("#customCapabilitiesPanel");
const customDurationsInput = document.querySelector("#customDurations");
const customResolutionsInput = document.querySelector("#customResolutions");
const customAspectRatiosInput = document.querySelector("#customAspectRatios");
const customFirstFrameInput = document.querySelector("#customFirstFrame");
const customAudioInput = document.querySelector("#customAudio");
const modelNote = document.querySelector("#modelNote");
const promptInput = document.querySelector("#prompt");
const batchCountField = document.querySelector("#batchCountField");
const batchCountInput = document.querySelector("#batchCount");
const secondsInput = document.querySelector("#seconds");
const sizeInput = document.querySelector("#size");
const aspectRatioInput = document.querySelector("#aspectRatio");
const audioInput = document.querySelector("#audio");
const seedInput = document.querySelector("#seed");
const requestFormatInput = document.querySelector("#requestFormat");
const inputReferenceInput = document.querySelector("#inputReference");
const clearInputReferenceButton = document.querySelector("#clearInputReference");
const inputReferencePreview = document.querySelector("#inputReferencePreview");
const inputReferenceImage = document.querySelector("#inputReferenceImage");
const inputReferenceName = document.querySelector("#inputReferenceName");
const inputReferenceMeta = document.querySelector("#inputReferenceMeta");
const outputDirInput = document.querySelector("#outputDir");
const filenameInput = document.querySelector("#filename");
const generateButton = document.querySelector("#generateButton");
const clearButton = document.querySelector("#clearButton");
const toggleApiKeyButton = document.querySelector("#toggleApiKey");
const selectOutputDirButton = document.querySelector("#selectOutputDir");
const languageInput = document.querySelector("#languageSelect");
const statusText = document.querySelector("#statusText");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");
const videoId = document.querySelector("#videoId");
const outputPath = document.querySelector("#outputPath");
const logBox = document.querySelector("#logBox");
const logCount = document.querySelector("#logCount");
const connectionState = document.querySelector("#connectionState");
const promptMetaText = document.querySelector("#promptMetaText");
const summaryMode = document.querySelector("#summaryMode");
const summaryModel = document.querySelector("#summaryModel");
const summarySeconds = document.querySelector("#summarySeconds");
const summaryPrice = document.querySelector("#summaryPrice");
const summaryEta = document.querySelector("#summaryEta");
const summaryBatchCount = document.querySelector("#summaryBatchCount");
const summaryReference = document.querySelector("#summaryReference");
const summarySize = document.querySelector("#summarySize");
const remoteIdInput = document.querySelector("#remoteId");
const recoverButton = document.querySelector("#recoverButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const isFilePreview = window.location.protocol === "file:";
const MAX_LOG_LINES = 500;
const MAX_DISPLAYED_OUTPUT_PATHS = 20;
const preferenceNames = ["language", "provider", "model", "seconds", "size", "aspectRatio", "batchCount"];
const privateStorageKeys = ["sora2app.apiKey", "sora2app.outputDir", "videogen.apiKey", "videogen.outputDir"];
const previewCatalog = [{ provider: "openai-compatible", regions: [{ id: "custom", baseUrl: "http://127.0.0.1:8000/v1" }], models: [] }];
let providers = previewCatalog;
let lanes = [];
let platform = "";
let activeLanguage = "zh";
let connectionStateKey = isFilePreview ? "connectionPreview" : "ready";
let currentStatus = "idle";
let currentProgress = 0;
let progressTarget = 0;
let progressAnimationFrame = 0;
let logScrollAnimationFrame = 0;
let inputReferenceInfo = null;
let inputReferenceInfoKey = "";
let inputReferenceError = "";
let inputReferencePreviewUrl = "";
const inputReferenceFitCache = new Map();
let lastEstimate = null;
let estimateTimer;
let estimateRevision = 0;
let busy = false;

function normalizeLanguage(language) {
  const base = String(language || "").toLowerCase().split("-")[0];
  return supportedLanguages.includes(base) ? base : "zh";
}

function storageGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* Preferences are optional. */ }
}

function storageRemove(key) {
  try { window.localStorage.removeItem(key); } catch { /* Storage may be unavailable in previews. */ }
}

function t(key, replacements = {}) {
  return String(translations[activeLanguage]?.[key] ?? translations.zh[key] ?? key)
    .replace(/\{(\w+)\}/g, (_, name) => String(replacements[name] ?? ""));
}

function currentLocale() { return t("locale"); }
function formatInteger(value) { return new Intl.NumberFormat(currentLocale()).format(value); }
function setConnectionState(key) { connectionStateKey = key; connectionState.textContent = t(key); }

function applyTranslations() {
  document.documentElement.lang = t("htmlLang");
  document.title = t("documentTitle");
  languageInput.value = activeLanguage;
  languageInput.setAttribute("aria-label", t("languageLabel"));
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelector(".controls-panel").setAttribute("aria-label", t("controlsAria"));
  document.querySelector(".monitor-panel").setAttribute("aria-label", t("monitorAria"));
  document.querySelector(".summary-grid").setAttribute("aria-label", t("summaryAria"));
  promptInput.placeholder = t("promptPlaceholder");
  outputDirInput.placeholder = t("outputDirPlaceholder");
  filenameInput.placeholder = t("filenamePlaceholder");
  inputReferenceInput.setAttribute("aria-label", t("inputReferenceLabel"));
  logBox.dataset.empty = t("emptyLog");
  toggleApiKeyButton.textContent = t(apiKeyInput.type === "password" ? "showApiKey" : "hideApiKey");
  toggleApiKeyButton.setAttribute("aria-label", t(apiKeyInput.type === "password" ? "showApiKeyAria" : "hideApiKeyAria"));
  setConnectionState(connectionStateKey);
  setProgress(currentStatus, currentProgress);
  renderProviders(providerInput.value);
  const hint = selectedLane()?.region.keyFormatHint;
  apiKeyInput.placeholder = hint === "optional" ? t("keyOptional") : hint || "";
  renderModels(modelInput.value);
  syncOptionControls();
  updateLogCount();
}

function setLanguage(language, shouldPersist = true) {
  activeLanguage = normalizeLanguage(language);
  applyTranslations();
  if (shouldPersist) storageSet("videogen.language", activeLanguage);
}

function laneLabel(lane) {
  if (lane.provider.provider === "openai-compatible") return t("customProvider");
  const names = { openrouter: "OpenRouter", mock: "Mock", gemini: "Gemini API", dashscope: "Alibaba Cloud", ark: "ModelArk" };
  const regionKeys = { global: "global", local: "local", custom: "local", beijing: "beijing", cn: "beijing", singapore: "singapore", international: "overseas", byteplus: "overseas" };
  const region = t(regionKeys[lane.region.id] || lane.region.labelKey || lane.region.id);
  return `${names[lane.provider.provider] || lane.provider.provider} · ${region}`;
}

function selectedLane() { return lanes.find((lane) => lane.id === providerInput.value) || lanes[0]; }
function selectedModelConfig() { return selectedLane()?.provider.models?.find((model) => model.id === modelInput.value); }
function isCustomModel() { return modelInput.value === "__custom__"; }
function splitValues(input) { return input.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean); }

function customCapabilities() {
  return { durations: splitValues(customDurationsInput).map(Number), resolutions: splitValues(customResolutionsInput), aspectRatios: splitValues(customAspectRatiosInput), firstFrame: customFirstFrameInput.checked, lastFrame: false, audio: customAudioInput.checked, seed: false };
}

function selectedCapabilities() { return selectedModelConfig()?.capabilities || customCapabilities(); }

function fillSelect(select, values, selected, label = (value) => value) {
  select.textContent = "";
  for (const item of values) {
    const value = String(typeof item === "object" ? item.value : item);
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label(value, item);
    select.appendChild(option);
  }
  select.value = [...select.options].some((option) => option.value === String(selected)) ? String(selected) : select.options[0]?.value || "";
}

function renderProviders(selected) {
  lanes = providers.flatMap((provider) => provider.regions.map((region) => ({ id: `${provider.provider}:${region.id}`, provider, region })));
  fillSelect(providerInput, lanes.map((lane) => lane.id), selected, (id) => laneLabel(lanes.find((lane) => lane.id === id)));
}

function renderModels(selected) {
  const lane = selectedLane();
  if (!selected && lane?.provider.provider === "openai-compatible") selected = "__custom__";
  const models = (lane?.provider.models || []).filter((model) => !model.regions || model.regions.includes(lane.region.id));
  const allowCustom = lane?.provider.provider === "openai-compatible" || models.length === 0;
  fillSelect(modelInput, [...models.map((model) => model.id), ...(allowCustom ? ["__custom__"] : [])], selected, (id) => {
    if (id === "__custom__") return `${t("customModel")} · ${t("experimental")}`;
    const model = models.find((item) => item.id === id);
    const suffixes = [!model.verified && t("experimental"), model.deprecatedAt && t("retiring")].filter(Boolean);
    return [model.label || id, ...suffixes].join(" · ");
  });
}

function syncOptionControls() {
  const lane = selectedLane();
  const capabilities = selectedCapabilities();
  customModelFields.hidden = !isCustomModel();
  customCapabilitiesPanel.hidden = !isCustomModel();
  document.querySelector("#requestFormatField").hidden = lane?.provider.provider !== "openai-compatible";
  fillSelect(secondsInput, capabilities.durations || [], secondsInput.value, (value) => `${value} ${t("secondUnit")}`);
  fillSelect(sizeInput, capabilities.resolutions || [], sizeInput.value);
  fillSelect(aspectRatioInput, capabilities.aspectRatios || [], aspectRatioInput.value);
  document.querySelector("#aspectRatioField").hidden = !(capabilities.aspectRatios?.length);
  document.querySelector("#audioField").hidden = !capabilities.audio;
  document.querySelector("#seedField").hidden = !capabilities.seed;
  audioInput.disabled = !capabilities.audio;
  if (!capabilities.audio) audioInput.checked = false;
  inputReferenceInput.disabled = !capabilities.firstFrame;
  if (!capabilities.firstFrame && selectedInputReferenceFile()) clearInputReference();
  modelNote.textContent = isCustomModel() || !selectedModelConfig()?.verified ? t("experimental") : "";
  updateInputReferenceMeta();
  if (!capabilities.firstFrame) inputReferenceMeta.textContent = t("unsupportedReference");
  updatePromptMeta();
  updateSummary();
}

function chooseLane() {
  const lane = selectedLane();
  apiKeyInput.value = "";
  baseUrlInput.value = lane?.region.baseUrl || "";
  baseUrlInput.readOnly = !["openai-compatible", "mock"].includes(lane?.provider.provider);
  apiKeyInput.placeholder = lane?.region.keyFormatHint === "optional" ? t("keyOptional") : lane?.region.keyFormatHint || "";
  apiKeyInput.required = false;
  renderModels();
  syncOptionControls();
  scheduleEstimate();
}

function parsePromptItems() {
  return promptInput.value.trim().split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean);
}

function requestCountForEstimate() {
  const count = parsePromptItems().length;
  return count > 1 ? count : Math.max(1, Number(batchCountInput.value) || 1);
}

function updatePromptMeta() {
  const count = parsePromptItems().length;
  batchCountField.hidden = count > 1;
  promptMetaText.textContent = t("promptCount", { count: formatInteger(count), chars: formatInteger(promptInput.value.trim().length), action: t("willSubmit", { count: formatInteger(requestCountForEstimate()) }) });
}

function selectedImageSize(params = {}) {
  const resolution = params.resolution || sizeInput.value;
  if (parseSizeValue(resolution)) return resolution;
  const height = resolution === "4k" ? 2160 : Number(/^(\d+)p$/.exec(resolution)?.[1]);
  const ratio = /^(\d+):(\d+)$/.exec(params.aspectRatio || aspectRatioInput.value);
  if (!height || !ratio) return "";
  const widthRatio = Number(ratio[1]);
  const heightRatio = Number(ratio[2]);
  const short = Math.min(widthRatio, heightRatio);
  return `${Math.round(height * widthRatio / short / 2) * 2}x${Math.round(height * heightRatio / short / 2) * 2}`;
}

function estimateText(estimate = lastEstimate) {
  const cost = estimate?.cost;
  let amount = t("unknown");
  if (cost?.amount !== null && cost?.amount !== undefined && Number.isFinite(Number(cost.amount))) {
    try { amount = new Intl.NumberFormat(currentLocale(), { style: "currency", currency: cost.currency || "USD", maximumFractionDigits: 4 }).format(cost.amount); } catch { amount = `${cost.amount} ${cost.currency || ""}`; }
  }
  return { cost: amount, eta: Number.isFinite(estimate?.etaSeconds) ? t("etaValue", { seconds: formatInteger(Math.ceil(estimate.etaSeconds)) }) : t("unknown") };
}

function updateSummary() {
  const lane = selectedLane();
  const estimate = estimateText();
  summaryMode.textContent = lane ? laneLabel(lane) : "-";
  summaryModel.textContent = isCustomModel() ? customModelInput.value || "-" : selectedModelConfig()?.label || modelInput.value || "-";
  summarySeconds.textContent = secondsInput.value ? `${secondsInput.value} ${t("secondUnit")}` : "-";
  summaryPrice.textContent = estimate.cost;
  summaryEta.textContent = estimate.eta;
  summaryBatchCount.textContent = `${formatInteger(requestCountForEstimate())} ${t("requestUnit")}`;
  summarySize.textContent = [sizeInput.value, aspectRatioInput.value].filter(Boolean).join(" · ") || "-";
  updateInputReferenceSummary();
}

function updateLogCount() { logCount.textContent = t("logCount", { count: formatInteger(logBox.children.length) }); }

const statusLabels = {
  idle: "statusIdle", submitting: "statusSubmitting", queued: "statusQueued", running: "statusInProgress", in_progress: "statusInProgress", downloading: "statusDownloading", completed: "statusCompleted", succeeded: "statusCompleted", failed: "statusFailed", partial: "statusPartial", cancelled: "statusCancelled", expired: "statusExpired", result_expired: "statusExpired", needs_review: "needsReview",
};
function selectedInputReferenceFile() {
  return inputReferenceInput.files?.[0] || null;
}

async function ensureInputReferenceInfo(file) {
  const key = inputReferenceFileKey(file);
  if (inputReferenceInfo && inputReferenceInfoKey === key) return inputReferenceInfo;
  const dimensions = await readImageFileDimensions(file);
  inputReferenceInfo = {
    ...dimensions,
    key,
    name: file.name,
    size: file.size,
    type: inputReferenceMimeType(file),
  };
  inputReferenceInfoKey = key;
  return inputReferenceInfo;
}

function inputReferenceAdjustment(info, file = selectedInputReferenceFile(), sizeValue = selectedImageSize()) {
  const expected = parseSizeValue(sizeValue);
  if (!info || !expected) return null;
  const needsResize = info.width !== expected.width || info.height !== expected.height;
  const needsCompression = Boolean(file && file.size > maxInputReferenceBytes);
  if (!needsResize && !needsCompression) return null;
  return {
    actual: `${info.width} x ${info.height}`,
    expected: `${expected.width} x ${expected.height}`,
    width: expected.width,
    height: expected.height,
  };
}

function revokeInputReferencePreview() {
  if (!inputReferencePreviewUrl) return;
  URL.revokeObjectURL(inputReferencePreviewUrl);
  inputReferencePreviewUrl = "";
}

function renderInputReferencePreview(file) {
  revokeInputReferencePreview();
  if (!file) {
    inputReferencePreview.hidden = true;
    inputReferenceImage.removeAttribute("src");
    inputReferenceName.textContent = "-";
    return;
  }
  inputReferencePreviewUrl = URL.createObjectURL(file);
  inputReferenceImage.src = inputReferencePreviewUrl;
  inputReferenceName.textContent = file.name;
  inputReferencePreview.hidden = false;
}

function updateInputReferenceSummary() {
  const file = selectedInputReferenceFile();
  if (!file) {
    summaryReference.textContent = t("noInputReference");
    return;
  }
  if (inputReferenceInfo) {
    const adjustment = inputReferenceAdjustment(inputReferenceInfo, file);
    summaryReference.textContent = adjustment ? `${adjustment.actual} -> ${adjustment.expected}` : `${inputReferenceInfo.width} x ${inputReferenceInfo.height}`;
    return;
  }
  summaryReference.textContent = file.name;
}

function updateInputReferenceMeta() {
  const file = selectedInputReferenceFile();
  clearInputReferenceButton.disabled = !file;

  if (!file) {
    inputReferenceMeta.textContent = t(inputReferenceInput.disabled ? "unsupportedReference" : "inputReferenceMetaEmpty");
    inputReferenceMeta.classList.remove("is-error");
    updateInputReferenceSummary();
    return;
  }

  const isInvalidType = !supportedInputReferenceTypes.has(inputReferenceMimeType(file));
  const adjustment = inputReferenceAdjustment(inputReferenceInfo, file);
  const hasError = Boolean(inputReferenceError || isInvalidType);
  inputReferenceMeta.classList.toggle("is-error", hasError);

  if (inputReferenceError) {
    inputReferenceMeta.textContent = inputReferenceError;
  } else if (isInvalidType) {
    inputReferenceMeta.textContent = t("inputReferenceInvalidType");
  } else if (adjustment) {
    inputReferenceMeta.textContent = t("inputReferenceMetaAdjusted", {
      name: file.name,
      actual: adjustment.actual,
      expected: adjustment.expected,
    });
  } else if (inputReferenceInfo) {
    inputReferenceMeta.textContent = t("inputReferenceMetaSelected", {
      name: file.name,
      width: inputReferenceInfo.width,
      height: inputReferenceInfo.height,
    });
  } else {
    inputReferenceMeta.textContent = t("inputReferenceReading");
  }

  updateInputReferenceSummary();
}

async function handleInputReferenceChange() {
  inputReferenceError = "";
  inputReferenceInfo = null;
  inputReferenceInfoKey = "";
  inputReferenceFitCache.clear();
  const file = selectedInputReferenceFile();
  renderInputReferencePreview(file);
  updateInputReferenceMeta();
  updateSummary();

  if (!file || !supportedInputReferenceTypes.has(inputReferenceMimeType(file))) return;
  const key = inputReferenceFileKey(file);
  try {
    await ensureInputReferenceInfo(file);
  } catch {
    inputReferenceError = t("inputReferenceLoadError");
  }
  if (inputReferenceFileKey(selectedInputReferenceFile()) !== key) return;
  updateInputReferenceMeta();
  updateSummary();
}

async function validateInputReferenceSelection(payload) {
  const file = selectedInputReferenceFile();
  if (!file) return null;
  if (!supportedInputReferenceTypes.has(inputReferenceMimeType(file))) {
    throw new Error(t("inputReferenceInvalidType"));
  }
  let info;
  try {
    info = await ensureInputReferenceInfo(file);
  } catch {
    throw new Error(t("inputReferenceLoadError"));
  }
  const adjustment = inputReferenceAdjustment(info, file, selectedImageSize(payload.params));
  if (!adjustment) {
    if (file.size > maxInputReferenceBytes) throw new Error(t("inputReferenceTooLarge"));
    return {
      file,
      name: file.name,
      adjusted: false,
      actual: `${info.width} x ${info.height}`,
      expected: `${info.width} x ${info.height}`,
    };
  }

  inputReferenceMeta.textContent = t("inputReferenceProcessing");
  let fittedFile;
  const cacheKey = `${inputReferenceFileKey(file)}:${selectedImageSize(payload.params)}`;
  try {
    fittedFile = inputReferenceFitCache.get(cacheKey);
    if (!fittedFile) {
      fittedFile = await fitInputReferenceFile(file, selectedImageSize(payload.params));
      inputReferenceFitCache.set(cacheKey, fittedFile);
    }
  } catch (error) {
    inputReferenceError = error.message || t("inputReferenceResizeError");
    updateInputReferenceMeta();
    throw error;
  }
  if (fittedFile.size > maxInputReferenceBytes) {
    throw new Error(t("inputReferenceTooLarge"));
  }
  updateInputReferenceMeta();
  return {
    file: fittedFile,
    name: file.name,
    adjusted: true,
    actual: adjustment.actual,
    expected: adjustment.expected,
  };
}

function clearInputReference() {
  inputReferenceInput.value = "";
  inputReferenceInfo = null;
  inputReferenceInfoKey = "";
  inputReferenceError = "";
  inputReferenceFitCache.clear();
  renderInputReferencePreview(null);
  updateInputReferenceMeta();
  updateSummary();
}

function formatStatus(status) {
  return statusLabels[status] ? t(statusLabels[status]) : status;
}

function shouldResetProgress(status) {
  return status === "idle" || status === "submitting";
}

function shouldFreezeProgress(status) {
  return ["failed", "cancelled", "expired", "result_expired", "needs_review", "completed", "succeeded", "partial"].includes(status);
}

function paintProgress(value) {
  progressText.textContent = `${Math.round(value)}%`;
  progressBar.style.width = `${value}%`;
}

function stopProgressAnimation() {
  if (!progressAnimationFrame) return;
  cancelAnimationFrame(progressAnimationFrame);
  progressAnimationFrame = 0;
}

function animateProgress(targetValue) {
  stopProgressAnimation();
  progressTarget = targetValue;
  const startValue = currentProgress;
  const delta = targetValue - startValue;
  if (delta <= 0) {
    currentProgress = targetValue;
    paintProgress(currentProgress);
    return;
  }

  const startTime = performance.now();
  const duration = Math.min(1800, Math.max(450, delta * 24));
  const step = (now) => {
    const elapsed = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - elapsed, 3);
    currentProgress = startValue + delta * eased;
    paintProgress(currentProgress);
    if (elapsed < 1) {
      progressAnimationFrame = requestAnimationFrame(step);
      return;
    }
    progressAnimationFrame = 0;
    currentProgress = targetValue;
    paintProgress(currentProgress);
  };
  progressAnimationFrame = requestAnimationFrame(step);
}

function setProgress(status, progress = 0) {
  const value = Math.max(0, Math.min(100, Number(progress) || 0));
  const displayValue = shouldResetProgress(status)
    ? value
    : shouldFreezeProgress(status)
      ? Math.max(value, currentProgress)
      : Math.max(value, currentProgress, progressTarget);
  currentStatus = status;
  statusText.textContent = formatStatus(status);
  if (shouldResetProgress(status) || shouldFreezeProgress(status) || displayValue <= currentProgress + 1) {
    stopProgressAnimation();
    progressTarget = displayValue;
    currentProgress = displayValue;
    paintProgress(currentProgress);
    return;
  }
  animateProgress(displayValue);
}

function appendLog(message, tone = "") {
  const line = document.createElement("div");
  line.className = tone ? `log-line-${tone}` : "";
  line.textContent = `[${new Date().toLocaleTimeString(currentLocale())}] ${message}`;
  logBox.appendChild(line);
  while (logBox.children.length > MAX_LOG_LINES) {
    logBox.firstElementChild?.remove();
  }
  if (!logScrollAnimationFrame) {
    logScrollAnimationFrame = requestAnimationFrame(() => {
      logScrollAnimationFrame = 0;
      logBox.scrollTop = logBox.scrollHeight;
    });
  }
  updateLogCount();
}

function outputDisplayPath(output) {
  const paths = Array.isArray(output?.displayPaths) && output.displayPaths.length > 0
    ? output.displayPaths
    : output?.paths;
  if (Array.isArray(paths) && paths.length > 0) {
    const displayedPaths = paths.slice(0, MAX_DISPLAYED_OUTPUT_PATHS);
    const totalCount = Number.isInteger(Number(output?.count))
      ? Math.max(paths.length, Number(output.count))
      : paths.length;
    const remaining = totalCount - displayedPaths.length;
    const suffix = remaining > 0 ? `\n… (+${formatInteger(remaining)})` : "";
    return `${displayedPaths.join("\n")}${suffix}`;
  }
  return output?.displayPath || output?.path || "-";
}

function readForm() {
  const lane = selectedLane();
  const capabilities = selectedCapabilities();
  const payload = {
    language: activeLanguage,
    provider: lane?.provider.provider,
    region: lane?.region.id,
    baseUrl: baseUrlInput.value.trim(),
    apiKey: apiKeyInput.value,
    model: isCustomModel() ? customModelInput.value.trim() : modelInput.value,
    params: {
      durationSeconds: Number(secondsInput.value),
      resolution: sizeInput.value,
      aspectRatio: aspectRatioInput.value,
      audio: Boolean(capabilities.audio && audioInput.checked),
      requestFormat: requestFormatInput.value,
    },
    prompt: promptInput.value.trim(),
    batchCount: requestCountForEstimate(),
    outputDir: outputDirInput.value.trim(),
    filename: filenameInput.value.trim(),
  };
  if (capabilities.seed && seedInput.value !== "") payload.params.seed = Number(seedInput.value);
  if (isCustomModel()) payload.customCapabilities = customCapabilities();
  if (!payload.apiKey) delete payload.apiKey;
  return payload;
}

function validateSelection(payload, recovery = false) {
  if (!payload.model) throw new Error(t("missingModel"));
  if (!recovery && !payload.prompt) throw new Error(t("missingPrompt"));
  if (!Number.isSafeInteger(payload.batchCount) || payload.batchCount < 1) throw new Error(t("invalidRepeat"));
  if (isCustomModel()) {
    const capabilities = payload.customCapabilities;
    if (!capabilities.durations.length || capabilities.durations.some((duration) => !Number.isFinite(duration) || duration <= 0) || !capabilities.resolutions.length || !capabilities.aspectRatios.length) throw new Error(t("invalidCapabilities"));
  }
}

function persistSettings() {
  const values = { language: activeLanguage, provider: providerInput.value, model: modelInput.value, seconds: secondsInput.value, size: sizeInput.value, aspectRatio: aspectRatioInput.value, batchCount: batchCountInput.value };
  for (const key of preferenceNames) storageSet(`videogen.${key}`, values[key]);
}

function restoreSettings() {
  for (const key of privateStorageKeys) storageRemove(key);
  if (!storageGet("videogen.migrated")) {
    for (const key of preferenceNames) {
      const old = storageGet(`sora2app.${key}`);
      if (old && !storageGet(`videogen.${key}`)) storageSet(`videogen.${key}`, old);
      storageRemove(`sora2app.${key}`);
    }
    storageRemove("sora2app.mode");
    storageSet("videogen.migrated", "1");
  }
  return Object.fromEntries(preferenceNames.map((key) => [key, storageGet(`videogen.${key}`)]));
}

async function requestJson(endpoint, payload) {
  if (isFilePreview) throw new Error(t("filePreviewGenerateError"));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-videogen-language": activeLanguage },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || t("requestFailed", { status: response.status }));
  return result;
}

async function estimate(payload) {
  const { apiKey, ...publicPayload } = payload;
  return requestJson("/api/estimate", publicPayload);
}

function scheduleEstimate() {
  clearTimeout(estimateTimer);
  const revision = ++estimateRevision;
  lastEstimate = null;
  updateSummary();
  if (isFilePreview || busy) return;
  estimateTimer = setTimeout(async () => {
    const payload = readForm();
    if (!payload.model || !payload.prompt) return;
    try {
      const result = await estimate(payload);
      if (revision !== estimateRevision) return;
      lastEstimate = result;
      updateSummary();
    } catch { /* Submission surfaces validation errors; unknown estimates stay visible. */ }
  }, 400);
}

function applyStreamEvent(event) {
  if (event.id || event.remoteId || event.remote?.id) videoId.textContent = event.remoteId || event.remote?.id || event.id;
  if (event.status || event.state) setProgress(event.status || event.state, event.progress ?? currentProgress);
  if (event.output) outputPath.textContent = outputDisplayPath(event.output);
  if (event.message) appendLog(event.message);
  if (event.type === "error") {
    if (event.state === "needs_review" || event.error?.category === "unknown_outcome") appendLog(t("needsReview"), "error");
    throw new Error(event.error?.message || t("streamError"));
  }
  if (event.type === "done") {
    videoId.textContent = event.video?.id || event.videos?.[0]?.id || event.remoteId || videoId.textContent;
    outputPath.textContent = outputDisplayPath(event.output);
    const hasFailures = Number(event.output?.failedCount || event.failedCount || 0) > 0;
    setProgress(hasFailures ? "partial" : "completed", 100);
    const failedSuffix = hasFailures ? t("failedSuffix", { count: formatInteger(event.output?.failedCount || event.failedCount) }) : "";
    const count = event.output?.count ?? event.output?.paths?.length;
    appendLog(count !== undefined ? t("savedMany", { count: formatInteger(count), failedSuffix }) : t("savedOne", { path: outputDisplayPath(event.output) }), hasFailures ? "error" : "ok");
    setConnectionState(hasFailures ? "connectionError" : "connectionCompleted");
  }
}

function generateRequestBody(payload, inputReferenceFile) {
  if (!inputReferenceFile) return { headers: { "content-type": "application/json", "x-videogen-language": activeLanguage }, body: JSON.stringify(payload) };
  const body = new FormData();
  body.append("payload", JSON.stringify(payload));
  body.append("input_reference", inputReferenceFile, inputReferenceFile.name);
  return { headers: { "x-videogen-language": activeLanguage }, body };
}

async function streamRequest(endpoint, payload, inputReferenceFile = null) {
  if (isFilePreview) throw new Error(t("filePreviewGenerateError"));
  const response = await fetch(endpoint, { method: "POST", ...generateRequestBody(payload, inputReferenceFile) });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || t("requestFailed", { status: response.status }));
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedDone = false;
  const processLine = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    applyStreamEvent(event);
    if (event.type === "done") receivedDone = true;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(processLine);
    }
    buffer += decoder.decode();
    processLine(buffer);
  } finally {
    reader.releaseLock();
  }
  if (!receivedDone) throw new Error(t("needsReview"));
}

function setBusy(value) {
  busy = value;
  for (const element of [generateButton, recoverButton, clearButton, clearHistoryButton, providerInput, baseUrlInput, modelInput]) element.disabled = value;
}

async function generateVideo(event) {
  event.preventDefault();
  if (busy) return;
  const payload = readForm();
  setBusy(true);
  try {
    validateSelection(payload);
    const inputReference = await validateInputReferenceSelection(payload);
    lastEstimate = await estimate(payload);
    updateSummary();
    const text = estimateText();
    if (!window.confirm(t("confirmGenerate", { count: formatInteger(lastEstimate.count ?? payload.batchCount), cost: text.cost, eta: text.eta }))) return;
    persistSettings();
    clearStatus();
    setConnectionState("generating");
    setProgress("submitting", 0);
    appendLog(t("submittingLog"));
    await streamRequest("/api/generate-batch-stream", payload, inputReference?.file || null);
  } catch (error) {
    setProgress("failed", currentProgress);
    appendLog(error.message, "error");
    setConnectionState("connectionError");
  } finally { setBusy(false); }
}

async function recoverVideo() {
  if (busy) return;
  const payload = readForm();
  payload.remoteId = remoteIdInput.value.trim();
  delete payload.prompt;
  delete payload.batchCount;
  setBusy(true);
  try {
    if (!payload.remoteId) throw new Error(t("missingRemoteId"));
    if (!payload.model) throw new Error(t("missingModel"));
    clearStatus();
    setConnectionState("generating");
    await streamRequest("/api/recover", payload);
  } catch (error) { appendLog(error.message, "error"); setConnectionState("connectionError"); }
  finally { setBusy(false); }
}

function clearStatus() {
  logBox.textContent = "";
  updateLogCount();
  videoId.textContent = "-";
  outputPath.textContent = "-";
  setConnectionState(isFilePreview ? "connectionPreview" : "ready");
  setProgress("idle", 0);
}

async function clearHistory() {
  if (!window.confirm(t("clearHistoryConfirm"))) return;
  clearHistoryButton.disabled = true;
  try { await requestJson("/api/history/clear", {}); appendLog(t("historyCleared"), "ok"); }
  catch (error) { appendLog(error.message, "error"); }
  finally { clearHistoryButton.disabled = false; }
}

function toggleApiKeyVisibility() {
  const hidden = apiKeyInput.type === "password";
  apiKeyInput.type = hidden ? "text" : "password";
  toggleApiKeyButton.textContent = t(hidden ? "hideApiKey" : "showApiKey");
  toggleApiKeyButton.setAttribute("aria-label", t(hidden ? "hideApiKeyAria" : "showApiKeyAria"));
}

async function selectOutputDirectory() {
  selectOutputDirButton.disabled = true;
  try {
    const data = await requestJson("/api/select-output-dir", {});
    if (!data.path) return;
    outputDirInput.value = data.displayPath || data.path;
    appendLog(t("selectedOutputDir", { path: data.displayPath || data.path }), "ok");
  } catch (error) { appendLog(error.message, "error"); }
  finally { selectOutputDirButton.disabled = false; }
}

async function init() {
  const restored = restoreSettings();
  activeLanguage = normalizeLanguage(restored.language || "zh");
  if (!isFilePreview) {
    try {
      const response = await fetch("/api/catalog", { headers: { "x-videogen-language": activeLanguage } });
      if (!response.ok) throw new Error(t("requestFailed", { status: response.status }));
      const data = await response.json();
      if (!Array.isArray(data.providers) || !data.providers.length) throw new Error(t("noModels"));
      providers = data.providers;
      platform = data.platform;
    } catch (error) { appendLog(t("loadCatalogError", { message: error.message }), "error"); }
  }
  renderProviders(restored.provider);
  chooseLane();
  renderModels(restored.model);
  syncOptionControls();
  for (const [name, input] of [["seconds", secondsInput], ["size", sizeInput], ["aspectRatio", aspectRatioInput]]) {
    if ([...input.options].some((option) => option.value === restored[name])) input.value = restored[name];
  }
  batchCountInput.value = String(Number.isSafeInteger(Number(restored.batchCount)) && Number(restored.batchCount) > 0 ? restored.batchCount : 1);
  selectOutputDirButton.hidden = !isFilePreview && platform !== "darwin";
  applyTranslations();
  appendLog(t(isFilePreview ? "previewReadyLog" : "readyLog"), "ok");
}

form.addEventListener("submit", generateVideo);
clearButton.addEventListener("click", clearStatus);
recoverButton.addEventListener("click", recoverVideo);
clearHistoryButton.addEventListener("click", clearHistory);
toggleApiKeyButton.addEventListener("click", toggleApiKeyVisibility);
selectOutputDirButton.addEventListener("click", selectOutputDirectory);
inputReferenceInput.addEventListener("change", handleInputReferenceChange);
clearInputReferenceButton.addEventListener("click", clearInputReference);
languageInput.addEventListener("change", () => setLanguage(languageInput.value));
providerInput.addEventListener("change", () => { chooseLane(); persistSettings(); });
baseUrlInput.addEventListener("input", () => { apiKeyInput.value = ""; scheduleEstimate(); });
modelInput.addEventListener("change", () => { syncOptionControls(); scheduleEstimate(); persistSettings(); });
for (const input of [customDurationsInput, customResolutionsInput, customAspectRatiosInput, customFirstFrameInput, customAudioInput]) {
  input.addEventListener("change", () => { syncOptionControls(); scheduleEstimate(); });
}
for (const input of [promptInput, batchCountInput, customModelInput]) {
  input.addEventListener("input", () => { updatePromptMeta(); scheduleEstimate(); });
}
for (const input of [secondsInput, sizeInput, aspectRatioInput, audioInput, seedInput, requestFormatInput]) {
  input.addEventListener("change", () => { updateInputReferenceMeta(); scheduleEstimate(); persistSettings(); });
}

init();
