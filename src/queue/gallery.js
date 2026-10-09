const crypto = require('node:crypto');
const path = require('node:path');
const { TERMINAL_STATES } = require('./state');
const { selectRow, failure } = require('./batches');
const { resolveBatchOutputPath } = require('../files/output');

class Gallery {
  constructor(app) { this.app = app; this.confirmations = new Map(); }
  job(id) {
    const job = this.app.store.get(id);
    if (!job) throw Object.assign(failure('jobNotFound'), { status: 404 });
    return job;
  }
  curate(id, { selection } = {}) {
    const job = this.job(id);
    if (job.state !== 'succeeded' || !job.output?.path || !['keep', 'reject', 'unreviewed'].includes(selection)) throw failure('invalidSelection');
    return this.app.store.update(id, { selection, reviewedAt: new Date().toISOString() }, { sync: true });
  }
  summary({ batchId, batch } = {}) {
    const totals = { total: 0, kept: 0, rejected: 0, unreviewed: 0, costs: [] };
    const currencies = new Map();
    for (const job of this.app.store.jobs.values()) {
      if ((batchId || batch) && job.batchId !== (batchId || batch)) continue;
      totals.total += 1;
      const currency = job.costEstimate?.currency || null;
      if (!currencies.has(currency)) currencies.set(currency, { currency, amount: 0, unknownCount: 0, kept: 0 });
      const entry = currencies.get(currency);
      const charges = job.estimatedCharges ?? (job.remote?.id || ['submitting', 'needs_review'].includes(job.state) ? 1 : 0);
      if (charges > 0) {
        if (Number.isFinite(job.costEstimate?.amount)) entry.amount += job.costEstimate.amount * charges;
        else entry.unknownCount += charges;
      }
      if (job.state === 'succeeded' && job.output?.path) {
        if (job.selection === 'keep') { totals.kept += 1; entry.kept += 1; }
        else if (job.selection === 'reject') totals.rejected += 1;
        else totals.unreviewed += 1;
      }
    }
    totals.costs = [...currencies.values()].map(entry => ({ ...entry,
      amount: entry.unknownCount ? null : Math.round(entry.amount * 1e6) / 1e6,
      costPerKept: entry.unknownCount || !entry.kept ? null : Math.round(entry.amount / entry.kept * 1e6) / 1e6,
    }));
    return totals;
  }
  selection(job) {
    if (!TERMINAL_STATES.has(job.state)) throw failure('invalidTransition');
    const row = { provider: job.provider, region: job.region, baseUrl: job.baseUrl, model: job.model, params: job.params,
      prompt: job.prompt, ...(job.provider === 'openai-compatible' ? { customCapabilities: job.modelConfig.capabilities } : {}) };
    if (job.assets?.some(asset => asset.role === 'first_frame')) row.firstFrame = 'stored_first';
    if (job.assets?.some(asset => asset.role === 'last_frame')) row.lastFrame = 'stored_last';
    return selectRow(this.app, {}, row);
  }
  fingerprint(selected) { return JSON.stringify({ model: selected.model, params: selected.params, cost: selected.cost }); }
  estimate(id) {
    const selected = this.selection(this.job(id));
    const now = Date.now();
    for (const [token, entry] of this.confirmations) if (entry.expires < now) this.confirmations.delete(token);
    if (this.confirmations.size >= 1000) this.confirmations.delete(this.confirmations.keys().next().value);
    const confirmationToken = crypto.randomUUID();
    this.confirmations.set(confirmationToken, { id, fingerprint: this.fingerprint(selected), expires: now + 15 * 60000 });
    return { cost: selected.cost, confirmationToken };
  }
  regenerate(id, { confirmed, confirmationToken } = {}) {
    if (this.app.stopping) throw failure('serviceStopping');
    this.app.scheduler.assertHealthy();
    if (confirmed !== true || typeof confirmationToken !== 'string') throw failure('regenerateConfirmationRequired');
    // A successful response can be lost. Replaying its token returns the same take.
    for (const job of this.app.store.jobs.values()) {
      if (job.regenerationToken === confirmationToken && job.parentJobId === id) return job;
    }
    const confirmation = this.confirmations.get(confirmationToken);
    if (!confirmation || confirmation.id !== id || confirmation.expires < Date.now()) throw failure('confirmationExpired');
    const source = this.job(id);
    const selected = this.selection(source);
    if (confirmation.fingerprint !== this.fingerprint(selected)) throw failure('confirmationExpired');
    for (const asset of source.assets || []) this.app.assets.read(asset);
    // A take that the batch budget cannot dispatch would be accepted and then
    // wait forever; refuse it up front instead.
    const batch = this.app.store.batches.get(source.batchId);
    if (batch?.state === 'paused' && ['budget', 'budget_unknown'].includes(batch.pauseReason) || !this.app.scheduler.budgetCheck(source.batchId, selected.cost).ok) {
      throw Object.assign(failure('regenerateExceedsBudget'), { status: 409 });
    }
    const newId = crypto.randomUUID();
    const filename = `${path.basename(source.targetPath, path.extname(source.targetPath))}-take-${newId.slice(0, 8)}`;
    const job = {
      id: newId, batchId: source.batchId, index: this.app.batch(source.batchId).total,
      ...(Number.isInteger(source.shot) ? { shot: source.shot } : Number.isInteger(source.index) ? { shot: source.index } : {}),
      parentJobId: id, regenerationToken: confirmationToken, rootJobId: source.rootJobId || id,
      provider: source.provider, region: source.region, baseUrl: source.baseUrl, laneId: source.laneId,
      model: selected.model.id, modelConfig: selected.model, params: selected.params, prompt: source.prompt, assets: source.assets || [],
      state: 'queued', progress: 0, selection: 'unreviewed', remote: null,
      attempts: { create: 0, poll: 0, download: 0 }, costEstimate: selected.cost,
      targetPath: resolveBatchOutputPath(path.dirname(source.targetPath), filename, 0, 1, newId).filePath,
      createdAt: new Date().toISOString(), language: source.language, requiresKey: source.requiresKey,
    };
    this.app.store.add(job);
    this.confirmations.delete(confirmationToken);
    this.app.store.updateBatch(batch.id, { total: this.app.batch(batch.id).total, ...(batch.state === 'cancelled' ? { state: 'active' } : {}) });
    this.app.scheduler.kick();
    return job;
  }
}
module.exports = { Gallery };
