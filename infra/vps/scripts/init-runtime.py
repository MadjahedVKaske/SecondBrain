#!/usr/bin/env python3
"""Create the first Desk-only production runtime without storing values in Git.

The command generates credentials locally and writes them only to explicitly
named host paths. It never prints a secret and refuses to replace any file.
"""
from __future__ import annotations

import argparse
import os
import re
import secrets
import subprocess
from pathlib import Path


DNS_RE = re.compile(r"(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$", re.I)
_SCRIPT_PARENTS = Path(__file__).resolve().parents
PROJECT_ROOT = _SCRIPT_PARENTS[3] if len(_SCRIPT_PARENTS) > 3 else None


def new_token() -> str:
    return secrets.token_urlsafe(32)


def php_quote(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def write_new(path: Path, text: str, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    except FileExistsError as exc:
        raise RuntimeError(f"refusing to replace existing file: {path}") from exc
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as out:
        out.write(text)
    if os.name != "nt":
        os.chmod(path, mode)


def require_empty_directory(path: Path) -> None:
    if path.exists() and not path.is_dir():
        raise RuntimeError(f"secrets path is not a directory: {path}")
    if path.exists() and any(path.iterdir()):
        raise RuntimeError(f"refusing to use non-empty secrets directory: {path}")
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    if os.name != "nt":
        os.chmod(path, 0o700)


def require_ignored_if_in_project(path: Path) -> None:
    """Avoid accidentally creating a local secret in a tracked project path."""
    if PROJECT_ROOT is None:
        return
    try:
        path.relative_to(PROJECT_ROOT)
    except ValueError:
        return
    result = subprocess.run(
        ["git", "check-ignore", "-q", "--", str(path)],
        cwd=PROJECT_ROOT,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"refusing a non-ignored project path: {path}")


def desk_config(app_password: str, view_token: str, admin_token: str) -> str:
    fields = {
        "view_token": view_token,
        "admin_token": admin_token,
        "db_host": "db",
        "db_port": "3306",
        "db_name": "desk",
        "db_user": "desk",
        "db_pass": app_password,
        "wake_url": "",
    }
    lines = ["<?php", "// Generated for the Desk-only production runtime. Do not commit.", "return ["]
    for key, value in fields.items():
        rendered = value if key == "db_port" else php_quote(value)
        lines.append(f"    {php_quote(key)} => {rendered},")
    lines.extend(["];", ""])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--secrets-dir", type=Path, required=True)
    parser.add_argument("--runtime-env", type=Path, required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--acme-email", required=True)
    parser.add_argument("--brain-private-dir", type=Path, required=True)
    parser.add_argument("--backup-dir", type=Path, required=True)
    parser.add_argument("--backup-age-recipient", required=True)
    args = parser.parse_args()

    if not DNS_RE.fullmatch(args.domain) or args.domain.replace(".", "").isdigit():
        raise SystemExit("domain must be a real DNS name, not an IP address")
    if "@" not in args.acme_email or "\n" in args.acme_email:
        raise SystemExit("acme-email is invalid")
    if (
        not args.backup_age_recipient.startswith("age1")
        or "\n" in args.backup_age_recipient
        or any(word in args.backup_age_recipient.lower() for word in ("replace", "example", "change-me"))
    ):
        raise SystemExit("backup-age-recipient must be one public age recipient")
    if args.runtime_env.exists():
        raise SystemExit(f"refusing to replace existing runtime env: {args.runtime_env}")

    secret_dir = args.secrets_dir.resolve()
    runtime_env = args.runtime_env.resolve()
    require_ignored_if_in_project(secret_dir)
    require_ignored_if_in_project(runtime_env)
    require_empty_directory(secret_dir)
    app_password, root_password, view_token, admin_token = (new_token() for _ in range(4))
    try:
        write_new(secret_dir / "mysql_app_password", app_password + "\n")
        write_new(secret_dir / "mysql_root_password", root_password + "\n")
        write_new(secret_dir / "backup_age_recipient", args.backup_age_recipient + "\n")
        write_new(secret_dir / "desk.config.php", desk_config(app_password, view_token, admin_token))
        runtime = (
            f"BRAIN_DOMAIN={args.domain}\n"
            f"ACME_EMAIL={args.acme_email}\n"
            f"SECRETS_DIR={secret_dir}\n"
            f"BRAIN_PRIVATE_DIR={args.brain_private_dir.resolve()}\n"
            f"BACKUP_DIR={args.backup_dir.resolve()}\n"
        )
        write_new(runtime_env, runtime)
    except Exception:
        # Do not silently continue after a partial setup. The user must remove
        # the new directory explicitly after reviewing the failed run.
        raise
    print("initial Desk-only runtime written; credentials were not printed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
