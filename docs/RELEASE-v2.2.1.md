# videogen v2.2.1 — Language-switch status fixes

Switching the interface language now immediately updates the form, render-queue and review-dialog status lines and the API-key placeholder. These could previously remain in the old language, including the "Local service ready" message. Messages returned by the local service retain the language used for that request.

This release also includes the refreshed English, Chinese, Japanese and Korean READMEs and the updated 2.2 workflow demonstration.

## Downloads and upgrade

- `videogen-2.2.1-windows-x64.zip`
- `videogen-2.2.1-macos-universal.zip` (Apple Silicon and Intel)
- Matching `.zip.sha256` files

Both bundles include Node v24.21.0 LTS. Stop the previous service, preserve its data and output directories, and re-enter provider keys after upgrading. Existing records remain compatible.

The release workflow runs offline tests on Linux and Windows with Node 22.21.0 and 24.21.0, crash acceptance, packaging checks and native launcher smoke tests on Windows, Apple Silicon and Intel Mac. The published ZIPs are the exact artifacts retained by the successful tag workflow. No paid provider calls are made for these checks.

See the [changelog](https://github.com/swf-cmd/videogen/blob/v2.2.1/CHANGELOG.md).
