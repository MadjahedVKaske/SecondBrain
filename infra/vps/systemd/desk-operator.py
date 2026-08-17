#!/usr/bin/env python3
"""Root-only, narrow Desk bridge; it does not use or weaken HTTP CSRF."""
from __future__ import annotations

import base64
import json
import re
import subprocess
import sys
from typing import Any

DOCKER = "/usr/bin/docker"
CONTAINER = "secondbrain-app-1"
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
STATUSES = {"todo", "doing", "on_test", "waiting_reply", "done", "paused"}

WAKE_LIST_PROGRAM = r'''
require "/var/www/html/api/desk/lib.php";
$limit = max(1, min(100, (int)$argv[1]));
$out = [];
foreach (array_slice(desk_pending_wake(), 0, $limit) as $item) {
    if (!is_array($item) || !preg_match('/^[0-9a-f-]{36}$/i', (string)($item['id'] ?? ''))) continue;
    $payload = is_array($item['payload'] ?? null) ? $item['payload'] : [];
    $safe = [];
    foreach (['type', 'text', 'tg_id', 'has_file'] as $key) {
        if (array_key_exists($key, $payload)) $safe[$key] = $payload[$key];
    }
    if (isset($safe['text'])) $safe['text'] = mb_substr((string)$safe['text'], 0, 4000);
    $out[] = ['id'=>(string)$item['id'], 'kind'=>(string)($item['kind'] ?? ''), 'payload'=>$safe, 'created_at'=>(string)($item['created_at'] ?? '')];
}
echo json_encode(['ok'=>true, 'items'=>$out], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
'''

WAKE_ACK_PROGRAM = r'''
require "/var/www/html/api/desk/lib.php";
$id = (string)$argv[1];
if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id)) exit(64);
echo json_encode(['ok'=>desk_ack_wake($id)]);
'''

SYNC_PROGRAM = r'''
require "/var/www/html/api/desk/lib.php";
$encoded = strtr((string)$argv[1], '-_', '+/');
$encoded .= str_repeat('=', (4 - strlen($encoded) % 4) % 4);
$raw = base64_decode($encoded, true);
$body = is_string($raw) ? json_decode($raw, true) : null;
if (!is_array($body) || array_keys($body) !== ['tasks', 'events'] || !is_array($body['tasks']) || $body['events'] !== []) exit(64);
$store = desk_upsert_from_sync($body['tasks'], []);
echo json_encode(['ok'=>true, 'tasks'=>count($store['tasks']), 'events'=>count($store['events']), 'storage'=>desk_pdo() ? 'mysql' : 'json']);
'''


def fail(error: str, code: int = 1) -> int:
    print(json.dumps({"ok": False, "error": error}, separators=(",", ":")))
    return code


def run_php(program: str, argument: str, kind: str) -> int:
    try:
        result = subprocess.run(
            [DOCKER, "exec", "-i", CONTAINER, "php", "-d", "display_errors=0", "-r", program, argument],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            timeout=45,
        )
    except (OSError, subprocess.SubprocessError):
        return fail("desk_operator_unavailable")
    if result.returncode:
        return fail("desk_operator_unavailable")
    try:
        response = json.loads(result.stdout)
        if kind == "wake-list":
            if set(response) != {"ok", "items"} or response["ok"] is not True or not isinstance(response["items"], list):
                raise ValueError
        elif kind == "wake-ack":
            if set(response) != {"ok"} or not isinstance(response["ok"], bool):
                raise ValueError
        elif (set(response) != {"ok", "tasks", "events", "storage"} or response["ok"] is not True
              or not isinstance(response["tasks"], int) or not isinstance(response["events"], int)
              or response["storage"] != "mysql"):
            raise ValueError
    except (TypeError, ValueError, json.JSONDecodeError):
        return fail("desk_operator_invalid_response")
    print(json.dumps(response, ensure_ascii=False, separators=(",", ":")))
    return 0


def clean_text(value: Any, maximum: int, field: str) -> str:
    if not isinstance(value, str) or len(value) > maximum or "\x00" in value:
        raise ValueError(field)
    return value


def clean_sync(encoded: str) -> str:
    try:
        raw = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        body = json.loads(raw)
        if not isinstance(body, dict) or list(body) != ["tasks", "events"] or body["events"] != []:
            raise ValueError("body")
        tasks = body["tasks"]
        if not isinstance(tasks, list) or len(tasks) > 500:
            raise ValueError("tasks")
        cleaned = []
        for task in tasks:
            if not isinstance(task, dict) or set(task) != {"slug", "title", "area", "client", "status", "due", "notes", "source_file"}:
                raise ValueError("task")
            due = task["due"]
            if due is not None and (not isinstance(due, str) or not DATE.fullmatch(due)):
                raise ValueError("due")
            status = task["status"]
            if not isinstance(status, str) or status not in STATUSES:
                raise ValueError("status")
            cleaned.append({
                "slug": clean_text(task["slug"], 160, "slug"),
                "title": clean_text(task["title"], 500, "title"),
                "area": clean_text(task["area"], 250, "area"),
                "client": clean_text(task["client"], 250, "client"),
                "status": status,
                "due": due,
                "notes": clean_text(task["notes"], 4000, "notes"),
                "source_file": clean_text(task["source_file"], 260, "source_file"),
            })
    except (TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
        raise ValueError("invalid_sync") from None
    clean = json.dumps({"tasks": cleaned, "events": []}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(clean).decode("ascii").rstrip("=")


def main() -> int:
    if len(sys.argv) == 3 and sys.argv[1] == "wake-list" and sys.argv[2].isdigit():
        return run_php(WAKE_LIST_PROGRAM, str(max(1, min(100, int(sys.argv[2])))), "wake-list")
    if len(sys.argv) == 3 and sys.argv[1] == "wake-ack" and UUID.fullmatch(sys.argv[2]):
        return run_php(WAKE_ACK_PROGRAM, sys.argv[2], "wake-ack")
    if len(sys.argv) == 3 and sys.argv[1] == "sync":
        try:
            encoded = clean_sync(sys.argv[2])
        except ValueError:
            return fail("invalid_sync", 64)
        return run_php(SYNC_PROGRAM, encoded, "sync")
    return fail("usage", 64)


if __name__ == "__main__":
    raise SystemExit(main())
