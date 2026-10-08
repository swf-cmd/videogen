const crypto = require("node:crypto");
const { JobStore } = require("./store/job-store");
const { AssetStore } = require("./store/asset-store");
const { readSettings, normalizeSettings, writeJson } = require("./store/settings");
const { KeyStore, normalizeLane, redact } = require("./queue/keys");
const { Scheduler } = require("./queue/scheduler");
const { EventStream } = require("./http/handlers/events");
const { loadCatalog, validateCatalog, normalizeOpenRouterModels } = require("./catalog/catalog");
const { createContext } = require("./providers/base");
const { normalizeInputReference } = require("./media/image");
const outputFiles = require("./files/output");
const { resolveBatchOutputPath } = outputFiles;
const { parseBatchPrompts } = require("./http/handlers/prompts");
const { dataDirectory, MAX_BATCH_BYTES } = require("./config");

function adapters() {
  return Object.fromEntries(["openai-compatible", "openrouter", "gemini", "dashscope", "ark", "mock"].map((id) => [id, require(`./providers/${id}`)]));
}

function pixelSize(params) {
  if (/^\d+x\d+$/.test(params.resolution)) return params.resolution;
  const edge = params.resolution === "4k" ? 2160 : /^([0-9]+)p$/i.exec(params.resolution)?.[1];
  const ratio = /^(\d+):(\d+)$/.exec(params.aspectRatio);
  if (!edge || !ratio) return "";
  const [a, b] = ratio.slice(1).map(Number);
  const height = Number(edge);
  return a >= b ? `${Math.round(height * a / b / 2) * 2}x${height}` : `${height}x${Math.round(height * b / a / 2) * 2}`;
}

class Application {
  constructor({ directory = dataDirectory(), port = 0 } = {}) {
    this.directory = directory;
    this.catalog = loadCatalog(directory);
    this.adapters = adapters();
    this.keys = new KeyStore();
    this.store = new JobStore(directory, { port, supportsIdempotencyKey: (job) => this.adapters[job.provider]?.supportsIdempotencyKey === true });
    try {
      this.assets = new AssetStore(directory);
      this.settings = readSettings(directory);
      this.events = new EventStream(this.store);
      this.scheduler = new Scheduler({ store: this.store, keys: this.keys, adapters: this.adapters, context: (job, phase) => this.context(job, phase), settings: this.settings, onSettings: (settings) => {
        this.settings = normalizeSettings(settings);
        writeJson(this.directory, "settings.json", this.settings);
      } });
    } catch (error) { this.store.close(); throw error; }
    this.stopping = false;
  }

  async start() {
    if (this.starting) return this.starting;
    this.starting = (async () => {
      for (const job of this.store.jobs.values()) {
        if (job.state === "succeeded" && outputFiles.cleanupPublishedPartial) {
          await outputFiles.cleanupPublishedPartial(job.targetPath, { jobId: job.id, output: job.output });
        } else if (job.state === "downloading" && outputFiles.recoverOutput) {
          await outputFiles.recoverOutput(job.targetPath, { jobId: job.id, contentType: job.result?.contentType, onPublished: (saved) => {
            this.store.update(job.id, { state: "succeeded", output: saved, progress: 100, completedAt: new Date().toISOString() }, { sync: true });
          } });
        }
      }
      if (!this.stopping) this.scheduler.start();
    })();
    return this.starting;
  }

  lane(value) {
    const lane = normalizeLane(value);
    const provider = this.catalog.providers.find((item) => item.provider === lane.provider);
    if (!provider?.regions.some((region) => region.id === lane.region) || !this.adapters[lane.provider]) throw new Error("invalidProvider");
    return lane;
  }

  setKey({ lane: value, key }) {
    const lane = this.lane(value);
    this.keys.set(lane, key, this.adapters[lane.provider]);
    this.scheduler.keysChanged(lane);
    return { lane, present: true };
  }

