const { EventEmitter } = require("node:events");
const { normalizeLane, redact, redactDiagnostics } = require("./keys");
const { TERMINAL_STATES, estimatedCharge } = require("./state");
const { writeOutput: defaultWriteOutput } = require("../files/output");
const { st } = require("../i18n/server-messages");
const { MAX_RETRY_AFTER_MS } = require("../providers/retry");

function actionError(code) { return Object.assign(new Error(code), { code }); }
function number(value, fallback) { return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback; }
function time(value) { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : Infinity; }

// Only failures known to happen before a connection is established make a
// create safe to retry. A reset or response timeout can still mean acceptance.
const LOCAL_OFFLINE_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "ENETDOWN", "EHOSTDOWN", "EADDRNOTAVAIL", "UND_ERR_CONNECT_TIMEOUT"]);
const FILESYSTEM_CODES = new Set(["EINVAL", "ENOSPC", "EDQUOT", "EACCES", "EPERM", "EROFS", "EMFILE", "ENFILE", "EIO", "ENAMETOOLONG", "ENOTDIR", "EISDIR", "ENOTSUP", "EOPNOTSUPP", "ENOENT", "EEXIST", "EXDEV", "EBADF"]);
function errorCode(error) { return String(error?.code || error?.cause?.code || ""); }
function diagnostics(error) {
  const details = {};
  if (errorCode(error)) details.providerCode = redactDiagnostics(errorCode(error)).slice(0, 256);
  if (typeof error?.message === "string" && error.message) details.providerMessage = redactDiagnostics(error.message).slice(0, 2048);
  if (Number.isInteger(Number(error?.status)) && Number(error.status) > 0) details.status = Number(error.status);
  return redact(details);
}

class Scheduler extends EventEmitter {
  constructor({ store, keys, adapters, context, settings = { lanes: {} }, onSettings = () => {}, writeOutput = defaultWriteOutput, now = Date.now, random = Math.random, setTimer = setTimeout, clearTimer = clearTimeout, downloadConcurrency = 3, circuitThreshold = 3, circuitCooldownMs = 30000, logger = console } = {}) {
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
    this.circuitCooldownMs = number(circuitCooldownMs, 30000);
    this.logger = logger;
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
    this.onStoreFailure = (error) => this.fatal(error);
    this.store.on("failure", this.onStoreFailure);
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

  cost(job) { return estimatedCharge(job); }

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
    if (job.state === "running") {
      lane.running.add(id);
      if (Number.isFinite(time(job.nextPollAt))) this.due.set(id, time(job.nextPollAt));
    }
    if (job.state === "needs_review") lane.review.add(id);
    if (job.state === "downloading") { this.downloads.add(id); lane.downloading.add(id); }
    if (TERMINAL_STATES.has(job.state)) {
      this.due.delete(id);
      for (const phase of ["create", "poll", "download"]) { this.failures.delete(`${phase}:${id}`); this.failures.delete(`${phase}:${id}:since`); }
    }
    // Prepared frame uploads are only reused by another create attempt.
    if (!["queued", "submitting"].includes(job.state)) this.assetCache.delete(id);
  }

  credentialsReady(lane) {
    const adapter = this.adapters[lane.lane.provider];
    const key = this.keys.get(lane.lane);
    return Boolean(adapter && !lane.needsKey && !(lane.requiresKey && !key) && adapter.validateKey(key || "") === null);
  }

