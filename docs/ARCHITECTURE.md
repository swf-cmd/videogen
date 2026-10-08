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
