const { EventEmitter } = require("node:events");
const { normalizeLane, redact } = require("./keys");
const { TERMINAL_STATES } = require("./state");
const { writeOutput: defaultWriteOutput } = require("../files/output");
const { st } = require("../i18n/server-messages");

function actionError(code) { return Object.assign(new Error(code), { code }); }
function number(value, fallback) { return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback; }
function time(value) { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : Infinity; }

class Scheduler extends EventEmitter {
  constructor({ store, keys, adapters, context, settings = { lanes: {} }, onSettings = () => {}, writeOutput = defaultWriteOutput, now = Date.now, random = Math.random, setTimer = setTimeout, clearTimer = clearTimeout, downloadConcurrency = 3, circuitThreshold = 3 } = {}) {
    super();
    this.store = store;
    this.keys = keys;
    this.adapters = adapters;
    this.context = context;
    this.settings = { ...settings, lanes: { ...settings.lanes } };
    this.onSettings = onSettings;
    this.writeOutput = writeOutput;
    this.now = now;
    this.random = random;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.downloadConcurrency = downloadConcurrency;
    this.circuitThreshold = circuitThreshold;
    this.lanes = new Map();
    this.index = new Map();
    this.work = new Map();
    this.downloads = new Set();
    this.due = new Map();
    this.failures = new Map();
    this.assetCache = new Map();
    this.batchCosts = new Map();
    this.reservations = new Map();
    this.cancelling = new Map();
    this.started = false;
    this.stopping = false;
    this.closed = false;
    this.pendingKick = false;
    this.timer = null;
    this.nextWake = Infinity;
    this.onStoreEvent = (event) => {
      try {
        if (event.type === "job" || event.type === "delete") this.indexJob(event.jobId);
        this.kick();
      } catch (error) { this.fatal(error); }
    };
    for (const entry of Object.values(this.settings.lanes)) if (entry?.lane) this.ensureLane(entry.lane);
    for (const job of this.store.jobs.values()) this.indexJob(job.id);
    this.store.on("event", this.onStoreEvent);
  }

  ensureLane(value) {
    if (typeof value === "string") {
      const existing = this.lanes.get(value);
      if (!existing) throw actionError("invalidLane");
      return existing;
    }
    const descriptor = normalizeLane(value);
    let lane = this.lanes.get(descriptor.id);
    const model = value.modelConfig || {};
    if (!lane) {
      const configured = this.settings.lanes[descriptor.id] || {};
      const concurrency = Math.floor(number(configured.concurrency, number(model.concurrencyDefault, 1)));
      lane = { lane: descriptor, concurrency, configuredConcurrency: configured.concurrency !== undefined, hasModel: Boolean(value.modelConfig), paused: Boolean(configured.paused), reason: configured.paused ? "manual_pause" : null, needsKey: false, cooldownUntil: 0, queued: new Map(), inFlight: new Set(), running: new Set(), review: new Set(), preparing: new Set(), requiresKey: false, rpm: number(model.rpm, 0), tokens: 0, tokenAt: this.now(), errorCategory: null, errorCount: 0, typicalSeconds: number(model.typicalRenderSec, 120) };
      lane.tokens = Math.min(lane.rpm, concurrency);
      lane.downloading = new Set();
      lane.idempotent = new Set();
      this.lanes.set(descriptor.id, lane);
    } else {
      if (!lane.hasModel && value.modelConfig) {
        if (!lane.configuredConcurrency) lane.concurrency = Math.floor(number(model.concurrencyDefault, 1));
        lane.typicalSeconds = number(model.typicalRenderSec, 120);
        lane.hasModel = true;
      }
      if (model.rpm) {
        if (!lane.rpm) { lane.tokens = Math.min(model.rpm, lane.concurrency); lane.tokenAt = this.now(); }
        lane.rpm = lane.rpm ? Math.min(lane.rpm, model.rpm) : model.rpm;
      }
    }
    if (value.requiresKey) lane.requiresKey = true;
    return lane;
  }

  cost(job) {
    const charges = job.estimatedCharges ?? (job.remote?.id || ["submitting", "needs_review"].includes(job.state) ? 1 : 0);
    return { currency: job.costEstimate?.currency, amount: Number.isFinite(job.costEstimate?.amount) ? job.costEstimate.amount * charges : 0 };
  }

