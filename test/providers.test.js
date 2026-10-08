const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, classifyError, ProviderError, parseJson } = require("../src/providers/base");
const compatible = require("../src/providers/openai-compatible");
const openrouter = require("../src/providers/openrouter");
const { startMockServer, mockBytes } = require("./fixtures/mock-provider-server");

const job = { model: "alibaba/wan-3.0", prompt: "test-video", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9", audio: true }, assets: [] };
function response(value, status = 200, headers = {}) { return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } }); }

test("OpenRouter contract builds exact fields and uses authenticated same-origin content", async () => {
  const requests = [];
  const replies = [response({ id: "a/b", status: "pending", polling_url: "https://evil.invalid/steal" }, 202), response({ status: "completed", unsigned_urls: ["https://evil.invalid/steal"] }), new Response("video")];
  const ctx = createContext({ lane: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1" }, key: "sk-or-test-secret", fetchImpl: async (url, options) => { requests.push({ url: String(url), options }); return replies.shift(); } });
  const created = await openrouter.create(ctx, job);
  assert.equal(created.remoteId, "a/b");
  assert.equal(created.pollingUrl, "https://openrouter.ai/api/v1/videos/a%2Fb");
  assert.deepEqual(JSON.parse(requests[0].options.body), { model: job.model, prompt: job.prompt, duration: 5, resolution: "720p", aspect_ratio: "16:9", generate_audio: true });
  assert.equal(requests[0].options.headers.get("authorization"), "Bearer sk-or-test-secret");
  const remoteJob = { ...job, remote: { id: created.remoteId } };
  const polled = await openrouter.poll(ctx, remoteJob);
  assert.equal(polled.status, "succeeded");
  assert.equal(polled.result.url, "https://openrouter.ai/api/v1/videos/a%2Fb/content?index=0");
  await openrouter.download(ctx, remoteJob, polled.result);
  assert.equal(requests[2].options.headers.get("authorization"), "Bearer sk-or-test-secret");
});

test("OpenRouter refuses local first frames, missing IDs and malformed create JSON", async () => {
  const lane = { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1" };
  await assert.rejects(openrouter.create(createContext({ lane, assets: [{ buffer: Buffer.from("image") }] }), job), { category: "invalid_request", accepted: false });
  await assert.rejects(openrouter.create(createContext({ lane, fetchImpl: async () => response({ status: "pending" }) }), job), { category: "unknown_outcome" });
  await assert.rejects(openrouter.create(createContext({ lane, fetchImpl: async () => new Response("not json") }), job), { category: "unknown_outcome" });
});

test("unknown poll statuses are transient protocol errors and never trigger create", async () => {
  for (const adapter of [compatible, openrouter]) {
    for (const status of [undefined, null, "", "unrecognized_state", "UNKNOWN", "toString", "__proto__"]) {
      const requests = [];
      const ctx = createContext({ lane: { provider: adapter.id, baseUrl: "https://provider.example/v1" }, fetchImpl: async (url, options) => {
        requests.push({ url: String(url), method: options.method || "GET" });
        return response({ id: "accepted-id", status });
      } });
      await assert.rejects(adapter.poll(ctx, { ...job, remote: { id: "accepted-id" } }), { category: "transient", code: "unknownProviderStatus" });
      assert.deepEqual(requests, [{ url: "https://provider.example/v1/videos/accepted-id", method: "GET" }]);
      const created = await adapter.create(ctx, job);
      assert.equal(created.remoteId, "accepted-id");
      assert.equal(created.status, "running");
    }
  }
});

test("compatible JSON and multipart contracts preserve selected duration and image", async () => {
  const requests = [];
  const lane = { provider: "openai-compatible", baseUrl: "http://127.0.0.1:30000/v1" };
  const fetchImpl = async (url, options) => { requests.push(options); return response({ id: "local-id", status: "queued" }); };
  await compatible.create(createContext({ lane, fetchImpl }), job);
  assert.deepEqual(JSON.parse(requests[0].body), { model: job.model, prompt: job.prompt, seconds: "5", size: "1280x720" });
  await compatible.create(createContext({ lane, fetchImpl, assets: [{ buffer: Buffer.from("image-bytes"), mimeType: "image/png", filename: "first.png" }] }), job);
  assert.ok(requests[1].body instanceof FormData);
  assert.equal(requests[1].body.get("seconds"), "5");
  assert.equal(await requests[1].body.get("input_reference").text(), "image-bytes");
  await compatible.create(createContext({ lane, fetchImpl }), { ...job, params: { ...job.params, requestFormat: "multipart" } });
  assert.ok(requests[2].body instanceof FormData);
});

test("keys validate per provider and reject whitespace/header injection", () => {
  assert.equal(compatible.validateKey(""), null);
  assert.equal(openrouter.validateKey("sk-or-valid"), null);
  assert.equal(openrouter.validateKey("sk-wrong"), "invalidApiKey");
  for (const value of ["sk-or-a b", "sk-or-a\r\nx-test: injected", "sk-or-a\u0000"]) assert.equal(openrouter.validateKey(value), "invalidApiKey");
});

test("authenticated cross-origin requests are rejected; redirects drop credentials", async () => {
  const observed = [];
  const ctx = createContext({ lane: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1" }, key: "sk-or-secret", fetchImpl: async (url, options) => {
    observed.push({ url: String(url), auth: options.headers.get("authorization") });
    return observed.length === 1 ? new Response(null, { status: 302, headers: { location: "https://cdn.example/video.mp4" } }) : new Response("bytes");
  } });
  await assert.rejects(ctx.fetch("https://evil.example/video"), { category: "invalid_request" });
  await ctx.fetch("videos/id/content");
  assert.deepEqual(observed, [{ url: "https://openrouter.ai/api/v1/videos/id/content", auth: "Bearer sk-or-secret" }, { url: "https://cdn.example/video.mp4", auth: null }]);
  observed.length = 0;
  await assert.rejects(ctx.fetch("videos", { method: "POST", phase: "create" }), { category: "unknown_outcome" });
});

test("HTTP error classes preserve uncertain create outcomes and redact secrets", async () => {
  const cases = [[400, "invalid_request"], [401, "auth"], [402, "quota"], [403, "auth"], [404, "model_unavailable"], [429, "rate_limited"], [500, "unknown_outcome"], [502, "unknown_outcome"]];
  for (const [status, category] of cases) {
    const ctx = createContext({ lane: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1" }, key: "sk-or-secret", fetchImpl: async () => response({ error: { message: "echo sk-or-secret", code: status } }, status, { "retry-after": "2" }) });
    await assert.rejects(ctx.fetch("videos", { method: "POST", phase: "create" }), (error) => { assert.equal(error.category, category); assert.ok(!error.message.includes("sk-or-secret")); assert.equal(error.retryAfterMs, 2000); return true; });
  }
  assert.equal(classifyError({ code: "moderation" }, "poll"), "moderation");
  assert.equal(classifyError({ status: 500, code: "moderation" }, "create"), "unknown_outcome");
  assert.equal(classifyError({ code: "unknownFailure" }, "poll"), "transient");
});

test("pre-send network failure is distinguished from ambiguous timeout/reset", async () => {
  for (const [code, accepted, category] of [["ECONNREFUSED", false, "transient"], ["ENOTFOUND", false, "transient"], ["ECONNRESET", undefined, "unknown_outcome"], ["UND_ERR_HEADERS_TIMEOUT", undefined, "unknown_outcome"]]) {
    const ctx = createContext({ lane: { provider: "openai-compatible", baseUrl: "http://127.0.0.1:1/v1" }, fetchImpl: async () => { throw Object.assign(new TypeError("network"), { cause: { code } }); } });
    await assert.rejects(ctx.fetch("videos", { phase: "create" }), (error) => { assert.equal(error.accepted, accepted); assert.equal(error.category, category); assert.equal(error.code, code); return true; });
  }
});

test("metadata parser bounds responses and rejects partial payloads", async () => {
  const ctx = { redact: (text) => text };
  await assert.rejects(parseJson(ctx, new Response("x".repeat(8 * 1024 * 1024 + 1)), "create"), { category: "unknown_outcome" });
  await assert.rejects(parseJson(ctx, new Response("{"), "poll"), { category: "transient" });
});

test("real compatible adapter traverses HTTP mock and handles one-shot 429", async (t) => {
  const mock = await startMockServer({ renderDelayMs: 20, faults: { "test-video": ["rate_limit"] } });
  t.after(() => mock.close());
  const ctx = createContext({ lane: { provider: "openai-compatible", baseUrl: `${mock.url}/lane-a/v1` } });
  await assert.rejects(compatible.create(ctx, job), { category: "rate_limited", accepted: false });
  const created = await compatible.create(ctx, job);
  const remoteJob = { ...job, remote: { id: created.remoteId } };
  let polled;
  for (let i = 0; i < 20; i += 1) { polled = await compatible.poll(ctx, remoteJob); if (polled.status === "succeeded") break; await new Promise((resolve) => setTimeout(resolve, 10)); }
  assert.equal(polled.status, "succeeded");
  assert.deepEqual(Buffer.from(await (await compatible.download(ctx, remoteJob, polled.result)).arrayBuffer()), mockBytes(job.prompt));
  const stats = await (await fetch(`${mock.url}/stats`)).json();
  assert.equal(stats.createCounts[job.prompt], 1);
  assert.equal(stats.requestCounts[job.prompt], 2);
  assert.equal(stats.maxInFlight["/lane-a"], 1);
});
