const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { dataDirectory } = require("../config");
const { redact } = require("../queue/keys");
const { validateJob, assertTransition, recoveryPatch, TERMINAL_STATES } = require("../queue/state");
const { InstanceLock, pidAlive } = require("./lock");

function storeError(code = "invalidStore") {
  return Object.assign(new Error(code), { code });
}

function privateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function syncDirectory(directory) {
  if (process.platform === "win32") return;
  const fd = fs.openSync(directory, "r");
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

function writeAll(fd, text) {
  const buffer = Buffer.from(text);
  let offset = 0;
  while (offset < buffer.length) {
    const count = fs.writeSync(fd, buffer, offset, buffer.length - offset);
    if (count < 1) throw storeError("storeWriteFailed");
    offset += count;
  }
}

class JobStore extends EventEmitter {
  constructor(directory = dataDirectory(), { port = 0, lock = true, onCheckpoint = () => {}, recover = true, supportsIdempotencyKey = () => false } = {}) {
    super();
    this.directory = directory;
    this.jobs = new Map();
    this.batches = new Map();
    this.seq = 0;
    this.onCheckpoint = onCheckpoint;
    this.lockPath = path.join(directory, "lock");
    privateDirectory(directory);
    try {
      if (lock) this.acquireLock(port);
      this.replay();
      this.fd = fs.openSync(path.join(directory, "jobs.ndjson"), "a", 0o600);
      fs.fchmodSync(this.fd, 0o600);
      if (recover) {
        for (const job of this.jobs.values()) {
          const idempotentRetry = typeof supportsIdempotencyKey === "function" ? Boolean(supportsIdempotencyKey(job)) : Boolean(supportsIdempotencyKey);
          const patch = recoveryPatch(job, { supportsIdempotencyKey: idempotentRetry });
          if (patch) this.update(job.id, patch, { sync: true, idempotentRetry });
        }
      }
    } catch (error) {
      if (this.fd !== undefined) { fs.closeSync(this.fd); this.fd = undefined; }
      this.releaseLock();
      throw error;
    }
  }

  acquireLock(port) {
    this.instanceLock = new InstanceLock(this.directory, port, (name, value) => this.checkpoint(name, value));
    this.instanceLock.acquire();
  }

  checkpoint(name, value) { this.onCheckpoint(name, value); }

  replay() {
    const snapshot = path.join(this.directory, "jobs.snapshot.json");
    if (fs.existsSync(snapshot)) {
      const data = JSON.parse(fs.readFileSync(snapshot, "utf8"));
      if (data.v !== 1 || !Number.isSafeInteger(data.seq) || data.seq < 0 || !Array.isArray(data.jobs) || !Array.isArray(data.batches || [])) throw storeError();
      this.seq = data.seq;
      for (const job of data.jobs) {
        validateJob(job);
        if (this.jobs.has(job.id)) throw storeError();
        this.jobs.set(job.id, freeze(job));
      }
      for (const batch of data.batches || []) {
        if (!batch || typeof batch.id !== "string" || !batch.id || this.batches.has(batch.id)) throw storeError();
        this.batches.set(batch.id, freeze(batch));
      }
      fs.chmodSync(snapshot, 0o600);
    }
    const logPath = path.join(this.directory, "jobs.ndjson");
    if (!fs.existsSync(logPath)) return;
    const data = fs.readFileSync(logPath);
    const end = data.lastIndexOf(10) + 1;
    let previousSeq = 0;
    for (const line of data.subarray(0, end).toString("utf8").split("\n")) {
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.v !== 1 || !Number.isSafeInteger(event.seq) || event.seq < 1 || event.seq <= previousSeq || typeof event.jobId !== "string" || !event.jobId || !["job", "batch", "delete", "delete_batch"].includes(event.type)) throw storeError();
      previousSeq = event.seq;
      if (event.seq <= this.seq) continue;
      if (event.seq !== this.seq + 1) throw storeError();
      this.apply(event);
    }
    if (end !== data.length) {
      const fd = fs.openSync(logPath, "r+");
      try { fs.ftruncateSync(fd, end); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
  }

  apply(event) {
    const { v, seq, at, jobId, type, ...patch } = event;
    if (type === "delete") this.jobs.delete(jobId);
    else if (type === "delete_batch") this.batches.delete(jobId);
    else if (type === "batch") this.batches.set(jobId, freeze({ ...this.batches.get(jobId), ...patch, id: jobId }));
    else {
      const job = { ...this.jobs.get(jobId), ...patch, id: jobId, updatedAt: at };
      validateJob(job);
      this.jobs.set(jobId, freeze(job));
    }
    this.seq = seq;
  }

  append(jobId, type, patch = {}, options = {}) {
    if (this.fd === undefined || this.failed) throw storeError("storeClosed");
    if (typeof jobId !== "string" || !jobId || !["job", "batch", "delete", "delete_batch"].includes(type) || !patch || typeof patch !== "object" || Array.isArray(patch)) throw storeError();
    if (["v", "seq", "at", "jobId", "type"].some((name) => Object.hasOwn(patch, name)) || patch.id !== undefined && patch.id !== jobId) throw storeError();
    let safePatch = redact(patch);
    const previous = this.jobs.get(jobId);
    if (type === "job") {
      if (safePatch.state === "submitting" && (previous?.state !== "submitting" || safePatch.attempts?.create > previous.attempts.create)) {
        safePatch = { ...safePatch, error: null, createAuthorization: null };
      }
      if (safePatch.state === "queued" && previous && (options.manualResubmit || options.idempotentRetry)) {
        safePatch = { ...safePatch, createAuthorization: { kind: options.manualResubmit ? "manual" : "idempotent", afterAttempt: previous.attempts.create, ...(options.idempotentRetry ? { idempotencyKey: jobId } : {}) } };
      }
      assertTransition(previous, { ...previous, ...safePatch, id: jobId }, options);
    }
    const event = freeze({ ...safePatch, v: 1, seq: this.seq + 1, at: new Date().toISOString(), jobId, type });
    const forceSync = type === "job" && (safePatch.state === "submitting" || safePatch.remote?.id && safePatch.remote.id !== previous?.remote?.id);
    try {
      writeAll(this.fd, `${JSON.stringify(event)}\n`);
      this.checkpoint("append:written", event);
      if (options.sync || forceSync) {
        fs.fsyncSync(this.fd);
        this.checkpoint("append:fsynced", event);
      }
    } catch (error) { this.failed = true; throw error; }
    this.apply(event);
    this.emit("event", event);
    return type === "batch" ? this.batches.get(jobId) : this.jobs.get(jobId);
  }

  add(job, { sync = true } = {}) {
    if (this.jobs.has(job.id)) throw storeError("jobExists");
    return this.append(job.id, "job", job, { sync });
  }

  addMany(jobs) {
    const ids = new Set();
    for (const job of jobs) {
      if (this.jobs.has(job.id) || ids.has(job.id)) throw storeError("jobExists");
      assertTransition(null, job);
      ids.add(job.id);
    }
    const added = jobs.map((job) => this.add(job, { sync: false }));
    this.flush();
    return added;
  }

  update(id, patch, options) {
    if (!this.jobs.has(id)) throw storeError("jobNotFound");
    return this.append(id, "job", patch, options);
  }

  updateBatch(id, patch, { sync = true } = {}) { return this.append(id, "batch", patch, { sync }); }
  get(id) { return this.jobs.get(id); }

  list({ batch, state, cursor, limit = 50 } = {}) {
    const count = Math.max(1, Math.min(500, Number(limit) || 50));
    const rows = [];
    let started = !cursor;
    for (const job of this.jobs.values()) {
      if (!started) { if (job.id === cursor) started = true; continue; }
      if (batch && job.batchId !== batch || state && job.state !== state) continue;
      rows.push(job);
      if (rows.length > count) break;
    }
    const hasMore = rows.length > count;
    if (hasMore) rows.pop();
    return { jobs: rows, nextCursor: hasMore ? rows.at(-1).id : null, seq: this.seq };
  }

  clearHistory() {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (!TERMINAL_STATES.has(job.state)) continue;
      this.append(job.id, "delete", {});
      count += 1;
    }
    const remainingBatches = new Set([...this.jobs.values()].map((job) => job.batchId));
    for (const id of this.batches.keys()) if (!remainingBatches.has(id)) this.append(id, "delete_batch", {});
    this.compact();
    return count;
  }

  compact() {
    if (this.fd === undefined || this.failed) throw storeError("storeClosed");
    try {
      const target = path.join(this.directory, "jobs.snapshot.json");
      const temporary = `${target}.tmp`;
      const fd = fs.openSync(temporary, "w", 0o600);
      try {
        fs.fchmodSync(fd, 0o600);
        this.checkpoint("compact:opened");
        writeAll(fd, JSON.stringify({ v: 1, seq: this.seq, jobs: [...this.jobs.values()], batches: [...this.batches.values()] }));
        this.checkpoint("compact:written");
        fs.fsyncSync(fd);
        this.checkpoint("compact:fsynced");
      } finally { fs.closeSync(fd); }
      fs.renameSync(temporary, target);
      this.checkpoint("compact:renamed");
      syncDirectory(this.directory);
      this.checkpoint("compact:directorySynced");
      fs.ftruncateSync(this.fd, 0);
      this.checkpoint("compact:truncated");
      this.flush();
      this.checkpoint("compact:logSynced");
    } catch (error) { this.failed = true; throw error; }
  }

  flush() {
    if (this.fd === undefined) return;
    try { fs.fsyncSync(this.fd); }
    catch (error) { this.failed = true; throw error; }
  }
  releaseLock() { this.instanceLock?.release(); }
  close() {
    try {
      if (this.fd !== undefined) {
        const fd = this.fd;
        this.fd = undefined;
        try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      }
    } finally { this.releaseLock(); }
  }
}

module.exports = { JobStore, privateDirectory, pidAlive, syncDirectory };