  changeCost(batchId, cost, sign) {
    if (!cost.currency || !cost.amount) return;
    let currencies = this.batchCosts.get(batchId);
    if (!currencies) { currencies = new Map(); this.batchCosts.set(batchId, currencies); }
    currencies.set(cost.currency, Math.max(0, (currencies.get(cost.currency) || 0) + sign * cost.amount));
  }

  indexJob(id) {
    const old = this.index.get(id);
    if (old) {
      const lane = this.lanes.get(old.laneId);
      lane.queued.get(old.batchId)?.delete(id);
      if (lane.queued.get(old.batchId)?.size === 0) lane.queued.delete(old.batchId);
      lane.inFlight.delete(id);
      lane.running.delete(id);
      lane.review.delete(id);
      lane.downloading.delete(id);
      lane.idempotent.delete(id);
      this.downloads.delete(id);
      this.changeCost(old.batchId, old.cost, -1);
    }
    const job = this.store.get(id);
    if (!job) { this.index.delete(id); this.due.delete(id); return; }
    const lane = this.ensureLane(job);
    const indexed = { laneId: lane.lane.id, batchId: job.batchId, state: job.state, cost: this.cost(job) };
    this.index.set(id, indexed);
    this.changeCost(job.batchId, indexed.cost, 1);
    if (job.state === "queued") {
      if (!lane.queued.has(job.batchId)) lane.queued.set(job.batchId, new Set());
      lane.queued.get(job.batchId).add(id);
      if (job.createAuthorization?.kind === "idempotent") lane.idempotent.add(id);
    }
    if (["submitting", "running", "needs_review"].includes(job.state)) lane.inFlight.add(id);
    if (job.state === "running") lane.running.add(id);
    if (job.state === "needs_review") lane.review.add(id);
    if (job.state === "downloading") { this.downloads.add(id); lane.downloading.add(id); }
    if (TERMINAL_STATES.has(job.state)) { this.due.delete(id); this.assetCache.delete(id); }
  }

  laneState(lane) {
    if (this.fatalError) return "paused";
    const adapter = this.adapters[lane.lane.provider];
    const key = this.keys.get(lane.lane);
    if (!adapter || lane.needsKey || (lane.requiresKey && !key) || adapter.validateKey(key || "") !== null) return "needs_key";
    if (lane.paused) return "paused";
    if (lane.cooldownUntil > this.now()) return "cooldown";
    return "active";
  }

  laneList() {
    return [...this.lanes.values()].map((lane) => {
      const queued = [...lane.queued.values()].reduce((sum, ids) => sum + ids.size, 0);
      const state = this.laneState(lane);
      const submitting = lane.inFlight.size - lane.running.size - lane.review.size;
      const pending = queued + lane.running.size + submitting + lane.downloading.size;
      return { ...lane.lane, lane: { ...lane.lane }, state, reason: this.fatalError?.code || (state === "needs_key" ? "needs_key" : state === "active" ? null : lane.reason), concurrency: lane.concurrency, inFlight: lane.inFlight.size + lane.preparing.size, queued, submitting, running: lane.running.size, downloading: lane.downloading.size, pending, waitingForKey: state === "needs_key" ? pending : 0, needsReview: lane.review.size, cooldownUntil: lane.cooldownUntil || null, typicalRenderSec: lane.typicalSeconds, etaSeconds: lane.review.size >= lane.concurrency ? null : Math.ceil((queued + lane.running.size + submitting) / lane.concurrency) * lane.typicalSeconds };
    });
  }

  saveSettings(lane) {
    this.settings.lanes[lane.lane.id] = { lane: { ...lane.lane }, concurrency: lane.concurrency, paused: lane.paused };
    try { this.onSettings(this.settings); }
    catch (error) { this.fatal(error); throw error; }
  }

  setLane(value, patch = {}) {
    const lane = this.ensureLane(value);
    if (patch.concurrency !== undefined) {
      if (!Number.isInteger(patch.concurrency) || patch.concurrency < 1 || patch.concurrency > 1000) throw actionError("invalidParams");
      lane.concurrency = patch.concurrency;
      lane.configuredConcurrency = true;
    }
    if (patch.action !== undefined && !["pause", "resume"].includes(patch.action)) throw actionError("invalidParams");
    if (patch.action === "pause") { lane.paused = true; lane.reason = "manual_pause"; }
    if (patch.action === "resume") { lane.paused = false; lane.reason = null; lane.errorCount = 0; lane.cooldownUntil = 0; }
    this.saveSettings(lane);
    this.kick();
    return this.laneList().find((item) => item.id === lane.lane.id);
  }

