const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseCSV, renderTemplate, rowsFromCSV, findImageFile, imageVariables } = require("../public/import");

test("CSV reads BOM, CRLF, quoted commas/newlines, escaped quotes and empty fields without phantom rows", () => {
  const rows = parseCSV('\uFEFFprompt,subject,filename\r\n"A \"\"quiet\"\" scene, by a lake\nAt dawn",lake,\r\n\r\n"",forest,forest\r\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].prompt, 'A "quiet" scene, by a lake\nAt dawn');
  assert.equal(rows[0].filename, "");
  assert.equal(rows[1].prompt, "");
  assert.deepEqual(parseCSV("\n\r\n"), []);
  assert.deepEqual(parseCSV("prompt\r\n"), []);
  assert.equal(parseCSV("prompt,filename\na,")[0].filename, "");
});

test("malformed CSV is rejected before replacing the editable task list", () => {
  for (const source of ['prompt\n"unterminated', 'prompt\n"a"b', 'prompt\nx"a', 'prompt,prompt\na,b', ',prompt\na,b', 'prompt\na,b']) {
    assert.throws(() => parseCSV(source), (error) => ["csvMalformed", "csvHeaders", "csvColumns"].includes(error.code));
  }
});

test("CSV templates use row values, preserve zero, and never evaluate or recursively expand input", () => {
  const rows = rowsFromCSV('prompt,subject,durationSeconds,audio,seed,firstFrame,lastFrame\r\n"Film {{ subject }} at {{index}}",mountains,8,false,0,start.png,end.png\r\n,sea,6,1,-1,,', 'Explore {{subject}}', { templatePrompts: true });
  assert.equal(rows[0].prompt, "Film mountains at 1");
  assert.deepEqual(rows[0].params, { durationSeconds: 8, seed: 0, audio: false });
  assert.equal(rows[0].firstFrameName, "start.png");
  assert.equal(rows[0].lastFrameName, "end.png");
  assert.equal(rows[1].prompt, "Explore sea");
  assert.equal(rows[1].params.audio, true);
  assert.deepEqual(renderTemplate("{{ x }} / {{index}} / {{missing}}", { x: "{{index}}", index: 0 }), { text: "{{index}} / 0 / {{missing}}", missing: ["missing"] });
  const hostile = rowsFromCSV('prompt,__proto__,constructor\n"{{__proto__}} {{constructor}}",safe,text', '', { templatePrompts: true });
  assert.equal(hostile[0].prompt, "safe text");
  assert.equal({}.polluted, undefined);
});

test("missing templates and invalid imported numbers/booleans remain row errors", () => {
  const rows = rowsFromCSV('prompt,seconds,durationSeconds,audio\n"{{subject}}",8,nonsense,yes\n,,,', '', { templatePrompts: true });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].errors.map((error) => error.code), ["templateMissing", "csvNumber", "csvBoolean"]);
  assert.equal(rowsFromCSV('subject\na tree')[0].errors[0].code, "missingPrompt");
});

test("folder matching accepts unique basenames and relative paths but rejects ambiguous names", () => {
  const first = { name: "frame.png", webkitRelativePath: "photos/a/frame.png" };
  const second = { name: "frame.png", webkitRelativePath: "photos/b/frame.png" };
  const third = { name: "finish.jpg", webkitRelativePath: "photos/finish.jpg" };
  assert.equal(findImageFile("frame.png", [first, second]).error, "imageAmbiguous");
  assert.equal(findImageFile("photos/a/frame.png", [first, second]).file, first);
  assert.equal(findImageFile("a\\frame.png", [first, second]).file, first);
  assert.equal(findImageFile("finish.jpg", [first, second, third]).file, third);
  assert.equal(findImageFile("missing.jpg", [first]).error, "imageMissing");
  assert.deepEqual(imageVariables({ name: "scene.01.png" }, 2), { filename: "scene.01.png", stem: "scene.01", index: 3 });
});

test("regeneration requires a fresh single-task estimate and explicit confirmation before any create", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/queue-view.js"), "utf8");
  const calls = [], confirmations = [];
  let accepted = false;
  const QueueView = vm.runInNewContext(`${source}\nQueueView`, {
    apiRequest: async (endpoint, payload) => { calls.push({ endpoint, payload }); return { cost: { amount: 1.25, currency: "USD" }, confirmationToken: "fresh-token" }; },
    confirmAction: async (text) => { confirmations.push(text); return accepted; },
    t: (key, values) => JSON.stringify({ key, ...values }), formatCost: (cost) => `${cost.amount} ${cost.currency}`,
  });
  const view = Object.create(QueueView.prototype);
  view.refresh = async () => {}; view.message = () => {};
  const job = { id: "one-job", prompt: "Only this scene" };
  await view.regenerateJob(job);
  assert.deepEqual(calls, [{ endpoint: "/api/jobs/one-job/regenerate/estimate", payload: undefined }]);
  assert.match(confirmations[0], /1.25 USD/); assert.match(confirmations[0], /Only this scene/);
  accepted = true; calls.length = 0;
  await view.regenerateJob(job);
  assert.equal(calls[0].endpoint, "/api/jobs/one-job/regenerate/estimate");
  assert.equal(calls[1].endpoint, "/api/jobs/one-job/regenerate");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].payload)), { confirmed: true, confirmationToken: "fresh-token" });
});

