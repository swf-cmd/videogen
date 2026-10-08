const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { root } = require("./helpers/legacy-server");

test("literal frontend ID selectors reference existing unique HTML IDs", () => {
  const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
  const ids = Array.from(html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g), (match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "HTML contains duplicate IDs");
  const references = Array.from(source.matchAll(/\bquerySelector\s*\(\s*(["'`])#([A-Za-z][\w:-]*)\1\s*\)/g), (match) => match[2]);
  assert.ok(references.length > 0, "No literal ID selectors were found");
  for (const id of references) assert.ok(ids.includes(id), `Missing HTML element #${id}`);
});

function javascriptFiles(directory) {
  const ignored = new Set([".git", ".astra", "node_modules", "runtime", "outputs", "dist", "release"]);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name)) return [];
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(filename);
    return entry.isFile() && /\.(?:js|cjs|mjs)$/.test(entry.name) ? [filename] : [];
  });
}

test("every JavaScript source passes node --check", () => {
  const files = javascriptFiles(root);
  assert.ok(files.length >= 2);
  for (const filename of files) {
    const result = spawnSync(process.execPath, ["--check", filename], { encoding: "utf8", timeout: 5000 });
    assert.equal(result.status, 0, `${path.relative(root, filename)}: ${result.error || result.stderr}`);
  }
});
