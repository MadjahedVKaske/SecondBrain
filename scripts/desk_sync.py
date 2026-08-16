#!/usr/bin/env python3
"""Синк задач C:\\Cursor\\Tasks -> стол VPS."""
from __future__ import annotations

import json
import os
import re
import urllib.request
from pathlib import Path

TASKS = Path(r"C:\Cursor\Tasks")
API = os.environ.get("DESK_API", "http://45.10.42.191/api/desk").rstrip("/")
TOKEN = os.environ.get("DESK_ADMIN_TOKEN", "")
CFG = Path(__file__).resolve().parents[1] / "_tmp" / "ssh" / "desk-url.txt"

STATUS = {
    "к выполнению": "todo",
    "в работе": "doing",
    "на тесте": "on_test",
    "ждём ответа": "waiting_reply",
    "сделано": "done",
    "отложено": "paused",
}


def meta(text: str, key: str) -> str:
    m = re.search(rf"\*\*{re.escape(key)}:\*\*\s*(.+)", text)
    return m.group(1).strip() if m else ""


def parse_task(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8", errors="replace")
    st = meta(text, "Статус")
    if not st:
        return None
    title = text.splitlines()[0].replace("# Задача:", "").replace("#", "").strip()
    due = meta(text, "Когда")
    due = due if re.match(r"\d{4}-\d{2}-\d{2}", due) else ""
    return {
        "slug": path.stem,
        "title": title,
        "area": meta(text, "Область"),
        "client": meta(text, "Клиент"),
        "status": STATUS.get(st, "todo"),
        "due": due or None,
        "notes": "",
        "source_file": path.name,
    }


def load_view_url() -> str:
    if not CFG.is_file():
        return ""
    return CFG.read_text(encoding="utf-8", errors="replace").strip()


def main() -> None:
    tasks = []
    for p in sorted(TASKS.glob("*.md")):
        if p.name.startswith("_") or p.name.startswith("HANDOFF"):
            continue
        row = parse_task(p)
        if row:
            tasks.append(row)
    body = json.dumps({"tasks": tasks, "events": []}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{API}/sync",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Yakor-Token": TOKEN,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        out = json.loads(resp.read().decode("utf-8"))
    print(json.dumps(out, ensure_ascii=False))
    view = load_view_url()
    if view:
        print(view)


if __name__ == "__main__":
    main()
