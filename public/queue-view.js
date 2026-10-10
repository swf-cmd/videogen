function viewElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function viewButton(text, action, className = "secondary") {
  const button = viewElement("button", className, text);
  button.type = "button";
  button.addEventListener("click", action);
  return button;
}

// Rewriting identical text still mutates the DOM (and live regions); skip it.
function setText(element, value) {
  const text = String(value ?? "");
  if (element.textContent !== text) element.textContent = text;
}

// A pending action keeps its button focusable: a disabled button would push
// keyboard focus to <body>. The _pending guard in run() ignores repeats.
function setPending(button, pending) {
  button._pending = pending;
  button.setAttribute("aria-disabled", pending ? "true" : "false");
}

function canFocus(element) {
  return Boolean(element) && element !== document.body && element.isConnected !== false && !element.hidden && !element.disabled && !element.closest?.("[hidden]");
}

// The local service is unreachable or still starting (503 during recovery).
function connectionFailure(error) { return Boolean(error?.network) || Number(error?.status) === 503; }
function truncateText(text, length) { const value = String(text || "").replace(/\s+/g, " ").trim(); return value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value; }
function formatClock(seconds) { if (!Number.isFinite(seconds) || seconds <= 0) return ""; const total = Math.round(seconds); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`; }
function batchIsFinished(batch) { return batch.total > 0 && Object.entries(batch.counts || {}).every(([state, count]) => !count || ["succeeded", "failed", "cancelled", "result_expired"].includes(state)); }
// Takes of one source row share `shot`; legacy jobs fall back to their index.
function shotIndex(job) { return Number.isInteger(job.shot) ? job.shot : !job.parentJobId && Number.isInteger(job.index) ? job.index : Number.MAX_SAFE_INTEGER; }
function takeIndex(job) { return Number.isInteger(job.take) ? job.take : job.parentJobId ? 1000 : 0; }

const queueStateKeys = { queued: "statusQueued", submitting: "statusSubmitting", running: "statusInProgress", downloading: "statusDownloading", succeeded: "statusCompleted", failed: "statusFailed", cancelled: "statusCancelled", needs_review: "needsReviewShort", result_expired: "statusExpired", active: "laneActive", preparing: "statusPreparing", paused: "lanePaused", cooldown: "laneCooldown", needs_key: "laneNeedsKey" };
const queueReasonKeys = { manual_pause: "reasonManual", rate_limited: "reasonRateLimit", auth: "reasonAuth", quota: "reasonQuota", model_unavailable: "reasonModel", circuit_open: "reasonCircuit", budget: "reasonBudget", budget_unknown: "reasonUnknownBudget", storeWriteFailed: "reasonStore", storeClosed: "reasonStore", schedulerFailed: "reasonScheduler", local_offline: "reasonOffline", interrupted_enqueue: "reasonInterruptedEnqueue" };
const queueErrorKeys = { moderation: "errorModeration", invalid_request: "errorInvalidRequest", unknown_outcome: "reviewExplanation", transient: "errorTransient", auth: "reasonAuth", quota: "reasonQuota", rate_limited: "reasonRateLimit", result_expired: "errorExpired", model_unavailable: "reasonModel", output_write_failed: "errorOutputWrite", local_offline: "reasonOffline", remote_not_found: "errorRemoteNotFound" };
const selectionKeys = { keep: "selectionKeep", reject: "selectionReject", unreviewed: "selectionUnreviewed" };
const galleryShortcutKeys = "J K ArrowLeft ArrowRight Space Enter 1 2 3 U";

class QueueView {
  constructor() {
    this.jobs = new Map();
    this.batches = [];
    this.lanes = [];
    this.keys = [];
    this.laneCards = new Map();
    this.batchCards = new Map();
    this.jobRows = new Map();
    this.jobOrder = [];
    this.galleryCards = new Map();
    this.galleryHeaders = new Map();
    this.galleryOrder = [];
    this.galleryFocusId = null;
    this.expandedCards = new Set();
    this.gallerySummary = null;
    this.galleryRevision = 0;
    this.gallerySelection = "all";
    this.batchPrompts = new Map();
    this.batchPromptRequests = new Set();
    this.jobCursors = [null];
    this.batchCursors = [null];
    this.jobPage = 0;
    this.batchPage = 0;
    this.nextJobCursor = null;
    this.nextBatchCursor = null;
    this.jobRevision = 0;
    this.batchRevision = 0;
    this.laneRevision = 0;
    this.reviewId = null;
    this.batchFilter = "";
    this.stateFilter = "";
    this.refreshTimer = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.lastRefreshAt = 0;
    this.offline = false;
    this.refreshErrorShown = false;
    this.pagePending = new Set();
    this.snapshotEpoch = 0;
    this.streamConnected = false;
    this.connectionSyncing = false;
    this.lastEventSeq = 0;
    this.jobSnapshotSeq = this.batchSnapshotSeq = 0;
    this.jobEventFloor = this.batchEventFloor = 0;
    this.jobEvents = new Map();
    this.batchEvents = new Map();
    this.notificationsEnabled = false;
    this.notifiedBatches = new Map();
    this.laneBaseline = false;
    this.reviewCount = 0;
    this.keyWaiting = new Set();
    // The first-run guide replaces the empty queue only once a batch snapshot
    // has confirmed there is nothing at all to show.
    this.batchesLoaded = typeof isFilePreview !== "undefined" && isFilePreview;
    this.bindControls();
  }

  bindControls() {
    document.querySelector("#refreshQueueButton").addEventListener("click", () => this.run(() => this.refresh()));
    document.querySelector("#clearHistoryButton").addEventListener("click", () => this.run(async () => {
      if (!await confirmAction(t("clearHistoryConfirm"), { danger: true })) return;
      await apiRequest("/api/history/clear", {});
      this.jobPage = 0; this.jobCursors = [null]; this.batchPage = 0; this.batchCursors = [null];
      this.batchFilter = "";
      await this.refresh();
      this.message(t("historyCleared"));
    }));
    for (const [id, kind, offset] of [["#jobsPrevious", "job", -1], ["#jobsNext", "job", 1], ["#batchPrevious", "batch", -1], ["#batchNext", "batch", 1]]) {
      const button = document.querySelector(id);
      button.addEventListener("click", () => this.changePage(kind, offset, button));
    }
    document.querySelector("#batchFilter").addEventListener("change", (event) => { this.batchFilter = event.target.value; this.resetJobs(); });
    document.querySelector("#stateFilter").addEventListener("change", (event) => { this.stateFilter = event.target.value; this.resetJobs(); });
    document.querySelector("#gallerySelection").addEventListener("change", (event) => { this.gallerySelection = event.target.value; this.renderGallery(); });
    const grid = document.querySelector("#galleryGrid");
    grid.addEventListener("keydown", (event) => this.handleGalleryKey(event));
    grid.addEventListener("focusin", (event) => this.galleryFocused(event));
    document.querySelector("#notifyToggle").addEventListener("change", (event) => this.run(() => this.toggleNotifications(event.target)));
    document.querySelector("#reviewDialog").addEventListener("close", () => {
      const previous = this.reviewPreviousFocus;
      this.reviewPreviousFocus = null;
      // The review button disappears once the job is resolved.
      if (canFocus(previous)) previous.focus(); else this.focusJobRow(this.reviewId);
    });
    document.querySelector("#closeReview").addEventListener("click", () => document.querySelector("#reviewDialog").close());
    document.querySelector("#attachRemoteButton").addEventListener("click", () => this.resolveReview("attach_remote_id"));
    document.querySelector("#resubmitReviewButton").addEventListener("click", () => this.resolveReview("resubmit"));
    document.querySelector("#abandonReviewButton").addEventListener("click", () => this.resolveReview("abandon"));
  }

  message(text, error = false) {
    const element = document.querySelector("#queueMessage");
    element.textContent = text;
    element.classList.toggle("is-error", error);
  }

  // Connection problems belong in the status pill, in the user's language.
  // Background refresh errors are cleared by the next successful refresh.
  reportError(error) {
    const connection = connectionFailure(error);
    if (connection) this.setOffline(error);
    if (connection && error.refreshFailure) return;
    this.message(error?.message || t("unknown"), true);
    this.refreshErrorShown = Boolean(error?.refreshFailure || connection);
  }

  setOffline(error) {
    this.offline = Number(error?.status) === 503 ? "starting" : "offline";
    setConnectionState(this.offline === "starting" ? "connectionStarting" : "connectionOffline");
  }

  async run(action, button) {
    if (button?._pending) return;
    if (button) setPending(button, true);
    try { return await action(); }
    catch (error) { this.reportError(error); }
    finally { if (button) { setPending(button, false); if (button._disabledByState !== undefined) button.disabled = Boolean(button._disabledByState); } }
  }

  async changePage(kind, offset, button) {
    return this.run(async () => {
      this.pagePending ||= new Set();
      if (this.pagePending.has(kind)) return;
      const pageKey = `${kind}Page`, cursorsKey = `${kind}Cursors`;
      const cursor = kind === "job" ? this.nextJobCursor : this.nextBatchCursor;
      if (offset > 0 && !cursor || offset < 0 && this[pageKey] === 0) { this.renderPagination(kind); return; }
      this.pagePending.add(kind);
      const before = this[pageKey], batchFilter = this.batchFilter, stateFilter = this.stateFilter;
      if (offset > 0) this[cursorsKey][before + 1] = cursor;
      this[pageKey] = Math.max(0, before + offset);
      this.renderPagination(kind);
      try { await (kind === "job" ? this.loadJobs() : this.loadBatches()); }
      catch (error) {
        if (this[pageKey] === before + offset && (kind !== "job" || batchFilter === this.batchFilter && stateFilter === this.stateFilter)) this[pageKey] = before;
        throw error;
      } finally { this.pagePending.delete(kind); this.renderPagination(kind); }
    }, button);
  }

  renderPagination(kind) {
    const prefix = kind === "job" ? "jobs" : "batch", page = this[`${kind}Page`];
    const nextCursor = kind === "job" ? this.nextJobCursor : this.nextBatchCursor;
    const loading = Boolean(this.pagePending?.has(kind));
    const buttons = [];
    for (const [suffix, disabled] of [["Previous", page === 0], ["Next", !nextCursor]]) {
      const button = document.querySelector(`#${prefix}${suffix}`);
      // While a page loads both buttons stay focusable but inert (aria-disabled
      // and the pending guard), so paging by keyboard keeps its focus.
      button._disabledByState = disabled && !loading;
      button.disabled = button._disabledByState;
      button.setAttribute("aria-disabled", String(loading || Boolean(button._pending) || disabled));
      buttons.push(button);
    }
    // Reaching the first or last page disables the focused button: hand focus to the other one.
    buttons.forEach((button, index) => { if (button.disabled && document.activeElement === button && !buttons[1 - index].disabled) buttons[1 - index].focus(); });
    setText(document.querySelector(`#${prefix}Page`), t("pageNumber", { page: page + 1 }));
  }

  invalidateSnapshots(resetSequence = false) {
    this.snapshotEpoch += 1;
    this.jobRevision += 1; this.batchRevision += 1; this.laneRevision += 1; this.galleryRevision += 1;
    // The old connection's requests must neither update the view nor block the
    // first snapshot of the new connection if an old response is slow.
    this.snapshotPromise = null;
    this.nextJobCursor = this.nextBatchCursor = null;
    if (resetSequence) {
      this.lastEventSeq = this.jobSnapshotSeq = this.batchSnapshotSeq = 0;
      this.jobEventFloor = this.batchEventFloor = 0;
      this.jobEvents.clear(); this.batchEvents.clear();
      for (const job of this.jobs.values()) delete job._seq;
    }
  }

  syncConnection(resetSequence = false) {
    this.invalidateSnapshots(resetSequence);
    this.streamConnected = true;
    this.connectionSyncing = true;
    setConnectionState("connectionSyncing");
    clearTimeout(this.refreshTimer); this.refreshTimer = null;
    // Reconnection and replay gaps must not wait for the normal event debounce.
    return this.run(() => this.refresh());
  }

  async start() {
    this.render();
    if (isFilePreview) return;
    if (!this.lifecycleBound) {
      this.lifecycleBound = true;
      window.addEventListener("pagehide", () => this.suspendLiveUpdates());
      window.addEventListener("pageshow", (event) => { if (event.persisted) this.run(() => this.resumeLiveUpdates()); });
    }
    await this.resumeLiveUpdates();
  }

  async resumeLiveUpdates() {
    if (this.events || isFilePreview) return;
    setConnectionState(this.offline ? (this.offline === "starting" ? "connectionStarting" : "connectionOffline") : "connectionReconnecting");
    // Connect before taking snapshots so changes during the requests are replayed.
    this.connectEvents();
    // SSE delivers changes while connected; REST polling is only a fallback
    // while the stream is down, plus a slow safety refresh.
    this.statusTimer = setInterval(() => this.pollTick(), 2000);
    this.countdownTimer = setInterval(() => this.updateCooldowns(), 1000);
    // Install cleanup and timers before a snapshot can fail.
    await this.refresh();
  }

  connectEvents() {
    const events = this.events = new EventSource("/api/events");
    const active = (action) => (event) => { if (this.events === events) return action(event); };
    events.addEventListener("ready", active(() => { if (!this.streamConnected) return this.syncConnection(true); }));
    events.addEventListener("resync", active(() => this.syncConnection()));
    events.addEventListener("change", active((event) => this.applyEvent(JSON.parse(event.data))));
    events.onopen = active(() => {
      this.reconnectAttempts = 0;
      // A restarted service can begin a new event sequence at zero.
      return this.syncConnection(true);
    });
    events.onerror = active(() => {
      this.streamConnected = false; this.invalidateSnapshots();
      setConnectionState(this.offline === "starting" ? "connectionStarting" : this.offline ? "connectionOffline" : "connectionReconnecting");
      // A non-200 answer (such as 503 while the service starts) closes an
      // EventSource for good (readyState CLOSED = 2); reconnect with backoff.
      if (events.readyState === 2) this.scheduleReconnect();
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer || !this.events) return;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(5, this.reconnectAttempts)) * (1 + Math.random() * 0.2);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.events) return;
      this.events.close();
      this.connectEvents();
    }, delay);
  }

  pollTick() {
    const since = Date.now() - this.lastRefreshAt;
    if (this.streamConnected ? since >= 30000 : since >= (this.offline ? 5000 : 2000)) this.scheduleRefresh();
  }

  suspendLiveUpdates() {
    const events = this.events;
    this.events = null;
    this.streamConnected = this.connectionSyncing = false;
    events?.close();
    clearInterval(this.statusTimer); clearInterval(this.countdownTimer); clearTimeout(this.refreshTimer); clearTimeout(this.renderTimer); clearTimeout(this.reconnectTimer);
    this.statusTimer = this.countdownTimer = this.refreshTimer = this.renderTimer = this.reconnectTimer = null;
    // Discard snapshots started before the page was suspended.
    this.invalidateSnapshots();
  }

  scheduleRefresh() {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.run(() => this.refresh());
    }, 750);
  }

  applyEvent(event) {
    if (!Number.isSafeInteger(event.seq) || event.seq <= this.lastEventSeq) return;
    this.lastEventSeq = event.seq;
    const isJob = event.type === "job" || event.type === "delete";
    const isBatch = event.type === "batch" || event.type === "delete_batch";
    if (isJob || isBatch) {
      const changes = isJob ? this.jobEvents : this.batchEvents;
      const snapshotSeq = isJob ? this.jobSnapshotSeq : this.batchSnapshotSeq;
      if (event.seq > snapshotSeq) {
        const previous = changes.get(event.jobId);
        changes.delete(event.jobId);
        changes.set(event.jobId, { ...(previous?.type === event.type ? previous : {}), ...event });
        if (changes.size > 2000) {
          const [oldestId, oldest] = changes.entries().next().value;
          changes.delete(oldestId);
          // Bound memory while preserving safety: snapshots predating an evicted
          // change can no longer be applied, especially for deleted tasks.
          const floorKey = isJob ? "jobEventFloor" : "batchEventFloor";
          this[floorKey] = Math.max(this[floorKey], oldest.seq);
        }
        if (isJob) {
          const current = this.jobs.get(event.jobId);
          if (event.type === "delete") this.jobs.delete(event.jobId);
          else if (current && (current._seq || 0) < event.seq) {
            const updated = { ...current, ...event, id: event.jobId, _seq: event.seq };
            if (this.stateFilter && updated.state !== this.stateFilter) this.jobs.delete(event.jobId);
            else this.jobs.set(event.jobId, updated);
          }
          this.scheduleJobRender();
        } else {
          this.batches = this.batches.flatMap((batch) => batch.id !== event.jobId ? [batch] : event.type === "delete_batch" ? [] : [{ ...batch, ...event, id: event.jobId }]);
          this.renderBatches();
        }
      }
    }
    this.scheduleRefresh();
  }

  mergeSnapshot(kind, rows, value) {
    const seqKey = `${kind}SnapshotSeq`, changes = this[`${kind}Events`];
    const seq = Number.isSafeInteger(value) ? value : this[seqKey];
    if (seq < Math.max(this[seqKey], this[`${kind}EventFloor`])) { this.scheduleRefresh(); return null; }
    const merged = rows.flatMap((row) => {
      const event = changes.get(row.id);
      if (!event || event.seq <= seq) return [{ ...row, _seq: seq }];
      if (event.type === "delete" || event.type === "delete_batch") return [];
      const updated = { ...row, ...event, id: row.id, _seq: event.seq };
      if (kind === "job" && this.stateFilter && updated.state !== this.stateFilter) return [];
      return [updated];
    });
    this[seqKey] = seq;
    // Once acknowledged by a snapshot, a change can be dropped: any response
    // with an older sequence is rejected above, including deleted-row snapshots.
    for (const [id, event] of changes) if (event.seq <= seq) changes.delete(id);
    return merged;
  }

  scheduleJobRender() {
    if (this.renderTimer) return;
    this.renderTimer = setTimeout(() => { this.renderTimer = null; this.renderJobs(); }, 80);
  }

  async refresh() {
    if (isFilePreview) return;
    // Slow snapshots are allowed to finish. New events request one later refresh
    // instead of starting requests that invalidate every response in flight.
    if (this.snapshotPromise) { this.scheduleRefresh(); return this.snapshotPromise; }
    const epoch = this.snapshotEpoch;
    this.lastRefreshAt = Date.now();
    const snapshot = this.snapshotPromise = Promise.allSettled([this.loadJobs(), this.loadBatches(), this.loadLanes(), this.loadGallerySummary()]).then((results) => {
      if (epoch !== this.snapshotEpoch) return false;
      const failure = results.find((result) => result.status === "rejected");
      if (failure) {
        const error = failure.reason && typeof failure.reason === "object" ? failure.reason : new Error(String(failure.reason));
        error.refreshFailure = true;
        throw error;
      }
      if (this.offline) {
        this.offline = false;
        setConnectionState(this.streamConnected ? (this.connectionSyncing ? "connectionSyncing" : "ready") : "connectionReconnecting");
      }
      if (this.refreshErrorShown) { this.refreshErrorShown = false; this.message(""); }
      if (results.some((result) => result.value === false)) { this.scheduleRefresh(); return false; }
      if (this.streamConnected && this.connectionSyncing) { this.connectionSyncing = false; setConnectionState("ready"); }
      return true;
    });
    try { await snapshot; }
    finally { if (this.snapshotPromise === snapshot) this.snapshotPromise = null; }
  }

  async loadPage(kind, query, apply) {
    const revisionKey = `${kind}Revision`, requestKey = `${kind}Request`, key = query.toString();
    const existing = this[requestKey];
    // A background refresh of the page being opened must share its request,
    // otherwise it can invalidate navigation before the next cursor arrives.
    if (existing?.key === key && existing.revision === this[revisionKey]) return existing.promise;
    const revision = ++this[revisionKey], pending = { key, revision };
    pending.promise = (async () => {
      const result = await apiRequest(`/api/${kind === "job" ? "jobs" : "batches"}?${query}`);
      if (revision !== this[revisionKey]) return false;
      return apply(result) !== false;
    })();
    this[requestKey] = pending;
    try { return await pending.promise; }
    finally { if (this[requestKey] === pending) this[requestKey] = null; }
  }

  async loadJobs() {
    const query = new URLSearchParams({ limit: "25" });
    if (this.jobCursors[this.jobPage]) query.set("cursor", this.jobCursors[this.jobPage]);
    if (this.batchFilter) query.set("batch", this.batchFilter);
    if (this.stateFilter) query.set("state", this.stateFilter);
    return this.loadPage("job", query, (result) => {
      const jobs = this.mergeSnapshot("job", result.jobs, result.seq);
      if (!jobs) return false;
      this.jobs = new Map(jobs.map((job) => [job.id, job]));
      this.nextJobCursor = result.nextCursor;
      this.renderJobs();
    });
  }

  async loadBatches() {
    const query = new URLSearchParams({ limit: "10" });
    if (this.batchCursors[this.batchPage]) query.set("cursor", this.batchCursors[this.batchPage]);
    return this.loadPage("batch", query, (result) => {
      const batches = this.mergeSnapshot("batch", result.batches, result.seq);
      if (!batches) return false;
      this.batches = batches;
      this.nextBatchCursor = result.nextCursor;
      this.batchesLoaded = true;
      this.renderBatches();
      this.checkBatchNotifications();
      this.loadBatchPrompts(batches);
    });
  }

  // Batch cards are labelled by their first prompt. Prompts never change, so
  // each batch costs at most one small request for the whole session.
  async loadBatchPrompts(batches) {
    const missing = batches.filter((batch) => batch.total > 0 && !this.batchPrompts.has(batch.id) && !this.batchPromptRequests.has(batch.id));
    if (!missing.length) return;
    await Promise.all(missing.map(async (batch) => {
      const known = [...this.jobs.values()].find((job) => job.batchId === batch.id && shotIndex(job) === 0 && job.prompt);
      if (known) { this.batchPrompts.set(batch.id, known.prompt); return; }
      this.batchPromptRequests.add(batch.id);
      try {
        const result = await apiRequest(`/api/jobs?${new URLSearchParams({ batch: batch.id, limit: "1" })}`);
        this.batchPrompts.set(batch.id, result.jobs?.[0]?.prompt || "");
      } catch { /* The card keeps its date-and-id label. */ }
      finally { this.batchPromptRequests.delete(batch.id); }
    }));
    this.renderBatches();
  }

  async loadLanes() {
    const revision = ++this.laneRevision;
    const [result, keys] = await Promise.all([apiRequest("/api/lanes"), apiRequest("/api/keys")]);
    if (revision !== this.laneRevision) return false;
    this.lanes = result.lanes;
    this.keys = keys;
    this.renderLanes();
    // Batch cards name their lane; lanes can arrive after the batch snapshot.
    this.renderBatches();
    updateSelectedKeyStatus();
    this.checkLaneNotifications();
    return true;
  }

  resetJobs() { this.jobPage = 0; this.jobCursors = [null]; this.nextJobCursor = null; this.renderPagination("job"); return this.run(() => Promise.all([this.loadJobs(), this.loadGallerySummary()])); }
  // Every status is shown for a newly selected or submitted batch.
  showBatch(id) { this.batchFilter = id; this.stateFilter = ""; this.renderFilters(); return this.resetJobs(); }
  keyPresent(lane) { return this.keys.some((item) => item.present && sameLane(item.lane, lane)); }

  render() { this.renderLanes(); this.renderBatches(); this.renderJobs(); }

  renderLanes() {
    const container = document.querySelector("#laneList");
    for (const [id, card] of this.laneCards) if (!this.lanes.some((lane) => lane.id === id)) { card.element.remove(); this.laneCards.delete(id); }
    container.querySelector(".empty-state")?.remove();
    if (!this.lanes.length) container.append(viewElement("p", "empty-state", t("noLanes")));
    for (const lane of this.lanes) {
      let card = this.laneCards.get(lane.id);
      if (!card) {
        const element = viewElement("article", "lane-card");
        const title = viewElement("strong");
        const endpoint = viewElement("small", "lane-endpoint");
        const status = viewElement("span", "state-label");
        const meta = viewElement("p", "field-meta");
        const warning = viewElement("p", "notice warning-note");
        const review = viewElement("p", "field-meta");
        const transport = viewElement("p", "notice warning-note");
        const keyLabel = viewElement("label", "field");
        const keyTitle = viewElement("span");
        const keyInput = document.createElement("input");
        keyInput.type = "password"; keyInput.autocomplete = "off"; keyInput.spellcheck = false;
        keyInput.addEventListener("input", () => { transport.hidden = !insecureCredentialLane(lane, this.keyPresent(lane) || Boolean(keyInput.value)); });
        const keyNote = viewElement("small", "field-meta");
        keyLabel.append(keyTitle, keyInput, keyNote);
        const keyStatus = viewElement("span", "field-meta");
        const save = viewButton("", () => this.run(async () => {
          try { await apiRequest("/api/keys", { lane: lane.lane || lane, key: keyInput.value }); }
          finally { keyInput.value = ""; }
          await this.loadLanes();
          this.message(t("keySaved"));
        }, save));
        const remove = viewButton("", () => this.run(async () => { await apiRequest(`/api/keys/${lane.id}`, undefined, "DELETE"); await this.loadLanes(); }, remove));
        const keyActions = viewElement("div", "inline-actions"); keyActions.append(save, remove, keyStatus);
        const concurrencyLabel = viewElement("label", "compact-field");
        const concurrencyTitle = viewElement("span");
        const concurrency = document.createElement("input"); concurrency.type = "number"; concurrency.min = "1"; concurrency.max = "1000"; concurrency.step = "1";
        concurrencyLabel.append(concurrencyTitle, concurrency);
        const configure = viewButton("", () => this.run(async () => { await apiRequest(`/api/lanes/${lane.id}`, { concurrency: Number(concurrency.value) }); await this.loadLanes(); scheduleEstimate(); }, configure));
        // `paused` is the manual/quota pause; `state` reports needs_key first.
        const toggle = viewButton("", () => this.run(async () => { const current = this.lanes.find((item) => item.id === lane.id); await apiRequest(`/api/lanes/${lane.id}`, { action: QueueView.lanePaused(current) ? "resume" : "pause" }); await this.loadLanes(); }, toggle));
        const use = viewButton("", () => selectExistingLane(lane));
        const controls = viewElement("div", "inline-actions lane-actions"); controls.append(use, toggle);
        // Key and concurrency settings fold away; a lane that needs a key opens them.
        const manage = viewElement("details", "lane-manage"), manageTitle = viewElement("summary");
        const concurrencyRow = viewElement("div", "inline-actions"); concurrencyRow.append(concurrencyLabel, configure);
        manage.append(manageTitle, keyLabel, keyActions, concurrencyRow);
        element.append(title, endpoint, status, meta, warning, review, transport, controls, manage);
        card = { element, title, endpoint, status, meta, warning, review, transport, keyTitle, keyInput, keyNote, keyStatus, save, remove, concurrencyTitle, concurrency, configure, toggle, use, manage, manageTitle };
        this.laneCards.set(lane.id, card); container.append(element);
      }
      const paused = QueueView.lanePaused(lane);
      setText(card.title, laneName(lane));
      setText(card.endpoint, lane.baseUrl);
      setText(card.status, lane.state === "needs_key" && paused ? `${t("laneNeedsKey")} · ${t("lanePaused")}` : t(queueStateKeys[lane.state] || "unknown"));
      card.element.dataset.state = lane.state;
      if (lane.state === "needs_key" && card.shownState !== "needs_key") card.manage.open = true;
      card.shownState = lane.state;
      setText(card.manageTitle, t("laneManage"));
      setText(card.meta, t("laneCounts", { used: lane.inFlight, limit: lane.concurrency, queued: lane.queued, downloading: lane.downloading || 0 }));
      const notes = [];
      if (lane.state === "needs_key") notes.push(t("needsKeyBanner", { count: lane.waitingForKey ?? lane.pending ?? lane.queued, lane: laneName(lane) }));
      if (paused) notes.push(t(queueReasonKeys[lane.pauseReason || lane.reason] || "lanePaused"));
      else if (lane.state === "paused") notes.push(t(queueReasonKeys[lane.reason] || "lanePaused"));
      card.warning.hidden = !notes.length && lane.state !== "cooldown";
      if (lane.state !== "cooldown") setText(card.warning, notes.join(" "));
      card.review.hidden = !lane.needsReview;
      setText(card.review, t("reviewSlots", { count: lane.needsReview }));
      setText(card.transport, t("plaintextKeyWarning"));
      card.transport.hidden = !insecureCredentialLane(lane, this.keyPresent(lane) || Boolean(card.keyInput.value));
      setText(card.keyTitle, t("apiKeyLabel"));
      card.keyInput.placeholder = t("replacementKey");
      setText(card.keyNote, t("trustNote"));
      setText(card.keyStatus, t(this.keyPresent(lane) ? "keyPresent" : "keyAbsent"));
      setText(card.save, t("saveKey")); setText(card.remove, t("deleteKey"));
      const removeDisabled = !this.keyPresent(lane);
      if (removeDisabled && document.activeElement === card.remove) card.keyInput.focus();
      card.remove.disabled = removeDisabled;
      setText(card.concurrencyTitle, t("concurrency"));
      if (document.activeElement !== card.concurrency) card.concurrency.value = lane.concurrency;
      setText(card.configure, t("applyConcurrency"));
      setText(card.toggle, t(paused ? "resume" : "pause"));
      setText(card.use, t("useLane"));
    }
    this.updateCooldowns();
  }

  static lanePaused(lane) { return Boolean(lane && (lane.paused ?? lane.state === "paused")); }

  updateCooldowns() {
    for (const lane of this.lanes) if (lane.state === "cooldown") {
      const remaining = Math.ceil((lane.cooldownUntil - Date.now()) / 1000);
      const card = this.laneCards.get(lane.id);
      if (card) setText(card.warning, t("cooldownRemaining", { seconds: Math.max(0, remaining) }));
      // No event announces the end of a cooldown; fetch the lane state then.
      if (remaining <= 0 && this.events && Date.now() - this.lastRefreshAt >= 2000) this.scheduleRefresh();
    }
  }

  // Batches are identified by when they were created and what they render.
  batchLabel(value) {
    const id = typeof value === "string" ? value : value?.id || "";
    const batch = typeof value === "string" ? this.batches.find((item) => item.id === id) : value;
    const created = Date.parse(batch?.createdAt);
    const date = Number.isFinite(created) ? new Date(created).toLocaleString(currentLocale(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const prompt = this.batchPrompts?.get(id);
    const parts = [date, prompt ? truncateText(prompt, 48) : ""].filter(Boolean);
    return parts.length ? parts.join(" · ") : `${t("batch")} ${id.slice(0, 8)}`;
  }

  batchOptionLabel(id) {
    const label = this.batchLabel(this.batches.find((batch) => batch.id === id) || id), short = id.slice(0, 8);
    return label.includes(short) ? label : `${label} (${short})`;
  }

  batchCounts(batch) { return Object.entries(batch.counts || {}).filter(([, count]) => count).map(([state, count]) => `${t(queueStateKeys[state] || "unknown")} ${formatInteger(count)}`).join(" · "); }

  renderBatches() {
    const container = document.querySelector("#batchList");
    const visible = new Set(this.batches.map((batch) => batch.id));
    for (const [id, card] of this.batchCards) if (!visible.has(id)) { card.element.remove(); this.batchCards.delete(id); }
    container.querySelector(".empty-state")?.remove();
    if (!this.batches.length) container.append(viewElement("p", "empty-state", t("noBatches")));
    this.batches.forEach((batch, index) => {
      let card = this.batchCards.get(batch.id);
      if (!card) {
        const element = viewElement("article", "batch-card");
        const title = viewButton("", () => this.showBatch(batch.id), "text-button"); title.title = batch.id;
        const meta = viewElement("small", "field-meta"), summary = viewElement("p", "field-meta"), status = viewElement("p", "field-meta"), budget = viewElement("p", "field-meta");
        const controls = viewElement("div", "inline-actions");
        const toggle = viewButton("", () => this.run(async () => {
          const current = this.batches.find((item) => item.id === batch.id);
          if (!current) return;
          await apiRequest(`/api/batches/${batch.id}/${current.state === "paused" ? "resume" : "pause"}`, {}); await this.refresh();
        }, toggle));
        const cancel = viewButton("", () => this.run(async () => {
          if (!await confirmAction(t("cancelBatchConfirm"), { danger: true })) return;
          await apiRequest(`/api/batches/${batch.id}/cancel`, {}); await this.refresh();
        }, cancel));
        // A bar of job states per batch; the summary line carries the same counts as text.
        const meter = viewElement("div", "batch-meter"); meter.setAttribute("aria-hidden", "true");
        controls.append(toggle, cancel); element.append(title, meta, meter, summary, status, budget, controls);
        card = { element, title, meta, meter, summary, status, budget, controls, toggle, cancel }; this.batchCards.set(batch.id, card);
      }
      if (container.children[index] !== card.element) container.insertBefore(card.element, container.children[index] || null);
      setText(card.title, this.batchLabel(batch));
      const lane = this.lanes.find((item) => item.id === batch.laneId);
      setText(card.meta, [lane ? laneName(lane) : "", `#${batch.id.slice(0, 8)}`, batch.takes > 1 ? t("batchTakes", { takes: batch.takes }) : ""].filter(Boolean).join(" · "));
      setText(card.summary, `${t("batchTotal", { count: batch.total })} · ${this.batchCounts(batch)}`);
      this.renderBatchMeter(card, batch);
      const finished = batchIsFinished(batch);
      card.element.dataset.state = batch.state === "cancelled" ? "cancelled" : finished ? "finished" : batch.state || "";
      setText(card.status, `${t(finished ? "batchFinished" : queueStateKeys[batch.state] || "unknown")}${!finished && batch.pauseReason ? ` · ${t(queueReasonKeys[batch.pauseReason] || "lanePaused")}` : ""}`);
      card.budget.hidden = !batch.budget; setText(card.budget, batch.budget ? `${t("budgetLabel")}: ${formatCost(batch.budget)}` : "");
      const hideControls = batch.state === "cancelled" || finished;
      if (hideControls && card.controls.contains?.(document.activeElement)) card.title.focus();
      card.controls.hidden = hideControls;
      card.toggle.disabled = batch.state === "preparing";
      card.cancel.disabled = batch.state === "preparing";
      setText(card.toggle, t(batch.state === "paused" ? "resume" : "pause")); setText(card.cancel, t("cancelBatch"));
    });
    this.renderPagination("batch");
    this.renderFirstRun();
    this.renderFilters();
    // Gallery batch headings use the same labels.
    if (this.galleryHeaders?.size) this.renderGallery();
  }

  // No batches anywhere (first page, loaded) and no jobs: show the three-step
  // guide instead of empty lists. Any page, filter or job keeps the queue.
  firstRun() { return Boolean(this.batchesLoaded) && this.batchPage === 0 && !this.batches.length && !this.jobs.size && !this.batchFilter && !this.stateFilter; }
  renderFirstRun() {
    const pane = document.querySelector("#dailies");
    if (!pane?.classList) return;
    const firstRun = this.firstRun(), focused = document.activeElement;
    pane.classList.toggle("is-first-run", firstRun);
    // Hidden sections must not keep keyboard focus (for example after Clear history).
    if (firstRun && focused?.closest?.(".batch-section, .jobs-section, .danger-zone")) document.querySelector("#refreshQueueButton").focus();
  }

  renderBatchMeter(card, batch) {
    const order = ["succeeded", "downloading", "running", "submitting", "needs_review", "failed", "result_expired", "cancelled", "queued", "preparing"];
    const counts = Object.entries(batch.counts || {}).filter(([, count]) => count > 0).sort(([a], [b]) => (order.indexOf(a) + 1 || order.length + 1) - (order.indexOf(b) + 1 || order.length + 1));
    const signature = counts.map(([state, count]) => `${state}:${count}`).join(",");
    if (card.meterSignature === signature) return;
    card.meterSignature = signature;
    card.meter.textContent = "";
    for (const [state, count] of counts) { const segment = viewElement("span", `meter-seg state-${state}`); segment.setAttribute("style", `flex-grow: ${Number(count)}`); card.meter.append(segment); }
    card.meter.hidden = !counts.length;
  }

  renderFilters() {
    const batchSelect = document.querySelector("#batchFilter");
    const batches = this.batches.map((batch) => batch.id);
    if (this.batchFilter && !batches.includes(this.batchFilter)) batches.unshift(this.batchFilter);
    fillSelect(batchSelect, ["", ...batches], this.batchFilter, (id) => id ? this.batchOptionLabel(id) : t("allBatches"));
    fillSelect(document.querySelector("#stateFilter"), ["", "queued", "submitting", "running", "downloading", "succeeded", "failed", "needs_review", "cancelled", "result_expired"], this.stateFilter, (state) => state ? t(queueStateKeys[state]) : t("allStates"));
  }

  shotLabel(job) {
    if (!job) return "";
    const shot = Number.isInteger(job.shot) ? job.shot + 1 : null;
    if (shot === null) return job.parentJobId ? t("retakeOnly") : Number.isInteger(job.index) ? t("shotOnly", { shot: job.index + 1 }) : "";
    if (job.parentJobId) return t("shotRetake", { shot });
    return Number.isInteger(job.take) ? t("shotTake", { shot, take: job.take }) : t("shotOnly", { shot });
  }

  // Where focus goes when the focused control of a job row disappears.
  rowFocusTarget(card) { return [card.review, card.cancel, card.stop, card.retry, card.regenerate, card.copy].find((button) => button && !button.hidden) || card.detailsTitle; }
  focusJobRow(id) { const card = this.jobRows.get(id); (card ? this.rowFocusTarget(card) : document.querySelector("#refreshQueueButton")).focus(); }

  createJobRow(id) {
    const element = viewElement("tr"); element.dataset.jobId = id; element.setAttribute("role", "row");
    const identity = viewElement("td"), prompt = viewElement("strong", "job-prompt"), model = viewElement("small", "field-meta");
    const details = viewElement("details", "job-details"), detailsTitle = viewElement("summary"), local = viewElement("p"), remote = viewElement("p"), fullPrompt = viewElement("p");
    details.append(detailsTitle, local, remote, fullPrompt); identity.append(prompt, model, details);
    const state = viewElement("td"), stateLabel = viewElement("span"), progress = document.createElement("progress"), percent = viewElement("small", "field-meta"), cancelPending = viewElement("small", "field-meta");
    progress.max = 100; state.append(stateLabel, progress, percent, cancelPending);
    const cost = viewElement("td", "job-cost"), result = viewElement("td", "job-result"), output = viewElement("span", "output-path"), error = viewElement("span", "job-error"), expiry = viewElement("strong", "expiry-warning");
    const copy = viewButton("", () => this.run(async () => {
      const path = this.jobs.get(id)?.output?.path;
      if (!path) return;
      try { await navigator.clipboard.writeText(path); } catch { throw new Error(t("copyPathFailed")); }
      this.message(t("pathCopied"));
    }, copy), "text-button"); result.append(output, copy, error, expiry);
    const actions = viewElement("td", "job-actions");
    const review = viewButton("", () => this.openReview(this.jobs.get(id)), "secondary review-action");
    const regenerate = viewButton("", () => this.run(() => this.regenerateJob(this.jobs.get(id)), regenerate));
    const retry = viewButton("", () => this.run(() => this.retryJob(this.jobs.get(id)), retry));
    const cancel = viewButton("", () => this.run(async () => {
      if (!await confirmAction(t("cancelJobConfirm"), { danger: true })) return;
      await apiRequest(`/api/jobs/${id}/cancel`, {}); await this.refresh();
    }, cancel));
    const stop = viewButton("", () => this.run(() => this.stopTracking(this.jobs.get(id)), stop), "secondary danger-action");
    actions.append(review, regenerate, retry, cancel, stop); element.append(identity, state, cost, result, actions);
    // Phone layouts stack the cells; each one carries its localized column name.
    const cells = [[identity, "jobPrompt"], [state, "jobProgress"], [cost, "jobCost"], [result, "jobResult"], [actions, "jobActions"]];
    for (const [cell] of cells) cell.setAttribute("role", "cell");
    return { element, cells, locale: "", prompt, model, detailsTitle, local, remote, fullPrompt, stateLabel, progress, percent, cancelPending, cost, output, copy, error, expiry, review, regenerate, retry, cancel, stop };
  }

  updateJobRow(card, job, locale) {
    if (card.locale !== locale) { for (const [cell, key] of card.cells) cell.setAttribute("data-label", t(key)); card.locale = locale; }
    setText(card.prompt, job.prompt || t("emptyPrompt"));
    setText(card.model, [job.model, `#${(job.index || 0) + 1}`, job.takes > 1 || job.parentJobId ? this.shotLabel(job) : ""].filter(Boolean).join(" · "));
    setText(card.detailsTitle, t("jobDetails")); setText(card.local, `${t("localId")}: ${job.id}`); setText(card.remote, `${t("remoteId")}: ${job.remote?.id || "—"}`); setText(card.fullPrompt, job.prompt || "");
    const abandoned = job.abandoned === true && job.state === "cancelled";
    card.stateLabel.className = `state-label state-${abandoned ? "abandoned" : job.state}`; setText(card.stateLabel, abandoned ? t("statusAbandoned") : t(queueStateKeys[job.state] || "unknown"));
    card.progress.value = job.state === "succeeded" ? 100 : Math.max(0, Math.min(100, Number(job.progress) || 0)); card.progress.setAttribute("aria-label", t("jobProgress")); setText(card.percent, `${Math.round(card.progress.value)}%`);
    card.cancelPending.hidden = !job.cancelRequested || !canCancelJob({ ...job, cancelRequested: false }); setText(card.cancelPending, t("cancelPending"));
    setText(card.cost, formatCost(job.costEstimate)); setText(card.output, job.output?.path || ""); card.output.hidden = card.copy.hidden = !job.output?.path; setText(card.copy, t("copyPath"));
    const errorKey = queueErrorKeys[job.error?.code || job.error?.category];
    card.error.hidden = !job.error;
    setText(card.error, job.error ? [errorKey ? t(errorKey) : job.error.message || t("unknown"), job.error.providerCode, job.error.providerMessage || (errorKey && !job.error.code ? job.error.message : "")].filter(Boolean).join(" · ") : "");
    const expires = Date.parse(job.resultExpiresAt);
    card.expiry.hidden = !Number.isFinite(expires) || expires - Date.now() >= 3600000 || ["succeeded", "cancelled", "failed"].includes(job.state);
    setText(card.expiry, card.expiry.hidden ? "" : t(expires < Date.now() ? "resultExpiredWarning" : "resultExpiring", { at: new Date(expires).toLocaleString(currentLocale()) }));
    // Stacked phone rows skip an empty output cell instead of showing a bare label.
    card.cells[3][0].setAttribute("data-empty", String(!job.output?.path && !job.error && card.expiry.hidden));
    card.review.hidden = job.state !== "needs_review"; setText(card.review, t("reviewAction"));
    card.regenerate.hidden = !["succeeded", "failed", "cancelled", "result_expired"].includes(job.state); setText(card.regenerate, t("regenerateOne"));
    card.retry.hidden = !canRetryJob(job); setText(card.retry, t("retry"));
    card.cancel.hidden = !canCancelJob(job); setText(card.cancel, t(job.state === "queued" ? "cancel" : "requestCancel"));
    card.stop.hidden = job.state !== "running"; setText(card.stop, t("stopTracking"));
  }

  renderJobs() {
    const body = document.querySelector("#jobsBody");
    const focused = document.activeElement, previousOrder = this.jobOrder || [];
    let removedFocusAt = -1;
    for (const [id, card] of this.jobRows) if (!this.jobs.has(id)) {
      if (focused && card.element.contains?.(focused)) removedFocusAt = previousOrder.indexOf(id);
      card.element.remove(); this.jobRows.delete(id);
    }
    body.querySelector(".empty-row")?.remove();
    if (!this.jobs.size) { const row = viewElement("tr", "empty-row"), cell = viewElement("td", "empty-state", t("noJobs")); cell.colSpan = 5; row.setAttribute("role", "row"); cell.setAttribute("role", "cell"); row.append(cell); body.append(row); }
    const locale = t("locale");
    let index = 0;
    for (const job of this.jobs.values()) {
      let card = this.jobRows.get(job.id);
      if (!card) { card = this.createJobRow(job.id); this.jobRows.set(job.id, card); }
      if (body.children[index] !== card.element) body.insertBefore(card.element, body.children[index] || null);
      index += 1;
      this.updateJobRow(card, job, locale);
    }
    this.jobOrder = [...this.jobs.keys()];
    // Keep keyboard focus in the table when a row or its focused action goes away.
    if (removedFocusAt >= 0) {
      const nextId = previousOrder.slice(removedFocusAt + 1).find((id) => this.jobRows.has(id)) || previousOrder.slice(0, removedFocusAt).reverse().find((id) => this.jobRows.has(id));
      this.focusJobRow(nextId);
    } else if (focused?.hidden) {
      for (const card of this.jobRows.values()) if (card.element.contains?.(focused)) { this.rowFocusTarget(card).focus(); break; }
    }
    this.renderPagination("job");
    this.renderFirstRun();
    setText(document.querySelector("#jobsCount"), t("visibleJobs", { count: this.jobs.size }));
    this.renderGallery();
  }

  async loadGallerySummary() {
    const revision = ++this.galleryRevision;
    const query = this.batchFilter ? `?${new URLSearchParams({ batchId: this.batchFilter })}` : "";
    const result = await apiRequest(`/api/gallery/summary${query}`);
    if (revision !== this.galleryRevision) return false;
    this.gallerySummary = result; this.renderGallerySummary();
    return true;
  }

  renderGallerySummary() {
    const summary = this.gallerySummary;
    const element = document.querySelector("#gallerySummary");
    // A polite live region: write only when the text really changes.
    if (!summary) { setText(element, t("gallerySummaryPending")); return; }
    const costs = (summary.costs || []).map((cost) => {
      const perKept = typeof cost.costPerKept === "number" ? { amount: cost.costPerKept, currency: cost.currency } : cost.costPerKept;
      return t("galleryCost", { total: formatCost(cost), perKept: formatCost(perKept) }) + (cost.unknownCount ? ` · ${t("unknownCosts", { count: cost.unknownCount })}` : "");
    });
    setText(element, [t("galleryCounts", { kept: summary.kept, rejected: summary.rejected, unreviewed: summary.unreviewed }), ...costs].join(" · "));
  }

  // Finished takes on this page, grouped by batch, then shot, then take.
  galleryJobs() {
    const position = new Map([...this.jobs.keys()].map((id, index) => [id, index]));
    const jobs = [...this.jobs.values()].filter((job) => job.state === "succeeded" && job.output?.path && (this.gallerySelection === "all" || (job.selection || "unreviewed") === this.gallerySelection));
    const batchOrder = new Map();
    for (const job of jobs) if (!batchOrder.has(job.batchId)) batchOrder.set(job.batchId, batchOrder.size);
    return jobs.sort((a, b) => batchOrder.get(a.batchId) - batchOrder.get(b.batchId) || shotIndex(a) - shotIndex(b) || takeIndex(a) - takeIndex(b) || position.get(a.id) - position.get(b.id));
  }

  renderGallery() {
    const container = document.querySelector("#galleryGrid");
    const jobs = this.galleryJobs(), ids = jobs.map((job) => job.id), visible = new Set(ids);
    const previousOrder = this.galleryOrder, focused = document.activeElement;
    let lostFocusAt = -1;
    for (const [id, card] of this.galleryCards) if (!visible.has(id)) {
      if (focused && (card.element === focused || card.element.contains?.(focused))) lostFocusAt = previousOrder.indexOf(id);
      this.discardGalleryCard(card);
    }
    const groupKey = (job) => `${job.batchId}:${shotIndex(job)}`, groupSizes = new Map(), batchesWithTakes = new Set();
    for (const job of jobs) groupSizes.set(groupKey(job), (groupSizes.get(groupKey(job)) || 0) + 1);
    for (const job of jobs) if (groupSizes.get(groupKey(job)) > 1) batchesWithTakes.add(job.batchId);
    // Several batches get a heading each; shots get headings only inside a
    // batch that shows several takes of one shot, so single takes keep flowing.
    const batchHeadings = new Set(jobs.map((job) => job.batchId)).size > 1;
    const nodes = [], headers = new Map();
    const heading = (key, className, text) => {
      const header = this.galleryHeaders.get(key) || viewElement("h4", className);
      setText(header, text); headers.set(key, header); nodes.push(header);
    };
    let previousBatch, previousKey = null;
    for (const job of jobs) {
      const key = groupKey(job);
      if (batchHeadings && job.batchId !== previousBatch) heading(`batch:${job.batchId}`, "gallery-batch-group", this.batchLabel(job.batchId || ""));
      previousBatch = job.batchId;
      if (batchesWithTakes.has(job.batchId) && key !== previousKey) {
        const shot = shotIndex(job), count = groupSizes.get(key);
        heading(key, "gallery-shot-group", shot === Number.MAX_SAFE_INTEGER ? t("retakeOnly") : t(count === 1 ? "shotGroupOne" : "shotGroup", { shot: shot + 1, count }));
      }
      previousKey = key;
      let card = this.galleryCards.get(job.id);
      if (!card) { card = this.createGalleryCard(job); this.galleryCards.set(job.id, card); }
      this.updateGalleryCard(card, job);
      nodes.push(card.element);
    }
    for (const [key, header] of this.galleryHeaders) if (!headers.has(key)) header.remove();
    this.galleryHeaders = headers;
    container.querySelector(".empty-state")?.remove();
    // Insert by index like the job table so card order follows task order.
    nodes.forEach((node, index) => { if (container.children[index] !== node) container.insertBefore(node, container.children[index] || null); });
    if (!jobs.length) container.append(viewElement("p", "empty-state", t("galleryEmpty")));
    this.galleryOrder = ids;
    if (!visible.has(this.galleryFocusId)) {
      const anchor = lostFocusAt >= 0 ? lostFocusAt : previousOrder.indexOf(this.galleryFocusId);
      this.galleryFocusId = anchor >= 0 ? previousOrder.slice(anchor + 1).find((id) => visible.has(id)) || previousOrder.slice(0, anchor).reverse().find((id) => visible.has(id)) || ids[0] || null : ids[0] || null;
    }
    this.updateGalleryTabStops();
    // The focused card left the filtered view: continue with its neighbour.
    if (lostFocusAt >= 0) (this.galleryCards.get(this.galleryFocusId)?.element || container).focus();
    document.querySelector("#galleryShortcuts").hidden = !jobs.length;
    const label = t("galleryGridLabel");
    if (container.getAttribute("aria-label") !== label) container.setAttribute("aria-label", label);
    this.renderExportLinks();
    this.renderGallerySummary();
  }

  updateGalleryTabStops() {
    for (const [id, card] of this.galleryCards) { const value = id === this.galleryFocusId ? 0 : -1; if (card.element.tabIndex !== value) card.element.tabIndex = value; }
  }

  createGalleryCard(job) {
    const id = job.id;
    const element = viewElement("article", "gallery-card"); element.dataset.jobId = id; element.tabIndex = -1;
    element.setAttribute("aria-keyshortcuts", galleryShortcutKeys);
    const shot = viewElement("p", "gallery-shot");
    const video = document.createElement("video"); video.controls = true; video.preload = "metadata"; video.playsInline = true;
    const prompt = viewElement("p", "gallery-prompt"); prompt.id = `gallery-prompt-${id}`;
    const expand = viewButton("", () => this.toggleExpanded(id), "text-button gallery-expand"); expand.setAttribute("aria-controls", prompt.id);
    const meta = viewElement("p", "field-meta");
    const actions = viewElement("div", "inline-actions gallery-actions");
    const selections = {};
    for (const selection of ["keep", "reject", "unreviewed"]) {
      const button = viewButton("", () => this.run(() => this.curate(id, selection), button), `secondary selection-${selection}`);
      selections[selection] = button; actions.append(button);
    }
    const regenerate = viewButton("", () => this.run(() => this.regenerateJob(this.jobs.get(id)), regenerate));
    element.append(shot, video, prompt, expand, meta, actions, regenerate);
    const card = { id, job, element, shot, video, prompt, expand, meta, selections, regenerate, duration: null, videoLoaded: false };
    video.addEventListener("loadedmetadata", () => { card.duration = video.duration; this.renderGalleryMeta(card); });
    this.observeGalleryVideo(card);
    return card;
  }

  updateGalleryCard(card, job) {
    card.job = job;
    const label = this.shotLabel(job), selection = job.selection || "unreviewed", expanded = this.expandedCards.has(job.id);
    setText(card.shot, label); card.shot.hidden = !label;
    card.element.dataset.selection = selection;
    card.element.classList.toggle("is-expanded", expanded);
    card.element.setAttribute("aria-label", t("galleryCardLabel", { label: label || t("galleryTitle"), selection: t(selectionKeys[selection]), prompt: truncateText(job.prompt, 120) }));
    card.video.setAttribute("aria-label", t("previewVideo", { prompt: job.prompt }));
    setText(card.prompt, job.prompt);
    setText(card.expand, t(expanded ? "collapseTake" : "expandTake")); card.expand.setAttribute("aria-expanded", String(expanded));
    this.renderGalleryMeta(card);
    for (const [value, button] of Object.entries(card.selections)) {
      setText(button, t(selectionKeys[value]));
      button.setAttribute("aria-pressed", String(selection === value));
    }
    setText(card.regenerate, t("regenerateOne"));
  }

  renderGalleryMeta(card) { setText(card.meta, [card.job.model, formatCost(card.job.costEstimate), formatClock(card.duration)].filter(Boolean).join(" · ")); }

  // Load previews near the viewport only; metadata plus #t=0.1 shows the first
  // frame and the duration instead of a black 0:00 box.
  observeGalleryVideo(card) {
    if (typeof IntersectionObserver !== "function") { this.loadGalleryVideo(card); return; }
    this.videoObserver ||= new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        this.videoObserver.unobserve(entry.target);
        const target = this.galleryCards.get(entry.target.dataset.jobId);
        if (target) this.loadGalleryVideo(target);
      }
    }, { rootMargin: "400px 0px" });
    this.videoObserver.observe(card.element);
  }

  loadGalleryVideo(card) {
    if (card.videoLoaded) return;
    card.videoLoaded = true;
    card.video.src = `/api/jobs/${encodeURIComponent(card.id)}/media#t=0.1`;
  }

  discardGalleryCard(card) {
    this.videoObserver?.unobserve(card.element);
    card.video.pause(); card.video.removeAttribute("src"); card.video.load?.();
    card.element.remove(); this.galleryCards.delete(card.id); this.expandedCards.delete(card.id);
  }

  renderExportLinks() {
    for (const [id, selection, format] of [["#exportKeptCsv", "keep", "csv"], ["#exportKeptJson", "keep", "json"], ["#exportAllCsv", "all", "csv"], ["#exportAllJson", "all", "json"]]) {
      const query = new URLSearchParams({ selection, format });
      if (this.batchFilter) query.set("batch", this.batchFilter);
      const link = document.querySelector(id), href = `/api/export?${query}`;
      if (link.getAttribute("href") !== href) link.setAttribute("href", href);
    }
  }

  galleryFocused(event) {
    const element = event.target.closest?.(".gallery-card"), id = element?.dataset.jobId;
    if (!id || id === this.galleryFocusId || !this.galleryCards.has(id)) return;
    this.galleryFocusId = id; this.updateGalleryTabStops();
  }

  focusGalleryCard(id) {
    const card = this.galleryCards.get(id); if (!card) return;
    this.galleryFocusId = id; this.updateGalleryTabStops(); this.loadGalleryVideo(card);
    card.element.focus();
  }

  moveGalleryFocus(id, delta) {
    const order = this.galleryOrder, index = order.indexOf(id);
    const next = order[Math.max(0, Math.min(order.length - 1, index + delta))];
    if (next && next !== id) this.focusGalleryCard(next);
  }

  // Keyboard review: J/K or arrows move, Space plays, Enter expands, 1/2/3 (or U) decide.
  handleGalleryKey(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
    const element = target.closest?.(".gallery-card"), id = element?.dataset.jobId, card = this.galleryCards.get(id);
    if (!card) return;
    // Native video and button keys keep working: arrows seek and Space/Enter activate.
    const onCard = target === element, onVideo = target.tagName === "VIDEO", key = event.key;
    if (key === "j" || key === "J" || key === "ArrowRight" && !onVideo) this.moveGalleryFocus(id, 1);
    else if (key === "k" || key === "K" || key === "ArrowLeft" && !onVideo) this.moveGalleryFocus(id, -1);
    else if ((key === " " || key === "Spacebar") && onCard) this.togglePlayback(card);
    else if (key === "Enter" && onCard) this.toggleExpanded(id);
    else if (key === "Escape" && this.expandedCards.has(id)) this.toggleExpanded(id);
    else if (key === "1") this.curateFromKeyboard(id, "keep");
    else if (key === "2") this.curateFromKeyboard(id, "reject");
    else if (key === "3" || key === "u" || key === "U") this.curateFromKeyboard(id, "unreviewed");
    else return;
    event.preventDefault();
  }

  togglePlayback(card) {
    this.loadGalleryVideo(card);
    if (card.video.paused) card.video.play()?.catch?.(() => {});
    else card.video.pause();
  }

  toggleExpanded(id) {
    if (this.expandedCards.has(id)) this.expandedCards.delete(id); else this.expandedCards.add(id);
    const card = this.galleryCards.get(id); if (!card) return;
    this.updateGalleryCard(card, this.jobs.get(id) || card.job); this.loadGalleryVideo(card);
    card.element.scrollIntoView?.({ block: "nearest" });
  }

  curateFromKeyboard(id, selection) {
    const card = this.galleryCards.get(id); if (!card) return;
    return this.run(() => this.curate(id, selection, { advance: selection !== "unreviewed" }), card.selections[selection]);
  }

  // Applies the saved decision immediately; the counts follow with the next refresh.
  async curate(id, selection, { advance = false } = {}) {
    const before = [...this.galleryOrder];
    const updated = await apiRequest(`/api/jobs/${encodeURIComponent(id)}/curate`, { selection });
    const current = this.jobs.get(id);
    if (current) this.jobs.set(id, { ...current, selection: updated?.selection || selection, ...(updated?.reviewedAt ? { reviewedAt: updated.reviewedAt } : {}) });
    this.renderGallery();
    if (advance) this.advanceAfterReview(id, before);
    this.announceReview(id, selection);
    this.scheduleRefresh();
  }

  // After Keep/Reject move to the next unreviewed take, wrapping around once.
  advanceAfterReview(id, before) {
    const start = before.indexOf(id), visible = new Set(this.galleryOrder);
    const next = [...before.slice(start + 1), ...before.slice(0, Math.max(0, start))].find((jobId) => jobId !== id && visible.has(jobId) && (this.jobs.get(jobId)?.selection || "unreviewed") === "unreviewed");
    if (next) this.focusGalleryCard(next);
  }

  announceReview(id, selection) {
    const remaining = [...this.jobs.values()].filter((job) => job.state === "succeeded" && job.output?.path && (job.selection || "unreviewed") === "unreviewed").length;
    const values = { label: this.shotLabel(this.jobs.get(id)) || t("galleryTitle"), selection: t(selectionKeys[selection]), count: remaining };
    this.announce(t(remaining ? "galleryAnnounce" : "galleryAnnounceDone", values));
  }

  announce(text) {
    const region = document.querySelector("#galleryAnnouncer");
    // Repeating identical text would not be announced again.
    region.textContent = region.textContent === text ? `${text} ` : text;
  }

  async regenerateJob(job) {
    if (!job) return;
    const estimate = await apiRequest(`/api/jobs/${job.id}/regenerate/estimate`);
    if (!await confirmAction(t("confirmRegenerate", { prompt: job.prompt, cost: formatCost(estimate.cost) }), { danger: true })) return;
    await apiRequest(`/api/jobs/${job.id}/regenerate`, { confirmed: true, confirmationToken: estimate.confirmationToken });
    await this.refresh(); this.message(t("regenerationQueued"));
  }

  // Retry re-queues the same job after a create the provider definitely
  // rejected, so it cannot duplicate a charge. It needs no regenerate quote
  // (which fails once the catalog drops the model); the job's own estimate is shown.
  async retryJob(job) {
    if (!job || !canRetryJob(job)) return;
    if (!await confirmAction(t("confirmRetry", { prompt: job.prompt || t("emptyPrompt"), cost: formatCost(job.costEstimate) }), { danger: true })) return;
    await apiRequest(`/api/jobs/${job.id}/retry`, { confirmed: true });
    await this.refresh();
  }

  // Stops local tracking of a running job; the provider keeps (and bills) the work.
  async stopTracking(job) {
    if (!job || job.state !== "running") return;
    if (!await confirmAction(t("stopTrackingConfirm", { prompt: job.prompt || t("emptyPrompt") }), { danger: true })) return;
    await apiRequest(`/api/jobs/${job.id}/resolve`, { action: "abandon" });
    await this.refresh();
    this.message(t("trackingStopped"));
  }

  openReview(job) {
    if (!job) return;
    this.reviewPreviousFocus = document.activeElement;
    this.reviewId = job.id;
    document.querySelector("#reviewJob").textContent = `${laneName(job)} · ${job.model}\n${job.prompt}\n${job.id}`;
    document.querySelector("#reviewRemoteId").value = "";
    document.querySelector("#reviewMessage").textContent = "";
    const model = job.modelConfig || providers.find((provider) => provider.provider === job.provider)?.models.find((candidate) => candidate.id === job.model);
    const note = document.querySelector("#manualRecoveryNote");
    note.hidden = !model?.manualRecoveryNoteKey;
    note.textContent = model?.manualRecoveryNoteKey ? t(model.manualRecoveryNoteKey) : "";
    document.querySelector("#reviewDialog").showModal();
    document.querySelector("#closeReview").focus();
  }

  async resolveReview(action) {
    const buttons = [document.querySelector("#attachRemoteButton"), document.querySelector("#resubmitReviewButton"), document.querySelector("#abandonReviewButton")];
    if (buttons.some((button) => button._pending)) return;
    const payload = { action };
    if (action === "attach_remote_id") {
      payload.remoteId = document.querySelector("#reviewRemoteId").value.trim();
      if (!payload.remoteId) { document.querySelector("#reviewMessage").textContent = t("missingRemoteId"); return; }
    }
    if (action === "resubmit" && !await confirmAction(t("resubmitConfirm"), { danger: true })) return;
    if (action === "abandon" && !await confirmAction(t("abandonConfirm"), { danger: true })) return;
    buttons.forEach((button) => setPending(button, true));
    try {
      await apiRequest(`/api/jobs/${this.reviewId}/resolve`, payload);
      document.querySelector("#reviewDialog").close();
      await this.refresh();
      // Focus may have fallen back to <body> while the resolved row changed.
      if (!canFocus(document.activeElement)) this.focusJobRow(this.reviewId);
    } catch (error) { document.querySelector("#reviewMessage").textContent = error.message; }
    finally { buttons.forEach((button) => setPending(button, false)); }
  }

  restoreNotifications() {
    const supported = typeof Notification === "function";
    this.notificationsEnabled = supported && storageGet("videogen.notifications") === "1" && Notification.permission === "granted";
    document.querySelector("#notifyToggle").checked = this.notificationsEnabled;
  }

  // Permission is requested only from the user's own click on the toggle.
  async toggleNotifications(input) {
    if (!input.checked) { this.notificationsEnabled = false; storageSet("videogen.notifications", "0"); return; }
    if (typeof Notification !== "function") { input.checked = false; throw new Error(t("notifyUnsupported")); }
    const permission = Notification.permission === "granted" ? "granted" : await new Promise((resolve) => { const result = Notification.requestPermission(resolve); result?.then?.(resolve, () => resolve("denied")); });
    if (permission !== "granted") { input.checked = false; this.notificationsEnabled = false; storageSet("videogen.notifications", "0"); throw new Error(t("notifyDenied")); }
    this.notificationsEnabled = true; storageSet("videogen.notifications", "1"); this.message(t("notifyEnabled"));
  }

  notify(title, body, tag) {
    if (!this.notificationsEnabled || typeof Notification !== "function" || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible" && document.hasFocus?.()) return;
    try { const note = new Notification(title, { body, tag }); note.onclick = () => { window.focus(); note.close(); }; }
    catch { /* Some browsers only show notifications from a service worker. */ }
  }

  // Notify on transitions seen in this session, never for the initial state.
  checkBatchNotifications() {
    for (const batch of this.batches) {
      const finished = batchIsFinished(batch);
      if (this.notificationsEnabled && this.notifiedBatches.get(batch.id) === false && finished) this.notify(t("notifyBatchFinishedTitle"), `${this.batchLabel(batch)}\n${this.batchCounts(batch)}`, `videogen-batch-${batch.id}`);
      this.notifiedBatches.set(batch.id, finished);
    }
  }

  checkLaneNotifications() {
    const review = this.lanes.reduce((sum, lane) => sum + (Number(lane.needsReview) || 0), 0);
    const waiting = new Set(this.lanes.filter((lane) => lane.state === "needs_key" && (lane.waitingForKey || lane.pending)).map((lane) => lane.id));
    if (this.laneBaseline && this.notificationsEnabled) {
      if (review > this.reviewCount) this.notify(t("notifyReviewTitle"), t("notifyReviewBody", { count: review }), "videogen-review");
      for (const lane of this.lanes) if (waiting.has(lane.id) && !this.keyWaiting.has(lane.id)) this.notify(t("notifyKeyTitle"), t("notifyKeyBody", { lane: laneName(lane), count: lane.waitingForKey || lane.pending }), `videogen-key-${lane.id}`);
    }
    this.laneBaseline = true; this.reviewCount = review; this.keyWaiting = waiting;
  }
}
