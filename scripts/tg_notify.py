#!/usr/bin/env python3
"""Project entry point for VPS Telegram notifications."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


TARGET = Path(__file__).resolve().parents[1] / "tools" / "buro1-tg-inbox" / "scripts" / "tg_notify.py"


if __name__ == "__main__":
    raise SystemExit(subprocess.call([sys.executable, str(TARGET), *sys.argv[1:]]))
