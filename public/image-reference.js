const maxInputReferenceBytes = 25 * 1024 * 1024;
const supportedInputReferenceTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

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

async function readImageFileDimensions(file) {
  const { image, url } = await loadImageFile(file);
  const dimensions = {
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
  URL.revokeObjectURL(url);
  return dimensions;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function fittedInputReferenceName(sizeValue) {
  const suffix = String(sizeValue || "").replace(/[^0-9x]/g, "") || "sora";
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
