const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn, spawnSync } = require("node:child_process");
const { JobStore, pidAlive } = require("../src/store/job-store");
const { recoveryPatch } = require("../src/queue/state");
const { rememberSecret } = require("../src/queue/keys");

const modulePath = require.resolve("../src/store/job-store");

function directory(t) {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-store-"));
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}

function job(id, patch = {}) {
  return { id, batchId: "batch-a", state: "queued", prompt: id, params: {}, assets: [], remote: null, attempts: { create: 0, poll: 0, download: 0 }, ...patch };
}

function submit(store, id) {
  const current = store.get(id);
  return store.update(id, { state: "submitting", attempts: { ...current.attempts, create: current.attempts.create + 1 } }, { sync: false });
}

test("job log and batch records replay with private permissions and immutable data", (t) => {
  const dir = directory(t);
  let store = new JobStore(dir);
  t.after(() => store.close());
  rememberSecret("test-store-secret-8877");
  const events = [];
  store.on("event", (event) => events.push(event));
  const original = job("job-a", { prompt: "never store test-store-secret-8877", params: { durationSeconds: 5 } });
  const saved = store.add(original);
  original.params.durationSeconds = 99;
  assert.equal(saved.params.durationSeconds, 5);
  assert.equal(Object.isFrozen(saved.params), true);
  assert.equal(saved.prompt, "never store [REDACTED]");
  const batch = store.updateBatch("batch-a", { state: "paused", budget: { amount: 4, currency: "USD" } });
  assert.equal(batch.state, "paused");
  store.close();
  store = new JobStore(dir);
  assert.deepEqual(store.get("job-a"), saved);
  assert.deepEqual(store.batches.get("batch-a"), batch);
  assert.equal(store.seq, 2);
  assert.equal(fs.readFileSync(path.join(dir, "jobs.ndjson"), "utf8").includes("test-store-secret-8877"), false);
  assert.equal(JSON.stringify(events).includes("test-store-secret-8877"), false);
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(dir, "jobs.ndjson")).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.join(dir, "lock")).mode & 0o777, 0o600);
  }
});

test("half-written log tails are removed before the next append", (t) => {
  const dir = directory(t);
  let store = new JobStore(dir);
  store.add(job("before-crash"));
  store.close();
  const log = path.join(dir, "jobs.ndjson");
  const validSize = fs.statSync(log).size;
  fs.appendFileSync(log, '{"v":1,"seq":2,"prompt":"half');
  store = new JobStore(dir);
  assert.equal(fs.statSync(log).size, validSize);
  store.add(job("after-crash"));
  store.close();
  store = new JobStore(dir);
  t.after(() => store.close());
  assert.deepEqual([...store.jobs.keys()], ["before-crash", "after-crash"]);
  assert.equal(store.seq, 2);
});

test("invalid complete records and sequence gaps fail closed", (t) => {
  for (const content of ['{"v":1}\n', '{invalid}\n', JSON.stringify({ ...job("gap"), v: 1, seq: 3, jobId: "gap", type: "job" }) + "\n"]) {
    const dir = directory(t);
    fs.writeFileSync(path.join(dir, "jobs.ndjson"), content);
    assert.throws(() => new JobStore(dir));
    assert.equal(fs.existsSync(path.join(dir, "lock")), false);
  }
});

test("reserved log fields cannot be overwritten and partial writes complete", (t) => {
  const dir = directory(t);
  const store = new JobStore(dir);
  t.after(() => store.close());
  for (const name of ["v", "seq", "at", "jobId", "type"]) {
    assert.throws(() => store.add(job("invalid", { [name]: "overwrite" })), { code: "invalidStore" });
  }
  const originalWrite = fs.writeSync;
  let writes = 0;
  try {
    fs.writeSync = (fd, buffer, offset, length) => { writes += 1; return originalWrite(fd, buffer, offset, Math.min(length, 7)); };
    store.add(job("short-writes"));
  } finally { fs.writeSync = originalWrite; }
  assert.ok(writes > 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "jobs.ndjson"), "utf8")).jobId, "short-writes");
});

