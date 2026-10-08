const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { readRecords, snapshotRecords } = require("./records");
const { EventEmitter } = require("node:events");
const { dataDirectory } = require("../config");
const { sanitizeRecord } = require("../queue/keys");
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

// Windows scanners may briefly hold the destination. Keep this bounded and
// synchronous: appends must not run between copying the tail and reopening it.
function replaceFile(source, destination) {
  const delays = [10, 20, 40, 80, 160];
  for (let attempt = 0; ; attempt += 1) {
    try { return fs.renameSync(source, destination); }
    catch (error) {
      if (!["EPERM", "EBUSY"].includes(error.code) || attempt >= delays.length) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delays[attempt]);
    }
  }
}

function busy(error) { return ["EPERM", "EBUSY"].includes(error.code); }

// Only use before changing the journal. An unsuccessful snapshot replacement
// leaves the original append handle and every durable record intact.
function replaceSnapshot(source, destination) {
  try { replaceFile(source, destination); }
  catch (error) {
    if (busy(error)) error.compactionRetryAllowed = true;
    throw error;
  }
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
  constructor(directory = dataDirectory(), { port = 0, lock = true, onCheckpoint = () => {}, recover = true, validatePersisted = () => {}, supportsIdempotencyKey = () => false, compactBytes = 16 * 1024 * 1024, compactEvents = 20000 } = {}) {
    super();
    this.directory = directory;
    this.jobs = new Map();
    this.batches = new Map();
    this.seq = 0;
    this.models = new Map();
    this.modelHashes = new Map();
    this.modelIds = new WeakMap();
    this.persistedModels = new Set();
    this.compactBytes = compactBytes;
    this.compactEvents = compactEvents;
    this.logBytes = 0;
    this.eventsSinceCompact = 0;
    this.onCheckpoint = onCheckpoint;
    this.lockPath = path.join(directory, "lock");
    privateDirectory(directory);
    try {
      if (lock) this.acquireLock(port);
      this.replay();
      validatePersisted(this);
      this.fd = fs.openSync(path.join(directory, "jobs.ndjson"), "a", 0o600);
      fs.fchmodSync(this.fd, 0o600);
      this.logBytes = fs.fstatSync(this.fd).size;
      if (recover) {
        for (const batch of this.batches.values()) {
          if (batch.state !== "preparing") continue;
          const total = [...this.jobs.values()].filter(job => job.batchId === batch.id).length;
          this.updateBatch(batch.id, { state: "paused", pauseReason: "interrupted_enqueue", total });
        }
        for (const job of this.jobs.values()) {
          const idempotentRetry = typeof supportsIdempotencyKey === "function" ? Boolean(supportsIdempotencyKey(job)) : Boolean(supportsIdempotencyKey);
          const patch = recoveryPatch(job, { supportsIdempotencyKey: idempotentRetry });
          if (patch) this.update(job.id, patch, { sync: true, idempotentRetry });
        }
      }
      this.scheduleCompaction();
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

  intern(job) {
    if (!job.modelConfig) return job;
    const key = JSON.stringify(job.modelConfig);
    if (!this.models.has(key)) {
      const model = freeze(job.modelConfig), id = crypto.createHash("sha256").update(key).digest("hex");
      this.models.set(key, model); this.modelIds.set(model, id); this.modelHashes.set(id, model);
    }
    return { ...job, modelConfig: this.models.get(key) };
  }

  replay() {
    const streamSnapshot = path.join(this.directory, "jobs.snapshot.ndjson");
    if (fs.existsSync(streamSnapshot)) {
      const models = new Map();
      let header = false, ended = false;
      readRecords(streamSnapshot, record => {
        if (!header) {
          if (record.v !== 2 || record.type !== "snapshot" || !Number.isSafeInteger(record.seq) || record.seq < 0) throw storeError();
          this.seq = record.seq; header = true; return;
        }
        if (ended) throw storeError();
        if (record.type === "model") {
          if (!Number.isInteger(record.ref) || models.has(record.ref) || !record.value) throw storeError();
          models.set(record.ref, this.intern({ modelConfig: record.value }).modelConfig);
        } else if (record.type === "job") {
          const job = record.modelRef === undefined ? record.value : { ...record.value, modelConfig: models.get(record.modelRef) };
          if (record.modelRef !== undefined && !job.modelConfig) throw storeError();
          validateJob(job);
          if (this.jobs.has(job.id)) throw storeError();
          this.jobs.set(job.id, freeze(this.intern({ queueOrder: this.jobs.size + 1, ...job })));
        } else if (record.type === "batch") {
          const batch = record.value;
          if (!batch || typeof batch.id !== "string" || !batch.id || this.batches.has(batch.id)) throw storeError();
          this.batches.set(batch.id, freeze({ queueOrder: this.batches.size + 1, ...batch }));
        } else if (record.type === "end" && record.seq === this.seq) ended = true;
        else throw storeError();
      });
      if (!ended) throw storeError();
      fs.chmodSync(streamSnapshot, 0o600);
    }
    const snapshot = path.join(this.directory, "jobs.snapshot.json");
    if (!fs.existsSync(streamSnapshot) && fs.existsSync(snapshot)) {
      const data = JSON.parse(fs.readFileSync(snapshot, "utf8"));
      if (data.v !== 1 || !Number.isSafeInteger(data.seq) || data.seq < 0 || !Array.isArray(data.jobs) || !Array.isArray(data.batches || [])) throw storeError();
      this.seq = data.seq;
      for (const job of data.jobs) {
        validateJob(job);
        if (this.jobs.has(job.id)) throw storeError();
        this.jobs.set(job.id, freeze(this.intern({ queueOrder: this.jobs.size + 1, ...job })));
      }
      for (const batch of data.batches || []) {
        if (!batch || typeof batch.id !== "string" || !batch.id || this.batches.has(batch.id)) throw storeError();
        this.batches.set(batch.id, freeze({ queueOrder: this.batches.size + 1, ...batch }));
      }
      fs.chmodSync(snapshot, 0o600);
    }
    for (const id of this.modelHashes.keys()) this.persistedModels.add(id);
    const logPath = path.join(this.directory, "jobs.ndjson");
    if (!fs.existsSync(logPath)) return;
    let previousSeq = 0;
    const end = readRecords(logPath, event => {
      if (event.v !== 1 || !Number.isSafeInteger(event.seq) || event.seq < 1 || event.seq <= previousSeq || typeof event.jobId !== "string" || !event.jobId || !["job", "batch", "delete", "delete_batch"].includes(event.type)) throw storeError();
      previousSeq = event.seq;
      if (event.seq <= this.seq) return;
      if (event.seq !== this.seq + 1) throw storeError();
      if (event.modelConfigRef !== undefined) {
        if (event.modelConfig) {
          const job = this.intern(event);
          if (this.modelIds.get(job.modelConfig) !== event.modelConfigRef) throw storeError();
          this.persistedModels.add(event.modelConfigRef);
        }
        const model = this.modelHashes.get(event.modelConfigRef);
        if (!model) throw storeError();
        event.modelConfig = model;
        delete event.modelConfigRef;
      }
      this.apply(event);
    }, { tailAllowed: true });
    if (end !== fs.statSync(logPath).size) {
      const fd = fs.openSync(logPath, "r+");
      try { fs.ftruncateSync(fd, end); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
  }

  apply(event) {
    const { v, seq, at, jobId, type, ...patch } = event;
    if (type === "delete") this.jobs.delete(jobId);
    else if (type === "delete_batch") this.batches.delete(jobId);
    else if (type === "batch") this.batches.set(jobId, freeze({ queueOrder: seq, ...this.batches.get(jobId), ...patch, id: jobId }));
    else {
      const job = { queueOrder: seq, ...this.jobs.get(jobId), ...patch, id: jobId, updatedAt: at };
      validateJob(job);
      this.jobs.set(jobId, freeze(job));
    }
    this.seq = seq;
  }

  append(jobId, type, patch = {}, options = {}) {
    if (this.fd === undefined || this.failed) throw storeError("storeClosed");
    if (typeof jobId !== "string" || !jobId || !["job", "batch", "delete", "delete_batch"].includes(type) || !patch || typeof patch !== "object" || Array.isArray(patch)) throw storeError();
    if (["v", "seq", "at", "jobId", "type", "modelConfigRef"].some((name) => Object.hasOwn(patch, name)) || patch.id !== undefined && patch.id !== jobId) throw storeError();
    let safePatch = this.intern(sanitizeRecord(patch));
    delete safePatch.queueOrder; // Store-owned ordering must not be copied from another job.
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
      let encoded = event;
      if (event.modelConfig) {
        const modelConfigRef = this.modelIds.get(event.modelConfig);
        const { modelConfig, ...rest } = event;
        encoded = { ...rest, modelConfigRef, ...(!this.persistedModels.has(modelConfigRef) ? { modelConfig } : {}) };
      }
      const record = `${JSON.stringify(encoded)}\n`;
      writeAll(this.fd, record);
      if (event.modelConfig) this.persistedModels.add(this.modelIds.get(event.modelConfig));
      this.logBytes += Buffer.byteLength(record);
      this.eventsSinceCompact += 1;
      this.checkpoint("append:written", event);
      if (options.sync || forceSync) {
        fs.fsyncSync(this.fd);
        this.checkpoint("append:fsynced", event);
      }
    } catch (error) { this.failed = true; throw error; }
    this.apply(event);
    this.emit("event", event);
    this.scheduleCompaction();
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

  async addManyAsync(jobs, { shouldStop = () => false } = {}) {
    const ids = new Set();
    for (const job of jobs) {
      if (this.jobs.has(job.id) || ids.has(job.id)) throw storeError("jobExists");
      assertTransition(null, job); ids.add(job.id);
    }
    for (let start = 0; start < jobs.length; start += 128) {
      if (shouldStop()) throw storeError("serviceStopping");
      for (const job of jobs.slice(start, start + 128)) this.add(job, { sync: false });
      await new Promise(resolve => setImmediate(resolve));
    }
    this.flush();
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
    const after = cursorPosition(cursor, this.jobs);
    for (const job of this.jobs.values()) {
      if (after !== null && job.queueOrder <= after) continue;
      if (batch && job.batchId !== batch || state && job.state !== state) continue;
      rows.push(job);
      if (rows.length > count) break;
    }
    const hasMore = rows.length > count;
    if (hasMore) rows.pop();
    return { jobs: rows, nextCursor: hasMore ? `q1:${rows.at(-1).queueOrder}` : null, seq: this.seq };
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
    this.flush();
    this.compact();
    return count;
  }

  compact() {
    if (this.compacting) return;
    if (this.fd === undefined || this.failed) throw storeError("storeClosed");
    try {
      const target = path.join(this.directory, "jobs.snapshot.ndjson");
      const temporary = `${target}.tmp`;
      const fd = fs.openSync(temporary, "w", 0o600);
      try {
        fs.fchmodSync(fd, 0o600);
        this.checkpoint("compact:opened");
        for (const record of snapshotRecords(this.seq, this.jobs.values(), this.batches.values(), this.models.values())) writeAll(fd, `${JSON.stringify(record)}\n`);
        this.checkpoint("compact:written");
        fs.fsyncSync(fd);
        this.checkpoint("compact:fsynced");
      } finally { fs.closeSync(fd); }
      replaceSnapshot(temporary, target);
      this.checkpoint("compact:renamed");
      syncDirectory(this.directory);
      this.checkpoint("compact:directorySynced");
      this.removeLegacySnapshot();
      // Windows append handles have FILE_APPEND_DATA rather than the write
      // access needed by SetEndOfFile. Keep the journal's append handle for all
      // writes, and truncate through a separate handle to the exact same file.
      const logPath = path.join(this.directory, "jobs.ndjson");
      const expected = fs.fstatSync(this.fd);
      const before = fs.lstatSync(logPath);
      const sameLog = (stat) => stat.isFile() && stat.dev === expected.dev && stat.ino === expected.ino;
      if (before.isSymbolicLink() || !sameLog(before)) throw storeError();
      const truncateFd = fs.openSync(logPath, fs.constants.O_RDWR | (fs.constants.O_NOFOLLOW || 0));
      try {
        if (!sameLog(fs.fstatSync(truncateFd))) throw storeError();
        this.checkpoint("compact:truncateOpened");
        fs.ftruncateSync(truncateFd, 0);
        this.checkpoint("compact:truncated");
        fs.fsyncSync(truncateFd);
      } finally { fs.closeSync(truncateFd); }
      this.flush();
      this.checkpoint("compact:logSynced");
      this.logBytes = 0; this.eventsSinceCompact = 0;
      this.compactionSucceeded();
    } catch (error) {
      if (this.deferCompaction(error)) { this.scheduleCompaction(); return; }
      this.failed = true; throw error;
    }
  }

  removeLegacySnapshot() {
    try { fs.unlinkSync(path.join(this.directory, "jobs.snapshot.json")); syncDirectory(this.directory); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }

  scheduleCompaction() {
    if (this.fd === undefined || this.failed || this.compactionTimer || this.compacting || !this.compactionRetryAt && this.logBytes < this.compactBytes && this.eventsSinceCompact < this.compactEvents) return;
    this.compactionTimer = setTimeout(() => {
      this.compactionTimer = null;
      this.compactAsync().catch(error => {
        this.failed = true;
        this.emit("failure", error);
      });
    }, this.compactionRetryAt ? Math.max(100, this.compactionRetryAt - Date.now()) : 100);
    this.compactionTimer.unref?.();
  }

  deferCompaction(error) {
    if (!error.compactionRetryAllowed || !busy(error) || this.fd === undefined || this.failed) return false;
    this.compactionRetryDelay = Math.min(30000, (this.compactionRetryDelay || 500) * 2);
    this.compactionRetryAt = Date.now() + this.compactionRetryDelay;
    clearTimeout(this.compactionTimer);
    this.compactionTimer = null;
    this.emit("maintenance", { code: "compactionDeferred", filesystemCode: error.code, retryAfterMs: this.compactionRetryDelay });
    return true;
  }

  compactionSucceeded() {
    this.compactionRetryAt = 0;
    this.compactionRetryDelay = 0;
    clearTimeout(this.compactionTimer);
    this.compactionTimer = null;
  }

  compactAsync() {
    if (this.compacting) return this.compacting;
    if (this.fd === undefined || this.failed) return Promise.reject(storeError("storeClosed"));
    const seq = this.seq, offset = this.logBytes;
    // Frozen values provide a stable checkpoint while appends continue.
    const jobs = [...this.jobs.values()], batches = [...this.batches.values()], models = [...this.models.values()];
    const target = path.join(this.directory, "jobs.snapshot.ndjson");
    const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    this.compacting = (async () => {
      // Do not create another full snapshot while a scanner still holds the
      // previous temporary file. At most one deferred temporary is retained.
      if (this.compactionTemporary) {
        try { fs.unlinkSync(this.compactionTemporary); }
        catch (error) {
          if (error.code !== "ENOENT") {
            if (busy(error)) error.compactionRetryAllowed = true;
            throw error;
          }
        }
        this.compactionTemporary = null;
      }
      const handle = await fs.promises.open(temporary, "w", 0o600);
      try {
        let chunk = "";
        for (const record of snapshotRecords(seq, jobs, batches, models)) {
          chunk += `${JSON.stringify(record)}\n`;
          if (chunk.length >= 64 * 1024) { await handle.writeFile(chunk); chunk = ""; }
        }
        if (chunk) await handle.writeFile(chunk);
        await handle.sync();
        this.checkpoint("asyncCompact:snapshotFsynced");
      } finally { await handle.close(); }
      if (this.fd === undefined || this.failed) return;
      // Finish synchronously so no append can race the final journal switch.
      replaceSnapshot(temporary, target);
      this.checkpoint("asyncCompact:snapshotRenamed");
      syncDirectory(this.directory);
      this.checkpoint("asyncCompact:snapshotDirectorySynced");
      this.removeLegacySnapshot();
      const log = path.join(this.directory, "jobs.ndjson");
      const expected = fs.fstatSync(this.fd), actual = fs.lstatSync(log);
      if (!actual.isFile() || actual.isSymbolicLink() || actual.dev !== expected.dev || actual.ino !== expected.ino) throw storeError();
      const next = `${log}.compact.tmp`;
      const fd = fs.openSync(next, "w", 0o600), source = fs.openSync(log, "r");
      try {
        const buffer = Buffer.alloc(64 * 1024);
        for (let at = offset; at < expected.size;) {
          const bytes = fs.readSync(source, buffer, 0, Math.min(buffer.length, expected.size - at), at);
          if (!bytes) throw storeError();
          let written = 0;
          while (written < bytes) written += fs.writeSync(fd, buffer, written, bytes - written);
          at += bytes;
        }
        fs.fsyncSync(fd);
        this.checkpoint("asyncCompact:tailFsynced");
      } finally { fs.closeSync(fd); fs.closeSync(source); }
      // Both journals contain the durable tail. Windows requires every handle
      // to the destination to be closed before atomically replacing it.
      const previousFd = this.fd;
      fs.fsyncSync(previousFd);
      this.fd = undefined;
      fs.closeSync(previousFd);
      this.checkpoint("asyncCompact:journalClosed");
      try { replaceFile(next, log); }
      catch (error) {
        if (busy(error)) {
          // Reopen the *same* original journal before allowing appends again.
          // Snapshot + full journal replay safely even if we crash while the
          // scanner still holds the destination. Never guess after a swap.
          const before = fs.lstatSync(log);
          const same = stat => stat.isFile() && stat.dev === expected.dev && stat.ino === expected.ino;
          if (before.isSymbolicLink() || !same(before)) throw storeError();
          const reopened = fs.openSync(log, fs.constants.O_WRONLY | fs.constants.O_APPEND | (fs.constants.O_NOFOLLOW || 0));
          try {
            if (!same(fs.fstatSync(reopened))) throw storeError();
            this.fd = reopened;
          } catch (failure) { fs.closeSync(reopened); throw failure; }
          error.compactionRetryAllowed = true;
        }
        throw error;
      }
      this.checkpoint("asyncCompact:journalRenamed");
      syncDirectory(this.directory);
      this.checkpoint("asyncCompact:journalDirectorySynced");
      this.fd = fs.openSync(log, "a", 0o600);
      this.checkpoint("asyncCompact:journalReopened");
      this.logBytes = expected.size - offset;
      this.eventsSinceCompact = this.seq - seq;
      this.compactionSucceeded();
    })().catch(error => {
      if (this.deferCompaction(error)) return;
      this.failed = true; throw error;
    }).finally(async () => {
      try {
        await fs.promises.unlink(temporary).catch(error => {
          if (busy(error)) {
            this.compactionTemporary = temporary;
            error.compactionRetryAllowed = true;
            // The earlier rename failure already scheduled its backoff.
            if (!this.compactionRetryAt) this.deferCompaction(error);
          } else if (error.code !== "ENOENT") { this.failed = true; throw error; }
        });
      } finally {
        this.compacting = null;
        this.scheduleCompaction();
      }
    });
    return this.compacting;
  }

  flush() {
    if (this.fd === undefined) return;
    try { fs.fsyncSync(this.fd); }
    catch (error) { this.failed = true; throw error; }
  }
  releaseLock() { this.instanceLock?.release(); }
  close() {
    clearTimeout(this.compactionTimer);
    this.compactionTimer = null;
    try {
      if (this.fd !== undefined) {
        const fd = this.fd;
        this.fd = undefined;
        try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      }
    } finally { this.releaseLock(); }
  }
}

function cursorPosition(cursor, entries) {
  if (!cursor) return null;
  if (entries.has(cursor)) return entries.get(cursor).queueOrder;
  const match = /^q1:(\d+)$/.exec(cursor);
  if (!match || !Number.isSafeInteger(Number(match[1]))) throw storeError("invalidCursor");
  return Number(match[1]);
}
module.exports = { JobStore, privateDirectory, pidAlive, syncDirectory, cursorPosition };
