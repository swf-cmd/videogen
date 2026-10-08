# videogen v2.1.2 — Startup, recovery and queue synchronization

This maintenance release removes the Windows cold-start process query and makes recovery and queue maintenance more reliable.

- Normal startup records its own process lifetime without launching PowerShell or ps. Existing-lock conflicts alone may query another process; unverifiable ownership remains locked with an explicit message.
- Crash acceptance uses a realistic normal request timeout and explicit lost-response faults. Separate tests continue to verify that an accepted request with a missing response or a real timeout cannot be created again after restart. Duplicate-charge and untracked-job assertions remain strict.
- An explicit offline recovery command creates a separate data directory, retains original evidence and quarantines identifiable damaged records. Known remote IDs remain available for tracking; uncertain work requires manual review. Missing journal records and other ambiguous corruption stop recovery.
- Windows file-sharing errors defer log compaction with background backoff while appends continue to the verified original log. Held temporary snapshots do not accumulate on every retry. Genuine write failures still stop the queue.
- CSV frame references accept unique case-insensitive image matches, with exact matches taking priority. Ambiguous names never select an arbitrary frame.
- SSE reconnects synchronize immediately. Newer events and deletion markers are merged over stale snapshots, and the connection becomes ready only after synchronization succeeds.

## Downloads and upgrade

- `videogen-2.1.2-windows-x64.zip`
- `videogen-2.1.2-macos-universal.zip` (Apple Silicon and Intel)
- Matching `.zip.sha256` files

Both archives include official Node v24.21.0 LTS and license notices. Extract the entire archive. Stop the previous service, preserve its data/output directories and re-enter provider keys after upgrading. Existing output paths remain absolute.

If old short-key redaction already damaged records, see [data recovery](DATA_RECOVERY.md). The tool cannot reconstruct replaced text or determine what a provider charged. Review quarantined records in the provider console promptly, especially where result retention is limited. It never automatically resubmits uncertain work.

Native Windows, Apple Silicon and Intel CI builds test and retain the exact archives attached to the release. Tests use local fixtures and make no paid provider calls. See [portable setup](PORTABLE.md) and the [changelog](../CHANGELOG.md).
