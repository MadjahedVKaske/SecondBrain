#!/usr/bin/env python3
"""Чекай: читает inbox с VPS. getUpdates не трогает."""
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
LOCAL_CFG = SKILL_ROOT / "config.local.json"
DATA = SKILL_ROOT / "_data"
MEDIA = Path(os.environ.get("TG_MEDIA_DIR", str(DATA / "tg-media")))
STATE = MEDIA / "processed.json"
INBOX_FILE = DATA / "inbox.json"
WHISPER_SKILL = Path(os.environ.get("WHISPER_SKILL", r"C:\Cursor\skills\transcribe-audio-local"))
WHISPER_PY = WHISPER_SKILL / "venv-whisper" / "Scripts" / "python.exe"
TRANSCRIBE = WHISPER_SKILL / "scripts" / "transcribe.py"
DEFAULT_VPS = "http://45.10.42.191/api/tg"
ADMIN_TOKEN = os.environ.get("TG_ADMIN_TOKEN", "")
ASR_TYPES = ("voice", "audio", "video_note")


def load_local_cfg() -> dict:
    if not LOCAL_CFG.is_file():
        return {}
    try:
        raw = json.loads(LOCAL_CFG.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def vps_base() -> str:
    cfg = load_local_cfg()
    return (os.environ.get("TG_BASE_URL") or cfg.get("vps_base") or DEFAULT_VPS).rstrip("/")


def vps_get(path: str, timeout: int = 60) -> dict:
    url = f"{vps_base()}/{path.lstrip('/')}"
    req = urllib.request.Request(
        url,
        headers={"X-Yakor-Token": ADMIN_TOKEN, "Accept": "application/json"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_json(path: Path, default):
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def load_inbox() -> list[dict]:
    raw = load_json(INBOX_FILE, {"items": []})
    items = raw.get("items") if isinstance(raw, dict) else []
    return items if isinstance(items, list) else []


def save_inbox(items: list[dict]) -> None:
    save_json(INBOX_FILE, {"items": items[-500:]})


def load_state() -> dict:
    raw = load_json(STATE, {"done": {}})
    if not isinstance(raw.get("done"), dict):
        raw["done"] = {}
    return raw


def save_state(state: dict) -> None:
    save_json(STATE, state)


def find_txt(out_dir: Path, stem: str) -> Path | None:
    preferred = list(out_dir.rglob("*транскрипция.txt"))
    for p in preferred:
        if stem in p.name:
            return p
    if preferred:
        return preferred[0]
    for p in out_dir.rglob("*.txt"):
        return p
    return None


def transcribe(audio_path: Path) -> str:
    if not WHISPER_PY.is_file() or not TRANSCRIBE.is_file():
        return "[whisper не установлен: C:\\Cursor\\skills\\transcribe-audio-local]"
    out_dir = audio_path.parent / "transcripts" / audio_path.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    cmd = [
        str(WHISPER_PY),
        str(TRANSCRIBE),
        str(audio_path),
        "--output-dir",
        str(out_dir),
        "--language",
        "ru",
        "--device",
        "cuda",
    ]
    proc = subprocess.run(cmd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        return f"[whisper error: {err[:500]}]"
    txt = find_txt(out_dir, audio_path.stem)
    if txt and txt.is_file():
        return txt.read_text(encoding="utf-8").strip()
    for p in out_dir.rglob("*.txt"):
        return p.read_text(encoding="utf-8").strip()
    return "[whisper: файл транскрипции не найден]"


def pull_vps(limit: int) -> dict:
    MEDIA.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    data = vps_get(f"admin/inbox?limit={max(1, min(100, limit))}")
    if not data.get("ok"):
        raise RuntimeError(f"vps inbox: {data}")
    payload = data.get("payload") if isinstance(data.get("payload"), list) else []
    inbox = load_inbox()
    by_id = {str(it.get("id") or ""): it for it in inbox if it.get("id")}
    saved: list[dict] = []
    for it in reversed(payload):
        if not isinstance(it, dict):
            continue
        iid = str(it.get("id") or "")
        if not iid:
            continue
        item = dict(it)
        need_file = bool(item.get("has_file") or item.get("has_file_id") or item.get("file_id"))
        local_existing = Path(by_id[iid]["file"]) if iid in by_id and by_id[iid].get("file") else None
        if need_file and (local_existing is None or not local_existing.is_file()):
            try:
                full = vps_get(f"admin/item/{iid}?file=1", timeout=180)
            except Exception as e:
                item["file_error"] = f"{type(e).__name__}: {e}"
                full = {}
            blob = (full.get("item") or {}) if isinstance(full, dict) else {}
            b64 = blob.get("file_base64") or ""
            if b64:
                filename = blob.get("stored_as") or blob.get("filename") or f"{item.get('type') or 'file'}-{iid[:8]}.bin"
                dest = MEDIA / Path(str(filename)).name
                dest.write_bytes(base64.b64decode(b64))
                item["file"] = str(dest)
                item["file_size"] = dest.stat().st_size
                item["has_file"] = True
            item["text"] = blob.get("text") or item.get("text") or ""
            item["caption"] = blob.get("caption") or item.get("caption") or ""
            item["type"] = blob.get("type") or item.get("type") or "text"
        elif local_existing and local_existing.is_file():
            item["file"] = str(local_existing)
            item["has_file"] = True
        if iid in by_id:
            by_id[iid].update({k: v for k, v in item.items() if v not in ("", None)})
            item = by_id[iid]
        else:
            inbox.append(item)
            by_id[iid] = item
            saved.append(item)
    save_inbox(inbox)
    view = [by_id[str(it.get("id") or "")] for it in payload if str(it.get("id") or "") in by_id]
    return {
        "pulled": len(payload),
        "saved": len(saved),
        "items_view": view,
        "source": "vps",
        "base": vps_base(),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-transcribe", action="store_true")
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--force", action="store_true", help="перешифровать даже уже обработанные")
    args = ap.parse_args()

    try:
        pull = pull_vps(args.limit)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False, indent=2))
        return 1

    inbox = pull.get("items_view") or []
    state = load_state()
    report = {
        "ok": True,
        "source": "vps",
        "base": pull.get("base") or vps_base(),
        "pulled": pull["pulled"],
        "saved_now": pull["saved"],
        "inbox_count": len(inbox),
        "items": [],
    }

    for it in inbox:
        iid = it.get("id") or ""
        typ = it.get("type") or ""
        path = Path(it["file"]) if it.get("file") else None
        entry = {
            "id": iid,
            "type": typ,
            "from": it.get("from_username") or it.get("from_id"),
            "received_at": it.get("received_at"),
            "text": it.get("text") or it.get("caption") or "",
            "has_file": bool(it.get("has_file")),
            "file": it.get("file") or None,
            "file_size": it.get("file_size"),
            "transcript": None,
        }
        already = iid in state["done"] and not args.force
        if typ in ASR_TYPES and path and path.is_file() and not args.no_transcribe:
            if not already:
                entry["transcript"] = transcribe(path)
                state["done"][iid] = {
                    "type": typ,
                    "file": str(path),
                    "transcript_preview": (entry["transcript"] or "")[:200],
                }
                save_state(state)
            else:
                tdir = MEDIA / "transcripts" / path.stem
                txt = find_txt(tdir, path.stem) if tdir.is_dir() else None
                entry["transcript"] = txt.read_text(encoding="utf-8").strip() if txt else (state["done"].get(iid) or {}).get("transcript_preview")
                entry["note"] = "уже было (cached)"
        report["items"].append(entry)

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
