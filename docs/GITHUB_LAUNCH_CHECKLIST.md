# Maintainer launch checklist

Publication checklist for **videogen 2.1.0**, plus the historical v2.0.0 release. No script in this repository automatically publishes tags, Releases, repository metadata or media.

## Repository metadata

Description:

```text
Local AI video batch studio: per-shot frames, CSV imports, gallery selection, crash recovery and automatic downloads.
```

Topics: `ai-video`, `video-generation`, `batch-processing`, `local-first`, `openrouter`, `gemini`, `seedance`, `wan`, `nodejs`, `windows`, `macos`, `csv`.

Website: [README](https://github.com/swf-cmd/videogen#readme). The first screen links a real local-fixture workflow recording and an explicitly labeled offline playback sample. These do not demonstrate paid model output quality. See the [promotion kit](PROMOTION_KIT.md).

## Historical v2.0.0

- Create the `v2.0.0` tag and Release at **85cb144**, not at the later v2.1 commit.
- Use [RELEASE-v2.0.0.md](RELEASE-v2.0.0.md). It preserves v2.0's blocking Gemini / disabled OpenRouter local-frame limits.
- Do not attach current v2.1 ZIPs to v2.0.0 or imply that the historical release contained CSV/gallery features.

## v2.1 source and packages

- Review the final changes and use [RELEASE-v2.1.0.md](RELEASE-v2.1.0.md) as the release body.
- Run `npm test` and `npm run test:e2e` with supported Node runtimes. All fixtures are local; do not set real provider keys or call paid APIs for validation.
- Build with `python3 scripts/package-portable.py --target all --output dist --cache work/runtime-cache`. The allowlist excludes private runtime records and includes the public catalog, approved documentation/demo files and complete runtime licenses.
- Run `scripts/smoke-portable.py` against each extracted platform bundle. Test Windows x64, Apple Silicon and Intel Mac; record actual results. The CI workflow uses standard public-repository runners and is disabled for private repositories to avoid runner charges.
- Inspect ZIP contents and generated checksums. Both macOS architectures must be present; runtime URLs and hashes must match the pinned manifest. Check app version, launcher executable permissions, missing-runtime failure, source fallback behavior and writable portable paths.
- Confirm archives do not include `.git`, `.env`, real keys, personal journals/assets, catalog overrides/caches, private screenshots, generated user media or proxy userinfo. Never package a used portable app folder.
- The bundles are not signed/notarized installers. First-open OS confirmation may be required. Do not promise bypass of macOS/Windows security prompts or imply paid signing was performed.

## Behavior and safety

- Exercise all four UI languages, per-row first/last frames, unsupported-model errors, CSV quoting, templates, image-folder matching, row estimates and explicit batch confirmation.
- Preview local outputs in the gallery; verify keep/reject persistence, currency-separated/unknown cost handling and estimated cost per kept clip. Every regeneration must have a separate explicit confirmation.
- Verify Gemini's interaction ID is durable before polling and restart recovery follows it. Lost creates without a received ID must still stop for review. Keep any compatibility handling for old Files references documented.
- Verify OpenRouter frame data URLs and model-catalog parsing against offline contracts. Unsupported capabilities stay disabled; missing pricing stays unknown. Do not claim a model is popular or available without a cited, current source.
- Exercise `npm start` and both launchers with and without proxy variables. Check lowercase precedence, forced loopback bypass, invalid-proxy redaction and signal forwarding / lock cleanup.
- Check lane concurrency, budgets, throttle/pause/resume, streamed downloads, filename collisions, remote-ID association, history cleanup and crash recovery. Ambiguous creates must never be automatically resubmitted.
- Record the 100-job acceptance results: zero duplicate creates, untracked accepted jobs, output hash mismatches and leaked secrets; report expected failures/review counts honestly. Mock results do not guarantee provider uptime or invoices.

## Publication status

Check the README, language versions, privacy notes, architecture and provider contracts against the final code. Distinguish checked offline behavior, locally verified platforms, CI-verified platforms and untested live provider behavior. Only publish approved public assets; paid samples, commercial signing and paid provider smoke calls remain deferred unless explicitly authorized.
