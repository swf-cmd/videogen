const { st } = require("../i18n/server-messages");

const STATES = Object.freeze(["queued", "submitting", "running", "downloading", "succeeded", "failed", "cancelled", "needs_review", "result_expired"]);
const TERMINAL_STATES = new Set(["succeeded", "failed", "cancelled", "result_expired"]);
const TRANSITIONS = Object.freeze(Object.fromEntries(Object.entries({
  queued: ["submitting", "failed", "cancelled"],
  submitting: ["running", "queued", "failed", "needs_review"],
  running: ["downloading", "failed", "cancelled", "result_expired"],
  downloading: ["succeeded", "failed", "cancelled", "result_expired"],
  succeeded: [],
  failed: ["queued"],
  cancelled: [],
  needs_review: ["queued", "running", "cancelled"],
  result_expired: [],
}).map(([state, next]) => [state, Object.freeze(next)])));

function stateError(code) {
  return Object.assign(new Error(code), { code });
}

function validateJob(job) {
  if (!job || typeof job.id !== "string" || !job.id || !STATES.includes(job.state)) throw stateError("invalidStore");
  for (const phase of ["create", "poll", "download"]) {
    if (!Number.isSafeInteger(job.attempts?.[phase]) || job.attempts[phase] < 0) throw stateError("invalidAttempts");
  }
  if (job.remote?.id !== undefined && (typeof job.remote.id !== "string" || !job.remote.id || /[\s\x00-\x1f\x7f]/.test(job.remote.id))) {
    throw stateError("invalidRemoteId");
  }
  if (["running", "downloading", "succeeded"].includes(job.state) && !job.remote?.id) throw stateError("invalidRemoteId");
  return job;
}

function assertTransition(previous, next, { manualResubmit = false, idempotentRetry = false } = {}) {
  validateJob(next);
  if (!previous) {
    if (!["queued", "running"].includes(next.state)) throw stateError("invalidTransition");
    return;
  }
  if (previous.id !== next.id) throw stateError("invalidStore");
  if (previous.state !== next.state && !TRANSITIONS[previous.state]?.includes(next.state)) throw stateError("invalidTransition");
  if (previous.remote?.id && previous.remote.id !== next.remote?.id) throw stateError("invalidRemoteId");
  for (const phase of ["create", "poll", "download"]) {
    if (next.attempts[phase] < previous.attempts[phase]) throw stateError("invalidAttempts");
  }
  const createDelta = next.attempts.create - previous.attempts.create;
  const enteringCreate = next.state === "submitting" && (previous.state !== "submitting" || createDelta > 0);
  if (enteringCreate) {
    if (next.remote?.id || createDelta !== 1) throw stateError("invalidAttempts");
    const authorization = previous.createAuthorization;
    const explicitlyAuthorized = authorization?.afterAttempt === previous.attempts.create && ["manual", "idempotent"].includes(authorization.kind);
    if (previous.attempts.create > 0 && !previous.error?.definitelyNotAccepted && !manualResubmit && !idempotentRetry && !explicitlyAuthorized) {
      throw stateError("unsafeCreateRetry");
    }
  } else if (createDelta !== 0) throw stateError("invalidAttempts");
  if (previous.state === "submitting" && next.state === "queued" && !next.error?.definitelyNotAccepted && !idempotentRetry) {
    throw stateError("unsafeCreateRetry");
  }
  if (previous.state === "failed" && next.state === "queued" && (!previous.error?.definitelyNotAccepted || previous.remote?.id)) {
    throw stateError("unsafeCreateRetry");
  }
  if (previous.state === "needs_review" && next.state === "queued" && !manualResubmit && !idempotentRetry) {
    throw stateError("unsafeCreateRetry");
  }
}

function recoveryPatch(job, { supportsIdempotencyKey = false } = {}) {
  if (job.state !== "submitting") return null;
  if (job.remote?.id) return { state: "running" };
  if (supportsIdempotencyKey) {
    return {
      state: "queued",
      error: null,
      createAuthorization: { kind: "idempotent", afterAttempt: job.attempts.create, idempotencyKey: job.id },
    };
  }
  return {
    state: "needs_review",
    error: { category: "unknown_outcome", code: "unknown_outcome", message: st(job.language || "zh", "unknown_outcome"), reason: "interrupted_create", definitelyNotAccepted: false },
  };
}

module.exports = { STATES, TERMINAL_STATES, TRANSITIONS, validateJob, assertTransition, recoveryPatch };
