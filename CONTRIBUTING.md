# Contributing

videogen is a local, MIT-licensed AI video workbench. Read [the architecture](docs/ARCHITECTURE.md) and the relevant [provider contract](docs/providers/) before changing request or job behavior.

## Development

Use Node.js 18 or newer for the current 1.1.0 baseline. The next runtime milestone validates Node 22.21+ and Node 24 LTS.

```bash
npm test
VIDEOGEN_DEV=1 npm start
```

No install or build step is needed. Keep CommonJS, native HTML/CSS/JS, classic browser scripts and zero npm dependencies. Tests use `node:test` and `node:assert`, run offline and finish within 60 seconds. Use temporary data/output directories; never exercise a developer's real journal in tests.

## Changes and tests

Keep commits focused. Move existing helpers without behavior changes before modifying them. Follow the existing two-space indentation, double quotes, semicolons and `node:` built-in imports.

Protect the creation invariants: sync the submitting record before create, sync the remote ID immediately on return, and never automatically repeat a create whose outcome is unknown. Poll/download retries must not create videos. Add meaningful tests for persistence, faults and secrets when touching these boundaries.

Provider fields, model IDs, prices and limits need dated official sources. Mark unverified capabilities experimental; unknown prices must not become zero. Use mock servers for tests. A test suite must never need real credentials or spend provider credit.

All user-visible strings need Chinese, Japanese, English and Korean translations. Keep both READMEs and privacy notes synchronized. Preserve `file://` preview and first-frame fitting. Check the browser workflow when changing the UI; static ID and localization tests complement the browser check.

## Issues and pull requests

Include OS, browser, Node version, app version, provider, region and whether the issue occurs during create, polling, download or recovery. Use synthetic prompts and redacted errors. Do not attach keys, full personal paths, real task IDs, private media or task databases.

Do not add telemetry, update checks, a project-controlled cloud service or new dependency packages. Keep keys out of all persistent storage and fixtures. Output directories may occur in job records, but must not be saved as browser preferences.

Do not commit `runtime/`, `.env`, generated media, local logs, task data or release archives. Packaging and publication are maintainer actions; see the [launch checklist](docs/GITHUB_LAUNCH_CHECKLIST.md).
