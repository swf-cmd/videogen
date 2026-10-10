# videogen v2.3.0 — Slate and screening room

The interface now pairs a four-step composer with a dark screening room for the render queue and reviewed takes. A visible submission summary keeps the selected model, format, request count, frame and estimates beside the submit button. Existing generation, queue, review, settings and stored-data behavior remain compatible.

- Fold batch-import, output and lane settings until needed; show an introductory guide when the queue is empty and state bars for batches.
- Put videos first in the gallery, circle kept takes in yellow and dim rejected takes, with grouped Keep / Reject / Unreviewed controls.
- Add automatic dark mode, independently scrolling panes on wide screens, a pane switcher on narrow screens and reduced-motion support.
- Bundle the Archivo variable font under the SIL Open Font License and refresh the workflow recording, gallery screenshot and social preview.

## Downloads and upgrade

- `videogen-2.3.0-windows-x64.zip`
- `videogen-2.3.0-macos-universal.zip` (Apple Silicon and Intel)
- Matching `.zip.sha256` files

Both bundles include Node v24.21.0 LTS. Stop the previous service gracefully and back up the old folder before upgrading. For portable installations, preserve `portable-data/` and `portable-output/`; source installations keep their existing OS data directory and output location. Existing records remain compatible. Finish active jobs before moving output folders because stored job records retain absolute output paths. Provider keys stay in memory and must be entered again after restarting.

The release workflow runs offline tests on Linux and Windows with Node 22.21.0 and 24.21.0, crash acceptance, packaging checks and native launcher smoke tests on Windows, Apple Silicon and Intel Mac. The published ZIPs are the exact artifacts retained by the successful tag workflow. No paid provider calls are made for these checks. These portable ZIPs are not signed/notarized installers.

See the [changelog](https://github.com/swf-cmd/videogen/blob/v2.3.0/CHANGELOG.md).
