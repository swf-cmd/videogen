const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { AssetStore } = require("../src/store/asset-store");

function fixture(width = 1280, height = 720) {
  const buffer = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return { buffer, mimeType: "image/png", width, height };
}

function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-assets-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, store: new AssetStore(directory) };
}

function digest(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }

function descriptor(image) {
  return { role: "first_frame", sha256: digest(image.buffer), mime: image.mimeType, width: image.width, height: image.height };
}

test("assets retain original bytes and dimensions and deduplicate by content", (t) => {
  const { directory, store } = setup(t);
  const image = fixture();
  const asset = store.put(image);
  assert.deepEqual(asset, descriptor(image));
  const firstStat = fs.statSync(store.filename(asset));
  assert.deepEqual(store.put(image), asset);
  assert.equal(fs.statSync(store.filename(asset)).ino, firstStat.ino);
  assert.deepEqual(fs.readdirSync(store.directory), [`${asset.sha256}.png`]);
  const result = new AssetStore(directory).read(asset);
  assert.deepEqual(result.buffer, image.buffer);
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.filename, "first-frame.png");
  assert.equal(result.width, image.width);
  assert.equal(result.height, image.height);
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(store.directory).mode & 0o777, 0o700);
    assert.equal(firstStat.mode & 0o777, 0o600);
  }
});

test("asset reads validate digest, MIME and dimensions before returning content", (t) => {
  const { store } = setup(t);
  const asset = store.put(fixture());
  const filename = store.filename(asset);
  for (const changed of [{ width: 0 }, { width: 1279 }, { height: 721 }, { height: "720" }]) {
    assert.throws(() => store.read({ ...asset, ...changed }), { code: "corruptAsset" });
  }
  const wrongMime = { ...asset, mime: "image/jpeg" };
  fs.copyFileSync(filename, store.filename(wrongMime));
  assert.throws(() => store.read(wrongMime), { code: "corruptAsset" });
  fs.writeFileSync(filename, fixture(1280, 721).buffer);
  assert.throws(() => store.read(asset), { code: "corruptAsset" });
  fs.writeFileSync(filename, Buffer.alloc(0));
  assert.throws(() => store.read(asset), { code: "corruptAsset" });
});

test("asset put rejects invalid uploads and unsafe descriptors without creating files", (t) => {
  const { store } = setup(t);
  for (const image of [null, { ...fixture(), buffer: "text" }, { ...fixture(), width: 0 }, { ...fixture(), height: 700 }, { ...fixture(), mimeType: "image/gif" }, { ...fixture(), buffer: Buffer.alloc(24) }]) {
    assert.throws(() => store.put(image), /invalidAsset/);
  }
  for (const asset of [null, { sha256: "../outside", mime: "image/png" }, { sha256: "A".repeat(64), mime: "image/png" }, { sha256: "a".repeat(64), mime: "image/gif" }]) {
    assert.throws(() => store.filename(asset), /invalidAsset/);
  }
  assert.deepEqual(fs.readdirSync(store.directory), []);
});

test("a known incoming image atomically repairs a corrupt content-addressed file", (t) => {
  const { store } = setup(t);
  const image = fixture();
  const asset = descriptor(image);
  const filename = store.filename(asset);
  fs.writeFileSync(filename, image.buffer.subarray(0, 10), { mode: 0o600 });
  const oldInode = fs.statSync(filename).ino;
  assert.deepEqual(store.put(image), asset);
  assert.deepEqual(store.read(asset).buffer, image.buffer);
  assert.notEqual(fs.statSync(filename).ino, oldInode);
  assert.deepEqual(fs.readdirSync(store.directory), [`${asset.sha256}.png`]);
});

test("symlink and directory assets are rejected without following or replacing them", (t) => {
  const { directory, store } = setup(t);
  const image = fixture();
  const asset = descriptor(image);
  const outside = path.join(directory, "outside.png");
  fs.writeFileSync(outside, image.buffer);
  try { fs.symlinkSync(outside, store.filename(asset)); }
  catch (error) {
    if (process.platform === "win32" && error.code === "EPERM") { t.skip("Symlinks require Windows developer mode"); return; }
    throw error;
  }
  assert.throws(() => store.read(asset), { code: "invalidAsset" });
  assert.throws(() => store.put(image), { code: "invalidAsset" });
  assert.ok(fs.lstatSync(store.filename(asset)).isSymbolicLink());
  assert.deepEqual(fs.readFileSync(outside), image.buffer);
  fs.unlinkSync(store.filename(asset));
  fs.mkdirSync(store.filename(asset));
  assert.throws(() => store.read(asset), { code: "invalidAsset" });
  assert.throws(() => store.put(image), { code: "invalidAsset" });
  assert.ok(fs.statSync(store.filename(asset)).isDirectory());
});

