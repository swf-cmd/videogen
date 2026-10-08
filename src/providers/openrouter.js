const base = require("./base");

module.exports = {
  id: "openrouter", displayNameKey: "providerOpenRouter", createMode: "async", supportsIdempotencyKey: false,
  validateKey: (key) => base.validateKey(key, "sk-or-"),
  normalizeParams: base.normalizeParams, estimateCost: base.estimateCost, classifyError: base.classifyError,
  async prepareAssets(ctx) {
    if (ctx.assets.length) throw new base.ProviderError("firstFrameUnsupported", { category: "invalid_request", accepted: false });
    return [];
  },
  async create(ctx, job, { signal } = {}) {
    if (ctx.assets.length || job.assets?.length) throw new base.ProviderError("firstFrameUnsupported", { category: "invalid_request", accepted: false });
    const body = { model: job.model, prompt: job.prompt, duration: job.params.durationSeconds, resolution: job.params.resolution, aspect_ratio: job.params.aspectRatio, generate_audio: job.params.audio };
    if (job.params.seed !== undefined) body.seed = job.params.seed;
    const data = await base.parseJson(ctx, await ctx.fetch("videos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal, phase: "create" }), "create");
    const remoteId = base.requireRemoteId(data.id);
    const pollingUrl = new URL(`videos/${encodeURIComponent(remoteId)}`, `${ctx.lane.baseUrl.replace(/\/$/, "")}/`).href;
    return { remoteId, pollingUrl, status: base.normalizeStatus(data.status, { phase: "create" }) };
  },
  async poll(ctx, job, { signal } = {}) {
    const id = encodeURIComponent(job.remote.id);
    const data = await base.parseJson(ctx, await ctx.fetch(`videos/${id}`, { signal }));
    const status = base.normalizeStatus(data.status);
    const result = status === "succeeded" ? { url: new URL(`videos/${id}/content?index=0`, `${ctx.lane.baseUrl.replace(/\/$/, "")}/`).href, needsAuth: true, contentType: "video/mp4" } : undefined;
    const error = data.error ? { category: base.classifyError(typeof data.error === "object" ? data.error : { code: data.error }, "poll"), code: data.error.code || "providerFailed", message: ctx.redact(data.error.message || data.error) } : undefined;
    return { status, progress: data.progress, result, error };
  },
  async download(ctx, job, result, { signal } = {}) { return ctx.fetch(result.url, { needsAuth: true, signal, phase: "download", timeoutMs: 300000 }); },
  async listModels(ctx) { return base.parseJson(ctx, await ctx.fetch("videos/models", { needsAuth: Boolean(ctx.key) })); },
};
