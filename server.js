const { prepareServer, shutdownEvents, READY_MESSAGE } = require("./src/runtime-bootstrap");

async function startServer() {
  // Validate before loading modules which read configuration during import.
  const rawPort = process.env.PORT || "5177";
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    console.error("Invalid PORT; use an integer from 1 to 65535.");
    process.exitCode = 1;
    return;
  }
  const http = require("node:http");
  const { PORT } = require("./src/config");
  const { Application } = require("./src/application");
  const { configureApplication, handleRequest, localizedError } = require("./src/http/router");
  const { normalizeLanguage, languageFromRequest, st } = require("./src/i18n/server-messages");
  const language = normalizeLanguage(String(process.env.VIDEOGEN_LANGUAGE || process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || "en").slice(0, 2).toLowerCase());
  const report = (error) => {
    if (error?.code === "dataRecoveryRequired") {
      console.error(st(language, error.code, { directory: error.directory }));
    } else if (error?.syscall === "link" && ["ENOTSUP", "EOPNOTSUPP", "ENOSYS", "EPERM"].includes(error.code)) {
      const messages = {
        en: "The data directory must allow hard links (exFAT is unsupported). Choose a writable directory on a local system disk with VIDEOGEN_DATA_DIR.",
        zh: "数据目录必须允许硬链接（不支持 exFAT）。请通过 VIDEOGEN_DATA_DIR 选择本地系统磁盘上的可写目录。",
        ja: "データ保存先にはハードリンクが必要です（exFAT は非対応）。VIDEOGEN_DATA_DIR でローカルシステムディスク上の書き込み可能なフォルダーを指定してください。",
        ko: "데이터 폴더는 하드 링크를 지원해야 합니다(exFAT 미지원). VIDEOGEN_DATA_DIR로 로컬 시스템 디스크의 쓰기 가능한 폴더를 지정하세요.",
      };
      console.error(messages[language] || messages.en);
    } else console.error(localizedError(error, language).message);
  };
  let application, closing = false, ready = false;
  const server = http.createServer((req, res) => {
    if (ready) return handleRequest(req, res);
    res.writeHead(503, { "content-type": "application/json; charset=utf-8", "retry-after": "1", "X-Frame-Options": "DENY", "Content-Security-Policy": "frame-ancestors 'none'" });
    res.end(JSON.stringify({ error: localizedError({ code: "serviceStarting" }, languageFromRequest(req)) }));
  });
  async function shutdown(code = 0) {
    if (closing) return;
    closing = true;
    server.close();
    try { if (application) await application.close(); }
    catch (error) { report(error); code = 1; }
    process.exit(code);
  }
  shutdownEvents(() => shutdown());
  try {
    application = new Application({ port: PORT });
    configureApplication(application);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(PORT, "127.0.0.1", resolve);
    });
    server.on("error", (error) => { report(error); shutdown(1); });
    await application.start();
    if (closing) return;
    ready = true;
    if (process.connected) process.send({ type: READY_MESSAGE, port: PORT }, () => {});
    else console.log(`videogen running at http://127.0.0.1:${PORT}`);
  } catch (error) { report(error); await shutdown(1); }
}

if (prepareServer()) startServer().catch((error) => {
  // Startup failures should not dump environment-bearing stacks to the console.
  console.error(`Service startup failed (${error.code || "startupError"}).`);
  process.exitCode = 1;
});
