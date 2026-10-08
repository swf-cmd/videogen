const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { sanitizeFilename, appendFilenameIndex, preflightOutputDirectory, writeOutput, recoverOutput, cleanupPublishedPartial } = require("../src/files/output");

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "videogen-output-reliability-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("output names handle Windows devices and leave room for private partials without breaking Unicode", async (t) => {
  for (const name of ["CON", "CON .mp4", "nul.mp4", "PRN", "AUX.webm", "COM1", "LPT9.mp4", "com¹.mp4"]) assert.ok(sanitizeFilename(name).startsWith("_"), name);
  assert.equal(sanitizeFilename("concerning.mp4"), "concerning.mp4");
  assert.equal(sanitizeFilename("trailing. "), "trailing.mp4");
  assert.equal(sanitizeFilename("clip.webm"), "clip.webm");
  const filename = sanitizeFilename("视频🎞️".repeat(120));
  assert.ok(Buffer.byteLength(filename) <= 128);
  assert.ok(!filename.includes("\uFFFD"));
  assert.ok(appendFilenameIndex(filename, 49999).endsWith("-50000.mp4"));
  assert.ok(Buffer.byteLength(appendFilenameIndex(filename, 49999)) <= 128);
  const directory = await temporaryDirectory(t);
  const output = await writeOutput(new Response("video", { headers: { "content-type": "video/mp4" } }), path.join(directory, filename), { jobId: "x".repeat(100) });
  assert.equal(await fs.readFile(output.path, "utf8"), "video");
});

test("output preflight checks durable writes and hardlinks, then removes its probe files", async (t) => {
  const directory = await temporaryDirectory(t);
  const nested = path.join(directory, "new-directory");
  await preflightOutputDirectory(nested);
  assert.deepEqual(await fs.readdir(nested), []);
  await fs.writeFile(path.join(nested, "keep.mp4"), "existing video");
  await preflightOutputDirectory(nested);
  assert.deepEqual(await fs.readdir(nested), ["keep.mp4"]);
  const file = path.join(directory, "not-a-directory");
  await fs.writeFile(file, "keep");
  await assert.rejects(preflightOutputDirectory(file), { code: "outputDirectoryUnavailable" });
  assert.equal(await fs.readFile(file, "utf8"), "keep");
});

test("hardlink-less filesystems and write failures are rejected before submission without leftover probes", async (t) => {
  const directory = await temporaryDirectory(t);
  const link = fs.link;
  t.mock.method(fs, "link", async () => { throw Object.assign(new Error("unsupported filesystem"), { code: "ENOTSUP" }); });
  await assert.rejects(preflightOutputDirectory(directory), (error) => error.code === "outputDirectoryUnavailable" && error.details.filesystemCode === "ENOTSUP");
  assert.deepEqual(await fs.readdir(directory), []);
  fs.link = link;
  t.mock.method(fs, "open", async () => { throw Object.assign(new Error("read only"), { code: "EROFS" }); });
  await assert.rejects(preflightOutputDirectory(directory), (error) => error.code === "outputDirectoryUnavailable" && error.details.filesystemCode === "EROFS");
  assert.deepEqual(await fs.readdir(directory), []);
});

test("WebM publishes with its actual container extension and recovers without a provider response", async (t) => {
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, "video.mp4");
  const webm = path.join(directory, "video.webm");
  await fs.writeFile(webm, "existing video");
  const bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3]);
  await assert.rejects(writeOutput(new Response(bytes, { headers: { "content-type": "video/webm; codecs=vp9" } }), target, {
    jobId: "paid-job", onPublished() { throw new Error("crash before record"); },
  }), /crash before record/);
  assert.equal(await fs.readFile(webm, "utf8"), "existing video");
  assert.equal((await fs.stat(`${target}.paid-job.part`)).nlink, 2);
  const recovered = await recoverOutput(target, { jobId: "paid-job" });
  assert.equal(recovered.path, path.join(directory, "video (2).webm"));
  assert.equal(recovered.contentType, "video/webm");
  assert.deepEqual(await fs.readFile(recovered.path), bytes);
  assert.deepEqual((await fs.readdir(directory)).sort(), ["video (2).webm", "video.webm"]);
});

test("WebM success cleanup uses the original job marker and never removes another file", async (t) => {
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, "video.mp4");
  let output;
  await assert.rejects(writeOutput(new Response("webm", { headers: { "content-type": "video/webm" } }), target, {
    jobId: "paid-job", onPublished(saved) { output = saved; throw new Error("after record"); },
  }), /after record/);
  assert.equal(await cleanupPublishedPartial(target, { jobId: "paid-job", output }), true);
  assert.deepEqual(await fs.readdir(directory), ["video.webm"]);
});
