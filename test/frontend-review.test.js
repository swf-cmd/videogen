const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const publicDir = path.join(__dirname, "../public");
const source = fs.readFileSync(path.join(publicDir, "queue-view.js"), "utf8");
const styles = fs.readFileSync(path.join(publicDir, "styles.css"), "utf8");

// A minimal DOM: element tree, attributes, classes, focus with focusin
// bubbling, simple selectors and the media methods the gallery uses.
function fakeDom() {
  const document = { activeElement: null, visibilityState: "visible", hasFocus: () => true };
  const matches = (element, selector) => selector.split(",").some((part) => {
    const value = part.trim();
    if (value === "[hidden]") return element.hidden === true;
    if (value.startsWith(".")) return element.classes.has(value.slice(1));
    if (value.startsWith("#")) return element.id === value.slice(1);
    return element.tagName === value.toUpperCase();
  });
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.hidden = false; this.disabled = false; this.text = ""; this.classes = new Set(); this.tabIndex = tag === "button" ? 0 : -1; this.value = ""; this.options = []; this.paused = true; this.id = ""; }
    get className() { return [...this.classes].join(" "); }
    set className(value) { this.classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
    get classList() { const classes = this.classes; return { toggle: (name, force = !classes.has(name)) => { if (force) classes.add(name); else classes.delete(name); return force; }, contains: (name) => classes.has(name), add: (name) => classes.add(name), remove: (name) => classes.delete(name) }; }
    get textContent() { return this.text; }
    set textContent(value) { this.text = String(value); for (const child of this.children) child.parent = null; this.children = []; }
    get isConnected() { for (let node = this; node; node = node.parent) if (node === document.body) return true; return false; }
    append(...children) { for (const child of children) this.insertBefore(child, null); }
    insertBefore(child, before) { if (child.parent) child.remove(); const index = before ? this.children.indexOf(before) : -1; this.children.splice(index < 0 ? this.children.length : index, 0, child); child.parent = this; }
    remove() {
      if (!this.parent) return;
      const focused = document.activeElement && this.contains(document.activeElement);
      this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null;
      if (focused) document.activeElement = document.body;
    }
    contains(other) { for (let node = other; node; node = node.parent) if (node === this) return true; return false; }
    closest(selector) { for (let node = this; node; node = node.parent) if (matches(node, selector)) return node; return null; }
    querySelector(selector) { for (const child of this.children) { if (matches(child, selector)) return child; const found = child.querySelector(selector); if (found) return found; } return null; }
    querySelectorAll(selector) { return this.children.flatMap((child) => [...(matches(child, selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    removeAttribute(name) { delete this.attributes[name]; if (name === "src") this.src = undefined; }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    dispatch(type, event = {}) { return Promise.all((this.listeners[type] || []).map((callback) => callback({ target: this, ...event }))); }
    focus() {
      if (this.hidden || this.disabled || !this.isConnected) return;
      document.activeElement = this;
      for (let node = this; node; node = node.parent) for (const callback of node.listeners.focusin || []) callback({ target: this });
    }
    scrollIntoView() {}
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    showModal() { this.open = true; }
    close() { this.open = false; for (const callback of this.listeners.close || []) callback({}); }
  }
  document.body = new Element("body");
  const ids = new Map();
  document.createElement = (tag) => new Element(tag);
  document.querySelector = (selector) => {
    if (!ids.has(selector)) { const element = new Element("div"); element.id = selector.slice(1); document.body.append(element); ids.set(selector, element); }
    return ids.get(selector);
  };
  return { document, Element };
}

function harness(overrides = {}) {
  const dom = fakeDom();
  const calls = [], confirmations = [], timers = [], states = [], storage = new Map(), notifications = [];
  const t = (key, values) => values ? `${key}${JSON.stringify(values)}` : key;
  const context = {
    document: dom.document, window: { focus() {}, addEventListener() {} }, URLSearchParams, isFilePreview: false,
    t, formatCost: (cost) => Number.isFinite(cost?.amount) ? `${cost.amount} ${cost.currency}` : "unknown", formatInteger: String, currentLocale: () => "en-US",
    canCancelJob: (job) => ["queued", "running"].includes(job.state) && !job.cancelRequested,
    canRetryJob: (job) => job.state === "failed" && job.error?.definitelyNotAccepted === true && !job.remote?.id,
    confirmAction: async (text) => { confirmations.push(text); return context.accept !== false; },
    apiRequest: async (endpoint, payload) => {
      calls.push({ endpoint, payload });
      if (endpoint.endsWith("/curate")) return { selection: payload.selection, reviewedAt: "2026-10-09T00:00:00Z" };
      return context.reply ? context.reply(endpoint, payload) : {};
    },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    setConnectionState: (state) => states.push(state), updateSelectedKeyStatus() {}, scheduleEstimate() {}, selectExistingLane() {},
    laneName: (lane) => `${lane.provider}·${lane.region}`, sameLane: () => false, insecureCredentialLane: () => false,
    fillSelect: (select, values, selected, label) => { select.options = values.map((value) => ({ value, text: label(value) })); select.value = selected; },
    storageGet: (key) => storage.get(key) ?? null, storageSet: (key, value) => storage.set(key, value),
    providers: [],
    ...overrides,
  };
  const QueueView = vm.runInNewContext(`${source}\nQueueView`, context);
  const view = new QueueView();
  view.refresh = async () => {};
  const grid = dom.document.querySelector("#galleryGrid");
  const press = (target, key, extra = {}) => { let prevented = false; for (const callback of grid.listeners.keydown) callback({ key, target, preventDefault() { prevented = true; }, ...extra }); return prevented; };
  const settle = () => new Promise(setImmediate);
  return { view, dom, document: dom.document, context, calls, confirmations, timers, states, storage, notifications, grid, press, settle, t };
}

const take = (id, shot, takeNumber, extra = {}) => ({ id, batchId: "b1", index: shot * 3 + (takeNumber || 1) - 1, shot, ...(takeNumber ? { take: takeNumber, takes: 3 } : {}), state: "succeeded", output: { path: `/out/${id}.mp4` }, prompt: `Prompt ${shot + 1}`, model: "model", selection: "unreviewed", costEstimate: { amount: 1, currency: "USD" }, ...extra });
const plain = (value) => JSON.parse(JSON.stringify(value));
const gridOrder = (grid) => grid.children.map((child) => child.dataset.jobId || `[${child.textContent}]`);

test("gallery groups takes by batch and shot, labels them, and orders cards by shot then take", () => {
  const app = harness();
  const jobs = [take("s1t2", 0, 2), take("s2t1", 1, 1), take("s1t1", 0, 1), take("retake", 0, null, { parentJobId: "s1t1", index: 9 }), take("other", 0, null, { batchId: "b2", index: 0 })];
  app.view.jobs = new Map(jobs.map((job) => [job.id, job]));
  app.view.renderJobs();
  assert.deepEqual(gridOrder(app.grid), ["[batch b1]", '[shotGroup{"shot":1,"count":3}]', "s1t1", "s1t2", "retake", '[shotGroupOne{"shot":2,"count":1}]', "s2t1", "[batch b2]", "other"]);
  const label = (id) => app.view.galleryCards.get(id).shot.textContent;
  assert.equal(label("s1t2"), 'shotTake{"shot":1,"take":2}');
  assert.equal(label("retake"), 'shotRetake{"shot":1}');
  assert.equal(label("other"), 'shotOnly{"shot":1}', "a single-take batch keeps a plain shot label and no shot heading");
  const legacy = harness();
  legacy.view.jobs = new Map([["old", { ...take("old", 0, null), shot: undefined, index: 4 }]]);
  legacy.view.renderJobs();
  assert.equal(legacy.view.galleryCards.get("old").shot.textContent, 'shotOnly{"shot":5}', "jobs from before takes fall back to their index");
});

test("filtered gallery cards keep task order when selections change (insert by index)", () => {
  const app = harness();
  app.view.jobs = new Map(["a", "b", "c", "d"].map((id, index) => [id, take(id, index, null)]));
  app.view.gallerySelection = "keep";
  app.view.jobs.get("d").selection = "keep"; app.view.renderGallery();
  app.view.jobs.get("a").selection = "keep"; app.view.renderGallery();
  assert.deepEqual(gridOrder(app.grid), ["a", "d"]);
  app.view.jobs.get("c").selection = "keep"; app.view.renderGallery();
  assert.deepEqual(gridOrder(app.grid), ["a", "c", "d"]);
});

test("keyboard review uses a roving tab stop, moves with J/K and arrows, and decides with 1/2/3 then advances to the next unreviewed take", async () => {
  const app = harness();
  app.view.jobs = new Map([take("t1", 0, 1), take("t2", 0, 2), take("t3", 0, 3), take("u1", 1, 1)].map((job) => [job.id, job]));
  app.view.renderJobs();
  const card = (id) => app.view.galleryCards.get(id).element;
  const stops = () => [...app.view.galleryCards.values()].map((item) => item.element.tabIndex).join(",");
  assert.equal(stops(), "0,-1,-1,-1", "exactly one card is in the tab order");
  card("t1").focus();
  assert.equal(app.press(card("t1"), "j"), true); assert.equal(app.document.activeElement, card("t2")); assert.equal(stops(), "-1,0,-1,-1");
  app.press(card("t2"), "ArrowRight"); assert.equal(app.document.activeElement, card("t3"));
  app.press(card("t3"), "K"); app.press(card("t2"), "ArrowLeft"); assert.equal(app.document.activeElement, card("t1"));
  app.press(card("t1"), "k"); assert.equal(app.document.activeElement, card("t1"), "movement stops at the first card");

  app.press(card("t1"), "1"); await app.settle();
  assert.deepEqual(plain(app.calls.at(-1)), { endpoint: "/api/jobs/t1/curate", payload: { selection: "keep" } });
  assert.equal(app.view.jobs.get("t1").selection, "keep"); assert.equal(card("t1").dataset.selection, "keep");
  assert.equal(app.view.galleryCards.get("t1").selections.keep.getAttribute("aria-pressed"), "true");
  assert.equal(app.document.activeElement, card("t2"), "Keep advances to the next unreviewed take");
  assert.equal(app.document.querySelector("#galleryAnnouncer").textContent, 'galleryAnnounce{"label":"shotTake{\\"shot\\":1,\\"take\\":1}","selection":"selectionKeep","count":3}');
  assert.ok(app.timers.length, "summary counts refresh shortly after, without blocking the next decision");

  app.press(card("t2"), "2"); await app.settle();
  assert.equal(app.view.jobs.get("t2").selection, "reject"); assert.equal(app.document.activeElement, card("t3"));
  app.view.jobs.set("u1", { ...app.view.jobs.get("u1"), selection: "keep" }); app.view.renderGallery();
  app.press(card("t3"), "1"); await app.settle();
  assert.equal(app.document.activeElement, card("t3"), "with nothing left to review, focus stays");
  assert.match(app.document.querySelector("#galleryAnnouncer").textContent, /^galleryAnnounceDone/);
  app.press(card("t3"), "u"); await app.settle();
  assert.equal(app.view.jobs.get("t3").selection, "unreviewed"); assert.equal(app.document.activeElement, card("t3"), "resetting to unreviewed does not advance");

  const video = app.view.galleryCards.get("t3").video;
  assert.equal(app.press(card("t3"), " "), true); assert.equal(video.paused, false);
  app.press(card("t3"), " "); assert.equal(video.paused, true);
  assert.equal(app.press(app.view.galleryCards.get("t3").selections.keep, " "), false, "Space on a button keeps its native activation");
  assert.equal(app.press(card("t3"), "Enter"), true);
  assert.equal(card("t3").classList.contains("is-expanded"), true); assert.equal(app.view.galleryCards.get("t3").expand.getAttribute("aria-expanded"), "true");
  app.press(card("t3"), "Escape"); assert.equal(card("t3").classList.contains("is-expanded"), false);

  const before = app.calls.length;
  assert.equal(app.press(card("t3"), "1", { ctrlKey: true }), false);
  assert.equal(app.press(app.dom.document.createElement("input"), "1"), false);
  assert.equal(app.press(video, "ArrowRight"), false, "arrows on a focused video keep seeking");
  assert.equal(app.press(video, "j"), true);
  assert.equal(app.calls.length, before, "ignored keys never curate");
});

test("removing the focused card under the Unreviewed filter moves focus to the next card, then the previous one, then the grid", async () => {
  const app = harness();
  app.view.jobs = new Map(["a", "b", "c"].map((id, index) => [id, take(id, index, null)]));
  app.view.gallerySelection = "unreviewed";
  app.view.renderJobs();
  const reject = (id) => app.view.galleryCards.get(id).selections.reject;
  reject("b").focus(); await reject("b").dispatch("click");
  assert.equal(app.view.galleryCards.has("b"), false);
  assert.equal(app.document.activeElement, app.view.galleryCards.get("c").element);
  reject("c").focus(); await reject("c").dispatch("click");
  assert.equal(app.document.activeElement, app.view.galleryCards.get("a").element);
  assert.equal(app.view.galleryCards.get("a").element.tabIndex, 0);
  reject("a").focus(); await reject("a").dispatch("click");
  assert.equal(app.document.activeElement, app.grid);
});

test("gallery previews load near the viewport with a first-frame fragment and show the media duration", () => {
  const observed = [];
  class IntersectionObserver { constructor(callback, options) { this.callback = callback; this.options = options; observed.push(this); this.targets = new Set(); } observe(element) { this.targets.add(element); } unobserve(element) { this.targets.delete(element); } }
  const app = harness({ IntersectionObserver });
  app.view.jobs = new Map([["clip", take("clip", 0, null)]]);
  app.view.renderJobs();
  const card = app.view.galleryCards.get("clip");
  assert.equal(card.video.preload, "metadata"); assert.equal(card.video.src, undefined, "off-screen previews are not fetched");
  observed[0].callback([{ isIntersecting: true, target: card.element }]);
  assert.equal(card.video.src, "/api/jobs/clip/media#t=0.1");
  assert.equal(observed[0].targets.has(card.element), false);
  card.video.duration = 65; card.video.dispatch("loadedmetadata");
  assert.equal(card.meta.textContent, "model · 1 USD · 1:05");
  app.view.jobs.clear(); app.view.renderGallery();
  assert.equal(card.video.src, undefined, "a removed card releases its media");
  const eager = harness();
  eager.view.jobs = new Map([["clip", take("clip", 0, null)]]); eager.view.renderJobs();
  assert.equal(eager.view.galleryCards.get("clip").video.src, "/api/jobs/clip/media#t=0.1", "without IntersectionObserver previews still load");
});

test("long prompts use an expand toggle instead of an unfocusable scroll box", async () => {
  const app = harness();
  app.view.jobs = new Map([["clip", take("clip", 0, null, { prompt: "word ".repeat(200) })]]);
  app.view.renderJobs();
  const card = app.view.galleryCards.get("clip");
  assert.equal(card.expand.getAttribute("aria-controls"), card.prompt.id);
  assert.equal(card.expand.getAttribute("aria-expanded"), "false");
  await card.expand.dispatch("click");
  assert.equal(card.expand.getAttribute("aria-expanded"), "true"); assert.equal(card.expand.textContent, "collapseTake");
  const promptRule = styles.match(/\.gallery-prompt \{[^}]*\}/)[0];
  assert.doesNotMatch(promptRule, /overflow-y:\s*auto/); assert.match(promptRule, /line-clamp/);
});

test("the gallery summary live region is written only when its text changes", () => {
  const app = harness();
  const element = app.document.querySelector("#gallerySummary");
  let text = "", writes = 0;
  Object.defineProperty(element, "textContent", { get: () => text, set: (value) => { writes += 1; text = value; } });
  app.view.gallerySummary = { kept: 1, rejected: 0, unreviewed: 2, costs: [] };
  for (let index = 0; index < 5; index += 1) app.view.renderGallerySummary();
  assert.equal(writes, 1);
  app.view.gallerySummary = { ...app.view.gallerySummary, kept: 2 }; app.view.renderGallerySummary();
  assert.equal(writes, 2);
});

test("export links download the manifest for the selected batch", () => {
  const app = harness();
  app.view.renderGallery();
  assert.equal(app.document.querySelector("#exportKeptCsv").getAttribute("href"), "/api/export?selection=keep&format=csv");
  app.view.batchFilter = "batch one";
  app.view.renderGallery();
  assert.equal(app.document.querySelector("#exportKeptCsv").getAttribute("href"), "/api/export?selection=keep&format=csv&batch=batch+one");
  assert.equal(app.document.querySelector("#exportAllJson").getAttribute("href"), "/api/export?selection=all&format=json&batch=batch+one");
  const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  for (const id of ["exportKeptCsv", "exportKeptJson", "exportAllCsv", "exportAllJson"]) assert.match(html, new RegExp(`<a id="${id}"[^>]*\\bdownload\\b`));
});

test("lane controls follow the manual pause flag even while a missing key takes priority in the state", async () => {
  const app = harness();
  const lane = { id: "lane", provider: "mock", region: "local", baseUrl: "http://127.0.0.1", state: "needs_key", paused: true, pauseReason: "manual_pause", waitingForKey: 2, inFlight: 0, concurrency: 1, queued: 2 };
  app.view.lanes = [lane, { ...lane, id: "other", paused: false, pauseReason: null }];
  app.view.renderLanes();
  const card = app.view.laneCards.get("lane"), other = app.view.laneCards.get("other");
  assert.equal(card.toggle.textContent, "resume"); assert.equal(other.toggle.textContent, "pause");
  assert.equal(card.status.textContent, "laneNeedsKey · lanePaused");
  assert.match(card.warning.textContent, /needsKeyBanner/); assert.match(card.warning.textContent, /reasonManual/);
  assert.doesNotMatch(other.warning.textContent, /reasonManual/);
  await card.toggle.dispatch("click");
  assert.deepEqual(plain(app.calls.find((call) => call.endpoint === "/api/lanes/lane")), { endpoint: "/api/lanes/lane", payload: { action: "resume" } });
});

test("batches are labelled by local time and first prompt, keeping the short id visible", async () => {
  const id = "817e43a4-1111-2222-3333-444455556666";
  const app = harness({ reply: (endpoint) => endpoint.startsWith("/api/jobs?") ? { jobs: [{ id: "j", batchId: id, prompt: "A very long first prompt about a lighthouse at dusk with waves and gulls circling" }] } : {} });
  const batch = { id, createdAt: "2026-10-09T08:41:36Z", total: 3, counts: { queued: 3 }, state: "active", laneId: "lane" };
  app.view.batches = [batch];
  app.view.renderBatches();
  const card = app.view.batchCards.get(id);
  assert.match(card.title.textContent, /^Oct 9, \d\d:41 [AP]M$/, "before the prompt arrives the date alone identifies it");
  await app.view.loadBatchPrompts([batch]);
  await app.view.loadBatchPrompts([batch]);
  assert.equal(app.calls.filter((call) => call.endpoint.startsWith("/api/jobs?")).length, 1, "each batch prompt is fetched once");
  assert.match(card.title.textContent, /^Oct 9, \d\d:41 [AP]M · A very long first prompt about a lighthouse at…$/);
  assert.match(card.meta.textContent, /#817e43a4/);
  const options = app.document.querySelector("#batchFilter").options.map((option) => option.text);
  assert.match(options[1], /A very long first prompt.* \(817e43a4\)$/);
  const known = harness();
  known.view.jobs = new Map([["first", { id: "first", batchId: "b9", shot: 0, prompt: "Known prompt" }]]);
  await known.view.loadBatchPrompts([{ id: "b9", total: 1 }]);
  assert.equal(known.calls.length, 0); assert.equal(known.view.batchPrompts.get("b9"), "Known prompt");
});

test("running jobs offer Stop tracking behind a no-cancel, no-refund confirmation, and abandoned jobs look different", async () => {
  const app = harness();
  app.view.jobs = new Map([["run", { id: "run", state: "running", prompt: "Scene", model: "m" }], ["gone", { id: "gone", state: "cancelled", abandoned: true, prompt: "Old", model: "m" }]]);
  app.view.renderJobs();
  const running = app.view.jobRows.get("run"), gone = app.view.jobRows.get("gone");
  assert.equal(running.stop.hidden, false); assert.equal(running.stop.textContent, "stopTracking");
  assert.equal(gone.stop.hidden, true); assert.equal(gone.stateLabel.textContent, "statusAbandoned"); assert.match(gone.stateLabel.className, /state-abandoned/);
  app.context.accept = false;
  await running.stop.dispatch("click");
  assert.match(app.confirmations[0], /^stopTrackingConfirm/); assert.match(app.confirmations[0], /Scene/);
  assert.equal(app.calls.length, 0);
  app.context.accept = true;
  await running.stop.dispatch("click");
  assert.deepEqual(plain(app.calls), [{ endpoint: "/api/jobs/run/resolve", payload: { action: "abandon" } }]);
  const translations = vm.runInNewContext(`${fs.readFileSync(path.join(publicDir, "i18n.js"), "utf8")}\ntranslations`);
  assert.match(translations.en.stopTrackingConfirm, /does NOT cancel/); assert.match(translations.en.stopTrackingConfirm, /refund/);
  for (const language of ["zh", "ja", "en", "ko"]) assert.match(translations[language].stopTrackingConfirm, /\{prompt\}/);
});

test("phone layouts stack job cells under localized column names", () => {
  let language = "en";
  const app = harness({ t: (key) => `${language}:${key}` });
  app.view.jobs = new Map([["job", { id: "job", state: "failed", prompt: "Scene", model: "m", error: { definitelyNotAccepted: true } }]]);
  app.view.renderJobs();
  const labels = () => plain(app.view.jobRows.get("job").cells.map(([cell]) => cell.getAttribute("data-label")));
  assert.deepEqual(labels(), ["en:jobPrompt", "en:jobProgress", "en:jobCost", "en:jobResult", "en:jobActions"]);
  language = "ja"; app.view.renderJobs();
  assert.equal(labels()[4], "ja:jobActions");
  const phone = styles.slice(styles.lastIndexOf("@media (max-width: 560px)"));
  assert.match(phone, /\.jobs-table \{ min-width: 0;/);
  assert.match(phone, /td\[data-label\]::before \{ content: attr\(data-label\)/);
});

test("focus stays in the job table when the focused action or row disappears, including after resolving a review", async () => {
  const app = harness();
  const job = { id: "review", state: "needs_review", prompt: "Scene", model: "m", provider: "mock", region: "local" };
  app.view.jobs = new Map([["review", job], ["next", { id: "next", state: "queued", prompt: "Next", model: "m" }]]);
  app.view.renderJobs();
  const row = app.view.jobRows.get("review");
  row.review.focus();
  app.view.jobs.set("review", { ...job, state: "cancelled", abandoned: true }); app.view.renderJobs();
  assert.equal(app.document.activeElement, row.regenerate, "a hidden action hands focus to the row's next action");
  app.view.jobs.delete("review"); app.view.renderJobs();
  assert.equal(app.document.activeElement, app.view.jobRows.get("next").cancel, "a removed row hands focus to the next row");

  app.view.jobs = new Map([["review", job]]); app.view.renderJobs();
  app.view.openReview(app.view.jobs.get("review"));
  app.document.querySelector("#reviewRemoteId").value = "remote-1";
  app.view.refresh = async () => { app.view.jobs.set("review", { ...job, state: "running" }); app.view.renderJobs(); app.document.activeElement = app.document.body; };
  await app.view.resolveReview("attach_remote_id");
  assert.equal(app.document.activeElement, app.view.jobRows.get("review").cancel, "the fallback works even when focus already fell back to <body>");
});

test("showing a batch clears a stale status filter so its jobs are visible", async () => {
  const app = harness({ reply: () => ({ jobs: [], seq: 1, nextCursor: null }) });
  app.view.stateFilter = "succeeded";
  delete app.view.refresh;
  await app.view.showBatch("new-batch");
  assert.equal(app.view.stateFilter, ""); assert.equal(app.view.batchFilter, "new-batch");
  const jobsCall = app.calls.find((call) => call.endpoint.startsWith("/api/jobs?"));
  assert.match(jobsCall.endpoint, /batch=new-batch/); assert.doesNotMatch(jobsCall.endpoint, /state=/);
});

test("browser notifications are opt-in, ask permission only from the toggle, and fire only for new transitions in the background", async () => {
  const created = [];
  let permission = "default", asked = 0;
  class Notification { constructor(title, options) { created.push({ title, ...options }); } static get permission() { return permission; } static requestPermission() { asked += 1; permission = Notification.answer; return Promise.resolve(permission); } }
  const app = harness({ Notification });
  app.storage.set("videogen.notifications", "1");
  app.view.restoreNotifications();
  assert.equal(app.view.notificationsEnabled, false, "a stored preference alone never enables notifications");
  assert.equal(asked, 0, "restoring never prompts");
  const toggle = app.document.querySelector("#notifyToggle");
  Notification.answer = "denied"; toggle.checked = true;
  await toggle.dispatch("change");
  assert.equal(toggle.checked, false); assert.equal(app.document.querySelector("#queueMessage").textContent, "notifyDenied");
  Notification.answer = "granted"; toggle.checked = true;
  await toggle.dispatch("change");
  assert.equal(asked, 2); assert.equal(app.view.notificationsEnabled, true); assert.equal(app.storage.get("videogen.notifications"), "1");

  const batch = { id: "b", total: 2, counts: { running: 2 }, state: "active" };
  app.view.batches = [{ ...batch, counts: { succeeded: 2 } }]; app.view.checkBatchNotifications();
  assert.equal(created.length, 0, "batches already finished when first seen are not announced");
  app.view.batches = [{ ...batch, id: "c" }]; app.view.checkBatchNotifications();
  app.view.batches = [{ ...batch, id: "c", counts: { succeeded: 1, failed: 1 } }]; app.view.checkBatchNotifications();
  assert.equal(created.length, 0, "a visible, focused page shows the change itself");
  app.document.hasFocus = () => false;
  app.view.batches = [{ ...batch, id: "d" }]; app.view.checkBatchNotifications();
  app.view.batches = [{ ...batch, id: "d", counts: { succeeded: 2 } }]; app.view.checkBatchNotifications();
  assert.equal(created.length, 1); assert.equal(created[0].title, "notifyBatchFinishedTitle"); assert.equal(created[0].tag, "videogen-batch-d");

  const lane = { id: "l", provider: "mock", region: "local", state: "active", needsReview: 0 };
  app.view.lanes = [{ ...lane, needsReview: 1 }]; app.view.checkLaneNotifications();
  assert.equal(created.length, 1, "the first lane snapshot is only a baseline");
  app.view.lanes = [{ ...lane, needsReview: 2 }]; app.view.checkLaneNotifications();
  app.view.lanes = [{ ...lane, needsReview: 2, state: "needs_key", waitingForKey: 3 }]; app.view.checkLaneNotifications();
  app.view.lanes = [{ ...lane, needsReview: 2, state: "needs_key", waitingForKey: 3 }]; app.view.checkLaneNotifications();
  assert.deepEqual(created.slice(1).map((note) => note.title), ["notifyReviewTitle", "notifyKeyTitle"]);
  toggle.checked = false; await toggle.dispatch("change");
  assert.equal(app.storage.get("videogen.notifications"), "0");
});

test("batch cards draw a state meter from their counts, and lanes that need a key open their key settings once", () => {
  const app = harness();
  const batch = { id: "b1", createdAt: "2026-10-10T00:00:00Z", total: 4, counts: { queued: 1, succeeded: 2, failed: 1, running: 0 }, state: "active", laneId: "lane" };
  app.view.batches = [batch]; app.view.renderBatches();
  const card = app.view.batchCards.get("b1");
  assert.deepEqual(card.meter.children.map((segment) => segment.className), ["meter-seg state-succeeded", "meter-seg state-failed", "meter-seg state-queued"], "finished work first, empty states skipped");
  assert.equal(card.meter.children[0].getAttribute("style"), "flex-grow: 2");
  assert.equal(card.meter.getAttribute("aria-hidden"), "true", "the summary line already reads the counts");
  const first = card.meter.children[0];
  app.view.renderBatches();
  assert.equal(card.meter.children[0], first, "unchanged counts keep the same segments");
  assert.equal(card.element.dataset.state, "active");
  app.view.batches = [{ ...batch, counts: { succeeded: 4 } }]; app.view.renderBatches();
  assert.equal(card.element.dataset.state, "finished");
  assert.deepEqual(card.meter.children.map((segment) => segment.className), ["meter-seg state-succeeded"]);

  const lane = { id: "lane", provider: "mock", region: "local", baseUrl: "http://127.0.0.1", state: "active", inFlight: 0, concurrency: 1, queued: 0 };
  app.view.lanes = [lane]; app.view.renderLanes();
  const laneCard = app.view.laneCards.get("lane");
  assert.notEqual(laneCard.manage.open, true, "key settings stay folded for a working lane");
  assert.ok(laneCard.manage.contains(laneCard.keyInput) && laneCard.manage.contains(laneCard.concurrency));
  app.view.lanes = [{ ...lane, state: "needs_key", waitingForKey: 1 }]; app.view.renderLanes();
  assert.equal(laneCard.manage.open, true, "a lane that starts needing a key shows its key field");
  laneCard.manage.open = false; app.view.renderLanes();
  assert.equal(laneCard.manage.open, false, "closing it again is respected while the state is unchanged");
});

test("the first-run guide replaces the queue only after a snapshot shows no batches and no jobs on the first page", () => {
  const app = harness();
  const pane = app.document.querySelector("#dailies");
  app.view.renderBatches();
  assert.equal(pane.classList.contains("is-first-run"), false, "nothing is hidden before the first batch snapshot");
  app.view.batchesLoaded = true; app.view.renderBatches();
  assert.equal(pane.classList.contains("is-first-run"), true);
  app.view.jobs = new Map([["job", { id: "job", state: "queued", prompt: "Scene", model: "m" }]]); app.view.renderJobs();
  assert.equal(pane.classList.contains("is-first-run"), false, "jobs without a listed batch keep the queue visible");
  app.view.jobs = new Map(); app.view.batchPage = 1; app.view.renderBatches();
  assert.equal(pane.classList.contains("is-first-run"), false, "an empty later page keeps the pager reachable");
  app.view.batchPage = 0; app.view.stateFilter = "failed"; app.view.renderBatches();
  assert.equal(pane.classList.contains("is-first-run"), false, "an active filter keeps the queue visible");
  app.view.stateFilter = "";
  const clear = app.document.querySelector("#clearHistoryButton"), section = app.dom.document.createElement("section");
  section.className = "danger-zone"; pane.append(section); section.append(clear); clear.focus();
  app.view.renderBatches();
  assert.equal(pane.classList.contains("is-first-run"), true);
  assert.equal(app.document.activeElement, app.document.querySelector("#refreshQueueButton"), "focus leaves a section the guide hides");
});
