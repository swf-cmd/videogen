const { MAX_JSON_BYTES } = require("../config");
const { st } = require("../i18n/server-messages");

async function readBody(req, language = "zh", limit = MAX_JSON_BYTES) {
  const oversized = () => Object.assign(new Error(st(language, "requestTooLarge")), { status: 413 });
  if (Number(req.headers["content-length"]) > limit) { req.resume(); throw oversized(); }
  const body = await new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    const cleanup = () => { req.off("data", onData); req.off("end", onEnd); req.off("error", onError); req.off("aborted", onAborted); };
    const onError = (error) => { cleanup(); reject(error); };
    const onAborted = () => onError(new Error("requestAborted"));
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks)); };
    const onData = (chunk) => {
      total += chunk.length;
      if (total > limit) { cleanup(); req.resume(); reject(oversized()); return; }
      chunks.push(chunk);
    };
    req.on("data", onData); req.once("end", onEnd); req.once("error", onError); req.once("aborted", onAborted);
  });
  try {
    if (/^multipart\/form-data\b/i.test(req.headers["content-type"] || "")) {
      const form = await new Response(body, { headers: { "content-type": req.headers["content-type"] } }).formData();
      const payload = JSON.parse(String(form.get("payload") || "{}"));
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalidJson");
      const files = new Map();
      for (const [name, value] of form) {
        if (name === "payload") continue;
        if (typeof value === "string" || files.has(name)) throw new Error("invalidAsset");
        files.set(name, value);
      }
      return { payload, file: files.get("input_reference"), files };
    }
    const payload = body.length ? JSON.parse(body.toString("utf8")) : {};
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalidJson");
    return { payload, file: null, files: new Map() };
  } catch { throw new Error(st(language, "invalidJson")); }
}
module.exports = { readBody };
