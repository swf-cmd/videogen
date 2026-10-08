const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { recoverData } = require("../src/store/recovery");
const { JobStore } = require("../src/store/job-store");
const { InstanceLock } = require("../src/store/lock");
const { normalizeLane } = require("../src/queue/keys");
const { snapshotRecords } = require("../src/store/records");
const { Application } = require("../src/application");
const lane = normalizeLane({ provider: "openai-compatible", region: "custom", baseUrl: "http://127.0.0.1:9/v1" });
const model = { id: "custom-model", concurrencyDefault: 1, pollIntervalSec: 10 };
function setup(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "videogen-recovery-"))), source = path.join(root, "old"), destination = path.join(root, "new");
  fs.mkdirSync(source); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, source, destination };
}
function job(id, patch = {}) {
  return { id, batchId: "batch", provider: lane.provider, region: lane.region, baseUrl: lane.baseUrl, laneId: lane.id, model: model.id, modelConfig: model, state: "queued", prompt: id, params: {}, assets: [], remote: null, requiresKey: true, targetPath: path.join(os.tmpdir(), `videogen-recovered-${id}.mp4`), attempts: { create: 0, poll: 0, download: 0 }, ...patch };
}
function snapshot(source, jobs, v = 2, seq = 10) {
  const batches = [{ id: "batch", state: "active", total: jobs.length }];
  if (v === 1) fs.writeFileSync(path.join(source, "jobs.snapshot.json"), JSON.stringify({ v, seq, jobs, batches }));
  else fs.writeFileSync(path.join(source, "jobs.snapshot.ndjson"), [...snapshotRecords(seq, jobs, batches)].map(value => JSON.stringify(value) + "\n").join(""));
  fs.writeFileSync(path.join(source, "jobs.ndjson"), "");
}
function contents(directory) {
  return Object.fromEntries(fs.readdirSync(directory, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => {
    const filename = path.join(entry.parentPath || entry.path, entry.name);
    return [path.relative(directory, filename), { bytes: fs.readFileSync(filename).toString("base64"), mode: fs.statSync(filename).mode }];
  }));
}
for (const version of [1, 2]) test(`v${version} recovery isolates damaged jobs, preserves paid work and disarms every unpaid retry`, async (t) => {
  const { source, destination } = setup(t);
  snapshot(source, [
    job("paid", { state: "running", remote: { id: "paid-remote" }, attempts: { create: 1, poll: 2, download: 0 }, error: { providerMessage: "secret [REDACTED]" } }),
    job("queued", { createAuthorization: { kind: "manual", afterAttempt: 0 } }),
    job("failed", { state: "failed", error: { definitelyNotAccepted: true } }),
    job("broken", { baseUrl: "http://[REDACTED]27.0.0.[REDACTED]", remote: { id: "paid-damaged-endpoint" }, state: "running" }),
    job("cancelled", { state: "cancelled" }),
  ], version);
  fs.writeFileSync(path.join(source, "settings.json"), JSON.stringify({ lanes: { [lane.id]: { lane, concurrency: 3, paused: false }, damaged: { lane: { ...lane, baseUrl: "http://[REDACTED]" }, concurrency: 1 } } }));
  fs.mkdirSync(path.join(source, "assets")); fs.writeFileSync(path.join(source, "assets", "raw-asset.bin"), Buffer.from([0, 1, 255]));
  fs.writeFileSync(path.join(source, "catalog.local.json"), '{broken catalog preserved only as evidence');
  const before = contents(source), result = recoverData({ source, destination });
  assert.deepEqual(contents(source), before, "all source file bytes and permissions remain unchanged");
  assert.equal(result.retainedJobs, 4); assert.equal(result.quarantinedJobs, 1); assert.equal(result.needsReview, 2);
  const report = JSON.parse(fs.readFileSync(result.reportPath));
  assert.deepEqual(report.quarantinedJobs[0].observedRemoteIds, ["paid-damaged-endpoint"]);
  assert.equal(report.quarantinedSettings.length, 1);
  for (const [name, value] of Object.entries(before)) assert.equal(fs.readFileSync(path.join(destination, "recovery-original", name)).toString("base64"), value.bytes);
  assert.deepEqual(fs.readFileSync(path.join(destination, "assets", "raw-asset.bin")), Buffer.from([0, 1, 255]));
  const app = new Application({ directory: destination }); t.after(() => app.close());
  assert.equal(app.store.get("paid").state, "running"); assert.equal(app.store.get("paid").remote.id, "paid-remote");
  for (const id of ["queued", "failed"]) { assert.equal(app.store.get(id).state, "needs_review"); assert.equal(app.store.get(id).createAuthorization, null); assert.equal(app.store.get(id).error.definitelyNotAccepted, false); }
  assert.equal(app.store.get("cancelled").state, "cancelled");
  assert.equal(app.store.batches.get("batch").state, "paused");
  assert.equal(app.settings.lanes[lane.id].paused, true); assert.equal(app.settings.lanes[lane.id].concurrency, 3);
  assert.ok([...app.scheduler.lanes.values()].every(entry => entry.paused));
  assert.equal(app.scheduler.started, false);
  await app.start();
  assert.equal(app.scheduler.work.size, 0, "starting without credentials does not contact a provider");
  if (process.platform !== "win32") for (const value of Object.values(contents(destination))) assert.equal(value.mode & 0o777, 0o600);
});