test("multipart API packs row frame fields without leaking credentials into metadata", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/api.js"), "utf8");
  let request;
  const api = vm.runInNewContext(`${source}\napiRequest`, {
    Blob, FormData, isFilePreview: false, activeLanguage: "en", t: (key) => key,
    fetch: async (endpoint, options) => { request = { endpoint, ...options }; return { ok: true, json: async () => ({ count: 1 }) }; },
  });
  const image = new Blob(["local image"], { type: "image/png" });
  const payload = { rows: [{ prompt: "Scene", firstFrame: "row_0_firstFrame", lastFrame: "row_0_lastFrame" }] };
  await api("/api/batches", payload, "POST", { row_0_firstFrame: image, row_0_lastFrame: image });
  assert.deepEqual(JSON.parse(request.body.get("payload")), payload);
  assert.equal(request.body.get("row_0_firstFrame").type, "image/png");
  assert.equal(request.body.get("row_0_lastFrame").size, image.size);
  assert.equal(request.headers["content-type"], undefined, "browser must add the multipart boundary");
});

test("shared row frames are fitted for each row's dimensions, deduplicated, and can be explicitly disabled", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/batch-editor.js"), "utf8");
  const shared = { name: "shared.png", size: 10, type: "image/png" };
  const fitted = [];
  const BatchEditor = vm.runInNewContext(`${source}\nBatchEditor`, {
    selectedInputReferenceFile: () => shared,
    selectedImageSize: (params = {}) => params.resolution || "1280x720",
    prepareInputReferenceFile: async (file, dimensions) => { fitted.push({ file, dimensions }); return { name: dimensions, size: 20 }; },
    supportedInputReferenceTypes: new Set(["image/png"]), inputReferenceMimeType: (file) => file.type,
    maxInputReferenceBytes: 25 * 1024 * 1024, maxBatchImageBytes: 120 * 1024 * 1024,
  });
  const editor = Object.create(BatchEditor.prototype);
  editor.rows = [
    { prompt: "Default", params: {} },
    { prompt: "Portrait", params: { resolution: "720x1280" } },
    { prompt: "Default duplicate", params: {} },
    { prompt: "Text only", params: {}, firstFrame: null },
  ];
  const rows = editor.payloadRows();
  assert.equal(rows[0].firstFrame, rows[2].firstFrame);
  assert.notEqual(rows[0].firstFrame, rows[1].firstFrame);
  assert.equal(rows[3].firstFrame, null);
  const files = await editor.prepareFiles({ rows, params: { resolution: "1280x720" } });
  assert.equal(Object.keys(files).length, 2);
  assert.deepEqual(fitted.map((entry) => entry.dimensions), ["1280x720", "720x1280"]);
  assert.ok(fitted.every((entry) => entry.file === shared));
});

test("converting a large prompt queue never silently truncates tasks", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/batch-editor.js"), "utf8");
  const messages = [];
  const BatchEditor = vm.runInNewContext(`${source}\nBatchEditor`, {
    parsePromptItems: () => ["Scene"], batchCountInput: { value: "50000" },
    formMessage: (message) => messages.push(message), t: (key) => key,
  });
  const editor = Object.create(BatchEditor.prototype);
  editor.rows = [{ prompt: "Existing" }];
  assert.equal(editor.fromPrompts(), false);
  assert.equal(editor.rows.length, 1);
  assert.equal(editor.rows[0].prompt, "Existing");
  assert.deepEqual(messages, ["importTooMany"]);
});

// A small DOM stand-in: enough tree, attribute and focus behaviour for the row editor.
function draftDom() {
  const elements = [], document = { activeElement: null }, counters = { writes: 0, queries: 0 };
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.events = {}; this.attributes = {}; this.value = ""; this.options = []; this.hidden = false; this.text = ""; this.parent = null; this.classes = new Set(); elements.push(this); }
    get textContent() { return this.text; }
    set textContent(value) { counters.writes += 1; this.text = String(value); for (const child of this.children) child.parent = null; this.children = []; }
    get classList() { const classes = this.classes; return { toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); }, contains: (name) => classes.has(name) }; }
    append(...children) { for (const child of children) this.insertBefore(child, null); }
    insertBefore(child, before) { child.remove(); const index = before ? this.children.indexOf(before) : -1; this.children.splice(index < 0 ? this.children.length : index, 0, child); child.parent = this; }
    remove() { if (!this.parent) return; this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; if (document.activeElement === this || this.contains(document.activeElement)) document.activeElement = null; }
    contains(other) { for (let node = other; node; node = node.parent) if (node === this) return true; return false; }
    setAttribute(name, value) { this.attributes[name] = String(value); } getAttribute(name) { return this.attributes[name] ?? null; } removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name, callback) { this.events[name] = callback; }
    querySelector() { counters.queries += 1; return null; } focus() { document.activeElement = this; }
  }
  const ids = new Map();
  document.createElement = (tag) => new Element(tag);
  document.querySelector = (id) => { if (!ids.has(id)) ids.set(id, new Element(id)); return ids.get(id); };
  const viewElement = (tag, className = "", text = "") => { const element = new Element(tag); element.className = className; element.textContent = text; return element; };
  const viewButton = (text, action, className = "secondary") => { const button = viewElement("button", className, text); button.addEventListener("click", action); return button; };
  return { elements, document, viewElement, viewButton, counters };
}

