#!/usr/bin/env python3
"""Read the TG inbox through the SSH-only secondbrain operator transport."""
from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
DATA = SKILL_ROOT / "_data"
INBOX_FILE = DATA / "inbox.json"


def operator_command() -> list[str]:
    raw = os.environ.get("TG_OPERATOR_COMMAND", "").strip()
    if not raw:
        raise RuntimeError("TG_OPERATOR_COMMAND is required; public TG admin transport is disabled")
    command = shlex.split(raw)
    if not command:
        raise RuntimeError("TG_OPERATOR_COMMAND is invalid")
    return command


def fetch(limit: int) -> list[dict]:
    result = subprocess.run(
        [*operator_command(), "tg-inbox", str(limit)], stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, encoding="utf-8",
        errors="replace", check=False, timeout=60,
    )
    if result.returncode:
        raise RuntimeError("tg_operator_unavailable")
    payload = json.loads(result.stdout)
    items = payload.get("items") if payload.get("ok") and isinstance(payload.get("items"), list) else None
    if items is None or not all(isinstance(item, dict) for item in items):
        raise RuntimeError("tg_operator_invalid_response")
    return items


def save(items: list[dict]) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    INBOX_FILE.write_text(json.dumps({"items": items[-500:]}, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=20)
    args = ap.parse_args()
    limit = max(1, min(100, args.limit))
    try:
        items = fetch(limit)
        save(items)
    except (RuntimeError, subprocess.SubprocessError, json.JSONDecodeError):
        print(json.dumps({"ok": False, "error": "tg_operator_unavailable"}, ensure_ascii=False))
        return 1
    print(json.dumps({"ok": True, "source": "ssh-operator", "inbox_count": len(items), "items": items}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
