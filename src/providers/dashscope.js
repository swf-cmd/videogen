const base = require("./base");
const { validateAssets, frameAssets } = require("./frames");

function validateLane(lane) {
  let url;
  try { url = new URL(lane.baseUrl); } catch { return "workspaceRequired"; }
  const suffix = { beijing: "cn-beijing", singapore: "ap-southeast-1" }[lane.region];
  const match = /^([a-z0-9][a-z0-9-]*)\.(cn-beijing|ap-southeast-1)\.maas\.aliyuncs\.com$/.exec(url.hostname);
  if (!match || ["workspace-id", "workspaceid"].includes(match[1]) || url.protocol !== "https:" || url.port || url.pathname !== "/") return "workspaceRequired";
  return match[2] === suffix ? null : "regionMismatch";
}

function classifyError(error, phase = "poll") {
  if (phase === "create" && (Number(error?.status) >= 500 || Number(error?.status) === 408)) return "unknown_outcome";
  const code = String(error?.code || "");
  if (code === "InvalidApiKey") return "auth";
  if (["Arrearage", "InsufficientBalance", "PrepaidBillOverdue", "CommodityNotPurchased"].includes(code)) return "quota";
  if (/^Throttling\./.test(code) || ["Throttling", "ServiceOverloaded", "ResourceExhausted"].includes(code)) return "rate_limited";
  if (/DataInspection/.test(code)) return "moderation";
  return base.classifyError(error, phase);
}

function validateLocalAssets(assets) {
  for (const asset of assets) {
    const { width, height } = asset;
    if (!Buffer.isBuffer(asset.buffer) || !asset.buffer.length || asset.buffer.length > 20 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(asset.mimeType)
      || !Number.isInteger(width) || !Number.isInteger(height) || Math.min(width, height) < 240 || Math.max(width, height) > 8000 || Math.max(width / height, height / width) > 8) {
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
    return { type: asset.role, url: `data:${asset.mimeType};base64,${asset.buffer.toString("base64")}` };
  });
}

module.exports = {
  id: "dashscope", displayNameKey: "providerDashScope", createMode: "async", supportsIdempotencyKey: false,
  validateKey: (key) => base.validateKey(key), validateLane, validateAssets, validateLocalAssets,
  normalizeParams: base.normalizeParams, estimateCost: base.estimateCost, classifyError,
  async prepareAssets(ctx, job) { assets(ctx, job); return []; },
  async create(ctx, job, { signal } = {}) {
    const invalid = validateLane(ctx.lane);
    if (invalid) throw new base.ProviderError(invalid, { code: invalid, category: "invalid_request", accepted: false });
    const media = assets(ctx, job);
    if (job.assets?.length && !media.length) throw new base.ProviderError("invalidAsset", { code: "invalidAsset", category: "invalid_request", accepted: false });
    const input = { prompt: job.prompt, ...(media.length ? { media } : {}) };
    const parameters = { resolution: job.params.resolution.toUpperCase(), ratio: job.params.aspectRatio, duration: job.params.durationSeconds, audio: job.params.audio };
    if (job.params.seed !== undefined) parameters.seed = job.params.seed;
    try {
      const data = await base.parseJson(ctx, await ctx.fetch("api/v1/services/aigc/video-generation/video-synthesis", { method: "POST", headers: { "content-type": "application/json", "X-DashScope-Async": "enable" }, body: JSON.stringify({ model: job.model, input, parameters }), signal, phase: "create" }), "create");
      return { remoteId: base.requireRemoteId(data.output?.task_id, ctx.redact), status: base.normalizeStatus(data.output?.task_status, { phase: "create" }) };
    } catch (error) { error.category = classifyError(error, "create"); throw error; }
  },
  async poll(ctx, job, { signal } = {}) {
    let data;
    try { data = await base.parseJson(ctx, await ctx.fetch(`api/v1/tasks/${encodeURIComponent(job.remote.id)}`, { signal })); }
    catch (error) { error.category = classifyError(error); throw error; }
    const output = data.output || {};
    if (output.task_status === "UNKNOWN") {
      const started = Date.parse(job.startedAt || job.createdAt);
      if (Number.isFinite(started) && Date.now() - started >= 24 * 3600000) return { status: "expired" };
      throw new base.ProviderError("invalidProviderResponse", { category: "transient", code: "unknownProviderStatus" });
    }
    const status = base.normalizeStatus(output.task_status);
    if (status === "succeeded" && !output.video_url) throw new base.ProviderError("invalidProviderResponse", { category: "transient" });
    const error = output.code ? { category: classifyError({ code: output.code }), code: ctx.redact(output.code), message: ctx.redact(output.message || data.message || "providerFailed") } : undefined;
    return { status, error, ...(status === "succeeded" ? { result: { url: output.video_url, needsAuth: false, contentType: "video/mp4" } } : {}) };
  },
  async download(ctx, job, result, { signal } = {}) { return ctx.fetch(result.url, { needsAuth: false, signal, phase: "download", timeoutMs: 300000 }); },
};