function renderDraft(row, { rows = [row], context = {}, keepChanged = false } = {}) {
  const dom = draftDom();
  const source = fs.readFileSync(path.join(__dirname, "../public/batch-editor.js"), "utf8");
  const BatchEditor = vm.runInNewContext(`${source}\nBatchEditor`, {
    document: dom.document, promptInput: {},
    viewElement: dom.viewElement, viewButton: dom.viewButton, t: (key, values) => values ? `${key}:${JSON.stringify(values)}` : key,
    fillSelect: (select, values, selected) => { select.options = values.map((value) => ({ value, disabled: false })); select.value = selected; },
    BatchImport: require("../public/import"), ...context,
  });
  const editor = Object.create(BatchEditor.prototype);
  Object.assign(editor, { rows, enabled: true, previewUrls: [], estimates: [], files: [], container: dom.document.createElement("div") });
  if (!keepChanged) editor.changed = () => {};
  editor.render();
  return { editor, elements: dom.elements, dom, BatchEditor };
}

test("editing a draft prompt keeps unresolved template errors until all remaining variables are replaced", () => {
  const row = rowsFromCSV('prompt\n"A {{subject}}"', '', { templatePrompts: true })[0];
  const { editor, elements } = renderDraft(row);
  const prompt = elements.find((item) => item.tag === "textarea");
  prompt.value = "A {{subject}}!"; prompt.events.input();
  assert.equal(editor.rowErrors(row).find((error) => error.code === "templateMissing").values.name, "subject");
  prompt.value = "A {{new_subject}}!"; prompt.events.input();
  assert.equal(editor.rowErrors(row).find((error) => error.code === "templateMissing").values.name, "new_subject");
  prompt.value = "A quiet forest!"; prompt.events.input();
  assert.equal(editor.rowErrors(row).length, 0);
  prompt.value = ""; prompt.events.input();
  assert.equal(editor.rowErrors(row)[0].code, "missingPrompt");
});

test("invalid imported audio is visibly distinct from inheritance and can be repaired by choosing inheritance once", () => {
  const row = rowsFromCSV("prompt,audio\nScene,maybe")[0];
  const { editor, elements } = renderDraft(row);
  const audio = elements.find((item) => item.tag === "select");
  assert.equal(audio.value, "__invalid__");
  assert.equal(audio.options[0].disabled, true);
  assert.equal(editor.rowErrors(row)[0].code, "csvBoolean");
  audio.value = ""; audio.events.change();
  assert.equal(Object.hasOwn(row.params, "audio"), false);
  assert.equal(editor.rowErrors(row).length, 0);
  audio.value = "false"; audio.events.change();
  assert.equal(row.params.audio, false);
});

test("CSV bytes must decode as UTF-8 before imported rows replace the draft", async () => {
  const { decodeCSV } = require("../public/import");
  assert.equal(decodeCSV(new TextEncoder().encode("\uFEFFprompt\n树林、森、숲")), "prompt\n树林、森、숲");
  for (const bytes of [[0xd6, 0xd0], [0x82, 0xa0], [0xb0, 0xa1], [0xff, 0xfe, 0x70, 0x00], [0x70, 0x00, 0x72, 0x00]]) {
    assert.throws(() => decodeCSV(Uint8Array.from(bytes)), (error) => error.code === "csvEncoding");
  }
  const source = fs.readFileSync(path.join(__dirname, "../public/batch-editor.js"), "utf8");
  const messages = [];
  const BatchEditor = vm.runInNewContext(`${source}\nBatchEditor`, { BatchImport: require("../public/import"), t: (key) => key, formMessage: (message) => messages.push(message), document: { querySelector: () => ({ value: "" }) } });
  const editor = Object.create(BatchEditor.prototype); editor.rows = [{ prompt: "Keep this draft" }];
  const input = { value: "legacy.csv", files: [{ size: 2, arrayBuffer: async () => Uint8Array.from([0xd6, 0xd0]).buffer }] };
  await editor.importCSV(input);
  assert.deepEqual(editor.rows, [{ prompt: "Keep this draft" }]); assert.deepEqual(messages, ["csvEncoding"]); assert.equal(input.value, "");
});

