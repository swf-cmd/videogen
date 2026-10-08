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
  const rows = rowsFromCSV('prompt,subject,durationSeconds,audio,seed,firstFrame,lastFrame\r\n"Film {{ subject }} at {{index}}",mountains,8,false,0,start.png,end.png\r\n,sea,6,1,-1,,', 'Explore {{subject}}');
  assert.equal(rows[0].prompt, "Film mountains at 1");
  assert.deepEqual(rows[0].params, { durationSeconds: 8, seed: 0, audio: false });
  assert.equal(rows[0].firstFrameName, "start.png");
  assert.equal(rows[0].lastFrameName, "end.png");
  assert.equal(rows[1].prompt, "Explore sea");
  assert.equal(rows[1].params.audio, true);
  assert.deepEqual(renderTemplate("{{ x }} / {{index}} / {{missing}}", { x: "{{index}}", index: 0 }), { text: "{{index}} / 0 / {{missing}}", missing: ["missing"] });
  const hostile = rowsFromCSV('prompt,__proto__,constructor\n"{{__proto__}} {{constructor}}",safe,text');
  assert.equal(hostile[0].prompt, "safe text");
  assert.equal({}.polluted, undefined);
});

test("missing templates and invalid imported numbers/booleans remain row errors", () => {
  const rows = rowsFromCSV('prompt,seconds,durationSeconds,audio\n"{{subject}}",8,nonsense,yes\n,,,');
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
    fitInputReferenceFile: async (file, dimensions) => { fitted.push({ file, dimensions }); return { name: dimensions, size: 20 }; },
    supportedInputReferenceTypes: new Set(["image/png"]), inputReferenceMimeType: (file) => file.type,
    maxInputReferenceBytes: 25 * 1024 * 1024,
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

function renderDraft(row) {
  const elements = [];
  function element(tag) {
    const result = { tag, children: [], dataset: {}, events: {}, value: "", options: [],
      append(...children) { this.children.push(...children); },
      setAttribute() {}, addEventListener(name, callback) { this.events[name] = callback; },
      querySelector() { return null; },
    };
    elements.push(result); return result;
  }
  const source = fs.readFileSync(path.join(__dirname, "../public/batch-editor.js"), "utf8");
  const BatchEditor = vm.runInNewContext(`${source}\nBatchEditor`, {
    document: { createElement: element, querySelector: () => ({}) }, promptInput: {},
    viewElement: element, viewButton: () => element("button"), t: (key) => key,
    fillSelect: (select, values, selected) => { select.options = values.map((value) => ({ value, disabled: false })); select.value = selected; },
    BatchImport: require("../public/import"),
  });
  const editor = Object.create(BatchEditor.prototype);
  Object.assign(editor, { rows: [row], enabled: true, previewUrls: [], estimates: [], container: element("div"), changed() {} });
  editor.render();
  return { editor, elements };
}

test("editing a draft prompt keeps unresolved template errors until all remaining variables are replaced", () => {
  const row = rowsFromCSV('prompt\n"A {{subject}}"')[0];
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
