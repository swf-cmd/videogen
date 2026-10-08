# Portable Windows and macOS bundles

The release artifacts are `videogen-2.1.0-windows-x64.zip` and `videogen-2.1.0-macos-universal.zip`. The macOS archive includes separate native Apple Silicon and Intel executables; the launcher selects the matching one. Both archives include the application, Node **v24.21.0 LTS**, its third-party license notices and a runtime integrity manifest. No Node, Python or npm installation is needed to use a bundle.

1. Extract the **entire ZIP** into a writable folder, such as Documents. Do not start it inside the archive viewer or a read-only disk image.
2. On Windows, double-click **Start videogen.cmd**. On macOS, double-click **Start videogen.command**. A terminal opens, starts the local service and opens the browser.
3. Keep that terminal open while jobs are running. Press **Ctrl+C** to stop gracefully; allow up to 15 seconds for in-flight work to be recorded. Reopen the launcher and re-enter provider keys to resume known jobs.

Launching, reviewing local data and running offline tests do not spend provider credit. Generation, including a confirmed regeneration, may be billed by the provider. This project has no subscription or bundled credits.

## First-open operating-system checks

These community ZIPs are not signed/notarized application installers. macOS can block a downloaded command until you allow it in **System Settings → Privacy & Security → Open Anyway**; Windows can display a downloaded-script warning. Verify the release checksum and source before allowing the launcher. The launcher does not disable Gatekeeper, remove quarantine attributes, change trust settings or download another executable. See [Apple's first-open instructions](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac).

The bundled Node version's official OS support applies: [Node platform support](https://github.com/nodejs/node/blob/v24.21.0/BUILDING.md#platform-list). The Windows bundle targets x64; ARM Windows and Linux do not have dedicated bundles in this release. macOS bundles contain both architectures but are not Apple `.app` bundles.

## Data, output and upgrades

| Path inside the extracted app | Contents |
| --- | --- |
| `portable-data/` | Private prompts, images, job history, estimates, nonsecret settings and lock files |
| `portable-output/` | Default saved videos |
| `runtime/` | Bundled official Node executables and licenses |
| `RUNTIME-MANIFEST.json` | Original Node archive URLs and pinned hashes; extracted executable and license hashes |

The data and output directories must support hard links. exFAT USB drives are not supported for these directories: extract to a local system disk, or set `VIDEOGEN_DATA_DIR` and `VIDEOGEN_OUTPUT_DIR` to writable folders on NTFS/APFS or another filesystem supporting hard links. Output directories are checked before a batch is accepted.

API keys live only in the running service's memory. `VIDEOGEN_DATA_DIR` and `VIDEOGEN_OUTPUT_DIR` override the two data locations. Source startup retains the normal OS data directory and `~/Downloads/videogen` defaults. HTTP/HTTPS proxy environment variables work the same way in both modes; loopback traffic always bypasses the proxy.

To upgrade, stop the service, back up the entire old folder, extract the new ZIP, and copy `portable-data/` and `portable-output/` into the new folder. Finish active jobs before moving folders: existing job records contain absolute output paths, and changing the default only affects new jobs. Old JSON snapshots are read for compatibility; automatic compaction writes the newer streaming NDJSON format with shared model metadata. Do not merge journals from different running copies. Never share a ZIP repacked from your used application folder; it can contain private records and images.

This update prevents new key-substring corruption; it cannot infer text already replaced with `[REDACTED]` by older releases. Stop the old service and back up its data before upgrading. If startup rejects an already-damaged record, restore a known-good backup or repair it using verified original values. Check remote provider jobs before resubmitting uncertain work.

`PORT` changes the local port; if unset the launcher searches from 5177 when that port is occupied. `OPEN_BROWSER=0` suppresses browser opening for automated smoke tests. A second service cannot share the same data directory even with another port. The bundled launcher fails if its bundled runtime is missing; it never silently uses a machine-wide Node installation.

## Maintainer builds

From a source checkout, with Python 3.9+:

```bash
python3 scripts/package-portable.py --target all --output dist --cache work/runtime-cache
python3 scripts/smoke-portable.py dist/videogen-2.1.0-macos-universal.zip
```

On Windows use `python` and smoke-test the Windows archive. The packaging script downloads only three pinned archives from the [official Node distribution](https://nodejs.org/dist/v24.21.0/), validates their SHA-256 values against the checked-in `scripts/node-runtime.json`, and copies only the executable and its complete license notices. To update Node, independently check the [official release index](https://nodejs.org/download/release/index.json) and versioned `SHASUMS256.txt`, review the new pins, then rebuild and rerun platform tests.

Packaging requires a Git checkout and copies only Git-tracked files under the explicit source allowlist. Untracked or ignored catalog JSON, credentials, scratch files, journals, caches and outputs are excluded. Text is normalized to LF, except Windows `.cmd` launchers which use CRLF; generated manifests and checksums also use fixed LF endings. ZIP entries have sorted paths, fixed timestamps and permissions. Identical source/runtime bytes and Python/zlib versions produce identical archives; the generated adjacent `.zip.sha256` files verify the final download. No package manager, signing service or paid video API is used during builds or smoke tests.

The `Portable bundles` workflow runs for all pull requests, pushes to `main`, release tags and manual dispatches. Unit and crash-acceptance tests run with Node 22.21.0 and 24.21.0 on Linux and Windows; portable bundles are built and smoke-tested on Windows x64, macOS Apple Silicon and macOS Intel. Tag builds retain the exact tested Windows and Apple Silicon-built universal archives for three days, verify their checksums and upload them to a draft GitHub Release. The release job never rebuilds the ZIPs on Linux. Publishing the draft is a maintainer action. OS testing status must be reported from the actual run, not inferred from a successful build on another OS.
