const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { KeyStore, normalizeLane, redact } = require("../src/queue/keys");
const { safeError } = require("../src/http/errors");
const { writeOutput } = require("../src/files/output");

const lane = { provider: "openai-compatible", region: "local", baseUrl: "http://127.0.0.1:9000/v1" };
const adapter = { validateKey: (key) => key.startsWith("test-") ? null : "invalidKey" };

async function temporaryDirectory(t) {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "videogen-output-"));
  t.after(() => fsp.rm(directory, { recursive: true, force: true }));
  return directory;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function waitForBytes(filename) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const stats = await fsp.stat(filename).catch(() => null);
    if (stats?.size) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("Stream did not write its first chunk");
}

test("lane keys canonicalize endpoints and remain isolated without serializing secrets", () => {
  const store = new KeyStore();
  const normalized = store.set(lane, "test-private-first-778", adapter);
  assert.match(normalized.id, /^[0-9a-f]{24}$/);
  assert.equal(normalizeLane({ ...lane, baseUrl: `${lane.baseUrl}/` }).id, normalized.id);
  assert.equal(normalizeLane({ ...lane, baseUrl: "https://EXAMPLE.invalid:443/v1/" }).baseUrl, "https://example.invalid/v1");
  for (const other of [
    { ...lane, region: "other" },
    { ...lane, provider: "another" },
    { ...lane, baseUrl: "http://127.0.0.1:9001/v1" },
  ]) {
    assert.equal(store.get(other), undefined);
    assert.equal(store.has(other), false);
  }
  assert.equal(store.get(normalized.id), "test-private-first-778");
  assert.equal(store.has(lane), true);
  assert.deepEqual(store.list(), [{ lane: normalized, present: true }]);
  assert.equal(JSON.stringify(store).includes("test-private-first-778"), false);
  assert.equal(store.delete(lane), true);
  assert.equal(store.get(lane), undefined);
  assert.equal(redact("old test-private-first-778"), "old [REDACTED]");
  assert.equal(new KeyStore().has(lane), false);
});

test("keys reject whitespace and control injection and adapters own format validation", () => {
  const store = new KeyStore();
  for (const key of ["test-key secret", "test-key\r\nauthorization: injected", "test-key\u0000", "test-key\u007f", "test-key\u0085"]) {
    assert.throws(() => store.set(lane, key, adapter), { code: "invalidKey" });
  }
  assert.throws(() => store.set(lane, "wrong-format-secret", adapter), { code: "invalidKey" });
  assert.equal(redact("wrong-format-secret"), "wrong-format-secret");
  store.set(lane, "", { validateKey: (key) => key === "" ? null : "invalidKey" });
  assert.equal(store.get(lane), "");
  assert.equal(store.has(lane), true);
  for (const baseUrl of [
    "https://user:password@example.invalid", "https://example.invalid?key=secret",
    "https://example.invalid#fragment", "https://example.invalid?", "https://example.invalid#",
    "https://exam\nple.invalid", "file:///tmp/endpoint", "not-a-url",
  ]) assert.throws(() => normalizeLane({ ...lane, baseUrl }), { code: "invalidLane" });
});

test("KeyStore honors the actual OpenRouter adapter validation contract", () => {
  const store = new KeyStore();
  const openrouter = require("../src/providers/openrouter");
  const routerLane = { provider: "openrouter", region: "global", baseUrl: "https://openrouter.ai/api/v1" };
  assert.throws(() => store.set(routerLane, "sk-wrong-prefix-secret", openrouter), { code: "invalidApiKey" });
  assert.equal(store.has(routerLane), false);
  assert.equal(redact("sk-wrong-prefix-secret"), "sk-wrong-prefix-secret");
  store.set(routerLane, "sk-or-correct-prefix-secret", openrouter);
  assert.equal(store.get(routerLane), "sk-or-correct-prefix-secret");
  assert.throws(() => store.set(routerLane, "sk-or-rejected-secret", { validateKey: () => false }), { code: "invalidKey" });
});

test("safe errors redact deep known keys, credential headers and proxy userinfo", () => {
  const store = new KeyStore();
  store.set(lane, "test-known-deep-secret-991", adapter);
  const details = {
    nested: { a: { b: { c: { d: { value: "test-known-deep-secret-991" } } } } },
    headers: { Authorization: "Bearer unregistered-auth", "x-goog-api-key": "unregistered-google", "api-key": "unregistered-api" },
    proxy: "HTTPS://proxy-user:proxy-password@proxy.invalid:8443",
    rawHeaders: 'Authorization: Bearer another-secret\nx-goog-api-key: google-secret\n{"api-key":"json-secret"}',
    localPath: path.join(os.homedir(), "private", "output.mp4"),
  };
  details.cycle = details;
  const safe = safeError(Object.assign(new Error("test-known-deep-secret-991 failed"), { details }));
  const text = JSON.stringify(safe);
  for (const secret of ["test-known-deep-secret-991", "unregistered-auth", "unregistered-google", "unregistered-api", "proxy-user", "proxy-password", "another-secret", "google-secret", "json-secret", os.homedir()]) {
    assert.equal(text.includes(secret), false, `Unredacted credential or path: ${secret}`);
  }
  assert.equal(safe.details.localPath, path.join("~", "private", "output.mp4"));
  assert.equal(safe.details.cycle, "[Circular]");
  assert.deepEqual(redact(new Headers({ authorization: "header-secret" })), { authorization: "[REDACTED]" });
  const shared = { prompt: "shared prompt", key: "test-known-deep-secret-991" };
  assert.deepEqual(redact({ first: shared, second: shared }), {
    first: { prompt: "shared prompt", key: "[REDACTED]" },
    second: { prompt: "shared prompt", key: "[REDACTED]" },
  });
});

