#!/usr/bin/env python3
"""Квитанция: куда легло. --notify шлёт в бота, не «ок, понял»."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

NOTIFY = Path(__file__).resolve().with_name("tg_notify.py")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wiki", action="append", default=[])
    ap.add_argument("--raw", action="append", default=[])
    ap.add_argument("--task", action="append", default=[])
    ap.add_argument("--note", default="")
    ap.add_argument("--notify", action="store_true")
    args = ap.parse_args()
    bits = []
    bits += [f"wiki/{p}" if not str(p).startswith("wiki/") else str(p) for p in args.wiki]
    bits += [f"raw/{p}" if not str(p).startswith(("raw/", "brain/")) else str(p) for p in args.raw]
    bits += [f"стол {p}" for p in args.task]
    if args.note:
        bits.append(args.note)
    if not bits:
        print("сохранил → ничего")
        return 1
    text = "сохранил → " + ", ".join(bits)
    print(text)
    if args.notify:
        subprocess.run([sys.executable, str(NOTIFY), text], check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
