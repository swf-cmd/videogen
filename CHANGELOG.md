# Changelog

## 2.2.0 — 2026-10-09

Review workflow

- Render every prompt or CSV row several times with **Takes per prompt** (1–20). Takes keep their row's settings and frames, count in estimates and budgets, and are saved with `-tN` suffixes.
- Review from the keyboard: J/K or arrow keys move, Space plays, 1 keeps, 2 rejects, 3/U resets, and Keep/Reject advances to the next unreviewed take. Cards are grouped by batch and shot, show "Shot N · Take M", load their first frame near the viewport and announce decisions to screen readers.
- Export a manifest of kept (or all) finished takes as CSV or JSON with absolute paths, prompts, model settings, shot/take, estimated costs, remote IDs and SHA-256. CSV cells are quoted and formula-neutralized.
- Stop tracking a running job (for example after attaching a mistyped remote ID) without implying remote cancellation or a refund.
- Optional desktop notifications for finished batches, new review items and lanes waiting for a key. Batches are labeled by date and first prompt. Below 560 px the job table becomes stacked cards with every action reachable.

Queue and safety fixes

- Saving a key after an authentication error no longer hangs the service in an endless journal-writing loop, and it no longer lifts a manual, quota or model-access pause.
- A job cancelled while its create was in flight is cancelled, not created again, when the provider definitely rejects that create.
- Clear history no longer re-arms a batch budget by deleting charged takes, and no longer deletes frames of an import that is still being saved. A regeneration that the batch budget cannot dispatch is refused instead of waiting forever.
- Downloads time out on inactivity instead of total duration, so large results on slow links finish. A 4xx while polling or downloading accepted work is retried; only a 15-minute 404 streak ends a running job as `remote_not_found`. A presigned-URL 403 no longer marks the lane as needing a key.
- An explicit retry or resubmit inside a cancelled batch reopens it. Batch cancel uses one durability barrier instead of one fsync per job. An absurd Retry-After is clamped instead of stopping the scheduler.
- Startup continues when an old output folder became unreadable. The filename ".mp4" can no longer publish outside the output folder. Response bodies are released when an output write fails early. Uploaded frame buffers are freed once a job leaves the queue, and a frame shared by many rows is stored once.
- Windows `~\` output paths expand to the home folder, and home-path redaction no longer rewrites sibling folders or every separator when the home is a root.

Frontend fixes

- Editing a 1,000-row import no longer freezes for ~1.7 s per keystroke. Rows update in place, keeping focus, typed values and open details.
- Live updates reconnect after a startup 503 instead of staying on "Reconnecting"; polling runs only while the event stream is down. Connection errors are localized and clear after recovery. Action buttons keep keyboard focus.
- EXIF-rotated JPEG frames are redrawn upright before upload. The 120 MB image limit fails early with progress. Literal `{{column}}` text in a CSV triggers a warning with one-click template expansion. CSV errors report file line numbers; trailing empty header columns, spaces before quotes and an `index` column are handled.
- A safe retry no longer depends on the current catalog still containing the model. The catalog is retried during the startup window.

Providers

- OpenRouter Seedance estimates use OpenRouter's published ByteDance token formula instead of showing Unknown; undocumented sizes such as 4K stay unknown.
- OpenRouter requests carry its documented app-attribution headers; `VIDEOGEN_OPENROUTER_ATTRIBUTION=0` disables them.
- Documented the 2026-10-22 removal of Veo 3.1 preview models from the Gemini API and the USD list prices shown for Model Studio Singapore on the international site.

All verification uses local fixtures; no paid provider calls were made. The 100-job crash acceptance result is unchanged: zero duplicate paid creates, untracked remote jobs, hash mismatches or exposed secrets.

## 2.1.4 — 2026-10-08

- Include the startup, quarantine recovery, compaction and frontend fixes prepared for v2.1.2, plus the launcher readiness regression from v2.1.3.
- Replace short real-I/O test waits with explicit readiness/state conditions and bounded deadlines, preserve graceful shutdown budgets, and record sanitized diagnostics. Exercise deliberately slow requests without weakening paid-create, output-integrity or restart assertions.
- Keep application-only crash workers alive until the intended process kill and capture process closure from launch. This prevents a normal early exit from being mistaken for a crash or leaving a late close-event waiter stuck.
- v2.1.2 and v2.1.3 tags are retained unchanged and were not published after CI fixture timing failures; v2.1.4 is the subsequent release.

## 2.1.3 — 2026-10-08 (not published)

- Include all v2.1.2 product fixes and the offline quarantine recovery tool.
- Wait for actual launcher readiness with a bounded deadline in process tests, including a deliberately delayed startup regression, instead of failing after a fixed two-second polling window on a busy Intel runner. Shutdown, orphan-process and data-lock assertions remain enforced.
- v2.1.2 was tagged but not published after that CI fixture failure. Its tag is retained unchanged; v2.1.3 is the subsequent release.

## 2.1.2 — 2026-10-08 (not published)

- Remove PowerShell/ps from normal lock creation. Inspect foreign processes only on lock conflicts, tolerate approximate birth times conservatively, and explain unverifiable ownership.
- Stabilize crash acceptance with a ten-second normal create timeout and explicit lost-response faults; retain separate timeout and duplicate-charge safety tests plus sanitized diagnostics for every failure phase.
- Add explicit offline quarantine recovery into a new directory with original evidence retained, paid IDs preserved, uncertain creates requiring review, and ambiguous journal corruption rejected.
- Defer Windows busy-file compaction with bounded background backoff while durable appends continue. Reopen only the same original journal and limit retained temporary snapshots.
- Match image filenames case-insensitively only when unambiguous, preserving exact-match priority. Synchronize SSE reconnects immediately and overlay newer events and deletions over stale snapshots.

## 2.1.1 — 2026-10-08

- Preserve prompts, paths, endpoints and IDs when local placeholder keys are used; rejected keys no longer enter the redaction registry. Scope substring redaction to provider-returned data and validated long keys.
- Recover submission circuits after cooldown, treat local connection/DNS failures as offline, and continue polling/downloading accepted jobs through quota, model-access and circuit pauses.
- Keep entered budgets during estimate refreshes. Reconcile SSE reconnects and coalesce state refreshes while preserving row focus. Reject non-UTF-8 CSV input with an explicit encoding error.
- Compact journals automatically, stream new snapshots and replay, and deduplicate model metadata. Keep normal-batch estimates bounded and yield while preparing large submissions.
- Preserve provider error codes/messages, distinguish local storage failures, reject new batches after fatal scheduler errors, and validate output directories before paid submission. Validate output filenames and retain the correct video extension.
- Validate persisted records before startup without rewriting damaged data; report the absolute recovery directory and backup guidance. Healthy service checks return 200, and startup 503 messages are localized.
- Retry transient Windows compaction rename failures without losing journal appends. Record process creation identities in locks and reclaim markers so verified PID reuse cannot leave a stale lock permanently occupied; unknown identities remain conservative.
- Keep pagination usable during event refreshes; support semicolon/case-insensitive CSV headers, literal template text, normalized natural image matching and preserved manual frame choices.
- Avoid duplicate records for unchanged polls, persist recovered Gemini Files addresses, restrict external model lists to display fields, and redact short proxy passwords only in diagnostic text.
- Keep the Windows source launcher open when Node version checks fail and preserve the failing exit status. `VIDEOGEN_NO_PAUSE=1` disables the pause for noninteractive runs.
- Request graceful shutdown over IPC, including Windows Ctrl+C and launcher disconnects; handle SIGHUP, check Node versions before new CLI flags, and announce URLs only after successful startup. Unsupported hard-link filesystems fail with directory guidance.
- Package only tracked, allowlisted files, normalize text and Windows launcher endings, and use a platform-independent archive order. Run CI for all pull requests and main pushes, including minimum Node 22.21, Node 24, crash acceptance and native portable smoke tests. Tag jobs pass the exact tested archives into draft releases.
- Add framing protection, tolerate individual malformed OpenRouter catalog entries, and update architecture, provider, storage and portable-run documentation.

All added verification uses local fixtures. Native Windows/macOS release validation is performed by CI; a source test pass does not substitute for a successful native artifact run.

## 2.1.0 — 2026-10-08

- Add per-job first and supported last frames, CSV/template-variable imports and image-folder matching with row-level model validation and cost estimates.
- Add a local video gallery with persistent keep/reject selections, estimated spending per kept clip and an explicit confirmation for every regeneration.
- Switch Gemini to background interactions, saving the interaction ID before polling and resuming known IDs after a restart. Unknown creates still require review when no ID was received.
- Enable OpenRouter local frame images as base64 data URLs for supported models; derive controls, validation and estimates from its video model catalog.
- Add Windows x64 and macOS universal no-install ZIP packaging with pinned, SHA-256-verified Node v24.21.0 LTS and full Node license notices. Share proxy-safe launcher code, keep portable data/output defaults beside the application, and fail clearly if a bundled runtime is missing.
- Add reproducible packaging, portable smoke tests and a public-repository-only Windows / Apple Silicon / Intel CI matrix. ZIPs do not require npm, system Node, automatic runtime downloads or paid signing services.
- Add Japanese and Korean READMEs, a Sora 2 migration guide, historical v2.0 release notes and a local-fixture UI recording. Offline sample clips are labeled playback tests rather than AI quality examples.

No paid provider calls are required for builds or offline validation. OS and live-provider checks must be reported from actual runs; estimates remain distinct from invoices. A missing create response can still lead to review even with background generation.

## 2.0.0 — 2026-10-08

- Replace sequential, browser-bound generation with a persistent render queue. Closing or refreshing the page leaves server-side work running; restarting the service resumes known jobs after lane keys are re-entered.
- Add a replayable event journal, crash-safe snapshots, content-addressed first-frame storage and a single-instance data-directory lock. Persist submission intent and remote IDs before proceeding across create boundaries.
- Add provider/region/base-URL lanes with configurable in-flight limits, throttling cooldowns, circuit breakers, budget controls and an independent download pool. Ambiguous creates stop in `needs_review` for explicit resolution instead of automatic resubmission.
- Add paginated job/batch APIs and reconnectable SSE updates. Replace the transitional generation endpoints and UI with queue progress, lane and batch controls, filtering, review actions and local history/material cleanup in Chinese, Japanese, English and Korean.
- Add direct Gemini Omni, Alibaba Cloud DashScope (Beijing/Singapore) and Ark (Volcengine/BytePlus) adapters alongside OpenRouter and OpenAI-compatible servers. Include dated catalogs, regional prices where verified, provider documentation and offline contract tests.
- Keep provider caveats visible: Gemini create is blocking and cannot automatically recover an interrupted request; OpenRouter local first frames remain disabled; Seedance 2.5 seed remains disabled. Unverified capabilities remain experimental and unknown prices remain unknown.
- Harden original-byte streaming downloads, credential isolation, redirect handling, filename collision handling and recovery after output publication. Keys remain in service memory only; task records, prompts, parameters, first frames and output metadata remain local persistent data.
- Require Node `^22.21.0 || >=24.5.0`; enable Node's native environment proxy support in `npm start` and the macOS launcher, force local endpoints to bypass proxies, and redact proxy credentials in the UI. Maintainers package the official macOS bundle with Node 24 LTS.
- Add offline tests for state transitions, crash boundaries, storage, scheduler limits, security, providers and the four-language frontend. Add a separate 100-job acceptance suite with three SIGKILLs and SSE disconnects; its default run completed with 92 successes, 5 moderation failures, 3 jobs requiring review, and zero duplicate paid creates, untracked remote jobs, hash mismatches or secret occurrences.

Phase 1 is complete. No npm dependencies, telemetry, update checks or project-controlled cloud service were added. Provider contract tests use local fixtures; no paid provider smoke calls were made without configured test keys. Release tags, GitHub Releases, repository settings and packaged binaries remain maintainer actions.

## 1.1.0 — 2026-10-08

- Rename Sora2App to **videogen** and the macOS launcher to `Start videogen.command`; change the default output directory to `~/Downloads/videogen`.
- Replace the retired Sora-only integration with OpenRouter, configurable OpenAI-compatible endpoints and a development-only mock.
- Replace OpenAI Batch, Files/JSONL submission, the discount badge and 50,000-request UI limit with sequential create → poll → download processing.
- Drive model parameters and estimates from dated provider catalogs; mark custom configurations experimental and missing prices unknown.
- Persist task records and first-frame images locally. Add remote-ID recovery and history/material cleanup; document the privacy change.
- Scope in-memory keys to provider/region/base URL, redact secrets, preserve local Host/Origin checks, and avoid forwarding credentials on result redirects.
- Stream original output bytes to partial files and publish without overwriting existing outputs.
- Separate server modules while retaining classic browser scripts, first-frame fitting and four-language UI support.
- Add offline unit, HTTP-security, provider-contract, storage and transitional-generation tests, plus static frontend and translation checks.

This was the phase 0 baseline. Version 2.0.0 adds automatic restart resumption, per-lane concurrent scheduling, the persistent queue dashboard and additional direct-provider adapters.

## 1.0.2

Historical Sora2App release. Its retired Sora integration is no longer usable; see 1.1.0 for the migration.