  laneState(lane) {
    if (this.fatalError) return "paused";
    if (!this.credentialsReady(lane)) return "needs_key";
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
      return { ...lane.lane, lane: { ...lane.lane }, state, paused: lane.paused, pauseReason: lane.paused ? lane.reason : null, reason: this.fatalError?.code || (state === "needs_key" ? "needs_key" : state === "active" ? null : lane.reason), concurrency: lane.concurrency, inFlight: lane.inFlight.size + lane.preparing.size, queued, submitting, running: lane.running.size, downloading: lane.downloading.size, pending, waitingForKey: state === "needs_key" ? pending : 0, needsReview: lane.review.size, cooldownUntil: lane.cooldownUntil || null, typicalRenderSec: lane.typicalSeconds, etaSeconds: lane.review.size >= lane.concurrency ? null : Math.ceil((queued + lane.running.size + submitting) / lane.concurrency) * lane.typicalSeconds };
    });
  }

  saveSettings(lane) {
    this.settings.lanes[lane.lane.id] = { lane: { ...lane.lane }, concurrency: lane.concurrency, paused: lane.paused };
    try { this.onSettings(this.settings); }
    catch (error) { this.fatal(error); throw error; }
  }

  setLane(value, patch = {}) {
    if (patch.action === "resume") this.assertHealthy();
    const lane = this.ensureLane(value);
    if (patch.concurrency !== undefined) {
      if (!Number.isInteger(patch.concurrency) || patch.concurrency < 1 || patch.concurrency > 1000) throw actionError("invalidParams");
      lane.concurrency = patch.concurrency;
      lane.configuredConcurrency = true;
    }
    if (patch.action !== undefined && !["pause", "resume"].includes(patch.action)) throw actionError("invalidParams");
    if (patch.action === "pause") { lane.paused = true; lane.reason = "manual_pause"; }
    if (patch.action === "resume") { lane.paused = false; lane.reason = null; lane.errorCount = 0; lane.errorCategory = null; lane.cooldownUntil = 0; }
    this.saveSettings(lane);
    this.kick();
    return this.laneList().find((item) => item.id === lane.lane.id);
  }

  keysChanged(value) {
    const lane = this.ensureLane(value);
    const wasRejected = lane.needsKey || lane.reason === "auth";
    lane.needsKey = false;
    // A key only clears the authentication stop. A manual, quota or
    // model-access pause stays until the user resumes the lane.
    if (lane.reason === "auth") lane.reason = lane.paused ? "manual_pause" : null;
    lane.errorCount = 0;
    // Snapshot first: each update re-indexes the job (delete + add), and a Set
    // iterator would visit a re-added entry again, looping forever.
    if (wasRejected) for (const id of [...lane.running]) {
      if (this.store.get(id)?.nextPollAt) this.update(id, { nextPollAt: null });
      this.due.set(id, 0);
    }
    this.kick();
  }

  start() {
    if (this.closed) return this;
    // A cancel that was requested during a create whose rejection was recorded
    // just before a crash (or by 2.1.x) leaves a queued job carrying the flag.
    // Finish that cancel instead of dispatching or stranding the job.
    let changed = false;
    for (const job of [...this.store.jobs.values()]) {
      if (job.state !== "queued" || !job.cancelRequested) continue;
      this.update(job.id, { state: "cancelled", completedAt: new Date(this.now()).toISOString() }, { sync: false });
      changed = true;
    }
    if (changed) this.store.flush();
    this.started = true;
    this.kick();
    return this;
  }

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
    let spent = this.committed(job.batchId, budget.currency);
    for (const reservation of this.reservations.values()) if (reservation.batchId === job.batchId && reservation.currency === budget.currency) spent += reservation.amount;
    const unknown = !Number.isFinite(estimate?.amount) || estimate.currency !== budget.currency;
    const additionalAmount = job.createAuthorization?.kind === "idempotent" ? 0 : estimate?.amount;
    if (unknown || spent + additionalAmount > budget.amount + 1e-8) {
      this.store.updateBatch(job.batchId, { state: "paused", pauseReason: unknown ? "budget_unknown" : "budget", costCommitted: spent });
      return false;
    }
    return true;
  }

  // Estimated charges of the batch's current jobs plus charges of finished
  // takes removed by "Clear history"; deleting records never refunds a budget.
  committed(batchId, currency) {
    const cleared = Number(this.store.batches.get(batchId)?.clearedCharges?.[currency]);
    return (this.batchCosts.get(batchId)?.get(currency) || 0) + (Number.isFinite(cleared) && cleared > 0 ? cleared : 0);
  }

  // Remaining budget for one more explicitly confirmed take, or null if none.
  budgetCheck(batchId, cost) {
    const batch = this.store.batches.get(batchId);
    if (!batch?.budget) return { ok: true };
    if (!Number.isFinite(cost?.amount) || cost.currency !== batch.budget.currency) return { ok: false, reason: "budget_unknown" };
    let spent = this.committed(batchId, batch.budget.currency);
    for (const reservation of this.reservations.values()) if (reservation.batchId === batchId && reservation.currency === batch.budget.currency) spent += reservation.amount;
    // Queued work in the same batch dispatches first; a new take that only
    // fits after it would wait behind a budget pause forever.
    for (const ids of [...this.lanes.values()].map((lane) => lane.queued.get(batchId)).filter(Boolean)) {
      for (const queuedId of ids) {
        if (this.reservations.has(queuedId)) continue;
        const queued = this.store.get(queuedId);
        if (queued?.cancelRequested || queued?.createAuthorization?.kind === "idempotent") continue;
        if (queued?.costEstimate?.currency !== batch.budget.currency || !Number.isFinite(queued.costEstimate.amount)) return { ok: false, reason: "budget_unknown" };
        spent += queued.costEstimate.amount;
      }
    }
    return spent + cost.amount > batch.budget.amount + 1e-8 ? { ok: false, reason: "budget", spent, budget: batch.budget } : { ok: true };
  }

  nextQueued(lane) {
    for (const id of lane.idempotent) {
      if (this.work.has(id) || this.store.get(id)?.cancelRequested) continue;
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
        if (job.cancelRequested) continue;
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
      if (state === "cooldown") this.consider(lane.cooldownUntil);
      if (!this.credentialsReady(lane)) continue;
      // Submission stops never abandon a paid render. Polls retain their own
      // backoff and RPM limit even during a pause or circuit cooldown.
      for (const id of lane.running) {
        if (this.work.has(id) || this.cancelling.has(id)) continue;
        const due = this.due.get(id) || 0;
        if (due > this.now()) { this.consider(due); continue; }
        if (!this.takeToken(lane)) break;
        this.launch(this.store.get(id), "poll", lane);
      }
      if (state !== "active" || lane.circuitProbe) continue;
      const probing = lane.reason === "circuit_open";
      while (lane.inFlight.size + lane.preparing.size < lane.concurrency) {
        const job = this.nextQueued(lane);
        if (!job || !this.takeToken(lane)) break;
        lane.preparing.add(job.id);
        this.reservations.set(job.id, { batchId: job.batchId, currency: job.costEstimate?.currency, amount: job.createAuthorization?.kind === "idempotent" ? 0 : job.costEstimate?.amount || 0 });
        if (probing) lane.circuitProbe = job.id;
        this.launch(job, "create", lane);
        if (probing) break;
      }
    }
    let activeDownloads = [...this.work.values()].filter((entry) => entry.phase === "download").length;
    while (activeDownloads < this.downloadConcurrency) {
      let selected;
      for (const id of this.downloads) {
        if (this.work.has(id) || this.cancelling.has(id)) continue;
        const job = this.store.get(id);
        const lane = this.ensureLane(job);
        if (job.result?.needsAuth !== false && !this.credentialsReady(lane)) continue;
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
      if (lane.circuitProbe === job.id) lane.circuitProbe = null;
      this.reservations.delete(job.id);
      this.kick();
    });
  }

  update(id, patch, options) {
    if (this.closed) return null;
    return this.store.update(id, patch, options);
  }

  error(job, category, extra = {}) {
    const details = redact(extra);
    const summary = st(job.language || "zh", category);
    const detail = [details.providerCode, details.providerMessage].filter((value) => value && value !== category).join(": ");
    return { category, code: category, message: detail ? `${summary} (${detail})` : summary, ...details };
  }

  successful(lane, id, phase) {
    lane.errorCount = 0;
    lane.errorCategory = null;
    if (lane.reason === "local_offline" || lane.reason === "circuit_open" && lane.cooldownUntil <= this.now()) { lane.reason = null; lane.cooldownUntil = 0; }
    this.failures.delete(`${phase}:${id}`);
    this.failures.delete(`${phase}:${id}:since`);
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

  nextPollTime(job) {
    const base = number(job.modelConfig?.pollIntervalSec, 10) * 1000;
    const elapsed = Math.max(0, this.now() - time(job.startedAt));
    const multiplier = Math.min(4, 1 + Math.floor(elapsed / 300000));
    // This is the earliest next dispatch, measured from request start. A slow
    // response may overrun it, but work.has(id) still prevents overlapping polls.
    return this.now() + base * multiplier * (0.9 + this.random() * 0.2);
  }

  recordPollingUrl(id, pollingUrl) {
    const job = this.store.get(id);
    if (this.closed || !job || !["running", "downloading"].includes(job.state) || !pollingUrl || pollingUrl === job.remote?.pollingUrl) return;
    if (typeof pollingUrl !== "string") throw Object.assign(actionError("invalidProviderResponse"), { category: "transient" });
    this.update(id, { remote: { ...job.remote, pollingUrl } }, { sync: true });
  }

  async poll(id, lane, signal) {
    let job = this.store.get(id);
    const adapter = this.adapters[job.provider];
    try {
      const ctx = this.context(job, "poll");
      if (signal.aborted || this.stopping) return;
      const nextPollAt = new Date(this.nextPollTime(job)).toISOString();
      // Count only dispatches, and keep the cadence recoverable even if this
      // process dies while awaiting the read-only provider response.
      job = this.update(id, { attempts: { ...job.attempts, poll: job.attempts.poll + 1 }, nextPollAt });
      const result = await adapter.poll(ctx, job, { signal, onRemote: (remote) => this.recordPollingUrl(id, remote?.pollingUrl) });
      if (this.closed) return;
      job = this.store.get(id);
      if (job.state !== "running") return;
      this.applyPoll(job, lane, result);
      this.successful(lane, id, "poll");
    } catch (error) { this.handleFailure(id, lane, "poll", error); }
  }

  applyPoll(job, lane, polled) {
    if (!["queued", "running", "succeeded", "failed", "cancelled", "expired"].includes(polled?.status)) throw Object.assign(new Error("invalidProviderResponse"), { category: "transient" });
    const remote = { ...job.remote, lastStatus: polled.status, ...(polled.pollingUrl ? { pollingUrl: polled.pollingUrl } : {}) };
    if (polled.status === "succeeded") {
      if (!polled.result?.url) throw Object.assign(new Error("invalidProviderResponse"), { category: "transient" });
      const ttl = job.modelConfig?.resultTtlHours;
      const expiresAt = polled.result.expiresAt || (ttl ? new Date(this.now() + ttl * 3600000).toISOString() : null);
      this.update(job.id, { state: "downloading", remote, nextPollAt: null, result: polled.result, resultExpiresAt: expiresAt, progress: polled.progress || 100, renderedAt: new Date(this.now()).toISOString() }, { sync: true });
      this.due.set(job.id, 0);
      const elapsed = (this.now() - time(job.startedAt)) / 1000;
      if (Number.isFinite(elapsed) && elapsed > 0) lane.typicalSeconds = Math.round((lane.typicalSeconds * 0.8 + elapsed * 0.2) * 1000) / 1000;
    } else if (["failed", "cancelled", "expired"].includes(polled.status)) {
      const category = polled.status === "expired" ? "result_expired" : polled.error?.category || "invalid_request";
      this.update(job.id, { state: polled.status === "expired" ? "result_expired" : polled.status, remote, nextPollAt: null, error: this.error(job, category, { ...diagnostics(polled.error), phase: "poll", definitelyNotAccepted: false }), completedAt: new Date(this.now()).toISOString() }, { sync: true });
    } else {
      const progress = Number.isFinite(polled.progress) ? polled.progress : job.progress || 0;
      const remoteChanged = remote.lastStatus !== job.remote.lastStatus || remote.pollingUrl !== job.remote.pollingUrl;
      if (remoteChanged || progress !== (job.progress || 0) || job.error) {
        this.update(job.id, { remote, progress, error: null }, { sync: remote.pollingUrl !== job.remote.pollingUrl });
      }
      this.due.set(job.id, Number.isFinite(time(job.nextPollAt)) ? time(job.nextPollAt) : this.nextPollTime(job));
    }
  }

  async download(id, lane, signal) {
    let job = this.store.get(id);
    const adapter = this.adapters[job.provider];
    try {
      const ctx = this.context(job, "download");
      if (!job.result?.url) {
        job = this.update(id, { attempts: { ...job.attempts, poll: job.attempts.poll + 1 } });
        const polled = await adapter.poll(ctx, job, { signal, onRemote: (remote) => this.recordPollingUrl(id, remote?.pollingUrl) });
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
    const sourceCode = errorCode(error);
    const status = Number(error.status);
    let category = error.category || adapter.classifyError(error, phase === "prepare" ? "poll" : phase);
    const localOffline = !status && LOCAL_OFFLINE_CODES.has(sourceCode);
    if (localOffline) category = "local_offline";
    if (!status && FILESYSTEM_CODES.has(sourceCode)) category = "output_write_failed";
    if (phase === "prepare" && ["invalidAsset", "corruptAsset", "ENOENT"].includes(error.code)) category = "invalid_request";
    // A presigned result URL never received credentials, so its 401/403 says
    // nothing about the lane key; it usually means the link expired.
    const unauthenticatedDownload = phase === "download" && job.result?.needsAuth === false;
    if (unauthenticatedDownload && category === "auth") category = "transient";
    if (phase === "download" && time(job.resultExpiresAt) <= this.now() && status >= 400 && status < 500 && status !== 429) category = "result_expired";
    const key = `${phase}:${id}`;
    const count = (this.failures.get(key) || 0) + 1;
    this.failures.set(key, count);
    // After an accepted create, an HTTP 4xx from polling or downloading must
    // not discard a paid render: retry with backoff. Quota, auth, rate-limit
    // and model-access categories keep their lane handling and never end the
    // job. Local safety rejections without an HTTP status (for example an
    // unsafe result URL) stay terminal, as before.
    const accepted = ["poll", "download"].includes(phase);
    if (accepted && status >= 400 && status < 500 && ["invalid_request", "moderation"].includes(category)) category = "transient";
    // Only an uninterrupted streak of "not found / gone" answers lasting 15
    // minutes stops tracking; any other failure restarts the streak.
    const gone = accepted && category === "transient" && ([404, 410].includes(status) || unauthenticatedDownload && [401, 403].includes(status));
    if (gone) {
      const streak = this.failures.get(`${key}:since`) || { at: this.now(), count: 0 };
      streak.count += 1;
      this.failures.set(`${key}:since`, streak);
      if (streak.count >= 6 && this.now() - streak.at >= 15 * 60000) category = phase === "poll" ? "remote_not_found" : "result_expired";
    } else this.failures.delete(`${key}:since`);
    const definite = phase === "prepare" || error.accepted === false || localOffline || ["rate_limited", "auth", "quota", "model_unavailable", "invalid_request", "moderation"].includes(category);
    if (phase === "create" && !definite && !adapter.supportsIdempotencyKey) {
      this.log("warn", "create_needs_review", { jobId: id, phase, category, ...diagnostics(error) });
      this.update(id, { state: "needs_review", error: this.error(job, "unknown_outcome", { ...diagnostics(error), phase, definitelyNotAccepted: false, reason: this.stopping ? "shutdown_during_create" : "unknown_create_response" }) }, { sync: true });
      return;
    }
    const retryAfter = Number.isFinite(error.retryAfterMs) && error.retryAfterMs >= 0 ? Math.min(MAX_RETRY_AFTER_MS, error.retryAfterMs) : null;
    const delay = retryAfter ?? Math.min(30000, 1000 * 2 ** Math.min(10, count - 1)) * (1 + this.random() * 0.2);
    const failure = this.error(job, category, { ...diagnostics(error), phase, definitelyNotAccepted: phase === "create" || phase === "prepare" ? definite : false });
    if (count === 1 || (count & (count - 1)) === 0) this.log("warn", "job_retry", { jobId: id, phase, category, attempt: count, ...diagnostics(error) });
    if (phase === "create" && (category === "unknown_outcome" || category === "transient" && !definite) && adapter.supportsIdempotencyKey) {
      this.update(id, { state: "queued", error: failure }, { sync: true, idempotentRetry: true });
      this.due.set(id, this.now() + delay);
      return;
    }
    if (["moderation", "invalid_request", "result_expired", "remote_not_found"].includes(category)) {
      this.update(id, { state: category === "result_expired" ? "result_expired" : "failed", nextPollAt: null, error: failure, ...(phase === "create" && definite ? { estimatedCharges: Math.max(0, (job.estimatedCharges || 1) - 1) } : {}), completedAt: new Date(this.now()).toISOString() }, { sync: true });
      return;
    }
    if (phase === "create") {
      const released = Math.max(0, (job.estimatedCharges || 1) - 1);
      if (job.cancelRequested) {
        // The user cancelled while this create was in flight and the provider
        // definitely rejected it: honor the cancel instead of creating again.
        this.update(id, { state: "queued", error: failure, estimatedCharges: released });
        this.update(id, { state: "cancelled", completedAt: new Date(this.now()).toISOString() }, { sync: true });
        this.applyLaneFailure(lane, category, delay);
        return;
      }
      this.update(id, { state: "queued", error: failure, estimatedCharges: released }, { sync: true });
    } else this.update(id, { error: failure, ...(phase === "poll" ? { nextPollAt: new Date(this.now() + delay).toISOString() } : {}) });
    this.due.set(id, this.now() + delay);
    this.applyLaneFailure(lane, category, delay);
  }

  applyLaneFailure(lane, category, delay) {
    if (category === "auth") { lane.needsKey = true; if (!lane.paused) lane.reason = "auth"; }
    else if (["quota", "model_unavailable"].includes(category)) { lane.paused = true; lane.reason = category; this.saveSettings(lane); }
    else if (category === "output_write_failed") {
      // The paid result stays downloadable. A full or unwritable local disk is
      // not a provider outage and must not suspend unrelated rendering.
    }
    else if (category === "local_offline") { lane.cooldownUntil = Math.max(lane.cooldownUntil, this.now() + delay); if (!lane.paused) lane.reason = "local_offline"; }
    else if (category === "rate_limited") { lane.cooldownUntil = Math.max(lane.cooldownUntil, this.now() + delay); if (!lane.paused) lane.reason = "rate_limited"; }
    else {
      lane.errorCount = lane.errorCategory === category ? lane.errorCount + 1 : 1;
      lane.errorCategory = category;
      if (lane.errorCount >= this.circuitThreshold) {
        lane.cooldownUntil = Math.max(lane.cooldownUntil, this.now() + this.circuitCooldownMs);
        if (!lane.paused) lane.reason = "circuit_open";
      }
    }
  }

  async cancelJob(id, { sync = true } = {}) {
    const job = this.store.get(id);
    if (!job) throw actionError("jobNotFound");
    if (TERMINAL_STATES.has(job.state)) return job;
    if (job.state === "needs_review") throw actionError("invalidTransition");
    if (job.state === "queued") return this.update(id, { state: "cancelled", completedAt: new Date(this.now()).toISOString() }, { sync });
    if (job.cancelRequested) return this.cancelling.get(id) || job;
    this.update(id, { cancelRequested: true }, { sync });
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
    if (this.store.batches.get(job.batchId)?.state === "preparing") throw actionError("batchPreparing");
    if (action === "retry" || action === "resolve" && payload.action === "resubmit") this.assertHealthy();
    if (action === "cancel") return this.cancelJob(id);
    if (action === "retry") {
      if (job.state !== "failed" || !job.error?.definitelyNotAccepted || job.remote?.id) throw actionError("unsafeCreateRetry");
      this.update(id, { state: "queued", cancelRequested: false }, { sync: true });
      this.reopenBatch(job.batchId);
      this.due.delete(id);
    } else if (action === "resolve") {
      // Abandoning a running job only stops local tracking (for example a
      // mistyped attached ID or a task deleted at the provider). It neither
      // cancels nor refunds remote work.
      if (payload.action === "abandon" && ["running", "downloading"].includes(job.state)) {
        this.due.delete(id);
        // Stop an in-flight poll or transfer; its late result is ignored.
        this.work.get(id)?.controller.abort(Object.assign(new Error("abandoned"), { name: "AbortError" }));
        return this.update(id, { state: "cancelled", nextPollAt: null, abandoned: true, completedAt: new Date(this.now()).toISOString() }, { sync: true });
      }
      if (job.state !== "needs_review") throw actionError("invalidTransition");
      if (payload.action === "abandon") return this.update(id, { state: "cancelled", abandoned: true, completedAt: new Date(this.now()).toISOString() }, { sync: true });
      if (payload.action === "resubmit") { this.update(id, { state: "queued", cancelRequested: false }, { sync: true, manualResubmit: true }); this.reopenBatch(job.batchId); }
      else if (payload.action === "attach_remote_id") {
        if (typeof payload.remoteId !== "string" || !payload.remoteId || payload.remoteId.length > 512 || /[\s\x00-\x1f\x7f]/.test(payload.remoteId)) throw actionError("invalidRemoteId");
        if (redact(payload.remoteId) !== payload.remoteId) throw actionError("invalidRemoteId");
        const remoteError = this.adapters[job.provider].validateRemoteId?.(payload.remoteId, job);
        if (remoteError) throw actionError(remoteError);
        this.update(id, { state: "running", remote: { id: payload.remoteId, lastStatus: "running" }, error: null, cancelRequested: false, startedAt: new Date(this.now()).toISOString() }, { sync: true });
      } else throw actionError("invalidParams");
      this.due.delete(id);
    } else throw actionError("invalidParams");
    this.kick();
    return this.store.get(id);
  }

  // An explicit retry or resubmit inside a cancelled batch would otherwise be
  // accepted but never dispatched, because cancelled batches are skipped.
  reopenBatch(batchId) {
    if (this.store.batches.get(batchId)?.state === "cancelled") this.store.updateBatch(batchId, { state: "active", pauseReason: null });
  }

  async batchAction(id, action) {
    const batch = this.store.batches.get(id);
    if (!batch) throw actionError("batchNotFound");
    if (batch.state === "preparing") throw actionError("batchPreparing");
    if (action === "resume") this.assertHealthy();
    if (!["pause", "resume", "cancel"].includes(action)) throw actionError("invalidParams");
    this.store.updateBatch(id, { state: action === "pause" ? "paused" : action === "resume" ? "active" : "cancelled", pauseReason: action === "pause" ? "manual_pause" : null });
    if (action === "cancel") {
      // Cancel every queued job synchronously (no interleaved retry or resume
      // can reactivate the batch midway) behind one durability barrier, then
      // request cancellation of in-flight work.
      const jobs = [...this.store.jobs.values()].filter((job) => job.batchId === id && job.state !== "needs_review" && !TERMINAL_STATES.has(job.state));
      const completedAt = new Date(this.now()).toISOString();
      for (const job of jobs) if (job.state === "queued") this.update(job.id, { state: "cancelled", completedAt }, { sync: false });
      this.store.flush();
      await Promise.all(jobs.filter((job) => job.state !== "queued").map((job) => this.cancelJob(job.id)));
    }
    this.kick();
    return this.store.batches.get(id);
  }

  log(level, event, details) {
    try { this.logger?.[level]?.(JSON.stringify({ time: new Date(this.now()).toISOString(), event, ...redact(details) })); }
    catch { /* A diagnostic sink must never interrupt paid work. */ }
  }

  health() {
    return { healthy: !this.fatalError && !this.stopping && !this.closed && !this.store.failed && this.store.fd !== undefined,
      state: this.fatalError ? "failed" : this.closed ? "closed" : this.stopping ? "stopping" : this.started ? "running" : "idle",
      ...(this.fatalError ? { error: { ...this.fatalError } } : {}) };
  }

  assertHealthy() {
    if (!this.health().healthy) throw Object.assign(actionError(this.fatalError?.code || (this.store.failed || this.store.fd === undefined ? "storeClosed" : "serviceStopping")), { status: 503 });
  }

  fatal(error) {
    if (this.fatalError) return;
    const code = ["storeClosed", "invalidStore", "storeWriteFailed"].includes(error?.code) ? error.code : this.store.failed || FILESYSTEM_CODES.has(errorCode(error)) ? "storeWriteFailed" : "schedulerFailed";
    this.fatalError = { code, message: st("zh", code), ...diagnostics(error) };
    this.log("error", "scheduler_fatal", { ...this.fatalError, name: error?.name, stack: redactDiagnostics(error?.stack) });
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
    this.store.off("failure", this.onStoreFailure);
    this.store.flush();
  }
}

module.exports = { Scheduler };
