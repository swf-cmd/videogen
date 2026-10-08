const http = require("node:http");
const { PORT, DEFAULT_OUTPUT_DIR } = require("./src/config");
const { displayPathForUser } = require("./src/files/output");
const { handleRequest } = require("./src/http/router");

const server = http.createServer(handleRequest);

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Sora2App running at http://127.0.0.1:${PORT}`);
  console.log(`Default output folder: ${displayPathForUser(DEFAULT_OUTPUT_DIR)}`);
});
