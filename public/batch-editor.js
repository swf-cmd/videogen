class BatchEditor {
  constructor() {
    this.rows = []; this.enabled = false; this.files = []; this.previewUrls = []; this.estimates = []; this.takes = 1;
    // One card per row object. Structural changes reuse cards, so focus, typed
    // values and open <details> survive removing a row or choosing a frame.
    this.cards = new Map(); this.statusElements = [];
    this.container = document.querySelector("#batchRows");
    document.querySelector("#rowMode").addEventListener("change", (event) => {
      this.enabled = event.target.checked;
      if (this.enabled && !this.rows.length && !this.fromPrompts()) { this.enabled = false; event.target.checked = false; }
      this.render(); this.changed();
    });
    document.querySelector("#rowsFromPrompts").addEventListener("click", () => { if (this.fromPrompts()) this.activate(); });
    document.querySelector("#addBatchRow").addEventListener("click", () => {
      const row = { prompt: "", params: {}, errors: [] };
      this.rows.push(row); this.activate();
      this.cards.get(row)?.prompt.focus();
    });
    document.querySelector("#csvImport").addEventListener("change", (event) => this.importCSV(event.target));
    document.querySelector("#folderImport").addEventListener("change", (event) => this.importFolder(event.target));
    document.querySelector("#downloadCsvExample").addEventListener("click", () => this.downloadExample());
    document.querySelector("#csvTemplateHintApply").addEventListener("click", () => this.expandTemplateHint());
  }
  // Render statuses once per change; scheduleEstimate leaves already-cleared estimates alone.
  changed() { this.estimates = []; this.hideTemplateHint(); updatePromptMeta(); scheduleEstimate(); this.renderStatuses(); }
  activate() { this.enabled = true; document.querySelector("#rowMode").checked = true; this.render(); this.changed(); }
  fromPrompts() {
    const prompts = parsePromptItems();
    const count = prompts.length > 1 ? prompts.length : Math.max(1, Number(batchCountInput.value) || 1);
    if (!Number.isSafeInteger(count) || count > 1000) { formMessage(t("importTooMany"), true); return false; }
    this.rows = (prompts.length > 1 ? prompts : Array.from({ length: count }, () => prompts[0] || "")).map((prompt) => ({ prompt, params: {}, errors: [] }));
    return true;
  }
  async importCSV(input) {
    const file = input.files?.[0]; if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error(t("csvTooLarge"));
      this.applyCSV(BatchImport.decodeCSV(await file.arrayBuffer()));
    } catch (error) { formMessage(error.code ? t(error.code, error.values) : error.message, true); }
    finally { input.value = ""; }
  }
  applyCSV(text) {
    const templatePrompts = Boolean(document.querySelector("#csvTemplateMode").checked);
    const rows = BatchImport.rowsFromCSV(text, document.querySelector("#importTemplate").value.trim(), { templatePrompts });
    if (!rows.length) throw new Error(t("csvEmpty"));
    if (rows.length > 1000) throw new Error(t("importTooMany"));
    this.rows = rows; this.resolveImages(); this.activate();
    formMessage(t("importedRows", { count: rows.length }));
    this.lastCSV = text;
    // Literal mode is the safe default; warn when that probably was not intended.
    this.showTemplateHint(templatePrompts ? null : BatchImport.literalTemplateVariables(text));
  }
  showTemplateHint(hint) {
    this.templateHint = hint?.count ? hint : null;
    document.querySelector("#csvTemplateHint").hidden = !this.templateHint;
    if (this.templateHint) document.querySelector("#csvTemplateHintText").textContent = t("csvTemplateHint", { count: formatInteger(hint.count), names: hint.names.slice(0, 3).join(", ") });
  }
  hideTemplateHint() { if (this.templateHint) this.showTemplateHint(null); }
  expandTemplateHint() {
    if (!this.lastCSV) return;
    const checkbox = document.querySelector("#csvTemplateMode");
    checkbox.checked = true;
    try { this.applyCSV(this.lastCSV); }
    catch (error) { formMessage(error.code ? t(error.code, error.values) : error.message, true); }
    checkbox.focus();
  }
  importFolder(input) {
    try {
      const files = [...(input.files || [])].filter((file) => supportedInputReferenceTypes.has(inputReferenceMimeType(file))).sort(BatchImport.compareImageFiles);
      if (!files.length) throw new Error(t("folderEmpty"));
      if (files.length > 1000) throw new Error(t("importTooMany"));
      this.files = files;
      if (this.rows.some((row) => row.firstFrameName || row.lastFrameName || row.firstFrame || row.lastFrame)) this.resolveImages();
      else {
        const template = document.querySelector("#importTemplate").value.trim();
        const templateMode = Boolean(template);
        this.rows = this.files.map((file, index) => {
          const prompt = templateMode ? BatchImport.renderTemplate(template, BatchImport.imageVariables(file, index)) : { text: promptInput.value.trim(), missing: [] };
          return { prompt: prompt.text, templateMode, params: {}, firstFrame: file, firstFrameSource: "folder", firstFrameName: file.webkitRelativePath || file.name, errors: prompt.missing.map((name) => ({ code: "templateMissing", values: { name } })) };
        });
      }
      this.activate(); formMessage(t("importedRows", { count: this.rows.length }));
    } catch (error) { formMessage(error.message, true); }
    finally { input.value = ""; }
  }
  resolveImages() {
    for (const row of this.rows) for (const kind of ["firstFrame", "lastFrame"]) if (row[`${kind}Name`]) {
      if (row[kind] && row[`${kind}Source`] !== "folder") continue;
      const match = BatchImport.findImageFile(row[`${kind}Name`], this.files);
      row[kind] = match.file; row[`${kind}Source`] = "folder"; row[`${kind}Error`] = match.error;
    }
  }
  rowErrors(row) {
    const errors = BatchImport.promptErrors(row.prompt, row.errors || [], row.templateMode === true);
    for (const kind of ["firstFrame", "lastFrame"]) {
      if (row[`${kind}Name`] && !row[kind]) errors.push({ code: row[`${kind}Error`] || "imageMissing", values: { name: row[`${kind}Name`] } });
      if (row[kind] && !supportedInputReferenceTypes.has(inputReferenceMimeType(row[kind]))) errors.push({ code: "inputReferenceInvalidType" });
    }
    return errors;
  }
  payloadRows() {
    const fields = new Map();
    return this.rows.map((row, index) => {
      const payload = { prompt: row.prompt.trim(), params: { ...row.params } };
      for (const key of ["model", "provider", "region", "baseUrl", "filename"]) if (row[key]) payload[key] = row[key];
      for (const kind of ["firstFrame", "lastFrame"]) {
        const file = row[kind] === null ? null : row[kind] || (kind === "firstFrame" && !row.firstFrameName ? selectedInputReferenceFile() : null);
        if (file) {
          if (!fields.has(file)) fields.set(file, new Map());
          const target = selectedImageSize(row.params);
          if (!fields.get(file).has(target)) fields.get(file).set(target, `row_${index}_${kind}`);
          payload[kind] = fields.get(file).get(target);
        } else if (row[`${kind}Name`]) payload[kind] = `row_${index}_${kind}`;
        else if (row[kind] === null) payload[kind] = null;
      }
      return payload;
    });
  }
  validate() {
    if (!this.rows.length) throw new Error(t("csvEmpty"));
    const invalid = this.rows.findIndex((row) => this.rowErrors(row).length);
    if (invalid >= 0) throw new Error(t("rowInvalid", { row: invalid + 1, error: this.rowErrors(this.rows[invalid]).map((error) => t(error.code, error.values)).join(" · ") }));
  }
  // Fits each distinct frame once. The running total fails as soon as the
  // request would exceed the upload limit instead of after fitting every image.
  async prepareFiles(payload, { onProgress = () => {}, limit = maxBatchImageBytes } = {}) {
    const files = {}, work = [], seen = new Set();
    for (let index = 0; index < this.rows.length; index += 1) {
      for (const kind of ["firstFrame", "lastFrame"]) {
        const field = payload.rows[index][kind];
        if (!field || seen.has(field)) continue;
        seen.add(field); work.push({ index, kind, field });
      }
    }
    let total = 0;
    for (const [position, { index, kind, field }] of work.entries()) {
      onProgress(position + 1, work.length);
      const row = this.rows[index];
      const file = row[kind] || (kind === "firstFrame" ? selectedInputReferenceFile() : null);
      if (!file) throw new Error(t("rowInvalid", { row: index + 1, error: t("imageMissing", { name: row[`${kind}Name`] || "" }) }));
      if (!supportedInputReferenceTypes.has(inputReferenceMimeType(file))) throw new Error(t("inputReferenceInvalidType"));
      const prepared = await prepareInputReferenceFile(file, selectedImageSize({ ...payload.params, ...row.params }));
      if (prepared.size > maxInputReferenceBytes) throw new Error(t("rowInvalid", { row: index + 1, error: t("inputReferenceTooLarge") }));
      total += prepared.size;
      if (total > limit) throw new Error(t("batchImagesTooLarge"));
      files[field] = prepared;
    }
    return files;
  }
  setEstimates(estimate) { this.estimates = estimate?.rows || []; this.takes = estimate?.takes || 1; this.renderStatuses(); }
  renderStatuses() {
    const elements = this.statusElements || [];
    const takes = this.takes > 1 ? ` · ${t("rowTakes", { takes: this.takes })}` : "";
    this.rows.forEach((row, index) => {
      const element = elements[index]; if (!element) return;
      const errors = this.rowErrors(row).map((error) => t(error.code, error.values));
      const estimate = this.estimates[index];
      for (const error of estimate?.errors || []) errors.push(t(typeof error === "string" ? error : error.code || error.message));
      const text = errors.length ? errors.join(" · ") : estimate ? `${t("rowReady")} · ${estimate.model || ""} · ${[estimate.params?.durationSeconds && `${estimate.params.durationSeconds}${t("secondUnit")}`, estimate.params?.resolution, estimate.params?.aspectRatio].filter(Boolean).join(" / ")} · ${formatCost(estimate.cost)}${takes}` : t("rowPending");
      const failed = errors.length > 0;
      // A 1,000-row editor rewrites only statuses that actually changed.
      if (element.statusError !== failed) { element.classList.toggle("is-error", failed); element.statusError = failed; }
      if (element.textContent !== text) element.textContent = text;
    });
  }
  render() {
    document.querySelector("#rowEditorPanel").hidden = !this.enabled;
    promptInput.required = !this.enabled;
    this.cards ||= new Map();
    const present = new Set(this.enabled ? this.rows : []);
    for (const card of [...this.cards.values()]) if (!present.has(card.row)) this.discardCard(card);
    this.statusElements = [];
    if (!this.enabled) { this.container.textContent = ""; return; }
    const locale = t("locale");
    this.rows.forEach((row, index) => {
      let card = this.cards.get(row);
      if (!card) { card = this.createCard(row); this.cards.set(row, card); }
      if (this.container.children[index] !== card.element) this.container.insertBefore(card.element, this.container.children[index] || null);
      this.updateCard(card, index, locale);
      this.statusElements[index] = card.status;
    });
    if (this.templateHint) this.showTemplateHint(this.templateHint);
    this.renderStatuses();
  }
  discardCard(card) {
    for (const frame of Object.values(card.frames)) if (frame.url) URL.revokeObjectURL(frame.url);
    card.element.remove(); this.cards.delete(card.row);
  }
  removeRow(row) {
    const index = this.rows.indexOf(row); if (index < 0) return;
    const card = this.cards.get(row), active = document.activeElement;
    const hadFocus = Boolean(card && active && (card.element === active || card.element.contains?.(active)));
    this.rows.splice(index, 1);
    this.render(); this.changed();
    if (!hadFocus) return;
    // Keep keyboard users in the list: the next row, the previous row, or "Add task".
    const neighbour = this.rows[index] || this.rows[index - 1];
    (neighbour ? this.cards.get(neighbour)?.remove : document.querySelector("#addBatchRow"))?.focus();
  }
  createCard(row) {
    const card = { row, index: -1, locale: "", frames: {}, params: [] };
    card.element = viewElement("div", "draft-row"); card.element.setAttribute("role", "group");
    const header = viewElement("div", "section-head");
    card.title = viewElement("strong");
    card.remove = viewButton("", () => this.removeRow(row)); card.remove.dataset.action = "remove-row";
    header.append(card.title, card.remove);
    card.prompt = document.createElement("textarea"); card.prompt.rows = 3; card.prompt.value = row.prompt;
    card.prompt.addEventListener("input", () => { row.prompt = card.prompt.value; this.changed(); });
    const frameGrid = viewElement("div", "row-frame-grid");
    for (const kind of ["firstFrame", "lastFrame"]) {
      const field = viewElement("div", "field");
      const frame = { title: viewElement("span"), url: "", file: undefined };
      frame.input = document.createElement("input"); frame.input.type = "file"; frame.input.accept = "image/jpeg,image/png,image/webp";
      frame.input.addEventListener("change", () => {
        const file = frame.input.files?.[0]; if (!file) return;
        row[kind] = file; row[`${kind}Source`] = "manual"; row[`${kind}Name`] = file.name; delete row[`${kind}Error`];
        this.updateFrames(card); this.changed();
      });
      frame.preview = document.createElement("img"); frame.preview.className = "draft-frame-preview"; frame.preview.hidden = true;
      frame.name = viewElement("small", "field-meta");
      frame.clear = viewButton("", () => {
        row[kind] = null; row[`${kind}Name`] = ""; frame.input.value = "";
        this.updateFrames(card); this.changed();
        // The clear button disappears; keep focus on this frame's controls.
        (frame.toggle && !frame.toggle.hidden ? frame.toggle : frame.input).focus();
      }, "text-button");
      frame.clear.dataset.action = `clear-${kind}`;
      field.append(frame.title, frame.input, frame.preview, frame.name, frame.clear);
      if (kind === "firstFrame") {
        frame.toggle = viewButton("", () => { if (row.firstFrame === null) delete row.firstFrame; else row.firstFrame = null; this.updateFrames(card); this.changed(); }, "text-button");
        frame.toggle.dataset.action = "toggle-first-frame";
        field.append(frame.toggle);
      }
      card.frames[kind] = frame; frameGrid.append(field);
    }
    card.details = viewElement("details", "row-options"); card.summary = viewElement("summary"); card.details.append(card.summary);
    const fields = viewElement("div", "row-params");
    for (const [key, translation, type] of [["model", "modelLabel", "text"], ["durationSeconds", "secondsLabel", "number"], ["resolution", "sizeLabel", "text"], ["aspectRatio", "aspectRatio", "text"], ["seed", "seed", "number"], ["filename", "filenameLabel", "text"]]) {
      const owner = ["model", "filename"].includes(key) ? row : row.params;
      const label = viewElement("label", "field"), span = viewElement("span"), input = document.createElement("input"); input.type = type; input.value = owner[key] ?? "";
      if (type === "number") { input.min = key === "seed" ? "-1" : "1"; input.step = "1"; }
      input.addEventListener("input", () => { if (input.value.trim()) owner[key] = type === "number" ? Number(input.value) : input.value.trim(); else delete owner[key]; row.errors = (row.errors || []).filter((error) => error.values?.name !== key); this.changed(); });
      label.append(span, input); fields.append(label); card.params.push({ span, translation, input });
    }
    const audioLabel = viewElement("label", "field"); card.audioTitle = viewElement("span"); card.audio = document.createElement("select");
    card.audio.addEventListener("change", () => {
      if (card.audio.value === "__invalid__") return;
      if (!card.audio.value) delete row.params.audio; else row.params.audio = card.audio.value === "true";
      row.errors = (row.errors || []).filter((error) => error.values?.name !== "audio");
      if (card.audio.options[0]?.value === "__invalid__") this.fillAudio(card);
      this.changed();
    });
    audioLabel.append(card.audioTitle, card.audio); fields.append(audioLabel);
    card.details.append(fields);
    if (row.provider || row.region || row.baseUrl) card.details.append(viewElement("p", "field-meta", [row.provider, row.region, row.baseUrl].filter(Boolean).join(" · ")));
    card.status = viewElement("p", "field-meta");
    card.element.append(header, card.prompt, frameGrid, card.details, card.status);
    return card;
  }
  fillAudio(card) {
    const choices = BatchImport.audioChoices(card.row);
    fillSelect(card.audio, choices.values, choices.selected, (value) => t(value === "__invalid__" ? "audioInvalid" : value === "" ? "inheritDefaults" : value === "true" ? "audioEnabled" : "audioDisabled"));
    if (choices.selected === "__invalid__") card.audio.options[0].disabled = true;
  }
  // Only index- or language-dependent text changes after creation; unchanged
  // cards are skipped so removing one of 1,000 rows stays cheap.
  updateCard(card, index, locale) {
    if (card.index !== index || card.locale !== locale) {
      const row = index + 1;
      card.element.setAttribute("aria-label", t("rowNumber", { row }));
      card.title.textContent = t("rowNumber", { row });
      card.remove.textContent = t("removeRow"); card.remove.setAttribute("aria-label", t("rowRemoveNamed", { row }));
      card.prompt.setAttribute("aria-label", t("rowPrompt", { row }));
      if (card.locale !== locale) {
        card.summary.textContent = t("rowOverrides");
        for (const { span, translation, input } of card.params) { span.textContent = t(translation); input.placeholder = t("inheritDefaults"); }
        card.audioTitle.textContent = t("audio");
        this.fillAudio(card);
      }
      card.index = index; card.locale = locale; card.labelsChanged = true;
    }
    this.updateFrames(card);
  }
  updateFrames(card) {
    const row = card.row, number = card.index + 1, relabel = card.labelsChanged;
    card.labelsChanged = false;
    for (const kind of ["firstFrame", "lastFrame"]) {
      const frame = card.frames[kind], file = row[kind], first = kind === "firstFrame";
      if (frame.file !== file) {
        if (frame.url) { URL.revokeObjectURL(frame.url); frame.url = ""; }
        if (file) { frame.url = URL.createObjectURL(file); frame.preview.src = frame.url; frame.preview.alt = file.name; }
        else frame.preview.removeAttribute("src");
        frame.preview.hidden = !file; frame.file = file;
      }
      const name = row[`${kind}Name`] || t(first && file !== null ? "rowInheritFrame" : "noInputReference");
      if (frame.name.textContent !== name) frame.name.textContent = name;
      const hasFrame = Boolean(file || row[`${kind}Name`]);
      frame.clear.hidden = !hasFrame;
      if (relabel) {
        frame.title.textContent = t(first ? "rowFirstFrame" : "rowLastFrame");
        frame.input.setAttribute("aria-label", t(first ? "rowFirstFrameInput" : "rowLastFrameInput", { row: number }));
        frame.clear.textContent = t("inputReferenceClear");
        frame.clear.setAttribute("aria-label", t(first ? "rowClearFirstFrame" : "rowClearLastFrame", { row: number }));
      }
      if (frame.toggle) {
        frame.toggle.hidden = hasFrame;
        const disabled = row.firstFrame === null;
        if (relabel || frame.toggleDisabled !== disabled) {
          frame.toggle.textContent = t(disabled ? "rowUseSharedFrame" : "rowNoFrame");
          frame.toggle.setAttribute("aria-label", t(disabled ? "rowUseSharedFrameNamed" : "rowNoFrameNamed", { row: number }));
          frame.toggleDisabled = disabled;
        }
      }
    }
  }
  downloadExample() {
    const prompt = document.querySelector("#csvTemplateMode").checked ? "A cinematic shot of {{subject}}" : "A cinematic shot of a quiet forest";
    const csv = `prompt,subject,model,durationSeconds,resolution,aspectRatio,firstFrame,lastFrame,filename\r\n"${prompt}",a quiet forest,,,,,,,forest\r\n`;
    const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "videogen-import.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
