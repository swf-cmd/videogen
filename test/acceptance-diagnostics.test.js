const test = require("node:test");
const assert = require("node:assert/strict");
const { failureDiagnostics } = require("../acceptance/failure-diagnostics.cjs");

test("acceptance failures explain review-slot exhaustion and redact secrets before clipping logs", () => {
  const secret = "diagnostic-private-secret-123456789";
  const result = failureDiagnostics({
    jobs: [{ id: "review", prompt: "e2e-job-0000", state: "needs_review", error: { providerMessage: `failure ${secret}` } }, { id: "waiting", prompt: "e2e-job-0001", state: "queued" }, { id: "saved", state: "succeeded" }],
    lanes: { lanes: [{ inFlight: 3, needsReview: 3, concurrency: 3 }] },
    mock: { jobs: [{ id: "paid", prompt: "e2e-job-0000", responseSentAt: 42 }] },
    killedSubmissions: ["e2e-job-0000"],
    logs: [`prefix ${secret}${"x".repeat(15990)}`], secrets: [secret],
  });
  assert.deepEqual(result.states, { needs_review: 1, queued: 1, succeeded: 1 });
  assert.equal(result.pending.length, 2);
  assert.equal(result.pending[0].interruptedByKill, true);
  assert.equal(result.pending[0].observedRemote.responseSentAt, 42);
  assert.equal(result.pending[0].error.providerMessage, "failure [REDACTED]");
  assert.equal(result.processLogs[0].includes("123456789"), false);
  assert.ok(result.processLogs[0].length <= 16000);
});
