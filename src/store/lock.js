const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const { isMainThread } = require("node:worker_threads");

const PROCESS_IDENTITY = /^(?:(?:linux|darwin):1|win32:[12]):[a-f0-9]{64}$/;
const PROCESS_INSTANCE = Symbol.for("videogen.store.processInstance.v3");
const BIRTH_TIME_TOLERANCE_MS = 2000;
const INSTANCE_TOKEN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

// UTC is useful for confirming an approximate match, but cannot prove PID reuse:
// an earlier wall-clock correction can also explain different start timestamps.
function estimateProcessStart({ now = Date.now, uptime = process.uptime, timeOrigin = performance.timeOrigin } = {}) {
  const before = now();
  const startedAtMs = Math.round(before - uptime() * 1000);
  const after = now();
  return { startedAtMs, clockReliable: after >= before && after - before <= 100 &&
    Math.abs(startedAtMs - timeOrigin) <= BIRTH_TIME_TOLERANCE_MS };
}

function selfProcessIdentity() {
  // process survives a CommonJS module reload. Worker isolates cannot compare
  // their own random token against another isolate that shares the same PID.
  if (!process[PROCESS_INSTANCE]) {
    Object.defineProperty(process, PROCESS_INSTANCE, { value: Object.freeze({
      version: 3, platform: process.platform, ...estimateProcessStart(),
      instanceToken: isMainThread ? crypto.randomUUID() : null,
      kernelIdentity: process.platform === "linux" ? processIdentity(process.pid) : null,
    }) });
  }
  return process[PROCESS_INSTANCE];
}

function validProcessInstance(identity) {
  return identity && typeof identity === "object" && identity.version === 3 &&
    ["linux", "darwin", "win32"].includes(identity.platform) &&
    Number.isSafeInteger(identity.startedAtMs) && identity.startedAtMs > 0 &&
    typeof identity.clockReliable === "boolean";
}

function pidAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1 || pid > 2147483647) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== "ESRCH"; }
}

function readSmallFile(filename) {
  const fd = fs.openSync(filename, "r");
  try {
    const buffer = Buffer.alloc(4097);
    const length = fs.readSync(fd, buffer, 0, buffer.length, 0);
    if (length > 4096) return null;
    return buffer.subarray(0, length).toString("utf8");
  } finally { fs.closeSync(fd); }
}

// Return a stable kernel-backed creation identity, never executable paths or
// command lines. A failed/unsupported query means "unknown", not a dead owner.
function queryProcessIdentity(pid, { platform = process.platform, read = readSmallFile, run = spawnSync } = {}) {
  if (!Number.isSafeInteger(pid) || pid < 1 || pid > 2147483647) return null;
  try {
    let start, startedAtMs = null;
    if (platform === "linux") {
      const boot = read("/proc/sys/kernel/random/boot_id")?.trim();
      const stat = read(`/proc/${pid}/stat`);
      if (!/^[a-f0-9-]{36}$/.test(boot || "") || !stat?.startsWith(`${pid} (`)) return null;
      // comm (field 2) may itself contain spaces or closing parentheses.
      const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
      if (!/^\d+$/.test(fields[19] || "")) return null; // field 22: starttime
      start = `${boot}:${fields[19]}`;
    } else if (platform === "darwin" || platform === "win32") {
      // Windows CI recorded a 2-second cold PowerShell timeout followed by a
      // 414ms warm query. Allow cold host startup without widening other probes.
      const options = { encoding: "utf8", timeout: platform === "win32" ? 5000 : 2000, maxBuffer: 2048, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LC_ALL: "C", LANG: "C", TZ: "UTC" } };
      let result;
      if (platform === "darwin") result = run("/bin/ps", ["-p", String(pid), "-o", "lstart="], options);
      else {
        const powershell = path.win32.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
        // Process.StartTime reads the process handle directly. CIM initializes
        // WMI infrastructure and can exceed the timeout on a cold Windows host.
        const query = `$ErrorActionPreference='Stop'; $p=[System.Diagnostics.Process]::GetProcessById(${pid}); try { [Console]::Out.Write($p.StartTime.ToUniversalTime().Ticks.ToString([Globalization.CultureInfo]::InvariantCulture)) } finally { $p.Dispose() }`;
        result = run(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", query], options);
      }
      if (result.error || result.status !== 0 || typeof result.stdout !== "string") return null;
      start = result.stdout.trim().replace(/\s+/g, " ");
      if (platform === "darwin" ? !/^[A-Za-z]{3} [A-Za-z]{3} \d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/.test(start) : !/^\d{16,20}$/.test(start)) return null;
    } else return null;
    // Native StartTime preserves finer precision than CIM CreationDate. Never
    // compare a v1 CIM value with v2 ticks and mistake a live owner for PID reuse.
    if (platform === "darwin") startedAtMs = Date.parse(`${start} GMT`);
    else if (platform === "win32") startedAtMs = Number((BigInt(start) - 621355968000000000n) / 10000n);
    return { identity: `${platform}:${platform === "win32" ? 2 : 1}:${digest(start)}`, platform,
      startedAtMs: Number.isSafeInteger(startedAtMs) && startedAtMs > 0 ? startedAtMs : null };
  } catch { return null; }
}

