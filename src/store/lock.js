const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

function locked() {
  return Object.assign(new Error("dataLocked"), { code: "dataLocked" });
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
    if (!Number.isInteger(owner.pid) || owner.pid < 1) throw locked();
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
  constructor(directory, port, checkpoint = () => {}) {
    this.directory = directory;
    this.filename = path.join(directory, "lock");
    this.port = port;
    this.checkpoint = checkpoint;
  }

  create() {
    const temporary = path.join(this.directory, `.lock-owner-${process.pid}-${crypto.randomUUID()}.tmp`);
    const fd = fs.openSync(temporary, "wx", 0o600);
    const stats = fs.fstatSync(fd);
    let published = false;
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, port: this.port, startedAt: new Date().toISOString(), token: crypto.randomUUID() }));
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
        fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token: crypto.randomUUID() }));
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
      if (pidAlive(owner.pid)) throw locked();
      previous.push({ filename, owner });
      // Dead reclaimers are followed, never unlinked and raced for again.
      filename = path.join(this.directory, `.lock-reclaim-${digest(`${filename}:${owner.identity}`)}`);
    }
    throw locked();
  }

  releaseClaim(claim) {
    for (const entry of [claim, ...claim.previous]) {
      if (sameOwner(entry.filename, entry.owner)) fs.unlinkSync(entry.filename);
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
      if (pidAlive(old.pid)) throw locked();
      const claim = this.claim(old);
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

module.exports = { InstanceLock, pidAlive };
