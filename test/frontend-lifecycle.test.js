const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../public/queue-view.js"), "utf8");

function harness({ preview = false, request = async () => ({ jobs: [], seq: 0 }) } = {}) {
  const window = new EventTarget();
  const listeners = new Map();
  const add = window.addEventListener.bind(window);
  window.addEventListener = (type, callback, options) => { listeners.set(type, (listeners.get(type) || 0) + 1); add(type, callback, options); };
  const sources = [], intervals = new Map(), timeouts = new Map(), states = [], messages = [];
  let timerId = 0;
  class EventSource extends EventTarget {
    constructor(url) { super(); this.url = url; this.closed = false; sources.push(this); }
    close() { this.closed = true; }
  }
  const QueueView = vm.runInNewContext(`${source}\nQueueView`, {
    window, EventSource, URLSearchParams, isFilePreview: preview, apiRequest: request,
    setConnectionState: (state) => states.push(state), updateSelectedKeyStatus() {},
    setInterval: (callback) => { intervals.set(++timerId, callback); return timerId; }, clearInterval: (id) => intervals.delete(id),
    setTimeout: (callback) => { timeouts.set(++timerId, callback); return timerId; }, clearTimeout: (id) => timeouts.delete(id),
  });
  QueueView.prototype.bindControls = function () {};
  QueueView.prototype.render = function () {};
  QueueView.prototype.renderJobs = function () {};
  const view = new QueueView();
  view.message = (text, error) => messages.push({ text, error });
  const dispatch = (type, persisted = false) => { const event = new Event(type); Object.defineProperty(event, "persisted", { value: persisted }); window.dispatchEvent(event); };
  const tick = async () => { for (const [id, callback] of [...timeouts]) { timeouts.delete(id); callback(); } await new Promise(setImmediate); };
  return { view, sources, intervals, timeouts, states, messages, listeners, dispatch, tick };
}

test("failed initial snapshots are reported and live refresh still recovers", async () => {
  const app = harness();
  let snapshots = 0;
  app.view.refresh = async () => { if (++snapshots === 1) throw new Error("Snapshot unavailable"); };
  await app.view.run(() => app.view.start());
  assert.deepEqual(app.messages, [{ text: "Snapshot unavailable", error: true }]);
  assert.equal(app.intervals.size, 2, "snapshot failure must not prevent ongoing status updates");
  assert.equal(app.listeners.get("pagehide"), 1, "cleanup must survive initial request failure");
  app.sources[0].dispatchEvent(new Event("ready"));
  await app.tick();
  assert.equal(snapshots, 2);
  assert.equal(app.states.at(-1), "ready");
  app.dispatch("pagehide");
  assert.equal(app.sources[0].closed, true);
  assert.equal(app.intervals.size, 0);
});

test("back-forward page restoration reconnects once and rejects events from the closed stream", async () => {
  const app = harness();
  let snapshots = 0, changes = 0;
  app.view.refresh = async () => { snapshots += 1; };
  app.view.applyEvent = () => { changes += 1; };
  await app.view.start();
  await app.view.start();
  assert.equal(app.sources.length, 1);
  assert.equal(app.intervals.size, 2);
  assert.equal(app.listeners.get("pagehide"), 1);
  assert.equal(app.listeners.get("pageshow"), 1);
  app.sources[0].onopen();
  assert.equal(app.timeouts.size, 1);
  app.dispatch("pagehide", true);
  assert.equal(app.intervals.size, 0);
  assert.equal(app.timeouts.size, 0);
  app.dispatch("pageshow", true);
  app.dispatch("pageshow", true);
  await app.tick();
  assert.equal(app.sources.length, 2, "repeated restoration must not duplicate the stream");
  assert.equal(app.intervals.size, 2);
  assert.equal(snapshots, 2);
  assert.equal(app.states.at(-1), "connectionReconnecting");
  app.sources[1].onopen();
  const event = new Event("change"); Object.defineProperty(event, "data", { value: "{}" });
  app.sources[0].onerror();
  app.sources[0].dispatchEvent(event);
  assert.equal(changes, 0);
  assert.equal(app.states.at(-1), "ready", "a closed stream cannot change the restored connection status");
  app.sources[1].dispatchEvent(event);
  assert.equal(changes, 1);
  app.dispatch("pagehide", true);
  app.view.refresh = async () => { throw new Error("Restored snapshot unavailable"); };
  app.dispatch("pageshow", true);
  await app.tick();
  assert.equal(app.sources.length, 3);
  assert.equal(app.intervals.size, 2);
  assert.deepEqual(app.messages, [{ text: "Restored snapshot unavailable", error: true }]);
});

