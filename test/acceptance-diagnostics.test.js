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

test("acceptance diagnostics remove POSIX, Windows and JSON-escaped paths from failures and logs", () => {
  const posix = "/Users/private-person/private-work";
  const windows = "C:\\Users\\private-person\\private-work";
  const secret = "mock-private-credential";
  const result = failureDiagnostics({
    phase: "final paid-job invariants",
    jobs: [{ id: "failed", state: "failed", error: { providerMessage: `${secret} at ${windows}\\output.mp4` } }],
    inspectionErrors: { jobs: `read ${posix}/jobs.ndjson` },
    logs: [JSON.stringify({ message: `request ${secret} at ${windows}\\data` }), `${windows.replaceAll("\\", "/")}/data`],
    paths: [posix, windows], secrets: [secret],
  });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("private-person"), false);
  assert.equal(serialized.includes("private-work"), false);
  assert.equal(result.failures[0].error.providerMessage, "[REDACTED] at [PATH]\\output.mp4");
  assert.equal(result.inspectionErrors.jobs, "read [PATH]/jobs.ndjson");
});
