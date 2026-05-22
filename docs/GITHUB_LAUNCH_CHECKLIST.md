# GitHub Launch Checklist

Use this checklist before sharing the repository publicly.

## Repository Metadata

Description:

```text
Local web UI for OpenAI Sora 2 / Sora 2 Pro video generation with Batch API and automatic MP4 downloads.
```

Topics:

```text
sora, sora-2, openai, openai-api, video-generation, ai-video, batch-api, nodejs, macos, local-first
```

Website:

```text
https://github.com/swf-cmd/videogen#readme
```

## Social Preview

Use `docs/social-preview.svg` as the privacy-safe source artwork, then export a 1280 x 640 PNG under 1 MB for GitHub's Social preview setting. It should show:

- The real workbench structure: generation settings on the left, task status on the right.
- The Standard API / Batch API mode switch.
- The basic flow: prompt to video, track progress, save MP4.
- Privacy-safe sample data only.

Avoid screenshots that show:

- API keys.
- Full local paths.
- Private prompts.
- Video IDs or Batch IDs.
- Personal account names or email addresses.

## Files to Keep in Source

- `README.md`
- `README.zh-CN.md`
- `LICENSE`
- `SECURITY.md`
- `PRIVACY.md`
- `CONTRIBUTING.md`
- `package.json`
- `server.js`
- `public/`
- `Start Sora2App.command`

## Files to Keep Out of Source

- `runtime/`
- `.DS_Store`
- `.env`
- generated MP4/MOV files
- local logs
- release zip files

## First Release

Suggested tag:

```text
v1.0.0
```

Suggested title:

```text
Sora2App v1.0.0
```

Suggested assets:

- `sora2app-macos-universal.zip`
- `sora2app-source.zip`

Suggested release notes:

```markdown
## Highlights

- Local web UI for OpenAI Sora 2 / Sora 2 Pro video generation.
- Standard Video API and Batch API modes.
- Automatic polling and MP4 downloads.
- Built-in Chinese, Japanese, English, and Korean UI.
- API key is not saved to disk, localStorage, or logs.

## Install

Download `sora2app-macos-universal.zip`, unzip it, and double-click `Start Sora2App.command`.

If macOS warns about downloaded files, open the app folder from a trusted location and keep the whole folder together, including `runtime/`.

## Privacy

Before sharing screenshots or issue logs, remove API keys, full local paths, private prompts, video IDs, Batch IDs, and generated files that should not be public.
```

## Final Privacy Pass

Run these checks before publishing:

```bash
rg -n "sk-|OPENAI_API_KEY|Authorization|Bearer |/Users/|mailto:|@gmail|@icloud|@qq|@163" --glob '!docs/GITHUB_LAUNCH_CHECKLIST.md' .
rg --files -g ".env*" -g "*.mp4" -g "*.mov" -g "*.log" -g ".DS_Store"
```

If the search returns real secrets or private files, remove them before pushing.