  keysChanged(value) {
    const lane = this.ensureLane(value);
    lane.needsKey = false;
    if (lane.reason === "auth") { lane.reason = null; lane.paused = false; }
    lane.errorCount = 0;
    for (const id of lane.running) this.due.set(id, 0);
    this.kick();
  }

  start() { if (!this.closed) { this.started = true; this.kick(); } return this; }

  kick() {
    if (!this.started || this.stopping || this.closed || this.pendingKick) return;
    this.pendingKick = true;
    queueMicrotask(() => {
      this.pendingKick = false;
      if (this.stopping || this.closed) return;
      try { this.pump(); } catch (error) { this.fatal(error); }
    });
  }

  consider(when) { if (Number.isFinite(when)) this.nextWake = Math.min(this.nextWake, Math.max(this.now() + 1, when)); }

  takeToken(lane) {
    if (!lane.rpm) return true;
    const now = this.now();
    lane.tokens = Math.min(lane.rpm, lane.tokens + Math.max(0, now - lane.tokenAt) * lane.rpm / 60000);
    lane.tokenAt = now;
    if (lane.tokens < 1) { this.consider(now + (1 - lane.tokens) * 60000 / lane.rpm); return false; }
    lane.tokens -= 1;
    return true;
  }

  budgetAllows(job) {
    const batch = this.store.batches.get(job.batchId);
    const alreadyChargedRetry = job.createAuthorization?.kind === "idempotent";
    if (batch && batch.state !== "active" && !(alreadyChargedRetry && batch.state === "paused" && batch.pauseReason === "budget")) return false;
    if (!batch?.budget) return true;
    const estimate = job.costEstimate;
    const budget = batch.budget;
    let spent = this.batchCosts.get(job.batchId)?.get(budget.currency) || 0;
    for (const reservation of this.reservations.values()) if (reservation.batchId === job.batchId && reservation.currency === budget.currency) spent += reservation.amount;
    const unknown = !Number.isFinite(estimate?.amount) || estimate.currency !== budget.currency;
    const additionalAmount = job.createAuthorization?.kind === "idempotent" ? 0 : estimate?.amount;
    if (unknown || spent + additionalAmount > budget.amount + 1e-8) {
      this.store.updateBatch(job.batchId, { state: "paused", pauseReason: unknown ? "budget_unknown" : "budget", costCommitted: spent });
      return false;
    }
    return true;
  }

  nextQueued(lane) {
    for (const id of lane.idempotent) {
      if (this.work.has(id)) continue;
      const due = this.due.get(id) || 0;
      if (due > this.now()) { this.consider(due); continue; }
      const job = this.store.get(id);
      if (this.budgetAllows(job)) return job;
    }
    for (const [batchId, ids] of lane.queued) {
      const batch = this.store.batches.get(batchId);
      if (batch && batch.state !== "active") continue;
      for (const id of ids) {
        if (this.work.has(id) || this.cancelling.has(id)) continue;
        const due = this.due.get(id) || 0;
        if (due > this.now()) { this.consider(due); continue; }
        const job = this.store.get(id);
        if (this.budgetAllows(job)) return job;
        break;
      }
    }
    return null;
  }

