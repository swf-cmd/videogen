const base = require("./base");

function pixelSize(params) {
  if (/^\d+x\d+$/.test(params.resolution)) return params.resolution;
  const height = Number.parseInt(params.resolution, 10);
  const [widthRatio, heightRatio] = String(params.aspectRatio).split(":").map(Number);
  if (!height || !widthRatio || !heightRatio) throw new base.ProviderError("invalidParameter", { category: "invalid_request", accepted: false });
  return widthRatio >= heightRatio ? `${Math.round(height * widthRatio / heightRatio / 2) * 2}x${height}` : `${height}x${Math.round(height * heightRatio / widthRatio / 2) * 2}`;
}

const adapter = {
  id: "openai-compatible", displayNameKey: "providerOpenAICompatible", createMode: "async", supportsIdempotencyKey: false,
  validateKey: (key) => base.validateKey(key, null, true),
  normalizeParams: base.normalizeParams, estimateCost: base.estimateCost, classifyError: base.classifyError,
  async prepareAssets(ctx) { return ctx.assets; },
  async create(ctx, job, { signal } = {}) {
    const fields = { model: job.model, prompt: job.prompt, seconds: String(job.params.durationSeconds), size: pixelSize(job.params) };
    if (job.params.seed !== undefined) fields.seed = job.params.seed;
    const model = ctx.catalog?.models?.find((item) => item.id === job.model) || ctx.catalog;
    const multipart = ctx.assets.length || job.params.requestFormat === "multipart" || model?.requestFormat === "multipart" || ctx.lane.requestFormat === "multipart";
    let body = JSON.stringify(fields);
    let headers = { "content-type": "application/json" };
    if (multipart) {
      body = new FormData();
      for (const [name, value] of Object.entries(fields)) body.set(name, String(value));
      const asset = ctx.assets[0];
      if (asset) body.set("input_reference", new Blob([asset.buffer], { type: asset.mimeType || asset.mime }), asset.filename || "first-frame.png");
      headers = {};
    }
    const data = await base.parseJson(ctx, await ctx.fetch("videos", { method: "POST", headers, body, signal, phase: "create" }), "create");
    return { remoteId: base.requireRemoteId(data.id), status: base.normalizeStatus(data.status, { phase: "create" }) };
  },
  async poll(ctx, job, { signal } = {}) {
    const id = encodeURIComponent(job.remote.id);
    const data = await base.parseJson(ctx, await ctx.fetch(`videos/${id}`, { signal }));
    const status = base.normalizeStatus(data.status);
    const result = status === "succeeded" ? { url: new URL(`videos/${id}/content`, `${ctx.lane.baseUrl.replace(/\/$/, "")}/`).href, needsAuth: true, contentType: "video/mp4" } : undefined;
    const error = data.error ? { category: base.classifyError(data.error, "poll"), code: data.error.code || "providerFailed", message: ctx.redact(data.error.message || data.error) } : undefined;
    return { status, progress: Number.isFinite(data.progress) ? data.progress : undefined, result, error };
  },
  async download(ctx, job, result, { signal } = {}) { return ctx.fetch(result.url, { needsAuth: result.needsAuth, signal, phase: "download", timeoutMs: 300000 }); },
  async listModels(ctx) { return base.parseJson(ctx, await ctx.fetch("models")); },
};

module.exports = adapter;
module.exports.pixelSize = pixelSize;
