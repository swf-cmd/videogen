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

const queueStateKeys = { queued: "statusQueued", submitting: "statusSubmitting", running: "statusInProgress", downloading: "statusDownloading", succeeded: "statusCompleted", failed: "statusFailed", cancelled: "statusCancelled", needs_review: "needsReviewShort", result_expired: "statusExpired", active: "laneActive", paused: "lanePaused", cooldown: "laneCooldown", needs_key: "laneNeedsKey" };
const queueReasonKeys = { manual_pause: "reasonManual", rate_limited: "reasonRateLimit", auth: "reasonAuth", quota: "reasonQuota", model_unavailable: "reasonModel", circuit_open: "reasonCircuit", budget: "reasonBudget", budget_unknown: "reasonUnknownBudget", storeWriteFailed: "reasonStore", storeClosed: "reasonStore" };
const queueErrorKeys = { moderation: "errorModeration", invalid_request: "errorInvalidRequest", unknown_outcome: "reviewExplanation", transient: "errorTransient", auth: "reasonAuth", quota: "reasonQuota", rate_limited: "reasonRateLimit", result_expired: "errorExpired", model_unavailable: "reasonModel" };

class QueueView {
  constructor() {
    this.jobs = new Map();
    this.batches = [];
    this.lanes = [];
    this.keys = [];
    this.laneCards = new Map();
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
    if (button) button.disabled = true;
    try { return await action(); }
    catch (error) { this.message(error.message, true); }
    finally { if (button) button.disabled = false; }
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
    events.addEventListener("ready", active(() => { setConnectionState("ready"); this.scheduleRefresh(true); }));
    events.addEventListener("resync", active(() => this.scheduleRefresh(true)));
    events.addEventListener("change", active((event) => this.applyEvent(JSON.parse(event.data))));
    events.onopen = active(() => { setConnectionState("ready"); this.scheduleRefresh(true); });
    events.onerror = active(() => setConnectionState("connectionReconnecting"));
    this.statusTimer = setInterval(() => { this.run(() => this.loadLanes()); this.updateCooldowns(); }, 2000);
    this.countdownTimer = setInterval(() => this.updateCooldowns(), 1000);
    // Install cleanup and timers before a snapshot can fail.
    await this.refresh();
  }

  suspendLiveUpdates() {
    const events = this.events;
    this.events = null;
    events?.close();
    clearInterval(this.statusTimer); clearInterval(this.countdownTimer); clearTimeout(this.refreshTimer);
    this.statusTimer = this.countdownTimer = this.refreshTimer = null;
    this.refreshJobs = false;
    // Discard snapshots started before the page was suspended.
    this.jobRevision += 1; this.batchRevision += 1; this.laneRevision += 1;
  }

