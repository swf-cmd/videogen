const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const publicDir = path.join(__dirname, "../public");
const apiSource = fs.readFileSync(path.join(publicDir, "api.js"), "utf8");
const appSource = fs.readFileSync(path.join(publicDir, "app.js"), "utf8");
const helpers = vm.runInNewContext(`${apiSource}\n({sameLane, normalizedBaseUrl, insecureCredentialLane, canRetryJob, canCancelJob, modelRetiring})`, { URL });

test("UI key presence is bound to provider, region, endpoint path and port", () => {
  const lane = { provider: "openai-compatible", region: "custom", baseUrl: "http://LOCALHOST:8080/lane-a/v1/" };
  assert.equal(helpers.sameLane(lane, { ...lane, baseUrl: "http://localhost:8080/lane-a/v1" }), true);
  for (const patch of [{ provider: "other" }, { region: "other" }, { baseUrl: "http://localhost:8081/lane-a/v1" }, { baseUrl: "http://localhost:8080/lane-b/v1" }, { baseUrl: "http://localhost:8080/lane-a/v1?key=secret" }]) assert.equal(helpers.sameLane(lane, { ...lane, ...patch }), false);
  assert.equal(helpers.sameLane({ provider: "x", baseUrl: "invalid" }, { provider: "x", baseUrl: "invalid" }), false);
});

test("plaintext warnings cover saved credentials while excluding real loopback hosts", () => {
  for (const baseUrl of ["http://192.168.1.5/v1", "http://localhost.example/v1", "http://127.example/v1"]) {
    assert.equal(helpers.insecureCredentialLane({ baseUrl }, true), true);
    assert.equal(helpers.insecureCredentialLane({ baseUrl }, false), false);
  }
  for (const baseUrl of ["https://example.test/v1", "http://localhost/v1", "http://127.0.0.1/v1", "http://127.0.0.2/v1", "http://[::1]/v1"]) assert.equal(helpers.insecureCredentialLane({ baseUrl }, true), false);
});

test("UI never offers automatic retry or generic cancellation for an uncertain create", () => {
  for (const state of ["needs_review", "running", "downloading", "succeeded", "cancelled", "result_expired"]) assert.equal(helpers.canRetryJob({ state, error: { definitelyNotAccepted: true } }), false);
  assert.equal(helpers.canRetryJob({ state: "failed", error: { definitelyNotAccepted: true } }), true);
  assert.equal(helpers.canRetryJob({ state: "failed", error: { definitelyNotAccepted: false } }), false);
  assert.equal(helpers.canRetryJob({ state: "failed", remote: { id: "paid-job" }, error: { definitelyNotAccepted: true } }), false);
  assert.equal(helpers.canCancelJob({ state: "needs_review" }), false);
  assert.equal(helpers.canCancelJob({ state: "running", cancelRequested: true }), false);
});

test("retirement badges use the catalog date and the next 30 days", () => {
  const now = Date.parse("2026-10-08T00:00:00Z");
  assert.equal(helpers.modelRetiring({ deprecatesAt: "2026-11-07" }, now), true);
  assert.equal(helpers.modelRetiring({ deprecatesAt: "2026-11-08" }, now), false);
  assert.equal(helpers.modelRetiring({ deprecatesAt: "2026-10-01" }, now), true);
  assert.equal(helpers.modelRetiring({}, now), false);
});

test("legacy preference migration removes secrets and paths and only copies allowed preferences", () => {
  const data = new Map([["sora2app.apiKey", "secret"], ["videogen.apiKey", "secret2"], ["sora2app.outputDir", "/private/a"], ["videogen.outputDir", "/private/b"], ["sora2app.language", "ko"], ["sora2app.model", "old"], ["videogen.model", "new"]]);
  const listSource = appSource.slice(appSource.indexOf("const preferenceNames"), appSource.indexOf("const previewCatalog"));
  const functionSource = appSource.slice(appSource.indexOf("function restoreSettings()"), appSource.indexOf("function scheduleEstimate()"));
  const restore = vm.runInNewContext(`${listSource}\n${functionSource}\nrestoreSettings`, { storageGet: (key) => data.get(key), storageSet: (key, value) => data.set(key, value), storageRemove: (key) => data.delete(key) });
  const preferences = restore();
  assert.equal(preferences.language, "ko");
  assert.equal(preferences.model, "new");
  for (const key of ["sora2app.apiKey", "videogen.apiKey", "sora2app.outputDir", "videogen.outputDir", "sora2app.language", "sora2app.model"]) assert.equal(data.has(key), false, key);
  data.set("sora2app.apiKey", "reintroduced-secret");
  restore();
  assert.equal(data.has("sora2app.apiKey"), false, "private values are removed even after the one-time migration");
});

