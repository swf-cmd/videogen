# Changelog

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