test("I1 and I2 force fsync before events are emitted even when sync is disabled", (t) => {
  const sequence = [];
  const store = new JobStore(directory(t), { onCheckpoint: (name, event) => sequence.push(`${name}:${event?.state || ""}`) });
  t.after(() => store.close());
  store.on("event", (event) => sequence.push(`event:${event.state || ""}`));
  store.add(job("barriers"), { sync: false });
  sequence.length = 0;
  assert.throws(() => store.update("barriers", { state: "submitting" }), { code: "invalidAttempts" });
  submit(store, "barriers");
  assert.deepEqual(sequence, ["append:written:submitting", "append:fsynced:submitting", "event:submitting"]);
  sequence.length = 0;
  store.update("barriers", { state: "running", remote: { id: "remote-1" } }, { sync: false });
  assert.deepEqual(sequence, ["append:written:running", "append:fsynced:running", "event:running"]);
  assert.throws(() => store.update("barriers", { remote: { id: "different-paid-job" } }), { code: "invalidRemoteId" });
  assert.throws(() => store.update("barriers", { state: "queued" }), { code: "invalidTransition" });
});

test("I3 recovers interrupted creates conservatively and preserves known remote IDs", (t) => {
  const dir = directory(t);
  let store = new JobStore(dir);
  store.addMany([job("unknown"), job("known"), job("download")]);
  for (const id of ["unknown", "known", "download"]) submit(store, id);
  store.update("known", { state: "running", remote: { id: "remote-known" } });
  store.update("download", { state: "running", remote: { id: "remote-download" } });
  store.update("download", { state: "downloading" });
  store.close();
  store = new JobStore(dir);
  t.after(() => store.close());
  assert.equal(store.get("unknown").state, "needs_review");
  assert.equal(store.get("unknown").error.reason, "interrupted_create");
  assert.equal(store.get("unknown").attempts.create, 1);
  assert.equal(store.get("known").state, "running");
  assert.equal(store.get("known").remote.id, "remote-known");
  assert.equal(store.get("download").state, "downloading");
  assert.throws(() => store.update("unknown", { state: "queued" }), { code: "unsafeCreateRetry" });
  store.update("unknown", { state: "running", remote: { id: "manually-associated" } });
  assert.equal(store.get("unknown").attempts.create, 1);
});

test("idempotent and manually authorized resubmits consume one create authorization", (t) => {
  const dir = directory(t);
  let store = new JobStore(dir);
  store.add(job("idempotent"));
  submit(store, "idempotent");
  store.close();
  store = new JobStore(dir, { supportsIdempotencyKey: () => true });
  t.after(() => store.close());
  assert.equal(store.get("idempotent").state, "queued");
  assert.equal(store.get("idempotent").createAuthorization.idempotencyKey, "idempotent");
  submit(store, "idempotent");
  assert.equal(store.get("idempotent").attempts.create, 2);
  assert.equal(store.get("idempotent").createAuthorization, null);
  assert.throws(() => submit(store, "idempotent"), { code: "unsafeCreateRetry" });
  store.update("idempotent", { state: "needs_review" });
  store.update("idempotent", { state: "queued" }, { manualResubmit: true });
  submit(store, "idempotent");
  assert.equal(store.get("idempotent").attempts.create, 3);
  store.update("idempotent", { state: "failed", error: { category: "unknown_outcome", definitelyNotAccepted: false } });
  assert.throws(() => store.update("idempotent", { state: "queued" }), { code: "unsafeCreateRetry" });
  assert.deepEqual(recoveryPatch(job("has-id", { state: "submitting", remote: { id: "remote-id" } })), { state: "running" });
});

test("definite rejections may retry but stale rejection flags cannot authorize another create", (t) => {
  const store = new JobStore(directory(t));
  t.after(() => store.close());
  store.add(job("rate-limit"));
  submit(store, "rate-limit");
  store.update("rate-limit", { state: "queued", error: { category: "rate_limited", definitelyNotAccepted: true } });
  submit(store, "rate-limit");
  assert.equal(store.get("rate-limit").error, null);
  assert.throws(() => submit(store, "rate-limit"), { code: "unsafeCreateRetry" });
});

