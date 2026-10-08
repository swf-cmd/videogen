const http = require("node:http");
const { PORT } = require("./src/config");
const { Application } = require("./src/application");
const { configureApplication, handleRequest, localizedError } = require("./src/http/router");

let application;
try { application = new Application({ port: PORT }); }
catch (error) { console.error(localizedError(error, "zh").message); process.exit(1); }
configureApplication(application);
const server = http.createServer(handleRequest);
server.listen(PORT, "127.0.0.1", () => {
  application.start().then(() => console.log(`videogen running at http://127.0.0.1:${PORT}`))
    .catch((error) => { console.error(localizedError(error, "zh").message); application.store.close(); process.exit(1); });
});
server.on("error", (error) => { console.error(localizedError(error, "zh").message); application.store.close(); process.exit(1); });
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close();
  await application.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