  pump() {
    if (this.store.failed || this.store.fd === undefined) throw actionError("storeClosed");
    if (this.timer !== null) { this.clearTimer(this.timer); this.timer = null; }
    this.nextWake = Infinity;
    for (const lane of this.lanes.values()) {
      const state = this.laneState(lane);
      if (state === "cooldown") { this.consider(lane.cooldownUntil); continue; }
      if (state === "needs_key" || state === "paused" && lane.reason !== "manual_pause") continue;
      for (const id of lane.running) {
        if (this.work.has(id) || this.cancelling.has(id)) continue;
        const due = this.due.get(id) || 0;
        if (due > this.now()) { this.consider(due); continue; }
        if (!this.takeToken(lane)) break;
        this.launch(this.store.get(id), "poll", lane);
      }
      if (state !== "active") continue;
      while (lane.inFlight.size + lane.preparing.size < lane.concurrency) {
        const job = this.nextQueued(lane);
        if (!job || !this.takeToken(lane)) break;
        lane.preparing.add(job.id);
        this.reservations.set(job.id, { batchId: job.batchId, currency: job.costEstimate?.currency, amount: job.createAuthorization?.kind === "idempotent" ? 0 : job.costEstimate?.amount || 0 });
        this.launch(job, "create", lane);
      }
    }
    let activeDownloads = [...this.work.values()].filter((entry) => entry.phase === "download").length;
    while (activeDownloads < this.downloadConcurrency) {
      let selected;
      for (const id of this.downloads) {
        if (this.work.has(id) || this.cancelling.has(id)) continue;
        const job = this.store.get(id);
        const lane = this.ensureLane(job);
        if (job.result?.needsAuth !== false && this.laneState(lane) !== "active" && !(this.laneState(lane) === "paused" && lane.reason === "manual_pause")) continue;
        const due = this.due.get(id) || 0;
        if (due > this.now()) { this.consider(due); continue; }
        if (!selected || time(job.resultExpiresAt) < time(selected.resultExpiresAt)) selected = job;
      }
      if (!selected) break;
      this.launch(selected, "download", this.ensureLane(selected));
      activeDownloads += 1;
    }
    if (Number.isFinite(this.nextWake)) {
      this.timer = this.setTimer(() => { this.timer = null; this.kick(); }, Math.min(2147483647, Math.max(1, this.nextWake - this.now())));
      this.timer?.unref?.();
    }
  }

  launch(job, phase, lane) {
    const controller = new AbortController();
    const entry = { phase, controller, promise: null };
    this.work.set(job.id, entry);
    entry.promise = Promise.resolve().then(() => this[phase](job.id, lane, controller.signal)).catch((error) => this.fatal(error)).finally(() => {
      this.work.delete(job.id);
      lane.preparing.delete(job.id);
      this.reservations.delete(job.id);
      this.kick();
    });
  }

  update(id, patch, options) {
    if (this.closed) return null;
    return this.store.update(id, patch, options);
  }

  error(job, category, extra = {}) {
    return { category, code: category, message: st(job.language || "zh", category), ...redact(extra) };
  }

  successful(lane, id, phase) {
    lane.errorCount = 0;
    lane.errorCategory = null;
    this.failures.delete(`${phase}:${id}`);
  }

  async create(id, lane, signal) {
    let job = this.store.get(id);
    const adapter = this.adapters[job.provider];
    let phase = "prepare";
    try {
      const ctx = this.context(job, "create");
      let cached = this.assetCache.get(id);
      if (cached && cached.expiresAt <= this.now()) cached = null;
      if (adapter.prepareAssets && !cached) {
        const refs = await adapter.prepareAssets(ctx, job, { signal });
        cached = { refs, expiresAt: Math.min(Infinity, ...[].concat(refs || []).map((item) => time(item?.expiresAt))) };
        this.assetCache.set(id, cached);
      }
      if (cached) ctx.remoteAssets = cached.refs;
      job = this.store.get(id);
      if (this.stopping || job.state !== "queued" || this.laneState(lane) !== "active") return;
      const batch = this.store.batches.get(job.batchId);
      // A budget stop may follow reservations already made in this pump. Those
      // reservations are included in the cap and may finish their first create.
      if (batch && batch.state !== "active" && !(batch.state === "paused" && ["budget", "budget_unknown"].includes(batch.pauseReason) && this.reservations.has(id))) return;
      phase = "create";
      lane.preparing.delete(id);
      this.reservations.delete(id);
      const charges = job.estimatedCharges ?? (job.attempts.create > 0 ? 1 : 0);
      const additionalCharge = job.createAuthorization?.kind === "idempotent" ? 0 : 1;
      job = this.update(id, { state: "submitting", attempts: { ...job.attempts, create: job.attempts.create + 1 }, estimatedCharges: charges + additionalCharge, submittingAt: new Date(this.now()).toISOString() }, { sync: true });
      const created = await adapter.create(ctx, job, { idempotencyKey: id, signal });
      if (!created?.remoteId) throw Object.assign(new Error("unknown_outcome"), { category: "unknown_outcome" });
      if (this.closed) return;
      // I2: no await may occur between receiving an ID and this durability barrier.
      job = this.update(id, { state: "running", remote: { id: created.remoteId, lastStatus: created.status || "running", ...(created.pollingUrl ? { pollingUrl: created.pollingUrl } : {}) }, startedAt: new Date(this.now()).toISOString() }, { sync: true });
      this.due.set(id, 0);
      this.successful(lane, id, "create");
      if (job.cancelRequested && adapter.cancel) queueMicrotask(() => this.cancelJob(id).catch((error) => this.fatal(error)));
    } catch (error) { this.handleFailure(id, lane, phase, error); }
  }

