const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createContext, parseJson, requireRemoteId } = require("../src/providers/base");
const compatible = require("../src/providers/openai-compatible");
const { KeyStore, redact } = require("../src/queue/keys");
const { writeOutput, recoverOutput, cleanupPublishedPartial } = require("../src/files/output");

function json(value) { return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } }); }
const lane = { provider: "openai-compatible", region: "custom", baseUrl: "https://provider.example/v1" };
const job = { model: "model", prompt: "prompt", params: { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9" } };

test("every redirect rejects credential queries and encoded secrets before forwarding", async () => {
  const key = "synthetic-key-for-review";
  const encoded = [...key].map((letter) => `%${letter.charCodeAt(0).toString(16)}`).join("");
  for (const location of [
    "https://outside.example/video?api_key=unknown-secret",
    "https://provider.example/content?x-goog-api-key=unknown-secret",
    `https://outside.example/video?q=${key}`,
    `https://outside.example/${encoded}/video`,
    `https://provider.example/content?q=${encodeURIComponent(encoded)}`,
  ]) {
    let requests = 0;
    const ctx = createContext({ lane, key, fetchImpl: async () => {
      requests += 1;
      return new Response(null, { status: 302, headers: { location } });
    } });
    await assert.rejects(ctx.fetch("videos/remote/content"), { message: "unsafeProviderUrl" });
    assert.equal(requests, 1);
  }
});

test("unauthenticated downloads and redirects strip all supported credential headers", async () => {
  const requests = [];
  const ctx = createContext({ lane, key: "synthetic-key-for-review", fetchImpl: async (url, options) => {
    requests.push({ url: String(url), headers: Object.fromEntries(options.headers) });
    return requests.length === 1 ? new Response(null, { status: 302, headers: { location: "https://cdn.example/result.mp4?signature=public-signature" } }) : new Response("video");
  } });
  await ctx.fetch("videos/id/content", { headers: { "x-api-key": "other-secret", "proxy-authorization": "Basic proxy-secret", cookie: "session=secret" } });
  assert.equal(requests[0].headers.authorization, "Bearer synthetic-key-for-review");
  assert.deepEqual(requests[1].headers, {});
  requests.length = 1;
  await ctx.fetch("https://cdn.example/result.mp4", { needsAuth: false, headers: { authorization: "Bearer leak", "x-goog-api-key": "leak", "x-api-key": "leak", "api-key": "leak", cookie: "leak" } });
  assert.deepEqual(requests[1].headers, {});
});

test("JSON redaction preserves schema names and refuses a redacted remote ID", async () => {
  const ctx = createContext({ lane, key: "id", fetchImpl: async () => json({ id: "remote-123", status: "queued" }) });
  assert.equal((await compatible.create(ctx, job)).remoteId, "remote-123");
  const parsed = await parseJson(ctx, json({ id: "remote-123", message: "echo id", nested: { authorization: "Bearer another-secret" } }));
  assert.deepEqual(parsed, { id: "remote-123", message: "echo [REDACTED]", nested: { authorization: "[REDACTED]" } });
  const secret = "synthetic-provider-key";
  const leaking = createContext({ lane, key: secret, fetchImpl: async () => json({ id: `remote-${secret}`, status: "queued" }) });
  await assert.rejects(compatible.create(leaking, job), { category: "unknown_outcome" });
  assert.throws(() => requireRemoteId(secret, leaking.redact), { category: "unknown_outcome" });
});

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "videogen-output-safety-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("published output recovers without a remote response after interrupted state persistence", async (t) => {
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, "video.mp4");
  await fs.writeFile(target, "preexisting output");
  const payload = Buffer.from("complete provider bytes");
  await assert.rejects(writeOutput(new Response(payload), target, { jobId: "job-1", onPublished() { throw new Error("state persistence interrupted"); } }), /state persistence interrupted/);
  let saved;
  const recovered = await recoverOutput(target, { jobId: "job-1", onPublished(output) { saved = output; } });
  assert.deepEqual(recovered, saved);
  assert.equal(recovered.path, path.join(directory, "video (2).mp4"));
  assert.equal(recovered.sha256, crypto.createHash("sha256").update(payload).digest("hex"));
  assert.equal(await fs.readFile(target, "utf8"), "preexisting output");
  assert.equal((await fs.readdir(directory)).filter((name) => name.endsWith(".part")).length, 0);
});

test("an expired remote response does not hide an already published local file", async (t) => {
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, "video.mp4");
  await assert.rejects(writeOutput(new Response("complete bytes"), target, { jobId: "job-1", onPublished() { throw new Error("interrupted"); } }));
  const recovered = await writeOutput(new Response("expired", { status: 403 }), target, { jobId: "job-1" });
  assert.equal(recovered.path, target);
  assert.equal(recovered.bytes, Buffer.byteLength("complete bytes"));
  assert.deepEqual(await fs.readdir(directory), ["video.mp4"]);
});

test("startup cleanup removes only a succeeded file's matching hardlink marker", async (t) => {
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, "video.mp4");
  let saved;
  await assert.rejects(writeOutput(new Response("complete bytes"), target, { jobId: "job-1", onPublished(output) { saved = output; throw new Error("interrupted after saving success"); } }));
  assert.equal(await cleanupPublishedPartial(target, { jobId: "job-1", output: saved }), true);
  assert.equal(await cleanupPublishedPartial(target, { jobId: "job-1", output: saved }), false);
  await fs.writeFile(`${target}.job-1.part`, "unrelated file");
  assert.equal(await cleanupPublishedPartial(target, { jobId: "job-1", output: saved }), false);
  assert.equal(await fs.readFile(`${target}.job-1.part`, "utf8"), "unrelated file");
  assert.equal(await recoverOutput(target, { jobId: "job-1" }), null);
});

test("publication syncs the output directory before acknowledging succeeded", async (t) => {
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, "video.mp4");
  const events = [];
  const open = fs.open.bind(fs);
  t.mock.method(fs, "open", async (...args) => {
    const handle = await open(...args);
    if (args[0] === directory) {
      const sync = handle.sync.bind(handle);
      handle.sync = async () => { await sync(); events.push("directory synced"); };
    }
    return handle;
  });
  await writeOutput(new Response("bytes"), target, { jobId: "job-1", onPublished() { events.push("success recorded"); } });
  assert.ok(events.indexOf("directory synced") < events.indexOf("success recorded"));
});

test("key-store redaction preserves structural job and remote property names", () => {
  const keys = new KeyStore();
  keys.set(lane, "id", compatible);
  const result = redact({ id: "job-123", remote: { id: "remote-123" }, error: { message: "echo id" } });
  assert.deepEqual(result, { id: "job-123", remote: { id: "remote-123" }, error: { message: "echo [REDACTED]" } });
});
