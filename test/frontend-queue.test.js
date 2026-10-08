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
  assert.equal((`${appSource}\n${queue}`.match(/await confirmAction\(/g) || []).length, 6);
});