test("batch form cannot send a key in a native GET fallback or its API payload", () => {
  const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  assert.match(html.match(/<form\b[^>]*id="generateForm"[^>]*>/)[0], /method="post"/);
  assert.doesNotMatch(html.match(/<input\b[^>]*id="apiKey"[^>]*>/)[0], /\bname=/);
  const read = appSource.slice(appSource.indexOf("function readForm()"), appSource.indexOf("function validateSelection("));
  const field = (value) => ({ value });
  const readForm = vm.runInNewContext(`${read}\nreadForm`, {
    selectedCapabilities: () => ({ audio: false, seed: false }), formLane: () => ({ provider: "openai-compatible", region: "custom", baseUrl: "http://localhost/v1" }), activeLanguage: "en", isCustomModel: () => false,
    modelInput: field("example"), secondsInput: field("5"), sizeInput: field("720p"), aspectRatioInput: field("16:9"), audioInput: { checked: false }, requestFormatInput: field("json"), promptInput: field("Example"), requestCountForEstimate: () => 1, outputDirInput: field("/tmp/output"), filenameInput: field("test"), budgetInput: { disabled: true }, apiKeyInput: field("secret-must-not-go-in-batches"),
  });
  const payload = readForm();
  assert.equal(payload.prompt, "Example");
  assert.ok(!JSON.stringify(payload).includes("secret-must-not-go-in-batches"));
  assert.equal(Object.hasOwn(payload, "apiKey"), false);
  assert.equal(Object.hasOwn(payload, "key"), false);
});

test("file preview rejects API calls before network access and catalog metadata has four-language labels", async () => {
  let called = false;
  const request = vm.runInNewContext(`${apiSource}\napiRequest`, { isFilePreview: true, t: (key) => key, fetch: () => { called = true; } });
  await assert.rejects(request("/api/batches", {}), /filePreviewGenerateError/);
  assert.equal(called, false);
  const translations = vm.runInNewContext(`${fs.readFileSync(path.join(publicDir, "i18n.js"), "utf8")}\ntranslations`);
  const catalogs = fs.readdirSync(path.join(__dirname, "../data/catalog")).filter((name) => name.endsWith(".json"));
  for (const name of catalogs) {
    const text = fs.readFileSync(path.join(__dirname, "../data/catalog", name), "utf8");
    for (const [, key] of text.matchAll(/"(?:labelKey|availabilityNoteKey|warningKey|pricingNoteKey|firstFrameNoteKey|manualRecoveryNoteKey)"\s*:\s*"([^"]+)"/g)) {
      for (const language of ["zh", "ja", "en", "ko"]) assert.equal(typeof translations[language][key], "string", `${name}: ${language}.${key}`);
    }
  }
});

test("catalog refresh is unavailable in preview or providers without model discovery", async () => {
  const support = appSource.slice(appSource.indexOf("function supportsCatalogRefresh()"), appSource.indexOf("function syncOptionControls()"));
  const refresh = appSource.slice(appSource.indexOf("async function refreshCatalog()"), appSource.indexOf("async function init()"));
  for (const preview of [false, true]) for (const provider of ["openrouter", "gemini", "dashscope", "ark", "mock", "openai-compatible"]) {
    let requests = 0;
    const context = { isFilePreview: preview, selectedLane: () => ({ provider: { provider } }), busy: false, apiRequest: () => { requests += 1; } };
    const result = vm.runInNewContext(`${support}\n${refresh}\n({ supportsCatalogRefresh, refreshCatalog })`, context);
    assert.equal(result.supportsCatalogRefresh(), !preview && provider === "openrouter");
    if (preview || provider !== "openrouter") { await result.refreshCatalog(); assert.equal(requests, 0); }
  }
});

