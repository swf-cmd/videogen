# videogen v2.1.0 — From prompts to selected takes

videogen 2.1 adds a local batch preparation and selection workflow: give every shot its own frame inputs, import structured prompts, inspect costs before submission and preview finished videos in a gallery.

- **No-install packages:** Windows x64 and macOS universal ZIPs include pinned official Node 24 LTS, integrity manifests and runtime license notices. Extract, double-click, keep the terminal open. Portable data and outputs stay beside the application.
- **Per-job frames:** set a different first frame for each job and a last frame when supported by that model. Unsupported combinations are rejected before dispatch.
- **CSV, templates and image folders:** expand variables, match image inputs, and review row-level validation and estimates before confirming the batch.
- **Gallery selection:** play local results, keep or reject takes, and see estimated batch spending per kept clip. Regeneration creates a new job only after a separate explicit confirmation.
- **Gemini background mode:** save the interaction ID before polling and resume known interactions after restart and key re-entry. A lost create response before receiving the ID can still require manual review.
- **OpenRouter frame inputs:** convert local images to data URLs in `frame_images` for models whose catalog declares support. Controls, validation and pricing follow the current `/videos/models` response.
- **Documentation:** Japanese and Korean READMEs, a Sora 2 migration guide, portable build instructions and a clearly labeled offline workflow recording.

## Downloads

- `videogen-2.1.0-windows-x64.zip`
- `videogen-2.1.0-macos-universal.zip` (native arm64 and x64 Node executables)
- Matching `.zip.sha256` files

These ZIPs are community bundles, not notarized installers; the operating system may require first-open confirmation. Windows ARM and Linux dedicated bundles are not included. Source users can continue to run `npm start` with Node `^22.21.0 || >=24.5.0` and no dependency installation.

## Upgrading and limits

Stop the old service and back up its records and downloads. For portable upgrades, copy `portable-data/` and `portable-output/` to the new extracted folder; finish active jobs before moving because existing output paths are absolute. Source installations retain the previous OS data location. Keys are not stored and must be re-entered after restart.

Estimates are not provider invoices. Unknown costs stay unknown, currencies remain separate, and Gemini video-output estimates can omit input/thinking charges. A kept-clip cost includes unsuccessful and discarded attempts where charges are known or possible; it is not a promised price for a successful generation. Region, account and model restrictions still apply. Old Sora Batch jobs cannot be converted into another provider's jobs.

## Verification

Unit, provider-contract, restart/crash and browser checks use local fixtures without paid video calls. The README recording demonstrates the UI; its sample is an offline playback fixture, not a generated model-quality sample. Do not infer live provider acceptance from these checks. Record the actual Windows, Intel Mac and Apple Silicon smoke-test results in the release checklist before publication; building an archive alone is not an OS test.

See [portable setup](PORTABLE.md), [migration](MIGRATING_FROM_SORA.md), [changelog](../CHANGELOG.md) and [provider contracts](providers/).
