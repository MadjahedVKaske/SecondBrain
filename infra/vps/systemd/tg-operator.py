#!/usr/bin/env python3
"""Root-only TG operator bridge. It never prints Bot/API credentials."""
from __future__ import annotations

import base64
import json
import subprocess
import sys

DOCKER = "/usr/bin/docker"
CONTAINER = "secondbrain-tg-1"

INBOX_PROGRAM = r'''
import json, sys
from pathlib import Path
limit = int(sys.argv[1])
try:
    items = json.loads((Path("/data") / "inbox.json").read_text(encoding="utf-8")).get("items", [])
except (OSError, ValueError, AttributeError):
    items = []
allowed = {"id", "update_id", "from_username", "date", "received_at", "type", "text", "caption", "filename", "mime", "stored_as", "wake_sent"}
safe = [{key: value for key, value in item.items() if key in allowed} for item in items[-limit:] if isinstance(item, dict)]
print(json.dumps({"ok": True, "items": safe}, ensure_ascii=False, separators=(",", ":")))
'''

SEND_PROGRAM = r'''
import base64, json, sys, urllib.request
from pathlib import Path
try:
    raw = base64.urlsafe_b64decode(sys.argv[1] + "=" * (-len(sys.argv[1]) % 4))
    payload = json.loads(raw)
    text = payload["text"].strip()
    chat = int(payload["chat_id"])
    cfg = json.loads(Path("/run/secrets/tg_config").read_text(encoding="utf-8"))
    token = Path("/run/secrets/tg_bot_token").read_text(encoding="utf-8").strip()
    if set(payload) != {"text", "chat_id"} or not text or len(text) > 4000 or chat not in {int(x) for x in cfg["allowed_chat_ids"]}:
        raise ValueError
    request = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=json.dumps({"chat_id": chat, "text": text, "link_preview_options": {"is_disabled": True}}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=45) as response:
        result = json.loads(response.read())
    if not result.get("ok"):
        raise ValueError
except Exception:
    print('{"ok":false,"error":"telegram_unavailable"}')
    raise SystemExit(1)
print('{"ok":true}')
'''


def run_container(program: str, argument: str, action: str) -> int:
    try:
        result = subprocess.run(
            [DOCKER, "exec", "-i", CONTAINER, "python3", "-c", program, argument],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except OSError:
        print('{"ok":false,"error":"tg_operator_unavailable"}')
        return 1
    if result.returncode:
        print('{"ok":false,"error":"tg_operator_unavailable"}')
        return 1
    try:
        response = json.loads(result.stdout)
        if action == "send":
            if response != {"ok": True}:
                raise ValueError
        elif (not isinstance(response, dict) or response.get("ok") is not True
              or not isinstance(response.get("items"), list)):
            raise ValueError
    except (TypeError, ValueError, json.JSONDecodeError):
        print('{"ok":false,"error":"tg_operator_invalid_response"}')
        return 1
    # Only the documented response shape can leave the privileged boundary.
    print(json.dumps(response, ensure_ascii=False, separators=(",", ":")))
    return 0


def main() -> int:
    if len(sys.argv) == 3 and sys.argv[1] == "inbox" and sys.argv[2].isdigit():
        limit = max(1, min(100, int(sys.argv[2])))
        return run_container(INBOX_PROGRAM, str(limit), "inbox")
    if len(sys.argv) == 3 and sys.argv[1] == "send":
        try:
            payload = base64.urlsafe_b64decode(sys.argv[2] + "=" * (-len(sys.argv[2]) % 4))
            data = json.loads(payload)
            if not isinstance(data, dict) or set(data) != {"text", "chat_id"}:
                raise ValueError
        except Exception:
            print('{"ok":false,"error":"invalid_request"}')
            return 64
        return run_container(SEND_PROGRAM, sys.argv[2], "send")
    print('{"ok":false,"error":"usage"}')
    return 64


if __name__ == "__main__":
    raise SystemExit(main())
