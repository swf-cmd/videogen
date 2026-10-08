# Privacy notes

videogen 2.1.2 runs locally. It has no telemetry, update checks, project-operated cloud service or npm runtime dependencies. The HTTP server listens only on `127.0.0.1`. Submitting work sends prompts, model parameters and optional first-frame images to the provider, region and endpoint you selected. Provider-side retention and account terms apply independently.

## Data saved on this computer

The persistent queue stores:

- Per-task first and last frames, gallery Keep/Reject decisions, and links between explicitly confirmed regeneration takes. CSV/template rows are expanded locally before submission; the expanded prompts and task parameters enter the normal job journal.

- Prompts, normalized parameters and first-frame image bytes.
- Provider, region, base URL, model, local IDs, remote task IDs and recovery URLs.
- Job/batch states, timestamps, attempts, budget estimates, cancellation/review decisions and classified errors.
- Intended and actual output paths, sizes, content types and hashes.
- Nonsecret lane concurrency and pause preferences, catalog overrides and cached public model metadata.

The default directory is `~/Library/Application Support/videogen/` on macOS, `${XDG_DATA_HOME:-~/.local/share}/videogen/` on Linux, or `%APPDATA%\videogen\` on Windows. `VIDEOGEN_DATA_DIR` overrides it.

| File | Contents |
| --- | --- |
| `jobs.ndjson` / `jobs.snapshot.ndjson` (legacy: `jobs.snapshot.json`) | Queue event journal and compacted task/batch records |
| `assets/` | Content-addressed first-frame images needed after restart |
| `settings.json` | Nonsecret lane configuration |
| `catalog.local.json` | Optional user model/region/pricing overrides |
| `openrouter-models.cache.json` | Public model metadata from an explicit refresh |
| `lock` | PID and a hashed process creation identity preventing concurrent dispatch from the same data directory; no command line or executable path |

Directories use mode 0700 and data files 0600 where supported. These files are not encrypted by videogen. Other processes with the same account's access, operating-system backups and disk-recovery tools are outside this boundary. Result/recovery URLs may grant access to generated media while valid; treat the task store as private. Credentials entered through the key form are not persisted; user-authored text is preserved verbatim, including any secret the user places in a prompt.

Source downloads default to `~/Downloads/videogen` or your chosen directory. Portable bundles store their records and default downloads in `portable-data/` and `portable-output/` beside the application. The local gallery streams only completed recorded output files and supports seeking; it does not upload previews. Provider bytes, embedded metadata and generation labels are preserved without transcoding. Job-specific `.part` files can exist during a download or after process interruption. Startup recovery reconciles published files and their known markers; it does not delete arbitrary files in your output directory.

## Clearing data

The journal compacts automatically as it grows; compaction retains all task history and is not deletion. Model configuration is shared by references rather than copied into every new record. Old JSON snapshots remain readable; their first load still uses the legacy whole-file parser before later compaction writes streaming NDJSON.

**Clear history and assets** removes finished job records and unused images, then compacts the journal. Unfinished jobs and `needs_review` records remain so possibly paid work is not silently forgotten. Downloaded videos remain; delete them separately in your file manager. Clearing history does not remove provider-side records, backups or storage-level recoverable copies.

To remove all local app data manually, first stop the service and inspect any outstanding or review jobs. Removing their records loses the information needed to track already submitted work. Provider tasks and charges do not disappear when local data is deleted.

## Keys, browser preferences and live updates

Keys exist in service memory and transiently in the active browser form/request. Each key belongs to a lane: provider + region + base URL. Stopping the service forgets it; pending work shows `needs_key` until the required key is entered again. Credential fields are excluded from job data, settings, browser storage, URLs, logs, SSE payloads and API responses. Validated keys of at least 16 characters are registered for provider-response redaction; short local placeholders are never used to rewrite user prompts, paths or endpoints. Key-list responses report presence only, not a suffix. Known secrets and sensitive authorization-header values are redacted from errors.

The browser stores nonsecret `videogen.*` preferences and performs a one-time migration of applicable `sora2app.*` values. Stored language, provider, model, duration, resolution, aspect ratio and repeat count may remain until browser storage is cleared. Keys and output-directory preferences are removed/excluded. A job's output path is still part of its persistent record.

The queue API and SSE stream deliver local task information to the browser; closing the browser does not cancel service-side work. The app does not sync that information to a project-operated server. Displayed home paths use `~`, but shortened paths and task IDs may still be sensitive.

## Provider and proxy traffic

API credentials go only to the selected lane origin. Presigned media downloads omit API credentials; authenticated media downloads begin on that origin, and redirects strip credentials. Prompt/image submission, explicit model-list refresh and result downloads are the app's provider traffic. There is no third-party image-host upload. Gemini first frames are uploaded to its Files API; temporary remote image references are cached only in memory and expire. They can be uploaded again after restart. This app does not delete those remote Files resources; provider retention applies.

When environment proxy variables are configured, Node routes eligible requests through that proxy. Loopback endpoints always bypass it. The UI exposes only redacted proxy addresses; proxy URL usernames/passwords and known secret strings are redacted in reported errors. Proxy credentials remain in the process environment and are not persisted by videogen. Your proxy operator may observe connection metadata; HTTPS protection also depends on your local trust configuration. Use HTTPS for remote provider endpoints, because plain HTTP does not protect credentials or content in transit.

Before sharing screenshots, bug reports or diagnostic files, remove keys, proxy credentials, private prompts/images/videos, remote IDs, result URLs and personal paths. Never upload a real task data directory to a public issue.
