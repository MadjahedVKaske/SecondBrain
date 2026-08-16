#!/usr/bin/env python3
"""Локальный утренний/вечерний дайджест Second Brain. --notify шлёт в бота."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / ".secrets" / "desk.local.json"
NOTIFY = Path(__file__).resolve().with_name("tg_notify.py")
MSK = timezone(timedelta(hours=3))


def config() -> dict:
    if not CFG.is_file():
        raise RuntimeError(f"Нет локального конфига: {CFG}")
    data = json.loads(CFG.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise RuntimeError("Некорректный desk.local.json")
    return data


def fetch_digest(mode: str) -> dict:
    cfg = config()
    api = str(cfg.get("api_url") or "http://127.0.0.1:8080/api/desk").rstrip("/")
    token = str(cfg.get("view_token") or "")
    if not token:
        raise RuntimeError("В desk.local.json нет view_token")
    url = f"{api}/digest?{urlencode({'mode': mode})}"
    req = Request(url, headers={"X-Yakor-Token": token})
    with urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def notify(text: str) -> bool:
    result = subprocess.run([sys.executable, str(NOTIFY), text], check=False)
    return result.returncode == 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["auto", "morning", "evening"], default="auto")
    ap.add_argument("--notify", action="store_true")
    args = ap.parse_args()
    now = datetime.now(MSK)
    mode = args.mode
    if mode == "auto":
        mode = "morning" if now.hour < 15 else "evening"
    try:
        digest = fetch_digest(mode)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 1
    if not digest.get("ok") or not digest.get("text"):
        print(json.dumps({"ok": False, "error": "digest"}, ensure_ascii=False))
        return 1
    text = str(digest["text"])
    print(text)
    if args.notify and not notify(text):
        return 2
    return 0


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    raise SystemExit(main())
