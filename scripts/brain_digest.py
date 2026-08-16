#!/usr/bin/env python3
"""Дайджест стола: горит / зависло / разлок. --notify шлёт в бота."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

API = os.environ.get("DESK_API", "http://45.10.42.191/api/desk").rstrip("/")
ADMIN = os.environ.get("DESK_ADMIN_TOKEN", "")
CFG = Path(r"C:\Cursor\buro1-insight-hub\_tmp\ssh\desk-url.txt")
FOCUS = Path(r"C:\Cursor\buro1-insight-hub\brain\wiki\focus.md")
NOTIFY = Path(__file__).resolve().with_name("tg_notify.py")
MSK = timezone(timedelta(hours=3))
STALE_DAYS = 2
HOT = {"doing", "waiting_reply", "on_test"}


def view_token() -> str:
    if not CFG.is_file():
        return ADMIN
    raw = CFG.read_text(encoding="utf-8", errors="replace").strip()
    q = parse_qs(urlparse(raw).query)
    return (q.get("k") or [ADMIN])[0] or ADMIN


def fetch_state() -> dict:
    req = Request(f"{API}/state", headers={"X-Yakor-Token": view_token()})
    with urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def parse_dt(s: str) -> datetime | None:
    s = (s or "").strip().replace("Z", "")
    if not s:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s[:19] if "T" in s or " " in s else s[:10], fmt)
            return dt.replace(tzinfo=MSK)
        except ValueError:
            continue
    return None


def age_days(s: str, now: datetime) -> int | None:
    dt = parse_dt(s)
    if not dt:
        return None
    return max(0, (now - dt).days)


def task_map(tasks: list) -> dict:
    return {t.get("id"): t for t in tasks if t.get("id")}


def title(t: dict) -> str:
    return (t.get("title") or t.get("slug") or t.get("id") or "?")[:80]


def focus_line() -> str:
    if not FOCUS.is_file():
        return ""
    for line in FOCUS.read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip().lstrip("#").strip()
        if s and not s.startswith("Фокус"):
            return s[:120]
    return ""


def build(mode: str, state: dict) -> str:
    now = datetime.now(MSK)
    today = now.strftime("%Y-%m-%d")
    tasks = [t for t in (state.get("tasks") or []) if isinstance(t, dict)]
    by_id = task_map(tasks)
    overdue, due_today, stale, unlocked = [], [], [], []
    for t in tasks:
        if t.get("status") == "done":
            continue
        due = (t.get("due") or "")[:10]
        if due and due < today:
            overdue.append(t)
        elif due == today:
            due_today.append(t)
        st = t.get("status") or ""
        wait_until = (t.get("wait_until") or "")[:10]
        days = age_days(str(t.get("updated_at") or ""), now)
        if st in HOT and days is not None and days >= STALE_DAYS:
            stale.append((t, days))
        elif st == "waiting_reply" and wait_until and wait_until < today:
            stale.append((t, days or 0))
        bid = t.get("blocked_by") or ""
        blk = by_id.get(bid)
        if bid and blk and blk.get("status") == "done":
            unlocked.append(t)
    stale.sort(key=lambda x: -x[1])
    head = "Утро" if mode == "morning" else "Вечер" if mode == "evening" else "Стол"
    lines = [f"{head} {now.strftime('%d.%m')}"]
    if overdue or due_today:
        bits = []
        if overdue:
            bits.append(f"{len(overdue)} просроч.")
        if due_today:
            bits.append(f"{len(due_today)} сегодня")
        names = [title(t) for t in (overdue + due_today)[:3]]
        lines.append("Горит: " + ", ".join(bits) + " - " + "; ".join(names))
    else:
        lines.append("Горит: тишина")
    if stale:
        bits = []
        for t, days in stale[:3]:
            extra = t.get("wait_contact") or ""
            bits.append(f"{title(t)} ({t.get('status')}, {days}д" + (f", {extra}" if extra else "") + ")")
        more = f" +{len(stale) - 3}" if len(stale) > 3 else ""
        lines.append("Зависли: " + "; ".join(bits) + more)
    if unlocked:
        lines.append("Разлок: " + "; ".join(title(t) for t in unlocked[:3]))
    foc = focus_line()
    if foc:
        lines.append("Фокус: " + foc)
    return "\n".join(lines)


def notify(text: str) -> None:
    subprocess.run([sys.executable, str(NOTIFY), text], check=False)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["auto", "morning", "evening", "stale"], default="auto")
    ap.add_argument("--notify", action="store_true")
    args = ap.parse_args()
    now = datetime.now(MSK)
    mode = args.mode
    if mode == "auto":
        mode = "morning" if now.hour < 15 else "evening"
    state = fetch_state()
    if not state.get("ok"):
        print(json.dumps({"ok": False, "error": "state"}, ensure_ascii=False))
        return 1
    text = build("stale" if mode == "stale" else mode, state)
    print(text)
    if args.notify:
        notify(text)
    return 0


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    raise SystemExit(main())
