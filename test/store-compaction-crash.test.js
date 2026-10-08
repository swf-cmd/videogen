const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { JobStore } = require("../src/store/job-store");
const modulePath = require.resolve("../src/store/job-store");

function directory(t) {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-async-compaction-"));
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}
function job(id, modelConfig, patch = {}) {
  return { id, batchId: "batch-a", state: "queued", prompt: `日本語 ${id}`, params: {}, assets: [], remote: null,
    attempts: { create: 0, poll: 0, download: 0 }, modelConfig, ...patch };
}
const firstModel = { id: "original-model", capabilities: { durations: [5] } };
const retiredModel = { id: "model-with-no-live-jobs", capabilities: { durations: [8] } };
const newModel = { id: "new-tail-model", capabilities: { durations: [10] } };

test("asynchronous compaction survives process death at every durability boundary with new and retired model references in the tail", (t) => {
  const checkpoints = ["snapshotFsynced", "snapshotRenamed", "snapshotDirectorySynced", "tailFsynced", "journalRenamed", "journalDirectorySynced", "journalReopened"];
  for (const phase of checkpoints) {
    const checkpoint = `asyncCompact:${phase}`;
    const dir = directory(t);
    let store = new JobStore(dir);
    store.add(job("paid", firstModel, { state: "running", remote: { id: "paid-remote" }, attempts: { create: 1, poll: 0, download: 0 } }));
    store.add(job("retired", retiredModel));
    store.update("retired", { state: "cancelled" });
    store.clearHistory();
    store.updateBatch("batch-a", { state: "paused", budget: { currency: "USD", amount: 8 } });
    const cursor = store.list({ limit: 1 }).jobs[0].queueOrder;
    store.close();
    const child = spawnSync(process.execPath, ["-e", `
      const { JobStore } = require(process.argv[1]);
      const retiredModel = ${JSON.stringify(retiredModel)};
      const newModel = ${JSON.stringify(newModel)};
      const job = ${job.toString()};
      (async () => {
        const store = new JobStore(process.argv[2], { onCheckpoint(name) {
          if (name === process.argv[3]) { require("node:fs").writeSync(1, "checkpoint:" + name); process.kill(process.pid, "SIGKILL"); }
        } });
        const compacting = store.compactAsync();
        store.add(job("reused-retired", retiredModel));
        store.add(job("new-tail-first", newModel));
        store.add(job("new-tail-second", newModel));
        store.update("paid", { progress: 63 }, { sync: true });
        store.updateBatch("batch-a", { budget: { currency: "USD", amount: 12 } });
        await compacting;
        throw new Error("checkpoint was not reached");
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `, modulePath, dir, checkpoint], { encoding: "utf8", timeout: 5000 });
    assert.equal(child.error, undefined, `${checkpoint}: child must not time out`);
    assert.equal(child.stdout, `checkpoint:${checkpoint}`, child.stderr);
    assert.ok(child.signal === "SIGKILL" || process.platform === "win32" && Number.isInteger(child.status) && child.status !== 0, `${checkpoint}: ${child.stderr}`);
    store = new JobStore(dir);
    assert.deepEqual([...store.jobs.keys()], ["paid", "reused-retired", "new-tail-first", "new-tail-second"], checkpoint);
    assert.equal(store.get("paid").remote.id, "paid-remote", checkpoint);
    assert.equal(store.get("paid").progress, 63, checkpoint);
    assert.equal(store.batches.get("batch-a").budget.amount, 12, checkpoint);
    assert.deepEqual(store.get("reused-retired").modelConfig, retiredModel, checkpoint);
    assert.equal(store.get("new-tail-first").modelConfig, store.get("new-tail-second").modelConfig, checkpoint);
    assert.deepEqual(store.list({ cursor: `q1:${cursor}` }).jobs.map(row => row.id), ["reused-retired", "new-tail-first", "new-tail-second"], checkpoint);
    store.add(job("after-restart", newModel));
    store.compact();
    store.close();
    store = new JobStore(dir);
    assert.equal(store.get("after-restart").modelConfig, store.get("new-tail-first").modelConfig, checkpoint);
    assert.equal(store.jobs.size, 5, checkpoint);
    store.close();
  }
});

test("legacy v1 snapshots migrate to stable cursors and shared models across async and sync snapshots", async (t) => {
  const dir = directory(t);
  fs.writeFileSync(path.join(dir, "jobs.snapshot.json"), JSON.stringify({ v: 1, seq: 20,
    jobs: [job("old-first", firstModel), job("old-second", firstModel)],
    batches: [{ id: "batch-a", state: "paused" }],
  }));
  let store = new JobStore(dir);
  const cursor = store.list({ limit: 1 }).nextCursor;
  assert.equal(store.get("old-first").modelConfig, store.get("old-second").modelConfig);
  store.add(job("new-shared", firstModel));
  const compacting = store.compactAsync();
  store.add(job("new-model-first", newModel));
  store.add(job("new-model-shared", newModel));
  store.update("old-first", { state: "cancelled" });
  store.clearHistory();
  await compacting;
  store.close();
  store = new JobStore(dir);
  assert.deepEqual(store.list({ cursor }).jobs.map(row => row.id), ["old-second", "new-shared", "new-model-first", "new-model-shared"]);
  assert.equal(store.get("old-second").modelConfig, store.get("new-shared").modelConfig);
  assert.equal(store.get("new-model-first").modelConfig, store.get("new-model-shared").modelConfig);
  store.compact();
  store.close();
  store = new JobStore(dir);
  try { assert.deepEqual(store.list({ cursor }).jobs.map(row => row.id), ["old-second", "new-shared", "new-model-first", "new-model-shared"]); }
  finally { store.close(); }
});
