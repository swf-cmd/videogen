/* Shared, dependency-free CSV and template helpers. Never evaluate imported text. */
(function (root) {
  "use strict";
  function failure(code, values = {}) { return Object.assign(new Error(code), { code, values }); }
  function decodeCSV(bytes) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\0")) throw new Error("Unsupported encoding");
      return text;
    } catch { throw failure("csvEncoding"); }
  }
  const csvHeaders = new Map(["prompt", "model", "provider", "region", "baseUrl", "filename", "resolution", "aspectRatio", "requestFormat", "durationSeconds", "seed", "audio", "firstFrame", "lastFrame"].map((key) => [key.toLowerCase(), key]));
  function canonicalHeader(value) { const key = String(value).trim().normalize("NFC").toLowerCase(); return csvHeaders.get(key) || key; }
  function csvDelimiter(text) {
    let quoted = false, commas = 0, semicolons = 0, started = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (!/\s/.test(char)) started = true;
      if (char === '"') { if (quoted && text[index + 1] === '"') index += 1; else quoted = !quoted; }
      else if (!quoted && (char === "\r" || char === "\n")) { if (started) break; }
      else if (!quoted && char === ",") commas += 1;
      else if (!quoted && char === ";") semicolons += 1;
    }
    return semicolons > commas ? ";" : ",";
  }
  function parseCSV(source) {
    let text = String(source).replace(/^\uFEFF/, "");
    const directive = /^sep=([,;])\r?\n/i.exec(text);
    // Errors report the 1-based line in the file, which differs from the record
    // number when quoted prompts span several lines or blank lines are skipped.
    let line = 1;
    if (directive) { text = text.slice(directive[0].length); line = 2; }
    const delimiter = directive?.[1] || csvDelimiter(text);
    const records = []; let record = [], field = "", quoted = false, closed = false, recordLine = line;
    const endField = () => { record.push(field); field = ""; closed = false; };
    const endRecord = () => { endField(); if (record.some((value) => value.trim())) { record.line = recordLine; records.push(record); } record = []; };
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"') { if (text[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; closed = true; } }
        else { field += char; if (char === "\n" || char === "\r" && text[i + 1] !== "\n") line += 1; }
      } else if (char === delimiter) endField();
      else if (char === '\r' || char === '\n') { if (char === '\r' && text[i + 1] === '\n') i += 1; endRecord(); line += 1; recordLine = line; }
      // Hand-edited files often put a space after the delimiter: `a, "b, c"`.
      else if (char === '"' && !closed && /^[ \t]*$/.test(field)) { field = ""; quoted = true; }
      else if (closed && /\s/.test(char)) continue;
      else { if (closed || char === '"') throw failure("csvMalformed", { line }); field += char; }
    }
    if (quoted) throw failure("csvMalformed", { line: recordLine });
    if (field || record.length || closed) endRecord();
    if (!records.length) return [];
    let headers = records.shift().map(canonicalHeader);
    // Spreadsheet exports can end the header with empty cells ("prompt,filename,").
    // They are ignored as long as every row leaves those cells empty too.
    let width = headers.length;
    while (width > 0 && !headers[width - 1]) width -= 1;
    headers = headers.slice(0, width);
    if (!headers.length || headers.some((value) => !value) || new Set(headers).size !== headers.length) throw failure("csvHeaders");
    return records.map((values) => {
      if (values.length > headers.length && values.slice(headers.length).some((value) => value.trim())) throw failure("csvColumns", { line: values.line });
      const row = Object.create(null);
      headers.forEach((header, column) => { row[header] = values[column] ?? ""; });
      return row;
    });
  }
  function renderTemplate(template, values) {
    const missing = new Set();
    const keys = new Map(Object.keys(values).map((key) => [canonicalHeader(key), key]));
    const text = String(template).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, name) => {
      const key = keys.get(canonicalHeader(name));
      if (key === undefined) { missing.add(name); return `{{${name}}}`; }
      return String(values[key] ?? "");
    });
    return { text, missing: [...missing] };
  }
  // Template variables of one CSV row: every column, plus {{index}} as the
  // 1-based row number unless the CSV has its own `index` column.
  function rowVariables(data, rowNumber) {
    const variables = Object.assign(Object.create(null), data);
    if (!("index" in variables)) variables.index = rowNumber;
    return variables;
  }
  function rowsFromCSV(source, template = "", { templatePrompts = false } = {}) {
    return parseCSV(source).map((data, rowIndex) => {
      const prompt = data.prompt?.trim() || "";
      const templateMode = prompt ? templatePrompts : Boolean(template.trim());
      const rendered = templateMode ? renderTemplate(prompt || template, rowVariables(data, rowIndex + 1)) : { text: prompt, missing: [] };
      const row = { prompt: rendered.text, templateMode, params: {}, errors: rendered.missing.map((name) => ({ code: "templateMissing", values: { name } })) };
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
  // Literal mode (the default) sends {{name}} unchanged. Report prompts whose
  // variables would expand from this CSV so the UI can offer template mode.
  function literalTemplateVariables(source) {
    const rows = parseCSV(source);
    const available = new Set(rows.length ? [...Object.keys(rows[0]), "index"] : []);
    available.delete("prompt");
    const names = new Set(); let count = 0;
    for (const data of rows) {
      let found = false;
      for (const [, name] of String(data.prompt || "").matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
        if (!available.has(canonicalHeader(name))) continue;
        names.add(`{{${name}}}`); found = true;
      }
      if (found) count += 1;
    }
    return { count, names: [...names] };
  }
  function normalizePath(value) { return String(value).normalize("NFC").replace(/\\/g, "/").replace(/^\.\//, ""); }
  function findImageFile(name, files) {
    const target = normalizePath(name);
    const candidates = files.map((file) => ({ file, path: normalizePath(file.webkitRelativePath || file.name), name: normalizePath(file.name) }));
    const choose = (matches) => matches.length === 1 ? { file: matches[0].file } : { error: "imageAmbiguous" };
    const exact = candidates.filter((entry) => entry.path === target);
    if (exact.length) return choose(exact);
    const suffix = candidates.filter((entry) => entry.path.endsWith(`/${target}`) || entry.name === target);
    if (suffix.length) return choose(suffix);
    // A case-insensitive fallback is safe only when the whole candidate set is
    // unique. Never select the first of two different frames with folded names.
    const folded = target.toLowerCase();
    const matches = candidates.filter((entry) => entry.path.toLowerCase() === folded || entry.path.toLowerCase().endsWith(`/${folded}`) || entry.name.toLowerCase() === folded);
    return matches.length ? choose(matches) : { error: "imageMissing" };
  }
  function compareImageFiles(a, b) { return normalizePath(a.webkitRelativePath || a.name).localeCompare(normalizePath(b.webkitRelativePath || b.name), "en", { numeric: true, sensitivity: "base" }); }
  function imageVariables(file, index) { return { filename: file.name, stem: file.name.replace(/\.[^.]+$/, ""), index: index + 1 }; }
  function promptErrors(prompt, errors = [], templateMode = false) {
    const result = errors.filter((error) => !["missingPrompt", "templateMissing"].includes(error.code));
    if (!String(prompt).trim()) result.push({ code: "missingPrompt" });
    for (const name of templateMode ? renderTemplate(prompt, {}).missing : []) result.push({ code: "templateMissing", values: { name } });
    return result;
  }
  function audioChoices(row) {
    const invalid = row.errors?.some((error) => error.code === "csvBoolean" && error.values?.name === "audio");
    return { values: [...(invalid ? ["__invalid__"] : []), "", "true", "false"], selected: invalid ? "__invalid__" : row.params.audio === undefined ? "" : String(row.params.audio) };
  }
  const api = { decodeCSV, parseCSV, renderTemplate, rowsFromCSV, literalTemplateVariables, findImageFile, compareImageFiles, imageVariables, promptErrors, audioChoices };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BatchImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