test("partial asset writes cannot expose a final file", (t) => {
  const { store } = setup(t);
  const image = fixture();
  const writeFileSync = fs.writeFileSync;
  const mocked = t.mock.method(fs, "writeFileSync", (fd, buffer, ...args) => {
    writeFileSync(fd, buffer.subarray(0, 10), ...args);
    throw Object.assign(new Error("injected write failure"), { code: "ENOSPC" });
  });
  assert.throws(() => store.put(image), { code: "ENOSPC" });
  mocked.mock.restore();
  assert.deepEqual(fs.readdirSync(store.directory), []);
  const asset = store.put(image);
  assert.deepEqual(store.read(asset).buffer, image.buffer);
});

test("crashes before and after asset publication leave recoverable files", (t) => {
  for (const stage of ["write", "publish"]) {
    const { directory, store } = setup(t);
    const image = fixture();
    const asset = descriptor(image);
    const source = `
      const fs = require("node:fs");
      const { AssetStore } = require(${JSON.stringify(require.resolve("../src/store/asset-store"))});
      const store = new AssetStore(${JSON.stringify(directory)});
      const stage = ${JSON.stringify(stage)};
      if (stage === "write") {
        const write = fs.writeFileSync;
        fs.writeFileSync = (fd, bytes) => { write(fd, bytes.subarray(0, 10)); process.exit(73); };
      } else {
        const link = fs.linkSync;
        fs.linkSync = (...args) => { link(...args); process.exit(73); };
      }
      store.put({ buffer: Buffer.from(${JSON.stringify(image.buffer.toString("hex"))}, "hex"), mimeType: "image/png", width: 1280, height: 720 });
    `;
    const child = spawnSync(process.execPath, ["-e", source], { encoding: "utf8", timeout: 5000 });
    assert.equal(child.status, 73, child.stderr);
    assert.ok(fs.readdirSync(store.directory).some((name) => name.endsWith(".part")));
    if (stage === "write") assert.equal(fs.existsSync(store.filename(asset)), false);
    else assert.deepEqual(store.read(asset).buffer, image.buffer);
    assert.deepEqual(store.put(image), asset);
    store.collect([{ state: "queued", assets: [asset] }]);
    assert.deepEqual(fs.readdirSync(store.directory), [`${asset.sha256}.png`]);
    assert.deepEqual(store.read(asset).buffer, image.buffer);
  }
});

test("failed corruption repair retains the old record and a later put repairs it", (t) => {
  const { store } = setup(t);
  const image = fixture();
  const asset = descriptor(image);
  const truncated = image.buffer.subarray(0, 10);
  fs.writeFileSync(store.filename(asset), truncated);
  const mocked = t.mock.method(fs, "renameSync", () => { throw Object.assign(new Error("injected publication failure"), { code: "EIO" }); });
  assert.throws(() => store.put(image), { code: "EIO" });
  mocked.mock.restore();
  assert.deepEqual(fs.readFileSync(store.filename(asset)), truncated);
  assert.deepEqual(fs.readdirSync(store.directory), [`${asset.sha256}.png`]);
  store.put(image);
  assert.deepEqual(store.read(asset).buffer, image.buffer);
});

test("garbage collection preserves referenced assets and unrelated files or directories", (t) => {
  const { directory, store } = setup(t);
  const retained = store.put(fixture());
  const unused = store.put(fixture(720, 1280));
  const partial = `${unused.sha256}.png.${crypto.randomUUID()}.part`;
  fs.writeFileSync(path.join(store.directory, partial), "interrupted");
  for (const name of ["notes.txt", "unrelated.part", `${unused.sha256}.png.not-our-part.part`, "catalog.local.json"]) {
    fs.writeFileSync(path.join(store.directory, name), "keep");
  }
  const nested = path.join(store.directory, `${"a".repeat(64)}.png`);
  fs.mkdirSync(nested);
  fs.writeFileSync(path.join(nested, "keep.txt"), "keep");
  const outside = path.join(directory, "outside.txt");
  fs.writeFileSync(outside, "keep");
  const symlink = path.join(store.directory, `${"b".repeat(64)}.png`);
  let createdSymlink = false;
  try { fs.symlinkSync(outside, symlink); createdSymlink = true; }
  catch (error) { if (process.platform !== "win32" || error.code !== "EPERM") throw error; }
  store.collect([{ state: "queued", assets: [retained] }, { state: "needs_review", assets: [retained] }]);
  assert.deepEqual(store.read(retained).buffer, fixture().buffer);
  assert.equal(fs.existsSync(store.filename(unused)), false);
  assert.equal(fs.existsSync(path.join(store.directory, partial)), false);
  for (const name of ["notes.txt", "unrelated.part", `${unused.sha256}.png.not-our-part.part`, "catalog.local.json"]) assert.equal(fs.readFileSync(path.join(store.directory, name), "utf8"), "keep");
  assert.equal(fs.readFileSync(path.join(nested, "keep.txt"), "utf8"), "keep");
  assert.equal(fs.readFileSync(outside, "utf8"), "keep");
  if (createdSymlink) assert.ok(fs.lstatSync(symlink).isSymbolicLink());
});
