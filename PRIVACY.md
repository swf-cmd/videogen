# Privacy Notes

videogen is a local tool with no telemetry, update checks, or project-controlled cloud service. The HTTP server binds only to 127.0.0.1. Requests go to your configured providers and their returned result locations; no external image hosting is used.

## Persisted data

Prompts, normalized parameters, first-frame image bytes, remote task IDs, provider/region/base URL, estimates, job status, output paths and output hashes now persist. The directory is `~/Library/Application Support/videogen/` on macOS, `${XDG_DATA_HOME:-~/.local/share}/videogen/` on Linux, and `%APPDATA%\videogen\` on Windows. `VIDEOGEN_DATA_DIR` overrides it. Directories use mode 0700 and data files 0600 where supported.

Use **Clear history and assets** to remove terminal job records and unreferenced images. Jobs needing review and unfinished work remain so paid tasks cannot silently disappear. Generated videos are retained; delete them using your file manager. Clearing history compacts the journal; OS backups and storage-level recovery are outside this app's control.

## Keys

Keys exist only in the service process and the active browser form. They are never written to disk, browser storage, URLs, logs or responses. Each key is bound to provider + region + base URL. Restarting the service forgets keys. Requests to presigned result URLs omit credentials; explicitly authenticated downloads must start on the lane origin and redirects never inherit credentials. HTTP endpoints outside loopback may expose plaintext keys; the UI warns before submission.

Nonsecret UI preferences may be stored in localStorage. Keys and output directories are excluded. Prompt and image data are sent to the chosen provider only when submitted. Provider retention and terms apply independently.

Before sharing screenshots or issue reports, remove keys, private prompts/media, remote IDs and personal paths. Home-directory paths displayed by the app are shortened to `~`.
