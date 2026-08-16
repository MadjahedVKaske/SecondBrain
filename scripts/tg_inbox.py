#!/usr/bin/env python3
"""Чекай = VPS. Канон: skill buro1-tg-inbox. Сюда не ходить за getUpdates."""
from pathlib import Path
import runpy
import sys

CANON = Path.home() / ".cursor" / "skills" / "buro1-tg-inbox" / "scripts" / "tg_inbox.py"
if not CANON.is_file():
    raise SystemExit(f"нет скилла: {CANON}")
sys.argv[0] = str(CANON)
runpy.run_path(str(CANON), run_name="__main__")