test("proxy panel shows effective sanitized values as text and makes disabled and preview states explicit", () => {
  const source = appSource.slice(appSource.indexOf("function renderProxyInfo()"), appSource.indexOf("function formMessage("));
  const ids = ["#proxyInfo", "#proxyStatus", "#proxyHttp", "#proxyHttps", "#proxyBypass"];
  const elements = Object.fromEntries(ids.map((id) => [id, { hidden: false, textContent: "", set innerHTML(value) { throw new Error("Proxy values must be plain text"); } }]));
  const context = { document: { querySelector: (id) => elements[id] }, isFilePreview: false, t: (key) => key, proxyInfo: { enabled: true, http: "http://[REDACTED]@proxy.example:8080", https: "http://<proxy>:8080", noProxy: "localhost,127.0.0.1,::1,.aliyuncs.com" } };
  const render = vm.runInNewContext(`${source}\nrenderProxyInfo`, context);
  render();
  assert.equal(elements["#proxyInfo"].hidden, false);
  assert.equal(elements["#proxyStatus"].textContent, "proxyEnabled");
  assert.equal(elements["#proxyHttp"].textContent, context.proxyInfo.http);
  assert.equal(elements["#proxyHttps"].textContent, context.proxyInfo.https);
  assert.equal(elements["#proxyBypass"].textContent, context.proxyInfo.noProxy);
  context.proxyInfo.enabled = false;
  render();
  assert.equal(elements["#proxyStatus"].textContent, "proxyDisabled");
  assert.equal(elements["#proxyHttp"].textContent, "proxyDirect");
  assert.equal(elements["#proxyHttps"].textContent, "proxyDirect");
  assert.equal(elements["#proxyBypass"].textContent, "proxyAllDirect");
  context.proxyInfo = { enabled: true, http: null, https: null, noProxy: "localhost" };
  render();
  assert.equal(elements["#proxyHttp"].textContent, "proxyDirect");
  context.isFilePreview = true;
  render();
  assert.equal(elements["#proxyInfo"].hidden, true);
  context.isFilePreview = false; context.proxyInfo = null;
  render();
  assert.equal(elements["#proxyInfo"].hidden, true);
});