test("a safe retry needs only the paid-request confirmation, not a regenerate quote that can fail after a catalog change", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/queue-view.js"), "utf8");
  const calls = [], confirmations = []; let accepted = false;
  const apiSource = fs.readFileSync(path.join(__dirname, "../public/api.js"), "utf8");
  const { canRetryJob } = vm.runInNewContext(`${apiSource}\n({ canRetryJob })`);
  const QueueView = vm.runInNewContext(`${source}\nQueueView`, {
    apiRequest: async (endpoint, payload) => {
      calls.push({ endpoint, payload });
      if (endpoint.endsWith("/regenerate/estimate")) throw new Error("The model is no longer in the catalog");
      return {};
    },
    confirmAction: async (text) => { confirmations.push(text); return accepted; }, canRetryJob,
    t: (key, values) => JSON.stringify({ key, ...values }), formatCost: (cost) => `${cost.amount} ${cost.currency}`,
  });
  const view = Object.create(QueueView.prototype); view.refresh = async () => {};
  const job = { id: "retry-me", prompt: "Scene", state: "failed", error: { definitelyNotAccepted: true }, costEstimate: { amount: 2.5, currency: "USD" } };
  await view.retryJob(job);
  assert.deepEqual(calls, [], "declining the confirmation sends nothing");
  assert.match(confirmations[0], /confirmRetry/); assert.match(confirmations[0], /2.5 USD/); assert.match(confirmations[0], /Scene/);
  accepted = true; await view.retryJob(job);
  assert.deepEqual(calls.map((call) => call.endpoint), ["/api/jobs/retry-me/retry"]);
  assert.equal(calls[0].payload.confirmed, true);
  calls.length = 0; confirmations.length = 0;
  for (const unsafe of [{ ...job, remote: { id: "maybe-paid" } }, { ...job, error: { definitelyNotAccepted: false } }, { ...job, state: "needs_review" }]) await view.retryJob(unsafe);
  assert.deepEqual(calls, []); assert.deepEqual(confirmations, [], "uncertain creates never get a retry shortcut");
});

test("CSV imports semicolon-delimited Excel exports with case-insensitive known and template headers", () => {
  const source = '\uFEFFsep=;\r\nPROMPT;Subject;DURATIONSECONDS;ASPECTRATIO;FIRSTFRAME;AUDIO\r\n"Film {{SUBJECT}}; then pan, slowly";forest;8;16:9;start.png;FALSE\r\n';
  const row = rowsFromCSV(source, "", { templatePrompts: true })[0];
  assert.equal(row.prompt, "Film forest; then pan, slowly");
  assert.deepEqual(row.params, { aspectRatio: "16:9", durationSeconds: 8, audio: false }); assert.equal(row.firstFrameName, "start.png");
  assert.equal(rowsFromCSV('Prompt;Filename\n"A forest; at dawn";forest')[0].filename, "forest");
  assert.equal(rowsFromCSV('Prompt\nA literal; semicolon')[0].prompt, "A literal; semicolon", "single-column CSV must not infer a delimiter from prompt text");
  assert.equal(rowsFromCSV('Prompt,Filename\n"A forest; at dawn",forest')[0].prompt, "A forest; at dawn");
  assert.throws(() => parseCSV('Prompt;PROMPT\na;b'), (error) => error.code === "csvHeaders");
});

test("ordinary CSV preserves literal braces through validation and payload creation; template mode is explicit", () => {
  const source = 'Prompt;Subject\n"Write {{x}} and {{subject}} literally";forest';
  const row = rowsFromCSV(source)[0], { editor } = renderDraft(row);
  assert.equal(row.prompt, "Write {{x}} and {{subject}} literally"); assert.equal(row.templateMode, false);
  assert.deepEqual(Array.from(editor.rowErrors(row)), []); assert.doesNotThrow(() => editor.validate());
  const BatchEditor = vm.runInNewContext(`${fs.readFileSync(path.join(__dirname, "../public/batch-editor.js"), "utf8")}\nBatchEditor`, { selectedInputReferenceFile: () => null });
  assert.equal(BatchEditor.prototype.payloadRows.call(editor)[0].prompt, row.prompt);
  const templated = rowsFromCSV(source, "", { templatePrompts: true })[0], templatedEditor = renderDraft(templated).editor;
  assert.equal(templated.prompt, "Write {{x}} and forest literally");
  assert.equal(templatedEditor.rowErrors(templated)[0].code, "templateMissing"); assert.throws(() => templatedEditor.validate(), /rowInvalid/);
  const fallback = rowsFromCSV('Subject\nforest', 'Explore {{SUBJECT}}')[0]; assert.equal(fallback.prompt, "Explore forest"); assert.equal(fallback.templateMode, true);
});

test("folder matching normalizes NFC and NFD names while preserving duplicate-name ambiguity", () => {
  const decomposed = { name: "cafe\u0301.png", webkitRelativePath: "photos/cafe\u0301.png" };
  assert.equal(findImageFile("café.png", [decomposed]).file, decomposed);
  assert.equal(findImageFile("photos/café.png", [decomposed]).file, decomposed);
  const composed = { name: "café.png", webkitRelativePath: "other/café.png" };
  assert.equal(findImageFile("café.png", [decomposed, composed]).error, "imageAmbiguous");
  assert.equal(findImageFile("photos/café.png", [decomposed, composed]).file, decomposed);
});

