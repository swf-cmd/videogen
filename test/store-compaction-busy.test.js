const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { JobStore } = require("../src/store/job-store");

function job(id, patch = {}) {
  return { id, batchId: "batch-a", state: "queued", prompt: id, params: {}, assets: [], remote: null,
    attempts: { create: 0, poll: 0, download: 0 }, ...patch };
}
function failure(code) { return Object.assign(new Error(`injected ${code}`), { code }); }
function snapshotTemporary(filename) { return /^jobs\.snapshot\.ndjson\..+\.tmp$/.test(path.basename(String(filename))); }
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-compaction-busy-"));
  const value = { dir, store: new JobStore(dir) };
  t.after(async () => {
    value.store?.close();
    await value.store?.compacting?.catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return value;
}

test("persistent snapshot rename and cleanup contention retains one temporary, then automatically recovers", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { dir, store } = fixture(t);
  const target = path.join(dir, "jobs.snapshot.ndjson");
  const rename = fs.renameSync, unlink = fs.unlinkSync, unlinkAsync = fs.promises.unlink, openAsync = fs.promises.open;
  let held = true, snapshotsOpened = 0;
  t.mock.method(fs, "renameSync", (source, destination) => {
    if (held && destination === target) throw failure("EBUSY");
    return rename(source, destination);
  });
  t.mock.method(fs, "unlinkSync", filename => {
    if (held && snapshotTemporary(filename) && fs.existsSync(filename)) throw failure("EPERM");
    return unlink(filename);
  });
  t.mock.method(fs.promises, "unlink", async filename => {
    if (held && snapshotTemporary(filename) && fs.existsSync(filename)) throw failure("EPERM");
    return unlinkAsync.call(fs.promises, filename);
  });
  t.mock.method(fs.promises, "open", (...args) => {
    if (snapshotTemporary(args[0])) snapshotsOpened += 1;
    return openAsync.apply(fs.promises, args);
  });
  const notices = [];
  store.on("maintenance", notice => notices.push(notice));
  store.add(job("before"));
  await store.compactAsync();
  const retained = store.compactionTemporary;
  assert.equal(fs.existsSync(retained), true);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    store.add(job(`during-${attempt}`));
    t.mock.timers.tick(30000);
    assert.ok(store.compacting, "the scheduled retry runs without an explicit compact call");
    await store.compacting;
    assert.equal(Boolean(store.failed), false);
    assert.equal(store.compactionTemporary, retained);
    assert.equal(snapshotsOpened, 1, "a held temporary prevents allocating another full snapshot");
    assert.deepEqual(fs.readdirSync(dir).filter(snapshotTemporary), [path.basename(retained)]);
  }
  assert.equal(notices.length, 4);
  assert.ok(notices.every(notice => notice.code === "compactionDeferred" && notice.retryAfterMs <= 30000));
  held = false;
  t.mock.timers.tick(30000);
  assert.ok(store.compacting);
  await store.compacting;
  assert.equal(Boolean(store.failed), false);
  assert.equal(store.compacting, null);
  assert.equal(store.compactionTemporary, null);
  assert.equal(store.compactionRetryAt, 0);
  assert.equal(store.compactionTimer, null);
  assert.equal(snapshotsOpened, 2);
  assert.deepEqual(fs.readdirSync(dir).filter(snapshotTemporary), []);
  assert.equal(fs.statSync(path.join(dir, "jobs.ndjson")).size, 0);
  store.add(job("after"));
  const expected = [...store.jobs.keys()];
  store.close();
  const reopened = new JobStore(dir);
  try { assert.deepEqual([...reopened.jobs.keys()], expected); } finally { reopened.close(); }
});

test("nontransient temporary cleanup failure poisons the store and clears the compaction promise", async (t) => {
  const { dir, store } = fixture(t);
  const rename = fs.renameSync, unlinkAsync = fs.promises.unlink;
  store.add(job("preserved"));
  t.mock.method(fs, "renameSync", (source, destination) => {
    if (destination === path.join(dir, "jobs.snapshot.ndjson")) throw failure("EBUSY");
    return rename(source, destination);
  });
  t.mock.method(fs.promises, "unlink", async filename => {
    if (snapshotTemporary(filename) && fs.existsSync(filename)) throw failure("EIO");
    return unlinkAsync.call(fs.promises, filename);
  });
  await assert.rejects(store.compactAsync(), { code: "EIO" });
  assert.equal(store.failed, true);
  assert.equal(store.compacting, null);
  assert.equal(store.compactionTimer, null);
  assert.throws(() => store.add(job("must-not-write")), { code: "storeClosed" });
  await assert.rejects(store.compactAsync(), { code: "storeClosed" });
  store.close();
  const reopened = new JobStore(dir);
  try { assert.deepEqual([...reopened.jobs.keys()], ["preserved"]); } finally { reopened.close(); }
});

test("synchronous snapshot rename contention leaves the journal writable and restartable", (t) => {
  const { dir, store } = fixture(t);
  const rename = fs.renameSync;
  t.mock.method(fs, "renameSync", (source, destination) => {
    if (destination === path.join(dir, "jobs.snapshot.ndjson")) throw failure("EPERM");
    return rename(source, destination);
  });
  store.add(job("before"));
  const original = fs.fstatSync(store.fd), notices = [];
  store.on("maintenance", notice => notices.push(notice));
  assert.doesNotThrow(() => store.compact());
  assert.equal(Boolean(store.failed), false);
  assert.equal(fs.fstatSync(store.fd).ino, original.ino);
  assert.equal(notices.length, 1);
  store.add(job("after"));
  store.close();
  const reopened = new JobStore(dir);
  try { assert.deepEqual([...reopened.jobs.keys()], ["before", "after"]); } finally { reopened.close(); }
});

