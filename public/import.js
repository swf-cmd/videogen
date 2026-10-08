/* Shared, dependency-free CSV and template helpers. Never evaluate imported text. */
(function (root) {
  "use strict";
  function failure(code, values = {}) { return Object.assign(new Error(code), { code, values }); }
  function parseCSV(source) {
    const text = String(source).replace(/^\uFEFF/, "");
    const records = []; let record = [], field = "", quoted = false, closed = false;
    const endField = () => { record.push(field); field = ""; closed = false; };
    const endRecord = () => { endField(); if (record.some((value) => value.trim())) records.push(record); record = []; };
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"') { if (text[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; closed = true; } }
        else field += char;
      } else if (char === ',') endField();
      else if (char === '\r' || char === '\n') { if (char === '\r' && text[i + 1] === '\n') i += 1; endRecord(); }
      else if (char === '"' && !field && !closed) quoted = true;
      else if (closed && /\s/.test(char)) continue;
      else { if (closed || char === '"') throw failure("csvMalformed"); field += char; }
    }
    if (quoted) throw failure("csvMalformed");
    if (field || record.length || closed) endRecord();
    if (!records.length) return [];
    const headers = records.shift().map((value) => value.trim());
    if (headers.some((value) => !value) || new Set(headers).size !== headers.length) throw failure("csvHeaders");
    return records.map((values, index) => {
      if (values.length > headers.length) throw failure("csvColumns", { row: index + 2 });
      const row = Object.create(null);
      headers.forEach((header, column) => { row[header] = values[column] ?? ""; });
      return row;
    });
  }
  function renderTemplate(template, values) {
    const missing = new Set();
    const text = String(template).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, name) => {
      if (!Object.prototype.hasOwnProperty.call(values, name)) { missing.add(name); return `{{${name}}}`; }
      return String(values[name] ?? "");
    });
    return { text, missing: [...missing] };
  }
  function rowsFromCSV(source, template = "") {
    return parseCSV(source).map((data, index) => {
      const rendered = renderTemplate(data.prompt?.trim() || template, { ...data, index: index + 1 });
      const row = { prompt: rendered.text, params: {}, errors: rendered.missing.map((name) => ({ code: "templateMissing", values: { name } })) };
      for (const key of ["model", "provider", "region", "baseUrl", "filename"]) if (data[key]?.trim()) row[key] = data[key].trim();
      for (const key of ["resolution", "aspectRatio", "requestFormat"]) if (data[key]?.trim()) row.params[key] = data[key].trim();
      for (const key of ["durationSeconds", "seed"]) if (data[key]?.trim()) {
        const value = Number(data[key]);
        if (!Number.isFinite(value)) row.errors.push({ code: "csvNumber", values: { name: key } });
        else row.params[key] = value;
      }
      if (data.audio?.trim()) {
        const value = data.audio.trim().toLowerCase();
        if (!["true", "false", "1", "0"].includes(value)) row.errors.push({ code: "csvBoolean", values: { name: "audio" } });
        else row.params.audio = value === "true" || value === "1";
      }
      for (const kind of ["firstFrame", "lastFrame"]) if (data[kind]?.trim()) row[`${kind}Name`] = data[kind].trim();
      if (!row.prompt.trim()) row.errors.push({ code: "missingPrompt" });
      return row;
    });
  }
  function normalizePath(value) { return String(value).replace(/\\/g, "/").replace(/^\.\//, ""); }
  function findImageFile(name, files) {
    const target = normalizePath(name);
    const exact = files.filter((file) => normalizePath(file.webkitRelativePath || file.name) === target);
    if (exact.length === 1) return { file: exact[0] };
    const suffix = files.filter((file) => normalizePath(file.webkitRelativePath || file.name).endsWith(`/${target}`) || file.name === target);
    if (suffix.length === 1) return { file: suffix[0] };
    return { error: suffix.length || exact.length ? "imageAmbiguous" : "imageMissing" };
  }
  function imageVariables(file, index) { return { filename: file.name, stem: file.name.replace(/\.[^.]+$/, ""), index: index + 1 }; }
  function promptErrors(prompt, errors = []) {
    const result = errors.filter((error) => !["missingPrompt", "templateMissing"].includes(error.code));
    if (!String(prompt).trim()) result.push({ code: "missingPrompt" });
    for (const name of renderTemplate(prompt, {}).missing) result.push({ code: "templateMissing", values: { name } });
    return result;
  }
  function audioChoices(row) {
    const invalid = row.errors?.some((error) => error.code === "csvBoolean" && error.values?.name === "audio");
    return { values: [...(invalid ? ["__invalid__"] : []), "", "true", "false"], selected: invalid ? "__invalid__" : row.params.audio === undefined ? "" : String(row.params.audio) };
  }
  const api = { parseCSV, renderTemplate, rowsFromCSV, findImageFile, imageVariables, promptErrors, audioChoices };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BatchImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