test("folder imports keep manual first and last frames and naturally order newly generated tasks", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/batch-editor.js"), "utf8");
  const BatchEditor = vm.runInNewContext(`${source}\nBatchEditor`, { BatchImport: require("../public/import"), supportedInputReferenceTypes: new Set(["image/png"]), inputReferenceMimeType: (file) => file.type, document: { querySelector: () => ({ value: "Scene {{index}}: {{stem}}" }) }, promptInput: { value: "" }, t: (key) => key, formMessage() {} });
  const editor = Object.create(BatchEditor.prototype); editor.activate = () => {};
  const file = (name) => ({ name, type: "image/png", size: 10 });
  const manualFirst = file("start.png"), manualLast = file("end.png"), oldAuto = file("auto.png"), newAuto = file("auto.png");
  editor.rows = [{ prompt: "Retain edits", params: {}, firstFrame: manualFirst, firstFrameName: "start.png", firstFrameSource: "manual", lastFrame: manualLast, lastFrameName: "end.png", lastFrameSource: "manual" }, { prompt: "Relink automatic match", params: {}, firstFrame: oldAuto, firstFrameName: "auto.png", firstFrameSource: "folder" }];
  editor.importFolder({ files: [file("start.png"), newAuto], value: "chosen" });
  assert.equal(editor.rows.length, 2); assert.equal(editor.rows[0].prompt, "Retain edits"); assert.equal(editor.rows[0].firstFrame, manualFirst); assert.equal(editor.rows[0].lastFrame, manualLast); assert.equal(editor.rows[1].firstFrame, newAuto);
  editor.rows = []; editor.importFolder({ files: [file("img10.png"), file("img2.png"), file("img1.png")], value: "chosen" });
  assert.deepEqual(Array.from(editor.rows, (row) => row.prompt), ["Scene 1: img1", "Scene 2: img2", "Scene 3: img10"]);
  assert.deepEqual(Array.from(editor.rows, (row) => row.firstFrame.name), ["img1.png", "img2.png", "img10.png"]);
});

test("image-folder import treats ordinary prompt braces literally and expands only an explicit template", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/batch-editor.js"), "utf8");
  const template = { value: "" }, literal = "Write {{x}} and {{filename}} literally";
  const BatchEditor = vm.runInNewContext(`${source}\nBatchEditor`, { BatchImport: require("../public/import"), supportedInputReferenceTypes: new Set(["image/png"]), inputReferenceMimeType: (file) => file.type, document: { querySelector: () => template }, promptInput: { value: literal }, selectedInputReferenceFile: () => null, selectedImageSize: () => "1280x720", t: (key) => key, formMessage() {} });
  const editor = Object.create(BatchEditor.prototype); editor.rows = []; editor.activate = () => {};
  const files = [{ name: "img1.png", type: "image/png", size: 10 }];
  editor.importFolder({ files, value: "selected" });
  assert.equal(editor.rows[0].prompt, literal); assert.equal(editor.rows[0].templateMode, false);
  assert.doesNotThrow(() => editor.validate()); assert.equal(editor.payloadRows()[0].prompt, literal);
  template.value = "Film {{filename}} with {{missing}}"; editor.rows = [];
  editor.importFolder({ files, value: "selected" });
  assert.equal(editor.rows[0].prompt, "Film img1.png with {{missing}}"); assert.equal(editor.rows[0].templateMode, true);
  assert.equal(editor.rowErrors(editor.rows[0])[0].code, "templateMissing"); assert.throws(() => editor.validate(), /rowInvalid/);
});

test("image matching prefers exact case and accepts a unique folded full path, suffix or basename", () => {
  const upper = { name: "Cafe\u0301.PNG", webkitRelativePath: "Photos/Scene/Cafe\u0301.PNG" };
  const lower = { name: "café.png", webkitRelativePath: "Photos/Other/café.png" };
  for (const name of ["photos/scene/café.png", "scene/café.png", "café.png"]) assert.equal(findImageFile(name, [upper]).file, upper, name);
  assert.equal(findImageFile("café.png", [upper, lower]).file, lower, "an exact-case basename wins before case-insensitive fallback");
  assert.equal(findImageFile("Café.PNG", [upper, lower]).file, upper);
  assert.equal(findImageFile("Photos/Other/café.png", [upper, lower]).file, lower);
  assert.equal(findImageFile("PHOTOS\\SCENE\\CAFÉ.png", [upper, lower]).file, upper);
});

test("case-folded image collisions stay ambiguous across path, suffix and basename candidates", () => {
  const a = { name: "Frame.PNG", webkitRelativePath: "Photos/A/Frame.PNG" };
  const b = { name: "frame.png", webkitRelativePath: "Photos/a/frame.png" };
  for (const name of ["PHOTOS/A/FRAME.png", "A/FRAME.png", "FRAME.png"]) assert.equal(findImageFile(name, [a, b]).error, "imageAmbiguous", name);
  const root = { name: "Frame.PNG", webkitRelativePath: "A/Frame.PNG" };
  assert.equal(findImageFile("a/FRAME.png", [root, a]).error, "imageAmbiguous", "a folded complete path must not hide another valid suffix match");
  assert.equal(findImageFile("Photos/A/Frame.PNG", [a, b]).file, a, "an explicitly cased full path still resolves safely");
  assert.equal(findImageFile("missing.PNG", [a, b]).error, "imageMissing");
});