test("busy journal replacement cannot reopen or append to a substituted inode", async (t) => {
  const { dir, store } = fixture(t), log = path.join(dir, "jobs.ndjson"), original = `${log}.original`;
  const rename = fs.renameSync, open = fs.openSync;
  const replacement = "unrelated replacement journal\n";
  let replaced = false, appendOpens = 0;
  store.add(job("original-paid", { state: "running", remote: { id: "known-remote" }, attempts: { create: 1, poll: 0, download: 0 } }));
  t.mock.method(fs, "renameSync", (source, destination) => {
    if (destination === log) {
      assert.equal(store.fd, undefined);
      if (!replaced) { rename(log, original); fs.writeFileSync(log, replacement); replaced = true; }
      throw failure("EBUSY");
    }
    return rename(source, destination);
  });
  t.mock.method(fs, "openSync", (filename, flags, ...args) => {
    if (filename === log && (flags === "a" || typeof flags === "number" && flags & fs.constants.O_APPEND)) appendOpens += 1;
    return open(filename, flags, ...args);
  });
  await assert.rejects(store.compactAsync(), { code: "invalidStore" });
  assert.equal(replaced, true);
  assert.equal(store.failed, true);
  assert.equal(store.fd, undefined);
  assert.equal(store.compacting, null);
  assert.equal(appendOpens, 0);
  assert.throws(() => store.update("original-paid", { progress: 60 }), { code: "storeClosed" });
  assert.equal(fs.readFileSync(log, "utf8"), replacement);
  assert.match(fs.readFileSync(original, "utf8"), /known-remote/);
});

test("repeated journal deferral preserves remote-ID fsync boundaries and paid work after SIGKILL", { timeout: 20000 }, (t) => {
  const { dir, store } = fixture(t);
  store.close();
  const child = spawnSync(process.execPath, ["-e", `
    const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
    const { JobStore } = require(process.argv[1]);
    const job = ${job.toString()};
    (async () => {
      const store = new JobStore(process.argv[2]);
      for (let i = 0; i < 3; i += 1) store.add(job("paid-" + i));
      const rename = fs.renameSync, sync = fs.fsyncSync;
      let journalSyncs = 0, deferrals = 0;
      fs.renameSync = (source, target) => {
        if (target === path.join(store.directory, "jobs.ndjson")) throw Object.assign(new Error("busy"), { code: "EBUSY" });
        return rename(source, target);
      };
      fs.fsyncSync = fd => { if (fd === store.fd) journalSyncs += 1; return sync(fd); };
      store.on("maintenance", () => { deferrals += 1; });
      const observations = [];
      for (let i = 0; i < 3; i += 1) {
        const pending = store.compactAsync();
        const id = "paid-" + i, before = journalSyncs;
        store.update(id, { state: "submitting", attempts: { create: 1, poll: 0, download: 0 } }, { sync: false });
        assert.equal(journalSyncs, before + 1);
        let syncedBeforeEvent = false;
        const listener = event => { if (event.jobId === id && event.remote?.id) syncedBeforeEvent = journalSyncs === before + 2; };
        store.on("event", listener);
        store.update(id, { state: "running", remote: { id: "remote-" + i } }, { sync: false });
        store.off("event", listener);
        assert.equal(syncedBeforeEvent, true);
        await pending;
        assert.equal(Boolean(store.failed), false);
        assert.notEqual(store.fd, undefined);
        observations.push(syncedBeforeEvent);
      }
      fs.writeSync(1, JSON.stringify({ deferrals, observations }));
      process.kill(process.pid, "SIGKILL");
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, require.resolve("../src/store/job-store"), dir], { encoding: "utf8", timeout: 15000 });
  assert.equal(child.error, undefined, "child must reach the crash boundary rather than time out");
  assert.ok(child.signal === "SIGKILL" || process.platform === "win32" && Number.isInteger(child.status) && child.status !== 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { deferrals: 3, observations: [true, true, true] });
  const reopened = new JobStore(dir);
  try {
    for (let i = 0; i < 3; i += 1) {
      const saved = reopened.get(`paid-${i}`);
      assert.equal(saved.state, "running");
      assert.equal(saved.remote.id, `remote-${i}`);
      assert.equal(saved.attempts.create, 1);
    }
    reopened.add(job("after-restart"));
    assert.equal(reopened.jobs.size, 4);
  } finally { reopened.close(); }
});

test("an EPERM outside a safe replacement boundary remains a fatal durability failure", async (t) => {
  const { store } = fixture(t);
  store.add(job("preserved"));
  const sync = fs.fsyncSync;
  t.mock.method(fs, "fsyncSync", fd => {
    if (fd === store.fd) throw failure("EPERM");
    return sync(fd);
  });
  const notices = [];
  store.on("maintenance", notice => notices.push(notice));
  await assert.rejects(store.compactAsync(), { code: "EPERM" });
  assert.equal(store.failed, true);
  assert.equal(store.compacting, null);
  assert.deepEqual(notices, []);
  assert.throws(() => store.add(job("must-not-write")), { code: "storeClosed" });
  fs.fsyncSync.mock.restore();
});
