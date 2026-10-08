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

const queueStateKeys = { queued: "statusQueued", submitting: "statusSubmitting", running: "statusInProgress", downloading: "statusDownloading", succeeded: "statusCompleted", failed: "statusFailed", cancelled: "statusCancelled", needs_review: "needsReviewShort", result_expired: "statusExpired", active: "laneActive", preparing: "statusPreparing", paused: "lanePaused", cooldown: "laneCooldown", needs_key: "laneNeedsKey" };
const queueReasonKeys = { manual_pause: "reasonManual", rate_limited: "reasonRateLimit", auth: "reasonAuth", quota: "reasonQuota", model_unavailable: "reasonModel", circuit_open: "reasonCircuit", budget: "reasonBudget", budget_unknown: "reasonUnknownBudget", storeWriteFailed: "reasonStore", storeClosed: "reasonStore", schedulerFailed: "reasonScheduler", local_offline: "reasonOffline", interrupted_enqueue: "reasonInterruptedEnqueue" };
const queueErrorKeys = { moderation: "errorModeration", invalid_request: "errorInvalidRequest", unknown_outcome: "reviewExplanation", transient: "errorTransient", auth: "reasonAuth", quota: "reasonQuota", rate_limited: "reasonRateLimit", result_expired: "errorExpired", model_unavailable: "reasonModel", output_write_failed: "errorOutputWrite", local_offline: "reasonOffline" };

class QueueView {
  constructor() {
    this.jobs = new Map();
    this.batches = [];
    this.lanes = [];
    this.keys = [];
    this.laneCards = new Map();
    this.batchCards = new Map();
    this.jobRows = new Map();
    this.galleryCards = new Map();
    this.gallerySummary = null;
    this.galleryRevision = 0;
    this.gallerySelection = "all";
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
      document.querySelector(id).addEventListener("click", () => this.run(async () => {
        const pageKey = `${kind}Page`;
        if (offset > 0) this[`${kind}Cursors`][this[pageKey] + 1] = kind === "job" ? this.nextJobCursor : this.nextBatchCursor;
        this[pageKey] = Math.max(0, this[pageKey] + offset);
        await (kind === "job" ? this.loadJobs() : this.loadBatches());
      }));
    }
    document.querySelector("#batchFilter").addEventListener("change", (event) => { this.batchFilter = event.target.value; this.resetJobs(); });
    document.querySelector("#stateFilter").addEventListener("change", (event) => { this.stateFilter = event.target.value; this.resetJobs(); });
    document.querySelector("#gallerySelection").addEventListener("change", (event) => { this.gallerySelection = event.target.value; this.renderGallery(); });
    document.querySelector("#reviewDialog").addEventListener("close", () => {
      if (this.reviewPreviousFocus?.isConnected) this.reviewPreviousFocus.focus();
      this.reviewPreviousFocus = null;
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

  async run(action, button) {
    if (button?._pending) return;
    if (button) { button._pending = true; button.disabled = true; }
    try { return await action(); }
    catch (error) { this.message(error.message, true); }
    finally { if (button) { button._pending = false; button.disabled = false; } }
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
    setConnectionState("connectionReconnecting");
    // Connect before taking snapshots so changes during the requests are replayed.
    const events = this.events = new EventSource("/api/events");
    const active = (action) => (event) => { if (this.events === events) action(event); };
    events.addEventListener("ready", active(() => { setConnectionState("ready"); this.scheduleRefresh(); }));
    events.addEventListener("resync", active(() => this.scheduleRefresh()));
    events.addEventListener("change", active((event) => this.applyEvent(JSON.parse(event.data))));
    events.onopen = active(() => {
      // A restarted service can begin a new event sequence at zero.
      for (const job of this.jobs.values()) delete job._seq;
      this.jobRevision += 1;
      setConnectionState("ready"); this.scheduleRefresh();
    });
    events.onerror = active(() => setConnectionState("connectionReconnecting"));
    this.statusTimer = setInterval(() => { this.scheduleRefresh(); this.updateCooldowns(); }, 2000);
    this.countdownTimer = setInterval(() => this.updateCooldowns(), 1000);
    // Install cleanup and timers before a snapshot can fail.
    await this.refresh();
  }

  suspendLiveUpdates() {
    const events = this.events;
    this.events = null;
    events?.close();
    clearInterval(this.statusTimer); clearInterval(this.countdownTimer); clearTimeout(this.refreshTimer); clearTimeout(this.renderTimer);
    this.statusTimer = this.countdownTimer = this.refreshTimer = this.renderTimer = null;
    this.snapshotPromise = null;
    // Discard snapshots started before the page was suspended.
    this.jobRevision += 1; this.batchRevision += 1; this.laneRevision += 1; this.galleryRevision += 1;
  }

  scheduleRefresh() {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.run(() => this.refresh());
    }, 750);
  }

