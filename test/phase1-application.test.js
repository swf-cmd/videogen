const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Application } = require("../src/application");

function application(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-phase1-app-"));
  const app = new Application({ directory });
  t.after(async () => { await app.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return app;
}

test("new provider selection resolves regional prices and rejects unresolved or mismatched workspaces", (t) => {
  const app = application(t);
  assert.ok(app.adapters.gemini && app.adapters.dashscope && app.adapters.ark);
  const wan = { provider: "dashscope", region: "beijing", model: "wan3.0-video", params: { durationSeconds: 2, resolution: "480p", aspectRatio: "16:9" }, prompt: "offline estimate" };
  assert.throws(() => app.estimate(wan), { code: "workspaceRequired" });
  assert.throws(() => app.estimate({ ...wan, baseUrl: "https://workspace123.ap-southeast-1.maas.aliyuncs.com" }), { code: "regionMismatch" });
  assert.equal(app.estimate({ ...wan, baseUrl: "https://workspace123.cn-beijing.maas.aliyuncs.com" }).cost.amount, 0.6);
  assert.equal(app.estimate({ ...wan, region: "singapore", baseUrl: "https://workspace123.ap-southeast-1.maas.aliyuncs.com" }).cost.amount, 0.74942);
  const gemini = { provider: "gemini", region: "global", model: "gemini-omni-1.1-flash", prompt: "offline estimate", params: { durationSeconds: 3, resolution: "720p", aspectRatio: "16:9" } };
  assert.equal(app.estimate(gemini).cost.amount, 0.30408);
  assert.equal(app.estimate({ ...gemini, params: { ...gemini.params, resolution: "4k" } }).cost.amount, null);
  assert.equal(app.store.jobs.size, 0);
});

test("Gemini manual recovery rejects unsafe IDs before attaching a legacy Files record", async (t) => {
  const app = application(t);
  const { jobs } = await app.prepare({ provider: "gemini", region: "global", model: "gemini-omni-1.1-flash", prompt: "manual file recovery", params: { durationSeconds: 3, resolution: "720p", aspectRatio: "16:9" } });
  const id = jobs[0].id;
  app.store.update(id, { state: "submitting", attempts: { create: 1, poll: 0, download: 0 } });
  app.store.update(id, { state: "needs_review" });
  await assert.rejects(app.scheduler.jobAction(id, "resolve", { action: "attach_remote_id", remoteId: "v1_invalid/path" }), { code: "geminiFileIdRequired" });
  assert.equal(app.store.get(id).state, "needs_review");
  await app.scheduler.jobAction(id, "resolve", { action: "attach_remote_id", remoteId: "files/found-video" });
  assert.equal(app.store.get(id).state, "running");
  assert.equal(app.store.get(id).remote.id, "files/found-video");
  assert.equal(app.store.get(id).attempts.create, 1);
  assert.equal(app.scheduler.laneList()[0].state, "needs_key");
});

test("Gemini manual recovery attaches a background interaction ID without another create", async (t) => {
  const app = application(t);
  const { jobs } = await app.prepare({ provider: "gemini", region: "global", model: "gemini-omni-1.1-flash", prompt: "manual interaction recovery", params: { durationSeconds: 3, resolution: "720p", aspectRatio: "16:9" } });
  const id = jobs[0].id;
  app.store.update(id, { state: "submitting", attempts: { create: 1, poll: 0, download: 0 } });
  app.store.update(id, { state: "needs_review" });
  await app.scheduler.jobAction(id, "resolve", { action: "attach_remote_id", remoteId: "v1_interaction_id" });
  assert.equal(app.store.get(id).state, "running");
  assert.equal(app.store.get(id).remote.id, "v1_interaction_id");
  assert.equal(app.store.get(id).attempts.create, 1);
  assert.equal(app.scheduler.laneList()[0].state, "needs_key");
});
