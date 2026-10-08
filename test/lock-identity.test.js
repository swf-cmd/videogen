const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { InstanceLock, processIdentity, queryProcessIdentity, ownerAlive, ownerStatus, estimateProcessStart } = require("../src/store/lock");

const oldIdentity = `${process.platform}:1:${"a".repeat(64)}`;
const newIdentity = `${process.platform}:1:${"b".repeat(64)}`;
const foreignPid = 2147483646;
const self = { version: 3, platform: process.platform, startedAtMs: Date.now(), clockReliable: true,
  instanceToken: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", kernelIdentity: newIdentity };
function directory(t) {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-lock-identity-"));
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}

// Keep this a real OS lookup rather than a fixture: changes to ps/StartTime/proc
// behavior should be caught on each platform in the native CI matrix.
test("native process creation identity is stable after at most one conservative Windows cold-start timeout", { timeout: process.platform === "win32" ? 18000 : 8000 }, (t) => {
  const { spawnSync } = require("node:child_process");
  const samples = [];
  const run = (executable, args, options) => {
    const started = Date.now();
    const result = spawnSync(executable, args, options);
    samples.push({ durationMs: Date.now() - started, status: result.status,
      errorCode: /^[A-Z][A-Z0-9_]*$/.test(result.error?.code || "") ? result.error.code : result.error ? "UNKNOWN" : null });
    return result;
  };
  let first = processIdentity(process.pid, { run });
  // Cold PowerShell startup may consume its bounded production query budget.
  // Verify that exact degradation once, then still require two real successes.
  if (process.platform === "win32" && first === null && samples.length === 1 && samples[0].errorCode === "ETIMEDOUT") {
    assert.deepEqual(ownerStatus({ pid: foreignPid, processIdentity: oldIdentity }, () => first, () => true),
      { alive: true, reason: "ownershipUnverifiable" });
    t.diagnostic(`Cold native identity query timed out; the live owner remains locked: ${JSON.stringify(samples)}`);
    first = processIdentity(process.pid, { run });
  }
  const second = processIdentity(process.pid, { run });
  // Diagnostics intentionally exclude stderr, command arguments and environment.
  const evidence = JSON.stringify(samples);
  assert.match(first || "", new RegExp(`^${process.platform}:${process.platform === "win32" ? 2 : 1}:[a-f0-9]{64}$`), evidence);
  assert.equal(second, first, evidence);
  assert.equal(processIdentity(-1), null);
});

test("a timed-out Windows identity query remains unknown rather than reclaiming a live foreign owner", () => {
  const lookup = pid => queryProcessIdentity(pid, { platform: "win32", run: () => ({
    status: null, error: Object.assign(new Error("bounded native query timed out"), { code: "ETIMEDOUT" }),
  }) });
  assert.equal(lookup(foreignPid), null);
  assert.deepEqual(ownerStatus({ pid: foreignPid, processIdentity: `win32:2:${"a".repeat(64)}` }, lookup, () => true),
    { alive: true, reason: "ownershipUnverifiable" });
});

test("a reused live PID with a different creation identity permits exclusive stale-lock recovery", (t) => {
  const dir = directory(t), filename = path.join(dir, "lock");
  fs.writeFileSync(filename, JSON.stringify({ pid: foreignPid, processIdentity: oldIdentity, token: "former-process" }));
  let observedClaim = false;
  const lock = new InstanceLock(dir, 5177, (name) => {
    if (name !== "lock:reclaimAcquired") return;
    const marker = fs.readdirSync(dir).find(value => value.startsWith(".lock-reclaim-"));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, marker), "utf8")).processIdentity, self);
    observedClaim = true;
  }, { lookupIdentity: () => newIdentity, isAlive: () => true, selfIdentity: self });
  lock.acquire();
  try {
    assert.equal(observedClaim, true);
    const saved = JSON.parse(fs.readFileSync(filename, "utf8"));
    assert.deepEqual(saved.processIdentity, self);
    assert.equal(saved.pid, process.pid);
    assert.notEqual(saved.token, "former-process");
    assert.equal(fs.readdirSync(dir).some(value => value.startsWith(".lock-reclaim-")), false);
  } finally { lock.release(); }
  assert.equal(fs.existsSync(filename), false);
});

