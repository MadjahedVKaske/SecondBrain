#!/usr/bin/env python3
"""Verify a signed, complete release before the root wrapper consumes it."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path
from pathlib import PurePosixPath


def fail(message: str) -> None:
    raise SystemExit(f"release verification failed: {message}")


def extract_root_owned(archive: Path, release: Path) -> None:
    if archive.is_symlink() or not archive.is_file():
        fail("archive must be a regular file")
    if release.exists() or release.is_symlink():
        fail("fresh release staging path required")
    release.mkdir(mode=0o700, parents=False)
    seen: set[str] = set()
    total = 0
    try:
        with tarfile.open(archive, "r:gz") as tar:
            for member in tar:
                parts = tuple(part for part in PurePosixPath(member.name).parts if part not in {"", "."})
                if not parts:
                    continue
                if PurePosixPath(member.name).is_absolute() or ".." in parts:
                    fail("unsafe archive path")
                name = "/".join(parts)
                if name in seen:
                    fail("duplicate archive path")
                seen.add(name)
                target = release.joinpath(*parts)
                if member.isdir():
                    target.mkdir(mode=0o755, parents=True, exist_ok=True)
                    continue
                if not member.isreg() or member.size > 100 * 1024 * 1024:
                    fail("archive contains a link, special file, or oversized member")
                total += member.size
                if total > 500 * 1024 * 1024:
                    fail("archive is too large")
                target.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
                source = tar.extractfile(member)
                if source is None:
                    fail("archive member cannot be read")
                mode = 0o755 if member.mode & 0o111 else 0o644
                flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
                if hasattr(os, "O_NOFOLLOW"):
                    flags |= os.O_NOFOLLOW
                fd = os.open(target, flags, mode)
                with source, os.fdopen(fd, "wb") as output:
                    shutil.copyfileobj(source, output)
    except BaseException:
        shutil.rmtree(release, ignore_errors=True)
        raise


def main() -> int:
    if len(sys.argv) == 5 and sys.argv[1] == "--extract":
        archive = Path(sys.argv[2])
        release = Path(sys.argv[3])
        sha = sys.argv[4]
        extract_root_owned(archive, release)
    elif len(sys.argv) == 3:
        release = Path(sys.argv[1])
        sha = sys.argv[2]
    else:
        fail("usage")
    if release.is_symlink() or not release.is_dir():
        fail("release root must be a real directory")
    release = release.resolve()
    manifest_path = release / "release-manifest.json"
    signature = release / "release-manifest.sig"
    public_key = Path("/opt/secondbrain/shared/release-signing.pub")
    if not public_key.is_file() or not manifest_path.is_file() or not signature.is_file():
        fail("trusted key, manifest, or signature missing")
    if subprocess.run(
        ["/usr/bin/openssl", "pkeyutl", "-verify", "-rawin", "-pubin", "-inkey", str(public_key), "-sigfile", str(signature), "-in", str(manifest_path)],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).returncode != 0:
        fail("signature invalid")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        files = manifest["files"]
    except (OSError, json.JSONDecodeError, KeyError, TypeError):
        fail("manifest invalid")
    if manifest.get("commit") != sha or not isinstance(files, dict):
        fail("commit or file list invalid")
    expected = set(files)
    if any(not isinstance(name, str) or name.startswith("/") or ".." in Path(name).parts for name in expected):
        fail("unsafe manifest path")
    actual: set[str] = set()
    for path in release.rglob("*"):
        if path.is_symlink():
            fail("symlink present")
        if path.is_file():
            relative = path.relative_to(release).as_posix()
            if relative not in {"release-manifest.json", "release-manifest.sig"}:
                actual.add(relative)
    if actual != expected:
        fail("release contents differ from manifest")
    for name, wanted in files.items():
        if not isinstance(wanted, str) or not hmac.compare_digest(
            hashlib.sha256((release / name).read_bytes()).hexdigest(), wanted
        ):
            fail("file digest mismatch")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