  scheduleRefresh(includeJobs = false) {
    this.refreshJobs = this.refreshJobs || includeJobs;
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      const all = this.refreshJobs;
      this.refreshJobs = false;
      this.run(() => all ? this.refresh() : Promise.all([this.loadBatches(), this.loadLanes()]));
    }, 180);
  }

  applyEvent(event) {
    const current = this.jobs.get(event.jobId);
    if (event.type === "job" && current) {
      if ((current._seq || 0) < event.seq) this.jobs.set(event.jobId, { ...current, ...event, id: event.jobId, _seq: event.seq });
      this.renderJobs();
    } else if (event.type === "delete") { this.jobs.delete(event.jobId); this.renderJobs(); }
    this.scheduleRefresh(event.type === "delete" || event.type === "job" && (!current || Boolean(this.stateFilter)));
  }

  async refresh() {
    if (isFilePreview) return;
    await Promise.all([this.loadJobs(), this.loadBatches(), this.loadLanes()]);
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

  resetJobs() { this.jobPage = 0; this.jobCursors = [null]; this.run(() => this.loadJobs()); }
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
      card.save.textContent = t("saveKey"); card.remove.textContent = t("deleteKey"); card.remove.disabled = !this.keyPresent(lane);
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
    container.textContent = "";
    if (!this.batches.length) container.append(viewElement("p", "empty-state", t("noBatches")));
    for (const batch of this.batches) {
      const card = viewElement("article", "batch-card");
      const title = viewButton(`${t("batch")} ${batch.id.slice(0, 8)}`, () => this.showBatch(batch.id), "text-button");
      title.title = batch.id;
      const lane = this.lanes.find((item) => item.id === batch.laneId);
      const createdAt = Date.parse(batch.createdAt);
      const meta = viewElement("small", "field-meta", [lane ? laneName(lane) : "", Number.isFinite(createdAt) ? new Date(createdAt).toLocaleString(currentLocale()) : ""].filter(Boolean).join(" · "));
      const counts = Object.entries(batch.counts || {}).filter(([, count]) => count).map(([state, count]) => `${t(queueStateKeys[state] || "unknown")} ${formatInteger(count)}`).join(" · ");
      const summary = viewElement("p", "field-meta", `${t("batchTotal", { count: batch.total })} · ${counts}`);
      const finished = batch.total > 0 && Object.entries(batch.counts || {}).every(([state, count]) => !count || ["succeeded", "failed", "cancelled", "result_expired"].includes(state));
      const status = viewElement("p", "field-meta", `${t(finished ? "batchFinished" : queueStateKeys[batch.state] || "unknown")}${!finished && batch.pauseReason ? ` · ${t(queueReasonKeys[batch.pauseReason] || "lanePaused")}` : ""}`);
      const controls = viewElement("div", "inline-actions");
      for (const action of [batch.state === "paused" ? "resume" : "pause", "cancel"]) {
        if (batch.state === "cancelled" || finished) continue;
        const button = viewButton(t(action === "cancel" ? "cancelBatch" : action), () => this.run(async () => {
          if (action === "cancel" && !await confirmAction(t("cancelBatchConfirm"), { danger: true })) return;
          await apiRequest(`/api/batches/${batch.id}/${action}`, {}); await this.refresh();
        }, button));
        controls.append(button);
      }
      card.append(title, meta, summary, status);
      if (batch.budget) card.append(viewElement("p", "field-meta", `${t("budgetLabel")}: ${formatCost(batch.budget)}`));
      card.append(controls); container.append(card);
    }
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
    const expanded = new Set([...body.querySelectorAll("tr")].filter((row) => row.querySelector("details")?.open).map((row) => row.dataset.jobId));
    body.textContent = "";
    if (!this.jobs.size) { const row = viewElement("tr"); const cell = viewElement("td", "empty-state", t("noJobs")); cell.colSpan = 5; row.append(cell); body.append(row); }
    for (const job of this.jobs.values()) {
      const row = viewElement("tr"); row.dataset.jobId = job.id;
      const identity = viewElement("td");
      identity.append(viewElement("strong", "job-prompt", job.prompt || t("emptyPrompt")), viewElement("small", "field-meta", `${job.model} · #${(job.index || 0) + 1}`));
      const details = viewElement("details", "job-details");
      details.open = expanded.has(job.id);
      details.append(viewElement("summary", "", t("jobDetails")), viewElement("p", "", `${t("localId")}: ${job.id}`), viewElement("p", "", `${t("remoteId")}: ${job.remote?.id || "—"}`), viewElement("p", "", job.prompt || ""));
      identity.append(details);
      const state = viewElement("td");
      state.append(viewElement("span", `state-label state-${job.state}`, t(queueStateKeys[job.state] || "unknown")));
      const progress = document.createElement("progress"); progress.max = 100; progress.value = job.state === "succeeded" ? 100 : Math.max(0, Math.min(100, Number(job.progress) || 0)); progress.setAttribute("aria-label", t("jobProgress"));
      state.append(progress, viewElement("small", "field-meta", `${Math.round(progress.value)}%`));
      if (job.cancelRequested && canCancelJob({ ...job, cancelRequested: false })) state.append(viewElement("small", "field-meta", t("cancelPending")));
      const cost = viewElement("td", "job-cost", formatCost(job.costEstimate));
      const result = viewElement("td", "job-result");
      if (job.output?.path) {
        result.append(viewElement("span", "output-path", job.output.path));
        const copy = viewButton(t("copyPath"), () => this.run(async () => {
          try { await navigator.clipboard.writeText(job.output.path); } catch { throw new Error(t("copyPathFailed")); }
          this.message(t("pathCopied"));
        }, copy), "text-button"); result.append(copy);
      }
      if (job.error) result.append(viewElement("span", "job-error", queueErrorKeys[job.error.category] ? t(queueErrorKeys[job.error.category]) : job.error.message || t("unknown")));
      const expires = Date.parse(job.resultExpiresAt);
      if (Number.isFinite(expires) && expires - Date.now() < 3600000 && !["succeeded", "cancelled", "failed"].includes(job.state)) result.append(viewElement("strong", "expiry-warning", t(expires < Date.now() ? "resultExpiredWarning" : "resultExpiring", { at: new Date(expires).toLocaleString(currentLocale()) })));
      const actions = viewElement("td", "job-actions");
      if (job.state === "needs_review") actions.append(viewButton(t("reviewAction"), () => this.openReview(job), "secondary review-action"));
      for (const action of [canRetryJob(job) && "retry", canCancelJob(job) && "cancel"].filter(Boolean)) {
        const button = viewButton(t(action), () => this.run(async () => {
          if (action === "cancel" && !await confirmAction(t("cancelJobConfirm"), { danger: true })) return;
          await apiRequest(`/api/jobs/${job.id}/${action}`, {}); await this.refresh();
        }, button)); actions.append(button);
      }
      row.append(identity, state, cost, result, actions); body.append(row);
    }
    document.querySelector("#jobsPrevious").disabled = this.jobPage === 0;
    document.querySelector("#jobsNext").disabled = !this.nextJobCursor;
    document.querySelector("#jobsPage").textContent = t("pageNumber", { page: this.jobPage + 1 });
    document.querySelector("#jobsCount").textContent = t("visibleJobs", { count: this.jobs.size });
  }

  openReview(job) {
    this.reviewId = job.id;
    document.querySelector("#reviewJob").textContent = `${laneName(job)} · ${job.model}\n${job.prompt}\n${job.id}`;
    document.querySelector("#reviewRemoteId").value = "";
    document.querySelector("#reviewMessage").textContent = "";
    const model = job.modelConfig || providers.find((provider) => provider.provider === job.provider)?.models.find((candidate) => candidate.id === job.model);
    const note = document.querySelector("#manualRecoveryNote");
    note.hidden = !model?.manualRecoveryNoteKey;
    note.textContent = model?.manualRecoveryNoteKey ? t(model.manualRecoveryNoteKey) : "";
    document.querySelector("#reviewDialog").showModal();
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
    } catch (error) { document.querySelector("#reviewMessage").textContent = error.message; }
    finally { buttons.forEach((button) => { button.disabled = false; }); }
  }
}
