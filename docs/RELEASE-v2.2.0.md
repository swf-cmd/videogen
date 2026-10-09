# videogen v2.2.0 — Takes, keyboard review and queue safety fixes

This release turns the gallery into a fast review loop and fixes queue edge cases found in a full audit of v2.1.4. Several of them could hang the service or dispatch paid creates the user had stopped.

## Review workflow

- **Takes per prompt (1–20).** Every prompt or CSV row is rendered several times for comparison. Estimates, confirmations and budgets count every take; files get `-t1`, `-t2`… suffixes.
- **Keyboard review grouped by shot.** J/K or arrow keys move, Space plays, 1 keeps, 2 rejects, 3/U resets; Keep/Reject jumps to the next unreviewed take. Cards show their first frame and "Shot N · Take M".
- **Export kept takes.** CSV or JSON manifest with absolute paths, prompts, model settings, shot/take, estimated costs, remote IDs and SHA-256, for editors and handoff.
- **Stop tracking** a running job whose remote task is gone, with an explicit note that this does not cancel or refund remote work.
- Optional desktop notifications, readable batch labels, and a phone layout where every job action is reachable.

## Fixes that affect paid work

- Re-entering a key after an authentication error could freeze the whole service; it now returns immediately and no longer lifts manual or quota pauses.
- A job cancelled during an in-flight create that was then rejected (for example rate-limited) was created again later; it now stays cancelled.
- Clear history could re-arm a batch budget and delete frames of an import being saved; both are fixed. Over-budget regenerations are refused up front.
- Large downloads on slow links failed after five minutes of transfer; the limit now applies to inactivity. One 4xx from a CDN no longer discards a paid render, and a presigned-URL 403 no longer stops the whole lane.
- Retry/resubmit inside a cancelled batch now runs; an absurd Retry-After no longer stops the scheduler; an unreadable old output folder no longer blocks startup.

## Providers

- OpenRouter Seedance estimates now use OpenRouter's published token formula (height × width × seconds × 24 / 1024).
- OpenRouter app-attribution headers are sent (no user data); set `VIDEOGEN_OPENROUTER_ATTRIBUTION=0` to disable.
- Veo 3.1 preview models leave the Gemini API on 2026-10-22; use Gemini Omni directly or Veo through OpenRouter.

## Downloads and upgrade

- `videogen-2.2.0-windows-x64.zip`
- `videogen-2.2.0-macos-universal.zip` (Apple Silicon and Intel)
- Matching `.zip.sha256` files

Stop the previous service, keep its data and output directories, and re-enter provider keys after upgrading. Existing records are compatible; older jobs simply have no shot/take labels.

Tests use local fixtures and make no paid provider calls. See the [changelog](../CHANGELOG.md).
