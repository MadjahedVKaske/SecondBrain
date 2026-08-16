# -*- coding: utf-8 -*-
"""Прописать wake_url на VPS и залить desk lib. Секреты/IP в stdout не печатает."""
from __future__ import annotations

import re
from pathlib import Path

import paramiko

ROOT = Path(r"C:\Cursor\buro1-insight-hub")
KEY = ROOT / r"_tmp\ssh\id_ed25519_brain"
HOST = "45.10.42.191"
REMOTE_CFG = "/var/www/brain/api/desk/config.php"
# VPS бьёт в свой localhost: desk_watch держит reverse SSH.
WAKE_URL = "http://127.0.0.1:27189/wake"


def ssh_connect() -> paramiko.SSHClient:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    pkey = paramiko.Ed25519Key.from_private_key_file(str(KEY))
    c.connect(HOST, username="root", pkey=pkey, timeout=20, allow_agent=False, look_for_keys=False)
    return c


def run(c: paramiko.SSHClient, cmd: str, timeout: int = 60) -> str:
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if code != 0:
        raise RuntimeError(f"exit {code}: {cmd}\n{out}\n{err}")
    return out


def main() -> None:
    c = ssh_connect()
    sftp = c.open_sftp()
    with sftp.file(REMOTE_CFG, "r") as f:
        raw = f.read().decode("utf-8")
    if not re.search(r"'wake_url'\s*=>", raw):
        raise SystemExit("no wake_url key")
    new = re.sub(r"'wake_url'\s*=>\s*'[^']*'", f"'wake_url' => {WAKE_URL!r}", raw, count=1)
    tmp = REMOTE_CFG + ".tmp"
    with sftp.file(tmp, "w") as f:
        f.write(new)
    run(c, f"chmod 600 {tmp} && mv {tmp} {REMOTE_CFG} && chown www-data:www-data {REMOTE_CFG} && chmod 600 {REMOTE_CFG}")
    for name in ("lib.php", "index.php"):
        local = ROOT / "public" / "api" / "desk" / name
        remote = f"/var/www/brain/api/desk/{name}"
        sftp.put(str(local), remote)
        run(c, f"chown www-data:www-data {remote}")
    sftp.close()
    check = run(
        c,
        "php -r '$c=require \"/var/www/brain/api/desk/config.php\"; "
        "echo (trim((string)($c[\"wake_url\"]??\"\"))!==\"\") ? \"wake_url=set\" : \"wake_url=empty\";'",
    ).strip()
    health = run(c, "curl -sS http://127.0.0.1/api/desk/health").strip()
    health_url = WAKE_URL.rsplit("/wake", 1)[0] + "/health"
    stdin, stdout, stderr = c.exec_command(
        f'curl -sS -m 5 -o /tmp/wake-health.body -w "%{{http_code}}" {health_url} || true',
        timeout=20,
    )
    ping = stdout.read().decode("utf-8", "replace").strip()
    ping_err = stderr.read().decode("utf-8", "replace").strip()
    stdout.channel.recv_exit_status()
    c.close()
    print(check)
    print("health_wake_push", '"wake_push":true' in health.replace(" ", ""))
    print("home_http", ping or "000")
    if ping_err:
        print("home_err", ping_err.split(health_url)[0][:120] if health_url in ping_err else ping_err[:120])


if __name__ == "__main__":
    main()