test("compaction survives process death at every durability boundary", (t) => {
  const checkpoints = ["compact:opened", "compact:written", "compact:fsynced", "compact:renamed", "compact:directorySynced", "compact:truncateOpened", "compact:truncated", "compact:logSynced"];
  for (const checkpoint of checkpoints) {
    const dir = directory(t);
    let store = new JobStore(dir);
    store.add(job("first"));
    store.updateBatch("batch-a", { state: "paused", budget: { amount: 12, currency: "USD" } });
    store.compact();
    store.add(job("second"));
    store.close();
    const child = spawnSync(process.execPath, ["-e", `
      const { JobStore } = require(process.argv[1]);
      const store = new JobStore(process.argv[2], { onCheckpoint(name) {
        if (name === process.argv[3]) { require("node:fs").writeSync(1, "checkpoint:" + name); process.kill(process.pid, "SIGKILL"); }
      } });
      store.update("first", { progress: 37 }, { sync: true });
      store.compact();
    `, modulePath, dir, checkpoint], { encoding: "utf8", timeout: 5000 });
    assert.equal(child.error, undefined, "child reached checkpoint rather than timing out");
    assert.equal(child.stdout, `checkpoint:${checkpoint}`);
    if (process.platform === "win32") assert.ok(child.signal === "SIGKILL" || Number.isInteger(child.status) && child.status !== 0, child.stderr);
    else assert.equal(child.signal, "SIGKILL", `${checkpoint}: ${child.stderr}`);
    store = new JobStore(dir);
    assert.equal(store.jobs.size, 2, checkpoint);
    assert.equal(store.get("first").progress, 37, checkpoint);
    assert.equal(store.batches.get("batch-a").budget.amount, 12, checkpoint);
    store.add(job("after-restart"));
    store.compact();
    const sequence = store.seq;
    store.close();
    store = new JobStore(dir);
    assert.equal(store.seq, sequence, checkpoint);
    assert.equal(store.jobs.size, 3, checkpoint);
    store.close();
  }
});

test("compaction works when append-only handles cannot truncate, then appends and replays without gaps", (t) => {
  const dir = directory(t);
  let store = new JobStore(dir);
  store.add(job("before-compaction"));
  const truncate = fs.ftruncateSync;
  fs.ftruncateSync = (fd, length) => {
    if (fd === store.fd) throw Object.assign(new Error("append-only truncate denied"), { code: "EPERM" });
    return truncate(fd, length);
  };
  try { store.compact(); } finally { fs.ftruncateSync = truncate; }
  assert.equal(fs.statSync(path.join(dir, "jobs.ndjson")).size, 0);
  store.add(job("after-compaction"));
  store.close();
  store = new JobStore(dir);
  t.after(() => store.close());
  assert.deepEqual([...store.jobs.keys()], ["before-compaction", "after-compaction"]);
  assert.equal(store.seq, 2);
});

test("compaction refuses to truncate a replacement journal after its snapshot is durable", (t) => {
  const dir = directory(t);
  const store = new JobStore(dir);
  t.after(() => store.close());
  store.add(job("preserved"));
  const filename = path.join(dir, "jobs.ndjson"), original = `${filename}.original`;
  fs.renameSync(filename, original);
  const replacement = "unrelated replacement file";
  fs.writeFileSync(filename, replacement);
  assert.throws(() => store.compact(), { code: "invalidStore" });
  assert.equal(store.failed, true);
  assert.equal(fs.readFileSync(filename, "utf8"), replacement);
  assert.match(fs.readFileSync(original, "utf8"), /"jobId":"preserved"/);
});

test("live locks reject another port, stale locks recover and release checks ownership", (t) => {
  const dir = directory(t);
  const first = new JobStore(dir, { port: 5177 });
  assert.throws(() => new JobStore(dir, { port: 5178 }), { code: "dataLocked" });
  assert.equal(pidAlive(process.pid), true);
  assert.equal(pidAlive(-1), false);
  first.close();
  const lock = path.join(dir, "lock");
  fs.writeFileSync(lock, JSON.stringify({ pid: 2147483647, port: 1, startedAt: "old" }));
  const recovered = new JobStore(dir, { port: 5179 });
  assert.equal(JSON.parse(fs.readFileSync(lock, "utf8")).port, 5179);
  fs.unlinkSync(lock);
  const replacement = JSON.stringify({ pid: process.pid, token: "replacement", port: 9999 });
  fs.writeFileSync(lock, replacement);
  recovered.close();
  assert.equal(fs.readFileSync(lock, "utf8"), replacement);
});

