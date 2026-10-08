const { redact } = require("../queue/keys");
const { redactLocalPaths } = require("./errors");

function sendJson(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(redactLocalPaths(redact(data))));
}

function sendText(res, status, message) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(message);
}

module.exports = {
  sendJson,
  sendText,
};
