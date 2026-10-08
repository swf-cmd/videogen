const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { durableJobs } = require("../acceptance/durable-jobs.cjs");
const { snapshotRecords } = require("../src/store/records");

for (const format of ["legacy", "streaming"]) test(`crash observer reads ${format} snapshots and shared journal models without altering records`, (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-durable-observer-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const model = { id: "mock", capabilities: { test: true } };
  const modelRef = createHash("sha256").update(JSON.stringify(model)).digest("hex");
  const original = { id: "old", modelConfig: model, state: "running", remote: { id: "remote-paid" } };
  if (format === "legacy") fs.writeFileSync(path.join(directory, "jobs.snapshot.json"), JSON.stringify({ v: 1, seq: 5, jobs: [original], batches: [] }));
  else {
    fs.writeFileSync(path.join(directory, "jobs.snapshot.ndjson"), [...snapshotRecords(5, [original], [], [model])].map(record => JSON.stringify(record)).join("\n") + "\n");
    // A stale legacy snapshot must never override the streaming snapshot.
    fs.writeFileSync(path.join(directory, "jobs.snapshot.json"), JSON.stringify({ v: 1, seq: 1, jobs: [], batches: [] }));
  }
  const records = [
    { v: 1, seq: 5, jobId: "old", type: "job", state: "queued" },
    { v: 1, seq: 6, jobId: "old", type: "job", state: "downloading" },
    { v: 1, seq: 7, jobId: "new", type: "job", state: "submitting", modelConfigRef: modelRef },
  ];
  const journal = path.join(directory, "jobs.ndjson");
  const bytes = Buffer.from(records.map(record => JSON.stringify(record)).join("\n") + '\n{"torn":');
  fs.writeFileSync(journal, bytes);
  const result = durableJobs(directory);
  assert.equal(result.length, 2);
  assert.equal(result[0].state, "downloading");
  assert.equal(result[0].remote.id, "remote-paid");
  assert.deepEqual(result[1].modelConfig, model);
  assert.equal(result[1].state, "submitting", "observer must not run recovery");
  assert.deepEqual(fs.readFileSync(journal), bytes, "observer must not repair a torn tail");
  assert.equal(fs.existsSync(path.join(directory, "lock")), false);
});
