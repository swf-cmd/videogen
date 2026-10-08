const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { dataDirectory } = require("../config");
const { redact } = require("../queue/keys");

function privateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

class JobStore extends EventEmitter {
  constructor(directory = dataDirectory(), { port = 0, lock = true } = {}) {
    super();
    this.directory = directory;
    this.jobs = new Map();
    this.batches = new Map();
    this.seq = 0;
    this.lockPath = path.join(directory, "lock");
    privateDirectory(directory);
    if (lock) this.acquireLock(port);
    try {
      this.replay();
      this.fd = fs.openSync(path.join(directory, "jobs.ndjson"), "a", 0o600);
      fs.fchmodSync(this.fd, 0o600);
    } catch (error) { this.releaseLock(); throw error; }
  }

  acquireLock(port) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        this.lockFd = fs.openSync(this.lockPath, "wx", 0o600);
        fs.writeFileSync(this.lockFd, JSON.stringify({ pid: process.pid, port, startedAt: new Date().toISOString() }));
        fs.fsyncSync(this.lockFd);
        return;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        const existing = JSON.parse(fs.readFileSync(this.lockPath, "utf8"));
        if (pidAlive(existing.pid)) throw Object.assign(new Error("dataLocked"), { code: "dataLocked" });
        try { fs.unlinkSync(this.lockPath); } catch (unlinkError) { if (unlinkError.code !== "ENOENT") throw unlinkError; }
      }
    }
    throw new Error("dataLocked");
  }

  replay() {
    const snapshot = path.join(this.directory, "jobs.snapshot.json");
    if (fs.existsSync(snapshot)) {
      const data = JSON.parse(fs.readFileSync(snapshot, "utf8"));
      if (data.v !== 1) throw new Error("invalidStore");
      this.seq = data.seq;
      this.jobs = new Map(data.jobs.map((job) => [job.id, job]));
      this.batches = new Map((data.batches || []).map((batch) => [batch.id, batch]));
    }
    const logPath = path.join(this.directory, "jobs.ndjson");
    if (!fs.existsSync(logPath)) return;
    const data = fs.readFileSync(logPath);
    const end = data.lastIndexOf(10) + 1;
    for (const line of data.subarray(0, end).toString("utf8").split("\n")) {
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.v !== 1 || !Number.isSafeInteger(event.seq)) throw new Error("invalidStore");
      if (event.seq > this.seq) this.apply(event);
    }
    if (end !== data.length) fs.truncateSync(logPath, end);
  }

  apply(event) {
    const { v, seq, at, jobId, type, ...patch } = event;
    this.seq = seq;
    if (type === "delete") this.jobs.delete(jobId);
    else if (type === "batch") this.batches.set(jobId, { ...this.batches.get(jobId), ...patch, id: jobId });
    else this.jobs.set(jobId, { ...this.jobs.get(jobId), ...patch, id: jobId, updatedAt: at });
  }

  append(jobId, type, patch, { sync = false } = {}) {
    const event = redact({ v: 1, seq: this.seq + 1, at: new Date().toISOString(), jobId, type, ...patch });
    fs.writeSync(this.fd, `${JSON.stringify(event)}\n`);
    if (sync) fs.fsyncSync(this.fd);
    this.apply(event);
    this.emit("event", event);
    return this.jobs.get(jobId);
  }

  add(job) { return this.append(job.id, "job", job, { sync: true }); }
  update(id, patch, options) {
    if (!this.jobs.has(id)) throw new Error("jobNotFound");
    return this.append(id, "job", patch, options);
  }
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
      if (!["succeeded", "failed", "cancelled", "result_expired"].includes(job.state)) continue;
      this.append(job.id, "delete", {});
      count += 1;
    }
    this.compact();
    return count;
  }
  compact() {
    const target = path.join(this.directory, "jobs.snapshot.json");
    const temporary = `${target}.tmp`;
    const fd = fs.openSync(temporary, "w", 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify({ v: 1, seq: this.seq, jobs: [...this.jobs.values()], batches: [...this.batches.values()] }));
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, target);
    if (process.platform !== "win32") {
      const directoryFd = fs.openSync(this.directory, "r");
      try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
    }
    fs.ftruncateSync(this.fd, 0);
    this.flush();
  }
  flush() { if (this.fd !== undefined) fs.fsyncSync(this.fd); }
  releaseLock() {
    if (this.lockFd === undefined) return;
    fs.closeSync(this.lockFd);
    this.lockFd = undefined;
    fs.unlinkSync(this.lockPath);
  }
  close() {
    if (this.fd !== undefined) { this.flush(); fs.closeSync(this.fd); this.fd = undefined; }
    this.releaseLock();
  }
}

module.exports = { JobStore, privateDirectory, pidAlive };
