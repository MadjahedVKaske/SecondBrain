#!/usr/bin/env python3
"""Package and upload a clean Docker release; never uploads secrets or deploys by default.

The target is supplied only by ignored .secrets/deploy.json.  This script uses
an SSH host-key fingerprint, not AutoAddPolicy.  Use --deploy to invoke the
remote release script after the archive checksum has been verified.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import re
import shutil
import socket
import subprocess
import tarfile
import tempfile
from pathlib import Path

import paramiko


ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / ".secrets" / "deploy.json"
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
ALLOWED_HOST = "72.56.66.161"
DENIED_HOSTS = {"45.10.42.191"}
RELEASE_PATHS = (
    "public/desk",
    "public/api/desk/index.php",
    "public/api/desk/lib.php",
    "public/api/desk/schema.sql",
    "infra/vps",
)


def run(*args: str) -> str:
    return subprocess.check_output(args, cwd=ROOT, text=True, encoding="utf-8").strip()


def openssl_binary() -> str:
    found = shutil.which("openssl")
    if found:
        return found
    windows_git = Path(r"C:\Program Files\Git\usr\bin\openssl.exe")
    if windows_git.is_file():
        return str(windows_git)
    raise RuntimeError("OpenSSL is required to sign the release manifest")


def release_sha(ref: str) -> str:
    sha = run("git", "rev-parse", f"{ref}^{{commit}}")
    if not SHA_RE.fullmatch(sha):
        raise RuntimeError("git returned an invalid commit SHA")
    return sha


def ensure_clean() -> None:
    if run("git", "status", "--porcelain"):
        raise RuntimeError("refusing to package a dirty tracked worktree")


def package(ref: str, destination: Path, signing_key: Path | None = None) -> tuple[str, str]:
    sha = release_sha(ref)
    with tempfile.TemporaryDirectory(prefix="secondbrain-release-") as tmp_s:
        tmp = Path(tmp_s)
        archive = tmp / "source.tar"
        with archive.open("wb") as out:
            subprocess.run(["git", "archive", "--format=tar", sha, *RELEASE_PATHS], cwd=ROOT, check=True, stdout=out)
        with tarfile.open(archive) as tar:
            tar.extractall(tmp / "release", filter="data")
        release = tmp / "release"
        required = [
            release / "public/desk/index.php",
            release / "public/api/desk/index.php",
            release / "infra/vps/compose.yml",
        ]
        if not all(p.is_file() for p in required):
            raise RuntimeError("release archive is missing a required Second Brain file")
        manifest = {
            "commit": sha,
            "files": {},
        }
        for path in sorted(p for p in release.rglob("*") if p.is_file()):
            rel = path.relative_to(release).as_posix()
            manifest["files"][rel] = hashlib.sha256(path.read_bytes()).hexdigest()
        (release / "release-manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        if signing_key is not None:
            if not signing_key.is_file():
                raise RuntimeError("release signing private key is missing")
            subprocess.run(
                [openssl_binary(), "dgst", "-sha256", "-sign", str(signing_key), "-out", str(release / "release-manifest.sig"), str(release / "release-manifest.json")],
                check=True,
            )
        destination.parent.mkdir(parents=True, exist_ok=True)
        with tarfile.open(destination, "w:gz") as tar:
            tar.add(release, arcname=".")
    checksum = hashlib.sha256(destination.read_bytes()).hexdigest()
    return sha, checksum


def deploy_config() -> dict:
    if not CFG.is_file():
        raise RuntimeError(f"missing local deploy config: {CFG}")
    data = json.loads(CFG.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise RuntimeError("deploy config must be a JSON object")
    required = ("host", "user", "key_path", "host_key_sha256", "remote_root", "release_signing_key_path")
    if any(not str(data.get(k) or "").strip() for k in required):
        raise RuntimeError("deploy config is incomplete")
    host = str(data["host"]).strip()
    if host != ALLOWED_HOST or host in DENIED_HOSTS:
        raise RuntimeError("deploy target is not the approved new VPS")
    fingerprint = str(data["host_key_sha256"]).removeprefix("SHA256:").rstrip("=")
    if not re.fullmatch(r"[A-Za-z0-9+/]{43}", fingerprint):
        raise RuntimeError("host_key_sha256 must be an exact SHA256 SSH fingerprint")
    if str(data["remote_root"]).rstrip("/") != "/opt/secondbrain":
        raise RuntimeError("remote_root must be /opt/secondbrain")
    if str(data["user"]).strip() != "brain-deploy" or int(data.get("port") or 22) != 22:
        raise RuntimeError("deploy user and SSH port must be exactly brain-deploy:22")
    return data


def verified_transport(cfg: dict) -> paramiko.Transport:
    host = str(cfg["host"])
    port = int(cfg.get("port") or 22)
    expected = str(cfg["host_key_sha256"]).removeprefix("SHA256:").rstrip("=")
    sock = socket.create_connection((host, port), timeout=20)
    transport = paramiko.Transport(sock)
    transport.start_client(timeout=20)
    key = transport.get_remote_server_key()
    actual = base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode("ascii").rstrip("=")
    if not hmac.compare_digest(actual, expected):
        transport.close()
        raise RuntimeError("SSH host-key fingerprint mismatch")
    key_path = Path(str(cfg["key_path"])).expanduser()
    if not key_path.is_file():
        transport.close()
        raise RuntimeError("deploy private key is missing")
    private = paramiko.Ed25519Key.from_private_key_file(str(key_path))
    transport.auth_publickey(str(cfg["user"]), private)
    if not transport.is_authenticated():
        transport.close()
        raise RuntimeError("SSH public-key authentication failed")
    return transport


def remote_run(transport: paramiko.Transport, command: str) -> str:
    channel = transport.open_session(timeout=30)
    channel.exec_command(command)
    out = channel.makefile("rb", -1).read().decode("utf-8", "replace")
    err = channel.makefile_stderr("rb", -1).read().decode("utf-8", "replace")
    status = channel.recv_exit_status()
    if status != 0:
        raise RuntimeError(f"remote command failed ({status}): {err[-800:] or out[-800:]}")
    return out


def upload_and_deploy(archive: Path, sha: str, checksum: str, cfg: dict, deploy: bool) -> None:
    root = str(cfg["remote_root"]).rstrip("/")
    if not root.startswith("/") or any(c in root for c in "'\"`$;\\"):
        raise RuntimeError("remote_root must be a plain absolute path")
    transport = verified_transport(cfg)
    try:
        remote_run(transport, f"mkdir -p {root}/incoming")
        remote_archive = f"{root}/incoming/{sha}.tar.gz"
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            sftp.put(str(archive), remote_archive)
        finally:
            sftp.close()
        remote_sum = remote_run(transport, f"sha256sum {remote_archive}").split()[0]
        if not hmac.compare_digest(remote_sum, checksum):
            raise RuntimeError("remote archive checksum mismatch")
        if deploy:
            remote_run(transport, f"sudo /usr/local/sbin/secondbrain-operator deploy {sha}")
    finally:
        transport.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ref", default="HEAD", help="immutable git commit/ref to package")
    parser.add_argument("--out", type=Path, default=ROOT / "_tmp" / "releases")
    parser.add_argument("--upload", action="store_true", help="upload only after fingerprint/checksum validation")
    parser.add_argument("--deploy", action="store_true", help="upload and invoke the remote release script")
    args = parser.parse_args()
    if args.deploy:
        args.upload = True
    ensure_clean()
    sha = release_sha(args.ref)
    archive = args.out / f"secondbrain-{sha}.tar.gz"
    cfg = deploy_config() if args.upload else None
    signing_key = Path(str(cfg["release_signing_key_path"])).expanduser() if cfg else None
    sha, checksum = package(sha, archive, signing_key)
    print(json.dumps({"ok": True, "commit": sha, "archive": str(archive), "sha256": checksum}, ensure_ascii=False))
    if args.upload:
        upload_and_deploy(archive, sha, checksum, cfg, args.deploy)
        print(json.dumps({"uploaded": True, "deployed": bool(args.deploy), "commit": sha}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