test("journal replay preserves shared model references and quarantines changed or cleared paid identities", (t) => {
  const { source, destination } = setup(t);
  snapshot(source, [job("known", { state: "running", remote: { id: "original-paid" } }), job("cleared", { state: "running", remote: { id: "other-paid" } })]);
  const ref = crypto.createHash("sha256").update(JSON.stringify(model)).digest("hex");
  const event = (seq, jobId, patch) => ({ v: 1, seq, type: "job", jobId, at: new Date().toISOString(), ...patch });
  fs.writeFileSync(path.join(source, "jobs.ndjson"), [event(11, "known", { remote: { id: "wrong-paid" }, modelConfigRef: ref }), event(12, "cleared", { state: "queued", remote: null }), event(13, "new", job("new"))].map(value => JSON.stringify(value) + "\n").join(""));
  const result = recoverData({ source, destination });
  const report = JSON.parse(fs.readFileSync(result.reportPath));
  assert.equal(result.quarantinedJobs, 2);
  assert.deepEqual(report.quarantinedJobs[0].observedRemoteIds, ["original-paid", "wrong-paid"]);
  const store = new JobStore(destination); t.after(() => store.close());
  assert.equal(store.get("new").state, "needs_review"); assert.deepEqual(store.get("new").modelConfig, model);
});

test("globally ambiguous data refuses recovery without publishing or changing original bytes", (t) => {
  const variants = [
    "{broken}\n", '{"v":1',
    JSON.stringify({ v: 1, seq: 12, type: "job", jobId: "good", state: "queued" }) + "\n",
    JSON.stringify({ v: 1, seq: 11, type: "job", jobId: "missing", remote: { id: "paid" }, state: "running" }) + "\n",
    JSON.stringify({ v: 1, seq: 11, type: "job", jobId: "good", modelConfigRef: "unknown" }) + "\n",
    JSON.stringify({ v: 1, seq: 9, type: "job", jobId: "good", modelConfigRef: "unknown" }) + "\n",
    JSON.stringify({ v: 1, seq: 11, type: "job", jobId: "good", id: "alias", remote: { id: "paid" } }) + "\n",
  ];
  for (const data of variants) {
    const { source, destination, root } = setup(t); snapshot(source, [job("good")]); fs.writeFileSync(path.join(source, "jobs.ndjson"), data);
    const before = contents(source);
    assert.throws(() => recoverData({ source, destination }), { code: "recoveryAmbiguousStore" });
    assert.deepEqual(contents(source), before); assert.equal(fs.existsSync(destination), false);
    assert.deepEqual(fs.readdirSync(root), ["old"], "no failed staging tree remains");
  }
});

test("active locks, symlinks, nested destinations and existing targets fail closed", (t) => {
  const { source, destination, root } = setup(t); snapshot(source, [job("good")]);
  const lock = new InstanceLock(source, 0); lock.acquire();
  try { assert.throws(() => recoverData({ source, destination }), { code: "dataLocked" }); } finally { lock.release(); }
  fs.mkdirSync(destination); fs.writeFileSync(path.join(destination, "sentinel"), "never overwrite");
  assert.throws(() => recoverData({ source, destination }), { code: "recoveryDestinationExists" });
  assert.equal(fs.readFileSync(path.join(destination, "sentinel"), "utf8"), "never overwrite");
  assert.throws(() => recoverData({ source, destination: path.join(source, "new") }), { code: "recoveryUnsafeDestination" });
  const outside = path.join(root, "outside"); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, "secret"), "outside");
  fs.symlinkSync(outside, path.join(source, "assets"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => recoverData({ source, destination: path.join(root, "symlink-target") }), { code: "recoveryUnsafePath" });
  assert.equal(fs.readFileSync(path.join(outside, "secret"), "utf8"), "outside");
});

