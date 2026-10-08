class BatchEditor {
  constructor() {
    this.rows = []; this.enabled = false; this.files = []; this.previewUrls = []; this.estimates = [];
    this.container = document.querySelector("#batchRows");
    document.querySelector("#rowMode").addEventListener("change", (event) => {
      this.enabled = event.target.checked;
      if (this.enabled && !this.rows.length && !this.fromPrompts()) { this.enabled = false; event.target.checked = false; }
      this.render(); this.changed();
    });
    document.querySelector("#rowsFromPrompts").addEventListener("click", () => { if (this.fromPrompts()) this.activate(); });
    document.querySelector("#addBatchRow").addEventListener("click", () => { this.rows.push({ prompt: "", params: {}, errors: [] }); this.activate(); });
    document.querySelector("#csvImport").addEventListener("change", (event) => this.importCSV(event.target));
    document.querySelector("#folderImport").addEventListener("change", (event) => this.importFolder(event.target));
    document.querySelector("#downloadCsvExample").addEventListener("click", () => this.downloadExample());
  }
  changed() { this.estimates = []; updatePromptMeta(); scheduleEstimate(); this.renderStatuses(); }
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
      const rows = BatchImport.rowsFromCSV(BatchImport.decodeCSV(await file.arrayBuffer()), document.querySelector("#importTemplate").value.trim(), { templatePrompts: document.querySelector("#csvTemplateMode").checked });
      if (!rows.length) throw new Error(t("csvEmpty"));
      if (rows.length > 1000) throw new Error(t("importTooMany"));
      this.rows = rows; this.resolveImages(); this.activate();
      formMessage(t("importedRows", { count: rows.length }));
    } catch (error) { formMessage(error.code ? t(error.code, error.values) : error.message, true); }
    finally { input.value = ""; }
  }
  importFolder(input) {
    try {
      const files = [...(input.files || [])].filter((file) => supportedInputReferenceTypes.has(inputReferenceMimeType(file))).sort(BatchImport.compareImageFiles);
      if (!files.length) throw new Error(t("folderEmpty"));
      if (files.length > 1000) throw new Error(t("importTooMany"));
      this.files = files;
      if (this.rows.some((row) => row.firstFrameName || row.lastFrameName || row.firstFrame || row.lastFrame)) this.resolveImages();
      else {
        const template = document.querySelector("#importTemplate").value.trim() || promptInput.value.trim();
        this.rows = this.files.map((file, index) => {
          const prompt = BatchImport.renderTemplate(template, BatchImport.imageVariables(file, index));
          return { prompt: prompt.text, templateMode: true, params: {}, firstFrame: file, firstFrameSource: "folder", firstFrameName: file.webkitRelativePath || file.name, errors: prompt.missing.map((name) => ({ code: "templateMissing", values: { name } })) };
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
  async prepareFiles(payload) {
    const files = {};
    for (let index = 0; index < this.rows.length; index += 1) {
      const row = this.rows[index];
      for (const kind of ["firstFrame", "lastFrame"]) {
        const field = payload.rows[index][kind];
        if (!field || files[field]) continue;
        const file = row[kind] || (kind === "firstFrame" ? selectedInputReferenceFile() : null);
        if (!file) throw new Error(t("rowInvalid", { row: index + 1, error: t("imageMissing", { name: row[`${kind}Name`] || "" }) }));
        if (!supportedInputReferenceTypes.has(inputReferenceMimeType(file))) throw new Error(t("inputReferenceInvalidType"));
        const target = selectedImageSize({ ...payload.params, ...row.params });
        const prepared = target ? await fitInputReferenceFile(file, target) : file;
        if (prepared.size > maxInputReferenceBytes) throw new Error(t("rowInvalid", { row: index + 1, error: t("inputReferenceTooLarge") }));
        files[field] = prepared;
      }
    }
    return files;
  }
  setEstimates(estimate) { this.estimates = estimate?.rows || []; this.renderStatuses(); }
  renderStatuses() {
    this.rows.forEach((row, index) => {
      const element = this.container.querySelector(`[data-row-status="${index}"]`); if (!element) return;
      const errors = this.rowErrors(row).map((error) => t(error.code, error.values));
      const estimate = this.estimates[index];
      for (const error of estimate?.errors || []) errors.push(t(typeof error === "string" ? error : error.code || error.message));
      element.classList.toggle("is-error", errors.length > 0);
      element.textContent = errors.length ? errors.join(" · ") : estimate ? `${t("rowReady")} · ${estimate.model || ""} · ${[estimate.params?.durationSeconds && `${estimate.params.durationSeconds}${t("secondUnit")}`, estimate.params?.resolution, estimate.params?.aspectRatio].filter(Boolean).join(" / ")} · ${formatCost(estimate.cost)}` : t("rowPending");
    });
  }
  render() {
    document.querySelector("#rowEditorPanel").hidden = !this.enabled;
    promptInput.required = !this.enabled;
    this.previewUrls.forEach((url) => URL.revokeObjectURL(url)); this.previewUrls = [];
    this.container.textContent = "";
    if (!this.enabled) return;
    this.rows.forEach((row, index) => {
      const card = viewElement("article", "draft-row");
      const header = viewElement("div", "section-head");
      header.append(viewElement("strong", "", t("rowNumber", { row: index + 1 })), viewButton(t("removeRow"), () => { this.rows.splice(index, 1); this.render(); this.changed(); }));
      const prompt = document.createElement("textarea"); prompt.rows = 3; prompt.value = row.prompt; prompt.setAttribute("aria-label", t("rowPrompt", { row: index + 1 }));
      prompt.addEventListener("input", () => { row.prompt = prompt.value; this.changed(); this.renderStatuses(); });
      const frameGrid = viewElement("div", "row-frame-grid");
      for (const kind of ["firstFrame", "lastFrame"]) {
        const label = viewElement("label", "field"); label.append(viewElement("span", "", t(kind === "firstFrame" ? "rowFirstFrame" : "rowLastFrame")));
        const input = document.createElement("input"); input.type = "file"; input.accept = "image/jpeg,image/png,image/webp";
        input.addEventListener("change", () => { row[kind] = input.files?.[0] || null; row[`${kind}Source`] = "manual"; row[`${kind}Name`] = row[kind]?.name || ""; delete row[`${kind}Error`]; this.render(); this.changed(); });
        label.append(input);
        if (row[kind]) {
          const preview = document.createElement("img"); const url = URL.createObjectURL(row[kind]); this.previewUrls.push(url); preview.src = url; preview.alt = row[kind].name; preview.className = "draft-frame-preview"; label.append(preview);
        }
        label.append(viewElement("small", "field-meta", row[`${kind}Name`] || t(kind === "firstFrame" && row[kind] !== null ? "rowInheritFrame" : "noInputReference")));
        if (row[kind] || row[`${kind}Name`]) label.append(viewButton(t("inputReferenceClear"), () => { row[kind] = null; row[`${kind}Name`] = ""; this.render(); this.changed(); }, "text-button"));
        else if (kind === "firstFrame") label.append(viewButton(t(row.firstFrame === null ? "rowUseSharedFrame" : "rowNoFrame"), () => { if (row.firstFrame === null) delete row.firstFrame; else row.firstFrame = null; this.render(); this.changed(); }, "text-button"));
        frameGrid.append(label);
      }
      const details = viewElement("details", "row-options"); details.append(viewElement("summary", "", t("rowOverrides")));
      const fields = viewElement("div", "row-params");
      for (const [key, translation, type] of [["model", "modelLabel", "text"], ["durationSeconds", "secondsLabel", "number"], ["resolution", "sizeLabel", "text"], ["aspectRatio", "aspectRatio", "text"], ["seed", "seed", "number"], ["filename", "filenameLabel", "text"]]) {
        const owner = ["model", "filename"].includes(key) ? row : row.params;
        const label = viewElement("label", "field"); const input = document.createElement("input"); input.type = type; input.value = owner[key] ?? ""; input.placeholder = t("inheritDefaults");
        if (type === "number") { input.min = key === "seed" ? "-1" : "1"; input.step = "1"; }
        input.addEventListener("input", () => { if (input.value.trim()) owner[key] = type === "number" ? Number(input.value) : input.value.trim(); else delete owner[key]; row.errors = (row.errors || []).filter((error) => error.values?.name !== key); this.changed(); this.renderStatuses(); });
        label.append(viewElement("span", "", t(translation)), input); fields.append(label);
      }
      const audioLabel = viewElement("label", "field"); const audio = document.createElement("select");
      const choices = BatchImport.audioChoices(row);
      fillSelect(audio, choices.values, choices.selected, (value) => t(value === "__invalid__" ? "audioInvalid" : value === "" ? "inheritDefaults" : value === "true" ? "audioEnabled" : "audioDisabled"));
      if (choices.selected === "__invalid__") audio.options[0].disabled = true;
      audio.addEventListener("change", () => { if (audio.value === "__invalid__") return; if (!audio.value) delete row.params.audio; else row.params.audio = audio.value === "true"; row.errors = (row.errors || []).filter((error) => error.values?.name !== "audio"); this.changed(); this.renderStatuses(); });
      audioLabel.append(viewElement("span", "", t("audio")), audio); fields.append(audioLabel);
      details.append(fields);
      if (row.provider || row.region || row.baseUrl) details.append(viewElement("p", "field-meta", [row.provider, row.region, row.baseUrl].filter(Boolean).join(" · ")));
      const status = viewElement("p", "field-meta"); status.dataset.rowStatus = index;
      card.append(header, prompt, frameGrid, details, status); this.container.append(card);
    });
    this.renderStatuses();
  }
  downloadExample() {
    const prompt = document.querySelector("#csvTemplateMode").checked ? "A cinematic shot of {{subject}}" : "A cinematic shot of a quiet forest";
    const csv = `prompt,subject,model,durationSeconds,resolution,aspectRatio,firstFrame,lastFrame,filename\r\n"${prompt}",a quiet forest,,,,,,,forest\r\n`;
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "videogen-import.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
