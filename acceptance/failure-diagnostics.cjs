const { redact } = require("../src/queue/keys");

function failureDiagnostics({ seed, phase, jobs = [], lanes, health, mock, kills = [], killedSubmissions = [], logs = [], inspectionErrors = {}, secrets = [] }) {
  const clean = (value) => {
    if (typeof value === "string") {
      for (const secret of secrets) if (secret) value = value.split(secret).join("[REDACTED]");
      return redact(value);
    }
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, clean(item)]));
    return value;
  };
  const counts = {};
  for (const job of jobs) counts[job.state] = (counts[job.state] || 0) + 1;
  const remoteByPrompt = new Map((mock?.jobs || []).map(job => [job.prompt, job]));
  const pending = jobs.filter(job => !["succeeded", "failed", "cancelled", "result_expired"].includes(job.state)).map(job => ({
    id: job.id, prompt: job.prompt, laneId: job.laneId, state: job.state,
    attempts: job.attempts, error: job.error, remote: job.remote,
    createdAt: job.createdAt, submittingAt: job.submittingAt, startedAt: job.startedAt, updatedAt: job.updatedAt,
    interruptedByKill: killedSubmissions.includes(job.prompt),
    observedRemote: remoteByPrompt.get(job.prompt),
  }));
  return clean({ seed, phase, states: counts, lanes, health, kills, killedSubmissions, pending,
    mock: mock && { accepted: mock.accepted?.length, createPending: mock.createPending, pollsActive: mock.pollsActive,
      downloadsActive: mock.downloadsActive, requestCounts: mock.requestCounts, createCounts: mock.createCounts, faults: mock.faults },
    inspectionErrors,
    // Redact before truncation so a boundary cannot expose part of a credential.
    processLogs: logs.map(value => clean(String(value)).slice(-16000)),
  });
}
module.exports = { failureDiagnostics };
