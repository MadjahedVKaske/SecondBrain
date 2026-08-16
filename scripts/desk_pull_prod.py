#!/usr/bin/env python3
"""Скачать код стола с VPS в репо (prod -> local). Секреты не трогаем."""
from __future__ import annotations

from pathlib import Path
import paramiko

ROOT = Path(__file__).resolve().parents[1]
KEY = ROOT / "_tmp/ssh/id_ed25519_brain"
HOST = "45.10.42.191"
USER = "root"

FILES = [
    ("/var/www/brain/desk/app.js", "public/desk/app.js"),
    ("/var/www/brain/desk/style.css", "public/desk/style.css"),
    ("/var/www/brain/desk/index.php", "public/desk/index.php"),
    ("/var/www/brain/desk/.htaccess", "public/desk/.htaccess"),
    ("/var/www/brain/desk/manifest.webmanifest", "public/desk/manifest.webmanifest"),
    ("/var/www/brain/desk/icon.svg", "public/desk/icon.svg"),
    ("/var/www/brain/api/desk/lib.php", "public/api/desk/lib.php"),
    ("/var/www/brain/api/desk/index.php", "public/api/desk/index.php"),
    ("/var/www/brain/api/desk/migrate.php", "public/api/desk/migrate.php"),
    ("/var/www/brain/api/desk/schema.sql", "public/api/desk/schema.sql"),
    ("/var/www/brain/api/desk/.htaccess", "public/api/desk/.htaccess"),
]


def main() -> int:
    if not KEY.is_file():
        raise SystemExit(f"нет ключа: {KEY}")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        username=USER,
        pkey=paramiko.Ed25519Key.from_private_key_file(str(KEY)),
        timeout=25,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = c.open_sftp()
    for remote, rel in FILES:
        local = ROOT / rel
        local.parent.mkdir(parents=True, exist_ok=True)
        try:
            sftp.get(remote, str(local))
            print("pull", rel, local.stat().st_size)
        except OSError as e:
            print("skip", rel, e)
    sftp.close()
    c.close()
    print("ok", len(FILES), "files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