test("CSV errors report file line numbers, and spreadsheet quirks are tolerated", () => {
  const lineOf = (text) => { try { parseCSV(text); } catch (error) { return `${error.code}@${error.values.line}`; } return "ok"; };
  assert.equal(lineOf('prompt,filename\n"a\nb\nc",x\n\nbad,row,extra\n'), "csvColumns@6", "multiline prompts and blank lines count as lines");
  assert.equal(lineOf('prompt,filename\r\n"a\r\nb",x\r\nbad,row,extra\r\n'), "csvColumns@4");
  assert.equal(lineOf("sep=;\nprompt;filename\na;b;c\n"), "csvColumns@3");
  assert.equal(lineOf('prompt\nok\n"a"b\n'), "csvMalformed@3");
  assert.equal(lineOf('prompt\nok\n"open\n'), "csvMalformed@3");
  assert.deepEqual({ ...parseCSV("prompt,filename,\nA,x,\nB,,\n")[1] }, { prompt: "B", filename: "" }, "Excel's trailing empty header cells are ignored");
  assert.equal(lineOf("prompt,filename,\nA,x,stray\n"), "csvColumns@2", "a value under an empty header is still an error");
  assert.throws(() => parseCSV("prompt,,filename\nA,,x\n"), (error) => error.code === "csvHeaders", "only trailing empty headers are tolerated");
  assert.deepEqual({ ...parseCSV('prompt, filename\n"A, B", "x"\n')[0] }, { prompt: "A, B", filename: "x" }, "whitespace before an opening quote");
  assert.deepEqual(rowsFromCSV("index,subject\n7,cat\n", "Shot {{index}} of {{subject}}").map((row) => row.prompt), ["Shot 7 of cat"], "a CSV index column keeps its own values");
  assert.deepEqual(rowsFromCSV("subject\ncat\ndog\n", "Shot {{index}} of {{subject}}").map((row) => row.prompt), ["Shot 1 of cat", "Shot 2 of dog"]);
});

test("literal CSV prompts with column variables show a one-click way to enable template expansion", () => {
  const { literalTemplateVariables } = require("../public/import");
  const text = 'prompt,Subject\n"A cinematic shot of {{ SUBJECT }} and {{unknown}}",a quiet forest\n"Plain prompt",x\n"Shot {{index}}",y\n';
  assert.deepEqual({ ...literalTemplateVariables(text), names: [...literalTemplateVariables(text).names] }, { count: 2, names: ["{{SUBJECT}}", "{{index}}"] });
  assert.equal(literalTemplateVariables(fs.readFileSync(path.join(__dirname, "../docs/batch-example.csv"), "utf8")).count, 0, "the documented example imports correctly with the default literal mode");
  const messages = [];
  const { editor, dom } = renderDraft({ prompt: "", params: {} }, { rows: [], keepChanged: true, context: { formMessage: (message) => messages.push(message), formatInteger: String, updatePromptMeta() {}, scheduleEstimate() {}, supportedInputReferenceTypes: new Set(["image/png"]), inputReferenceMimeType: () => "image/png" } });
  const hint = dom.document.querySelector("#csvTemplateHint"), checkbox = dom.document.querySelector("#csvTemplateMode");
  const csv = 'prompt,subject\n"A cinematic shot of {{subject}}",a quiet forest\n"Plain prompt",x\n';
  editor.applyCSV(csv);
  assert.equal(editor.rows[0].prompt, "A cinematic shot of {{subject}}", "literal mode stays the default");
  assert.equal(hint.hidden, false);
  assert.equal(dom.document.querySelector("#csvTemplateHintText").textContent, 'csvTemplateHint:{"count":"1","names":"{{subject}}"}');
  editor.expandTemplateHint();
  assert.equal(checkbox.checked, true); assert.equal(editor.rows[0].prompt, "A cinematic shot of a quiet forest");
  assert.equal(hint.hidden, true); assert.equal(dom.document.activeElement, checkbox);
  checkbox.checked = false; editor.applyCSV(csv);
  assert.equal(hint.hidden, false);
  const prompt = editor.cards.get(editor.rows[1]).prompt;
  prompt.value = "Edited"; prompt.events.input();
  assert.equal(hint.hidden, true, "after the rows are edited, re-importing could lose work, so the offer disappears");
});

