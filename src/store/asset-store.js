const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { privateDirectory } = require("./job-store");
const { MAX_IMAGE_REFERENCE_BYTES } = require("../config");
const { imageDimensions, referenceImageExtension } = require("../media/image");

const ASSET_NAME = /^[a-f0-9]{64}\.(?:jpg|png|webp)$/;
const PART_NAME = /^[a-f0-9]{64}\.(?:jpg|png|webp)\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.part$/;

function invalidAsset(code = "invalidAsset") {
  return Object.assign(new Error("invalidAsset"), { code });
}

function syncDirectory(directory) {
  if (process.platform === "win32") return;
  const fd = fs.openSync(directory, "r");
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function verifyBuffer(asset, buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_IMAGE_REFERENCE_BYTES) throw invalidAsset("corruptAsset");
  if (!Number.isSafeInteger(asset.width) || asset.width < 1 || !Number.isSafeInteger(asset.height) || asset.height < 1) throw invalidAsset("corruptAsset");
  let dimensions;
  try { dimensions = imageDimensions(buffer, asset.mime); } catch { throw invalidAsset("corruptAsset"); }
  if (dimensions?.width !== asset.width || dimensions?.height !== asset.height || crypto.createHash("sha256").update(buffer).digest("hex") !== asset.sha256) {
    throw invalidAsset("corruptAsset");
  }
}

function readBuffer(filename) {
  const before = fs.lstatSync(filename);
  if (!before.isFile() || before.isSymbolicLink()) throw invalidAsset();
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const current = fs.fstatSync(fd);
    if (!current.isFile() || current.dev !== before.dev || current.ino !== before.ino) throw invalidAsset();
    if (!current.size || current.size > MAX_IMAGE_REFERENCE_BYTES) throw invalidAsset("corruptAsset");
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}

class AssetStore {
  constructor(directory) {
    this.directory = path.join(directory, "assets");
    privateDirectory(this.directory);
  }

  filename(asset) {
    if (!asset || !/^[a-f0-9]{64}$/.test(asset.sha256) || !referenceImageExtension(asset.mime)) throw invalidAsset();
    return path.join(this.directory, `${asset.sha256}${referenceImageExtension(asset.mime)}`);
  }

  put(image, role = "first_frame") {
    if (!image || !Buffer.isBuffer(image.buffer)) throw invalidAsset();
    if (!["first_frame", "last_frame"].includes(role)) throw invalidAsset();
    const asset = {
      role,
      sha256: crypto.createHash("sha256").update(image.buffer).digest("hex"),
      mime: image.mimeType,
      width: image.width,
      height: image.height,
    };
    const filename = this.filename(asset);
    verifyBuffer(asset, image.buffer);
    try { this.read(asset); syncDirectory(this.directory); return asset; }
    catch (error) { if (!["ENOENT", "corruptAsset"].includes(error.code)) throw error; }

    const temporary = `${filename}.${crypto.randomUUID()}.part`;
    const fd = fs.openSync(temporary, "wx", 0o600);
    try {
      try { fs.writeFileSync(fd, image.buffer); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      try {
        fs.linkSync(temporary, filename);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        try { this.read(asset); }
        catch (existingError) {
          if (existingError.code !== "corruptAsset") throw existingError;
          const current = fs.lstatSync(filename);
          if (!current.isFile() || current.isSymbolicLink()) throw invalidAsset();
          fs.renameSync(temporary, filename);
        }
      }
      syncDirectory(this.directory);
    } finally {
      try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    syncDirectory(this.directory);
    return asset;
  }

  read(asset) {
    const buffer = readBuffer(this.filename(asset));
    verifyBuffer(asset, buffer);
    return { ...asset, buffer, mimeType: asset.mime, filename: `${asset.role === "last_frame" ? "last-frame" : "first-frame"}${referenceImageExtension(asset.mime)}` };
  }

  collect(jobs) {
    const used = new Set([...jobs].flatMap((job) => job.assets || []).map((asset) => path.basename(this.filename(asset))));
    let changed = false;
    for (const entry of fs.readdirSync(this.directory, { withFileTypes: true })) {
      if (!entry.isFile() || used.has(entry.name) || !ASSET_NAME.test(entry.name) && !PART_NAME.test(entry.name)) continue;
      fs.unlinkSync(path.join(this.directory, entry.name));
      changed = true;
    }
    if (changed) syncDirectory(this.directory);
  }
}

module.exports = { AssetStore };
