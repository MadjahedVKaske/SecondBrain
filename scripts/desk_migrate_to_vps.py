#!/usr/bin/env python3
"""Слить задачи: старый стол REG.RU + C:\\Cursor\\Tasks -> стол VPS. Токены в stdout не печатает."""
from __future__ import annotations

import json
import os
import re
import urllib.request
from pathlib import Path

ROOT = Path(r"C:\Cursor\buro1-insight-hub")
TASKS = Path(r"C:\Cursor\Tasks")
OLD_API = os.environ.get("DESK_OLD_API", "https://buro1.tech/api/desk").rstrip("/")
NEW_API = os.environ.get("DESK_API", "http://45.10.42.191/api/desk").rstrip("/")
ADMIN = os.environ.get("DESK_ADMIN_TOKEN", "")
OLD_CFG = ROOT / "public" / "api" / "desk" / "config.php"
URL_FILE = ROOT / "_tmp" / "ssh" / "desk-url.txt"

STATUS = {
    "к выполнению": "todo",
    "в работе": "doing",
    "на тесте": "on_test",
    "ждём ответа": "waiting_reply",
    "ждем ответа": "waiting_reply",
    "сделано": "done",
    "отложено": "paused",
}
SKIP_PREFIX = ("_", "HANDOFF")
SKIP_NAMES = {"readme.md", "стол_задач_buro1.md"}


def meta(text: str, key: str) -> str:
    m = re.search(rf"\*\*{re.escape(key)}:\*\*\s*(.+)", text)
    return m.group(1).strip() if m else ""


def req(url: str, method: str = "GET", data: dict | None = None, token: str = ADMIN) -> dict:
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
    r = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Content-Type": "application/json",
            "X-Yakor-Token": token,
        },
    )
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def old_view_token() -> str:
    raw = OLD_CFG.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"'view_token'\s*=>\s*'([^']+)'", raw)
    return m.group(1) if m else ""


def parse_local() -> list[dict]:
    out = []
    for p in sorted(TASKS.glob("*.md")):
        if p.name.startswith(SKIP_PREFIX) or p.name.lower() in SKIP_NAMES:
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        title = text.splitlines()[0].replace("# Задача:", "").replace("#", "").strip() if text.strip() else p.stem
        st = meta(text, "Статус")
        due = meta(text, "Когда")
        due = due if re.match(r"\d{4}-\d{2}-\d{2}", due) else None
        out.append(
            {
                "slug": p.stem,
                "title": title or p.stem,
                "area": meta(text, "Область"),
                "client": meta(text, "Клиент"),
                "status": STATUS.get(st, "todo" if not st else "todo"),
                "due": due,
                "notes": "",
                "source_file": p.name,
            }
        )
        if st and st not in STATUS:
            out[-1]["status"] = "todo"
    return out


def norm_slug(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    return s


def merge(old_tasks: list, local: list) -> list[dict]:
    by: dict[str, dict] = {}

    def key(t: dict) -> str:
        slug = norm_slug(str(t.get("slug") or ""))
        src = str(t.get("source_file") or "")
        if slug:
            return "s:" + slug
        if src:
            return "f:" + Path(src).stem
        return "t:" + str(t.get("title") or t.get("id") or "")

    for t in old_tasks:
        if not isinstance(t, dict):
            continue
        k = key(t)
        if k == "t:":
            continue
        slug = norm_slug(str(t.get("slug") or "")) or Path(str(t.get("source_file") or t.get("id") or "old")).stem
        by[k] = {
            "id": t.get("id"),
            "slug": slug,
            "title": t.get("title") or slug,
            "area": t.get("area") or "",
            "client": t.get("client") or "",
            "status": t.get("status") or "todo",
            "due": t.get("due"),
            "notes": t.get("notes") or "",
            "source_file": t.get("source_file") or "",
        }
    for t in local:
        k = key(t)
        if k in by:
            old = by[k]
            if old.get("status") == "done":
                t = {**t, "status": "done"}
            if old.get("id"):
                t = {**t, "id": old["id"]}
            if old.get("notes") and not t.get("notes"):
                t = {**t, "notes": old["notes"]}
        by[k] = t
    return list(by.values())


def main() -> int:
    old = req(f"{OLD_API}/state", token=old_view_token())
    local = parse_local()
    old_tasks = old.get("tasks") or []
    merged = merge(old_tasks if isinstance(old_tasks, list) else [], local)
    sync = req(f"{NEW_API}/sync", method="POST", data={"tasks": merged, "events": []})
    view = ""
    if URL_FILE.is_file():
        view = URL_FILE.read_text(encoding="utf-8").strip()
    # клиенты со старого стола
    clients = old.get("clients") or []
    n_cli = 0
    if isinstance(clients, list):
        for c in clients:
            if not isinstance(c, dict) or not (c.get("title") or c.get("id")):
                continue
            req(f"{NEW_API}/clients", method="POST", data=c, token=ADMIN)
            n_cli += 1
    new_h = req(f"{NEW_API}/")
    print(
        json.dumps(
            {
                "ok": True,
                "old_tasks": len(old_tasks) if isinstance(old_tasks, list) else 0,
                "local_md": len(local),
                "merged": len(merged),
                "sync": sync,
                "clients_pushed": n_cli,
                "vps": {
                    "storage": new_h.get("storage"),
                    "tasks": new_h.get("tasks"),
                    "clients": new_h.get("clients"),
                },
                "desk": view,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
