const base = require("./base");
const frames = require("./frames");
const pricing = require("../catalog/openrouter-pricing");

function validateAssets(model, params, roles) {
  const error = frames.validateAssets(model, params, roles);
  if (error) return error;
  if (roles?.includes("first_frame") && model?.capabilities?.firstFrame !== true) return "unsupportedFirstFrame";
  if (roles?.includes("last_frame") && model?.capabilities?.lastFrame !== true) return "unsupportedLastFrame";
  return null;
}

function validateLocalAssets(assets) {
  return assets.some((asset) => !Buffer.isBuffer(asset.buffer) || !asset.buffer.length || asset.buffer.length > 20 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(asset.mimeType)) ? "invalidAsset" : null;
}

// OpenRouter app attribution (https://openrouter.ai/docs/app-attribution):
// identifies requests as coming from videogen in OpenRouter's public app
// rankings. It carries no user data. Set VIDEOGEN_OPENROUTER_ATTRIBUTION=0 to
// omit these headers.
function attribution(headers = {}) {
  if (process.env.VIDEOGEN_OPENROUTER_ATTRIBUTION === "0") return headers;
  return { ...headers, "HTTP-Referer": "https://github.com/swf-cmd/videogen", "X-OpenRouter-Title": "videogen", "X-OpenRouter-Categories": "video-gen" };
}

function frameImages(ctx, job) {
  const model = ctx.catalog?.models?.find((item) => item.id === job?.model) || ctx.catalog;
  const assets = frames.frameAssets(ctx, job);
  const error = validateAssets(model, job?.params, assets.map((asset) => asset.role)) || validateLocalAssets(assets);
  if (error) throw new base.ProviderError(error, { code: error, category: "invalid_request", accepted: false });
  return assets.map((asset) => {
    return { type: "image_url", image_url: { url: `data:${asset.mimeType};base64,${asset.buffer.toString("base64")}` }, frame_type: asset.role };
  });
}

module.exports = {
  attribution,
  id: "openrouter", displayNameKey: "providerOpenRouter", createMode: "async", supportsIdempotencyKey: false,
  validateKey: (key) => base.validateKey(key, "sk-or-"),
  validateAssets, validateLocalAssets, normalizeParams: base.normalizeParams,
  estimateCost: (model, params) => model.pricingSkus ? pricing.estimate(model.pricingSkus, params) : base.estimateCost(model, params), classifyError: base.classifyError,
  async prepareAssets(ctx, job) { frameImages(ctx, job); return []; },
  async create(ctx, job, { signal } = {}) {
    const images = frameImages(ctx, job);
    const body = { model: job.model, prompt: job.prompt, duration: job.params.durationSeconds, resolution: job.params.resolution, aspect_ratio: job.params.aspectRatio, generate_audio: job.params.audio };
    if (job.params.seed !== undefined) body.seed = job.params.seed;
    if (images.length) body.frame_images = images;
    const data = await base.parseJson(ctx, await ctx.fetch("videos", { method: "POST", headers: attribution({ "content-type": "application/json" }), body: JSON.stringify(body), signal, phase: "create" }), "create");
    const remoteId = base.requireRemoteId(data.id);
    const pollingUrl = new URL(`videos/${encodeURIComponent(remoteId)}`, `${ctx.lane.baseUrl.replace(/\/$/, "")}/`).href;
    return { remoteId, pollingUrl, status: base.normalizeStatus(data.status, { phase: "create" }) };
  },
  async poll(ctx, job, { signal } = {}) {
    const id = encodeURIComponent(job.remote.id);
    const data = await base.parseJson(ctx, await ctx.fetch(`videos/${id}`, { signal, headers: attribution() }));
    const status = base.normalizeStatus(data.status);
    const result = status === "succeeded" ? { url: new URL(`videos/${id}/content?index=0`, `${ctx.lane.baseUrl.replace(/\/$/, "")}/`).href, needsAuth: true, contentType: "video/mp4" } : undefined;
    const error = data.error ? { category: base.classifyError(typeof data.error === "object" ? data.error : { code: data.error }, "poll"), code: data.error.code || "providerFailed", message: ctx.redact(data.error.message || data.error) } : undefined;
    return { status, progress: data.progress, result, error };
  },
  async download(ctx, job, result, { signal } = {}) { return ctx.fetch(result.url, { needsAuth: true, signal, phase: "download", timeoutMs: 300000 }); },
  async listModels(ctx) { return base.parseJson(ctx, await ctx.fetch("videos/models", { needsAuth: Boolean(ctx.key), headers: attribution() })); },
};
