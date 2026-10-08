const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { privateDirectory } = require("./job-store");
const { referenceImageExtension } = require("../media/image");

class AssetStore {
  constructor(directory) { this.directory = path.join(directory, "assets"); privateDirectory(this.directory); }
  filename(asset) {
    if (!/^[a-f0-9]{64}$/.test(asset.sha256) || !referenceImageExtension(asset.mime)) throw new Error("invalidAsset");
    return path.join(this.directory, `${asset.sha256}${referenceImageExtension(asset.mime)}`);
  }
  put(image) {
    const asset = { role: "first_frame", sha256: crypto.createHash("sha256").update(image.buffer).digest("hex"), mime: image.mimeType, width: image.width, height: image.height };
    const filename = this.filename(asset);
    try {
      const fd = fs.openSync(filename, "wx", 0o600);
      try { fs.writeFileSync(fd, image.buffer); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    } catch (error) { if (error.code !== "EEXIST") throw error; }
    return asset;
  }
  read(asset) { return { ...asset, buffer: fs.readFileSync(this.filename(asset)), mimeType: asset.mime, filename: `first-frame${referenceImageExtension(asset.mime)}` }; }
  collect(jobs) {
    const used = new Set([...jobs].flatMap((job) => job.assets || []).map((asset) => path.basename(this.filename(asset))));
    for (const entry of fs.readdirSync(this.directory)) if (!used.has(entry)) fs.unlinkSync(path.join(this.directory, entry));
  }
}
module.exports = { AssetStore };
