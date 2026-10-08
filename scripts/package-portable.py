#!/usr/bin/env python3
"""Build byte-reproducible portable ZIPs with pinned, SHA-256-verified Node.

Maintainer tool only. Python 3.9+ and network access to nodejs.org are needed
when the cache is empty. End users do not need Python, Node, npm, or a network
connection to launch the packaged app. No package manager is invoked.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import stat
import tarfile
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
PIN = json.loads((ROOT / "scripts/node-runtime.json").read_text())
FILES = ["package.json", "server.js", "LICENSE", "PRIVACY.md", "SECURITY.md",
         "CONTRIBUTING.md", "CHANGELOG.md", "README.md", "README.zh-CN.md",
         "README.ja.md", "README.ko.md", "Start videogen.command", "Start videogen.cmd"]
TREES = ["src", "public", "data/catalog", "docs", "scripts"]
TARGETS = {"macos-universal": ["darwin-arm64", "darwin-x64"], "windows-x64": ["win-x64"]}


def sha256(file):
    digest = hashlib.sha256()
    with Path(file).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_runtime(target, cache):
    item = PIN["artifacts"][target]
    cache.mkdir(parents=True, exist_ok=True)
    archive = cache / item["filename"]
    if not archive.exists():
        print("Downloading " + item["url"], flush=True)
        partial = archive.with_suffix(archive.suffix + ".part")
        try:
            with urllib.request.urlopen(item["url"], timeout=120) as response, partial.open("wb") as output:
                shutil.copyfileobj(response, output)
            if sha256(partial) != item["sha256"]:
                raise ValueError("Runtime SHA-256 mismatch: " + item["filename"])
            partial.replace(archive)
        finally:
            partial.unlink(missing_ok=True)
    if sha256(archive) != item["sha256"]:
        raise ValueError("Cached runtime SHA-256 mismatch; remove " + str(archive))
    return archive


def install_runtime(target, cache, app):
    archive = fetch_runtime(target, cache)
    prefix = "node-" + PIN["version"] + "-" + target + "/"
    windows = target.startswith("win-")
    destination = app / "runtime" / ("node-" + target)
    destination.mkdir(parents=True)
    names = {"node.exe" if windows else "bin/node": "node.exe" if windows else "node", "LICENSE": "LICENSE"}
    # Read exact members only; never extract archive paths supplied by a server.
    with (zipfile.ZipFile(archive) if windows else tarfile.open(archive, "r:gz")) as source:
        for origin, name in names.items():
            if windows:
                data = source.read(prefix + origin)
            else:
                member = source.getmember(prefix + origin)
                if not member.isfile():
                    raise ValueError("Runtime member is not a regular file")
                data = source.extractfile(member).read()
            (destination / name).write_bytes(data)
            (destination / name).chmod(0o755 if name.startswith("node") else 0o644)
    return {**PIN["artifacts"][target], "target": target,
            "binarySha256": sha256(destination / ("node.exe" if windows else "node")),
            "licenseSha256": sha256(destination / "LICENSE")}


def copy_source(app):
    candidates = [ROOT / name for name in FILES]
    for tree in TREES:
        candidates.extend(sorted((ROOT / tree).rglob("*")))
    for source in candidates:
        if source.is_symlink():
            raise ValueError("Refusing source symlink: " + str(source))
        if source.is_dir():
            continue
        if source.name.startswith(".") or "__pycache__" in source.parts or source.suffix in {".pyc", ".log", ".zip"}:
            continue
        if not source.is_file():
            raise ValueError("Required release file missing: " + str(source))
        relative = source.relative_to(ROOT)
        destination = app / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        destination.chmod(0o755 if source.name.endswith(".command") else 0o644)


def zip_tree(app, output):
    # Fixed timestamps, modes, sorted paths and compression yield stable archives
    # for identical application bytes and Python/zlib versions, regardless of OS.
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in sorted(app.rglob("*")):
            if not file.is_file():
                continue
            member = zipfile.ZipInfo(file.relative_to(app.parent).as_posix(), (2000, 1, 1, 0, 0, 0))
            member.create_system = 3
            executable = file.name in {"node", "node.exe", "Start videogen.command"}
            member.external_attr = (stat.S_IFREG | (0o755 if executable else 0o644)) << 16
            member.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(member, file.read_bytes(), compresslevel=9)


def build(target, cache, output):
    version = json.loads((ROOT / "package.json").read_text())["version"]
    name = "videogen-" + version + "-" + target
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="videogen-package-") as temporary:
        app = Path(temporary) / name
        app.mkdir()
        copy_source(app)
        manifest = {"nodeVersion": PIN["version"], "lts": PIN["lts"],
                    "officialChecksums": PIN["source"], "runtimes": []}
        for runtime in TARGETS[target]:
            manifest["runtimes"].append(install_runtime(runtime, cache, app))
        (app / "RUNTIME-MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        (app / ".portable").write_text("videogen portable layout v1\n", encoding="utf-8")
        (app / "START-HERE.txt").write_text(
            "videogen " + version + "\n\n"
            "Extract the whole ZIP into a writable folder.\n"
            "Windows: double-click Start videogen.cmd.\n"
            "macOS: double-click Start videogen.command (Apple Silicon / Intel).\n"
            "Node is included; no installation or npm command is needed.\n"
            "Keep the terminal window open while work is running. Ctrl+C stops it.\n\n"
            "The first launch creates portable-data/ (private task records and images)\n"
            "and portable-output/ (default saved videos) next to this file. API keys\n"
            "stay in memory. Copy the entire folder for a backup. Job records contain\n"
            "absolute paths: finish queued jobs before moving this folder.\n\n"
            "Starting the app is free. Sending generation jobs may cost provider credit.\n"
            "No provider API is called until you choose and confirm an operation.\n\n"
            "macOS may require Privacy & Security > Open Anyway for a downloaded app.\n"
            "The bundle is not notarized. See docs/PORTABLE.md before first use.\n"
            "Runtime source, SHA-256 hashes and licenses: RUNTIME-MANIFEST.json, runtime/.\n",
            encoding="utf-8")
        destination = output / (name + ".zip")
        partial = destination.with_suffix(".zip.part")
        try:
            zip_tree(app, partial)
            partial.replace(destination)
        finally:
            partial.unlink(missing_ok=True)
    digest = sha256(destination)
    destination.with_suffix(".zip.sha256").write_text(digest + "  " + destination.name + "\n", encoding="utf-8")
    print(str(destination) + "  " + digest, flush=True)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", choices=[*TARGETS, "all"], default="all")
    parser.add_argument("--output", type=Path, default=ROOT / "dist")
    parser.add_argument("--cache", type=Path, default=ROOT / "work/runtime-cache")
    parser.add_argument("--download-only", action="store_true")
    args = parser.parse_args()
    selected = list(TARGETS) if args.target == "all" else [args.target]
    for target in selected:
        if args.download_only:
            for runtime in TARGETS[target]:
                fetch_runtime(runtime, args.cache.resolve())
        else:
            build(target, args.cache.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
