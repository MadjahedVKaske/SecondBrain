#!/usr/bin/env python3
"""Синк задач C:\\Cursor\\Tasks -> стол VPS."""
from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
from pathlib import Path

TASKS = Path(r"C:\Cursor\Tasks")
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


def operator_command() -> list[str]:
    raw = os.environ.get("DESK_OPERATOR_COMMAND", "").strip()
    if not raw:
        raise RuntimeError("DESK_OPERATOR_COMMAND is required; public Desk sync transport is disabled")
    command = shlex.split(raw)
    if not command:
        raise RuntimeError("DESK_OPERATOR_COMMAND is invalid")
    return command


def sync(tasks: list[dict]) -> dict:
    import base64

    body = json.dumps({"tasks": tasks, "events": []}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    encoded = base64.urlsafe_b64encode(body).decode("ascii").rstrip("=")
    try:
        result = subprocess.run(
            [*operator_command(), "desk-sync", encoded],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            timeout=60,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise RuntimeError("desk_operator_unavailable") from exc
    if result.returncode:
        raise RuntimeError("desk_operator_unavailable")
    try:
        output = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("desk_operator_invalid_response") from exc
    if not isinstance(output, dict) or output.get("ok") is not True:
        raise RuntimeError("desk_operator_invalid_response")
    return output


def main() -> None:
    tasks = []
    for p in sorted(TASKS.glob("*.md")):
        if p.name.startswith("_") or p.name.startswith("HANDOFF"):
            continue
        row = parse_task(p)
        if row:
            tasks.append(row)
    out = sync(tasks)
    print(json.dumps(out, ensure_ascii=False))
    view = load_view_url()
    if view:
        print(view)


if __name__ == "__main__":
    main()
