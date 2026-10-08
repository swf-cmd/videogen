# Architecture

## Current and target system

Version 2.1.3 is a local, zero-dependency, multi-provider render queue. The browser
observes work owned by the service process. It replaces v1.0.2's monolithic
OpenAI Videos/Batch server, where jobs lived only inside request handlers.

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

Use a versioned, monotonic NDJSON event log and atomic, streaming NDJSON snapshot. Submitting and
remote-ID events are durability barriers. A process lock protects all ports
sharing a data directory. Assets are content-addressed; keys remain only in
memory, scoped to provider + region + base URL. Persist only explicit task fields.
Never forward credentials to result CDNs or across redirects. Stream original
bytes into private partial files and publish without overwriting existing files.
SSE is incremental with bounded replay; list endpoints are paginated.

## Delivery

The current release includes per-shot first and last frames, CSV/template batch
imports, gallery Keep/Reject decisions, confirmed regeneration, and Windows/macOS
portable bundles. Offline unit, crash-acceptance and extracted-launcher tests
cover the durable queue and release artifacts.

## Decisions

- Treat research claims as leads. Official documents read during implementation
  are recorded per provider; unknown fields/prices remain explicitly unverified.
- I7 refers to accepted or ambiguous creates. I4 explicitly permits retry after
  definite rejection (e.g. 429); HTTP attempts and accepted remote jobs are
  counted separately in acceptance tests.
- Never expose raw upstream response bodies. Preserve classified provider errors
  while redacting validated long keys, sensitive headers and proxy credentials.
  Invalid keys are never registered as secrets; short local placeholders are not
  used for substring redaction. User prompts, paths, lane URLs and local IDs are
  persisted unchanged.
- Phase 0 and phase 1 use the same data directory and event schema.
- No telemetry, automatic update checks or runtime package dependencies. Release
  bundles are built and smoke-tested on their target operating systems; tagged
  builds retain those exact artifacts for a draft GitHub Release.

- Output publication uses an atomic exclusive hard link from the fsynced partial,
  followed by unlinking the partial. Node's portable rename replaces existing
  targets and cannot implement the stronger never-overwrite requirement without
  a race. The exclusive link has atomic publication with no replacement; recovery
  matches a leftover partial's inode to its published output. Bytes are unchanged.
- Retry-After is honored even above 30 seconds; the exponential fallback retains
  the former 30-second cap. Pure relocation was committed before this change.
- Custom compatible endpoints select JSON or multipart before create; vLLM-Omni
  documents multipart even for text-only requests. No fallback encoding retry.
- Store records and nested fields are frozen after field allowlisting. Reserved event
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
  contenders never race to unlink a shared claim. Canonical locks and reclaim
  markers store a process-instance token, a UTC birth-time estimate from Node
  uptime, and a cheap precise kernel identity when available (Linux). Creating
  the normal lock never launches PowerShell or ps. Only an existing lock owned
  by another live PID triggers an OS query. Exact compatible identities can
  prove PID reuse; an approximate match within two seconds confirms ownership,
  but a mismatch alone never authorizes takeover. Clock corrections, workers,
  missing identities and failed queries remain conservative and explain the
  uncertainty. Legacy records recover when their PID no longer exists. Conflict
  queries have a bounded timeout (two seconds on macOS, five seconds on Windows)
  and bounded output, and neither request nor save command lines. Release checks
  the immutable file generation. Malformed or externally altered metadata fails closed. Data directories
  must support hard links; unsupported filesystems fail with an actionable startup
  message instead of weakening exclusive locking.
- Journals compact automatically after bounded growth. Version 2 snapshots use
  `jobs.snapshot.ndjson`, retaining jobs and batch controls without building one
  giant JSON string. Immutable model configurations are interned in memory and
  represented once by references in the journal and streaming snapshot. Startup
  streams journal and version 2 snapshot records; legacy `jobs.snapshot.json`
  snapshots remain compatible but require the old whole-file parse until the
  next compaction writes version 2. The live job index still grows with retained
  history; streaming bounds parsing scratch space, not the entire index. The
  snapshot is fsynced, atomically
  renamed, and its directory fsynced before log truncation.
  Tests kill real processes at each compaction boundary. An incomplete final log
  line is truncated and fsynced before new appends; complete corrupt records or
  sequence gaps stop startup instead of silently discarding work. This does not
  reconstruct strings damaged by older substring redaction; existing corrupted
  prompts, endpoints or IDs require a known-good backup or verified original
  values. The explicit offline [quarantine recovery tool](DATA_RECOVERY.md) can
  preserve source evidence and isolate attributable damaged records into a new
  directory. It cannot reconstruct lost text or skip ambiguous journal gaps.
  Recovered unpaid/uncertain work requires review; known remote jobs stay tracked.
  Paid work must not be silently requeued.
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
- Rate-limit responses honor Retry-After. Poll and download failures retry only
  their own phase with jittered backoff. Repeated provider failures stop new
  submissions temporarily, then allow a probe after cooldown. Local DNS and
  connection failures retry as offline conditions. Circuits, depleted quota and
  unavailable models never stop tracking or downloading already paid work.
  Missing keys block authenticated work while unauthenticated downloads may finish.
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
- Busy snapshot/journal replacement (EPERM/EBUSY) defers compaction with a
  one-to-thirty-second backoff while writes continue to the verified original
  journal. A held temporary snapshot blocks generating another one until cleanup
  succeeds. Non-transient maintenance failures, failed journal flushes, failed
  journal reopening and settings write failures stop new dispatch. A later successful disk call cannot make an uncertain in-memory
  record safe to submit; the service must restart and replay durable state.