  async poll(id, lane, signal) {
    let job = this.store.get(id);
    const adapter = this.adapters[job.provider];
    try {
      const ctx = this.context(job, "poll");
      job = this.update(id, { attempts: { ...job.attempts, poll: job.attempts.poll + 1 } });
      const result = await adapter.poll(ctx, job, { signal });
      if (this.closed) return;
      job = this.store.get(id);
      if (job.state !== "running") return;
      this.applyPoll(job, lane, result);
      this.successful(lane, id, "poll");
    } catch (error) { this.handleFailure(id, lane, "poll", error); }
  }

  applyPoll(job, lane, polled) {
    if (!["queued", "running", "succeeded", "failed", "cancelled", "expired"].includes(polled?.status)) throw Object.assign(new Error("invalidProviderResponse"), { category: "transient" });
    const remote = { ...job.remote, lastStatus: polled.status };
    if (polled.status === "succeeded") {
      if (!polled.result?.url) throw Object.assign(new Error("invalidProviderResponse"), { category: "transient" });
      const ttl = job.modelConfig?.resultTtlHours;
      const expiresAt = polled.result.expiresAt || (ttl ? new Date(this.now() + ttl * 3600000).toISOString() : null);
      this.update(job.id, { state: "downloading", remote, result: polled.result, resultExpiresAt: expiresAt, progress: polled.progress || 100, renderedAt: new Date(this.now()).toISOString() }, { sync: true });
      this.due.set(job.id, 0);
      const elapsed = (this.now() - time(job.startedAt)) / 1000;
      if (Number.isFinite(elapsed) && elapsed > 0) lane.typicalSeconds = Math.round((lane.typicalSeconds * 0.8 + elapsed * 0.2) * 1000) / 1000;
    } else if (["failed", "cancelled", "expired"].includes(polled.status)) {
      const category = polled.status === "expired" ? "result_expired" : polled.error?.category || "invalid_request";
      this.update(job.id, { state: polled.status === "expired" ? "result_expired" : polled.status, remote, error: this.error(job, category, { phase: "poll", definitelyNotAccepted: false }), completedAt: new Date(this.now()).toISOString() }, { sync: true });
    } else {
      this.update(job.id, { remote, progress: Number.isFinite(polled.progress) ? polled.progress : job.progress || 0, error: null });
      const base = number(job.modelConfig?.pollIntervalSec, 10) * 1000;
      const elapsed = Math.max(0, this.now() - time(job.startedAt));
      const multiplier = Math.min(4, 1 + Math.floor(elapsed / 300000));
      this.due.set(job.id, this.now() + base * multiplier * (0.9 + this.random() * 0.2));
    }
  }

  async download(id, lane, signal) {
    let job = this.store.get(id);
    const adapter = this.adapters[job.provider];
    try {
      const ctx = this.context(job, "download");
      if (!job.result?.url) {
        job = this.update(id, { attempts: { ...job.attempts, poll: job.attempts.poll + 1 } });
        const polled = await adapter.poll(ctx, job, { signal });
        if (this.closed) return;
        if (polled.status === "expired") throw Object.assign(new Error("result_expired"), { category: "result_expired" });
        if (polled.status !== "succeeded" || !polled.result?.url) throw Object.assign(new Error("invalidProviderResponse"), { category: "transient" });
        job = this.update(id, { result: polled.result, resultExpiresAt: polled.result.expiresAt || job.resultExpiresAt }, { sync: true });
      }
      job = this.update(id, { attempts: { ...job.attempts, download: job.attempts.download + 1 } });
      const response = await adapter.download(ctx, job, job.result, { signal });
      if (this.closed) { await response?.body?.cancel?.(); return; }
      await this.writeOutput(response, job.targetPath, { jobId: id, signal, onPublished: (output) => {
        this.update(id, { state: "succeeded", output, progress: 100, error: null, completedAt: new Date(this.now()).toISOString() }, { sync: true });
      } });
      this.successful(lane, id, "download");
    } catch (error) { this.handleFailure(id, lane, "download", error); }
  }