test("row statuses are cached by index and rewritten only when their text changes", () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({ prompt: `Row ${index}`, params: {}, errors: [] }));
  const { editor, dom } = renderDraft(rows[0], { rows, keepChanged: true, context: { updatePromptMeta() {}, scheduleEstimate() {}, formatCost: (cost) => `${cost.amount}`, supportedInputReferenceTypes: new Set(), inputReferenceMimeType: () => "" } });
  const queries = dom.counters.queries;
  dom.counters.writes = 0;
  const prompt = editor.cards.get(rows[500]).prompt;
  prompt.value = "Row 500 edited"; prompt.events.input();
  assert.equal(dom.counters.queries, queries, "no per-row DOM lookups on a keystroke");
  assert.equal(dom.counters.writes, 0, "unchanged statuses are not rewritten");
  const estimate = { takes: 2, rows: rows.map(() => ({ model: "m", params: { resolution: "720p" }, cost: { amount: 1 } })) };
  editor.setEstimates(estimate);
  assert.equal(dom.counters.writes, 1000);
  assert.match(editor.statusElements[0].textContent, /rowTakes:\{"takes":2\}/, "row prices mention the takes multiplier");
  dom.counters.writes = 0; editor.setEstimates(estimate);
  assert.equal(dom.counters.writes, 0);
  prompt.value = ""; prompt.events.input();
  assert.equal(dom.counters.writes, 1000, "clearing estimates rewrites each status once, not three times");
  assert.equal(editor.statusElements[500].classes.has("is-error"), true);
});

test("structural row edits keep cards, focus and open details, and repeated buttons are named by row", () => {
  const rows = ["One", "Two", "Three"].map((prompt) => ({ prompt, params: {}, errors: [] }));
  const { editor, dom } = renderDraft(rows[0], { rows, keepChanged: true, context: { updatePromptMeta() {}, scheduleEstimate() {} } });
  const labels = editor.container.children.flatMap((card) => dom.elements.filter((element) => element.tag === "button" && card.contains(element)).filter((button) => !button.hidden).map((button) => button.getAttribute("aria-label")));
  assert.ok(labels.every(Boolean), "every visible row button has an accessible name");
  assert.equal(new Set(labels).size, labels.length, `names are unique: ${labels.join(", ")}`);
  assert.equal(editor.cards.get(rows[0]).frames.firstFrame.input.getAttribute("aria-label"), 'rowFirstFrameInput:{"row":1}');
  const [first, second, third] = rows.map((row) => editor.cards.get(row)), secondRow = rows[1];
  second.details.open = true;
  first.remove.focus(); first.remove.events.click();
  assert.equal(editor.cards.get(secondRow), second); assert.equal(editor.container.children[0], second.element);
  assert.equal(second.details.open, true, "open overrides stay open");
  assert.equal(second.title.textContent, 'rowNumber:{"row":1}'); assert.equal(second.remove.getAttribute("aria-label"), 'rowRemoveNamed:{"row":1}');
  assert.equal(dom.document.activeElement, second.remove, "focus moves to the next row");
  third.remove.focus(); third.remove.events.click();
  assert.equal(dom.document.activeElement, second.remove, "removing the last row focuses the previous one");
  second.remove.focus(); second.remove.events.click();
  assert.equal(dom.document.activeElement, dom.document.querySelector("#addBatchRow"), "with no rows left focus goes to Add task");
});

test("choosing, clearing and disabling a frame updates one row in place without leaking preview URLs", () => {
  const created = [], revoked = [];
  const URL = { createObjectURL: (file) => { created.push(file); return `blob:${created.length}`; }, revokeObjectURL: (url) => revoked.push(url) };
  const row = { prompt: "Scene", params: {}, errors: [] };
  const { editor, dom } = renderDraft(row, { keepChanged: true, context: { URL, updatePromptMeta() {}, scheduleEstimate() {}, supportedInputReferenceTypes: new Set(["image/png"]), inputReferenceMimeType: () => "image/png" } });
  const card = editor.cards.get(row), frame = card.frames.firstFrame, file = { name: "start.png", type: "image/png" };
  frame.input.files = [file]; frame.input.focus(); frame.input.events.change();
  assert.equal(row.firstFrame, file); assert.equal(editor.cards.get(row), card);
  assert.equal(frame.preview.hidden, false); assert.equal(frame.preview.src, "blob:1"); assert.equal(frame.clear.hidden, false); assert.equal(frame.toggle.hidden, true);
  assert.equal(dom.document.activeElement, frame.input);
  for (let index = 0; index < 5; index += 1) editor.render();
  assert.equal(created.length, 1, "re-rendering does not create more object URLs");
  frame.clear.focus(); frame.clear.events.click();
  assert.equal(row.firstFrame, null); assert.equal(frame.clear.hidden, true); assert.deepEqual(revoked, ["blob:1"]);
  assert.equal(dom.document.activeElement, frame.toggle, "focus moves to the frame's remaining control");
  assert.equal(frame.toggle.textContent, "rowUseSharedFrame");
  frame.toggle.events.click();
  assert.equal(Object.hasOwn(row, "firstFrame"), false); assert.equal(frame.toggle.textContent, "rowNoFrame"); assert.equal(dom.document.activeElement, frame.toggle);
  frame.input.files = []; frame.input.events.change();
  assert.equal(Object.hasOwn(row, "firstFrame"), false, "cancelling the file picker keeps the current choice");
});