test("same identity, legacy live owner and failed identity queries remain locked without changing records", (t) => {
  for (const [name, ownerIdentity, lookup] of [
    ["same", newIdentity, () => newIdentity],
    ["legacy", undefined, () => newIdentity],
    ["unavailable", oldIdentity, () => null],
    ["failed", oldIdentity, () => { throw new Error("lookup failed"); }],
    ["unknown version", "future:2:opaque", () => newIdentity],
    ["malformed object", { toString: "untrusted", version: 0 }, () => newIdentity],
  ]) {
    const dir = directory(t), filename = path.join(dir, "lock");
    const original = JSON.stringify({ pid: foreignPid, processIdentity: ownerIdentity, token: name });
    fs.writeFileSync(filename, original);
    const lock = new InstanceLock(dir, 0, undefined, { lookupIdentity: lookup, isAlive: () => true });
    assert.throws(() => lock.acquire(), { code: "dataLocked" }, name);
    assert.equal(fs.readFileSync(filename, "utf8"), original, name);
    assert.deepEqual(fs.readdirSync(dir), ["lock"], name);
  }
  assert.equal(ownerAlive({ pid: process.pid, processIdentity: oldIdentity }, () => newIdentity, () => { throw new Error("permission denied"); }), true);
});

test("dead legacy owners still recover and reused reclaimer PIDs retain the successor-claim protocol", (t) => {
  const dir = directory(t), filename = path.join(dir, "lock");
  fs.writeFileSync(filename, JSON.stringify({ pid: 2147483647, token: "dead-legacy" }));
  const lock = new InstanceLock(dir, 0, undefined, { lookupIdentity: () => newIdentity, isAlive: pid => pid === process.pid || pid === foreignPid, selfIdentity: self });
  lock.acquire(); lock.release();
  assert.equal(fs.existsSync(filename), false);
  const previous = path.join(dir, ".lock-reclaim-test-generation");
  fs.writeFileSync(previous, JSON.stringify({ pid: foreignPid, processIdentity: oldIdentity, token: "dead-reclaimer" }));
  const claim = lock.claim({ identity: "test-generation" });
  assert.equal(claim.previous.length, 1);
  assert.equal(claim.previous[0].filename, previous);
  assert.notEqual(claim.filename, previous);
  assert.deepEqual(claim.owner.processIdentity, self);
  assert.equal(fs.existsSync(previous), true, "the old marker stays immutable until successor release");
  lock.releaseClaim(claim);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test("platform identity probes are bounded and omit command-line or executable metadata", () => {
  for (const platform of ["darwin", "win32"]) {
    let calls = 0;
    const identity = processIdentity(1234, { platform, run(executable, args, options) {
      calls += 1;
      assert.ok(path[platform === "win32" ? "win32" : "posix"].isAbsolute(executable));
      assert.equal(options.timeout, platform === "win32" ? 5000 : 2000);
      assert.ok(options.maxBuffer <= 2048);
      assert.equal(options.windowsHide, true);
      assert.deepEqual(options.stdio, ["ignore", "pipe", "pipe"]);
      assert.doesNotMatch(args.join(" "), /commandline|executablepath|select \*/i);
      if (platform === "win32") {
        assert.match(args.join(" "), /System\.Diagnostics\.Process.*GetProcessById\(1234\)/);
        assert.doesNotMatch(args.join(" "), /CimInstance|CreationDate/i);
      }
      return { status: 0, stdout: platform === "darwin" ? "Thu Oct  8 16:00:00 2026\n" : "639112608000000000" };
    } });
    assert.equal(calls, 1);
    assert.match(identity || "", new RegExp(`^${platform}:${platform === "win32" ? 2 : 1}:[a-f0-9]{64}$`));
    for (const result of [{ error: new Error("timed out") }, { status: 1, stdout: "error" }, { status: 0, stdout: "unrecognized" }]) {
      assert.equal(processIdentity(1234, { platform, run: () => result }), null);
    }
  }
});

test("Linux identity uses boot ID and start ticks even when process names contain parentheses", () => {
  let ticks = "123456", boot = "45e7096e-4a22-400b-9204-c93a00cecf17";
  const read = filename => filename.endsWith("boot_id") ? `${boot}\n` : `1234 (private ) process name) ${["S", ...Array(18).fill("0"), ticks, ...Array(30).fill("0")].join(" ")}\n`;
  const first = processIdentity(1234, { platform: "linux", read });
  assert.match(first || "", /^linux:1:[a-f0-9]{64}$/);
  assert.equal(processIdentity(1234, { platform: "linux", read }), first);
  ticks = "123457";
  assert.notEqual(processIdentity(1234, { platform: "linux", read }), first);
  ticks = "123456"; boot = "55e7096e-4a22-400b-9204-c93a00cecf17";
  assert.notEqual(processIdentity(1234, { platform: "linux", read }), first);
  assert.equal(processIdentity(1234, { platform: "linux", read: () => { throw new Error("denied"); } }), null);
});


test("different Windows identity versions do not reclaim a live lock after changing query precision", () => {
  const owner = { pid: process.pid, processIdentity: `win32:1:${"a".repeat(64)}` };
  assert.equal(ownerAlive(owner, () => `win32:2:${"b".repeat(64)}`, () => true), true);
});


test("creating a real lock, same-PID collision and module reload launch no child process", (t) => {
  const dir = directory(t), modulePath = require.resolve("../src/store/lock");
  const childProcess = require("node:child_process"), spawnSync = childProcess.spawnSync;
  let calls = 0;
  childProcess.spawnSync = () => { calls += 1; throw new Error("normal startup must not spawn a process"); };
  let first;
  try {
    delete require.cache[modulePath];
    first = new (require(modulePath).InstanceLock)(dir, 0);
    first.acquire();
    const saved = JSON.parse(fs.readFileSync(path.join(dir, "lock"), "utf8"));
    assert.equal(saved.processIdentity.version, 3);
    assert.ok(Math.abs(saved.processIdentity.startedAtMs - (Date.now() - process.uptime() * 1000)) < 2000);
    delete require.cache[modulePath];
    const second = new (require(modulePath).InstanceLock)(dir, 0);
    assert.equal(second.processIdentity, first.processIdentity, "module reload preserves process lifetime identity");
    assert.throws(() => second.acquire(), { code: "dataLocked", details: { reason: "ownerAlive" } });
    first.release();
    second.acquire(); second.release();
    assert.equal(calls, 0);
  } finally {
    first?.release();
    childProcess.spawnSync = spawnSync;
    delete require.cache[modulePath];
  }
});

test("same-PID instance tokens identify reuse without a lookup and ignore clock changes", (t) => {
  for (const shift of [-86400000, 0, 86400000]) {
    const dir = directory(t);
    const old = { ...self, startedAtMs: self.startedAtMs + shift,
      instanceToken: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
    fs.writeFileSync(path.join(dir, "lock"), JSON.stringify({ pid: process.pid, processIdentity: old }));
    let queries = 0;
    const lock = new InstanceLock(dir, 0, undefined, { selfIdentity: self,
      lookupIdentity: () => { queries += 1; throw new Error("self lookup is forbidden"); } });
    lock.acquire(); lock.release();
    assert.equal(queries, 0);
    assert.equal(ownerAlive({ pid: process.pid, processIdentity: { ...self, startedAtMs: self.startedAtMs + shift } },
      () => { throw new Error("self lookup is forbidden"); }, () => true, { self }), true);
  }
});

test("approximate foreign timestamps only confirm a bounded match, never prove PID reuse", (t) => {
  const approximate = { ...self, kernelIdentity: null };
  for (const difference of [-86400000, -2001, -2000, 0, 2000, 2001, 86400000]) {
    let queries = 0;
    const dir = directory(t), filename = path.join(dir, "lock");
    const record = JSON.stringify({ pid: foreignPid, processIdentity: approximate });
    fs.writeFileSync(filename, record);
    const lookupIdentity = pid => {
      queries += 1;
      assert.equal(pid, foreignPid);
      return { platform: process.platform, startedAtMs: approximate.startedAtMs + difference };
    };
    const lock = new InstanceLock(dir, 0, undefined, { lookupIdentity, isAlive: () => true, selfIdentity: self });
    assert.equal(queries, 0, "construction never queries another process");
    assert.throws(() => lock.acquire(), { code: "dataLocked", details: {
      reason: Math.abs(difference) <= 2000 ? "processStartMatches" : "ownershipUnverifiable",
    } });
    assert.equal(queries, 1, "query only follows a live lock collision");
    assert.equal(fs.readFileSync(filename, "utf8"), record);
    assert.deepEqual(fs.readdirSync(dir), ["lock"]);
  }
  for (const identity of [ { ...approximate, clockReliable: false }, { ...approximate, version: 4 } ]) {
    assert.deepEqual(ownerStatus({ pid: foreignPid, processIdentity: identity },
      () => ({ platform: process.platform, startedAtMs: identity.startedAtMs }), () => true),
    { alive: true, reason: "ownershipUnverifiable" });
  }
});

test("wall-clock jumps cannot make estimated start times trustworthy", () => {
  const timeOrigin = 1700000000000, uptime = () => 10;
  for (const jump of [-3600000, 3600000]) {
    const estimate = estimateProcessStart({ timeOrigin, uptime, now: () => timeOrigin + 10000 + jump });
    assert.equal(estimate.clockReliable, false);
    assert.equal(estimate.startedAtMs, timeOrigin + jump);
  }
  let sample = 0;
  assert.equal(estimateProcessStart({ timeOrigin, uptime, now: () => timeOrigin + 10000 + (sample++ ? 30000 : 0) }).clockReliable, false);
  assert.deepEqual(estimateProcessStart({ timeOrigin, uptime, now: () => timeOrigin + 10000 }),
    { startedAtMs: timeOrigin, clockReliable: true });
});

test("worker isolates sharing the owner's PID cannot reclaim a main-thread lock", { timeout: 15000 }, async (t) => {
  const { Worker } = require("node:worker_threads");
  const dir = directory(t), lock = new InstanceLock(dir, 0);
  lock.acquire(); t.after(() => lock.release());
  const worker = new Worker(`
    const { parentPort, workerData } = require("node:worker_threads");
    const { InstanceLock } = require(workerData.modulePath);
    let queries = 0;
    const lock = new InstanceLock(workerData.dir, 0, undefined, {
      lookupIdentity() { queries += 1; throw new Error("worker must not query its shared PID"); }
    });
    try { lock.acquire(); lock.release(); parentPort.postMessage({ acquired: true }); }
    catch (error) { parentPort.postMessage({ code: error.code, details: error.details,
      token: lock.processIdentity.instanceToken, queries }); }
  `, { eval: true, workerData: { dir, modulePath: require.resolve("../src/store/lock") } });
  t.after(() => worker.terminate());
  const result = await new Promise((resolve, reject) => { worker.once("message", resolve); worker.once("error", reject); });
  assert.deepEqual(result, { code: "dataLocked", details: { reason: "ownershipUnverifiable" }, token: null, queries: 0 });
  assert.equal(fs.existsSync(path.join(dir, "lock")), true);
});

test("OS timestamps use Unix UTC milliseconds for both macOS and Windows", () => {
  const expected = Date.UTC(2026, 9, 8, 16, 0, 0);
  const ticks = (BigInt(expected) * 10000n + 621355968000000000n).toString();
  for (const [platform, stdout] of [["darwin", "Thu Oct  8 16:00:00 2026"], ["win32", ticks]]) {
    const result = queryProcessIdentity(1234, { platform, run: () => ({ status: 0, stdout }) });
    assert.equal(result.startedAtMs, expected);
    assert.equal(result.platform, platform);
  }
});


test("a fresh process creates its first lock without PowerShell or ps", { timeout: 15000 }, (t) => {
  const { spawnSync } = require("node:child_process");
  const dir = directory(t);
  const child = spawnSync(process.execPath, ["-e", `
    const cp = require("node:child_process");
    let calls = 0;
    cp.spawnSync = () => { calls += 1; throw new Error("unexpected child process"); };
    const modulePath = process.argv[1];
    const first = new (require(modulePath).InstanceLock)(process.argv[2], 0);
    first.acquire();
    delete require.cache[modulePath];
    const second = new (require(modulePath).InstanceLock)(process.argv[2], 0);
    let reason;
    try { second.acquire(); } catch (error) { reason = error.details?.reason; }
    first.release();
    second.acquire(); second.release();
    process.stdout.write(JSON.stringify({ calls, reason, same: first.processIdentity === second.processIdentity,
      timestamp: Number.isSafeInteger(first.processIdentity.startedAtMs) }));
  `, require.resolve("../src/store/lock"), dir], { encoding: "utf8", timeout: 10000 });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { calls: 0, reason: "ownerAlive", same: true, timestamp: true });
});

test("new Linux identities still recover verified foreign PID reuse using cheap proc identity", (t) => {
  const dir = directory(t);
  const old = { ...self, platform: "linux", kernelIdentity: `linux:1:${"a".repeat(64)}` };
  fs.writeFileSync(path.join(dir, "lock"), JSON.stringify({ pid: foreignPid, processIdentity: old }));
  let queries = 0;
  const lock = new InstanceLock(dir, 0, undefined, { selfIdentity: self, isAlive: () => true,
    lookupIdentity: () => { queries += 1; return { platform: "linux", identity: `linux:1:${"b".repeat(64)}` }; } });
  lock.acquire(); lock.release();
  assert.equal(queries, 1);
});

test("a same-PID legacy lock without cached native identity stays locked without querying a shell", () => {
  let queries = 0;
  const result = ownerStatus({ pid: process.pid, processIdentity: oldIdentity },
    () => { queries += 1; return newIdentity; }, () => true,
    { self: { ...self, kernelIdentity: null }, mainThread: true });
  assert.deepEqual(result, { alive: true, reason: "ownershipUnverifiable" });
  assert.equal(queries, 0);
});
