#!/usr/bin/env python3
"""Опрос стола VPS раз в N секунд. AGENT_LOOP_WAKE_DESK. Reverse SSH нет."""
from __future__ import annotations

import json
import os
import signal
import sys
import time
import traceback
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = os.environ.get("DESK_API", "http://45.10.42.191/api/desk").rstrip("/")
TOKEN = os.environ.get("DESK_ADMIN_TOKEN", "")
INBOX = Path(r"C:\Cursor\Tasks\_inbox")
SEEN = INBOX / "seen.json"
ALIVE = INBOX / "watcher-alive.json"
LOG_FILE = Path(r"C:\Cursor\buro1-insight-hub\_tmp\desk-watch.log")
INTERVAL = int(os.environ.get("DESK_WATCH_SEC", "8"))

_stop = False


class _TeeStream:
    """Дублирует вывод в файл и исходный поток (stream может быть None у pythonw)."""

    def __init__(self, stream, log_path: Path) -> None:
        self._stream = stream
        self._log_path = log_path
        self._log_path.parent.mkdir(parents=True, exist_ok=True)
        self._log = open(self._log_path, "a", encoding="utf-8", errors="replace")

    def write(self, data: str) -> int:
        if not data:
            return 0
        try:
            self._log.write(data)
            self._log.flush()
        except Exception:
            pass
        if self._stream is not None:
            try:
                return self._stream.write(data)
            except Exception:
                pass
        return len(data)

    def flush(self) -> None:
        try:
            self._log.flush()
        except Exception:
            pass
        if self._stream is not None:
            try:
                self._stream.flush()
            except Exception:
                pass

    def reconfigure(self, **kwargs) -> None:
        if self._stream is not None:
            try:
                self._stream.reconfigure(**kwargs)
            except Exception:
                pass


def setup_logging() -> None:
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        sys.stdout = _TeeStream(sys.stdout, LOG_FILE)
        sys.stderr = _TeeStream(sys.stderr, LOG_FILE)
        for stream in (sys.stdout, sys.stderr):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass
    except Exception:
        pass


def log_exception(prefix: str, exc: BaseException) -> None:
    ts = datetime.now(timezone.utc).astimezone().isoformat()
    msg = f"[{ts}] {prefix} {type(exc).__name__}: {exc}\n{traceback.format_exc()}"
    print(msg, flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8", errors="replace") as f:
            f.write(msg + "\n")
    except Exception:
        pass


def on_sigterm(_signum: int, _frame) -> None:
    global _stop
    _stop = True
    print("SIGTERM received, stopping desk_watch", flush=True)


def write_alive() -> None:
    try:
        INBOX.mkdir(parents=True, exist_ok=True)
        payload = {
            "updated_at": datetime.now(timezone.utc).astimezone().isoformat(),
            "pid": os.getpid(),
        }
        ALIVE.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        try:
            with open(LOG_FILE, "a", encoding="utf-8", errors="replace") as f:
                f.write(f"write_alive fail: {type(e).__name__}: {e}\n")
        except Exception:
            pass


def get_pending() -> list:
    req = urllib.request.Request(
        f"{API}/wake",
        headers={"X-Yakor-Token": TOKEN},
    )
    with urllib.request.urlopen(req, timeout=12) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("items") or []


def ack(wid: str) -> None:
    req = urllib.request.Request(
        f"{API}/wake/{wid}/ack",
        data=b"{}",
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Yakor-Token": TOKEN,
        },
    )
    urllib.request.urlopen(req, timeout=12).read()


def load_seen() -> set[str]:
    if not SEEN.is_file():
        return set()
    try:
        return set(json.loads(SEEN.read_text(encoding="utf-8")))
    except Exception:
        return set()


def save_seen(ids: set[str]) -> None:
    INBOX.mkdir(parents=True, exist_ok=True)
    SEEN.write_text(json.dumps(sorted(ids)[-200:]), encoding="utf-8")


def handle_item(it: dict, seen: set[str]) -> bool:
    wid = str(it.get("id") or "")
    if not wid or wid in seen:
        return False
    payload = it.get("payload") or {}
    if not isinstance(payload, dict):
        payload = {"text": str(payload)}
    text = str(payload.get("text") or payload.get("type") or it.get("kind") or "tg")
    latest = {
        "id": wid,
        "kind": it.get("kind"),
        "text": text,
        "payload": payload,
        "created_at": it.get("created_at"),
    }
    INBOX.mkdir(parents=True, exist_ok=True)
    (INBOX / "latest.json").write_text(
        json.dumps(latest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        "AGENT_LOOP_WAKE_DESK "
        + json.dumps(
            {
                "prompt": "чекай VPS inbox, ответь в бота, сделай если задача",
                "id": wid,
                "text": (text or "")[:200],
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    seen.add(wid)
    save_seen(seen)
    try:
        ack(wid)
    except Exception as e:
        print("ack fail", e, flush=True)
    return True


def poll_once(seen: set[str]) -> tuple[str, int, float]:
    t0 = time.time()
    items = get_pending()
    n = 0
    for it in items:
        if isinstance(it, dict) and handle_item(it, seen):
            n += 1
    return "ok", n, time.time() - t0


def main() -> None:
    setup_logging()
    signal.signal(signal.SIGTERM, on_sigterm)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, on_sigterm)

    INBOX.mkdir(parents=True, exist_ok=True)
    seen = load_seen()
    once = "--once" in sys.argv
    print(f"desk_watch poll {API}/wake every {INTERVAL}s (AGENT_LOOP_WAKE_DESK)", flush=True)

    while not _stop:
        try:
            write_alive()
            status, n, dt = poll_once(seen)
            print(f"poll {status} n={n} t={dt:.2f}s", flush=True)
        except KeyboardInterrupt:
            print("KeyboardInterrupt ignored, use SIGTERM to stop", flush=True)
            continue
        except Exception as e:
            log_exception("poll fail", e)
            if once:
                return
        if once:
            return
        if _stop:
            break
        try:
            time.sleep(INTERVAL)
        except KeyboardInterrupt:
            print("KeyboardInterrupt ignored, use SIGTERM to stop", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log_exception("fatal", e)