  handleFailure(id, lane, phase, error) {
    if (this.closed || this.store.failed || this.store.fd === undefined) { if (!this.closed) this.fatal(error); return; }
    const job = this.store.get(id);
    if (!job || TERMINAL_STATES.has(job.state)) return;
    if (this.stopping && phase !== "create") return;
    const adapter = this.adapters[job.provider];
    let category = error.category || adapter.classifyError(error, phase === "prepare" ? "poll" : phase);
    if (phase === "prepare" && ["invalidAsset", "corruptAsset", "ENOENT"].includes(error.code)) category = "invalid_request";
    if (phase === "download" && time(job.resultExpiresAt) <= this.now() && [403, 404].includes(Number(error.status))) category = "result_expired";
    const definite = phase === "prepare" || error.accepted === false || ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(error.code) || ["rate_limited", "auth", "quota", "model_unavailable", "invalid_request", "moderation"].includes(category);
    if (phase === "create" && !definite && !adapter.supportsIdempotencyKey) {
      this.update(id, { state: "needs_review", error: this.error(job, "unknown_outcome", { phase, definitelyNotAccepted: false, reason: this.stopping ? "shutdown_during_create" : "unknown_create_response" }) }, { sync: true });
      return;
    }
    const count = (this.failures.get(`${phase}:${id}`) || 0) + 1;
    this.failures.set(`${phase}:${id}`, count);
    const delay = Number.isFinite(error.retryAfterMs) && error.retryAfterMs >= 0 ? error.retryAfterMs : Math.min(30000, 1000 * 2 ** Math.min(10, count - 1)) * (1 + this.random() * 0.2);
    const failure = this.error(job, category, { phase, definitelyNotAccepted: phase === "create" || phase === "prepare" ? definite : false });
    if (phase === "create" && (category === "unknown_outcome" || category === "transient" && !definite) && adapter.supportsIdempotencyKey) {
      this.update(id, { state: "queued", error: failure }, { sync: true, idempotentRetry: true });
      this.due.set(id, this.now() + delay);
      return;
    }
    if (["moderation", "invalid_request", "result_expired"].includes(category)) {
      this.update(id, { state: category === "result_expired" ? "result_expired" : "failed", error: failure, ...(phase === "create" && definite ? { estimatedCharges: Math.max(0, (job.estimatedCharges || 1) - 1) } : {}), completedAt: new Date(this.now()).toISOString() }, { sync: true });
      return;
    }
    if (phase === "create") {
      this.update(id, { state: "queued", error: failure, estimatedCharges: Math.max(0, (job.estimatedCharges || 1) - 1) }, { sync: true });
    } else this.update(id, { error: failure });
    this.due.set(id, this.now() + delay);
    if (category === "auth") { lane.needsKey = true; lane.reason = "auth"; }
    else if (["quota", "model_unavailable"].includes(category)) { lane.paused = true; lane.reason = category; this.saveSettings(lane); }
    else if (category === "rate_limited") { lane.cooldownUntil = Math.max(lane.cooldownUntil, this.now() + delay); lane.reason = "rate_limited"; }
    else {
      lane.errorCount = lane.errorCategory === category ? lane.errorCount + 1 : 1;
      lane.errorCategory = category;
      if (lane.errorCount >= this.circuitThreshold) { lane.paused = true; lane.reason = "circuit_open"; this.saveSettings(lane); }
    }
  }

