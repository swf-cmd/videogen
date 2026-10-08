const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext } = require("../src/providers/base");
const gemini = require("../src/providers/gemini");
const dashscope = require("../src/providers/dashscope");
const ark = require("../src/providers/ark");

const lanes = {
  gemini: { provider: "gemini", region: "global", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  dashscope: { provider: "dashscope", region: "beijing", baseUrl: "https://ws123.cn-beijing.maas.aliyuncs.com" },
  ark: { provider: "ark", region: "byteplus", baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3" },
};
const keys = { gemini: "AIza-test-secret", dashscope: "dashscope-test-secret", ark: "ark-test-secret" };
const job = { model: "model-id", prompt: "A bird flies", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9", audio: true }, assets: [], remote: { id: "remote-1" } };
const asset = { buffer: Buffer.from("offline-image-fixture"), mimeType: "image/png", filename: "first.png", width: 1280, height: 720 };
function response(value, status = 200, headers = {}) { return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } }); }
function context(provider, replies, assets = []) {
  const requests = [];
  const ctx = createContext({ lane: lanes[provider], key: keys[provider], assets, fetchImpl: async (url, options) => {
    requests.push({ url: String(url), ...options, headers: new Headers(options.headers) });
    const reply = replies.shift();
    assert.ok(reply, "unexpected provider call");
    if (reply instanceof Error) throw reply;
    return reply;
  } });
  return { ctx, requests };
}

test("Gemini Files upload is ephemeral, active before create, and sends bytes without credentials to its session", async () => {
  const upload = "https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=test-upload";
  const { ctx, requests } = context("gemini", [new Response(null, { headers: { "x-goog-upload-url": upload } }), response({ file: { name: "files/input-1", uri: "https://generativelanguage.googleapis.com/v1beta/files/input-1", mimeType: "image/png", state: "ACTIVE", expirationTime: "2099-01-01T00:00:00Z" } }), response({ id: "v1_interaction", status: "completed", steps: [{ type: "model_output", content: [{ type: "video", uri: "https://generativelanguage.googleapis.com/v1beta/files/output-1:download?alt=media" }] }] })], [asset]);
  ctx.remoteAssets = await gemini.prepareAssets(ctx, job);
  assert.deepEqual(ctx.remoteAssets, [{ uri: "https://generativelanguage.googleapis.com/v1beta/files/input-1", mimeType: "image/png", expiresAt: "2099-01-01T00:00:00Z" }]);
  const created = await gemini.create(ctx, { ...job, assets: [{ role: "first_frame" }] });
  assert.equal(requests.length, 3, "no await/network request after the returned interaction ID");
  assert.equal(requests[0].url, "https://generativelanguage.googleapis.com/upload/v1beta/files");
  assert.equal(requests[0].headers.get("x-goog-api-key"), keys.gemini);
  assert.equal(requests[0].headers.get("X-Goog-Upload-Protocol"), "resumable");
  assert.equal(requests[1].headers.get("x-goog-api-key"), null);
  assert.equal(requests[1].headers.get("authorization"), null);
  assert.deepEqual(requests[1].body, asset.buffer);
  assert.equal(requests[1].headers.get("X-Goog-Upload-Command"), "upload, finalize");
  const body = JSON.parse(requests[2].body);
  assert.deepEqual(body, { model: job.model, input: [{ type: "image", uri: ctx.remoteAssets[0].uri, mime_type: "image/png" }, { type: "text", text: `<FIRST_FRAME>\n${job.prompt}` }], store: true, background: false, stream: false, response_format: { type: "video", delivery: "uri", aspect_ratio: "16:9", duration: "5s", resolution: "720p" } });
  assert.deepEqual(created, { remoteId: "v1_interaction", pollingUrl: "https://generativelanguage.googleapis.com/v1beta/files/output-1", status: "succeeded" });
});

