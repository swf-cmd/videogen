# Contributing

videogen is a local, MIT-licensed AI video render queue. Read [the architecture](docs/ARCHITECTURE.md) and the relevant [provider contract](docs/providers/) before changing request or job behavior.

## Development

Use Node.js 22.21+ within the 22.x line, or Node.js 24.5+. The engine range is `^22.21.0 || >=24.5.0`; Node 23 and Node 24.0–24.4 are unsupported. Maintainers should bundle Node 24 LTS in macOS release packages; packaging is a separate release step.

```bash
npm test
npm run test:e2e
VIDEOGEN_DEV=1 npm start
```

No install or build step is needed. Keep CommonJS, native HTML/CSS/JS, classic browser scripts and zero npm dependencies. Tests use `node:test` and `node:assert`; `npm test` must run offline and finish within 60 seconds. Use temporary data/output directories; never exercise a developer's real journal in tests.

`npm run test:e2e` is a separate offline acceptance suite with 100 jobs, two lanes, independent provider accounting, injected throttling/lost responses, three process crashes and SSE disconnects. Run it for queue, persistence, output or recovery changes and before a release. `npm start` uses Node's native `--use-env-proxy`; validate proxy routing and `NO_PROXY` on both supported runtime lines when changing runtime or network behavior. Localhost and 127.0.0.1 must always bypass the proxy.

## Changes and tests

Keep commits focused. Move existing helpers without behavior changes before modifying them. Follow the existing two-space indentation, double quotes, semicolons and `node:` built-in imports.

Protect the creation invariants and test them at the relevant fault boundaries:

| Invariant | Required behavior |
| --- | --- |
| I1 | Persist `submitting` and increment `attempts.create`, then fsync before calling create. |
| I2 | Persist and fsync the returned remote ID before any further await. |
| I3 | After restart, a submitting job without an ID becomes `needs_review`, unless the adapter has a documented idempotency guarantee. |
| I4 | Retry create automatically only with evidence that it was not accepted, such as a definite throttling rejection. Timeouts after sending, resets, 5xx, malformed responses and missing IDs are uncertain outcomes. |
| I5 | Retry poll/download with bounded backoff; neither path may call create. |
| I6 | Retry failed jobs only when nonacceptance is established. For `needs_review`, require an explicit choice to resubmit with a duplicate-charge warning, abandon, or associate a remote ID. |
| I7 | Never automatically send a second potentially accepted create for a job. Only the user's explicit resubmission permits another attempt after an uncertain outcome. |

Definite nonacceptance retries are distinct from duplicate paid creates. Do not infer idempotency from a generic HTTP retry recommendation. Add meaningful crash, persistence and secret-leak tests when touching these boundaries. A browser disconnect must not stop the queue; a service restart must forget keys and wait for their re-entry before authenticated work resumes.

Provider fields, model IDs, prices and limits need dated official sources. Mark unverified capabilities experimental; unknown prices must not become zero. Use mock servers for tests. A test suite must never need real credentials or spend provider credit.

The included provider families are OpenAI-compatible servers, OpenRouter, Gemini, DashScope and Ark. Keep regional model/key boundaries and documented exceptions intact: Gemini Omni uses stored background interactions and bounded SSE recovery, OpenRouter local first frames use the adapter’s supported image encoding, and the included Seedance 2.5 models do not expose seed. Changes to these decisions require new official evidence and contract tests.

All user-visible strings need Chinese, Japanese, English and Korean translations. Keep both READMEs and privacy notes synchronized. Preserve `file://` preview and first-frame fitting. Check the browser workflow when changing the UI; static ID and localization tests complement the browser check.

## Issues and pull requests

Include OS, browser, Node version, app version, provider, region and whether the issue occurs during create, polling, download or recovery. Use synthetic prompts and redacted errors. Do not attach keys, full personal paths, real task IDs, private media or task databases.

Do not add telemetry, update checks, a project-controlled cloud service or new dependency packages. Keep keys out of all persistent storage and fixtures. Output directories may occur in job records, but must not be saved as browser preferences.

Listen only on `127.0.0.1`, retain Host/Origin and path traversal checks, keep GET/HEAD read-only, and add no CORS headers. Scope keys to their provider/region/base URL; never put them in URLs or forward them to external result hosts. Redact proxy credentials too. Preserve original output bytes and metadata, stream downloads to partial files, and publish without overwriting an existing file. Keep task records, first frames, local data retention and cleanup accurately disclosed.

Do not commit `runtime/`, `.env`, generated media, local logs, task data or release archives. Packaging and publication are maintainer actions; see the [launch checklist](docs/GITHUB_LAUNCH_CHECKLIST.md).
