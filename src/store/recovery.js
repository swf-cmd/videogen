const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { InstanceLock } = require("./lock");
const { JobStore, syncDirectory } = require("./job-store");
const { readRecords, snapshotRecords } = require("./records");
const { validateJob, TERMINAL_STATES } = require("../queue/state");
const { normalizeLane, sanitizeRecord } = require("../queue/keys");
const { normalizeSettings } = require("./settings");
const PROVIDERS = new Set(["openai-compatible", "openrouter", "gemini", "dashscope", "ark", "mock"]);

const plain = value => value !== null && typeof value === "object" && !Array.isArray(value);
const identifier = value => typeof value === "string" && value.length > 0;
const lockMetadata = name => name === "lock" || /^\.lock-/.test(name);
function fail(code, details) { throw Object.assign(new Error(code), { code, details }); }
function ensure(condition, details) { if (!condition) fail("recoveryAmbiguousStore", details); }
function inside(parent, child) { const relative = path.relative(parent, child); return relative === "" || !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative); }
function strictJson(filename) { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(fs.readFileSync(filename))); }
function writePrivate(filename, data) {
  return writeChunks(filename, [data]);
}
function writeChunks(filename, chunks) {
  const fd = fs.openSync(filename, "wx", 0o600);
  try { for (const chunk of chunks) fs.writeFileSync(fd, chunk); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function* jsonChunks(object) {
  yield "{\n"; let first = true;
  for (const [key, value] of Object.entries(object)) {
    yield `${first ? "" : ",\n"}${JSON.stringify(key)}:`; first = false;
    if (!Array.isArray(value)) { yield JSON.stringify(value); continue; }
    yield "[";
    for (let index = 0; index < value.length; index += 1) yield `${index ? "," : ""}${JSON.stringify(value[index])}`;
    yield "]";
  }
  yield "\n}\n";
}
function redactedStructure(value, key = "") {
  if (["error", "details", "message", "providerMessage", "providerCode"].includes(key)) return false;
  if (typeof value === "string") return value.includes("[REDACTED]");
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([name, item]) => name.includes("[REDACTED]") || redactedStructure(item, name));
}
function validScheduling(model) {
  if (!model) return true;
  // Bound persisted scheduling arithmetic without requiring a modern complete
  // catalog schema. Zero RPM is the scheduler's existing unlimited setting.
  const limits = { pollIntervalSec: 365 * 86400, typicalRenderSec: 365 * 86400, resultTtlHours: 100 * 365 * 24 };
  for (const [name, maximum] of Object.entries(limits)) {
    const value = model[name];
    if (value === undefined || name === "resultTtlHours" && value === null) continue;
    if (!Number.isFinite(value) || value <= 0 || value > maximum) return false;
  }
  if (model.rpm !== undefined && (!Number.isFinite(model.rpm) || model.rpm < 0 || model.rpm > Number.MAX_SAFE_INTEGER)) return false;
  return model.concurrencyDefault === undefined || Number.isInteger(model.concurrencyDefault) && model.concurrencyDefault >= 1 && model.concurrencyDefault <= 1000;
}

// Copy bytes through verified file descriptors; never link evidence back to the
// source. Only the live-instance lock protocol is permitted to mutate source.
function inventory(root) {
  const files = [];
  files.directories = [];
  function visit(directory, relative = "") {
    const before = fs.lstatSync(directory);
    if (!before.isDirectory() || before.isSymbolicLink() || !inside(root, fs.realpathSync(directory))) fail("recoveryUnsafePath");
    if (relative) files.directories.push(relative);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.join(relative, entry.name), filename = path.join(root, name), stat = fs.lstatSync(filename);
      if (stat.isSymbolicLink()) fail("recoveryUnsafePath");
      if (stat.isDirectory()) visit(filename, name);
      else if (stat.isFile()) files.push({ name, stat });
      else fail("recoveryUnsafePath");
    }
    const after = fs.lstatSync(directory);
    if (before.dev !== after.dev || before.ino !== after.ino) fail("recoverySourceChanged");
  }
  visit(root);
  return files;
}
function copyEvidence(source, destination, entry) {
  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  const fd = fs.openSync(source, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  let out;
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.dev !== entry.stat.dev || stat.ino !== entry.stat.ino || stat.size !== entry.stat.size) fail("recoverySourceChanged");
    out = fs.openSync(destination, "wx", 0o600);
    const hash = crypto.createHash("sha256"), buffer = Buffer.alloc(65536);
    for (;;) {
      const count = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!count) break;
      hash.update(buffer.subarray(0, count));
      let offset = 0;
      while (offset < count) offset += fs.writeSync(out, buffer, offset, count - offset);
    }
    const after = fs.fstatSync(fd);
    if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) fail("recoverySourceChanged");
    fs.fsyncSync(out);
    return { file: entry.name, bytes: stat.size, sha256: hash.digest("hex") };
  } finally { if (out !== undefined) fs.closeSync(out); fs.closeSync(fd); }
}

