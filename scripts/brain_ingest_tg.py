#!/usr/bin/env python3
"""Складывает inbox бота в brain/raw/tg/. Wiki не пишет - это агент по SCHEMA."""
from __future__ import annotations

import json
import re
from pathlib import Path

INBOX = Path.home() / ".cursor" / "skills" / "buro1-tg-inbox" / "_data" / "inbox.json"
STATE = Path.home() / ".cursor" / "skills" / "buro1-tg-inbox" / "_data" / "tg-media" / "processed.json"
RAW = Path(r"C:\Cursor\buro1-insight-hub\brain\raw\tg")
TOKEN_RE = re.compile(r"\d{8,}:[A-Za-z0-9_-]{20,}")


def redact(s: str) -> str:
    s = TOKEN_RE.sub("[redacted-token]", s)
    if "ftp" in s.lower() or "_cursor" in s.lower() or (len(s.split()) == 2 and any(ch.isdigit() for ch in s)):
        if any(c.isupper() for c in s) and any(c.isdigit() for c in s) and len(s) < 80:
            return "[redacted]"
    return s


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    raw = json.loads(INBOX.read_text(encoding="utf-8")) if INBOX.is_file() else {}
    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.is_file() else {}
    done = state.get("done") if isinstance(state, dict) else {}
    if not isinstance(done, dict):
        done = {}
    items = raw.get("items") if isinstance(raw, dict) else []
    if not isinstance(items, list):
        items = []
    n = 0
    wrote: list[str] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        iid = str(it.get("id") or "").strip()
        if not iid:
            continue
        dest = RAW / f"{iid}.md"
        if dest.is_file():
            continue
        text = redact((it.get("text") or it.get("caption") or "").strip())
        tr = (it.get("transcript") or "").strip()
        if not tr:
            tr = redact(str((done.get(iid) or {}).get("transcript_preview") or "").strip())
        lines = [
            f"# tg {iid[:8]}",
            "",
            f"- type: {it.get('type') or 'text'}",
            f"- from: {it.get('from_username') or it.get('from_id') or ''}",
            f"- at: {it.get('received_at') or ''}",
            f"- file: {it.get('file') or ''}",
            "",
        ]
        if text:
            lines += ["## текст", "", text, ""]
        if tr:
            lines += ["## транскрипт", "", tr, ""]
        dest.write_text("\n".join(lines), encoding="utf-8")
        wrote.append(str(dest))
        n += 1
    print(json.dumps({"ok": True, "wrote": n, "files": wrote, "dir": str(RAW)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