test("a removed claim marker rechecks the live winner instead of leaking ENOENT or reclaiming it", (t) => {
  const dir = directory(t), filename = path.join(dir, "lock");
  fs.writeFileSync(filename, JSON.stringify({ pid: 2147483647, port: 1 }));
  const link = fs.linkSync;
  const winner = JSON.stringify({ pid: process.pid, port: 9999, token: "already-elected" });
  let raced = false;
  fs.linkSync = (source, target) => {
    if (!raced && path.basename(target).startsWith(".lock-reclaim-")) {
      raced = true;
      // The marker existed when link ran, but its owner published the new
      // canonical lock and cleaned the marker before the loser could read it.
      fs.writeFileSync(filename, winner);
      throw Object.assign(new Error("marker existed"), { code: "EEXIST" });
    }
    return link(source, target);
  };
  try { assert.throws(() => new JobStore(dir), { code: "dataLocked" }); }
  finally { fs.linkSync = link; }
  assert.equal(raced, true);
  assert.equal(fs.readFileSync(filename, "utf8"), winner);
});

test("simultaneous stale-lock takeover elects exactly one live owner", { timeout: 15000 }, async (t) => {
  const dir = directory(t);
  fs.writeFileSync(path.join(dir, "lock"), JSON.stringify({ pid: 2147483647, port: 1 }));
  const children = Array.from({ length: 8 }, () => {
    const child = spawn(process.execPath, ["-e", `
      const { JobStore } = require(process.argv[1]);
      let store;
      process.on("message", message => {
        if (message === "start") {
          try { store = new JobStore(process.argv[2]); process.send("owner"); }
          catch (error) { process.send(error.code || error.message); }
        } else if (message === "release") { store?.close(); process.disconnect(); }
      });
      process.send("ready");
    `, modulePath, dir], { stdio: ["ignore", "pipe", "pipe", "ipc"] });
    t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
    let errors = "";
    child.stderr.on("data", (chunk) => { errors += chunk; });
    const receive = (ready) => new Promise((resolve, reject) => {
      const message = (value) => { if ((value === "ready") === ready) { child.off("message", message); resolve(value); } };
      child.on("message", message); child.once("error", reject);
      child.once("exit", () => reject(new Error(`Child exited before ${ready ? "barrier" : "outcome"}: ${errors}`)));
    });
    const done = new Promise((resolve, reject) => child.once("exit", code => code === 0 ? resolve() : reject(new Error(errors))));
    return { child, ready: receive(true), outcome: receive(false), done };
  });
  await Promise.all(children.map(entry => entry.ready));
  for (const { child } of children) child.send("start");
  const outputs = await Promise.all(children.map(entry => entry.outcome));
  for (const { child } of children) child.send("release");
  await Promise.all(children.map(entry => entry.done));
  assert.equal(outputs.filter((value) => value === "owner").length, 1, JSON.stringify(outputs));
  assert.equal(outputs.filter((value) => value === "dataLocked").length, 7, JSON.stringify(outputs));
});

test("a reclaimer killed while owning its marker does not block future stale recovery", (t) => {
  const dir = directory(t);
  fs.writeFileSync(path.join(dir, "lock"), JSON.stringify({ pid: 2147483647, port: 1 }));
  const child = spawnSync(process.execPath, ["-e", `
    const { JobStore } = require(process.argv[1]);
    new JobStore(process.argv[2], { onCheckpoint(name) {
      if (name === "lock:reclaimAcquired") { require("node:fs").writeSync(1, "checkpoint:" + name); process.kill(process.pid, "SIGKILL"); }
    } });
  `, modulePath, dir], { encoding: "utf8", timeout: 5000 });
  assert.equal(child.error, undefined, "child reached checkpoint rather than timing out");
  assert.equal(child.stdout, "checkpoint:lock:reclaimAcquired");
  if (process.platform === "win32") assert.ok(child.signal === "SIGKILL" || Number.isInteger(child.status) && child.status !== 0, child.stderr);
  else assert.equal(child.signal, "SIGKILL", child.stderr);
  assert.ok(fs.readdirSync(dir).some((name) => name.startsWith(".lock-reclaim-")));
  const store = new JobStore(dir);
  store.close();
  assert.equal(fs.readdirSync(dir).some((name) => name.startsWith(".lock-reclaim-")), false);
});

