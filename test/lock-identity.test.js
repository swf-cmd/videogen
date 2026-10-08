const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { InstanceLock, processIdentity, ownerAlive } = require("../src/store/lock");

const oldIdentity = `${process.platform}:1:${"a".repeat(64)}`;
const newIdentity = `${process.platform}:1:${"b".repeat(64)}`;
function directory(t) {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-lock-identity-"));
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}

// Keep this a real OS lookup rather than a fixture: changes to ps/CIM/proc
// behavior should be caught on each platform in the native CI matrix.
test("native process creation identity is present and stable across independent lookups", { timeout: 8000 }, () => {
  const first = processIdentity(process.pid);
  const second = processIdentity(process.pid);
  assert.match(first || "", new RegExp(`^${process.platform}:1:[a-f0-9]{64}$`));
  assert.equal(second, first);
  assert.equal(processIdentity(-1), null);
});

test("a reused live PID with a different creation identity permits exclusive stale-lock recovery", (t) => {
  const dir = directory(t), filename = path.join(dir, "lock");
  fs.writeFileSync(filename, JSON.stringify({ pid: process.pid, processIdentity: oldIdentity, token: "former-process" }));
  let observedClaim = false;
  const lock = new InstanceLock(dir, 5177, (name) => {
    if (name !== "lock:reclaimAcquired") return;
    const marker = fs.readdirSync(dir).find(value => value.startsWith(".lock-reclaim-"));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, marker), "utf8")).processIdentity, newIdentity);
    observedClaim = true;
  }, { lookupIdentity: () => newIdentity, isAlive: () => true });
  lock.acquire();
  try {
    assert.equal(observedClaim, true);
    const saved = JSON.parse(fs.readFileSync(filename, "utf8"));
    assert.equal(saved.processIdentity, newIdentity);
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
  ]) {
    const dir = directory(t), filename = path.join(dir, "lock");
    const original = JSON.stringify({ pid: process.pid, processIdentity: ownerIdentity, token: name });
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
  const lock = new InstanceLock(dir, 0, undefined, { lookupIdentity: () => newIdentity, isAlive: pid => pid === process.pid });
  lock.acquire(); lock.release();
  assert.equal(fs.existsSync(filename), false);
  const previous = path.join(dir, ".lock-reclaim-test-generation");
  fs.writeFileSync(previous, JSON.stringify({ pid: process.pid, processIdentity: oldIdentity, token: "dead-reclaimer" }));
  const claim = lock.claim({ identity: "test-generation" });
  assert.equal(claim.previous.length, 1);
  assert.equal(claim.previous[0].filename, previous);
  assert.notEqual(claim.filename, previous);
  assert.equal(claim.owner.processIdentity, newIdentity);
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
      assert.ok(options.timeout > 0 && options.timeout <= 2000);
      assert.ok(options.maxBuffer <= 2048);
      assert.equal(options.windowsHide, true);
      assert.deepEqual(options.stdio, ["ignore", "pipe", "pipe"]);
      assert.doesNotMatch(args.join(" "), /commandline|executablepath|select \*/i);
      return { status: 0, stdout: platform === "darwin" ? "Thu Oct  8 16:00:00 2026\n" : "639112608000000000" };
    } });
    assert.equal(calls, 1);
    assert.match(identity || "", new RegExp(`^${platform}:1:[a-f0-9]{64}$`));
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