function processIdentity(pid, options) {
  return queryProcessIdentity(pid, options)?.identity ?? null;
}

function isExactIdentity(identity) {
  return typeof identity === "string" && PROCESS_IDENTITY.test(identity);
}

function validInstanceToken(token) {
  return typeof token === "string" && INSTANCE_TOKEN.test(token);
}

function exactIdentityStatus(previous, current) {
  // Do not compare different platforms/identity versions after a folder move.
  if (!isExactIdentity(previous) || !isExactIdentity(current) ||
      current.split(":").slice(0, 2).join(":") !== previous.split(":").slice(0, 2).join(":")) return null;
  return current === previous
    ? { alive: true, reason: "ownerAlive" }
    : { alive: false, reason: "processInstanceChanged" };
}

function ownerStatus(owner, lookup = queryProcessIdentity, alive = pidAlive,
  { self = selfProcessIdentity(), mainThread = isMainThread } = {}) {
  const unknown = { alive: true, reason: "ownershipUnverifiable" };
  try { if (!alive(owner.pid)) return { alive: false, reason: "ownerExited" }; } catch { return unknown; }
  const previous = owner.processIdentity;
  const instance = validProcessInstance(previous);
  if (!instance && !isExactIdentity(previous)) return unknown;
  if (owner.pid === process.pid) {
    // Never launch a shell to identify ourselves. A main-thread lifetime token
    // is exact across wall-clock changes and boots; worker-local tokens are not.
    if (!mainThread) return unknown;
    if (instance && previous.platform === self.platform &&
        validInstanceToken(previous.instanceToken) && validInstanceToken(self.instanceToken)) {
      return previous.instanceToken === self.instanceToken
        ? { alive: true, reason: "ownerAlive" }
        : { alive: false, reason: "processInstanceChanged" };
    }
    return exactIdentityStatus(instance ? previous.kernelIdentity : previous, self.kernelIdentity) || unknown;
  }
  let current;
  try { current = lookup(owner.pid); } catch { return unknown; }
  if (typeof current === "string") current = { identity: current };
  if (!current) return unknown;
  const exact = exactIdentityStatus(instance ? previous.kernelIdentity : previous, current.identity);
  if (exact) return exact;
  if (instance && previous.platform === current.platform && previous.clockReliable &&
      Number.isSafeInteger(current.startedAtMs) && current.startedAtMs > 0 &&
      Math.abs(previous.startedAtMs - current.startedAtMs) <= BIRTH_TIME_TOLERANCE_MS) {
    return { alive: true, reason: "processStartMatches" };
  }
  // A timestamp mismatch is not proof of death. Keep the lock when a creation
  // identity was not recorded, including across reboots or wall-clock jumps.
  return unknown;
}

function ownerAlive(owner, lookup, alive, options) {
  return ownerStatus(owner, lookup, alive, options).alive;
}

