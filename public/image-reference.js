const maxInputReferenceBytes = 25 * 1024 * 1024;
// Upload requests are limited to 128 MiB including the payload; keep images below this.
const maxBatchImageBytes = 120 * 1024 * 1024;
const supportedInputReferenceTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

// EXIF orientation (1-8) of a JPEG, or 1 when absent or unreadable. Browsers
// display and draw JPEGs rotated by this tag while the service and providers
// read the stored pixels, so a rotated photo must be re-encoded upright.
function jpegOrientation(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return 1;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xff) { offset += 1; continue; }
    if (marker === 0xd9 || marker === 0xda) return 1;
    const length = view.getUint16(offset + 2);
    if (length < 2) return 1;
    if (marker === 0xe1 && offset + 18 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966 && view.getUint16(offset + 8) === 0) {
      const tiff = offset + 10;
      const order = view.getUint16(tiff);
      if (order !== 0x4949 && order !== 0x4d4d) return 1;
      const little = order === 0x4949;
      if (view.getUint16(tiff + 2, little) !== 42) return 1;
      const directory = tiff + view.getUint32(tiff + 4, little);
      if (directory + 2 > view.byteLength) return 1;
      const count = view.getUint16(directory, little);
      for (let index = 0; index < count; index += 1) {
        const entry = directory + 2 + index * 12;
        if (entry + 12 > view.byteLength) return 1;
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    offset += 2 + length;
  }
  return 1;
}

async function readImageFileOrientation(file) {
  if (inputReferenceMimeType(file) !== "image/jpeg") return 1;
  try { return jpegOrientation(await file.slice(0, 256 * 1024).arrayBuffer()); }
  catch { return 1; }
}

function inputReferenceMimeType(file) {
  const type = String(file?.type || "").toLowerCase();
  if (supportedInputReferenceTypes.has(type)) return type;
  const extension = String(file?.name || "").toLowerCase().split(".").pop();
  return {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  }[extension] || "";
}

function inputReferenceFileKey(file) {
  if (!file) return "";
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function parseSizeValue(value) {
  const match = /^(\d+)x(\d+)$/.exec(String(value || ""));
  if (!match) return null;
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ image, url });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t("inputReferenceLoadError")));
    };
    image.src = url;
  });
}

// Displayed (orientation-corrected) dimensions plus the JPEG orientation tag.
async function readImageFileDimensions(file) {
  const { image, url } = await loadImageFile(file);
  const dimensions = {
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
  URL.revokeObjectURL(url);
  dimensions.orientation = await readImageFileOrientation(file);
  return dimensions;
}

// Row-mode frames: send the original bytes when they already are exactly what
// the user saw at the target size; otherwise fit and re-encode upright.
async function prepareInputReferenceFile(file, sizeValue, readInfo = readImageFileDimensions) {
  const expected = parseSizeValue(sizeValue);
  const info = await readInfo(file);
  const rotated = info.orientation > 1;
  const exact = !expected || info.width === expected.width && info.height === expected.height;
  if (exact && !rotated && file.size <= maxInputReferenceBytes) return file;
  return fitInputReferenceFile(file, expected ? sizeValue : `${info.width}x${info.height}`);
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function fittedInputReferenceName(sizeValue) {
  const suffix = String(sizeValue || "").replace(/[^0-9x]/g, "") || "videogen";
  return `input-reference-${suffix}.jpg`;
}

async function fitInputReferenceFile(file, sizeValue) {
  const expected = parseSizeValue(sizeValue);
  if (!expected) return file;

  const { image, url } = await loadImageFile(file);
  try {
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (!sourceWidth || !sourceHeight) {
      throw new Error(t("inputReferenceLoadError"));
    }

    const canvas = document.createElement("canvas");
    canvas.width = expected.width;
    canvas.height = expected.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error(t("inputReferenceResizeError"));
    }

    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = expected.width / expected.height;
    let sourceX = 0;
    let sourceY = 0;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;

    if (sourceAspect > targetAspect) {
      cropWidth = sourceHeight * targetAspect;
      sourceX = (sourceWidth - cropWidth) / 2;
    } else if (sourceAspect < targetAspect) {
      cropHeight = sourceWidth / targetAspect;
      sourceY = (sourceHeight - cropHeight) / 2;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, expected.width, expected.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      cropWidth,
      cropHeight,
      0,
      0,
      expected.width,
      expected.height,
    );

    for (const quality of [0.92, 0.86, 0.8, 0.72]) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (blob && blob.size <= maxInputReferenceBytes) {
        return new File([blob], fittedInputReferenceName(sizeValue), {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }
    }
  } finally {
    URL.revokeObjectURL(url);
  }

  throw new Error(t("inputReferenceTooLarge"));
}