test("row images are prepared with progress and fail as soon as the running total passes the upload limit", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/batch-editor.js"), "utf8");
  const prepared = [], progress = [];
  const BatchEditor = vm.runInNewContext(`${source}\nBatchEditor`, {
    selectedInputReferenceFile: () => null, selectedImageSize: () => "1280x720", t: (key) => key,
    prepareInputReferenceFile: async (file) => { prepared.push(file.name); return { size: 50 * 1024 * 1024 }; },
    supportedInputReferenceTypes: new Set(["image/png"]), inputReferenceMimeType: () => "image/png",
    maxInputReferenceBytes: 60 * 1024 * 1024, maxBatchImageBytes: 120 * 1024 * 1024,
  });
  const editor = Object.create(BatchEditor.prototype);
  editor.rows = ["a", "b", "c", "d"].map((name) => ({ prompt: name, params: {}, firstFrame: { name, type: "image/png" } }));
  await assert.rejects(editor.prepareFiles({ rows: editor.payloadRows(), params: {} }, { onProgress: (current, total) => progress.push(`${current}/${total}`) }), /batchImagesTooLarge/);
  assert.deepEqual(prepared, ["a", "b", "c"], "the fourth image is never processed");
  assert.deepEqual(progress, ["1/4", "2/4", "3/4"]);
});

function jpegWithOrientation(orientation, little = false) {
  const u16 = (value) => little ? [value & 255, value >> 8] : [value >> 8, value & 255];
  const u32 = (value) => little ? [value & 255, (value >> 8) & 255, (value >> 16) & 255, value >>> 24] : [value >>> 24, (value >> 16) & 255, (value >> 8) & 255, value & 255];
  const tiff = [...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0, ...u32(0)];
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)];
  return Uint8Array.from([0xff, 0xd8, ...app0, 0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 255, ...exif, 0xff, 0xda, 0, 2]);
}

test("EXIF-rotated JPEGs are re-encoded upright, while exact matches are sent untouched", async () => {
  const context = vm.createContext({ t: (key) => key });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/image-reference.js"), "utf8"), context);
  for (const little of [false, true]) assert.equal(context.jpegOrientation(jpegWithOrientation(6, little)), 6);
  assert.equal(context.jpegOrientation(jpegWithOrientation(1)), 1);
  assert.equal(context.jpegOrientation(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 2])), 1, "no EXIF");
  assert.equal(context.jpegOrientation(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])), 1, "not a JPEG");
  assert.equal(context.jpegOrientation(jpegWithOrientation(6).slice(0, 30)), 1, "truncated data never throws");
  const bytes = jpegWithOrientation(8);
  assert.equal(await context.readImageFileOrientation({ name: "a.jpg", type: "image/jpeg", slice: () => ({ arrayBuffer: async () => bytes.buffer }) }), 8);
  assert.equal(await context.readImageFileOrientation({ name: "a.png", type: "image/png" }), 1);

  const fitted = [];
  context.fitInputReferenceFile = async (file, size) => { fitted.push(size); return { name: `fitted-${size}` }; };
  const prepare = (file, size, info) => context.prepareInputReferenceFile(file, size, async () => info);
  const png = { name: "exact.png", size: 10 };
  assert.equal(await prepare(png, "1280x720", { width: 1280, height: 720, orientation: 1 }), png, "an exact PNG is not re-encoded");
  assert.equal((await prepare({ name: "rot.jpg", size: 10 }, "720x1280", { width: 720, height: 1280, orientation: 6 })).name, "fitted-720x1280", "a rotated JPEG is redrawn even when its displayed size matches");
  assert.equal((await prepare({ name: "rot.jpg", size: 10 }, "", { width: 720, height: 1280, orientation: 6 })).name, "fitted-720x1280", "without a pixel target it is redrawn at its displayed size");
  await prepare({ name: "small.png", size: 10 }, "1280x720", { width: 640, height: 360, orientation: 1 });
  await prepare({ name: "huge.png", size: 30 * 1024 * 1024 }, "1280x720", { width: 1280, height: 720, orientation: 1 });
  assert.deepEqual(fitted, ["720x1280", "720x1280", "1280x720", "1280x720"]);

  const appSource = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  const adjustment = vm.runInNewContext(`${appSource.slice(appSource.indexOf("function inputReferenceAdjustment("), appSource.indexOf("function revokeInputReferencePreview()"))}\ninputReferenceAdjustment`, { parseSizeValue: context.parseSizeValue, maxInputReferenceBytes: 25 * 1024 * 1024 });
  const rotated = adjustment({ width: 720, height: 1280, orientation: 6 }, { size: 1 }, "720x1280");
  assert.equal(rotated.rotated, true); assert.equal(rotated.resized, false); assert.equal(rotated.size, "720x1280");
  assert.equal(adjustment({ width: 720, height: 1280, orientation: 1 }, { size: 1 }, "720x1280"), null);
  assert.equal(adjustment({ width: 1280, height: 720, orientation: 1 }, { size: 1 }, "720x1280").resized, true);
});
