const path = require("node:path");
const { MAX_IMAGE_REFERENCE_BYTES, SUPPORTED_REFERENCE_IMAGE_TYPES } = require("../config");
const { st } = require("../i18n/server-messages");

function parseResolution(size) {
  const match = /^(\d+)x(\d+)$/.exec(String(size || ""));
  if (!match) return null;
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function imageMimeTypeFromName(filename) {
  const ext = path.extname(String(filename || "")).toLowerCase();
  return {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  }[ext] || "";
}

function imageMimeType(file) {
  const type = String(file?.type || "").toLowerCase();
  return SUPPORTED_REFERENCE_IMAGE_TYPES.has(type) ? type : imageMimeTypeFromName(file?.name);
}

function referenceImageExtension(mimeType) {
  return {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  }[mimeType] || "";
}

function sanitizeUploadFilename(filename, mimeType) {
  const fallback = `input-reference${referenceImageExtension(mimeType) || ".png"}`;
  const base = path.basename(String(filename || fallback)).replace(/[<>:"/\\|?*\x00-\x1f]/g, "-") || fallback;
  const ext = path.extname(base).toLowerCase();
  return ext ? base : `${base}${referenceImageExtension(mimeType) || ".png"}`;
}

function pngDimensions(buffer) {
  if (
    buffer.length < 24 ||
    buffer[0] !== 0x89 ||
    buffer.toString("ascii", 1, 4) !== "PNG" ||
    buffer[4] !== 0x0d ||
    buffer[5] !== 0x0a ||
    buffer[6] !== 0x1a ||
    buffer[7] !== 0x0a
  ) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    const isStartOfFrame = (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    );
    if (isStartOfFrame && length >= 7) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }
  return null;
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function webpDimensions(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > buffer.length) return null;

    if (chunkType === "VP8X" && chunkSize >= 10) {
      return {
        width: readUInt24LE(buffer, dataOffset + 4) + 1,
        height: readUInt24LE(buffer, dataOffset + 7) + 1,
      };
    }
    if (chunkType === "VP8L" && chunkSize >= 5 && buffer[dataOffset] === 0x2f) {
      const bits = buffer[dataOffset + 1] |
        (buffer[dataOffset + 2] << 8) |
        (buffer[dataOffset + 3] << 16) |
        (buffer[dataOffset + 4] << 24);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    if (chunkType === "VP8 " && chunkSize >= 10 && buffer.toString("hex", dataOffset + 3, dataOffset + 6) === "9d012a") {
      return {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  return null;
}

function imageDimensions(buffer, mimeType) {
  if (mimeType === "image/png") return pngDimensions(buffer);
  if (mimeType === "image/jpeg") return jpegDimensions(buffer);
  if (mimeType === "image/webp") return webpDimensions(buffer);
  return null;
}

async function normalizeInputReference(file, size, language = "zh") {
  if (!file) return null;
  const mimeType = imageMimeType(file);
  if (!SUPPORTED_REFERENCE_IMAGE_TYPES.has(mimeType)) {
    throw new Error(st(language, "invalidImageReference"));
  }
  if (file.size > MAX_IMAGE_REFERENCE_BYTES) {
    throw new Error(st(language, "imageReferenceTooLarge"));
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dimensions = imageDimensions(buffer, mimeType);
  if (!dimensions?.width || !dimensions?.height) {
    throw new Error(st(language, "invalidImageReference"));
  }

  const expected = parseResolution(size);
  if (expected && (dimensions.width !== expected.width || dimensions.height !== expected.height)) {
    throw new Error(st(language, "imageReferenceSizeMismatch", {
      size: `${expected.width} x ${expected.height}`,
      actual: `${dimensions.width} x ${dimensions.height}`,
    }));
  }

  return {
    buffer,
    mimeType,
    filename: sanitizeUploadFilename(file.name, mimeType),
    width: dimensions.width,
    height: dimensions.height,
  };
}

module.exports = {
  parseResolution,
  imageMimeTypeFromName,
  imageMimeType,
  referenceImageExtension,
  sanitizeUploadFilename,
  pngDimensions,
  jpegDimensions,
  readUInt24LE,
  webpDimensions,
  imageDimensions,
  normalizeInputReference,
};