function parseStore(directory) {
  const jobs = new Map(), batches = new Map(), hashes = new Map(), observed = new Map(), issues = new Map();
  let seq = 0;
  const issue = (id, reason) => { if (!issues.has(id)) issues.set(id, new Set()); issues.get(id).add(reason); };
  const model = value => { ensure(plain(value), "invalid model record"); hashes.set(crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"), value); return value; };
  function rememberRemote(job) {
    if (job.remote?.id !== undefined) {
      if (!observed.has(job.id)) observed.set(job.id, new Set());
      if (identifier(job.remote.id)) observed.get(job.id).add(job.remote.id);
    }
  }
  function inspect(job) {
    rememberRemote(job);
    try { validateJob(job); } catch (error) { issue(job.id, error.code || "invalidJob"); }
    if (redactedStructure(job)) issue(job.id, "redactedStructure");
  }
  function addJob(job) {
    ensure(plain(job) && identifier(job.id) && !jobs.has(job.id), "missing or duplicate job identity");
    if (job.modelConfig !== undefined) model(job.modelConfig);
    job = { queueOrder: jobs.size + 1, ...job };
    jobs.set(job.id, job); inspect(job);
  }
  function addBatch(batch) {
    ensure(plain(batch) && identifier(batch.id) && !batches.has(batch.id), "missing or duplicate batch identity");
    batches.set(batch.id, { queueOrder: batches.size + 1, ...batch });
  }
  const snapshot = path.join(directory, "jobs.snapshot.ndjson"), legacy = path.join(directory, "jobs.snapshot.json");
  if (fs.existsSync(snapshot)) {
    const models = new Map(); let header = false, ended = false;
    readRecords(snapshot, record => {
      ensure(plain(record), "invalid snapshot record");
      if (!header) { ensure(record.v === 2 && record.type === "snapshot" && Number.isSafeInteger(record.seq) && record.seq >= 0, "invalid snapshot header"); seq = record.seq; header = true; return; }
      ensure(!ended, "records after snapshot end");
      if (record.type === "model") { ensure(Number.isSafeInteger(record.ref) && record.ref >= 0 && !models.has(record.ref), "invalid model reference"); models.set(record.ref, model(record.value)); }
      else if (record.type === "job") {
        ensure(plain(record.value), "missing job value");
        if (record.modelRef !== undefined) ensure(models.has(record.modelRef) && record.value.modelConfig === undefined, "unknown or conflicting model reference");
        addJob(record.modelRef === undefined ? record.value : { ...record.value, modelConfig: models.get(record.modelRef) });
      } else if (record.type === "batch") addBatch(record.value);
      else if (record.type === "end" && record.seq === seq) ended = true;
      else fail("recoveryAmbiguousStore", "invalid snapshot record type");
    });
    ensure(ended, "incomplete snapshot");
  } else if (fs.existsSync(legacy)) {
    const data = strictJson(legacy);
    ensure(data.v === 1 && Number.isSafeInteger(data.seq) && data.seq >= 0 && Array.isArray(data.jobs) && Array.isArray(data.batches || []), "invalid legacy snapshot");
    seq = data.seq; data.jobs.forEach(addJob); (data.batches || []).forEach(addBatch);
  }
  const log = path.join(directory, "jobs.ndjson"); let previousSeq;
  if (fs.existsSync(log)) readRecords(log, event => {
    ensure(plain(event) && event.v === 1 && Number.isSafeInteger(event.seq) && event.seq >= 1 && identifier(event.jobId) && ["job", "batch", "delete", "delete_batch"].includes(event.type), "invalid journal envelope");
    ensure(previousSeq === undefined || event.seq === previousSeq + 1, "journal sequence gap or duplicate"); previousSeq = event.seq;
    ensure(event.id === undefined || event.id === event.jobId, "conflicting job identity");
    if (event.modelConfig !== undefined) model(event.modelConfig);
    if (event.modelConfigRef !== undefined && event.modelConfig !== undefined) ensure(hashes.get(event.modelConfigRef) === event.modelConfig, "model reference hash mismatch");
    if (event.modelConfigRef !== undefined) ensure(hashes.has(event.modelConfigRef), "unknown model reference");
    // A snapshot may itself be damaged. Older journal events are not replayed,
    // but their paid identities must remain visible and checked for conflicts.
    if (event.type === "job") rememberRemote({ ...event, id: event.jobId });
    if (event.seq <= seq) return;
    ensure(event.seq === seq + 1, "journal does not follow snapshot");
    const { v, seq: number, at, jobId, type, modelConfigRef, ...patch } = event;
    if (modelConfigRef !== undefined) patch.modelConfig = hashes.get(modelConfigRef);
    if (type === "delete") {
      ensure(jobs.has(jobId) && TERMINAL_STATES.has(jobs.get(jobId).state), "unexplained job deletion"); jobs.delete(jobId);
    } else if (type === "delete_batch") {
      ensure(batches.has(jobId) && ![...jobs.values()].some(job => job.batchId === jobId), "unexplained batch deletion"); batches.delete(jobId);
    } else if (type === "batch") {
      ensure(batches.has(jobId) || Object.hasOwn(patch, "state"), "batch patch has no initial record");
      batches.set(jobId, { queueOrder: number, ...batches.get(jobId), ...patch, id: jobId });
    }
    else {
      if (!jobs.has(jobId)) ensure(["state", "attempts", "batchId", "provider", "baseUrl"].every(key => Object.hasOwn(patch, key)), "job patch has no initial record");
      const job = { queueOrder: number, ...jobs.get(jobId), ...patch, id: jobId, updatedAt: at };
      jobs.set(jobId, job); inspect(job);
    }
    seq = number;
  }); // Recovery deliberately refuses even a torn tail; evidence is not guessed.
  for (const job of jobs.values()) {
    ensure(identifier(job.batchId) && batches.has(job.batchId), "job refers to a missing batch");
    const ids = [...observed.get(job.id) || []];
    if (ids.length > 1 || ids.length === 1 && ids[0] !== job.remote?.id) issue(job.id, "remoteIdentityChanged");
  }
  return { jobs, batches, seq, observed, issues };
}

function recoverData({ source, destination } = {}) {
  if (!identifier(source) || !identifier(destination)) fail("recoveryArgumentsRequired");
  source = path.resolve(source); destination = path.resolve(destination);
  const sourceStat = fs.lstatSync(source);
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) fail("recoveryUnsafePath");
  source = fs.realpathSync(source);
  const parent = fs.realpathSync(path.dirname(destination));
  destination = path.join(parent, path.basename(destination));
  if (inside(source, destination) || inside(destination, source)) fail("recoveryUnsafeDestination");
  if (fs.existsSync(destination) || fs.lstatSync(destination, { throwIfNoEntry: false })) fail("recoveryDestinationExists");
  const entries = inventory(source);
  ensure(entries.some(entry => ["jobs.ndjson", "jobs.snapshot.json", "jobs.snapshot.ndjson"].includes(entry.name)), "no persistent job data found");
  const oldLocks = new Map(entries.filter(entry => lockMetadata(entry.name)).map(entry => [entry.name, fs.readFileSync(path.join(source, entry.name))]));
  const lock = new InstanceLock(source, 0);
  const reservation = path.join(parent, `.videogen-recovery-${crypto.createHash("sha256").update(destination).digest("hex")}.lock`);
  let staging, reservationFd, reservationStat;
  try {
    lock.acquire();
    try { reservationFd = fs.openSync(reservation, "wx", 0o600); }
    catch (error) { if (error.code === "EEXIST") fail("recoveryDestinationReserved"); throw error; }
    reservationStat = fs.fstatSync(reservationFd);
    fs.writeFileSync(reservationFd, JSON.stringify({ pid: process.pid, destination, token: crypto.randomUUID() })); fs.fsyncSync(reservationFd); syncDirectory(parent);
    staging = fs.mkdtempSync(path.join(parent, ".videogen-recovery-")); fs.chmodSync(staging, 0o700);
    const evidence = path.join(staging, "recovery-original"); fs.mkdirSync(evidence, { mode: 0o700 });
    for (const name of entries.directories) fs.mkdirSync(path.join(evidence, name), { recursive: true, mode: 0o700 });
    const manifest = [];
    for (const entry of entries) {
      const target = path.join(evidence, entry.name);
      if (oldLocks.has(entry.name)) {
        fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
        const bytes = oldLocks.get(entry.name); writePrivate(target, bytes);
        manifest.push({ file: entry.name, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
      } else manifest.push(copyEvidence(path.join(source, entry.name), target, entry));
    }
    const after = inventory(source).filter(entry => !lockMetadata(entry.name));
    ensure(JSON.stringify(after.map(entry => entry.name)) === JSON.stringify(entries.filter(entry => !lockMetadata(entry.name)).map(entry => entry.name)), "source file list changed");
    const parsed = parseStore(evidence), report = { version: 1, createdAt: new Date().toISOString(), source, sourceSequence: parsed.seq, evidence: "recovery-original", manifest, observedPaidReferences: [...parsed.observed].map(([jobId, ids]) => ({ jobId, remoteIds: [...ids] })), quarantinedJobs: [], quarantinedBatches: [], quarantinedSettings: [], reviewJobs: [], retainedPaidJobs: [] };
    const settings = { lanes: {} };
    const settingsFile = path.join(evidence, "settings.json");
    if (fs.existsSync(settingsFile)) {
      const original = strictJson(settingsFile);
      if (!plain(original) || !plain(original.lanes)) report.quarantinedSettings.push({ reason: "invalidSettings", value: original });
      else for (const [id, entry] of Object.entries(original.lanes)) {
        try {
          if (redactedStructure(entry)) throw new Error("redactedStructure");
          const normalized = normalizeSettings({ lanes: { [id]: entry } });
          settings.lanes[id] = { ...normalized.lanes[id], paused: true };
        } catch (error) { report.quarantinedSettings.push({ id, reason: error.message, value: entry }); }
      }
    }
    const badBatches = new Set();
    for (const batch of parsed.batches.values()) if (redactedStructure(batch) || !["active", "paused", "preparing", "cancelled"].includes(batch.state)) {
      badBatches.add(batch.id); report.quarantinedBatches.push({ id: batch.id, reason: "invalidBatch", value: batch });
    }
    const jobs = [], batchCounts = new Map();
    for (const original of parsed.jobs.values()) {
      const reasons = new Set(parsed.issues.get(original.id)); let lane;
      try {
        lane = normalizeLane(original);
        if (!PROVIDERS.has(original.provider) || original.laneId !== undefined && original.laneId !== lane.id || !identifier(original.model) || !identifier(original.prompt) || !Array.isArray(original.assets)) throw new Error("invalidJobMetadata");
        if (original.queueOrder !== undefined && (!Number.isSafeInteger(original.queueOrder) || original.queueOrder < 1)) throw new Error("invalidJobMetadata");
        if (!validScheduling(original.modelConfig)) throw new Error("invalidModelScheduling");
        if (typeof original.targetPath !== "string" || !path.isAbsolute(original.targetPath) || original.targetPath.includes("\0")) throw new Error("invalidOutputPath");
        if (original.state === "succeeded" && (typeof original.output?.path !== "string" || !path.isAbsolute(original.output.path) || original.output.path.includes("\0"))) throw new Error("invalidOutputPath");
      } catch (error) { reasons.add(error.code || error.message); }
      if (badBatches.has(original.batchId)) reasons.add("invalidBatch");
      if (reasons.size) { report.quarantinedJobs.push({ id: original.id, reasons: [...reasons], observedRemoteIds: [...parsed.observed.get(original.id) || []], value: original }); continue; }
      const job = { ...original, laneId: lane.id, createAuthorization: null };
      if (!job.remote?.id && (!TERMINAL_STATES.has(job.state) || job.state === "failed")) {
        job.state = "needs_review";
        job.error = { category: "unknown_outcome", code: "unknown_outcome", reason: "isolated_recovery", definitelyNotAccepted: false, message: "Recovered without a reliable remote ID. Check the provider before authorizing another paid create." };
        report.reviewJobs.push(job.id);
      } else if (job.remote?.id) {
        if (["queued", "submitting", "needs_review"].includes(job.state)) job.state = "running";
        report.retainedPaidJobs.push(job.id);
      }
      validateJob(job); jobs.push(sanitizeRecord(job));
      batchCounts.set(job.batchId, (batchCounts.get(job.batchId) || 0) + 1);
      settings.lanes[lane.id] = { lane, concurrency: settings.lanes[lane.id]?.concurrency || 1, paused: true };
    }
    const batches = [...parsed.batches.values()].filter(batch => !badBatches.has(batch.id)).map(batch => ({ ...batch, state: "paused", pauseReason: "isolated_recovery", total: batchCounts.get(batch.id) || 0 }));
    for (const entry of entries.filter(entry => entry.name.startsWith(`assets${path.sep}`))) copyEvidence(path.join(evidence, entry.name), path.join(staging, entry.name), { ...entry, stat: fs.lstatSync(path.join(evidence, entry.name)) });
    writeChunks(path.join(staging, "jobs.snapshot.ndjson"), (function* () { for (const record of snapshotRecords(parsed.seq, jobs, batches)) yield JSON.stringify(record) + "\n"; })());
    writePrivate(path.join(staging, "jobs.ndjson"), "");
    writePrivate(path.join(staging, "settings.json"), JSON.stringify(normalizeSettings(settings)));
    report.summary = { retainedJobs: jobs.length, retainedPaidJobs: report.retainedPaidJobs.length, needsReview: report.reviewJobs.length, quarantinedJobs: report.quarantinedJobs.length, quarantinedBatches: report.quarantinedBatches.length, quarantinedSettings: report.quarantinedSettings.length };
    writeChunks(path.join(staging, "recovery-report.json"), jsonChunks(report));
    const verification = new JobStore(staging, { recover: false, validatePersisted: store => { for (const job of store.jobs.values()) normalizeLane(job); normalizeSettings(strictJson(path.join(staging, "settings.json"))); } });
    verification.close();
    for (const name of inventory(staging).directories.reverse()) syncDirectory(path.join(staging, name));
    syncDirectory(staging);
    // The reservation serializes this tool. Callers must keep other programs
    // from changing the destination during recovery. No empty or incomplete
    // destination directory is ever exposed, including after process death.
    if (fs.lstatSync(destination, { throwIfNoEntry: false })) fail("recoveryDestinationExists");
    fs.renameSync(staging, destination); staging = null; syncDirectory(parent);
    return { directory: destination, reportPath: path.join(destination, "recovery-report.json"), ...report.summary };
  } catch (error) {
    if (error instanceof SyntaxError || error.code === "ERR_ENCODING_INVALID_ENCODED_DATA" || error.message === "invalidStore") fail("recoveryAmbiguousStore");
    throw error;
  } finally {
    try {
      if (staging) fs.rmSync(staging, { recursive: true, force: true });
    } finally {
      try {
        if (reservationFd !== undefined) {
          fs.closeSync(reservationFd);
          const current = fs.lstatSync(reservation, { throwIfNoEntry: false });
          if (current?.dev === reservationStat.dev && current?.ino === reservationStat.ino) fs.unlinkSync(reservation);
        }
      } finally { lock.release(); }
    }
  }
}
module.exports = { recoverData };
