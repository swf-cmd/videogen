const { setTimeout: delay } = require("node:timers/promises");
const base = require("./base");

const FILE_NAME = /^files\/[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function fileResource(value, lane = { baseUrl: "https://generativelanguage.googleapis.com/v1beta" }) {
  if (typeof value !== "string") return null;
  const origin = new URL(lane.baseUrl).origin;
  let name = value;
  if (!FILE_NAME.test(name)) {
    let url;
    try { url = new URL(value); } catch { return null; }
    if (url.origin !== origin || url.username || url.password || url.hash || [...url.searchParams].some(([key, item]) => key !== "alt" || item !== "media") || url.searchParams.getAll("alt").length > 1) return null;
    name = /^\/v1beta\/(files\/[^/:]+)(?::download)?$/.exec(url.pathname)?.[1];
    if (!FILE_NAME.test(name || "")) return null;
  }
  return { name, metadataUrl: `${origin}/v1beta/${name}`, downloadUrl: `${origin}/v1beta/${name}:download?alt=media` };
}

function validateRemoteId(id, lane) { return fileResource(id, lane) ? null : "geminiFileIdRequired"; }

function classifyError(error, phase = "poll") {
  if (phase === "create" && (Number(error?.status) >= 500 || Number(error?.status) === 408)) return "unknown_outcome";
  const code = String(error?.code || "");
  if (["authentication", "permission_denied"].includes(code)) return "auth";
  if (code === "payment_required") return "quota";
  if (["rate_limit_exceeded", "quota_exceeded", "too_many_requests"].includes(code)) return "rate_limited";
  if (["safety", "recitation", "language", "prohibited_content", "spii", "blocklist", "image_safety", "image_prohibited_content", "image_recitation", "image_other", "content_blocked"].includes(code)) return "moderation";
  if (["invalid_request", "parameter_unknown", "out_of_range"].includes(code)) return "invalid_request";
  return base.classifyError(error, phase);
}

function invalidFile(code = "invalidAsset", category = "invalid_request") {
  return new base.ProviderError(code, { code, category, accepted: false });
}

async function readyFile(ctx, file, signal) {
  const resource = fileResource(file?.uri || file?.name, ctx.lane);
  if (!resource || ctx.redact(resource.metadataUrl) !== resource.metadataUrl) throw invalidFile();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (file.name && file.name !== resource.name) throw invalidFile("invalidProviderResponse", "transient");
    if (file.state === "ACTIVE") {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimeType) || file.expirationTime && !Number.isFinite(Date.parse(file.expirationTime))) throw invalidFile("invalidProviderResponse", "transient");
      if (Date.parse(file.expirationTime) <= Date.now()) throw invalidFile("assetProcessingFailed", "transient");
      return { uri: resource.metadataUrl, mimeType: file.mimeType, expiresAt: file.expirationTime || new Date(Date.now() + 47 * 3600000).toISOString() };
    }
    if (file.state === "FAILED") throw invalidFile("assetProcessingFailed");
    if (file.state !== "PROCESSING") throw invalidFile("invalidProviderResponse", "transient");
    await delay(2000, undefined, { signal });
    file = await base.parseJson(ctx, await ctx.fetch(resource.metadataUrl, { signal, phase: "prepare" }));
  }
  throw invalidFile("assetProcessingTimeout", "transient");
}

