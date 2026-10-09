const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext } = require("../src/providers/base");
const { loadCatalog, normalizeOpenRouterModels } = require("../src/catalog/catalog");
const gemini = require("../src/providers/gemini");
const openrouter = require("../src/providers/openrouter");
const ark = require("../src/providers/ark");
const dashscope = require("../src/providers/dashscope");
const compatible = require("../src/providers/openai-compatible");
const frames = ["first_frame", "last_frame"].map((role) => ({ role, buffer: Buffer.from(role), mimeType: "image/png", width: 1280, height: 720 }));
const job = { model: "video-model", prompt: "An opening flower", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9", audio: true }, assets: [] };
const lanes = { gemini: { provider: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" }, openrouter: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1" }, ark: { provider: "ark", baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3" }, dashscope: { provider: "dashscope", region: "beijing", baseUrl: "https://ws123.cn-beijing.maas.aliyuncs.com" }, "openai-compatible": { provider: "openai-compatible", baseUrl: "https://example.com/v1" } };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
function setup(provider, replies, assets = [], catalog = { capabilities: { firstFrame: true, lastFrame: true } }) {
  const requests = [];
  const ctx = createContext({ lane: lanes[provider], key: "secret-test-key", assets, catalog, fetchImpl: async (url, options) => {
    requests.push({ url: String(url), ...options });
    assert.ok(replies.length, "unexpected provider request");
    return replies.shift();
  } });
  return { ctx, requests };
}
function sse(events, chunkSize = 17) {
  const encoded = Buffer.from(events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join(""));
  return new Response(new ReadableStream({ start(controller) { for (let offset = 0; offset < encoded.length; offset += chunkSize) controller.enqueue(encoded.subarray(offset, offset + chunkSize)); controller.close(); } }), { headers: { "content-type": "text/event-stream" } });
}

test("Gemini persists a background interaction ID before any poll, then recovers the Files URI through SSE", async () => {
  const { ctx, requests } = setup("gemini", [json({ id: "v1_saved", status: "in_progress" }), sse([
    { event_type: "interaction.created", interaction: { id: "v1_saved", status: "in_progress" } },
    { event_type: "step.delta", delta: { type: "video", uri: "files/video-1" } },
    { event_type: "interaction.completed", interaction: { id: "v1_saved", status: "completed" } },
  ]), json({ name: "files/video-1", state: "ACTIVE" }), new Response("original bytes")]);
  const created = await gemini.create(ctx, job);
  assert.equal(requests.length, 1);
  assert.deepEqual(created, { remoteId: "v1_saved", status: "running" });
  assert.equal(JSON.parse(requests[0].body).background, true);
  assert.equal(JSON.parse(requests[0].body).store, true);
  const saved = { ...job, remote: { id: created.remoteId } };
  const result = await gemini.poll(ctx, saved);
  assert.equal(result.status, "succeeded");
  assert.equal(requests[1].url, "https://generativelanguage.googleapis.com/v1beta/interactions/v1_saved?stream=true");
  assert.equal(await (await gemini.download(ctx, saved, result.result)).text(), "original bytes");
  assert.equal(requests.filter((r) => r.method === "POST").length, 1);
  assert.ok(requests.every((r) => !r.url.includes("key=")));
});

test("Gemini restart only needs an interaction ID and understands running, failed, expired and URI-less completion", async () => {
  for (const [response, expected] of [
    [sse([{ event_type: "interaction.status_update", interaction_id: "v1_saved", status: "in_progress" }]), "running"],
    [sse([{ event_type: "interaction.completed", interaction: { id: "v1_saved", status: "failed", error: { code: "image_safety" } } }]), "failed"],
    [json({ error: { message: "expired" } }, 404), "expired"],
  ]) {
    const { ctx, requests } = setup("gemini", [response]);
    assert.equal((await gemini.poll(ctx, { ...job, remote: { id: "v1_saved" } })).status, expected);
    assert.ok(requests.every((r) => !r.method));
  }
  for (const response of [sse([{ event_type: "interaction.completed", interaction: { id: "v1_saved", status: "completed" } }]), json({ id: "v1_saved", status: "completed", steps: [{ content: [{ type: "video", data: "eA==" }] }] })]) {
    const { ctx } = setup("gemini", [response]);
    await assert.rejects(gemini.poll(ctx, { ...job, remote: { id: "v1_saved" } }), { code: "geminiResultUriUnavailable", category: "transient" });
  }
});

test("Gemini SSE rejects foreign result URLs, mismatched IDs and oversized event buffers", async () => {
  for (const response of [
    sse([{ event_type: "step.delta", delta: { type: "video", uri: "https://evil.example/v1beta/files/stolen" } }]),
    sse([{ event_type: "interaction.created", interaction: { id: "v1_other", status: "completed" } }]),
    new Response(`data: ${"x".repeat(1024 * 1024 + 1)}`, { headers: { "content-type": "text/event-stream" } }),
    new Response(`data: ${JSON.stringify({ event_type: "step.delta", delta: { type: "video", data: "x".repeat(1024 * 1024) } })}\n\n`, { headers: { "content-type": "text/event-stream" } }),
  ]) {
    const { ctx, requests } = setup("gemini", [response]);
    await assert.rejects(gemini.poll(ctx, { ...job, remote: { id: "v1_saved" } }), { category: "transient" });
    assert.equal(requests.length, 1);
  }
});

test("Gemini SSE waits for a video URI even when the initial replay snapshot is already completed", async () => {
  const { ctx } = setup("gemini", [sse([
    { event_type: "interaction.created", interaction: { id: "v1_saved", status: "completed" } },
    { event_type: "step.start", index: 0, step: { type: "model_output", content: [] } },
    { event_type: "step.delta", delta: { type: "video", uri: "files/video-1" } },
  ]), json({ name: "files/video-1", state: "ACTIVE" })]);
  assert.equal((await gemini.poll(ctx, { ...job, remote: { id: "v1_saved" } })).status, "succeeded");
});

test("first and last frames are ordered and serialized explicitly by each supported adapter", async () => {
  for (const adapter of [openrouter, ark, dashscope]) {
    const { ctx, requests } = setup(adapter.id, [json(adapter === dashscope ? { output: { task_id: "remote-1" } } : { id: "remote-1" })], [...frames].reverse());
    await adapter.create(ctx, { ...job, assets: frames });
    const body = JSON.parse(requests[0].body);
    const media = body.frame_images || body.content?.slice(1) || body.input.media;
    assert.deepEqual(media.map((entry) => entry.frame_type || entry.role || entry.type), ["first_frame", "last_frame"]);
    assert.ok(media.every((entry) => (entry.image_url?.url || entry.url).startsWith("data:image/png;base64,")));
  }
  const { ctx, requests } = setup("gemini", [json({ id: "v1_saved" })], [...frames].reverse());
  ctx.remoteAssets = frames.map((asset, index) => ({ role: asset.role, uri: `files/frame-${index}`, mimeType: asset.mimeType, expiresAt: "2099-01-01T00:00:00Z" }));
  await gemini.create(ctx, { ...job, assets: frames });
  assert.equal(JSON.parse(requests[0].body).input[2].text, `[# Sources <FIRST_FRAME>@Image1 <LAST_FRAME>@Image2]\n${job.prompt}`);
});

test("duplicate, unsupported and last-only assets fail before any request, including compatible gateways", async () => {
  for (const adapter of [gemini, openrouter, ark, dashscope, compatible]) {
    for (const assets of [[frames[1]], [frames[0], frames[0]], [{ ...frames[0], role: "reference_image" }]]) {
      const { ctx, requests } = setup(adapter.id, [], assets);
      await assert.rejects(adapter.prepareAssets(ctx, { ...job, assets }), { category: "invalid_request", accepted: false });
      assert.equal(requests.length, 0);
    }
  }
  const { ctx, requests } = setup("openai-compatible", [], frames);
  await assert.rejects(compatible.create(ctx, { ...job, assets: frames }), { code: "unsupportedLastFrame", accepted: false });
  assert.equal(requests.length, 0);
  const disabled = setup("openrouter", [], frames, { capabilities: { firstFrame: true, lastFrame: false } });
  await assert.rejects(openrouter.create(disabled.ctx, { ...job, assets: frames }), { code: "unsupportedLastFrame" });
});

test("pure local asset checks reject provider size and dimension limits before queue preparation", () => {
  for (const adapter of [ark, dashscope, openrouter]) assert.equal(adapter.validateLocalAssets(frames), null);
  for (const adapter of [ark, dashscope]) assert.equal(adapter.validateLocalAssets([{ ...frames[0], width: 1 }]), "invalidAsset");
  for (const adapter of [dashscope, openrouter]) assert.equal(adapter.validateLocalAssets([{ ...frames[0], buffer: Buffer.alloc(20 * 1024 * 1024 + 1) }]), "invalidAsset");
});

test("OpenRouter snapshot includes Veo Lite audio-sensitive pricing and documented Seedance token estimates", () => {
  const models = loadCatalog().providers.find((p) => p.provider === "openrouter").models;
  const lite = models.find((m) => m.id === "google/veo-3.1-lite");
  assert.equal(lite.capabilities.firstFrame, true); assert.equal(lite.capabilities.lastFrame, true);
  for (const [resolution, audio, amount] of [["720p", true, 0.4], ["720p", false, 0.24], ["1080p", true, 0.64], ["1080p", false, 0.4]]) assert.equal(openrouter.estimateCost(lite, { resolution, audio, durationSeconds: 8 }).amount, amount);
  // OpenRouter: tokens = height × width × duration × 24 / 1024; its page lists
  // $0.23112/s for 720p (1280×720) and "from $0.1028/s" (480p) at $10.70/M.
  const seedance = models.find((m) => m.id === "bytedance/seedance-2.5");
  assert.deepEqual(openrouter.estimateCost(seedance, job.params), { amount: 1.1556, currency: "USD", basis: "token" });
  assert.equal(openrouter.estimateCost(seedance, { ...job.params, resolution: "480p", durationSeconds: 1 }).amount, 0.1028);
  const seedance20 = models.find((m) => m.id === "bytedance/seedance-2.0");
  assert.equal(openrouter.estimateCost(seedance20, { ...job.params, resolution: "4K" }).amount, null, "undocumented 4K output dimensions stay unknown");
  assert.equal(openrouter.estimateCost(seedance20, { ...job.params, resolution: "1080p" }).amount, Math.round(1920 * 1080 * 24 / 1024 * 5 * 0.0000077 * 1e6) / 1e6, "a resolution-specific token SKU wins");
  const wan = models.find((m) => m.id === "alibaba/wan-2.6");
  assert.equal(openrouter.estimateCost(wan, { ...job.params, frameCount: 1 }).amount, 0.5);
  assert.equal(openrouter.estimateCost(wan, job.params).amount, 0.4);
  assert.equal(openrouter.estimateCost(models.find((m) => m.id === "x-ai/grok-imagine-video-1.5-lite"), { ...job.params, frameCount: 1 }).amount, 0.16);
});

test("OpenRouter capability refresh follows reported roles and malformed prices never become free estimates", () => {
  const source = { id: "test/video", supported_durations: [5], supported_resolutions: ["720p"], supported_aspect_ratios: ["16:9"], supported_frame_images: ["first_frame", "last_frame"], generate_audio: false };
  for (const value of [null, "", -1, "unknown"]) {
    const [model] = normalizeOpenRouterModels({ data: [{ ...source, pricing_skus: { duration_seconds: value } }] });
    assert.equal(model.capabilities.firstFrame, true); assert.equal(model.capabilities.lastFrame, true);
    assert.equal(openrouter.estimateCost(model, job.params).amount, null);
  }
  const [unknown] = normalizeOpenRouterModels({ data: [{ ...source, supported_frame_images: null }] });
  assert.equal(unknown.capabilities.firstFrame, false); assert.equal(unknown.capabilities.lastFrame, false);
});

test("Gemini checkpoints a discovered Files URI before polling metadata and reuses it while processing", async () => {
  const { ctx, requests } = setup("gemini", [sse([{ event_type: "step.delta", delta: { type: "video", uri: "files/video-1" } }]),
    json({ name: "files/video-1", state: "PROCESSING" }), json({ name: "files/video-1", state: "ACTIVE" })]);
  const saved = { ...job, remote: { id: "v1_saved" } };
  let checkpointRequests;
  const first = await gemini.poll(ctx, saved, { onRemote(remote) {
    checkpointRequests = requests.length;
    saved.remote = { ...saved.remote, ...remote };
  } });
  assert.equal(checkpointRequests, 1, "checkpoint occurs before the Files GET starts");
  assert.equal(first.status, "running");
  assert.equal(first.pollingUrl, "https://generativelanguage.googleapis.com/v1beta/files/video-1");
  assert.equal((await gemini.poll(ctx, saved)).status, "succeeded");
  assert.equal(requests.filter(request => request.url.includes("/interactions/")).length, 1);
  assert.equal(requests.filter(request => request.url.includes("/files/")).length, 2);
  assert.ok(requests.every(request => !request.method));
});

test("Gemini retains discovered Files metadata when the first file request fails", async () => {
  const { ctx, requests } = setup("gemini", [sse([{ event_type: "step.delta", delta: { type: "video", uri: "files/video-1" } }]),
    json({ error: { message: "temporary" } }, 503), json({ name: "files/video-1", state: "ACTIVE" })]);
  const saved = { ...job, remote: { id: "v1_saved" } };
  await assert.rejects(gemini.poll(ctx, saved, { onRemote(remote) { saved.remote = { ...saved.remote, ...remote }; } }), { status: 503 });
  assert.equal((await gemini.poll(ctx, saved)).status, "succeeded");
  assert.equal(requests.filter(request => request.url.includes("/interactions/")).length, 1);
});
