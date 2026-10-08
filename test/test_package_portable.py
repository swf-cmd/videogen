"""Offline release checks; never download a runtime or contact a provider."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
import zipfile

SPEC = importlib.util.spec_from_file_location("portable", Path(__file__).resolve().parents[1] / "scripts/package-portable.py")
portable = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(portable)


class PortableSources(unittest.TestCase):
    def test_git_allowlist_and_normalization(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            for name in portable.FILES + ["src/one.js", "data/catalog/provider.json"]:
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(b"first\r\nsecond\r\n")
            subprocess.run(["git", "add", "--all"], cwd=root, check=True, capture_output=True)
            (root / "data/catalog/untracked-secret.json").write_text("secret")
            (root / "src/ignored.log").write_text("private")
            names = portable.tracked_sources(root)
            self.assertNotIn("data/catalog/untracked-secret.json", names)
            self.assertNotIn("src/ignored.log", names)
            self.assertEqual(names, sorted(names, key=lambda name: name.encode("utf-8")))
            self.assertEqual(portable.normalized_source_bytes(root / "src/one.js"), b"first\nsecond\n")
            self.assertEqual(portable.normalized_source_bytes(root / "Start videogen.cmd"), b"first\r\nsecond\r\n")

    def test_archive_uses_posix_byte_order_fixed_metadata_and_source_newlines(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            app = base / "videogen-test"
            app.mkdir()
            # Windows Path comparison folds case; POSIX does not. Sorting the
            # serialized names must be identical on both hosts.
            for name in ["z.js", "a.js", "B.js", "Start videogen.cmd"]:
                (app / name).write_bytes(b"line\n")
            first, second = base / "one.zip", base / "two.zip"
            portable.zip_tree(app, first)
            portable.zip_tree(app, second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with zipfile.ZipFile(first) as archive:
                self.assertEqual(archive.namelist(), sorted(archive.namelist(), key=lambda name: name.encode("utf-8")))
                for info in archive.infolist():
                    self.assertEqual(info.date_time, (2000, 1, 1, 0, 0, 0))
                    self.assertEqual(info.create_system, 3)


if __name__ == "__main__":
    unittest.main()
