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
const toggleApiKeyButton = document.querySelector("#toggleApiKey");
const selectOutputDirButton = document.querySelector("#selectOutputDir");
const languageInput = document.querySelector("#languageSelect");
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
const budgetInput = document.querySelector("#budget");
const saveKeyButton = document.querySelector("#saveKeyButton");
const deleteKeyButton = document.querySelector("#deleteKeyButton");

const isFilePreview = window.location.protocol === "file:";
const preferenceNames = ["language", "provider", "model", "seconds", "size", "aspectRatio", "batchCount"];
const privateStorageKeys = ["sora2app.apiKey", "sora2app.outputDir", "videogen.apiKey", "videogen.outputDir"];
const previewCatalog = [{ provider: "openai-compatible", regions: [{ id: "custom", labelKey: "regionCustom", baseUrl: "http://127.0.0.1:8000/v1", keyFormatHint: "optional" }], models: [] }];
let providers = previewCatalog;
let lanes = [];
let platform = "";
let proxyInfo = null;
let activeLanguage = "zh";
let connectionStateKey = isFilePreview ? "connectionPreview" : "connectionReconnecting";
let inputReferenceInfo = null;
let inputReferenceInfoKey = "";
let inputReferenceError = "";
let inputReferencePreviewUrl = "";
const inputReferenceFitCache = new Map();
let lastEstimate = null;
let estimateTimer;
let estimateRevision = 0;
let busy = false;
let disabledControls = new Map();
let queueView;

