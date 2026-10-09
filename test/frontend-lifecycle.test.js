const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../public/queue-view.js"), "utf8");

function harness({ preview = false, request = async (endpoint) => endpoint === "/api/keys" ? [] : ({ jobs: [], batches: [], lanes: [], seq: 0 }) } = {}) {
  const window = new EventTarget();
  const listeners = new Map();
  const add = window.addEventListener.bind(window);
  window.addEventListener = (type, callback, options) => { listeners.set(type, (listeners.get(type) || 0) + 1); add(type, callback, options); };
  const sources = [], intervals = new Map(), timeouts = new Map(), delays = new Map(), states = [], messages = [];
  let timerId = 0;
  class EventSource extends EventTarget {
    constructor(url) { super(); this.url = url; this.closed = false; sources.push(this); }
    close() { this.closed = true; this.readyState = 2; }
  }
  const QueueView = vm.runInNewContext(`${source}\nQueueView`, {
    window, EventSource, URLSearchParams, isFilePreview: preview, apiRequest: request,
    setConnectionState: (state) => states.push(state), updateSelectedKeyStatus() {},
    setInterval: (callback) => { intervals.set(++timerId, callback); return timerId; }, clearInterval: (id) => intervals.delete(id),
    setTimeout: (callback, delay) => { timeouts.set(++timerId, callback); delays.set(timerId, delay); return timerId; }, clearTimeout: (id) => timeouts.delete(id),
  });
  QueueView.prototype.bindControls = function () {};
  QueueView.prototype.render = function () {};
  QueueView.prototype.renderJobs = function () {};
  QueueView.prototype.renderBatches = function () {};
  QueueView.prototype.renderLanes = function () {};
  QueueView.prototype.renderGallerySummary = function () {};
  const view = new QueueView();
  view.message = (text, error) => messages.push({ text, error });
  const dispatch = (type, persisted = false) => { const event = new Event(type); Object.defineProperty(event, "persisted", { value: persisted }); window.dispatchEvent(event); };
  const tick = async () => { for (const [id, callback] of [...timeouts]) { timeouts.delete(id); callback(); } await new Promise(setImmediate); };
  return { view, sources, intervals, timeouts, delays, states, messages, listeners, dispatch, tick };
}

