# Architecture

## Current and target system

The v1.0.2 server combines HTTP, OpenAI Videos/Batch, image validation,
filesystem operations and rendering orchestration. Jobs exist only inside request
handlers. The target is a local, zero-dependency, multi-provider render queue.
The browser observes work owned by the service process.

```text
classic-script browser → HTTP router → catalog / keys / batches / jobs / SSE
                                      ↓
                          durable job store ← scheduler → provider adapters
                                      ↓          ↓
                                asset store   atomic output writer
```

Adapters translate requests and responses; they never access disk or mutate job
state. Scheduling is provider-independent. CommonJS and built-in Node APIs are
used throughout. The service listens only on 127.0.0.1 and validates Host and
Origin without CORS. Tests are offline and portable.

## States and invariants

`queued → submitting → running → downloading → succeeded`

Other states: `failed`, `cancelled`, `needs_review`, `result_expired`.
Lane states: `active`, `cooldown`, `needs_key`, `paused`.

- I1: persist submitting and increment create attempts, then fsync before create.
- I2: persist and fsync a returned remote ID before any other await.
- I3: interrupted submitting without an ID becomes needs_review unless the
  adapter documents idempotency-key support.
- I4: distinguish definitely rejected requests from ambiguous outcomes. Timeouts,
  resets, 5xx and malformed successful responses never trigger an unsafe create.
- I5: polling and downloading may retry; neither path can call create.
- I6: only definitely rejected failures may retry. Unknown outcomes require an
  explicit resubmit (duplicate-charge warning), abandon, or remote-ID attachment.
- I7: never automatically repeat an accepted or possibly accepted create.

## Durability and security

Use a versioned, monotonic NDJSON event log and atomic snapshot. Submitting and
remote-ID events are durability barriers. A process lock protects all ports
sharing a data directory. Assets are content-addressed; keys remain only in
memory, scoped to provider + region + base URL. Persist only explicit task fields.
Never forward credentials to result CDNs or across redirects. Stream original
bytes into private partial files and publish without overwriting existing files.
SSE is incremental with bounded replay; list endpoints are paginated.

## Delivery

M0 establishes regression tests. M1 moves unchanged helpers. M2 adds adapters,
catalog and a durable transitional sequential executor. M3 ships v1.1.0.
M4 adds recovery, assets and compaction; M5 adds scheduling and crash acceptance;
M6 replaces the UI; M7 adds documented provider contracts; M8 validates Node,
proxy behavior and v2.0.0. Stage 2 is outside this implementation.

## Decisions

- Treat research claims as leads. Official documents read during implementation
  are recorded per provider; unknown fields/prices remain explicitly unverified.
- I7 refers to accepted or ambiguous creates. I4 explicitly permits retry after
  definite rejection (e.g. 429); HTTP attempts and accepted remote jobs are
  counted separately in acceptance tests.
- Never expose raw upstream response bodies. Preserve useful classified errors
  while redacting every known key, sensitive header and proxy credential.
- Phase 0 and phase 1 use the same data directory and event schema.
- No telemetry, update checks, package dependencies, tags, Releases or repository
  settings changes. All implementation commits target main.

- Output publication uses an atomic exclusive hard link from the fsynced partial,
  followed by unlinking the partial. Node's portable rename replaces existing
  targets and cannot implement the stronger never-overwrite requirement without
  a race. The exclusive link has atomic publication with no replacement; recovery
  matches a leftover partial's inode to its published output. Bytes are unchanged.
- Retry-After is honored even above 30 seconds; the exponential fallback retains
  the former 30-second cap. Pure relocation was committed before this change.
- Custom compatible endpoints select JSON or multipart before create; vLLM-Omni
  documents multipart even for text-only requests. No fallback encoding retry.
- Store records and nested fields are frozen after redaction. Reserved event
  fields cannot be overridden by patches. Every entering-submitting record must
  increment the create counter exactly once, and submitting/remote-ID writes
  force fsync even when the caller requests an unsynced append. Queued batch
  insertion uses one final flush so 50,000 jobs do not require 50,000 fsyncs.
- Restart converts an interrupted create without a remote ID to needs_review.
  Verified idempotent adapters may explicitly recover to queued with the same
  local UUID. Manual and idempotent retry grants apply to one attempt and are
  consumed when submitting; an old rate-limit error cannot authorize a later
  duplicate create. Known remote IDs are immutable.
- Lock owner metadata is written to a private wx candidate and fsynced before
  exclusive hard-link publication as lock. This retains exclusive creation
  while eliminating the empty-lock crash window. Stale-lock takeover claims an
  immutable generation before deletion. Dead reclaimers have successor claims;
  contenders never race to unlink a shared claim. Release checks ownership.
  Malformed or externally altered owner metadata fails closed.
- Snapshots retain jobs and batch controls in the existing schema. The snapshot
  is fsynced, atomically renamed, and its directory fsynced before log truncation.
  Tests kill real processes at each compaction boundary. An incomplete final log
  line is truncated and fsynced before new appends; complete corrupt records or
  sequence gaps stop startup instead of silently discarding work.
- Assets are validated and fsynced in unique private partials before publication.
  Existing content is checked by digest, MIME and dimensions. A corrupt regular
  file is repaired only from known incoming bytes with its expected hash; reads
  reject symlinks. Collection only removes recognized unreferenced asset names
  and owned partials, leaving unrelated files and directories alone.
- Every provider redirect is validated before following it. Credential query
  parameters, decoded known secrets in queries or external URLs, URL userinfo,
  and HTTPS downgrades are rejected. Redirects and unauthenticated downloads
  strip credential headers. JSON is parsed before value redaction so schema
  member names remain intact; a redacted remote ID fails closed as an ambiguous
  create instead of saving an unusable ID or submitting again.
- Output publication fsyncs its directory before the succeeded record is
  acknowledged. The partial hardlink remains until that record is persisted.
  Startup recovers a matching published inode before contacting the provider,
  including when its result has expired, and removes a succeeded job's stale
  marker only when it matches the recorded output inode.

- The scheduler holds lane slots from submitting through the remote terminal
  response. Unresolved creates retain a conservative slot across restarts;
  a fully occupied uncertain lane needs human reconciliation before more work
  can dispatch. Downloads use a separate global pool of three. Pausing a batch
  or lane stops new creates but continues tracking already paid work.
- Rate-limit responses cool the whole lane and honor Retry-After. Poll and
  download failures retry only their own phase with jittered backoff. Repeated
  transient failures open a circuit requiring explicit resume. Missing keys
  block authenticated work while unauthenticated result downloads may finish.
- Budgets reserve estimated cost before dispatch and include uncertain charges.
  Different currencies are never combined. A batch pauses before its next
  reservation would exceed the cap; this is an estimate, not a billing limit.
- Settings retain only lane identity, concurrency and manual pause preferences.
  Keys are not persisted. SSE retains bounded incremental events by durable seq;
  reconnects outside that buffer receive a resync instruction and fetch paginated
  snapshots. Disconnecting or throttling a browser cannot cancel queue work.
- The expanded prompt text is bounded by the batch request byte budget to avoid
  unbounded allocation through a huge repeat count. There is no 50,000-job cap.
  Catalog refresh is an explicit POST; GET endpoints never contact providers.