function normalizeLanguage(language) {
  const base = String(language || "").toLowerCase().split("-")[0];
  return supportedLanguages.includes(base) ? base : "zh";
}
function storageGet(key) { try { return window.localStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { window.localStorage.setItem(key, value); } catch {} }
function storageRemove(key) { try { window.localStorage.removeItem(key); } catch {} }
function t(key, replacements = {}) {
  return String(translations[activeLanguage]?.[key] ?? translations.zh[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(replacements[name] ?? ""));
}
function currentLocale() { return t("locale"); }
function formatInteger(value) { return new Intl.NumberFormat(currentLocale()).format(value); }
function setConnectionState(key) { connectionStateKey = key; connectionState.textContent = t(key); }
function renderProxyInfo() {
  const panel = document.querySelector("#proxyInfo");
  panel.hidden = isFilePreview || !proxyInfo;
  const enabled = proxyInfo?.enabled === true;
  document.querySelector("#proxyStatus").textContent = t(enabled ? "proxyEnabled" : "proxyDisabled");
  document.querySelector("#proxyHttp").textContent = enabled && proxyInfo.http ? proxyInfo.http : t("proxyDirect");
  document.querySelector("#proxyHttps").textContent = enabled && proxyInfo.https ? proxyInfo.https : t("proxyDirect");
  document.querySelector("#proxyBypass").textContent = enabled && proxyInfo.noProxy ? proxyInfo.noProxy : t(enabled ? "proxyNone" : "proxyAllDirect");
}
function formMessage(text, error = false) {
  const element = document.querySelector("#formMessage");
  element.textContent = text;
  element.classList.toggle("is-error", error);
}
function providerName(id) {
  const keys = { openrouter: "providerOpenRouter", "openai-compatible": "providerOpenAICompatible", mock: "providerMock", gemini: "providerGemini", dashscope: "providerDashScope", ark: "providerArk" };
  return keys[id] ? t(keys[id]) : id;
}
function laneName(lane) {
  const provider = providers.find((item) => item.provider === lane.provider);
  const region = provider?.regions.find((item) => item.id === lane.region);
  const fallback = { global: "regionGlobal", local: "regionLocal", custom: "regionCustom", beijing: "regionBeijing", singapore: "regionSingapore", byteplus: "regionBytePlus" };
  return `${providerName(lane.provider)} · ${t(region?.labelKey || fallback[lane.region] || lane.region)}`;
}
function laneLabel(lane) { return laneName({ provider: lane.provider.provider, region: lane.region.id }); }
function selectedLane() { return lanes.find((lane) => lane.id === providerInput.value) || lanes[0]; }
function selectedModelConfig() { return selectedLane()?.provider.models?.find((model) => model.id === modelInput.value); }
function isCustomModel() { return modelInput.value === "__custom__"; }
function splitValues(input) { return input.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean); }
function customCapabilities() { return { durations: splitValues(customDurationsInput).map(Number), resolutions: splitValues(customResolutionsInput), aspectRatios: splitValues(customAspectRatiosInput), firstFrame: customFirstFrameInput.checked, lastFrame: false, audio: customAudioInput.checked, seed: false }; }
function selectedCapabilities() { return selectedModelConfig()?.capabilities || customCapabilities(); }
function formLane() { const lane = selectedLane(); return { provider: lane?.provider.provider, region: lane?.region.id, baseUrl: baseUrlInput.value.trim() }; }
function fillSelect(select, values, selected, label = (value) => value) {
  select.textContent = "";
  for (const item of values) { const option = document.createElement("option"); option.value = String(item); option.textContent = label(String(item)); select.append(option); }
  select.value = [...select.options].some((option) => option.value === String(selected)) ? String(selected) : select.options[0]?.value || "";
}
function renderProviders(selected) {
  const order = ["openrouter", "gemini", "dashscope", "ark", "openai-compatible", "mock"];
  const ranked = (id) => order.includes(id) ? order.indexOf(id) : order.length;
  lanes = [...providers].sort((a, b) => ranked(a.provider) - ranked(b.provider)).flatMap((provider) => provider.regions.map((region) => ({ id: `${provider.provider}:${region.id}`, provider, region })));
  fillSelect(providerInput, lanes.map((lane) => lane.id), selected, (id) => laneLabel(lanes.find((lane) => lane.id === id)));
}
function renderModels(selected) {
  const lane = selectedLane();
  if (!selected && lane?.provider.provider === "openai-compatible") selected = "__custom__";
  const models = (lane?.provider.models || []).filter((model) => !model.regions || model.regions.includes(lane.region.id));
  const allowCustom = lane?.provider.provider === "openai-compatible";
  fillSelect(modelInput, [...models.map((model) => model.id), ...(allowCustom ? ["__custom__"] : [])], selected, (id) => {
    if (id === "__custom__") return `${t("customModel")} · ${t("experimental")}`;
    const model = models.find((item) => item.id === id);
    return [model.label || id, !model.verified && t("experimental"), modelRetiring(model) && t("retiring")].filter(Boolean).join(" · ");
  });
}
function supportsCatalogRefresh() { return !isFilePreview && selectedLane()?.provider.provider === "openrouter"; }
function syncOptionControls() {
  const lane = selectedLane();
  const model = selectedModelConfig();
  const capabilities = selectedCapabilities();
  document.querySelector("#refreshCatalogButton").disabled = busy || !supportsCatalogRefresh();
  customModelFields.hidden = !isCustomModel();
  customCapabilitiesPanel.hidden = !isCustomModel();
  document.querySelector("#requestFormatField").hidden = lane?.provider.provider !== "openai-compatible";
  fillSelect(secondsInput, capabilities.durations || [], secondsInput.value, (value) => `${value} ${t("secondUnit")}`);
  fillSelect(sizeInput, capabilities.resolutions || [], sizeInput.value);
  fillSelect(aspectRatioInput, capabilities.aspectRatios || [], aspectRatioInput.value);
  document.querySelector("#aspectRatioField").hidden = !capabilities.aspectRatios?.length;
  document.querySelector("#audioField").hidden = !capabilities.audio;
  document.querySelector("#seedField").hidden = !capabilities.seed;
  seedInput.disabled = !capabilities.seed || busy;
  audioInput.disabled = !capabilities.audio || Boolean(capabilities.audioFixed);
  if (!capabilities.audio) audioInput.checked = false;
  if (capabilities.audioFixed) audioInput.checked = true;
  inputReferenceInput.disabled = !capabilities.firstFrame;
  if (!capabilities.firstFrame && selectedInputReferenceFile()) clearInputReference();
  modelNote.textContent = [isCustomModel() || !model?.verified ? t("experimental") : "", lane?.provider.asOf ? t("catalogAsOf", { date: lane.provider.asOf }) : ""].filter(Boolean).join(" · ");
  document.querySelector("#availabilityNote").textContent = lane?.region.availabilityNoteKey ? t(lane.region.availabilityNoteKey) : "";
  document.querySelector("#modelWarning").hidden = !model?.warningKey;
  document.querySelector("#modelWarning").textContent = model?.warningKey ? t(model.warningKey) : "";
  document.querySelector("#pricingNote").textContent = model?.pricingNoteKey ? t(model.pricingNoteKey) : "";
  updateInputReferenceMeta();
  if (capabilities.firstFrame && model?.firstFrameNoteKey) inputReferenceMeta.textContent += ` ${t(model.firstFrameNoteKey)}`;
  updatePromptMeta(); updateSummary(); updateSelectedKeyStatus();
  if (busy) for (const element of disabledControls.keys()) element.disabled = true;
}
function chooseLane() {
  const lane = selectedLane();
  apiKeyInput.value = ""; apiKeyInput.type = "password";
  baseUrlInput.value = lane?.region.baseUrl || "";
  baseUrlInput.readOnly = !lane?.region.requireBaseUrl && !["openai-compatible", "mock"].includes(lane?.provider.provider);
  baseUrlInput.placeholder = lane?.region.baseUrlTemplate || "";
  apiKeyInput.placeholder = lane?.region.keyFormatHint === "optional" ? t("keyOptional") : t("replacementKey");
  renderModels(); syncOptionControls(); scheduleEstimate();
}
function selectExistingLane(lane) {
  if (busy) return;
  providerInput.value = `${lane.provider}:${lane.region}`;
  chooseLane();
  baseUrlInput.value = lane.baseUrl;
  updateSelectedKeyStatus(); scheduleEstimate();
  apiKeyInput.focus();
}
function updateSelectedKeyStatus() {
  const present = queueView?.keyPresent(formLane()) || false;
  document.querySelector("#selectedKeyStatus").textContent = t(present ? "keyPresent" : "keyAbsent");
  deleteKeyButton.disabled = !present || busy;
  document.querySelector("#transportWarning").hidden = !insecureCredentialLane(formLane(), present || Boolean(apiKeyInput.value));
}
async function saveSelectedKey() {
  try { await apiRequest("/api/keys", { lane: formLane(), key: apiKeyInput.value }); }
  finally { apiKeyInput.value = ""; }
  await queueView.loadLanes();
  formMessage(t("keySaved"));
}
function parsePromptItems() { return promptInput.value.trim().split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean); }
function requestCountForEstimate() { const count = parsePromptItems().length; return count > 1 ? count : Math.max(1, Number(batchCountInput.value) || 1); }
function updatePromptMeta() {
  const count = parsePromptItems().length;
  batchCountField.hidden = count > 1;
  batchCountInput.disabled = count > 1 || busy;
  promptMetaText.textContent = t("promptCount", { count: formatInteger(count), chars: formatInteger(promptInput.value.trim().length), action: t("willSubmit", { count: formatInteger(requestCountForEstimate()) }) });
}
function selectedImageSize(params = {}) {
  const resolution = params.resolution || sizeInput.value;
  if (parseSizeValue(resolution)) return resolution;
  const height = /^4k$/i.test(resolution) ? 2160 : Number(/^(\d+)p$/i.exec(resolution)?.[1]);
  const ratio = /^(\d+):(\d+)$/.exec(params.aspectRatio || aspectRatioInput.value);
  if (!height || !ratio) return "";
  const [a, b] = ratio.slice(1).map(Number); const short = Math.min(a, b);
  return `${Math.round(height * a / short / 2) * 2}x${Math.round(height * b / short / 2) * 2}`;
}
function estimateText(estimate = lastEstimate) { return { cost: formatCost(estimate?.cost), eta: Number.isFinite(estimate?.etaSeconds) ? t("etaValue", { seconds: formatInteger(Math.ceil(estimate.etaSeconds)) }) : t("unknown") }; }
function updateSummary() {
  const lane = selectedLane(); const estimate = estimateText();
  summaryMode.textContent = lane ? laneLabel(lane) : "—";
  summaryModel.textContent = isCustomModel() ? customModelInput.value || "—" : selectedModelConfig()?.label || modelInput.value || "—";
  summarySeconds.textContent = secondsInput.value ? `${secondsInput.value} ${t("secondUnit")}` : "—";
  summaryPrice.textContent = estimate.cost; summaryEta.textContent = estimate.eta;
  summaryBatchCount.textContent = `${formatInteger(requestCountForEstimate())} ${t("requestUnit")}`;
  summarySize.textContent = [sizeInput.value, aspectRatioInput.value].filter(Boolean).join(" · ") || "—";
  const priced = Number.isFinite(lastEstimate?.cost?.amount);
  budgetInput.disabled = busy || !priced;
  document.querySelector("#budgetNote").textContent = priced ? t("budgetCurrency", { currency: lastEstimate.cost.currency }) : t("budgetUnknown");
  updateInputReferenceSummary();
}

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