test("failed initial snapshots are reported and live refresh still recovers", async () => {
  const app = harness();
  let snapshots = 0;
  app.view.loadJobs = async () => { if (++snapshots === 1) throw new Error("Snapshot unavailable"); };
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
  app.view.loadJobs = async () => { snapshots += 1; };
  app.view.applyEvent = () => { changes += 1; };
  await app.view.start();
  await app.view.start();
  assert.equal(app.sources.length, 1);
  assert.equal(app.intervals.size, 2);
  assert.equal(app.listeners.get("pagehide"), 1);
  assert.equal(app.listeners.get("pageshow"), 1);
  await app.sources[0].onopen();
  assert.equal(app.timeouts.size, 0, "opening the stream starts its snapshot immediately");
  app.dispatch("pagehide", true);
  assert.equal(app.intervals.size, 0);
  assert.equal(app.timeouts.size, 0);
  app.dispatch("pageshow", true);
  app.dispatch("pageshow", true);
  await app.tick();
  assert.equal(app.sources.length, 2, "repeated restoration must not duplicate the stream");
  assert.equal(app.intervals.size, 2);
  assert.equal(snapshots, 3);
  assert.equal(app.states.at(-1), "connectionReconnecting");
  await app.sources[1].onopen();
  const event = new Event("change"); Object.defineProperty(event, "data", { value: "{}" });
  app.sources[0].onerror();
  app.sources[0].dispatchEvent(event);
  assert.equal(changes, 0);
  assert.equal(app.states.at(-1), "ready", "a closed stream cannot change the restored connection status");
  app.sources[1].dispatchEvent(event);
  assert.equal(changes, 1);
  app.dispatch("pagehide", true);
  app.view.loadJobs = async () => { throw new Error("Restored snapshot unavailable"); };
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

function answerSnapshots(requests, { state = "running", seq = 1, fail = false } = {}) {
  for (const { endpoint, resolve, reject } of requests) {
    if (fail) { reject(new Error("Old connection failed")); continue; }
    resolve(endpoint.startsWith("/api/jobs?") ? { jobs: [{ id: "one", state }], seq, nextCursor: null }
      : endpoint.startsWith("/api/batches?") ? { batches: [{ id: "batch", state: "active" }], seq, nextCursor: null }
      : endpoint === "/api/lanes" ? { lanes: [{ id: "lane", state: "active" }] }
      : endpoint === "/api/keys" ? [{ present: true }] : { kept: 1 });
  }
}

test("open and resync start fresh requests immediately and announce readiness only after all current snapshots finish", async () => {
  const pending = [];
  const app = harness({ request: (endpoint) => new Promise((resolve, reject) => pending.push({ endpoint, resolve, reject })) });
  const initial = app.view.start(); const initialRequests = pending.splice(0);
  assert.equal(app.states.at(-1), "connectionReconnecting");
  answerSnapshots(initialRequests); await initial;
  assert.equal(app.states.includes("ready"), false, "HTTP alone cannot mark a disconnected stream ready");
  const opened = app.sources[0].onopen();
  assert.equal(pending.length, 5); assert.equal(app.timeouts.size, 0); assert.equal(app.states.at(-1), "connectionSyncing");
  app.sources[0].dispatchEvent(new Event("ready"));
  assert.equal(pending.length, 5, "the ready event does not duplicate the open snapshot or skip synchronization");
  const requests = pending.splice(0); const last = requests.pop();
  answerSnapshots(requests, { state: "downloading", seq: 2 }); await new Promise(setImmediate);
  assert.equal(app.states.at(-1), "connectionSyncing", "ready waits for lanes, keys and gallery as well as jobs");
  answerSnapshots([last], { seq: 2 }); await opened;
  assert.equal(app.states.at(-1), "ready"); assert.equal(app.view.jobs.get("one").state, "downloading");
  app.view.scheduleRefresh(); assert.equal(app.timeouts.size, 1);
  app.sources[0].dispatchEvent(new Event("resync"));
  assert.equal(pending.length, 5); assert.equal(app.timeouts.size, 0); assert.equal(app.states.at(-1), "connectionSyncing");
  answerSnapshots(pending.splice(0), { state: "succeeded", seq: 3 }); await app.view.snapshotPromise;
  assert.equal(app.states.at(-1), "ready"); assert.equal(app.view.jobs.get("one").state, "succeeded");
  app.dispatch("pagehide");
});

test("an obsolete connection's success or failure cannot announce readiness during the new synchronization", async () => {
  const pending = [];
  const app = harness({ request: (endpoint) => new Promise((resolve, reject) => pending.push({ endpoint, resolve, reject })) });
  const initial = app.view.start(); const initialRequests = pending.splice(0);
  const oldOpen = app.sources[0].onopen(); const oldRequests = pending.splice(0);
  app.sources[0].onerror();
  const newOpen = app.sources[0].onopen(); const currentRequests = pending.splice(0);
  answerSnapshots(initialRequests); answerSnapshots(oldRequests, { fail: true }); await initial; await oldOpen;
  assert.equal(app.states.at(-1), "connectionSyncing"); assert.equal(app.states.includes("ready"), false); assert.deepEqual(app.messages, []);
  answerSnapshots(currentRequests, { state: "downloading", seq: 1 }); await newOpen;
  assert.equal(app.states.at(-1), "ready"); assert.equal(app.view.jobs.get("one").state, "downloading");
  app.dispatch("pagehide");
});

test("snapshots overlay newer events for visible and previously unseen jobs and never resurrect deletions", async () => {
  const pending = [];
  const app = harness({ request: () => new Promise((resolve) => pending.push(resolve)) });
  app.view.jobs.set("known", { id: "known", state: "running", _seq: 5 });
  app.view.jobs.set("deleted", { id: "deleted", state: "succeeded", _seq: 5 });
  const old = app.view.loadJobs();
  app.view.applyEvent({ type: "job", jobId: "known", state: "downloading", seq: 11 });
  app.view.applyEvent({ type: "job", jobId: "new-to-page", state: "running", seq: 12 });
  app.view.applyEvent({ type: "delete", jobId: "deleted", seq: 13 });
  pending.shift()({ jobs: [{ id: "known", state: "running", prompt: "Full current metadata" }, { id: "new-to-page", state: "queued" }, { id: "deleted", state: "succeeded" }], seq: 10, nextCursor: null }); await old;
  assert.equal(app.view.jobs.get("known").state, "downloading"); assert.equal(app.view.jobs.get("known").prompt, "Full current metadata");
  assert.equal(app.view.jobs.get("new-to-page").state, "running"); assert.equal(app.view.jobs.has("deleted"), false);
  app.view.applyEvent({ type: "delete", jobId: "known", seq: 9 });
  app.view.applyEvent({ type: "job", jobId: "deleted", state: "running", seq: 12 });
  assert.equal(app.view.jobs.has("known"), true); assert.equal(app.view.jobs.has("deleted"), false, "older replay events cannot undo newer state");
  const acknowledged = app.view.loadJobs(); pending.shift()({ jobs: [{ id: "known", state: "downloading" }], seq: 13, nextCursor: null }); await acknowledged;
  assert.equal(app.view.jobEvents.size, 0, "acknowledged changes are released");
  const stale = app.view.loadJobs(); pending.shift()({ jobs: [{ id: "deleted", state: "succeeded" }], seq: 12, nextCursor: "old" }); await stale;
  assert.equal(app.view.jobs.has("deleted"), false); assert.equal(app.view.jobs.get("known").state, "downloading"); assert.equal(app.view.nextJobCursor, null);
  app.view.suspendLiveUpdates();
});

test("newer batch deletion and status events survive old snapshots and job state filters stay correct", async () => {
  const pending = [];
  const app = harness({ request: () => new Promise((resolve) => pending.push(resolve)) });
  app.view.batches = [{ id: "deleted", state: "active" }, { id: "kept", state: "active" }];
  const batches = app.view.loadBatches();
  app.view.applyEvent({ type: "delete_batch", jobId: "deleted", seq: 2 });
  app.view.applyEvent({ type: "batch", jobId: "kept", state: "paused", seq: 3 });
  pending.shift()({ batches: [{ id: "deleted", state: "active" }, { id: "kept", state: "active" }], seq: 1, nextCursor: null }); await batches;
  assert.equal(app.view.batches.length, 1); assert.equal(app.view.batches[0].state, "paused");
  app.view.stateFilter = "running"; app.view.jobs.set("one", { id: "one", state: "running", _seq: 1 });
  const jobs = app.view.loadJobs(); app.view.applyEvent({ type: "job", jobId: "one", state: "downloading", seq: 4 });
  pending.shift()({ jobs: [{ id: "one", state: "running" }], seq: 3, nextCursor: null }); await jobs;
  assert.equal(app.view.jobs.size, 0, "the old filtered snapshot cannot put a changed job back into the wrong state filter");
  app.view.suspendLiveUpdates();
});

test("event overlays stay bounded without forgetting the safety barrier for evicted deletions", async () => {
  const pending = [];
  const app = harness({ request: () => new Promise((resolve) => pending.push(resolve)) });
  app.view.jobs.set("deleted-1", { id: "deleted-1", state: "succeeded", _seq: 0 });
  for (let seq = 1; seq <= 2001; seq += 1) app.view.applyEvent({ type: "delete", jobId: `deleted-${seq}`, seq });
  assert.equal(app.view.jobEvents.size, 2000); assert.equal(app.view.jobEventFloor, 1);
  const stale = app.view.loadJobs(); pending.shift()({ jobs: [{ id: "deleted-1", state: "succeeded" }], seq: 0, nextCursor: null }); await stale;
  assert.equal(app.view.jobs.has("deleted-1"), false, "eviction must not let an older snapshot revive the deleted row");
  const fresh = app.view.loadJobs(); pending.shift()({ jobs: [], seq: 2001, nextCursor: null }); await fresh;
  assert.equal(app.view.jobEvents.size, 0); assert.equal(app.view.jobs.size, 0);
  app.view.suspendLiveUpdates();
});

test("a stream closed for good (503 while the service starts) is recreated with growing backoff and returns to ready", async () => {
  const app = harness();
  await app.view.start(); await app.sources[0].onopen();
  assert.equal(app.states.at(-1), "ready");
  // The browser retries network errors itself (readyState CONNECTING); nothing to do.
  app.sources[0].readyState = 0; app.sources[0].onerror();
  assert.equal(app.timeouts.size, 0); assert.equal(app.states.at(-1), "connectionReconnecting");
  // A non-200 answer leaves EventSource CLOSED forever.
  app.sources[0].readyState = 2; app.sources[0].onerror();
  assert.equal(app.timeouts.size, 1);
  const first = [...app.delays.entries()].find(([id]) => app.timeouts.has(id))[1];
  await app.tick();
  assert.equal(app.sources.length, 2); assert.equal(app.sources[0].closed, true);
  app.sources[1].readyState = 2; app.sources[1].onerror();
  const second = [...app.delays.entries()].find(([id]) => app.timeouts.has(id))[1];
  assert.ok(first >= 1000 && second > first && second <= 30000 * 1.2, `${first} then ${second}`);
  await app.tick();
  assert.equal(app.sources.length, 3);
  await app.sources[2].onopen();
  assert.equal(app.states.at(-1), "ready", "the badge cannot stay on Reconnecting");
  assert.equal(app.view.reconnectAttempts, 0, "a successful connection resets the backoff");
  app.sources[2].readyState = 2; app.sources[2].onerror();
  assert.equal(app.timeouts.size, 1);
  app.dispatch("pagehide");
  assert.equal(app.timeouts.size, 0, "leaving the page cancels a pending reconnect");
  assert.equal(app.sources.length, 3);
});

test("REST polling runs only while the stream is down, plus a slow safety refresh", async () => {
  const app = harness();
  await app.view.start(); await app.sources[0].onopen();
  const poll = [...app.intervals.values()][0];
  poll();
  assert.equal(app.timeouts.size, 0, "a healthy stream needs no polling");
  app.view.lastRefreshAt = Date.now() - 29000; poll();
  assert.equal(app.timeouts.size, 0);
  app.view.lastRefreshAt = Date.now() - 31000; poll();
  assert.equal(app.timeouts.size, 1, "a safety refresh runs about every 30 seconds");
  await app.tick();
  app.sources[0].onerror();
  app.view.lastRefreshAt = Date.now() - 1000; poll();
  assert.equal(app.timeouts.size, 0);
  app.view.lastRefreshAt = Date.now() - 2100; poll();
  assert.equal(app.timeouts.size, 1, "while the stream is down, snapshots poll as a fallback");
  app.dispatch("pagehide");
});

test("connection failures use the localized status pill, and background refresh errors clear after the next success", async () => {
  let mode = "ok";
  const request = async (endpoint) => {
    if (mode === "offline") throw Object.assign(new Error("serviceUnreachable"), { network: true });
    if (mode === "starting") throw Object.assign(new Error("The service is starting"), { status: 503, code: "serviceStarting" });
    if (mode === "broken" && endpoint === "/api/lanes") throw Object.assign(new Error("Lane snapshot failed"), { status: 500 });
    return endpoint === "/api/keys" ? [] : { jobs: [], batches: [], lanes: [], seq: 0 };
  };
  const app = harness({ request });
  await app.view.start(); await app.sources[0].onopen();
  assert.equal(app.states.at(-1), "ready");
  mode = "offline"; await app.view.run(() => app.view.refresh());
  assert.equal(app.states.at(-1), "connectionOffline");
  assert.deepEqual(app.messages, [], "a background refresh never shows the browser's raw fetch error");
  mode = "starting"; await app.view.run(() => app.view.refresh());
  assert.equal(app.states.at(-1), "connectionStarting");
  app.sources[0].onerror();
  assert.equal(app.states.at(-1), "connectionStarting", "the stream error does not hide the more specific state");
  await app.sources[0].onopen();
  mode = "ok"; await app.view.run(() => app.view.refresh());
  assert.equal(app.states.at(-1), "ready");
  mode = "broken"; await app.view.run(() => app.view.refresh());
  assert.deepEqual(app.messages, [{ text: "Lane snapshot failed", error: true }]);
  mode = "ok"; await app.view.run(() => app.view.refresh());
  assert.deepEqual(app.messages.at(-1), { text: "", error: undefined }, "the stale refresh error is cleared");
  const count = app.messages.length;
  await app.view.run(() => app.view.refresh());
  assert.equal(app.messages.length, count, "nothing is rewritten while there is nothing to clear");
  await app.view.run(async () => { throw new Error("Action failed"); });
  await app.view.run(() => app.view.refresh());
  assert.deepEqual(app.messages.at(-1), { text: "Action failed", error: true }, "errors of user actions stay visible");
  app.dispatch("pagehide");
});