test("HTML confirmations require an explicit click, preserve risk text and default to cancellation", async () => {
  const source = fs.readFileSync(path.join(publicDir, "dialog.js"), "utf8");
  const document = { activeElement: null };
  class Element extends EventTarget {
    constructor() { super(); this.isConnected = true; this.open = false; this.textContent = ""; }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatchEvent(new Event("close")); }
    set innerHTML(value) { throw new Error("Confirmation text must never be interpreted as HTML"); }
  }
  const elements = Object.fromEntries(["#confirmDialog", "#confirmAccept", "#confirmCancel", "#confirmTitle", "#confirmMessage"].map((id) => [id, new Element()]));
  document.querySelector = (id) => elements[id];
  const prior = new Element(); prior.focus();
  const confirm = vm.runInNewContext(`${source}\nconfirmAction`, { document, t: (key) => key });
  const warning = "A prior request may already be charged. <b>Duplicate charges are possible.</b>";
  let settled = false;
  const first = confirm(warning, { danger: true });
  first.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(elements["#confirmMessage"].textContent, warning);
  assert.equal(elements["#confirmAccept"].className, "secondary danger-action");
  assert.equal(document.activeElement, elements["#confirmCancel"]);
  assert.equal(await confirm("An overlapping action"), false);
  assert.equal(elements["#confirmMessage"].textContent, warning, "overlapping requests cannot replace the current decision");
  elements["#confirmAccept"].dispatchEvent(new Event("click"));
  assert.equal(await first, true);
  assert.equal(document.activeElement, prior);
  const second = confirm("Cancel by keyboard");
  const escape = new Event("cancel", { cancelable: true });
  elements["#confirmDialog"].dispatchEvent(escape);
  assert.equal(await second, false);
  assert.equal(escape.defaultPrevented, true);
  const third = confirm("Cancel by button");
  elements["#confirmCancel"].dispatchEvent(new Event("click"));
  assert.equal(await third, false);
  const fourth = confirm("Unexpected dialog close");
  elements["#confirmDialog"].close();
  assert.equal(await fourth, false);
  const queue = fs.readFileSync(path.join(publicDir, "queue-view.js"), "utf8");
  assert.doesNotMatch(`${appSource}\n${queue}`, /window\.confirm\s*\(/);
  assert.equal((`${appSource}\n${queue}`.match(/await confirmAction\(/g) || []).length, 8);
});

test("budget values survive disabled controls and bind to the fresh estimate before confirmation", async () => {
  const read = appSource.slice(appSource.indexOf("function readForm()"), appSource.indexOf("function validateSelection("));
  const field = (value) => ({ value });
  const payload = vm.runInNewContext(`${read}\nreadForm()`, {
    selectedCapabilities: () => ({ audio: false, seed: false }), formLane: () => ({ provider: "mock", region: "local", baseUrl: "http://localhost/v1" }), activeLanguage: "en", isCustomModel: () => false,
    modelInput: field("example"), secondsInput: field("5"), sizeInput: field("720p"), aspectRatioInput: field("16:9"), audioInput: { checked: false }, promptInput: field("A fox"), requestCountForEstimate: () => 1, outputDirInput: field("/tmp/output"), filenameInput: field("test"), budgetInput: { disabled: true, value: "12.5" }, lastEstimate: null,
  });
  assert.equal(payload.budget.amount, 12.5);
  const generate = appSource.slice(appSource.indexOf("async function generateVideo("), appSource.indexOf("function applyTranslations()"));
  for (const cost of [{ amount: 2, currency: "CNY" }, { amount: null, currency: "CNY" }]) {
    const calls = [], messages = [], confirmations = [];
    const context = { document: { activeElement: null }, busy: false, readForm: () => structuredClone(payload), setBusy() {}, clearTimeout() {}, estimateTimer: null, estimateRevision: 0, validateSelection() {}, validateInputReferenceSelection: async () => null, batchEditor: { setEstimates() {} }, updateSummary() {}, lastEstimate: null,
      apiRequest: async (endpoint, value) => { calls.push({ endpoint, value }); return endpoint === "/api/estimate" ? { cost, count: 1, valid: true } : { id: "batch", count: 1 }; },
      estimateText: () => ({ cost: "cost", eta: "eta" }), t: (key) => key, formatCost: (value) => `${value.amount} ${value.currency}`, formatInteger: String, confirmAction: async (text) => { confirmations.push(text); return true; }, apiKeyInput: { value: "" }, persistSettings() {}, formMessage: (text) => messages.push(text), queueView: { refresh: async () => {} },
    };
    await vm.runInNewContext(`${generate}\ngenerateVideo`, context)({ preventDefault() {} });
    assert.equal(calls[0].value.summaryOnly, true);
    if (cost.amount === null) { assert.equal(calls.length, 1); assert.deepEqual(confirmations, []); assert.deepEqual(messages, ["budgetUnknown"]); }
    else { assert.equal(calls[1].value.budget.amount, 12.5); assert.equal(calls[1].value.budget.currency, "CNY"); assert.match(confirmations[0], /12.5 CNY/); }
  }
});

test("queue updates preserve job controls, keyboard focus, expanded details and pending actions", async () => {
  const document = { activeElement: null };
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.events = {}; this.hidden = false; this.disabled = false; this.isConnected = true; this.className = ""; }
    set textContent(value) { this.text = String(value); this.children.forEach((child) => { child.parent = null; }); this.children = []; }
    get textContent() { return this.text || ""; }
    append(...elements) { for (const element of elements) this.insertBefore(element, null); }
    insertBefore(element, before) { element.remove(); const index = before ? this.children.indexOf(before) : this.children.length; this.children.splice(index, 0, element); element.parent = this; }
    remove() { if (this.parent) { const index = this.parent.children.indexOf(this); this.parent.children.splice(index, 1); this.parent = null; } }
    querySelector(selector) { return this.children.find((child) => selector.startsWith(".") ? child.className.split(" ").includes(selector.slice(1)) : child.tag === selector) || this.children.map((child) => child.querySelector(selector)).find(Boolean) || null; }
    setAttribute() {} addEventListener(event, callback) { this.events[event] = callback; } focus() { document.activeElement = this; }
  }
  const ids = Object.fromEntries(["jobsBody", "jobsPrevious", "jobsNext", "jobsPage", "jobsCount", "batchList", "batchPrevious", "batchNext", "batchPage"].map((id) => [`#${id}`, new Element("div")]));
  document.querySelector = (id) => ids[id]; document.createElement = (tag) => new Element(tag);
  const source = fs.readFileSync(path.join(publicDir, "queue-view.js"), "utf8");
  const QueueView = vm.runInNewContext(`${source}\nQueueView`, { document, t: (key) => key, formatCost: () => "1 USD", canCancelJob: (job) => job.state === "running" && !job.cancelRequested, canRetryJob: () => false, currentLocale: () => "en", formatInteger: String });
  const view = Object.create(QueueView.prototype); Object.assign(view, { jobs: new Map([["job", { id: "job", state: "running", prompt: "Scene", model: "demo", progress: 10 }]]), jobRows: new Map(), jobPage: 0, renderGallery() {} });
  view.renderJobs();
  const row = view.jobRows.get("job"), details = row.element.querySelector("details");
  row.cancel.focus(); details.open = true;
  let finish; const pending = view.run(() => new Promise((resolve) => { finish = resolve; }), row.cancel);
  view.jobs.set("job", { ...view.jobs.get("job"), progress: 50 }); view.renderJobs();
  assert.equal(view.jobRows.get("job"), row); assert.equal(ids["#jobsBody"].children[0], row.element);
  assert.equal(document.activeElement, row.cancel); assert.equal(details.open, true); assert.equal(row.cancel.disabled, true); assert.equal(row.progress.value, 50);
  finish(); await pending; assert.equal(row.cancel.disabled, false);
  view.jobs.set("job", { ...view.jobs.get("job"), error: { code: "invalid_request", category: "invalid_request", message: "Old localized summary", providerCode: "BadSeed", providerMessage: "seed must be non-negative" } });
  view.renderJobs();
  assert.equal(row.error.textContent, "errorInvalidRequest · BadSeed · seed must be non-negative");
  Object.assign(view, { batches: [{ id: "batch", state: "preparing", total: 50000, counts: { queued: 1000 } }], batchCards: new Map(), batchPage: 0, lanes: [], renderFilters() {} });
  view.renderBatches();
  const batch = view.batchCards.get("batch");
  assert.equal(batch.status.textContent, "statusPreparing"); assert.equal(batch.toggle.disabled, true); assert.equal(batch.cancel.disabled, true);
  view.batches[0] = { ...view.batches[0], state: "paused", pauseReason: "interrupted_enqueue", total: 1000 }; view.renderBatches();
  assert.equal(view.batchCards.get("batch"), batch); assert.match(batch.status.textContent, /reasonInterruptedEnqueue/); assert.equal(batch.toggle.disabled, false);
});