test("Gemini upload processing is checked before any paid create and aborts promptly", async () => {
  const { ctx, requests } = context("gemini", [new Response(null, { headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=1" } }), response({ file: { name: "files/input-1", mimeType: "image/png", state: "PROCESSING" } })], [asset]);
  const controller = new AbortController();
  const preparing = gemini.prepareAssets(ctx, job, { signal: controller.signal });
  setImmediate(() => controller.abort());
  await assert.rejects(preparing, { name: "AbortError" });
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => !request.url.includes("interactions")));
});

test("Gemini refuses external upload sessions and unsupported/failed assets before create", async () => {
  const { ctx, requests } = context("gemini", [new Response(null, { headers: { "x-goog-upload-url": "https://untrusted.example/upload" } })], [asset]);
  await assert.rejects(gemini.prepareAssets(ctx, job), { category: "invalid_request" });
  assert.equal(requests.length, 1);
  const failed = context("gemini", [new Response(null, { headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload/v1beta/files" } }), response({ file: { name: "files/input-1", mimeType: "image/png", state: "FAILED" } })], [asset]);
  await assert.rejects(gemini.prepareAssets(failed.ctx, job), { category: "invalid_request", code: "assetProcessingFailed" });
  await assert.rejects(gemini.create(context("gemini", [], [asset]).ctx, job), { category: "invalid_request" });
});

test("Gemini restart follows persisted Files metadata, never an interaction GET or inline video", async () => {
  const { ctx, requests } = context("gemini", [response({ name: "files/output-1", state: "ACTIVE", expirationTime: "2099-01-01T00:00:00Z" }), new Response("original-video-bytes")]);
  const saved = { ...job, remote: { id: "v1_interaction", pollingUrl: "https://generativelanguage.googleapis.com/v1beta/files/output-1" } };
  const polled = await gemini.poll(ctx, saved);
  assert.deepEqual(polled, { status: "succeeded", result: { url: "https://generativelanguage.googleapis.com/v1beta/files/output-1:download?alt=media", needsAuth: true, contentType: "video/mp4", expiresAt: "2099-01-01T00:00:00Z" } });
  assert.equal(await (await gemini.download(ctx, saved, polled.result)).text(), "original-video-bytes");
  assert.ok(requests.every((request) => !request.url.includes("interactions") && request.headers.get("x-goog-api-key") === keys.gemini && request.headers.get("authorization") === null));
});

test("Gemini manual recovery needs a same-origin Files resource and preserves a known ID when create URI is unsafe", async () => {
  for (const id of ["files/output-1", "https://generativelanguage.googleapis.com/v1beta/files/output-1", "https://generativelanguage.googleapis.com/v1beta/files/output-1:download?alt=media"]) assert.equal(gemini.validateRemoteId(id, lanes.gemini), null);
  for (const id of ["v1_interaction", "output-1", "files/../secret", "https://evil.example/v1beta/files/output-1", "https://generativelanguage.googleapis.com/v1beta/files/output-1?key=secret"]) assert.equal(gemini.validateRemoteId(id, lanes.gemini), "geminiFileIdRequired");
  for (const steps of [{ invalid: true }, [{ content: [null, { type: "video", uri: "https://evil.example/v1beta/files/output-1" }] }], [{ content: [{ type: "video", uri: "https://generativelanguage.googleapis.com/v1beta/files/output-1?key=secret" }] }]]) {
    const { ctx, requests } = context("gemini", [response({ id: "v1_accepted", status: "completed", steps })]);
    const created = await gemini.create(ctx, job);
    assert.equal(created.remoteId, "v1_accepted");
    assert.equal(created.pollingUrl, undefined);
    await assert.rejects(gemini.poll(ctx, { ...job, remote: { id: created.remoteId } }), { code: "geminiResultUriUnavailable" });
    assert.equal(requests.length, 1);
  }
});

test("Gemini Files poll distinguishes processing, failure, expiry and unknown protocol states", async () => {
  for (const [payload, expected] of [[{ state: "PROCESSING" }, "running"], [{ state: "FAILED" }, "failed"], [{ state: "ACTIVE", expirationTime: "2000-01-01T00:00:00Z" }, "expired"]]) {
    const { ctx } = context("gemini", [response(payload)]);
    assert.equal((await gemini.poll(ctx, { ...job, remote: { id: "files/output-1" } })).status, expected);
  }
  const missing = context("gemini", [response({ error: { message: "expired" } }, 404)]);
  assert.equal((await gemini.poll(missing.ctx, { ...job, remote: { id: "files/output-1" } })).status, "expired");
  await assert.rejects(gemini.poll(context("gemini", [response({ state: "NEW_ENUM" })]).ctx, { ...job, remote: { id: "files/output-1" } }), { category: "transient" });
});

test("Gemini uses resolution-specific blocking timeouts and no create idempotency claim", async () => {
  for (const [resolution, timeout] of [["720p", 600000], ["4k", 1200000]]) {
    const { ctx } = context("gemini", [response({ id: "v1_accepted" })]);
    const fetch = ctx.fetch;
    ctx.fetch = (url, options) => { assert.equal(options.timeoutMs, timeout); assert.equal(options.phase, "create"); return fetch(url, options); };
    await gemini.create(ctx, { ...job, params: { ...job.params, resolution } });
  }
  assert.equal(gemini.createMode, "blocking");
  assert.equal(gemini.supportsIdempotencyKey, false);
});

test("DashScope validates workspace and region before submitting the verified Wan 3 JSON contract", async () => {
  assert.equal(dashscope.validateLane(lanes.dashscope), null);
  assert.equal(dashscope.validateLane({ ...lanes.dashscope, baseUrl: "https://workspace-id.cn-beijing.maas.aliyuncs.com" }), "workspaceRequired");
  assert.equal(dashscope.validateLane({ ...lanes.dashscope, baseUrl: "https://dashscope.aliyuncs.com" }), "workspaceRequired");
  assert.equal(dashscope.validateLane({ ...lanes.dashscope, region: "singapore" }), "regionMismatch");
  const { ctx, requests } = context("dashscope", [response({ output: { task_id: "wan-task", task_status: "PENDING" } }, 202)], [asset]);
  const created = await dashscope.create(ctx, { ...job, model: "wan3.0-video", params: { ...job.params, seed: 42 } });
  assert.deepEqual(created, { remoteId: "wan-task", status: "queued" });
  assert.equal(requests[0].headers.get("X-DashScope-Async"), "enable");
  assert.equal(requests[0].url, `${lanes.dashscope.baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`);
  assert.deepEqual(JSON.parse(requests[0].body), { model: "wan3.0-video", input: { prompt: job.prompt, media: [{ type: "first_frame", url: `data:image/png;base64,${asset.buffer.toString("base64")}` }] }, parameters: { resolution: "720P", ratio: "16:9", duration: 5, audio: true, seed: 42 } });
});

test("DashScope polling and OSS download remain separate and UNKNOWN requires retention evidence", async () => {
  const { ctx, requests } = context("dashscope", [response({ output: { task_status: "SUCCEEDED", video_url: "https://oss.example/video.mp4?signature=public-test" } }), new Response("video")]);
  const result = await dashscope.poll(ctx, job);
  await dashscope.download(ctx, job, result.result);
  assert.equal(requests[0].headers.get("authorization"), `Bearer ${keys.dashscope}`);
  assert.equal(requests[1].headers.get("authorization"), null);
  assert.equal(requests[1].headers.get("x-goog-api-key"), null);
  const expired = context("dashscope", [response({ output: { task_status: "UNKNOWN" } })]);
  assert.equal((await dashscope.poll(expired.ctx, { ...job, createdAt: "2000-01-01T00:00:00Z" })).status, "expired");
  await assert.rejects(dashscope.poll(context("dashscope", [response({ output: { task_status: "UNKNOWN" } })]).ctx, { ...job, createdAt: new Date().toISOString() }), { category: "transient" });
});

test("Ark maps the verified Seedance 2.5 body and requires adaptive ratio for the local first frame", async () => {
  const { ctx, requests } = context("ark", [response({ id: "ark-task" }), response({ status: "succeeded", content: { video_url: "https://tos.example/video.mp4" } }), new Response("untouched-bytes")], [asset]);
  const created = await ark.create(ctx, { ...job, model: "dreamina-seedance-2-5-260628" });
  assert.deepEqual(created, { remoteId: "ark-task", status: "running" });
  assert.deepEqual(JSON.parse(requests[0].body), { model: "dreamina-seedance-2-5-260628", content: [{ type: "text", text: job.prompt }, { type: "image_url", image_url: { url: `data:image/png;base64,${asset.buffer.toString("base64")}` }, role: "first_frame" }], resolution: "720p", ratio: "adaptive", duration: 5, generate_audio: true });
  const polled = await ark.poll(ctx, { ...job, remote: { id: created.remoteId } });
  assert.equal(await (await ark.download(ctx, job, polled.result)).text(), "untouched-bytes");
  assert.equal(requests[0].headers.get("authorization"), `Bearer ${keys.ark}`);
  assert.equal(requests[2].headers.get("authorization"), null);
  assert.equal(ark.cancel, undefined, "DELETE can destroy a completed remote record");
});

test("Ark text-only ratio is preserved and remote parameter failures retain the accepted task", async () => {
  const { ctx, requests } = context("ark", [response({ id: "ark-task" }), response({ status: "failed", error: { code: "InvalidParameter.TaskTypeConstraint", message: "invalid after acceptance" } })]);
  await ark.create(ctx, job);
  assert.equal(JSON.parse(requests[0].body).ratio, "16:9");
  const failed = await ark.poll(ctx, job);
  assert.equal(failed.status, "failed");
  assert.equal(failed.error.category, "invalid_request");
  assert.ok(requests.slice(1).every((request) => request.method === undefined));
});

test("Ark rejects unverified Seedance 2.5 seed controls before sending a create", async () => {
  const { ctx, requests } = context("ark", []);
  await assert.rejects(ark.create(ctx, { ...job, params: { ...job.params, seed: 42 } }), { category: "invalid_request", accepted: false });
  assert.equal(requests.length, 0);
});

test("new providers reject invalid local asset dimensions before any network request", async () => {
  for (const adapter of [dashscope, ark]) {
    const { ctx, requests } = context(adapter.id, [], [{ ...asset, width: 1 }]);
    await assert.rejects(adapter.prepareAssets(ctx), { category: "invalid_request", accepted: false });
    await assert.rejects(adapter.create(ctx, job), { category: "invalid_request", accepted: false });
    assert.equal(requests.length, 0);
  }
});

test("each new adapter preserves ambiguous creates and classifies billing, throttle and moderation precisely", async () => {
  for (const adapter of [gemini, dashscope, ark]) {
    for (const reply of [response({}, 200), new Response("broken", { status: 200 }), response({ code: "ServiceOverloaded", error: { code: "SensitiveContentDetected" } }, 500), Object.assign(new Error("socket reset"), { code: "ECONNRESET" })]) {
      const { ctx, requests } = context(adapter.id, [reply]);
      await assert.rejects(adapter.create(ctx, job), { category: "unknown_outcome" });
      assert.equal(requests.length, 1);
    }
    assert.equal(adapter.supportsIdempotencyKey, false);
    assert.equal(adapter.validateKey(keys[adapter.id]), null);
    assert.equal(adapter.validateKey(`${keys[adapter.id]}\n`), "invalidApiKey");
  }
  for (const [adapter, status, code, category] of [[gemini, 400, "image_safety", "moderation"], [gemini, 402, "payment_required", "quota"], [gemini, 429, "quota_exceeded", "rate_limited"], [dashscope, 429, "Throttling.AllocationQuota", "rate_limited"], [dashscope, 403, "PrepaidBillOverdue", "quota"], [dashscope, 400, "InvalidParameter.DataInspection", "moderation"], [ark, 403, "AccountOverdueError", "quota"], [ark, 429, "InflightBatchsizeExceeded", "rate_limited"], [ark, 400, "InputImageSensitiveContentDetected.PrivacyInformation", "moderation"]]) {
    const { ctx } = context(adapter.id, [response({ code, error: { code, message: `echo ${keys[adapter.id]}` } }, status)]);
    await assert.rejects(adapter.create(ctx, job), (error) => { assert.equal(error.category, category); assert.equal(error.accepted, false); assert.ok(!error.message.includes(keys[adapter.id])); return true; });
    assert.equal(adapter.classifyError({ code, status: 500 }, "create"), "unknown_outcome");
  }
});

test("new asynchronous providers reject unknown poll enums without a create call", async () => {
  for (const adapter of [dashscope, ark]) {
    const payload = adapter === dashscope ? { output: { task_status: "NEW_ENUM" } } : { status: "NEW_ENUM" };
    const { ctx, requests } = context(adapter.id, [response(payload)]);
    await assert.rejects(adapter.poll(ctx, job), { category: "transient" });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, undefined);
  }
});