  deleteKey(id) {
    const lane = this.keys.list().find((entry) => entry.lane.id === id)?.lane;
    this.keys.delete(id);
    if (lane) this.scheduler.keysChanged(lane);
    return { removed: Boolean(lane) };
  }

  selection(payload) {
    const provider = this.catalog.providers.find((item) => item.provider === payload.provider);
    const region = provider?.regions.find((item) => item.id === payload.region);
    if (!provider || !region || payload.provider === "mock" && process.env.VIDEOGEN_DEV !== "1") throw new Error("invalidProvider");
    const lane = this.lane({ provider: provider.provider, region: region.id, baseUrl: payload.baseUrl || region.baseUrl });
    let model = provider.models.find((item) => item.id === payload.model && (!item.regions || item.regions.includes(region.id)));
    if (provider.provider === "openai-compatible" && payload.customCapabilities) {
      model = { id: String(payload.model || ""), label: String(payload.model || ""), verified: false, sources: [], capabilities: payload.customCapabilities, pricing: null, concurrencyDefault: 1, pollIntervalSec: 10, resultTtlHours: null, typicalRenderSec: 120 };
      validateCatalog({ ...provider, models: [model] });
    }
    if (!model || !model.id || model.id.length > 300) throw new Error("invalidParams");
    model = structuredClone(model);
    if (model.pricingByRegion) model.pricing = model.pricingByRegion[region.id] ?? null;
    const adapter = this.adapters[provider.provider];
    const laneError = adapter.validateLane?.(lane, model);
    if (laneError) throw Object.assign(new Error(laneError), { code: laneError });
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

  prompts(payload) {
    // Bound expanded text memory, not the number of jobs. 50,000+ short prompts are supported.
    const count = Number(payload.batchCount || 1);
    if (Number.isSafeInteger(count) && count > 0 && String(payload.prompt || "").trim().split(/\n\s*\n+/).length === 1 && count * Math.max(1, Buffer.byteLength(String(payload.prompt || ""))) > MAX_BATCH_BYTES) throw new Error("requestTooLarge");
    return parseBatchPrompts(payload.prompt, payload.batchCount, payload.language);
  }

  estimate(payload) {
    const selected = this.selection(payload);
    const prompts = this.prompts(payload);
    const amount = selected.cost.amount === null ? null : selected.cost.amount * prompts.length;
    const concurrency = this.settings.lanes[selected.lane.id]?.concurrency || selected.model.concurrencyDefault;
    const typical = this.scheduler.laneList().find((entry) => entry.id === selected.lane.id)?.typicalRenderSec || selected.model.typicalRenderSec;
    return { cost: { ...selected.cost, amount }, count: prompts.length, etaSeconds: Math.ceil(prompts.length / concurrency) * typical, concurrency };
  }

  async prepare(payload, file) {
    if (this.stopping) throw new Error("serviceStopping");
    const selected = this.selection(payload);
    const { lane, adapter, model, params } = selected;
    const image = file?.size ? await normalizeInputReference(file, pixelSize(params), payload.language) : null;
    if (image && !model.capabilities.firstFrame) throw new Error("unsupportedFirstFrame");
    const assets = image ? [this.assets.put(image)] : [];
    const prompts = this.prompts(payload);
    const batchId = crypto.randomUUID();
    let budget = null;
    if (payload.budget !== undefined && payload.budget !== null && payload.budget !== "") {
      const amount = Number(typeof payload.budget === "object" ? payload.budget.amount : payload.budget);
      const currency = payload.budget.currency || selected.cost.currency;
      if (!Number.isFinite(amount) || amount <= 0 || selected.cost.amount === null || currency !== selected.cost.currency) throw new Error("invalidBudget");
      budget = { amount, currency };
    }
    const jobs = prompts.map((prompt, index) => {
      const id = crypto.randomUUID();
      return {
        id, batchId, index, provider: lane.provider, region: lane.region, baseUrl: lane.baseUrl, laneId: lane.id,
        model: model.id, modelConfig: model, params, prompt, assets,
        state: "queued", progress: 0,
        remote: null,
        attempts: { create: 0, poll: 0, download: 0 }, costEstimate: selected.cost,
        targetPath: resolveBatchOutputPath(payload.outputDir, payload.filename, index, prompts.length, id).filePath,
        createdAt: new Date().toISOString(), language: payload.language || "zh", requiresKey: Boolean(this.keys.get(lane)) || adapter.validateKey("") !== null,
      };
    });
    this.store.updateBatch(batchId, { state: "active", laneId: lane.id, budget, total: jobs.length, createdAt: new Date().toISOString() });
    this.store.addMany(jobs);
    this.scheduler.kick();
    return { ...selected, jobs, id: batchId, count: jobs.length };
  }

  context(job, phase = "create") {
    const lane = normalizeLane(job);
    return createContext({ lane, key: this.keys.get(lane) || "", catalog: job.modelConfig, redact, assets: ["prepare", "create"].includes(phase) ? (job.assets || []).map((asset) => this.assets.read(asset)) : [] });
  }

  batch(id) {
    const batch = this.store.batches.get(id);
    if (!batch) throw Object.assign(new Error("batchNotFound"), { status: 404 });
    const counts = {};
    let total = 0;
    for (const job of this.store.jobs.values()) if (job.batchId === id) { counts[job.state] = (counts[job.state] || 0) + 1; total += 1; }
    return { ...batch, total, counts };
  }

  batches({ cursor, limit = 50 } = {}) {
    const count = Math.max(1, Math.min(500, Number(limit) || 50));
    const entries = [...this.store.batches.values()];
    const start = cursor ? entries.findIndex((batch) => batch.id === cursor) + 1 : 0;
    const rows = entries.slice(start, start + count).map((batch) => ({ ...batch, counts: {}, total: 0 }));
    const lookup = new Map(rows.map((batch) => [batch.id, batch]));
    for (const job of this.store.jobs.values()) {
      const batch = lookup.get(job.batchId);
      if (batch) { batch.counts[job.state] = (batch.counts[job.state] || 0) + 1; batch.total += 1; }
    }
    return { batches: rows, nextCursor: entries.length > start + count ? rows.at(-1).id : null, seq: this.store.seq };
  }

  async refreshCatalog(providerId, payload) {
    const provider = this.catalog.providers.find((entry) => entry.provider === providerId);
    if (!provider || !this.adapters[providerId]?.listModels) throw new Error("refreshUnsupported");
    const region = provider.regions.find((entry) => entry.id === payload.region) || provider.regions[0];
    const lane = this.lane({ provider: providerId, region: region.id, baseUrl: payload.baseUrl || region.baseUrl });
    const ctx = createContext({ lane, key: this.keys.get(lane) || "", redact });
    try {
      const data = await this.adapters[providerId].listModels(ctx);
      if (providerId !== "openrouter") return { models: data.data || data, refreshed: true };
      const asOf = new Date().toISOString().slice(0, 10);
      const refreshed = validateCatalog({ ...provider, asOf, models: normalizeOpenRouterModels(data, asOf) });
      if (!refreshed.models.length) throw new Error("invalidProviderResponse");
      writeJson(this.directory, "openrouter-models.cache.json", { fetchedAt: new Date().toISOString(), provider: refreshed });
      this.catalog.providers = this.catalog.providers.map((entry) => entry.provider === providerId ? refreshed : entry);
      return { ...this.catalog, refreshed: true };
    } catch { return { ...this.catalog, refreshed: false, error: { code: "catalogFallback" } }; }
  }

  clearHistory() { const count = this.store.clearHistory(); this.assets.collect(this.store.jobs.values()); return { count }; }
  async close() {
    if (this.stopping) return;
    this.stopping = true;
    this.events.close();
    await this.scheduler.close(15000);
    this.store.close();
  }
}
module.exports = { Application, pixelSize };
