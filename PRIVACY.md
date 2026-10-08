# Privacy notes

videogen runs locally and has no telemetry, update checks or project-operated cloud service. Its HTTP server listens only on `127.0.0.1`. Submission sends prompts, model parameters and optional first-frame images to the provider and region you selected. Downloads may use that provider's returned storage/CDN URLs. Provider retention and account terms apply independently.

## Data saved on this computer

Starting with 1.1.0, videogen persists:

- Prompts, normalized parameters and first-frame image bytes.
- Provider, region, base URL, model, local and remote task IDs.
- Job states, timestamps, attempts, estimated costs and classified errors.
- Intended and actual output paths, file sizes, content types and hashes.

The default directory is `~/Library/Application Support/videogen/` on macOS, `${XDG_DATA_HOME:-~/.local/share}/videogen/` on Linux, or `%APPDATA%\videogen\` on Windows. `VIDEOGEN_DATA_DIR` overrides it. Job events use `jobs.ndjson`, compacted records use `jobs.snapshot.json`, and images use `assets/`. Catalog overrides and future nonsecret settings can also live there. Directories use mode 0700 and data files 0600 where supported. These files are not encrypted by videogen.

Downloaded videos default to `~/Downloads/videogen` or the directory you select. The application preserves provider bytes, embedded metadata and generation labels without transcoding or removing marks. Temporary `.part` files may exist during a download or after an interrupted process.

## Clearing data

**Clear history and assets** deletes finished job records and unreferenced images, then compacts the journal. Unfinished jobs and `needs_review` records are retained to avoid losing track of possibly paid work. Generated videos are retained; delete them separately in your file manager. This operation does not delete provider-side data, operating-system backups or storage-level recoverable copies.

## Keys and browser preferences

Keys exist in the service's memory and transiently in the active browser form/request. A key belongs to one lane: provider + region + base URL. Stopping the service forgets it. Keys are not written to job data, settings, browser storage, URLs, application logs or API responses. Known secrets, sensitive authorization headers and proxy credentials are redacted from reported errors.

Presigned downloads omit credentials. Downloads that require authentication must start on the lane origin, and redirects do not inherit credentials. Use HTTPS for remote endpoints: plain HTTP does not protect data in transit.

The browser stores nonsecret preferences under `videogen.*` and migrates applicable old `sora2app.*` preferences once. Keys and output-directory preferences are excluded. A job's output path is nevertheless persisted as part of its record. Language, model and parameter selections can remain in localStorage until cleared through browser settings.

Displayed home paths are shortened to `~`. Before sharing screenshots or reports, remove keys, private prompts/images/videos, task IDs and personal paths. A shortened path is still potentially sensitive.