  applyEvent(event) {
    const current = this.jobs.get(event.jobId);
    if (event.type === "job" && current) {
      if ((current._seq || 0) < event.seq) this.jobs.set(event.jobId, { ...current, ...event, id: event.jobId, _seq: event.seq });
      this.scheduleJobRender();
    } else if (event.type === "delete") { this.jobs.delete(event.jobId); this.scheduleJobRender(); }
    this.scheduleRefresh();
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
    const snapshot = this.snapshotPromise = Promise.allSettled([this.loadJobs(), this.loadBatches(), this.loadLanes(), this.loadGallerySummary()]).then((results) => {
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
    });
    try { await snapshot; }
    finally { if (this.snapshotPromise === snapshot) this.snapshotPromise = null; }
  }

  async loadJobs() {
    const revision = ++this.jobRevision;
    const query = new URLSearchParams({ limit: "25" });
    if (this.jobCursors[this.jobPage]) query.set("cursor", this.jobCursors[this.jobPage]);
    if (this.batchFilter) query.set("batch", this.batchFilter);
    if (this.stateFilter) query.set("state", this.stateFilter);
    const result = await apiRequest(`/api/jobs?${query}`);
    if (revision !== this.jobRevision) return;
    const next = new Map(result.jobs.map((job) => {
      const newer = this.jobs.get(job.id);
      return [job.id, newer?._seq > result.seq ? newer : { ...job, _seq: result.seq }];
    }));
    this.jobs = next;
    this.nextJobCursor = result.nextCursor;
    this.renderJobs();
  }

  async loadBatches() {
    const revision = ++this.batchRevision;
    const query = new URLSearchParams({ limit: "10" });
    if (this.batchCursors[this.batchPage]) query.set("cursor", this.batchCursors[this.batchPage]);
    const result = await apiRequest(`/api/batches?${query}`);
    if (revision !== this.batchRevision) return;
    this.batches = result.batches;
    this.nextBatchCursor = result.nextCursor;
    this.renderBatches();
  }

  async loadLanes() {
    const revision = ++this.laneRevision;
    const [result, keys] = await Promise.all([apiRequest("/api/lanes"), apiRequest("/api/keys")]);
    if (revision !== this.laneRevision) return;
    this.lanes = result.lanes;
    this.keys = keys;
    this.renderLanes();
    updateSelectedKeyStatus();
  }

