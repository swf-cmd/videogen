const base = require("./base");

function classifyError(error, phase = "poll") {
  if (phase === "create" && (Number(error?.status) >= 500 || Number(error?.status) === 408)) return "unknown_outcome";
  const code = String(error?.code || "");
  if (["AccountOverdueError", "OperationDenied.ServiceOverdue"].includes(code)) return "quota";
  if (code === "AuthenticationError") return "auth";
  if (/RateLimitExceeded|RpmRateLimitExceeded/.test(code) || ["InflightBatchsizeExceeded", "ServerOverloaded"].includes(code)) return "rate_limited";
  if (/SensitiveContentDetected/.test(code)) return "moderation";
  if (/^InvalidParameter/.test(code)) return "invalid_request";
  return base.classifyError(error, phase);
}

function assets(ctx) {
  if (ctx.assets.length > 1) throw new base.ProviderError("invalidAsset", { code: "invalidAsset", category: "invalid_request", accepted: false });
  return ctx.assets.map((asset) => {
    const { width, height } = asset;
    if (!Buffer.isBuffer(asset.buffer) || !asset.buffer.length || asset.buffer.length >= 30 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(asset.mimeType)
      || !Number.isInteger(width) || !Number.isInteger(height) || Math.min(width, height) < 300 || Math.max(width, height) > 6000 || width / height < 0.4 || width / height > 2.5) {
      throw new base.ProviderError("invalidAsset", { code: "invalidAsset", category: "invalid_request", accepted: false });
    }
    return { type: "image_url", image_url: { url: `data:${asset.mimeType};base64,${asset.buffer.toString("base64")}` }, role: "first_frame" };
  });
}

module.exports = {
  id: "ark", displayNameKey: "providerArk", createMode: "async", supportsIdempotencyKey: false,
  validateKey: (key) => base.validateKey(key), normalizeParams: base.normalizeParams, estimateCost: base.estimateCost, classifyError,
  async prepareAssets(ctx) { assets(ctx); return []; },
  async create(ctx, job, { signal } = {}) {
    if (job.params.seed !== undefined) throw new base.ProviderError("invalidParams", { code: "invalidParams", category: "invalid_request", accepted: false });
    const images = assets(ctx);
    if (job.assets?.length && !images.length) throw new base.ProviderError("invalidAsset", { code: "invalidAsset", category: "invalid_request", accepted: false });
    const body = { model: job.model, content: [{ type: "text", text: job.prompt }, ...images], resolution: job.params.resolution, ratio: images.length ? "adaptive" : job.params.aspectRatio, duration: job.params.durationSeconds, generate_audio: job.params.audio };
    try {
      const data = await base.parseJson(ctx, await ctx.fetch("contents/generations/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal, phase: "create" }), "create");
      return { remoteId: base.requireRemoteId(data.id, ctx.redact), status: base.normalizeStatus(data.status, { phase: "create" }) };
    } catch (error) { error.category = classifyError(error, "create"); throw error; }
  },
  async poll(ctx, job, { signal } = {}) {
    let data;
    try { data = await base.parseJson(ctx, await ctx.fetch(`contents/generations/tasks/${encodeURIComponent(job.remote.id)}`, { signal })); }
    catch (error) { error.category = classifyError(error); throw error; }
    const status = base.normalizeStatus(data.status);
    if (status === "succeeded" && !data.content?.video_url) throw new base.ProviderError("invalidProviderResponse", { category: "transient" });
    const error = data.error ? { category: classifyError(data.error), code: data.error.code || "providerFailed" } : undefined;
    return { status, error, ...(status === "succeeded" ? { result: { url: data.content.video_url, needsAuth: false, contentType: "video/mp4" } } : {}) };
  },
  async download(ctx, job, result, { signal } = {}) { return ctx.fetch(result.url, { needsAuth: false, signal, phase: "download", timeoutMs: 300000 }); },
};
