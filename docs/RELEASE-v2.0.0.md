# videogen v2.0.0 — Persistent local video queue

Historical release target: **85cb144**. This note describes that commit, before the v2.1 changes. Do not attach v2.1 portable bundles to this tag.

videogen replaces the retired Sora2App integration with a persistent local queue for OpenRouter, Gemini, Alibaba Cloud Model Studio, Volcengine / BytePlus Ark and configured OpenAI-compatible services. Bring your own provider keys; jobs run in the local service, survive page closure and resume known remote tasks after a service restart and key re-entry.

- Independent provider / region / endpoint lanes with concurrency controls, pause/resume, cooldowns and estimated-cost budgets.
- Durable job journal, crash recovery, paginated progress and reconnectable live updates.
- Automatic downloads preserve original bytes, avoid overwrites and recover published outputs after a crash.
- Ambiguous creates stop for explicit review; attach an existing remote ID, abandon local tracking or authorize resubmission.
- Chinese, Japanese, English and Korean interfaces. Keys stay in memory; prompts, first frames and task records stay on local disk.
- No npm dependencies, build step, telemetry or project-operated cloud service.

## Start

Install Node `^22.21.0 || >=24.5.0`, download the source at this tag and run `npm start`. Open `http://127.0.0.1:5177` or the printed address. The macOS source launcher is **Start videogen.command**. This historical release does not ship the v2.1 no-install Windows/macOS archives.

## Known limits at v2.0.0

Gemini create is blocking; interruption can leave a charged task whose result cannot be automatically recovered. OpenRouter local first-frame inputs are disabled. Seedance 2.5 seed is disabled. An entire batch shares one first frame; CSV/template import and gallery selection are introduced later in v2.1.

Estimates are not billing guarantees; unknown prices stay unknown, currencies are separate and Gemini estimates omit input/thinking charges. Provider account access, region rules, billing and content policies apply independently of this project's MIT license.

## Validation and migration

Offline contract and crash tests exercise local fixtures. The recorded v2.0 acceptance run used 100 jobs, three forced process kills and five SSE disconnects: 92 succeeded, 5 moderation failures and 3 review items, with zero duplicate creates, untracked remote tasks, output hash mismatches or secret occurrences. No paid provider smoke calls were made; these are implementation test results, not third-party uptime or billing guarantees.

Old OpenAI Batch / Files jobs are not migrated to new providers. Back up existing downloads and prompts before switching. Re-enter the selected provider's key and review model capabilities before confirming new jobs. The MIT license remains unchanged.
