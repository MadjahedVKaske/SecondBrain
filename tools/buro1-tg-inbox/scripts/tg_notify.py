#!/usr/bin/env python3
"""Отправка текста в бота через VPS.

  python scripts/tg_notify.py "Готово: dump_config_git"
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_CHAT_ID = 0
LOCAL_CFG = Path(__file__).resolve().parents[1] / "config.local.json"


def _load_local() -> dict:
    if not LOCAL_CFG.is_file():
        return {}
    try:
        return json.loads(LOCAL_CFG.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _vps_creds() -> tuple[str, str]:
    local = _load_local()
    base = (os.environ.get("TG_BASE_URL") or local.get("base_url") or "").strip().rstrip("/")
    token = (os.environ.get("TG_ADMIN_TOKEN") or local.get("admin_token") or "").strip()
    if not base or not token:
        raise RuntimeError(
            f"Set base_url and admin_token in {LOCAL_CFG} or TG_BASE_URL/TG_ADMIN_TOKEN"
        )
    return base, token


def _bot_creds(chat_id: int) -> tuple[str, int]:
    local = _load_local()
    bot = (os.environ.get("TG_BOT_TOKEN") or local.get("bot_token") or "").strip()
    cid = chat_id or int(os.environ.get("TG_CHAT_ID") or local.get("chat_id") or DEFAULT_CHAT_ID)
    return bot, cid


def _post_json(url: str, payload: dict, headers: dict, timeout: int = 30) -> tuple[int, str]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def send_via_buro1(text: str, chat_id: int) -> tuple[bool, str]:
    try:
        base, token = _vps_creds()
    except RuntimeError as exc:
        return False, str(exc)
    payload: dict = {"text": text}
    if chat_id:
        payload["chat_id"] = chat_id
    last_err = ""
    for attempt in range(1, 4):
        try:
            code, body = _post_json(
                f"{base}/admin/send",
                payload,
                {
                    "Content-Type": "application/json; charset=utf-8",
                    "X-Yakor-Token": token,
                    "Accept": "application/json",
                },
            )
            try:
                ok = bool(json.loads(body).get("ok"))
            except Exception:
                ok = False
            if ok:
                return True, body
            last_err = f"HTTP {code}: {body}"
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
        if attempt < 3:
            time.sleep(1.5 * attempt)
    return False, last_err


def send_via_bot_api(text: str, chat_id: int) -> tuple[bool, str]:
    bot, cid = _bot_creds(chat_id)
    if not bot:
        return False, (
            "buro1 недоступен и нет TG_BOT_TOKEN / config.local.json. "
            "Пока VPS лежит - положи токен BotFather в env или в "
            f"{LOCAL_CFG}"
        )
    try:
        code, body = _post_json(
            f"https://api.telegram.org/bot{bot}/sendMessage",
            {"chat_id": cid, "text": text},
            {"Content-Type": "application/json; charset=utf-8"},
            timeout=45,
        )
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"
    try:
        ok = bool(json.loads(body).get("ok"))
    except Exception:
        ok = False
    if ok:
        return True, body
    return False, f"HTTP {code}: {body}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("message", nargs="?", default="")
    ap.add_argument("--text", default="")
    ap.add_argument("--chat-id", type=int, default=0)
    ap.add_argument("--direct", action="store_true", help="Сразу Bot API, без VPS")
    args = ap.parse_args()
    text = (args.text or args.message or "").strip()
    if not text:
        print(json.dumps({"ok": False, "error": "text required"}, ensure_ascii=False))
        return 1

    chat_id = args.chat_id
    if not args.direct:
        ok, body = send_via_buro1(text, chat_id)
        if ok:
            print(body)
            return 0
        print(f"vps fail: {body}", file=sys.stderr)
    else:
        body = "skipped (--direct)"

    ok2, body2 = send_via_bot_api(text, chat_id)
    if ok2:
        print(body2)
        return 0
    print(json.dumps({"ok": False, "error": body2, "buro1": body}, ensure_ascii=False), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