test("history cleanup keeps pending work and removes empty durable batches", (t) => {
  const dir = directory(t);
  let store = new JobStore(dir);
  store.addMany([job("cancelled", { batchId: "finished-batch" }), job("pending")]);
  store.updateBatch("finished-batch", { state: "active" });
  store.updateBatch("batch-a", { state: "paused" });
  store.update("cancelled", { state: "cancelled" });
  assert.equal(store.clearHistory(), 1);
  store.close();
  store = new JobStore(dir);
  t.after(() => store.close());
  assert.deepEqual([...store.jobs.keys()], ["pending"]);
  assert.deepEqual([...store.batches.keys()], ["batch-a"]);
});

test("50,000 queued jobs append with one batch flush and remain paginated after replay", (t) => {
  const dir = directory(t);
  let store = new JobStore(dir);
  let syncs = 0;
  const originalSync = fs.fsyncSync;
  try {
    fs.fsyncSync = (fd) => { syncs += 1; return originalSync(fd); };
    store.addMany(Array.from({ length: 50000 }, (_, index) => job(`large-${index}`)));
  } finally { fs.fsyncSync = originalSync; }
  assert.equal(syncs, 1);
  assert.equal(store.list({ limit: 100000 }).jobs.length, 500);
  assert.equal(store.list({ cursor: "large-49994" }).jobs.length, 5);
  store.close();
  store = new JobStore(dir);
  t.after(() => store.close());
  assert.equal(store.jobs.size, 50000);
  assert.equal(store.get("large-49999").prompt, "large-49999");
});

test("one-shot batch flush failure poisons the store even when later disk calls succeed", (t) => {
  const store = new JobStore(directory(t)); t.after(() => store.close());
  const sync = fs.fsyncSync; let failed = false;
  fs.fsyncSync = (fd) => { if (fd === store.fd && !failed) { failed = true; throw Object.assign(new Error("temporary disk failure"), { code: "EIO" }); } return sync(fd); };
  try { assert.throws(() => store.addMany([job("one"), job("two")]), { code: "EIO" }); }
  finally { fs.fsyncSync = sync; }
  assert.equal(store.failed, true);
  assert.throws(() => submit(store, "one"), { code: "storeClosed" });
  assert.equal(store.get("one").state, "queued");
});

test("compaction disk failures at snapshot sync, directory sync and truncation fail closed", (t) => {
  for (const phase of ["snapshot", "directory", "truncate"]) {
    const dir = directory(t); const store = new JobStore(dir);
    store.add(job("preserved")); const sync = fs.fsyncSync; const truncate = fs.ftruncateSync;
    let syncs = 0;
    fs.fsyncSync = (fd) => { syncs += 1; if ((phase === "snapshot" && syncs === 1) || (phase === "directory" && syncs === 2)) throw Object.assign(new Error("disk full"), { code: "ENOSPC" }); return sync(fd); };
    fs.ftruncateSync = (fd, size) => { if (phase === "truncate") throw Object.assign(new Error("truncate failed"), { code: "EIO" }); return truncate(fd, size); };
    try { assert.throws(() => store.compact()); }
    finally { fs.fsyncSync = sync; fs.ftruncateSync = truncate; }
    assert.equal(store.failed, true, phase);
    assert.throws(() => submit(store, "preserved"), { code: "storeClosed" }); store.close();
    const recovered = new JobStore(dir); assert.equal(recovered.get("preserved").state, "queued"); recovered.close();
  }
});
