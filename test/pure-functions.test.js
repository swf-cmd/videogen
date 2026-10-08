const assert = require("node:assert/strict");
const test = require("node:test");
const { loadLegacyServer } = require("./helpers/legacy-server");

const legacy = loadLegacyServer();

function png(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpeg(width, height, marker = 0xc0) {
  const frame = Buffer.alloc(13);
  frame[0] = 0xff;
  frame[1] = marker;
  frame.writeUInt16BE(11, 2);
  frame[4] = 8;
  frame.writeUInt16BE(height, 5);
  frame.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from("ffd8ffe000041234", "hex"), frame]);
}

function webp(type, width, height) {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8);
  buffer.write(type, 12);
  buffer.writeUInt32LE(10, 16);
  if (type === "VP8X") {
    buffer.writeUIntLE(width - 1, 24, 3);
    buffer.writeUIntLE(height - 1, 27, 3);
  } else if (type === "VP8L") {
    buffer[20] = 0x2f;
    buffer.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 21);
  } else {
    Buffer.from("9d012a", "hex").copy(buffer, 23);
    buffer.writeUInt16LE(width, 26);
    buffer.writeUInt16LE(height, 28);
  }
  return buffer;
}

test("PNG dimensions require the signature and a complete header", () => {
  assert.deepEqual({ ...legacy.pngDimensions(png(1280, 720)) }, { width: 1280, height: 720 });
  assert.equal(legacy.pngDimensions(png(1280, 720).subarray(0, 23)), null);
  const invalid = png(1280, 720);
  invalid[0] = 0;
  assert.equal(legacy.pngDimensions(invalid), null);
});

test("JPEG dimensions traverse metadata and handle baseline and progressive frames", () => {
  for (const marker of [0xc0, 0xc2]) {
    assert.deepEqual({ ...legacy.jpegDimensions(jpeg(1792, 1024, marker)) }, { width: 1792, height: 1024 });
  }
  assert.equal(legacy.jpegDimensions(jpeg(1792, 1024).subarray(0, 15)), null);
  assert.equal(legacy.jpegDimensions(Buffer.alloc(30)), null);
  const invalid = jpeg(1792, 1024);
  invalid.writeUInt16BE(1, 4);
  assert.equal(legacy.jpegDimensions(invalid), null);
});

test("WebP dimensions support extended, lossless and lossy chunks", () => {
  for (const type of ["VP8X", "VP8L", "VP8 "]) {
    const image = webp(type, 1920, 1080);
    assert.deepEqual({ ...legacy.webpDimensions(image) }, { width: 1920, height: 1080 });
    assert.equal(legacy.webpDimensions(image.subarray(0, 29)), null);
    image.writeUInt32LE(100, 16);
    assert.equal(legacy.webpDimensions(image), null);
  }
  assert.equal(legacy.webpDimensions(Buffer.alloc(30)), null);
});

test("image dispatch and first-frame validation preserve dimensions and bytes", async () => {
  const image = png(1280, 720);
  assert.deepEqual({ ...legacy.imageDimensions(image, "image/png") }, { width: 1280, height: 720 });
  assert.equal(legacy.imageDimensions(image, "image/gif"), null);
  const file = { name: "frame.png", type: "image/png", size: image.length, arrayBuffer: async () => image };
  const result = await legacy.normalizeInputReference(file, "1280x720", "en");
  assert.equal(result.width, 1280);
  assert.equal(result.height, 720);
  assert.equal(result.mimeType, "image/png");
  assert.deepEqual(result.buffer, image);
  assert.equal(await legacy.normalizeInputReference(null, "1280x720"), null);
  await assert.rejects(legacy.normalizeInputReference(file, "720x1280", "en"), /1280 x 720/);
  await assert.rejects(legacy.normalizeInputReference({ ...file, type: "image/gif", name: "frame.gif" }, "1280x720", "en"));
  await assert.rejects(legacy.normalizeInputReference({ ...file, size: 26 * 1024 * 1024 }, "1280x720", "en"));
});