test("browser image fitting and backend requests share dimensions including 4K portrait output", () => {
  const dimensionsSource = fs.readFileSync(path.join(publicDir, "pixel-size.js"), "utf8");
  const browser = vm.runInNewContext(`${dimensionsSource}\nVideoDimensions`);
  const backend = require("../src/pixel-size");
  const adapter = require("../src/providers/openai-compatible");
  const selectionSource = appSource.slice(appSource.indexOf("function selectedImageSize("), appSource.indexOf("function estimateText("));
  const selected = vm.runInNewContext(`${selectionSource}\nselectedImageSize`, { VideoDimensions: browser, sizeInput: { value: "4K" }, aspectRatioInput: { value: "16:9" } });
  assert.equal(selected(), "3840x2160");
  for (const [params, expected] of [[{ resolution: "4K", aspectRatio: "16:9" }, "3840x2160"], [{ resolution: "4k", aspectRatio: "9:16" }, "2160x3840"], [{ resolution: "4K", aspectRatio: "1:1" }, "2160x2160"], [{ resolution: "720P", aspectRatio: "4:3" }, "960x720"], [{ resolution: "1280x720" }, "1280x720"]]) {
    assert.equal(browser.pixelSize(params), expected); assert.equal(backend.pixelSize(params), expected); assert.equal(adapter.pixelSize(params), expected); assert.equal(selected(params), expected);
  }
  for (const params of [{ resolution: "nonsense", aspectRatio: "16:9" }, { resolution: "4K", aspectRatio: "0:1" }, { resolution: "0x720" }]) { assert.equal(browser.pixelSize(params), ""); assert.throws(() => adapter.pixelSize(params), /invalidParameter/); }
});
