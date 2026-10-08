# Maintainer launch checklist

Manual publication checklist for **videogen 2.0.0**. Tags, GitHub Releases, packaged binaries and repository settings remain maintainer actions; this file does not publish them.

## Repository metadata

Suggested description:

```text
Local multi-provider AI video render queue with crash recovery, memory-only keys and automatic downloads.
```

Suggested topics: `ai-video`, `video-generation`, `render-queue`, `local-first`, `nodejs`, `openrouter`, `gemini`, `macos`.

Website: [README](https://github.com/swf-cmd/videogen#readme).

## Source and packaging

Include the READMEs, LICENSE, privacy/security/contribution notes, CHANGELOG, `package.json`, `server.js`, `src/`, `public/`, `data/catalog/`, `test/`, `acceptance/`, `docs/` and **Start videogen.command** in the source distribution. No dependency install or frontend build is required.

Exclude `.astra/`, `.env`, keys, local journals/snapshots/settings, first-frame assets, generated videos, logs, private screenshots and package archives. Include the public bundled catalog, not a user's catalog overrides/cache. Keep `runtime/` out of Git history.

**Maintainers must bundle Node 24 LTS** in macOS release packages for the intended arm64/x64 architecture. Keep the complete application folder with its `runtime/` directory; the launcher does not download a runtime. Validate the packaged launcher separately from a source checkout. Windows/Linux use source startup and manually entered output paths in this iteration.

The supported engine range is `^22.21.0 || >=24.5.0`: test the 22.x and 24.x lines. Node 23 and Node 24.0–24.4 are unsupported. The old `Start Sora2App.command` name is retired. Name each archive for the architecture it actually contains; call a bundle universal only when both architectures are present and tested.

## Verify before publication

- Run offline `npm test` within 60 seconds and `npm run test:e2e` on both supported runtime lines. Neither suite may require a key or spend provider credit.
- Check the 100-job acceptance results: independently counted remote work has no duplicate creates or untracked accepted jobs; output hashes match; secret scans pass; three process kills and five SSE disconnects preserve progress. Record actual results, including expected moderation failures and review items.
- Verify render concurrency per lane, the global download limit, batch budgets, lane cooldown/pause/resume, and all three review actions. An ambiguous create must never be automatically resubmitted.
- Exercise `npm start` and the macOS launcher both with and without proxy variables. Verify real native fetch/CONNECT routing, `NO_PROXY`, lowercase precedence and forced loopback bypass on Node 22.x and 24.x. Invalid proxy URLs must fail startup without exposing userinfo; the UI must show only redacted effective settings.
- Smoke-test all four UI languages, catalog/parameter controls, first-frame fitting, confirmation, progress, paging, refresh/back navigation, SSE reconnect and re-entering keys after service restart. Confirm no key/output-directory preference is left in browser storage.
- Verify streamed downloads, filename collisions, crash recovery of published files and partial markers, remote-ID association, and history/assets cleanup with temporary directories. Preserve provider bytes and metadata.
- Keep the READMEs, privacy/security notes, architecture, changelog and provider contracts consistent with the released code. Review dated official links, regions, account terms and prices; unknown pricing must stay unknown. No expired promotion is a default price.
- Distinguish offline adapter coverage from live provider testing. This implementation includes five provider families; compatible custom endpoints remain experimental, OpenRouter local first frames and Seedance 2.5 seed remain disabled, and Gemini uses blocking create with Files-specific manual recovery. See [provider contracts](providers/).
- Inspect the staged diff and archive contents for credentials, proxy userinfo, personal paths, private task data and media. Do not publish `.astra/` or raw diagnostics. Confirm the MIT license remains intact and provider terms are documented separately.

## Artwork and announcement

The obsolete Sora social-preview artwork has been removed. Make a new 1280 × 640 PNG under 1 MB from the current interface with synthetic prompts, empty key fields and shortened output paths. Remove real account/task IDs, media URLs and proxy userinfo. Upload it manually in GitHub's Social preview settings.

Use [the promotion kit](PROMOTION_KIT.md) for release copy. Describe the persistent queue, recovery after key re-entry and conservative handling of ambiguous creates. Do not promise provider uptime, universal account access, accurate billing from estimates or a playable video from the mock fixture. Creating the tag/Release and uploading binaries are separate maintainer steps.
