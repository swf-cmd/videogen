const crypto = require("node:crypto");
const path = require("node:path");
const { JobStore } = require("./store/job-store");
const { AssetStore } = require("./store/asset-store");
const { KeyStore, normalizeLane, redact } = require("./queue/keys");
const { loadCatalog } = require("./catalog/catalog");
const { createContext } = require("./providers/base");
const { normalizeInputReference } = require("./media/image");
const { resolveBatchOutputPath, writeOutput, displayPathForUser } = require("./files/output");
const { parseBatchPrompts } = require("./http/handlers/legacy");
const { withIdempotentRetry, sleep } = require("./providers/retry");
const { st } = require("./i18n/server-messages");
const { dataDirectory } = require("./config");

function adapters() {
  return Object.fromEntries(["openai-compatible", "openrouter", "mock"].map((id) => [id, require(`./providers/${id}`)]));
}

function pixelSize(params) {
  if (/^\d+x\d+$/.test(params.resolution)) return params.resolution;
  const edge = /^([0-9]+)p$/i.exec(params.resolution)?.[1];
  const ratio = /^(\d+):(\d+)$/.exec(params.aspectRatio);
  if (!edge || !ratio) return "";
  const [a, b] = ratio.slice(1).map(Number);
  const height = Number(edge);
  return a >= b ? `${Math.round(height * a / b / 2) * 2}x${height}` : `${height}x${Math.round(height * b / a / 2) * 2}`;
}

class Application {
  constructor({ directory = dataDirectory(), port = 0 } = {}) {
    this.catalog = loadCatalog(directory);
    this.adapters = adapters();
    this.keys = new KeyStore();
    this.store = new JobStore(directory, { port });
    this.assets = new AssetStore(directory);
    this.laneStatus = new Map();
    this.busy = false;
    this.stopping = false;
    this.work = new Set();
    for (const job of this.store.jobs.values()) {
      if (job.state === "submitting" && !job.remote?.id) this.store.update(job.id, { state: "needs_review", error: this.error("unknown_outcome", job.language) }, { sync: true });
    }
  }

  error(category, language = "zh", extra = {}) { return { category, code: category, message: st(language, category), ...extra }; }

  selection(payload) {
    const provider = this.catalog.providers.find((item) => item.provider === payload.provider);
    const region = provider?.regions.find((item) => item.id === payload.region);
    if (!provider || !region || payload.provider === "mock" && process.env.VIDEOGEN_DEV !== "1") throw new Error("invalidProvider");
    const lane = normalizeLane({ provider: provider.provider, region: region.id, baseUrl: payload.baseUrl || region.baseUrl });
    let model = provider.models.find((item) => item.id === payload.model && (!item.regions || item.regions.includes(region.id)));
    if (provider.provider === "openai-compatible" && payload.customCapabilities) {
      model = { id: String(payload.model || ""), label: String(payload.model || ""), verified: false, capabilities: payload.customCapabilities, pricing: null, concurrencyDefault: 1, pollIntervalSec: 10, resultTtlHours: null, typicalRenderSec: 120 };
    }
    if (!model || !model.id || model.id.length > 300) throw new Error("invalidParams");
    const adapter = this.adapters[provider.provider];
    if (!adapter) throw new Error("invalidProvider");
    const normalized = adapter.normalizeParams(model, payload.params || {});
    if (!normalized.ok) throw new Error("invalidParams");
    const params = normalized.value;
    if (payload.params?.requestFormat) {
      if (!["json", "multipart"].includes(payload.params.requestFormat)) throw new Error("invalidParams");
      params.requestFormat = payload.params.requestFormat;
    }
    const cost = { ...adapter.estimateCost(model, params), catalogAsOf: provider.asOf };
    return { provider, region, lane, model, adapter, params, cost };
  }

  estimate(payload) {
    const selected = this.selection(payload);
    const prompts = parseBatchPrompts(payload.prompt, payload.batchCount, payload.language);
    const amount = selected.cost.amount === null ? null : selected.cost.amount * prompts.length;
    return { cost: { ...selected.cost, amount }, count: prompts.length, etaSeconds: prompts.length * (selected.model.typicalRenderSec || 120) };
  }

  async prepare(payload, file, recover = false) {
    const selected = this.selection(payload);
    const { lane, adapter, model, params } = selected;
    if (payload.apiKey !== undefined) { this.keys.set(lane, String(payload.apiKey), adapter); this.laneStatus.delete(lane.id); }
    const key = this.keys.get(lane) || "";
    if (adapter.validateKey(key)) throw new Error("needs_key");
    const image = file?.size ? await normalizeInputReference(file, pixelSize(params), payload.language) : null;
    if (image && !model.capabilities.firstFrame) throw new Error("unsupportedFirstFrame");
    const assets = image ? [this.assets.put(image)] : [];
    const prompts = recover ? [""] : parseBatchPrompts(payload.prompt, payload.batchCount, payload.language);
    const batchId = crypto.randomUUID();
    if (recover && (!payload.remoteId || /[\s\x00-\x1f\x7f]/.test(payload.remoteId) || String(payload.remoteId).length > 512)) throw new Error("invalidParams");
    const jobs = prompts.map((prompt, index) => {
      const id = crypto.randomUUID();
      return {
        id, batchId, index, ...lane, id, laneId: lane.id, provider: lane.provider,
        model: model.id, modelConfig: model, params, prompt, assets,
        state: recover ? "running" : "queued", progress: 0,
        remote: recover ? { id: String(payload.remoteId), lastStatus: "running" } : null,
        attempts: { create: 0, poll: 0, download: 0 }, costEstimate: selected.cost,
        targetPath: resolveBatchOutputPath(payload.outputDir, payload.filename, index, prompts.length, id).filePath,
        createdAt: new Date().toISOString(), language: payload.language || "zh", requiresKey: Boolean(key),
      };
    });
    for (const job of jobs) this.store.add(job);
    return { ...selected, jobs };
  }