function locked(reason = "ownershipUnverifiable") {
  return Object.assign(new Error("dataLocked"), { code: "dataLocked", details: { reason } });
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readOwner(filename) {
  let fd;
  try {
    fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stats = fs.fstatSync(fd);
    if (!stats.isFile()) throw locked();
    const text = fs.readFileSync(fd, "utf8");
    let owner;
    try { owner = JSON.parse(text); } catch { throw locked(); }
    if (!Number.isSafeInteger(owner.pid) || owner.pid < 1 || owner.pid > 2147483647) throw locked();
    return { ...owner, identity: digest(`${stats.dev}:${stats.ino}:${text}`), dev: stats.dev, ino: stats.ino };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function sameOwner(filename, expected) {
  try { return readOwner(filename).identity === expected.identity; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

class InstanceLock {
  constructor(directory, port, checkpoint = () => {}, { lookupIdentity = queryProcessIdentity, isAlive = pidAlive,
    selfIdentity = selfProcessIdentity(), mainThread = isMainThread } = {}) {
    this.directory = directory;
    this.filename = path.join(directory, "lock");
    this.port = port;
    this.checkpoint = checkpoint;
    this.lookupIdentity = lookupIdentity;
    this.isAlive = isAlive;
    this.processIdentity = selfIdentity;
    this.identityOptions = { self: selfIdentity, mainThread };
  }

  assertStale(owner) {
    const status = ownerStatus(owner, this.lookupIdentity, this.isAlive, this.identityOptions);
    if (status.alive) throw locked(status.reason);
  }

  create() {
    const temporary = path.join(this.directory, `.lock-owner-${process.pid}-${crypto.randomUUID()}.tmp`);
    const fd = fs.openSync(temporary, "wx", 0o600);
    const stats = fs.fstatSync(fd);
    let published = false;
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, processIdentity: this.processIdentity, port: this.port, startedAt: new Date().toISOString(), token: crypto.randomUUID() }));
      fs.fsyncSync(fd);
      fs.linkSync(temporary, this.filename);
      published = true;
      this.owner = readOwner(this.filename);
      this.fd = fd;
    } catch (error) {
      fs.closeSync(fd);
      if (published) {
        const current = fs.lstatSync(this.filename, { throwIfNoEntry: false });
        if (current?.dev === stats.dev && current?.ino === stats.ino) fs.unlinkSync(this.filename);
      }
      throw error;
    } finally { fs.unlinkSync(temporary); }
  }

  claim(generation) {
    let filename = path.join(this.directory, `.lock-reclaim-${generation.identity}`);
    const previous = [];
    for (let depth = 0; depth < 100; depth += 1) {
      const temporary = path.join(this.directory, `.lock-claim-${process.pid}-${crypto.randomUUID()}.tmp`);
      const fd = fs.openSync(temporary, "wx", 0o600);
      try {
        fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, processIdentity: this.processIdentity, token: crypto.randomUUID() }));
        fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
      try {
        fs.linkSync(temporary, filename);
        const owner = readOwner(filename);
        return { filename, owner, previous };
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      } finally { fs.unlinkSync(temporary); }
      const owner = readOwner(filename);
      this.assertStale(owner);
      previous.push({ filename, owner });
      // Dead reclaimers are followed, never unlinked and raced for again.
      filename = path.join(this.directory, `.lock-reclaim-${digest(`${filename}:${owner.identity}`)}`);
    }
    throw locked();
  }

  releaseClaim(claim) {
    for (const entry of [claim, ...claim.previous]) {
      if (sameOwner(entry.filename, entry.owner)) {
        try { fs.unlinkSync(entry.filename); }
        catch (error) { if (error.code !== "ENOENT") throw error; }
      }
    }
  }

  acquire() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        this.create();
        return;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      let old;
      try { old = readOwner(this.filename); }
      catch (error) { if (error.code === "ENOENT") continue; throw error; }
      this.assertStale(old);
      let claim;
      try { claim = this.claim(old); }
      catch (error) {
        // A winning reclaimer can remove its marker between our EEXIST and
        // readOwner. Recheck the canonical lock instead of reusing an old
        // generation; a live winner must now prevent this acquisition.
        if (error.code === "ENOENT") continue;
        throw error;
      }
      try {
        this.checkpoint("lock:reclaimAcquired", old);
        if (!sameOwner(this.filename, old)) continue;
        fs.unlinkSync(this.filename);
        try { this.create(); }
        catch (error) { if (error.code === "EEXIST") throw locked(); throw error; }
        return;
      } finally { this.releaseClaim(claim); }
    }
    throw locked();
  }

  release() {
    if (this.fd === undefined) return;
    const fd = this.fd;
    this.fd = undefined;
    try {
      if (sameOwner(this.filename, this.owner)) fs.unlinkSync(this.filename);
    } finally { fs.closeSync(fd); }
  }
}

module.exports = { InstanceLock, pidAlive, processIdentity, queryProcessIdentity, ownerAlive, ownerStatus, estimateProcessStart };