test("filenames remove directory components and unsafe characters without losing MP4 suffixes", () => {
  assert.equal(legacy.sanitizeFilename("  ../clip.mp4  "), "clip.mp4");
  assert.equal(legacy.sanitizeFilename("a<b>:c\"d\\e|f?g*h\u0000"), process.platform === "win32" ? "e-f-g-h-.mp4" : "a-b--c-d-e-f-g-h-.mp4");
  assert.equal(legacy.sanitizeFilename("movie.MP4"), "movie.MP4");
  assert.equal(legacy.sanitizeFilename("movie.mov"), "movie.mov.mp4");
  assert.match(legacy.sanitizeFilename(""), /^videogen-\d{4}-.*\.mp4$/);
  assert.equal(legacy.appendFilenameIndex("clip.mp4", 0), "clip-01.mp4");
  assert.equal(legacy.appendFilenameIndex("clip.final.mp4", 9), "clip.final-10.mp4");
  assert.equal(legacy.appendFilenameIndex("clip", 100), "clip-101.mp4");
});

test("batch prompts preserve multiline prompts, split blank lines, repeat or truncate", () => {
  assert.deepEqual(Array.from(legacy.parseBatchPrompts("  first\nline\n\n second\r\n\r\nthird  ")), ["first\nline", "second", "third"]);
  assert.deepEqual(Array.from(legacy.parseBatchPrompts("one", "3")), ["one", "one", "one"]);
  assert.equal(legacy.parseBatchPrompts("one", 50001).length, 50001);
  assert.deepEqual(Array.from(legacy.parseBatchPrompts("one\n\ntwo", 1)), ["one"]);
  assert.throws(() => legacy.parseBatchPrompts(" \n\n ", 1, "en"));
  assert.throws(() => legacy.parseBatchPrompts("one\n\ntwo", 3, "en"));
  for (const count of [0, -1, 1.5, "many", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => legacy.parseBatchPrompts("one", count, "en"));
  }
});

test("Retry-After accepts seconds and HTTP dates and ignores invalid values", () => {
  assert.equal(legacy.parseRetryAfterMs("2.5"), 2500);
  assert.equal(legacy.parseRetryAfterMs("0"), 0);
  assert.equal(legacy.parseRetryAfterMs(undefined), undefined);
  assert.equal(legacy.parseRetryAfterMs("not-a-date"), undefined);
  assert.equal(legacy.parseRetryAfterMs("Thu, 01 Jan 1970 00:00:00 GMT"), 0);
  const future = new Date(Date.now() + 60000).toUTCString();
  const delay = legacy.parseRetryAfterMs(future);
  assert.ok(delay >= 59000 && delay <= 60000, `Unexpected HTTP-date delay: ${delay}`);
});

test("idempotent error classifier distinguishes retryable transport and status errors", () => {
  for (const status of [408, 429, 500, 502, 503]) assert.equal(legacy.isRetryableIdempotentError({ status }), true);
  for (const status of [200, 400, 401, 403, 404, 422]) assert.equal(legacy.isRetryableIdempotentError({ status }), false);
  for (const name of ["TypeError", "SyntaxError", "AbortError"]) assert.equal(legacy.isRetryableIdempotentError({ name }), true);
  for (const code of ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "ECONNREFUSED", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]) {
    assert.equal(legacy.isRetryableIdempotentError({ code }), true);
    assert.equal(legacy.isRetryableIdempotentError({ cause: { code } }), true);
  }
  assert.equal(legacy.isRetryableIdempotentError(new Error("bad request")), false);
  assert.equal(legacy.isRetryableIdempotentError(null), false);
});

test("idempotent retries back off, respect Retry-After and stop on exhaustion", async () => {
  const delays = [];
  const { withIdempotentRetry } = loadLegacyServer({ setTimeout: (callback, delay) => { delays.push(delay); queueMicrotask(callback); } });
  let attempts = 0;
  const value = await withIdempotentRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw Object.assign(new Error("temporary"), { status: 503 });
    return "done";
  });
  assert.equal(value, "done");
  assert.equal(attempts, 3);
  assert.deepEqual(delays.splice(0), [1000, 2000]);
  const throttled = Object.assign(new Error("throttled"), { status: 429, retryAfterMs: 60000 });
  attempts = 0;
  await assert.rejects(withIdempotentRetry(async () => { attempts += 1; throw throttled; }), (error) => error === throttled && error.retryExhausted === true);
  assert.equal(attempts, 5);
  assert.deepEqual(delays.splice(0), [60000, 60000, 60000, 60000]);
  attempts = 0;
  await assert.rejects(withIdempotentRetry(async () => { attempts += 1; throw Object.assign(new Error("invalid"), { status: 400 }); }), /invalid/);
  assert.equal(attempts, 1);
  assert.deepEqual(delays, []);
});