test("CLI requires explicit separate paths and reports a paused recovery without starting a server", (t) => {
  const { source, destination } = setup(t); snapshot(source, [job("queued")]);
  const script = path.resolve(__dirname, "../scripts/recover-data.cjs");
  const invalid = spawnSync(process.execPath, [script, "--source", source], { encoding: "utf8" });
  assert.equal(invalid.status, 1); assert.match(invalid.stderr, /recoveryArgumentsRequired/);
  const result = spawnSync(process.execPath, [script, "--source", source, "--destination", destination], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /recovery-report.json/); assert.match(result.stdout, /server was not started/);
  assert.equal(fs.existsSync(path.join(destination, "lock")), false);
});

test("paid identities in snapshot-covered journal records cannot be hidden by a damaged snapshot", (t) => {
  const { source, destination } = setup(t); snapshot(source, [job("known")]);
  fs.writeFileSync(path.join(source, "jobs.ndjson"), JSON.stringify({ v: 1, seq: 9, type: "job", jobId: "known", remote: { id: "older-paid-id" } }) + "\n");
  const result = recoverData({ source, destination }), report = JSON.parse(fs.readFileSync(result.reportPath));
  assert.equal(result.retainedJobs, 0); assert.equal(result.quarantinedJobs, 1);
  assert.ok(report.quarantinedJobs[0].reasons.includes("remoteIdentityChanged"));
  assert.deepEqual(report.observedPaidReferences, [{ jobId: "known", remoteIds: ["older-paid-id"] }]);
});

test("stale lock bytes are retained as evidence while only lock metadata changes in source", (t) => {
  const { source, destination } = setup(t); snapshot(source, [job("queued")]);
  const child = spawnSync(process.execPath, ["-e", "console.log(process.pid)"], { encoding: "utf8" });
  const oldLock = JSON.stringify({ pid: Number(child.stdout.trim()), token: crypto.randomUUID(), startedAt: new Date().toISOString() });
  fs.writeFileSync(path.join(source, "lock"), oldLock);
  const before = contents(source); recoverData({ source, destination });
  assert.equal(fs.readFileSync(path.join(destination, "recovery-original", "lock"), "utf8"), oldLock);
  delete before.lock; assert.deepEqual(contents(source), before);
});

test("publication errors leave no destination or incomplete staging and always release source lock", (t) => {
  const { source, destination, root } = setup(t); snapshot(source, [job("queued")]);
  const before = contents(source), rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (to === destination) {
      assert.equal(fs.existsSync(to), false, "publication never requires replacing an empty destination on Windows");
      throw Object.assign(new Error("simulated Windows publication refusal"), { code: "EPERM" });
    }
    return rename(from, to);
  };
  try { assert.throws(() => recoverData({ source, destination }), { code: "EPERM" }); } finally { fs.renameSync = rename; }
  assert.deepEqual(contents(source), before); assert.equal(fs.existsSync(destination), false); assert.deepEqual(fs.readdirSync(root), ["old"]);
});

test("process death immediately before atomic publication never exposes a partial destination", (t) => {
  const { source, destination, root } = setup(t); snapshot(source, [job("queued")]);
  const before = contents(source);
  const script = `const fs=require('node:fs');const rename=fs.renameSync;fs.renameSync=(from,to)=>{if(to===process.argv[2]){fs.writeSync(1,'before-publish');process.kill(process.pid,'SIGKILL');}return rename(from,to);};require(process.argv[3]).recoverData({source:process.argv[1],destination:process.argv[2]});`;
  const child = spawnSync(process.execPath, ["-e", script, source, destination, require.resolve("../src/store/recovery")], { encoding: "utf8", timeout: 10000 });
  assert.equal(child.stdout, "before-publish"); assert.ok(child.signal === "SIGKILL" || process.platform === "win32" && child.status !== 0);
  assert.equal(fs.existsSync(destination), false);
  const after = contents(source); delete after.lock; assert.deepEqual(after, before);
  const staging = fs.readdirSync(root).find(name => name.startsWith(".videogen-recovery-") && fs.statSync(path.join(root, name)).isDirectory());
  assert.ok(staging); assert.equal(fs.readFileSync(path.join(root, staging, "recovery-original", "jobs.snapshot.ndjson"), "base64"), before["jobs.snapshot.ndjson"].bytes);
  assert.throws(() => recoverData({ source, destination }), { code: "recoveryDestinationReserved" });
});