module.exports = {
  id: "gemini", displayNameKey: "providerGemini", createMode: "blocking", supportsIdempotencyKey: false,
  validateKey: (key) => base.validateKey(key, "AIza"), validateRemoteId,
  normalizeParams: base.normalizeParams, estimateCost: base.estimateCost, classifyError,
  async prepareAssets(ctx, job, { signal } = {}) {
    if (ctx.assets.length > 1) throw invalidFile();
    const refs = [];
    for (const asset of ctx.assets) {
      if (!Buffer.isBuffer(asset.buffer) || !asset.buffer.length || !["image/jpeg", "image/png", "image/webp"].includes(asset.mimeType)) throw invalidFile();
      try {
        const session = await ctx.fetch("/upload/v1beta/files", { method: "POST", headers: { "content-type": "application/json", "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": String(asset.buffer.length), "X-Goog-Upload-Header-Content-Type": asset.mimeType }, body: JSON.stringify({ file: { display_name: "first-frame" } }), signal, phase: "prepare" });
        const upload = session.headers.get("x-goog-upload-url");
        await session.body?.cancel();
        let url;
        try { url = new URL(upload); } catch { throw invalidFile("invalidProviderResponse", "transient"); }
        if (url.origin !== new URL(ctx.lane.baseUrl).origin) throw invalidFile("unsafeProviderUrl");
        const data = await base.parseJson(ctx, await ctx.fetch(url.href, { method: "POST", needsAuth: false, headers: { "content-type": asset.mimeType, "Content-Length": String(asset.buffer.length), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" }, body: asset.buffer, signal, phase: "prepare" }));
        refs.push(await readyFile(ctx, data.file, signal));
      } catch (error) { error.category = classifyError(error); throw error; }
    }
    return refs;
  },
  async create(ctx, job, { signal } = {}) {
    const refs = ctx.remoteAssets || [];
    if ((ctx.assets.length || job.assets?.length) && !refs.length) throw invalidFile();
    const input = refs.map((ref) => {
      const resource = fileResource(ref.uri, ctx.lane);
      if (!resource || Date.parse(ref.expiresAt) <= Date.now()) throw invalidFile();
      return { type: "image", uri: resource.metadataUrl, mime_type: ref.mimeType };
    });
    input.push({ type: "text", text: refs.length ? `<FIRST_FRAME>\n${job.prompt}` : job.prompt });
    const body = { model: job.model, input, store: true, background: false, stream: false, response_format: { type: "video", delivery: "uri", aspect_ratio: job.params.aspectRatio, duration: `${job.params.durationSeconds}s`, resolution: job.params.resolution } };
    let data;
    try {
      data = await base.parseJson(ctx, await ctx.fetch("interactions", { method: "POST", headers: { "content-type": "application/json", "Api-Revision": "2026-05-20" }, body: JSON.stringify(body), signal, phase: "create", timeoutMs: job.params.resolution === "4k" ? 1200000 : 600000 }), "create");
    } catch (error) { error.category = classifyError(error, "create"); throw error; }
    const remoteId = base.requireRemoteId(data.id, ctx.redact);
    // Preserve the accepted ID even when a malformed/unsafe URI needs review.
    // No await is permitted after this point before the scheduler's fsync.
    const video = (Array.isArray(data.steps) ? data.steps : []).flatMap((step) => Array.isArray(step?.content) ? step.content : []).find((part) => part?.type === "video" && part.uri);
    const file = video?.uri && ctx.redact(video.uri) === video.uri ? fileResource(video.uri, ctx.lane) : null;
    return { remoteId, ...(file ? { pollingUrl: file.metadataUrl } : {}), status: base.normalizeStatus(data.status, { phase: "create" }) };
  },
  async poll(ctx, job, { signal } = {}) {
    const file = fileResource(job.remote.pollingUrl || job.remote.id, ctx.lane);
    if (!file) throw invalidFile("geminiResultUriUnavailable");
    let data;
    try { data = await base.parseJson(ctx, await ctx.fetch(file.metadataUrl, { signal })); }
    catch (error) { if (error.status === 404) return { status: "expired" }; error.category = classifyError(error); throw error; }
    if (data.name && data.name !== file.name) throw invalidFile("invalidProviderResponse", "transient");
    if (data.state === "PROCESSING") return { status: "running" };
    if (data.state === "FAILED") return { status: "failed", error: { category: classifyError(data.error) === "moderation" ? "moderation" : "invalid_request", code: "assetProcessingFailed" } };
    if (data.state !== "ACTIVE") throw invalidFile("invalidProviderResponse", "transient");
    const expiresAt = Number.isFinite(Date.parse(data.expirationTime)) ? data.expirationTime : undefined;
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) return { status: "expired" };
    return { status: "succeeded", result: { url: file.downloadUrl, needsAuth: true, contentType: "video/mp4", ...(expiresAt ? { expiresAt } : {}) } };
  },
  async download(ctx, job, result, { signal } = {}) {
    const file = fileResource(result.url, ctx.lane);
    if (!file) throw invalidFile("unsafeProviderUrl");
    return ctx.fetch(file.downloadUrl, { needsAuth: true, signal, phase: "download", timeoutMs: 300000 });
  },
};