test("snapshots started before page suspension cannot overwrite restored jobs", async () => {
  const pending = [];
  const app = harness({ request: () => new Promise((resolve) => pending.push(resolve)) });
  const old = app.view.loadJobs();
  app.view.suspendLiveUpdates();
  const fresh = app.view.loadJobs();
  pending[1]({ jobs: [{ id: "job", state: "succeeded" }], seq: 20, nextCursor: null });
  await fresh;
  pending[0]({ jobs: [{ id: "job", state: "running" }], seq: 10, nextCursor: "obsolete" });
  await old;
  assert.equal(app.view.jobs.get("job").state, "succeeded");
  assert.equal(app.view.nextJobCursor, null);
});

test("file preview never installs network or lifecycle activity", async () => {
  const app = harness({ preview: true });
  await app.view.start();
  await app.view.resumeLiveUpdates();
  assert.equal(app.sources.length, 0);
  assert.equal(app.intervals.size, 0);
  assert.equal(app.listeners.size, 0);
});

test("dense events coalesce behind a slow snapshot without starving its result", async () => {
  const app = harness(); let resolveJobs, snapshots = 0;
  app.view.loadJobs = async () => { snapshots += 1; await new Promise((resolve) => { resolveJobs = resolve; }); app.view.jobs.set("one", { state: "downloading" }); };
  app.view.loadBatches = app.view.loadLanes = app.view.loadGallerySummary = async () => {};
  const first = app.view.refresh();
  for (let wave = 0; wave < 5; wave += 1) {
    for (let event = 0; event < 100; event += 1) app.view.scheduleRefresh(true);
    await app.tick();
    assert.equal(snapshots, 1, "events cannot invalidate the snapshot by starting overlapping requests");
    assert.equal(app.timeouts.size, 1, "only one follow-up refresh is queued");
  }
  resolveJobs(); await first;
  assert.equal(app.view.jobs.get("one").state, "downloading");
  await app.tick(); assert.equal(snapshots, 2);
  resolveJobs(); await app.view.snapshotPromise;
});

test("SSE reconnection refreshes full job details even after the server resets its sequence", async () => {
  const app = harness({ request: async () => ({ jobs: [{ id: "one", state: "downloading", remote: { id: "paid" } }], seq: 1, nextCursor: null }) });
  app.view.refresh = async () => {};
  await app.view.start();
  app.view.jobs.set("one", { id: "one", state: "running", _seq: 900 });
  app.sources[0].onerror(); app.sources[0].onopen();
  await app.view.loadJobs();
  assert.equal(app.view.jobs.get("one").state, "downloading");
  assert.equal(app.view.jobs.get("one").remote.id, "paid");
  app.dispatch("pagehide");
});

test("disconnect and reconnect reject all old snapshots before and after fresh low-sequence responses", async () => {
  const pending = [];
  const app = harness({ request: (endpoint) => new Promise((resolve) => pending.push({ endpoint, resolve })) });
  app.view.renderBatches = app.view.renderLanes = app.view.renderGallerySummary = () => {};
  const initialize = app.view.start();
  app.view.jobs.set("one", { id: "one", state: "succeeded", _seq: 900 });
  app.view.batches = [{ id: "batch", state: "active" }]; app.view.lanes = [{ id: "lane", state: "active" }]; app.view.gallerySummary = { kept: 5 }; app.view.keys = [{ present: true }];
  const respond = (requests, state, seq, kept, present) => requests.forEach(({ endpoint, resolve }) => resolve(endpoint.startsWith("/api/jobs?") ? { jobs: [{ id: "one", state }], seq, nextCursor: null } : endpoint.startsWith("/api/batches?") ? { batches: [{ id: "batch", state }], nextCursor: null } : endpoint === "/api/lanes" ? { lanes: [{ id: "lane", state }] } : endpoint === "/api/keys" ? [{ present }] : { kept }));
  app.sources[0].onerror();
  respond(pending.splice(0), "old-before-open", 800, 1, false); await initialize;
  assert.equal(app.view.jobs.get("one").state, "succeeded"); assert.equal(app.view.batches[0].state, "active"); assert.equal(app.view.lanes[0].state, "active"); assert.equal(app.view.gallerySummary.kept, 5); assert.equal(app.view.keys[0].present, true);
  const old = app.view.refresh(); const oldRequests = pending.splice(0);
  app.sources[0].onopen();
  const fresh = app.view.refresh(); const freshRequests = pending.splice(0);
  assert.equal(freshRequests.length, 5, "a hanging old snapshot cannot hold the new connection's refresh hostage");
  respond(freshRequests, "downloading", 1, 8, true); await fresh;
  respond(oldRequests, "old-after-open", 850, 2, false); await old;
  assert.equal(app.view.jobs.get("one").state, "downloading"); assert.equal(app.view.batches[0].state, "downloading"); assert.equal(app.view.lanes[0].state, "downloading"); assert.equal(app.view.gallerySummary.kept, 8); assert.equal(app.view.keys[0].present, true);
  app.dispatch("pagehide");
});