test("duplicate snapshot identities, truncated snapshots and invalid UTF-8 refuse publication", (t) => {
  for (const kind of ["duplicate", "truncated", "utf8"]) {
    const { source, destination } = setup(t); snapshot(source, [job("good")], kind === "duplicate" ? 1 : 2);
    if (kind === "duplicate") {
      const data = JSON.parse(fs.readFileSync(path.join(source, "jobs.snapshot.json"))); data.jobs.push(data.jobs[0]); fs.writeFileSync(path.join(source, "jobs.snapshot.json"), JSON.stringify(data));
    } else if (kind === "truncated") {
      const filename = path.join(source, "jobs.snapshot.ndjson"); const lines = fs.readFileSync(filename, "utf8").trimEnd().split("\n"); lines.pop(); fs.writeFileSync(filename, lines.join("\n") + "\n");
    } else fs.writeFileSync(path.join(source, "jobs.ndjson"), Buffer.from([0xff, 0x0a]));
    const before = contents(source); assert.throws(() => recoverData({ source, destination }), { code: "recoveryAmbiguousStore" });
    assert.equal(fs.existsSync(destination), false); assert.deepEqual(contents(source), before);
  }
});

test("missing output paths quarantine attributable paid jobs instead of making the recovered application unstartable", async (t) => {
  const { source, destination } = setup(t);
  snapshot(source, [job("good", { state: "downloading", remote: { id: "good-paid" } }), job("missing", { state: "downloading", remote: { id: "missing-path-paid" }, targetPath: undefined }), job("invalid-succeeded", { state: "succeeded", remote: { id: "saved-paid" }, output: { bytes: 12 } })]);
  const result = recoverData({ source, destination });
  assert.equal(result.retainedPaidJobs, 1); assert.equal(result.quarantinedJobs, 2);
  const app = new Application({ directory: destination }); t.after(() => app.close());
  await app.start();
  assert.equal(app.store.get("good").remote.id, "good-paid"); assert.equal(app.scheduler.work.size, 0);
  const report = JSON.parse(fs.readFileSync(result.reportPath));
  assert.ok(report.quarantinedJobs.every(entry => entry.reasons.includes("invalidOutputPath")));
  assert.deepEqual(report.quarantinedJobs.flatMap(entry => entry.observedRemoteIds), ["missing-path-paid", "saved-paid"]);
});

test("invalid persisted scheduling values quarantine paid jobs while zero RPM and sparse legacy models can still poll", async (t) => {
  const { source, destination } = setup(t);
  const bad = [{ rpm: -1 }, { pollIntervalSec: 1e308 }, { resultTtlHours: -1 }, { concurrencyDefault: 0 }, { typicalRenderSec: 1e308 }];
  snapshot(source, [
    ...bad.map((patch, index) => job(`bad-timing-${index}`, { state: "running", remote: { id: `paid-bad-${index}` }, modelConfig: { id: model.id, ...patch } })),
    job("unlimited", { state: "running", remote: { id: "paid-unlimited" }, modelConfig: { id: model.id, rpm: 0 }, requiresKey: false }),
    job("legacy", { state: "running", remote: { id: "paid-legacy" }, modelConfig: { id: model.id }, requiresKey: false }),
  ]);
  const result = recoverData({ source, destination });
  assert.equal(result.retainedPaidJobs, 2); assert.equal(result.quarantinedJobs, bad.length);
  const report = JSON.parse(fs.readFileSync(result.reportPath));
  assert.ok(report.quarantinedJobs.every(entry => entry.reasons.includes("invalidModelScheduling") && entry.observedRemoteIds.length === 1));
  const app = new Application({ directory: destination }); t.after(() => app.close());
  const polled = new Set();
  app.scheduler.adapters["openai-compatible"] = { validateKey: () => null, async poll(ctx, job) { polled.add(job.id); return { status: "running" }; } };
  app.scheduler.context = () => ({});
  await app.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([...polled].sort(), ["legacy", "unlimited"]);
  assert.equal(app.scheduler.health().healthy, true);
});