  async cancelJob(id) {
    const job = this.store.get(id);
    if (!job) throw actionError("jobNotFound");
    if (TERMINAL_STATES.has(job.state)) return job;
    if (job.state === "needs_review") throw actionError("invalidTransition");
    if (job.state === "queued") return this.update(id, { state: "cancelled", completedAt: new Date(this.now()).toISOString() }, { sync: true });
    this.update(id, { cancelRequested: true }, { sync: true });
    const adapter = this.adapters[job.provider];
    if (adapter.cancel && job.state === "running") {
      if (this.cancelling.has(id)) return this.cancelling.get(id);
      const pending = Promise.resolve().then(async () => {
        try {
          await this.work.get(id)?.promise;
          let latest = this.store.get(id);
          if (this.closed || latest.state !== "running") return latest;
          await adapter.cancel(this.context(latest, "cancel"), latest);
          latest = this.store.get(id);
          if (!this.closed && latest.state === "running") this.update(id, { state: "cancelled", completedAt: new Date(this.now()).toISOString() }, { sync: true });
        } catch (error) { this.handleFailure(id, this.ensureLane(job), "poll", error); }
        finally { this.cancelling.delete(id); this.kick(); }
        return this.store.get(id);
      });
      this.cancelling.set(id, pending);
      return pending;
    }
    return this.store.get(id);
  }

  async jobAction(id, action, payload = {}) {
    const job = this.store.get(id);
    if (!job) throw actionError("jobNotFound");
    if (action === "cancel") return this.cancelJob(id);
    if (action === "retry") {
      if (job.state !== "failed" || !job.error?.definitelyNotAccepted || job.remote?.id) throw actionError("unsafeCreateRetry");
      this.update(id, { state: "queued" }, { sync: true });
      this.due.delete(id);
    } else if (action === "resolve") {
      if (job.state !== "needs_review") throw actionError("invalidTransition");
      if (payload.action === "abandon") return this.update(id, { state: "cancelled", completedAt: new Date(this.now()).toISOString() }, { sync: true });
      if (payload.action === "resubmit") this.update(id, { state: "queued" }, { sync: true, manualResubmit: true });
      else if (payload.action === "attach_remote_id") {
        if (typeof payload.remoteId !== "string" || !payload.remoteId || payload.remoteId.length > 512 || /[\s\x00-\x1f\x7f]/.test(payload.remoteId)) throw actionError("invalidRemoteId");
        this.update(id, { state: "running", remote: { id: payload.remoteId, lastStatus: "running" }, error: null, startedAt: new Date(this.now()).toISOString() }, { sync: true });
      } else throw actionError("invalidParams");
      this.due.delete(id);
    } else throw actionError("invalidParams");
    this.kick();
    return this.store.get(id);
  }

  async batchAction(id, action) {
    const batch = this.store.batches.get(id);
    if (!batch) throw actionError("batchNotFound");
    if (!["pause", "resume", "cancel"].includes(action)) throw actionError("invalidParams");
    this.store.updateBatch(id, { state: action === "pause" ? "paused" : action === "resume" ? "active" : "cancelled", pauseReason: action === "pause" ? "manual_pause" : null });
    if (action === "cancel") {
      for (const job of this.store.jobs.values()) if (job.batchId === id && job.state !== "needs_review" && !TERMINAL_STATES.has(job.state)) await this.cancelJob(job.id);
    }
    this.kick();
    return this.store.batches.get(id);
  }

  fatal(error) {
    if (this.fatalError) return;
    const code = ["storeClosed", "invalidStore"].includes(error.code) ? error.code : "storeWriteFailed";
    this.fatalError = { code, message: st("zh", code) };
    this.stopping = true;
    if (this.timer !== null) { this.clearTimer(this.timer); this.timer = null; }
    this.emit("fatal", this.fatalError);
  }

  async close(timeoutMs = 15000) {
    if (this.closed) return;
    this.stopping = true;
    if (this.timer !== null) { this.clearTimer(this.timer); this.timer = null; }
    for (const entry of this.work.values()) if (entry.phase !== "create") entry.controller.abort();
    let timeout;
    try {
      await Promise.race([
        Promise.allSettled([...this.work.values()].map((entry) => entry.promise)),
        new Promise((resolve) => { timeout = setTimeout(resolve, Math.max(0, timeoutMs)); }),
      ]);
    } finally { clearTimeout(timeout); }
    for (const [id, entry] of this.work) {
      entry.controller.abort();
      const job = this.store.get(id);
      if (entry.phase === "create" && job?.state === "submitting" && !job.remote?.id && !this.store.failed && this.store.fd !== undefined) {
        this.update(id, { state: "needs_review", error: this.error(job, "unknown_outcome", { phase: "create", definitelyNotAccepted: false, reason: "shutdown_during_create" }) }, { sync: true });
      }
    }
    this.closed = true;
    this.store.off("event", this.onStoreEvent);
    this.store.flush();
  }
}

module.exports = { Scheduler };
