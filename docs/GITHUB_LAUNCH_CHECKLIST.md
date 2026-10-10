# Maintainer launch checklist

Publication checklist for **videogen 2.2.1**, plus historical release notes. Maintainers create release tags. After a `v2.*` tag passes CI, the workflow creates or updates a **draft** Release with the exact tested ZIPs and their checksums; it refuses to modify an already published Release. Publishing the draft, repository metadata and media remain explicit maintainer actions.

## Repository metadata

Description:

```text
Local AI video batch studio: prompts or CSV in, reviewed takes out. Multi-take renders with per-shot frames, keyboard review, cost estimates and a crash-safe queue on OpenRouter, Gemini, Wan, Seedance or any OpenAI-compatible server. Formerly Sora2App.
```

Topics: `ai-video`, `video-generation`, `text-to-video`, `image-to-video`, `batch-processing`, `render-queue`, `local-first`, `openrouter`, `gemini`, `veo`, `kling`, `seedance`, `wan`, `sora`, `csv`, `nodejs`, `windows`, `macos`.

Website: [README](https://github.com/swf-cmd/videogen#readme). The first screen shows a workflow recording made against a local stand-in endpoint with labeled synthetic clips and an example price, plus a gallery screenshot from the same run. These do not demonstrate paid model output quality. See the [promotion kit](PROMOTION_KIT.md).

Social preview: upload `.github/social-preview.png` (1280×640) under **Settings → General → Social preview**; the API cannot set it.

## Historical v2.0.0

- Create the `v2.0.0` tag and Release at **85cb144**, not at the later v2.1 commit.
- Use [RELEASE-v2.0.0.md](RELEASE-v2.0.0.md). It preserves v2.0's blocking Gemini / disabled OpenRouter local-frame limits.
- Do not attach current v2.1 ZIPs to v2.0.0 or imply that the historical release contained CSV/gallery features.

## v2.2.1 source and packages

- Review the final changes and use [RELEASE-v2.2.1.md](RELEASE-v2.2.1.md) as the release body.
- Run `npm test` and `npm run test:e2e` with supported Node runtimes. All fixtures are local; do not set real provider keys or call paid APIs for validation.
- Build with `python3 scripts/package-portable.py --target all --output dist --cache work/runtime-cache`. The allowlist excludes private runtime records and includes the public catalog, approved documentation/demo files and complete runtime licenses.
- Run `scripts/smoke-portable.py` against each extracted platform bundle. Test Windows x64, Apple Silicon and Intel Mac; record actual results. CI tests Linux/Windows on Node 22.21.0 and 24.21.0, plus native portable bundles on Windows, Apple Silicon and Intel Mac.
- After the tag workflow succeeds, download both ZIPs and both `.zip.sha256` files from the draft Release and verify the downloaded bytes. Confirm the draft targets the intended commit and the app version is 2.2.1; publish only after the asset check succeeds.
- Inspect ZIP contents and generated checksums. Both macOS architectures must be present; runtime URLs and hashes must match the pinned manifest. Check app version, launcher executable permissions, missing-runtime failure, source fallback behavior and writable portable paths.
- Confirm archives do not include `.git`, `.env`, real keys, personal journals/assets, catalog overrides/caches, private screenshots, generated user media or proxy userinfo. Never package a used portable app folder.
- The bundles are not signed/notarized installers. First-open OS confirmation may be required. Do not promise bypass of macOS/Windows security prompts or imply paid signing was performed.

## Behavior and safety

- Validate follow-up recovery behavior before describing it in the final release body: healthy service status returns 200; startup validation preserves damaged records and explains the exact data directory and backup/recovery options; startup 503 messages follow the requested UI language.
- On Windows, check transient compaction rename failures and graceful shutdown; ensure temporary `EPERM`/`EBUSY` retries do not skip durable appends. Verify normal lock creation runs no PowerShell/ps, exact process identity permits safe stale-owner recovery, and approximate timestamp mismatches or unavailable identities remain conservatively locked.
- Check pagination during SSE refreshes, semicolon/case-insensitive CSV headers, literal template text, Unicode-normalized image matching and natural order, and preservation of manually selected images.
- Verify unchanged poll results avoid redundant journal writes, Gemini Files addresses remain durable, external model lists expose only allowed display fields, and short proxy passwords are removed from diagnostic messages without rewriting schema or user data.
- Exercise all four UI languages, per-row first/last frames, unsupported-model errors, CSV quoting, templates, image-folder matching, row estimates and explicit batch confirmation.
- Preview local outputs in the gallery; verify keep/reject persistence, currency-separated/unknown cost handling and estimated cost per kept clip. Every regeneration must have a separate explicit confirmation.
- Verify Gemini's interaction ID is durable before polling and restart recovery follows it. Lost creates without a received ID must still stop for review. Keep any compatibility handling for old Files references documented.
- Verify OpenRouter frame data URLs and model-catalog parsing against offline contracts. Unsupported capabilities stay disabled; missing pricing stays unknown. Do not claim a model is popular or available without a cited, current source.
- Exercise `npm start` and both launchers with and without proxy variables. Check lowercase precedence, forced loopback bypass, invalid-proxy redaction and signal forwarding / lock cleanup.
- Check lane concurrency, budgets, throttle/pause/resume, streamed downloads, filename collisions, remote-ID association, history cleanup and crash recovery. Ambiguous creates must never be automatically resubmitted.
- Record the 100-job acceptance results: zero duplicate creates, untracked accepted jobs, output hash mismatches and leaked secrets; report expected failures/review counts honestly. Mock results do not guarantee provider uptime or invoices.

## Publication status

Check the README, language versions, privacy notes, architecture and provider contracts against the final code. Distinguish checked offline behavior, locally verified platforms, CI-verified platforms and untested live provider behavior. Only publish approved public assets; paid samples, commercial signing and paid provider smoke calls remain deferred unless explicitly authorized.
