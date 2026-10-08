// Inspect durable records without acquiring locks, repairing tails, running
// recovery, or instantiating JobStore while the service may still be running.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { readRecords } = require("../src/store/records");

function readOnce(directory) {
  const jobs = new Map(), models = new Map(), snapshotModels = new Map();
  const registerModel = (model) => {
    const id = createHash("sha256").update(JSON.stringify(model)).digest("hex");
    models.set(id, model);
    return id;
  };
  let seq = 0;
  const streamSnapshot = path.join(directory, "jobs.snapshot.ndjson");
  if (fs.existsSync(streamSnapshot)) {
    let header = false, ended = false;
    readRecords(streamSnapshot, (record) => {
      if (!header) {
        if (record.type !== "snapshot" || record.v !== 2 || !Number.isSafeInteger(record.seq)) throw new Error("Invalid snapshot header");
        seq = record.seq; header = true; return;
      }
      if (ended) throw new Error("Records after snapshot end");
      if (record.type === "model") {
        registerModel(record.value); snapshotModels.set(record.ref, record.value);
      } else if (record.type === "job") {
        const job = { ...record.value };
        if (record.modelRef !== undefined) {
          if (!snapshotModels.has(record.modelRef)) throw new Error("Missing snapshot model");
          job.modelConfig = snapshotModels.get(record.modelRef);
        }
        if (job.modelConfig) registerModel(job.modelConfig);
        jobs.set(job.id, job);
      } else if (record.type === "end" && record.seq === seq) ended = true;
      else if (record.type !== "batch") throw new Error("Invalid snapshot record");
    });
    if (!ended) throw new Error("Incomplete snapshot");
  } else {
    const filename = path.join(directory, "jobs.snapshot.json");
    if (fs.existsSync(filename)) {
      const saved = JSON.parse(fs.readFileSync(filename, "utf8"));
      if (saved.v !== 1 || !Array.isArray(saved.jobs)) throw new Error("Invalid legacy snapshot");
      seq = saved.seq;
      for (const job of saved.jobs) {
        if (job.modelConfig) registerModel(job.modelConfig);
        jobs.set(job.id, job);
      }
    }
  }
  const filename = path.join(directory, "jobs.ndjson");
  if (fs.existsSync(filename)) readRecords(filename, (event) => {
    if (event.seq <= seq) return;
    // Compaction may replace the journal after this observer read the snapshot.
    // Reopen both files instead of treating a mixed generation as missing jobs.
    if (event.seq !== seq + 1) throw Object.assign(new Error("Journal generation changed"), { code: "EAGAIN" });
    const { v, seq: nextSeq, at, jobId, type, modelConfigRef, ...patch } = event;
    if (patch.modelConfig) {
      const id = registerModel(patch.modelConfig);
      if (modelConfigRef !== undefined && modelConfigRef !== id) throw new Error("Invalid journal model hash");
    }
    if (modelConfigRef !== undefined) {
      if (!models.has(modelConfigRef)) throw new Error("Missing journal model");
      patch.modelConfig = models.get(modelConfigRef);
    }
    if (type === "job") jobs.set(jobId, { ...jobs.get(jobId), ...patch, id: jobId, updatedAt: at });
    if (type === "delete") jobs.delete(jobId);
    seq = nextSeq;
  }, { tailAllowed: true });
  return [...jobs.values()];
}

function durableJobs(directory) {
  for (let attempt = 0; ; attempt += 1) {
    try { return readOnce(directory); }
    catch (error) { if (error.code !== "EAGAIN" || attempt >= 2) throw error; }
  }
}
module.exports = { durableJobs };