test("output streams bytes into a private partial and publishes without replacing existing files", async (t) => {
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, "clip.mp4");
  const partial = `${target}.stream-job.part`;
  await fsp.writeFile(target, "existing");
  await fsp.writeFile(path.join(directory, "clip (2).mp4"), "also existing");
  let release;
  const nextChunk = new Promise((resolve) => { release = resolve; });
  const first = Buffer.from([0, 255, 3, 2, 1]);
  const last = Buffer.from("metadata-preserved");
  const response = {
    ok: true,
    headers: new Headers({ "content-type": "video/mp4" }),
    body: Readable.from((async function* () { yield first; await nextChunk; yield last; })()),
    arrayBuffer() { throw new Error("Must not buffer video bodies"); },
  };
  let published;
  const writing = writeOutput(response, target, {
    jobId: "stream-job",
    onPublished(info) {
      published = info;
      assert.equal(fs.existsSync(partial), true);
      assert.equal(fs.existsSync(info.path), true);
    },
  });
  await waitForBytes(partial);
  assert.deepEqual(await fsp.readFile(partial), first);
  if (process.platform !== "win32") assert.equal((await fsp.stat(partial)).mode & 0o777, 0o600);
  release();
  const output = await writing;
  const expected = Buffer.concat([first, last]);
  assert.deepEqual(output, { path: path.join(directory, "clip (3).mp4"), bytes: expected.length, contentType: "video/mp4", sha256: sha256(expected) });
  assert.equal(published, output);
  assert.deepEqual(await fsp.readFile(output.path), expected);
  assert.equal(await fsp.readFile(target, "utf8"), "existing");
  assert.equal(await fsp.readFile(path.join(directory, "clip (2).mp4"), "utf8"), "also existing");
  assert.equal((await fsp.readdir(directory)).some((name) => name.endsWith(".part")), false);
});

test("concurrent output publishers choose distinct names and retain every byte", async (t) => {
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, "same.mp4");
  const results = await Promise.all(Array.from({ length: 8 }, (_, index) => writeOutput(new Response(`video-${index}`), target, { jobId: `job-${index}` })));
  assert.equal(new Set(results.map((output) => output.path)).size, 8);
  for (const [index, output] of results.entries()) {
    assert.equal(await fsp.readFile(output.path, "utf8"), `video-${index}`);
    assert.equal(output.sha256, sha256(`video-${index}`));
  }
  assert.equal((await fsp.readdir(directory)).length, 8);
});

test("interrupted downloads clean only their own partial and never publish truncated bytes", async (t) => {
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, "failure.mp4");
  const unrelated = path.join(directory, "unrelated.part");
  await fsp.writeFile(unrelated, "keep");
  await fsp.writeFile(`${target}.failed-job.part`, "old incomplete download");
  const response = {
    body: Readable.from((async function* () { yield Buffer.from("incomplete"); throw new Error("disconnected"); })()),
  };
  await assert.rejects(writeOutput(response, target, { jobId: "failed-job" }), /disconnected/);
  assert.deepEqual(await fsp.readdir(directory), ["unrelated.part"]);
  assert.equal(await fsp.readFile(unrelated, "utf8"), "keep");
});

test("aborting an active stream removes its partial", async (t) => {
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, "abort.mp4");
  const controller = new AbortController();
  const body = new Readable({ read() {} });
  const writing = writeOutput({ body }, target, { jobId: "abort-job", signal: controller.signal });
  body.push(Buffer.from("first chunk"));
  await waitForBytes(`${target}.abort-job.part`);
  controller.abort();
  await assert.rejects(writing, { name: "AbortError" });
  assert.deepEqual(await fsp.readdir(directory), []);
});

test("a published partial recovers after interruption before its job record was saved", async (t) => {
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, "recover.mp4");
  const options = { jobId: "recover-job", onPublished() { throw new Error("record interrupted"); } };
  await assert.rejects(writeOutput(new Response("published video"), target, options), /record interrupted/);
  assert.equal((await fsp.stat(`${target}.recover-job.part`)).nlink, 2);
  let recovered;
  const output = await writeOutput(new Response("must not replace the published bytes"), target, {
    jobId: "recover-job", onPublished(info) { recovered = info; },
  });
  assert.equal(output, recovered);
  assert.equal(output.path, target);
  assert.equal(output.sha256, sha256("published video"));
  assert.equal(await fsp.readFile(target, "utf8"), "published video");
  assert.deepEqual(await fsp.readdir(directory), ["recover.mp4"]);
});
