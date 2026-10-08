const { MAX_JSON_BYTES } = require("../config");
const { st } = require("../i18n/server-messages");

async function readBody(req, language = "zh", limit = MAX_JSON_BYTES) {
  if (Number(req.headers["content-length"]) > limit) throw Object.assign(new Error(st(language, "requestTooLarge")), { status: 413 });
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw Object.assign(new Error(st(language, "requestTooLarge")), { status: 413 });
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  try {
    if (/^multipart\/form-data\b/i.test(req.headers["content-type"] || "")) {
      const form = await new Response(body, { headers: { "content-type": req.headers["content-type"] } }).formData();
      const payload = JSON.parse(String(form.get("payload") || "{}"));
      return { payload, file: form.get("input_reference") };
    }
    return { payload: body.length ? JSON.parse(body.toString("utf8")) : {}, file: null };
  } catch { throw new Error(st(language, "invalidJson")); }
}
module.exports = { readBody };