  resetJobs() { this.jobPage = 0; this.jobCursors = [null]; this.run(() => Promise.all([this.loadJobs(), this.loadGallerySummary()])); }
  showBatch(id) { this.batchFilter = id; this.stateFilter = ""; this.renderFilters(); this.resetJobs(); }
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
        const toggle = viewButton("", () => this.run(async () => { const state = this.lanes.find((item) => item.id === lane.id)?.state; await apiRequest(`/api/lanes/${lane.id}`, { action: state === "paused" ? "resume" : "pause" }); await this.loadLanes(); }, toggle));
        const use = viewButton("", () => selectExistingLane(lane));
        const controls = viewElement("div", "inline-actions"); controls.append(concurrencyLabel, configure, toggle, use);
        element.append(title, endpoint, status, meta, warning, review, transport, keyLabel, keyActions, controls);
        card = { element, title, endpoint, status, meta, warning, review, transport, keyTitle, keyInput, keyNote, keyStatus, save, remove, concurrencyTitle, concurrency, configure, toggle, use };
        this.laneCards.set(lane.id, card); container.append(element);
      }
      card.title.textContent = laneName(lane);
      card.endpoint.textContent = lane.baseUrl;
      card.status.textContent = t(queueStateKeys[lane.state] || "unknown");
      card.element.dataset.state = lane.state;
      card.meta.textContent = t("laneCounts", { used: lane.inFlight, limit: lane.concurrency, queued: lane.queued, downloading: lane.downloading || 0 });
      card.warning.hidden = !["needs_key", "cooldown", "paused"].includes(lane.state);
      card.warning.textContent = lane.state === "needs_key" ? t("needsKeyBanner", { count: lane.waitingForKey ?? lane.pending ?? lane.queued, lane: laneName(lane) }) : lane.state === "paused" ? t(queueReasonKeys[lane.reason] || "lanePaused") : "";
      card.review.hidden = !lane.needsReview;
      card.review.textContent = t("reviewSlots", { count: lane.needsReview });
      card.transport.textContent = t("plaintextKeyWarning");
      card.transport.hidden = !insecureCredentialLane(lane, this.keyPresent(lane) || Boolean(card.keyInput.value));
      card.keyTitle.textContent = t("apiKeyLabel");
      card.keyInput.placeholder = t("replacementKey");
      card.keyNote.textContent = t("trustNote");
      card.keyStatus.textContent = t(this.keyPresent(lane) ? "keyPresent" : "keyAbsent");
      card.save.textContent = t("saveKey"); card.remove.textContent = t("deleteKey"); card.remove.disabled = Boolean(card.remove._pending) || !this.keyPresent(lane);
      card.concurrencyTitle.textContent = t("concurrency");
      if (document.activeElement !== card.concurrency) card.concurrency.value = lane.concurrency;
      card.configure.textContent = t("applyConcurrency");
      card.toggle.textContent = t(lane.state === "paused" ? "resume" : "pause");
      card.use.textContent = t("useLane");
    }
    this.updateCooldowns();
  }

  updateCooldowns() {
    for (const lane of this.lanes) if (lane.state === "cooldown") {
      const card = this.laneCards.get(lane.id);
      if (card) card.warning.textContent = t("cooldownRemaining", { seconds: Math.max(0, Math.ceil((lane.cooldownUntil - Date.now()) / 1000)) });
    }
  }

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
        controls.append(toggle, cancel); element.append(title, meta, summary, status, budget, controls);
        card = { element, title, meta, summary, status, budget, controls, toggle, cancel }; this.batchCards.set(batch.id, card);
      }
      if (container.children[index] !== card.element) container.insertBefore(card.element, container.children[index] || null);
      card.title.textContent = `${t("batch")} ${batch.id.slice(0, 8)}`;
      const lane = this.lanes.find((item) => item.id === batch.laneId), createdAt = Date.parse(batch.createdAt);
      card.meta.textContent = [lane ? laneName(lane) : "", Number.isFinite(createdAt) ? new Date(createdAt).toLocaleString(currentLocale()) : ""].filter(Boolean).join(" · ");
      const counts = Object.entries(batch.counts || {}).filter(([, count]) => count).map(([state, count]) => `${t(queueStateKeys[state] || "unknown")} ${formatInteger(count)}`).join(" · ");
      card.summary.textContent = `${t("batchTotal", { count: batch.total })} · ${counts}`;
      const finished = batch.total > 0 && Object.entries(batch.counts || {}).every(([state, count]) => !count || ["succeeded", "failed", "cancelled", "result_expired"].includes(state));
      card.status.textContent = `${t(finished ? "batchFinished" : queueStateKeys[batch.state] || "unknown")}${!finished && batch.pauseReason ? ` · ${t(queueReasonKeys[batch.pauseReason] || "lanePaused")}` : ""}`;
      card.budget.hidden = !batch.budget; card.budget.textContent = batch.budget ? `${t("budgetLabel")}: ${formatCost(batch.budget)}` : "";
      card.controls.hidden = batch.state === "cancelled" || finished;
      card.toggle.disabled = Boolean(card.toggle._pending) || batch.state === "preparing";
      card.cancel.disabled = Boolean(card.cancel._pending) || batch.state === "preparing";
      card.toggle.textContent = t(batch.state === "paused" ? "resume" : "pause"); card.cancel.textContent = t("cancelBatch");
    });
    document.querySelector("#batchPrevious").disabled = this.batchPage === 0;
    document.querySelector("#batchNext").disabled = !this.nextBatchCursor;
    document.querySelector("#batchPage").textContent = t("pageNumber", { page: this.batchPage + 1 });
    this.renderFilters();
  }

  renderFilters() {
    const batchSelect = document.querySelector("#batchFilter");
    const batches = this.batches.map((batch) => batch.id);
    if (this.batchFilter && !batches.includes(this.batchFilter)) batches.unshift(this.batchFilter);
    fillSelect(batchSelect, ["", ...batches], this.batchFilter, (id) => id ? `${t("batch")} ${id.slice(0, 8)}` : t("allBatches"));
    fillSelect(document.querySelector("#stateFilter"), ["", "queued", "submitting", "running", "downloading", "succeeded", "failed", "needs_review", "cancelled", "result_expired"], this.stateFilter, (state) => state ? t(queueStateKeys[state]) : t("allStates"));
  }

  renderJobs() {
    const body = document.querySelector("#jobsBody");
    for (const [id, card] of this.jobRows) if (!this.jobs.has(id)) { card.element.remove(); this.jobRows.delete(id); }
    body.querySelector(".empty-row")?.remove();
    if (!this.jobs.size) { const row = viewElement("tr", "empty-row"), cell = viewElement("td", "empty-state", t("noJobs")); cell.colSpan = 5; row.append(cell); body.append(row); }
    let index = 0;
    for (const job of this.jobs.values()) {
      let card = this.jobRows.get(job.id);
      if (!card) {
        const element = viewElement("tr"); element.dataset.jobId = job.id;
        const identity = viewElement("td"), prompt = viewElement("strong", "job-prompt"), model = viewElement("small", "field-meta");
        const details = viewElement("details", "job-details"), detailsTitle = viewElement("summary"), local = viewElement("p"), remote = viewElement("p"), fullPrompt = viewElement("p");
        details.append(detailsTitle, local, remote, fullPrompt); identity.append(prompt, model, details);
        const state = viewElement("td"), stateLabel = viewElement("span"), progress = document.createElement("progress"), percent = viewElement("small", "field-meta"), cancelPending = viewElement("small", "field-meta");
        progress.max = 100; state.append(stateLabel, progress, percent, cancelPending);
        const cost = viewElement("td", "job-cost"), result = viewElement("td", "job-result"), output = viewElement("span", "output-path"), error = viewElement("span", "job-error"), expiry = viewElement("strong", "expiry-warning");
        const copy = viewButton("", () => this.run(async () => {
          const path = this.jobs.get(job.id)?.output?.path;
          if (!path) return;
          try { await navigator.clipboard.writeText(path); } catch { throw new Error(t("copyPathFailed")); }
          this.message(t("pathCopied"));
        }, copy), "text-button"); result.append(output, copy, error, expiry);
        const actions = viewElement("td", "job-actions");
        const review = viewButton("", () => this.openReview(this.jobs.get(job.id)), "secondary review-action");
        const regenerate = viewButton("", () => this.run(() => this.regenerateJob(this.jobs.get(job.id)), regenerate));
        const retry = viewButton("", () => this.run(() => this.retryJob(this.jobs.get(job.id)), retry));
        const cancel = viewButton("", () => this.run(async () => {
          if (!await confirmAction(t("cancelJobConfirm"), { danger: true })) return;
          await apiRequest(`/api/jobs/${job.id}/cancel`, {}); await this.refresh();
        }, cancel));
        actions.append(review, regenerate, retry, cancel); element.append(identity, state, cost, result, actions);
        card = { element, prompt, model, detailsTitle, local, remote, fullPrompt, stateLabel, progress, percent, cancelPending, cost, output, copy, error, expiry, review, regenerate, retry, cancel };
        this.jobRows.set(job.id, card);
      }
      if (body.children[index] !== card.element) body.insertBefore(card.element, body.children[index] || null);
      index += 1;
      card.prompt.textContent = job.prompt || t("emptyPrompt"); card.model.textContent = `${job.model} · #${(job.index || 0) + 1}`;
      card.detailsTitle.textContent = t("jobDetails"); card.local.textContent = `${t("localId")}: ${job.id}`; card.remote.textContent = `${t("remoteId")}: ${job.remote?.id || "—"}`; card.fullPrompt.textContent = job.prompt || "";
      card.stateLabel.className = `state-label state-${job.state}`; card.stateLabel.textContent = t(queueStateKeys[job.state] || "unknown");
      card.progress.value = job.state === "succeeded" ? 100 : Math.max(0, Math.min(100, Number(job.progress) || 0)); card.progress.setAttribute("aria-label", t("jobProgress")); card.percent.textContent = `${Math.round(card.progress.value)}%`;
      card.cancelPending.hidden = !job.cancelRequested || !canCancelJob({ ...job, cancelRequested: false }); card.cancelPending.textContent = t("cancelPending");
      card.cost.textContent = formatCost(job.costEstimate); card.output.textContent = job.output?.path || ""; card.output.hidden = card.copy.hidden = !job.output?.path; card.copy.textContent = t("copyPath");
      const errorKey = queueErrorKeys[job.error?.code || job.error?.category];
      card.error.hidden = !job.error;
      card.error.textContent = job.error ? [errorKey ? t(errorKey) : job.error.message || t("unknown"), job.error.providerCode, job.error.providerMessage || (errorKey && !job.error.code ? job.error.message : "")].filter(Boolean).join(" · ") : "";
      const expires = Date.parse(job.resultExpiresAt);
      card.expiry.hidden = !Number.isFinite(expires) || expires - Date.now() >= 3600000 || ["succeeded", "cancelled", "failed"].includes(job.state);
      card.expiry.textContent = card.expiry.hidden ? "" : t(expires < Date.now() ? "resultExpiredWarning" : "resultExpiring", { at: new Date(expires).toLocaleString(currentLocale()) });
      card.review.hidden = job.state !== "needs_review"; card.review.textContent = t("reviewAction");
      card.regenerate.hidden = !["succeeded", "failed", "cancelled", "result_expired"].includes(job.state); card.regenerate.textContent = t("regenerateOne");
      card.retry.hidden = !canRetryJob(job); card.retry.textContent = t("retry");
      card.cancel.hidden = !canCancelJob(job); card.cancel.textContent = t(job.state === "queued" ? "cancel" : "requestCancel");
    }
    document.querySelector("#jobsPrevious").disabled = this.jobPage === 0;
    document.querySelector("#jobsNext").disabled = !this.nextJobCursor;
    document.querySelector("#jobsPage").textContent = t("pageNumber", { page: this.jobPage + 1 });
    document.querySelector("#jobsCount").textContent = t("visibleJobs", { count: this.jobs.size });
    this.renderGallery();
  }

  async loadGallerySummary() {
    const revision = ++this.galleryRevision;
    const query = this.batchFilter ? `?${new URLSearchParams({ batchId: this.batchFilter })}` : "";
    const result = await apiRequest(`/api/gallery/summary${query}`);
    if (revision !== this.galleryRevision) return;
    this.gallerySummary = result; this.renderGallerySummary();
  }

  renderGallerySummary() {
    const summary = this.gallerySummary;
    const element = document.querySelector("#gallerySummary");
    if (!summary) { element.textContent = t("gallerySummaryPending"); return; }
    const costs = (summary.costs || []).map((cost) => {
      const perKept = typeof cost.costPerKept === "number" ? { amount: cost.costPerKept, currency: cost.currency } : cost.costPerKept;
      return t("galleryCost", { total: formatCost(cost), perKept: formatCost(perKept) }) + (cost.unknownCount ? ` · ${t("unknownCosts", { count: cost.unknownCount })}` : "");
    });
    element.textContent = [t("galleryCounts", { kept: summary.kept, rejected: summary.rejected, unreviewed: summary.unreviewed }), ...costs].join(" · ");
  }

  renderGallery() {
    const container = document.querySelector("#galleryGrid");
    const jobs = [...this.jobs.values()].filter((job) => job.state === "succeeded" && job.output?.path && (this.gallerySelection === "all" || (job.selection || "unreviewed") === this.gallerySelection));
    const visible = new Set(jobs.map((job) => job.id));
    for (const [id, card] of this.galleryCards) if (!visible.has(id)) { card.video.pause(); card.video.removeAttribute("src"); card.element.remove(); this.galleryCards.delete(id); }
    container.querySelector(".empty-state")?.remove();
    if (!jobs.length) container.append(viewElement("p", "empty-state", t("galleryEmpty")));
    for (const job of jobs) {
      let card = this.galleryCards.get(job.id);
      if (!card) {
        const element = viewElement("article", "gallery-card"); element.dataset.jobId = job.id;
        const video = document.createElement("video"); video.controls = true; video.preload = "none"; video.playsInline = true; video.src = `/api/jobs/${encodeURIComponent(job.id)}/media`;
        const prompt = viewElement("p", "gallery-prompt"); const meta = viewElement("p", "field-meta");
        const actions = viewElement("div", "inline-actions");
        const selections = {};
        for (const selection of ["keep", "reject", "unreviewed"]) {
          const button = viewButton("", () => this.run(async () => { await apiRequest(`/api/jobs/${job.id}/curate`, { selection }); await this.refresh(); }, button));
          selections[selection] = button; actions.append(button);
        }
        const regenerate = viewButton("", () => this.run(() => this.regenerateJob(this.jobs.get(job.id)), regenerate));
        element.append(video, prompt, meta, actions, regenerate); container.append(element);
        card = { element, video, prompt, meta, selections, regenerate }; this.galleryCards.set(job.id, card);
      }
      card.video.setAttribute("aria-label", t("previewVideo", { prompt: job.prompt }));
      card.prompt.textContent = job.prompt;
      card.meta.textContent = `${job.model} · ${formatCost(job.costEstimate)}`;
      card.element.dataset.selection = job.selection || "unreviewed";
      for (const [selection, button] of Object.entries(card.selections)) {
        button.textContent = t({ keep: "selectionKeep", reject: "selectionReject", unreviewed: "selectionUnreviewed" }[selection]);
        button.setAttribute("aria-pressed", String((job.selection || "unreviewed") === selection));
      }
      card.regenerate.textContent = t("regenerateOne");
    }
    this.renderGallerySummary();
  }

  async regenerateJob(job) {
    if (!job) return;
    const estimate = await apiRequest(`/api/jobs/${job.id}/regenerate/estimate`);
    if (!await confirmAction(t("confirmRegenerate", { prompt: job.prompt, cost: formatCost(estimate.cost) }), { danger: true })) return;
    await apiRequest(`/api/jobs/${job.id}/regenerate`, { confirmed: true, confirmationToken: estimate.confirmationToken });
    await this.refresh(); this.message(t("regenerationQueued"));
  }

  async retryJob(job) {
    if (!job || !canRetryJob(job)) return;
    const estimate = await apiRequest(`/api/jobs/${job.id}/regenerate/estimate`);
    if (!await confirmAction(t("confirmRetry", { prompt: job.prompt, cost: formatCost(estimate.cost) }), { danger: true })) return;
    await apiRequest(`/api/jobs/${job.id}/retry`, { confirmed: true });
    await this.refresh();
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
    if (buttons.some((button) => button.disabled)) return;
    const payload = { action };
    if (action === "attach_remote_id") {
      payload.remoteId = document.querySelector("#reviewRemoteId").value.trim();
      if (!payload.remoteId) { document.querySelector("#reviewMessage").textContent = t("missingRemoteId"); return; }
    }
    if (action === "resubmit" && !await confirmAction(t("resubmitConfirm"), { danger: true })) return;
    if (action === "abandon" && !await confirmAction(t("abandonConfirm"), { danger: true })) return;
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await apiRequest(`/api/jobs/${this.reviewId}/resolve`, payload);
      document.querySelector("#reviewDialog").close();
      await this.refresh();
      if (!document.activeElement?.isConnected || document.activeElement.hidden) document.querySelector("#refreshQueueButton").focus();
    } catch (error) { document.querySelector("#reviewMessage").textContent = error.message; }
    finally { buttons.forEach((button) => { button.disabled = false; }); }
  }
}
