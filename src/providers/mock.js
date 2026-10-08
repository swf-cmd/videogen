const { randomUUID } = require("node:crypto");
const base = require("./base");

function mockBytes(prompt) { return Buffer.from(`videogen-mock-video\n${prompt}\n`, "utf8"); }
function createMockAdapter(config = {}) {
  const jobs = new Map();
  const stats = { createCounts: {}, maxInFlight: 0, inFlight: 0 };
  return {
    id: "mock", displayNameKey: "providerMock", createMode: "async", supportsIdempotencyKey: false,
    validateKey: (key) => base.validateKey(key, null, true), normalizeParams: base.normalizeParams, estimateCost: base.estimateCost, classifyError: base.classifyError,
    stats,
    async prepareAssets(ctx) { return ctx.assets; },
    async create(ctx, job) {
      if (config.createDelayMs) await new Promise((resolve) => setTimeout(resolve, config.createDelayMs));
      const id = randomUUID();
      stats.createCounts[job.prompt] = (stats.createCounts[job.prompt] || 0) + 1;
      stats.inFlight += 1;
      stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
      const record = { id, prompt: job.prompt, state: "running" };
      jobs.set(id, record);
      setTimeout(() => { record.state = config.moderation?.includes(job.prompt) ? "failed" : "succeeded"; stats.inFlight -= 1; }, config.renderDelayMs ?? 100).unref();
      return { remoteId: id, status: "running" };
    },
    async poll(ctx, job) {
      const record = jobs.get(job.remote.id);
      if (!record) return { status: "succeeded", result: { url: "mock:restored", needsAuth: false, contentType: "video/mp4" } };
      return { status: record.state, progress: record.state === "running" ? 50 : 100, result: record.state === "succeeded" ? { url: `mock:${record.id}`, needsAuth: false, contentType: "video/mp4" } : undefined, error: record.state === "failed" ? { category: "moderation", code: "moderation", message: "mockModeration" } : undefined };
    },
    async download(ctx, job) { return new Response(mockBytes(job.prompt), { headers: { "content-type": "video/mp4" } }); },
  };
}

module.exports = createMockAdapter();
module.exports.createMockAdapter = createMockAdapter;
module.exports.mockBytes = mockBytes;
