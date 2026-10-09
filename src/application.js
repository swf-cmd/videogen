const path = require("node:path");
const { JobStore, cursorPosition } = require("./store/job-store");
const { AssetStore } = require("./store/asset-store");
const { readSettings, normalizeSettings, writeJson } = require("./store/settings");
const { KeyStore, normalizeLane, redact } = require("./queue/keys");
const { Scheduler } = require("./queue/scheduler");
const { EventStream } = require("./http/handlers/events");
const { loadCatalog, validateCatalog, normalizeOpenRouterModels } = require("./catalog/catalog");
const { createContext } = require("./providers/base");
const { normalizePublicModels } = require("./providers/models");
const { planBatch, prepareBatch } = require("./queue/batches");
const { Gallery } = require("./queue/gallery");
const outputFiles = require("./files/output");
const { parseBatchPrompts } = require("./http/handlers/prompts");
const { dataDirectory, MAX_BATCH_BYTES } = require("./config");

function adapters() {
  return Object.fromEntries(["openai-compatible", "openrouter", "gemini", "dashscope", "ark", "mock"].map((id) => [id, require(`./providers/${id}`)]));
}

const { pixelSize } = require("./pixel-size");

class Application {
  constructor({ directory = dataDirectory(), port = 0 } = {}) {
    this.directory = directory;
    this.catalog = loadCatalog(directory);
    this.adapters = adapters();
    this.keys = new KeyStore();
    try {
      this.store = new JobStore(directory, {
        port, supportsIdempotencyKey: (job) => this.adapters[job.provider]?.supportsIdempotencyKey === true,
        validatePersisted: (store) => {
          // Validate before interrupted-create recovery or compaction changes any
          // records. Old substring redaction may have damaged endpoint fields.
          for (const job of store.jobs.values()) normalizeLane(job);
          this.settings = readSettings(directory);
        },
      });
    } catch (cause) {
      if (cause instanceof SyntaxError || ["invalidStore", "invalidAttempts", "invalidRemoteId", "invalidLane", "invalidSettings"].includes(cause.code || cause.message)) {
        throw Object.assign(new Error("dataRecoveryRequired", { cause }), { code: "dataRecoveryRequired", directory: path.resolve(directory) });
      }
      throw cause;
    }
    try {
      this.assets = new AssetStore(directory);
      this.events = new EventStream(this.store);
      this.scheduler = new Scheduler({ store: this.store, keys: this.keys, adapters: this.adapters, context: (job, phase) => this.context(job, phase), settings: this.settings, onSettings: (settings) => {
        this.settings = normalizeSettings(settings);
        writeJson(this.directory, "settings.json", this.settings);
      } });
      this.store.on("maintenance", details => this.scheduler.log("warn", "store_compaction_deferred", details));
    } catch (error) { this.store.close(); throw error; }
    this.stopping = false;
    this.preparations = new Set();
    this.pendingAssets = new Set();
    this.gallery = new Gallery(this);
  }

