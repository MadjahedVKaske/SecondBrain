#!/usr/bin/env python3
"""Дамп MySQL стола с VPS в _tmp/desk/ (не в git)."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import paramiko

ROOT = Path(__file__).resolve().parents[1]
KEY = ROOT / "_tmp/ssh/id_ed25519_brain"
HOST = "45.10.42.191"
OUT_DIR = ROOT / "_tmp" / "desk"


def main() -> int:
    if not KEY.is_file():
        raise SystemExit(f"нет ключа: {KEY}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    out = OUT_DIR / f"desk-mysql-{stamp}.sql"

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        username="root",
        pkey=paramiko.Ed25519Key.from_private_key_file(str(KEY)),
        timeout=25,
        allow_agent=False,
        look_for_keys=False,
    )
    cmd = r"""php -r '
$c = include "/var/www/brain/api/desk/config.php";
if (empty($c["db_name"])) { fwrite(STDERR, "no mysql on prod\n"); exit(2); }
$h = escapeshellarg($c["db_host"] ?: "localhost");
$n = escapeshellarg($c["db_name"]);
$u = escapeshellarg($c["db_user"]);
$p = escapeshellarg($c["db_pass"]);
passthru("mysqldump --single-transaction --routines=0 --triggers=0 -h $h -u $u -p$p $n 2>/dev/null");
'"""
    _, stdout, stderr = c.exec_command(cmd, timeout=120)
    data = stdout.read()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    c.close()
    if code != 0 or not data:
        raise SystemExit(err or f"mysqldump failed exit {code}")
    out.write_bytes(data)
    print("dump", out, out.stat().st_size)
    latest = OUT_DIR / "desk-mysql-latest.sql"
    latest.write_bytes(data)
    print("latest", latest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
