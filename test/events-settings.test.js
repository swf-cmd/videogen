const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventStream, serializeEvent } = require("../src/http/handlers/events");
const { rememberSecret, normalizeLane } = require("../src/queue/keys");
const { readSettings, writeJson, normalizeSettings } = require("../src/store/settings");

class Response extends EventEmitter {
  constructor() { super(); this.text = ""; this.writableLength = 0; }
  writeHead(status, headers) { this.status = status; this.headers = headers; }
  write(text) { this.text += text; }
  end() { this.emit("close"); }
  destroy() { this.destroyed = true; this.emit("close"); }
}

test("SSE serializes safe single-line JSON and never includes keys or CORS", () => {
  rememberSecret("sse-secret-204885");
  const serialized = serializeEvent({ seq: 8, message: "hello\nworld sse-secret-204885", authorization: "Bearer other-secret" });
  assert.match(serialized, /^id: 8\nevent: change\ndata: /);
  assert.doesNotMatch(serialized, /sse-secret-204885|other-secret/);
  assert.equal(serialized.split("\n").filter((line) => line.startsWith("data:")).length, 1);
  assert.throws(() => serializeEvent({ seq: "8\nevent: injected" }));
  const store = Object.assign(new EventEmitter(), { seq: 8 });
  const events = new EventStream(store);
  const res = new Response();
  events.connect({ headers: {} }, res);
  assert.equal(res.headers["access-control-allow-origin"], undefined);
  assert.equal(res.headers["content-type"], "text/event-stream; charset=utf-8");
  assert.doesNotMatch(res.text, /jobs|prompt/);
  events.close();
});

test("SSE replays bounded increments, signals replay gaps and drops stalled clients", () => {
  const store = Object.assign(new EventEmitter(), { seq: 0 });
  const events = new EventStream(store, { capacity: 2 });
  for (let seq = 1; seq <= 4; seq += 1) { store.seq = seq; store.emit("event", { seq, jobId: `job-${seq}` }); }
  const recent = new Response();
  events.connect({ headers: { "last-event-id": "2" } }, recent);
  assert.match(recent.text, /id: 3/);
  assert.match(recent.text, /id: 4/);
  assert.doesNotMatch(recent.text, /id: 2/);
  const old = new Response();
  events.connect({ headers: { "last-event-id": "1" } }, old);
  assert.match(old.text, /event: resync/);
  assert.doesNotMatch(old.text, /job-3/);
  recent.writableLength = 2 * 1024 * 1024;
  store.emit("event", { seq: 5 });
  assert.equal(recent.destroyed, true);
  events.close();
  assert.equal(store.listenerCount("event"), 0);
});

test("SSE heartbeats survive idle periods and disconnected browsers remove listeners", async () => {
  const store = Object.assign(new EventEmitter(), { seq: 0 });
  const events = new EventStream(store, { heartbeatMs: 5 });
  const res = new Response();
  events.connect({ headers: {} }, res);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.match(res.text, /: heartbeat/);
  res.destroy();
  assert.equal(events.clients.size, 0);
  events.close();
});

test("settings persist only validated nonsecret preferences and use private atomic files", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-settings-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.deepEqual(readSettings(directory), { lanes: {} });
  const lane = normalizeLane({ provider: "openai-compatible", region: "custom", baseUrl: "http://127.0.0.1:30000/v1" });
  const settings = normalizeSettings({ lanes: { [lane.id]: { lane, concurrency: 3, paused: true, key: "never-write" } }, key: "also-never" });
  writeJson(directory, "settings.json", settings);
  assert.deepEqual(readSettings(directory), settings);
  assert.doesNotMatch(fs.readFileSync(path.join(directory, "settings.json"), "utf8"), /never/);
  assert.equal(fs.existsSync(path.join(directory, "settings.json.tmp")), false);
  if (process.platform !== "win32") assert.equal(fs.statSync(path.join(directory, "settings.json")).mode & 0o777, 0o600);
  assert.throws(() => normalizeSettings({ lanes: { [lane.id]: { lane, concurrency: 0 } } }), /invalidSettings/);
});