  async start() {
    if (this.starting) return this.starting;
    this.starting = (async () => {
      for (const job of this.store.jobs.values()) {
        // One unreadable historical folder (moved drive, permissions) must not
        // keep every other paid job from resuming. The download path retries
        // recovery for unfinished jobs; finished ones only lose marker cleanup.
        try {
          if (job.state === "succeeded" && outputFiles.cleanupPublishedPartial) {
            await outputFiles.cleanupPublishedPartial(job.targetPath, { jobId: job.id, output: job.output });
          } else if (job.state === "downloading" && outputFiles.recoverOutput) {
            await outputFiles.recoverOutput(job.targetPath, { jobId: job.id, contentType: job.result?.contentType, onPublished: (saved) => {
              this.store.update(job.id, { state: "succeeded", output: saved, progress: 100, completedAt: new Date().toISOString() }, { sync: true });
            } });
          }
        } catch (error) {
          if (this.store.failed) throw error;
          this.scheduler.log("warn", "startup_output_recovery_skipped", { jobId: job.id, code: error?.code || error?.name || "error" });
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
    return { provider, region, lane, model, adapter, params };
  }

  prompts(payload) {
    // Bound expanded text memory, not the number of jobs. 50,000+ short prompts are supported.
    const count = Number(payload.batchCount || 1);
    if (Number.isSafeInteger(count) && count > 0 && String(payload.prompt || "").trim().split(/\n\s*\n+/).length === 1 && count * Math.max(1, Buffer.byteLength(String(payload.prompt || ""))) > MAX_BATCH_BYTES) throw new Error("requestTooLarge");
    return parseBatchPrompts(payload.prompt, payload.batchCount, payload.language);
  }

  estimate(payload) { return planBatch(this, payload, { summaryOnly: payload.summaryOnly === true }).estimate; }

  async prepare(payload, file, files) {
    const pending = prepareBatch(this, payload, file, files, pixelSize);
    this.preparations.add(pending);
    try { return await pending; } finally { this.preparations.delete(pending); }
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
    const before = cursorPosition(cursor, this.store.batches);
    const entries = [...this.store.batches.values()].reverse().filter(batch => before === null || batch.queueOrder < before);
    const start = 0;
    const rows = entries.slice(start, start + count).map((batch) => ({ ...batch, counts: {}, total: 0 }));
    const lookup = new Map(rows.map((batch) => [batch.id, batch]));
    for (const job of this.store.jobs.values()) {
      const batch = lookup.get(job.batchId);
      if (batch) { batch.counts[job.state] = (batch.counts[job.state] || 0) + 1; batch.total += 1; }
    }
    return { batches: rows, nextCursor: entries.length > count ? `q1:${rows.at(-1).queueOrder}` : null, seq: this.store.seq };
  }

  async refreshCatalog(providerId, payload) {
    const provider = this.catalog.providers.find((entry) => entry.provider === providerId);
    if (!provider || !this.adapters[providerId]?.listModels) throw new Error("refreshUnsupported");
    const region = provider.regions.find((entry) => entry.id === payload.region) || provider.regions[0];
    const lane = this.lane({ provider: providerId, region: region.id, baseUrl: payload.baseUrl || region.baseUrl });
    const ctx = createContext({ lane, key: this.keys.get(lane) || "", redact });
    try {
      const data = await this.adapters[providerId].listModels(ctx);
      if (providerId !== "openrouter") return { models: normalizePublicModels(data, ctx.redact), refreshed: true };
      const asOf = new Date().toISOString().slice(0, 10);
      const refreshed = validateCatalog({ ...provider, asOf, models: normalizeOpenRouterModels(data, asOf) });
      if (!refreshed.models.length) throw new Error("invalidProviderResponse");
      writeJson(this.directory, "openrouter-models.cache.json", { fetchedAt: new Date().toISOString(), provider: refreshed });
      this.catalog.providers = this.catalog.providers.map((entry) => entry.provider === providerId ? refreshed : entry);
      return { ...this.catalog, refreshed: true };
    } catch { return { ...this.catalog, refreshed: false, error: { code: "catalogFallback" } }; }
  }

  clearHistory() {
    const count = this.store.clearHistory();
    // Frames of an import still being persisted are referenced only by
    // pendingAssets until addManyAsync finishes.
    this.assets.collect([...this.store.jobs.values(), ...this.pendingAssets]);
    return { count };
  }

  // Manifest of finished takes for editors, spreadsheets and handoff. This is
  // an explicit local download, so output paths are absolute.
  exportManifest({ batch, batchId, selection = "keep", format = "csv" } = {}) {
    const id = batchId || batch || null;
    if (id && !this.store.batches.has(id)) throw Object.assign(new Error("batchNotFound"), { status: 404 });
    if (!["keep", "reject", "unreviewed", "all"].includes(selection) || !["csv", "json"].includes(format)) throw new Error("invalidParams");
    const rows = [];
    for (const job of this.store.jobs.values()) {
      if (id && job.batchId !== id) continue;
      if (job.state !== "succeeded" || !job.output?.path) continue;
      const chosen = job.selection || "unreviewed";
      if (selection !== "all" && chosen !== selection) continue;
      rows.push({
        batch_id: job.batchId, job_id: job.id, shot: Number.isInteger(job.shot) ? job.shot + 1 : job.index + 1, take: job.take || 1,
        selection: chosen, provider: job.provider, region: job.region, model: job.model, prompt: job.prompt,
        duration_seconds: job.params?.durationSeconds ?? "", resolution: job.params?.resolution ?? "", aspect_ratio: job.params?.aspectRatio ?? "",
        audio: job.params?.audio === undefined ? "" : String(job.params.audio), seed: job.params?.seed ?? "",
        first_frame: job.assets?.some((asset) => asset.role === "first_frame") ? "yes" : "", last_frame: job.assets?.some((asset) => asset.role === "last_frame") ? "yes" : "",
        estimated_cost: Number.isFinite(job.costEstimate?.amount) ? job.costEstimate.amount : "", currency: job.costEstimate?.currency || "",
        estimated_charges: job.estimatedCharges ?? "", remote_id: job.remote?.id || "", parent_job_id: job.parentJobId || "",
        output_path: job.output.path, bytes: job.output.bytes ?? "", sha256: job.output.sha256 || "",
        created_at: job.createdAt || "", completed_at: job.completedAt || "",
      });
    }
    // Batches in queue order, then shot and take; ties keep creation order.
    const batchOrder = new Map();
    for (const row of rows) if (!batchOrder.has(row.batch_id)) batchOrder.set(row.batch_id, batchOrder.size);
    rows.forEach((row, index) => { row.order = index; });
    rows.sort((a, b) => batchOrder.get(a.batch_id) - batchOrder.get(b.batch_id) || a.shot - b.shot || a.take - b.take || a.order - b.order);
    for (const row of rows) delete row.order;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `videogen-${selection}-${id ? id.slice(0, 8) : "all"}-${stamp}.${format}`;
    if (format === "json") return { filename, contentType: "application/json; charset=utf-8", body: `${JSON.stringify({ exportedAt: new Date().toISOString(), batchId: id, selection, takes: rows }, null, 2)}\n` };
    const columns = ["batch_id", "job_id", "shot", "take", "selection", "provider", "region", "model", "prompt", "duration_seconds", "resolution", "aspect_ratio", "audio", "seed", "first_frame", "last_frame", "estimated_cost", "currency", "estimated_charges", "remote_id", "parent_job_id", "output_path", "bytes", "sha256", "created_at", "completed_at"];
    // Quote every field and neutralize spreadsheet formulas in free text.
    const cell = (value) => {
      let text = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(text) && typeof value === "string") text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const lines = [columns.join(","), ...rows.map((row) => columns.map((name) => cell(row[name])).join(","))];
    return { filename, contentType: "text/csv; charset=utf-8", body: `﻿${lines.join("\r\n")}\r\n` };
  }
  async close() {
    if (this.stopping) return;
    this.stopping = true;
    this.events.close();
    await Promise.allSettled([...this.preparations]);
    await this.scheduler.close(15000);
    if (this.store.compacting) await this.store.compacting.catch(() => {});
    this.store.close();
  }
}
module.exports = { Application, pixelSize };
