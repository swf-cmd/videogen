const http = require("node:http");
const { randomUUID, createHash } = require("node:crypto");
const { mockBytes } = require("../../src/providers/mock");

async function startMockServer(initial = {}) {
  const config = { renderDelayMs: 100, createDelayMs: 0, pollDelayMs: 0, downloadDelayMs: 0, resultTtlMs: 86400000, ...initial };
  const jobs = new Map();
  const stats = { createCounts: {}, requestCounts: {}, maxInFlight: {}, inFlight: {}, accepted: [], faults: [], createPending: {}, pollsActive: {}, downloadsActive: {}, maxDownloadsActive: 0, requests: [] };
  const sockets = new Set();
  const json = (res, status, value, headers = {}) => { if (!res.destroyed) { res.writeHead(status, { "content-type": "application/json", ...headers }); res.end(JSON.stringify(value)); } };
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const phaseDelay = (phase, prompt) => config.delays?.[prompt]?.[phase] ?? config[`${phase}DelayMs`] ?? 0;
  const track = (res, collection, job) => {
    const requestId = randomUUID();
    stats[collection][requestId] = { id: job.id, prompt: job.prompt, lane: job.lane, at: Date.now() };
    const done = () => { delete stats[collection][requestId]; };
    res.once("close", done);
    res.once("finish", done);
    return requestId;
  };
  const bodyOf = async (req) => {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > 16 * 1024 * 1024) throw new Error("oversize"); chunks.push(chunk); }
    const data = Buffer.concat(chunks).toString("utf8");
    if ((req.headers["content-type"] || "").includes("multipart/form-data")) {
      const value = {};
      for (const field of data.split(/\r?\n--/)) {
        const match = field.match(/name="([^"]+)"(?:[^\r\n]*)\r\n(?:[^\r\n]+\r\n)*\r\n([\s\S]*?)\r\n$/);
        if (match) value[match[1]] = match[2];
      }
      return value;
    }
    return data ? JSON.parse(data) : {};
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/stats") return json(res, 200, { ...stats, jobs: [...jobs.values()].map(({ timer, ...job }) => job) });
      if (url.pathname === "/control" && req.method === "POST") { Object.assign(config, await bodyOf(req)); return json(res, 200, { ok: true }); }
      const match = url.pathname.match(/^(.*?)\/v1\/(videos|models)(?:\/([^/]+))?(?:\/(content))?$/);
      if (!match) return json(res, 404, { error: { code: "not_found" } });
      const lane = match[1] || "default";
      if (config.requireKey && !req.headers.authorization) return json(res, 401, { error: { code: "unauthorized", message: "mockAuth" } });
      if (match[2] === "models" || match[3] === "models") return json(res, 200, { data: [{ id: "mock-video" }] });
      if (req.method === "POST" && !match[3]) {
        const body = await bodyOf(req);
        const prompt = body.prompt;
        if (!prompt) return json(res, 400, { error: { code: "invalid_request", message: "mockPromptRequired" } });
        stats.requestCounts[prompt] = (stats.requestCounts[prompt] || 0) + 1;
        stats.requests.push({ phase: "create", prompt, lane, at: Date.now() });
        const attempt = stats.requestCounts[prompt];
        let fault = config.faults?.[prompt];
        if (Array.isArray(fault)) fault = fault[attempt - 1];
        if (fault === "429" || fault === "rate_limit") { stats.faults.push({ prompt, type: "rate_limit", at: Date.now() }); return json(res, 429, { error: { code: "THROTTLED", message: "mockRateLimit" } }, { "retry-after": String(config.retryAfterSec ?? 0.05) }); }
        if (fault === "401" || fault === "auth") return json(res, 401, { error: { code: "unauthorized", message: "mockAuth" } });
        if (fault === "500" || fault === "server_error") return json(res, 500, { error: { code: "server_error", message: "mockServerError" } });
        const id = randomUUID();
        const createdAt = Date.now();
        const bytes = mockBytes(prompt);
        const job = { id, prompt, lane, status: "in_progress", createdAt, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, fault };
        jobs.set(id, job);
        stats.createCounts[prompt] = (stats.createCounts[prompt] || 0) + 1;
        stats.inFlight[lane] = (stats.inFlight[lane] || 0) + 1;
        stats.maxInFlight[lane] = Math.max(stats.maxInFlight[lane] || 0, stats.inFlight[lane]);
        stats.accepted.push({ id, prompt, lane, at: createdAt });
        track(res, "createPending", job);
        job.timer = setTimeout(() => { job.status = fault === "moderation" ? "failed" : "completed"; job.completedAt = Date.now(); job.expiresAt = job.completedAt + config.resultTtlMs; stats.inFlight[lane] -= 1; }, phaseDelay("render", prompt));
        if (["drop_response", "accepted_no_response"].includes(fault)) { stats.faults.push({ prompt, type: "drop_response", at: createdAt }); return; }
        await delay(phaseDelay("create", prompt));
        if (!res.destroyed) job.responseSentAt = Date.now();
        return json(res, 200, { id, status: job.status, created_at: Math.floor(createdAt / 1000) });
      }
      const job = jobs.get(decodeURIComponent(match[3] || ""));
      if (!job) return json(res, 404, { error: { code: "not_found", message: "mockNotFound" } });
      if (match[4] === "content") {
        if (job.status !== "completed") return json(res, 409, { error: { code: "not_ready" } });
        if (Date.now() > job.expiresAt) return json(res, 403, { error: { code: "expired" } });
        track(res, "downloadsActive", job);
        stats.maxDownloadsActive = Math.max(stats.maxDownloadsActive, Object.keys(stats.downloadsActive).length);
        stats.requests.push({ phase: "download", prompt: job.prompt, lane, at: Date.now() });
        res.writeHead(200, { "content-type": "video/mp4", "content-length": mockBytes(job.prompt).length });
        const bytes = mockBytes(job.prompt);
        res.write(bytes.subarray(0, Math.ceil(bytes.length / 2)));
        await delay(phaseDelay("download", job.prompt));
        return res.end(bytes.subarray(Math.ceil(bytes.length / 2)));
      }
      track(res, "pollsActive", job);
      stats.requests.push({ phase: "poll", prompt: job.prompt, lane, at: Date.now() });
      await delay(phaseDelay("poll", job.prompt));
      if (job.fault === "poll_disconnect" && !job.pollDisconnected) { job.pollDisconnected = true; req.socket.destroy(); return; }
      return json(res, 200, { id: job.id, status: job.status, progress: job.status === "in_progress" ? 50 : 100, error: job.status === "failed" ? { code: "moderation", message: "mockModeration" } : undefined });
    } catch { json(res, 400, { error: { code: "invalid_request", message: "mockBadRequest" } }); }
  });
  server.on("connection", (socket) => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise((resolve) => server.listen(initial.port || 0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}`, stats, config, jobs, close: async () => { for (const job of jobs.values()) clearTimeout(job.timer); for (const socket of sockets) socket.destroy(); await new Promise((resolve) => server.close(resolve)); } };
}

if (require.main === module) {
  startMockServer(process.env.MOCK_CONFIG ? JSON.parse(process.env.MOCK_CONFIG) : {}).then((instance) => {
    process.stdout.write(`${JSON.stringify({ url: instance.url })}\n`);
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => instance.close().then(() => process.exit(0)));
  });
}
module.exports = { startMockServer, mockBytes };
