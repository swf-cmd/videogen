const base = require("./base");
const { validateAssets, frameAssets } = require("./frames");

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

function validateLocalAssets(assets) {
  for (const asset of assets) {
    const { width, height } = asset;
    if (!Buffer.isBuffer(asset.buffer) || !asset.buffer.length || asset.buffer.length >= 30 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(asset.mimeType)
      || !Number.isInteger(width) || !Number.isInteger(height) || Math.min(width, height) < 300 || Math.max(width, height) > 6000 || width / height < 0.4 || width / height > 2.5) {
      return "invalidAsset";
    }
  }
  return null;
}

function assets(ctx, job) {
  const frames = frameAssets(ctx, job);
  const error = validateLocalAssets(frames);
  if (error) throw new base.ProviderError(error, { code: error, category: "invalid_request", accepted: false });
  return frames.map((asset) => {
    return { type: "image_url", image_url: { url: `data:${asset.mimeType};base64,${asset.buffer.toString("base64")}` }, role: asset.role };
  });
}

module.exports = {
  id: "ark", displayNameKey: "providerArk", createMode: "async", supportsIdempotencyKey: false,
  validateKey: (key) => base.validateKey(key), validateAssets, validateLocalAssets, normalizeParams: base.normalizeParams,
  estimateCost(model, params) { return base.estimateCost(model, params.frameCount ? { ...params, aspectRatio: "adaptive" } : params); }, classifyError,
  async prepareAssets(ctx, job) { assets(ctx, job); return []; },
  async create(ctx, job, { signal } = {}) {
    if (job.params.seed !== undefined) throw new base.ProviderError("invalidParams", { code: "invalidParams", category: "invalid_request", accepted: false });
    const images = assets(ctx, job);
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
