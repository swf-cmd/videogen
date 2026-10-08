# videogen v2.1.1 — Reliable queues and portable startup

This maintenance release fixes data corruption from short local API-key placeholders and improves recovery of already accepted video work.

- **Preserve task data:** rejected keys never enter the secret registry. Short placeholders cannot rewrite prompts, endpoints, paths or IDs. Provider-response redaction preserves credential protection.
- **Keep paid work tracked:** quota/model pauses and submission circuits leave accepted jobs polling and downloading. Temporary connection problems retry, and circuits probe after cooldown.
- **Keep batch controls reliable:** entered budgets survive estimate refreshes; reconnecting event streams refresh state without replacing focused controls. Large normal-batch estimates return bounded summaries.
- **Reduce journal overhead:** automatic compaction, shared model metadata and streaming NDJSON snapshots avoid repeating whole model configurations and loading entire new journals as one string.
- **Explain failures:** provider codes and messages remain available; output directories and filenames are checked before submission. Fatal queue failures reject new batches. Startup preserves damaged records and explains the absolute recovery directory and backup options; health and startup responses use the correct status and language.
- **Handle storage and process edge cases:** Windows compaction retries temporary rename failures without dropping journal appends. Data locks and reclaim markers identify the owning process's creation instance, allowing verified PID reuse to recover stale ownership; unavailable identity checks remain conservative.
- **Improve import and polling:** pagination survives event refreshes; CSV imports handle semicolon/case-insensitive headers and literal templates. Image matching normalizes Unicode, sorts naturally and preserves manual choices. Unchanged polls avoid duplicate journal records, and recovered Gemini Files addresses stay durable.
- **Limit exposed metadata:** external model lists retain only display fields. Short proxy passwords are redacted in diagnostic text without changing schema or user content.
- **Improve startup and shutdown:** Windows and macOS launchers use IPC for graceful service shutdown. Windows source startup keeps version-check errors visible and preserves the error code; automated runs can set `VIDEOGEN_NO_PAUSE=1`.
- **Ship the tested files:** tracked-file allowlisting, fixed launcher line endings and stable ZIP ordering make builds consistent. Tagged releases use the exact native-tested CI archives and verify their checksums before attaching them to a draft Release.

## Downloads

- `videogen-2.1.1-windows-x64.zip`
- `videogen-2.1.1-macos-universal.zip` (Apple Silicon and Intel)
- One matching `.zip.sha256` file for each archive

Each ZIP includes pinned official Node v24.21.0 LTS, its license notices and a runtime integrity manifest. Extract the entire archive before starting. The bundles are not signed/notarized installers; first-open operating-system confirmation may be required. Source startup requires Node `^22.21.0 || >=24.5.0` and no dependency installation.

## Upgrade and recovery

Stop the old service and back up its data and outputs before upgrading. Portable installations keep records in `portable-data/` and videos in `portable-output/`; existing job output paths are absolute, so finish active jobs before moving those folders. Re-enter lane keys after restart.

Old JSON snapshots remain readable and are converted by later compaction. Their initial read still uses the legacy whole-file parser; the live job index continues to grow with retained history. Automatic compaction retains history rather than deleting it.

This release cannot reconstruct text already replaced with `[REDACTED]` by earlier versions. Preserve damaged records, restore known-good backups or repair verified original values, and check the provider's task records before resubmitting uncertain work. Known or possibly paid tasks must not be silently discarded or recreated. Data and output directories must support hard links; use local system-disk folders instead of exFAT.

## Verification and limits

Unit, crash-acceptance and portable-launcher checks use local fixtures without paid provider calls. CI covers minimum Node 22.21 and Node 24, Windows x64, Apple Silicon and Intel Mac. Record the successful tag run and verify the downloaded release checksums before publishing; source test success alone does not verify a native archive.

Provider prices, account permissions, result retention and invoices remain outside the application's control. Estimates are not billing guarantees. Ambiguous create requests can still require manual review.

See [portable setup](PORTABLE.md), [changelog](../CHANGELOG.md), [privacy](../PRIVACY.md) and the [publication checklist](GITHUB_LAUNCH_CHECKLIST.md).
