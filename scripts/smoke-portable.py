#!/usr/bin/env python3
"""Extract and launch a portable ZIP using no global Node, keys or provider calls."""
import argparse
import json
import os
from pathlib import Path
import platform
import signal
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import zipfile


def stop_windows_launcher(service, env):
    try:
        service.send_signal(signal.CTRL_BREAK_EVENT)
        return
    except OSError:
        if service.poll() is not None:
            return
    # Headless Windows runners may not have an attached console, in which case
    # GenerateConsoleCtrlEvent fails. Terminate only cmd's Node launcher, never
    # its detached service: the closed IPC pipe must let that service drain.
    powershell = Path(env.get("SystemRoot", env.get("SYSTEMROOT", "C:\\Windows"))) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    query = '(Get-CimInstance Win32_Process -Filter "ParentProcessId=%d" | Where-Object {$_.Name -eq "node.exe"}).ProcessId' % service.pid
    result = subprocess.run([str(powershell), "-NoProfile", "-NonInteractive", "-Command", query],
                            capture_output=True, text=True, check=True, timeout=15, env=env)
    launchers = [int(value) for value in result.stdout.split() if value.isdecimal()]
    if not launchers:
        if service.poll() is not None:
            return
        raise AssertionError("Cannot locate the launcher for the IPC disconnect check")
    for pid in launchers:
        subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True,
                       check=True, timeout=10, env=env)
    print("Console signal unavailable; checking shutdown through launcher IPC disconnect.")


def smoke(archive):
    with tempfile.TemporaryDirectory(prefix="videogen portable smoke ") as temporary:
        root = Path(temporary)
        with zipfile.ZipFile(archive) as package:
            for member in package.infolist():
                relative = Path(member.filename)
                if relative.is_absolute() or ".." in relative.parts:
                    raise ValueError("Unsafe archive path")
                package.extract(member, root)
                destination = root / relative
                if not member.is_dir():
                    destination.chmod((member.external_attr >> 16) & 0o777)
        apps = list(root.glob("videogen-*"))
        assert len(apps) == 1, "Expected one app folder"
        app = apps[0]
        manifest = json.loads((app / "RUNTIME-MANIFEST.json").read_text())
        assert (app / ".portable").is_file()
        import hashlib
        for runtime in manifest["runtimes"]:
            directory = app / "runtime" / ("node-" + runtime["target"])
            node = directory / ("node.exe" if runtime["target"].startswith("win") else "node")
            assert hashlib.sha256(node.read_bytes()).hexdigest() == runtime["binarySha256"]
            assert hashlib.sha256((directory / "LICENSE").read_bytes()).hexdigest() == runtime["licenseSha256"]
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        env = {name: value for name, value in os.environ.items()
               if "proxy" not in name.lower() and "key" not in name.lower()
               and not name.startswith("VIDEOGEN_") and name not in {"NODE_OPTIONS", "NODE_USE_ENV_PROXY"}}
        env.update({"PORT": str(port), "OPEN_BROWSER": "0"})
        windows = platform.system() == "Windows"
        if windows:
            env["PATH"] = str(Path(env.get("SystemRoot", env.get("SYSTEMROOT", "C:\\Windows"))) / "System32")
            command = [str(Path(env["PATH"]) / "cmd.exe"), "/d", "/c", str(app / "Start videogen.cmd")]
        else:
            env["PATH"] = "/usr/bin:/bin:/usr/sbin:/sbin"
            command = ["/bin/zsh", str(app / "Start videogen.command")]
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with (root / "launcher.log").open("w+") as log:
            service = subprocess.Popen(command, cwd=app, env=env, stdout=log, stderr=subprocess.STDOUT,
                                       start_new_session=not windows,
                                       creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if windows else 0)
            try:
                catalog = None
                for _ in range(100):
                    if service.poll() is not None:
                        raise RuntimeError("Launcher exited before readiness")
                    try:
                        with opener.open("http://127.0.0.1:%d/api/catalog" % port, timeout=.5) as response:
                            catalog = json.load(response)
                        break
                    except (OSError, urllib.error.URLError):
                        time.sleep(.1)
                assert catalog is not None, "Service not ready"
                with opener.open("http://127.0.0.1:%d/api/health" % port, timeout=2) as response:
                    assert response.status == 200 and json.load(response).get("healthy") is True, "Unhealthy portable service"
                assert (app / "portable-data").is_dir(), "Portable data not created"
                assert (app / "portable-output").is_dir(), "Portable outputs not created"
                assert Path(catalog.get("defaultOutputDir", "")).resolve() == (app / "portable-output").resolve(), "Wrong default output directory"
                with opener.open("http://127.0.0.1:%d/api/jobs" % port, timeout=2) as response:
                    jobs = json.load(response)
                assert not jobs.get("jobs", []), "Release contains private jobs"
            except BaseException:
                log.flush()
                log.seek(0)
                print(log.read())
                raise
            finally:
                if service.poll() is None:
                    if windows:
                        stop_windows_launcher(service, env)
                    else:
                        os.killpg(service.pid, signal.SIGTERM)
                try:
                    service.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    if windows:
                        subprocess.run(["taskkill", "/PID", str(service.pid), "/T", "/F"], capture_output=True, env=env)
                    else:
                        os.killpg(service.pid, signal.SIGKILL)
                    service.wait()
                    raise AssertionError("Launcher did not finish graceful shutdown")
                # cmd.exe can finish before its service receives CTRL_BREAK.
                for _ in range(200):
                    if not (app / "portable-data/lock").exists():
                        break
                    time.sleep(.1)
                assert not (app / "portable-data/lock").exists(), "Graceful shutdown left the data lock"
            print("PASS portable launcher, clean data, bundled runtime, outputs and graceful shutdown:", archive.name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    smoke(parser.parse_args().archive.resolve())
