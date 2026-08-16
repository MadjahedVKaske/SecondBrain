#!/usr/bin/env python3
"""НЕ лить стол на REG.RU. Стол живёт на VPS. Этот скрипт - только если чините сайт buro1.tech."""
from __future__ import annotations

import ftplib
import json
import ssl
from pathlib import Path

CFG = Path(r"C:\Users\Евгений\.cursor\skills\buro1-tg-inbox\config.local.json")
ROOT = Path(r"C:\Cursor\buro1-insight-hub\public")

FILES = [
    Path("desk/.htaccess"),
    Path("desk/index.php"),
    Path("desk/app.js"),
    Path("desk/style.css"),
    Path("desk/manifest.webmanifest"),
    Path("desk/icon.svg"),
    Path("api/desk/.htaccess"),
    Path("api/desk/_data/.htaccess"),
    Path("api/desk/config.sample.php"),
    Path("api/desk/config.php"),
    Path("api/desk/lib.php"),
    Path("api/desk/index.php"),
    Path("api/desk/schema.sql"),
    Path("api/desk/README.md"),
    Path(".htaccess"),
]


def ensure_dirs(ftp: ftplib.FTP, path: str) -> None:
    parts = path.replace("\\", "/").split("/")
    cur = ""
    for p in parts:
        if not p:
            continue
        cur = f"{cur}/{p}" if cur else p
        try:
            ftp.mkd(cur)
        except ftplib.error_perm:
            pass


def main() -> None:
    cfg = json.loads(CFG.read_text(encoding="utf-8"))
    host = cfg["ftp_host"]
    user = cfg["ftp_user"]
    password = cfg["ftp_pass"]
    ctx = ssl.create_default_context()
    ftp = ftplib.FTP_TLS()
    ftp.context = ctx
    ftp.connect(host, 21, timeout=30)
    ftp.auth()
    ftp.prot_p()
    ftp.login(user, password)
    ftp.cwd("/")
    names = ftp.nlst()
    print("ftp_ok root_entries", len(names))
    print("root_sample", ", ".join(sorted(names)[:20]))
    for rel in FILES:
        local = ROOT / rel
        if not local.is_file():
            print("missing", rel)
            continue
        remote = rel.as_posix()
        parent = str(Path(remote).parent).replace("\\", "/")
        if parent not in (".", ""):
            ensure_dirs(ftp, parent)
        with local.open("rb") as fh:
            ftp.storbinary(f"STOR {remote}", fh)
        print("uploaded", remote, local.stat().st_size)
    ftp.quit()
    print("done")


if __name__ == "__main__":
    main()