- The browser connects SSE before fetching paginated snapshots. Durable sequence
  numbers preserve newer events over stale snapshots; request revisions discard
  outdated pages and lane responses. Reconnects start snapshots immediately;
  ready is shown only after the current connection synchronizes. Bounded newer
  job/batch events and deletion markers overlay older snapshots without starving
  refreshes. Secrets are submitted separately from batch
  payloads, cleared from input fields and never included in native form fields.
  HTML confirmation dialogs preserve cost and duplicate-charge warnings without
  relying on browser-native modal behavior. Preview scripts never call the API.
- Gemini creates stored background interactions with URI video delivery. The
  interaction ID and any returned Files metadata URL are persisted together.
  Polling uses a bounded interaction SSE replay until a Files resource is known,
  then polls Files; it does not buffer inline base64 video. Manual recovery accepts
  validated interaction IDs or Files resources. Upload references are cached only
  in memory. An interrupted create remains uncertain and can have incurred a charge.
- DashScope Wan 3.0 uses the verified regional workspace-specific endpoints.
  Placeholder and mismatched-region hosts are rejected before queuing. Its
  documented RPS ceiling is not converted into an equivalent bursty RPM bucket;
  default concurrency 2 is a conservative application policy.
- ModelArk Seedance 2.5 first frames are fitted locally, then submitted using the
  required adaptive ratio. Unverified seed support is disabled for both regions.
  China pricing remains unknown; BytePlus uses the documented output dimensions
  and token formula. Gemini estimates only verified 720p video-output tokens;
  input/thinking costs and unverified resolution factors are not invented.
- No adapter currently claims verified create idempotency. Optional remote
  cancellation is not exposed where deleting an already-finished task could
  erase the only usable result reference. Local cancellation stops queued work
  while already accepted requests remain tracked through download.
- Native environment proxy support is enabled by the npm start command and
  macOS launcher. Node 22.21 initializes its proxy agents even before preloads.
  The npm entry checks the Node version before using `--no-use-env-proxy`, validates
  settings without active proxy agents, then starts the service with
  `--use-env-proxy`. Supervisors request graceful shutdown through IPC on Ctrl+C,
  SIGTERM and SIGHUP; loss of the parent IPC channel also shuts the service down.
  Windows does not rely on `child.kill()` for graceful termination. The application
  has 15 seconds to drain, with a 20-second supervisor termination fallback. The launcher validates in
  its unproxied helper before spawning the same service. Bootstrap validates effective
  proxy URLs, normalizes uppercase/lowercase settings and appends loopback
  bypasses. This ordering also prevents Node's invalid-proxy errors from echoing
  credentials. Public metadata exposes only redacted effective addresses.
  The supported range is Node 22.21+ in the 22.x line, or 24.5+; Node 23 is
  excluded. Tests use real HTTPS CONNECT tunnels with generated in-memory TLS
  keys and trusted temporary public certificates, never disabled TLS validation.

## Operational API

All mutations require a matching Origin; keys and batches use separate requests.
GET operations read local state only. The legacy generation/status/download
routes are removed.

| Resource | Operations |
| --- | --- |
| `/api/catalog` | GET catalog and runtime metadata; POST `/api/catalog/refresh/:provider` explicitly refreshes supported catalogs. |
| `/api/keys` | GET lane presence only; POST `{lane,key}` sets an in-memory key; DELETE `/api/keys/:laneId` forgets it. |
| `/api/estimate` | POST computes count, currency-specific cost and approximate ETA without creating records. |
| `/api/batches` | POST enqueues JSON or multipart with one `input_reference`; GET paginates; GET `/:id` reads summary; POST `/:id/pause`, `/resume`, `/cancel` controls work. |
| `/api/jobs` | GET paginates and filters; GET `/:id` reads details; POST `/:id/cancel`, `/retry`, `/resolve` applies guarded actions; GET `/:id/regenerate/estimate` and POST `/:id/regenerate` estimate and confirm a new paid take; POST `/:id/curate` stores Keep/Reject decisions. |
| `/api/gallery/summary` | GET summarizes local gallery results and curation. |
| `/api/lanes` | GET reads state; POST `/:id` sets concurrency or pause/resume. |
| `/api/events` | GET incremental SSE with sequence replay, resync and heartbeat. |
| `/api/history/clear` | POST removes finished records and unused assets, preserving unresolved/active jobs and outputs. |
| `/api/select-output-dir` | POST opens the macOS chooser; other systems use manual paths. |

The 100-job acceptance fixture independently counts accepted remote creates,
unknown outcomes and peak concurrency. It kills real service processes during
create, poll and download, disconnects SSE, restores keys and verifies original
file bytes. Separate process tests cover the two create durability barriers and
every snapshot compaction boundary. These are offline contracts, not a claim of
paid production validation against each provider.

### Existing damaged records

The redaction fix preserves new user data. Text already replaced with `[REDACTED]` by an older version cannot be reconstructed automatically. Restore affected prompts/endpoints from a known-good backup before reusing them; never blindly resubmit an ambiguous paid create. Version 1 JSON snapshots remain readable and are removed only after a durable version 2 snapshot replaces them.
