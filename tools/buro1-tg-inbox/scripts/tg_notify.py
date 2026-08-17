#!/usr/bin/env python3
"""Send text through the SSH-only secondbrain operator transport."""
from __future__ import annotations

import argparse
import base64
import json
import os
import shlex
import subprocess
import sys


def operator_command() -> list[str]:
    raw = os.environ.get("TG_OPERATOR_COMMAND", "").strip()
    if not raw:
        raise RuntimeError("TG_OPERATOR_COMMAND is required; public TG admin transport is disabled")
    command = shlex.split(raw)
    if not command:
        raise RuntimeError("TG_OPERATOR_COMMAND is invalid")
    return command


def send(text: str, chat_id: int) -> bool:
    if chat_id <= 0:
        raise RuntimeError("--chat-id is required")
    payload = {"text": text, "chat_id": chat_id}
    encoded = base64.urlsafe_b64encode(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).decode("ascii").rstrip("=")
    result = subprocess.run(
        [*operator_command(), "tg-send", encoded], stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, encoding="utf-8",
        errors="replace", check=False, timeout=60,
    )
    try:
        return result.returncode == 0 and bool(json.loads(result.stdout).get("ok"))
    except (TypeError, ValueError):
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("message", nargs="?", default="")
    ap.add_argument("--text", default="")
    ap.add_argument("--chat-id", type=int, required=True)
    args = ap.parse_args()
    text = (args.text or args.message or "").strip()
    if not text:
        print(json.dumps({"ok": False, "error": "text required"}, ensure_ascii=False))
        return 1

    try:
        ok = send(text, args.chat_id)
    except (RuntimeError, subprocess.SubprocessError):
        ok = False
    if ok:
        print(json.dumps({"ok": True}, ensure_ascii=False))
        return 0
    print(json.dumps({"ok": False, "error": "tg_operator_unavailable"}, ensure_ascii=False), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
