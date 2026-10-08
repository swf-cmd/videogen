# Maintainer launch checklist

This file documents manual release work. It does not authorize an automated tag, GitHub Release or repository-settings change.

## Repository metadata

Suggested description:

```text
Local multi-provider AI video workbench with prompt queues, ephemeral keys and automatic downloads.
```

Suggested topics: `ai-video`, `video-generation`, `openrouter`, `nodejs`, `local-first`, `render-queue`, `macos`.

Website: [README](https://github.com/swf-cmd/videogen#readme).

## Artwork

The old Sora social-preview SVGs have been removed. Create a new 1280 × 640 PNG under 1 MB from the current interface using synthetic prompts, an empty key field and shortened output paths. Upload it manually in GitHub's Social preview settings. Do not imply that an experimental or planned provider is already verified.

## Source and packaging

Keep the READMEs, LICENSE, privacy/security/contribution notes, CHANGELOG, `package.json`, `server.js`, `src/`, `public/`, `data/catalog/`, `test/`, provider docs and **Start videogen.command** in the source distribution.

Exclude `.astra/`, `.env`, keys, task databases, assets, generated videos, logs, private screenshots and package archives. Bundled runtimes belong in release artifacts, not Git history.

The release package should bundle **Node 24 LTS** for macOS arm64/x64 after the runtime milestone validates Node 22.21+ and 24.x. Keep the complete app folder with its `runtime/` directory. Windows/Linux packaging is outside this iteration.

Suggested future archive names: `videogen-macos-universal.zip` and `videogen-source.zip`. The old `Start Sora2App.command` name is retired.

## Verify before publication

- Run `npm test` offline and confirm startup with `npm start` and the renamed macOS launcher.
- Confirm both READMEs describe the implemented version and list experimental or planned providers honestly.
- Check provider links, regions, onboarding requirements and the catalog date. Do not reuse expired promotional prices.
- Test mock generation/download, filename collisions, remote-ID recovery, history cleanup and all four UI languages with temporary directories.
- Phase 1 publication additionally requires the crash/restart acceptance suite, proxy verification and a queue UI refresh/recovery smoke test. Do not advertise those results for phase 0.
- Inspect the staged diff and archive contents for keys, personal paths, private task data and media. Do not publish raw runtime logs or `.astra/` evidence.
- Confirm the LICENSE remains MIT and provider terms are documented separately.

Version 1.1.0's description should say **sequential queue with durable task records and manual recovery**. Tags, release creation, binaries and repository metadata are maintained separately by the owner.