function readForm() {
  const capabilities = selectedCapabilities();
  const payload = { ...formLane(), language: activeLanguage, model: isCustomModel() ? customModelInput.value.trim() : modelInput.value,
    params: { durationSeconds: Number(secondsInput.value), resolution: sizeInput.value, aspectRatio: aspectRatioInput.value, audio: Boolean(capabilities.audio && audioInput.checked) },
    prompt: promptInput.value.trim(), batchCount: requestCountForEstimate(), outputDir: outputDirInput.value.trim(), filename: filenameInput.value.trim() };
  if (payload.provider === "openai-compatible") payload.params.requestFormat = requestFormatInput.value;
  if (capabilities.seed && seedInput.value !== "") payload.params.seed = Number(seedInput.value);
  if (isCustomModel()) payload.customCapabilities = customCapabilities();
  if (!budgetInput.disabled && budgetInput.value !== "") payload.budget = { amount: Number(budgetInput.value), currency: lastEstimate?.cost?.currency };
  return payload;
}
function validateSelection(payload) {
  if (!normalizedBaseUrl(payload.baseUrl)) throw new Error(t("invalidEndpoint"));
  if (!payload.model) throw new Error(t("missingModel"));
  if (!payload.prompt) throw new Error(t("missingPrompt"));
  if (!Number.isSafeInteger(payload.batchCount) || payload.batchCount < 1) throw new Error(t("invalidRepeat"));
  if (payload.budget && (!Number.isFinite(payload.budget.amount) || payload.budget.amount <= 0)) throw new Error(t("invalidBudgetInput"));
  if (isCustomModel()) { const caps = payload.customCapabilities; if (!caps.durations.length || caps.durations.some((duration) => !Number.isInteger(duration) || duration <= 0) || !caps.resolutions.length || !caps.aspectRatios.length) throw new Error(t("invalidCapabilities")); }
}
function persistSettings() {
  const values = { language: activeLanguage, provider: providerInput.value, model: modelInput.value, seconds: secondsInput.value, size: sizeInput.value, aspectRatio: aspectRatioInput.value, batchCount: batchCountInput.value };
  for (const key of preferenceNames) storageSet(`videogen.${key}`, values[key]);
}
function restoreSettings() {
  for (const key of privateStorageKeys) storageRemove(key);
  if (!storageGet("videogen.migrated")) {
    for (const key of preferenceNames) { const old = storageGet(`sora2app.${key}`); if (old && !storageGet(`videogen.${key}`)) storageSet(`videogen.${key}`, old); storageRemove(`sora2app.${key}`); }
    storageRemove("sora2app.mode"); storageSet("videogen.migrated", "1");
  }
  return Object.fromEntries(preferenceNames.map((key) => [key, storageGet(`videogen.${key}`)]));
}
function scheduleEstimate() {
  clearTimeout(estimateTimer); const revision = ++estimateRevision;
  lastEstimate = null; updateSummary();
  if (isFilePreview || busy) return;
  estimateTimer = setTimeout(async () => {
    const payload = readForm(); if (!payload.model || !payload.prompt) return;
    try { const result = await apiRequest("/api/estimate", payload); if (revision !== estimateRevision) return; lastEstimate = result; updateSummary(); }
    catch { /* Final submission reports validation errors. */ }
  }, 400);
}
function setBusy(value) {
  busy = value;
  if (value) {
    disabledControls = new Map([...form.querySelectorAll("input, select, textarea, button")].map((element) => [element, element.disabled]));
    for (const element of disabledControls.keys()) element.disabled = true;
  } else {
    for (const [element, disabled] of disabledControls) element.disabled = disabled;
    disabledControls.clear();
    syncOptionControls();
  }
  updateSelectedKeyStatus();
}
async function generateVideo(event) {
  event.preventDefault(); if (busy) return;
  const payload = readForm(); setBusy(true); clearTimeout(estimateTimer); estimateRevision += 1;
  try {
    validateSelection(payload);
    const reference = await validateInputReferenceSelection(payload);
    lastEstimate = await apiRequest("/api/estimate", payload); updateSummary();
    const estimate = estimateText();
    const budget = payload.budget ? `\n${t("budgetLabel")}: ${formatCost(payload.budget)}` : "";
    if (!await confirmAction(t("confirmGenerate", { count: formatInteger(lastEstimate.count), cost: estimate.cost, eta: estimate.eta }) + budget)) return;
    if (apiKeyInput.value) await saveSelectedKey();
    const result = await apiRequest("/api/batches", payload, "POST", reference?.file);
    persistSettings(); formMessage(t("batchEnqueued", { count: result.count }));
    queueView.batchFilter = result.id; queueView.jobPage = 0; queueView.jobCursors = [null];
    await queueView.refresh();
  } catch (error) { formMessage(error.message, true); }
  finally { setBusy(false); }
}
function applyTranslations() {
  document.documentElement.lang = t("htmlLang"); document.title = t("documentTitle");
  languageInput.value = activeLanguage; languageInput.setAttribute("aria-label", t("languageLabel"));
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelector(".controls-panel").setAttribute("aria-label", t("controlsAria"));
  document.querySelector(".monitor-panel").setAttribute("aria-label", t("queueTitle"));
  document.querySelector(".summary-grid").setAttribute("aria-label", t("summaryAria"));
  promptInput.placeholder = t("promptPlaceholder"); outputDirInput.placeholder = t("outputDirPlaceholder"); filenameInput.placeholder = t("filenamePlaceholder");
  inputReferenceInput.setAttribute("aria-label", t("inputReferenceLabel"));
  toggleApiKeyButton.textContent = t(apiKeyInput.type === "password" ? "showApiKey" : "hideApiKey");
  setConnectionState(connectionStateKey); renderProxyInfo(); renderProviders(providerInput.value); renderModels(modelInput.value); syncOptionControls();
  queueView?.render();
}
function setLanguage(language) { activeLanguage = normalizeLanguage(language); applyTranslations(); storageSet("videogen.language", activeLanguage); }
async function refreshCatalog() {
  if (busy || !supportsCatalogRefresh()) return;
  const button = document.querySelector("#refreshCatalogButton"); button.disabled = true;
  try { const lane = formLane(); const result = await apiRequest(`/api/catalog/refresh/${lane.provider}`, lane); if (result.providers) providers = result.providers; renderProviders(providerInput.value); renderModels(modelInput.value); syncOptionControls(); scheduleEstimate(); formMessage(t(result.refreshed ? "catalogRefreshed" : "catalogFallback")); }
  catch (error) { formMessage(error.message, true); }
  finally { button.disabled = busy || !supportsCatalogRefresh(); }
}
async function init() {
  const restored = restoreSettings(); activeLanguage = normalizeLanguage(restored.language || "zh");
  let loadError = null;
  if (!isFilePreview) {
    try { const data = await apiRequest("/api/catalog"); if (!Array.isArray(data.providers) || !data.providers.length) throw new Error(t("noModels")); providers = data.providers; platform = data.platform; proxyInfo = data.proxy || null; }
    catch (error) { loadError = error; }
  }
  renderProviders(restored.provider); chooseLane(); renderModels(restored.model); syncOptionControls();
  for (const [name, input] of [["seconds", secondsInput], ["size", sizeInput], ["aspectRatio", aspectRatioInput]]) if ([...input.options].some((option) => option.value === restored[name])) input.value = restored[name];
  batchCountInput.value = String(Number.isSafeInteger(Number(restored.batchCount)) && Number(restored.batchCount) > 0 ? restored.batchCount : 1);
  selectOutputDirButton.hidden = isFilePreview || platform !== "darwin";
  queueView = new QueueView(); applyTranslations();
  if (loadError) formMessage(t("loadCatalogError", { message: loadError.message }), true);
  else formMessage(t(isFilePreview ? "previewReadyLog" : "readyLog"));
  await queueView.run(() => queueView.start());
}
form.addEventListener("submit", generateVideo);
saveKeyButton.addEventListener("click", async () => { saveKeyButton.disabled = true; try { await saveSelectedKey(); } catch (error) { formMessage(error.message, true); } finally { saveKeyButton.disabled = false; } });
deleteKeyButton.addEventListener("click", async () => { const existing = queueView.keys.find((item) => sameLane(item.lane, formLane())); if (!existing) return; try { await apiRequest(`/api/keys/${existing.lane.id}`, undefined, "DELETE"); await queueView.loadLanes(); } catch (error) { formMessage(error.message, true); } });
toggleApiKeyButton.addEventListener("click", () => { apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password"; toggleApiKeyButton.textContent = t(apiKeyInput.type === "password" ? "showApiKey" : "hideApiKey"); });
selectOutputDirButton.addEventListener("click", async () => { selectOutputDirButton.disabled = true; try { const data = await apiRequest("/api/select-output-dir", {}); if (data.path) outputDirInput.value = data.displayPath || data.path; } catch (error) { formMessage(error.message, true); } finally { selectOutputDirButton.disabled = false; } });
document.querySelector("#refreshCatalogButton").addEventListener("click", refreshCatalog);
inputReferenceInput.addEventListener("change", handleInputReferenceChange);
clearInputReferenceButton.addEventListener("click", clearInputReference);
languageInput.addEventListener("change", () => setLanguage(languageInput.value));
providerInput.addEventListener("change", () => { chooseLane(); persistSettings(); });
baseUrlInput.addEventListener("input", () => { apiKeyInput.value = ""; updateSelectedKeyStatus(); scheduleEstimate(); });
apiKeyInput.addEventListener("input", updateSelectedKeyStatus);
modelInput.addEventListener("change", () => { syncOptionControls(); scheduleEstimate(); persistSettings(); });
for (const input of [customDurationsInput, customResolutionsInput, customAspectRatiosInput, customFirstFrameInput, customAudioInput]) input.addEventListener("change", () => { syncOptionControls(); scheduleEstimate(); });
for (const input of [promptInput, batchCountInput, customModelInput]) input.addEventListener("input", () => { updatePromptMeta(); scheduleEstimate(); });
for (const input of [secondsInput, sizeInput, aspectRatioInput, audioInput, seedInput, requestFormatInput]) input.addEventListener("change", () => { updateInputReferenceMeta(); scheduleEstimate(); persistSettings(); });
init();