  context(job, adapter) {
    const lane = normalizeLane(job);
    return createContext({ lane, key: this.keys.get(lane) || "", catalog: job.modelConfig, redact, assets: job.assets.map((asset) => this.assets.read(asset)) });
  }

  async execute(job, emit) {
    const adapter = this.adapters[job.provider];
    const ctx = this.context(job, adapter);
    let phase = job.remote?.id ? "poll" : "prepare";
    try {
      if (!job.remote?.id) {
        if (adapter.prepareAssets) ctx.remoteAssets = await withIdempotentRetry(() => adapter.prepareAssets(ctx, job));
        if (this.stopping) return;
        phase = "create";
        job = this.store.update(job.id, { state: "submitting", attempts: { ...job.attempts, create: job.attempts.create + 1 }, submittingAt: new Date().toISOString() }, { sync: true });
        const created = await adapter.create(ctx, job, { idempotencyKey: job.id });
        if (!created.remoteId) throw Object.assign(new Error("unknown_outcome"), { category: "unknown_outcome" });
        job = this.store.update(job.id, { state: "running", remote: { id: created.remoteId, lastStatus: created.status, ...(created.pollingUrl ? { pollingUrl: created.pollingUrl } : {}) }, startedAt: new Date().toISOString() }, { sync: true });
        emit({ type: "status", id: job.remote.id, status: "running", message: st(job.language, "videoCreated") });
      }
      phase = "poll";
      let result;
      for (;;) {
        const polled = await withIdempotentRetry(() => {
          job = this.store.update(job.id, { attempts: { ...job.attempts, poll: job.attempts.poll + 1 } });
          return adapter.poll(ctx, job, {});
        });
        job = this.store.update(job.id, { remote: { ...job.remote, lastStatus: polled.status }, progress: polled.progress || 0 });
        emit({ type: "status", id: job.remote.id, status: polled.status, progress: polled.progress || 0 });
        if (polled.status === "succeeded") { result = polled.result; break; }
        if (["failed", "cancelled", "expired"].includes(polled.status)) {
          const category = polled.status === "expired" ? "result_expired" : polled.error?.category || "invalid_request";
          throw Object.assign(new Error(category), { category });
        }
        await sleep((job.modelConfig.pollIntervalSec || 10) * 1000);
      }
      phase = "download";
      const ttl = job.modelConfig.resultTtlHours;
      job = this.store.update(job.id, { state: "downloading", resultExpiresAt: result?.expiresAt || (ttl ? new Date(Date.now() + ttl * 3600000).toISOString() : null) });
      emit({ type: "status", status: "downloading", message: st(job.language, "videoDownloading") });
      const output = await withIdempotentRetry(async () => {
        job = this.store.update(job.id, { attempts: { ...job.attempts, download: job.attempts.download + 1 } });
        const response = await adapter.download(ctx, job, result, {});
        return writeOutput(response, job.targetPath, { jobId: job.id, onPublished: (saved) => {
          job = this.store.update(job.id, { state: "succeeded", output: saved, progress: 100, completedAt: new Date().toISOString() }, { sync: true });
        } });
      });
      return output;
    } catch (error) {
      const category = phase === "prepare" ? "prepareFailed" : error.category || adapter.classifyError(error, phase);
      const unknown = phase === "create" && category === "unknown_outcome";
      const state = unknown ? "needs_review" : category === "result_expired" ? "result_expired" : phase === "create" && ["auth", "quota", "rate_limited", "model_unavailable"].includes(category) ? "queued" : "failed";
      if (unknown || state === "queued") this.laneStatus.set(job.laneId, category);
      const definitelyNotAccepted = phase === "prepare" || phase === "create" && (error.accepted === false || ["rate_limited", "auth", "invalid_request", "quota", "model_unavailable"].includes(category));
      this.store.update(job.id, { state, error: this.error(category, job.language, { phase, definitelyNotAccepted }) }, { sync: true });
      emit({ type: "status", status: state, message: st(job.language, category), id: job.remote?.id, localId: job.id });
    }
  }

  async generate(payload, file, emit, recover = false) {
    if (this.busy || this.stopping) throw new Error("busy");
    this.busy = true;
    try {
      const { jobs } = await this.prepare(payload, file, recover);
      const output = [];
      for (const job of jobs) {
        if (this.stopping || this.laneStatus.has(job.laneId)) break;
        const saved = await this.execute(job, emit);
        if (saved) output.push(displayPathForUser(saved.path));
      }
      emit({ type: "done", output: { count: output.length, failedCount: jobs.length - output.length, paths: output }, message: st(payload.language, "batchDone", { count: output.length }) });
    } finally { this.busy = false; }
  }

  clearHistory() { const count = this.store.clearHistory(); this.assets.collect(this.store.jobs.values()); return { count }; }
  async close() {
    this.stopping = true;
    let timer;
    try { await Promise.race([Promise.allSettled([...this.work]), new Promise((resolve) => { timer = setTimeout(resolve, 15000); })]); }
    finally { clearTimeout(timer); }
    this.store.close();
  }
}
module.exports = { Application, pixelSize };
