const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
const slice = (start, end) => appSource.slice(appSource.indexOf(start), appSource.indexOf(end));

// Loads t() and the status-line helpers from app.js with a tiny DOM.
function statusHarness() {
  const translations = {
    zh: { readyLog: "本机服务已就绪。", importedRows: "已导入 {count} 条任务。", loadCatalogError: "无法加载模型目录：{message}", serviceUnreachable: "无法连接本机服务。" },
    en: { readyLog: "Local service ready.", importedRows: "Imported {count} tasks.", loadCatalogError: "Could not load the model catalog: {message}", serviceUnreachable: "Cannot reach the local service." },
  };
  const elements = Object.fromEntries(["#formMessage", "#queueMessage", "#reviewMessage"].map((id) => [id, { textContent: "", classList: { toggle() {} } }]));
  const context = vm.createContext({ translations, activeLanguage: "zh", document: { querySelector: (id) => elements[id] } });
  const helpers = vm.runInContext(`${slice("const recentTranslations", "function currentLocale()")}
${slice("function formMessage(", "function providerName(")}
({ t, formMessage, watchStatusLines, renderStatusLines, recentTranslations })`, context);
  helpers.watchStatusLines();
  const switchTo = (language) => { context.activeLanguage = language; helpers.renderStatusLines(); };
  return { ...helpers, elements, switchTo };
}

test("status lines produced by t() follow a language switch, including nested values", () => {
  const app = statusHarness();
  app.formMessage(app.t("readyLog"));
  app.elements["#queueMessage"].textContent = app.t("importedRows", { count: "1,000" });
  app.elements["#reviewMessage"].textContent = app.t("loadCatalogError", { message: app.t("serviceUnreachable") });
  app.switchTo("en");
  assert.equal(app.elements["#formMessage"].textContent, "Local service ready.");
  assert.equal(app.elements["#queueMessage"].textContent, "Imported 1,000 tasks.");
  assert.equal(app.elements["#reviewMessage"].textContent, "Could not load the model catalog: Cannot reach the local service.");
  app.switchTo("zh");
  assert.equal(app.elements["#formMessage"].textContent, "本机服务已就绪。");
  assert.equal(app.elements["#reviewMessage"].textContent, "无法加载模型目录：无法连接本机服务。");
});

test("server-localized text and cleared lines are left alone, and the origin table stays bounded", () => {
  const app = statusHarness();
  app.formMessage("服务器返回的错误。", true);
  app.elements["#queueMessage"].textContent = app.t("loadCatalogError", { message: "服务器返回的错误。" });
  app.switchTo("en");
  assert.equal(app.elements["#formMessage"].textContent, "服务器返回的错误。", "text without a t() origin is not guessed");
  assert.equal(app.elements["#queueMessage"].textContent, "Could not load the model catalog: 服务器返回的错误。");
  app.formMessage("");
  app.switchTo("zh");
  assert.equal(app.elements["#formMessage"].textContent, "");
  for (let index = 0; index < 10050; index += 1) app.t("importedRows", { count: index });
  assert.ok(app.recentTranslations.size <= 10000);
});
