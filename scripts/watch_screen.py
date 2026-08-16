#!/usr/bin/env python3
"""
Лайт-вотчер экрана для долгого обновления 1С в RDP.

Раз в N секунд делает скрин, сравнивает с предыдущим.
Если картинка заметно изменилась - сохраняет файл и (опционально) пишет в TG.

Клики НЕ делает - только скрины + алерт.

Пример:
  pip install pillow
  python watch_screen.py
  python watch_screen.py --interval 60 --threshold 0.4
  python watch_screen.py --no-tg
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageGrab, ImageStat
except ImportError:
    print("Нужен Pillow: pip install pillow", file=sys.stderr)
    raise SystemExit(1)

DEFAULT_OUT = Path(os.environ.get(
    "WATCH_SCREEN_DIR",
    str(Path.home() / "Desktop" / "1c-update-screens"),
))
TG_NOTIFY = Path.home() / ".cursor" / "skills" / "buro1-tg-inbox" / "scripts" / "tg_notify.py"


def sleep_interruptible(seconds: float, stop_file: Path) -> bool:
    """Сон кусками. True = пора остановиться (Ctrl+C или stop-файл)."""
    end = time.time() + max(0.0, seconds)
    try:
        while time.time() < end:
            if stop_file.is_file():
                return True
            time.sleep(min(0.5, max(0.05, end - time.time())))
    except KeyboardInterrupt:
        return True
    return stop_file.is_file()


def grab() -> Image.Image:
    img = ImageGrab.grab()
    # меньше шума мыши/часов - лёгкое сжатие для сравнения
    return img.convert("RGB")


def diff_percent(a: Image.Image, b: Image.Image) -> float:
    if a.size != b.size:
        b = b.resize(a.size)
    diff = ImageChops.difference(a, b)
    stat = ImageStat.Stat(diff)
    # среднее по каналам 0..255 → %
    mean = sum(stat.mean) / len(stat.mean)
    return round(100.0 * mean / 255.0, 3)


def sha(img: Image.Image) -> str:
    return hashlib.md5(img.tobytes()).hexdigest()[:12]


def notify_tg(text: str) -> None:
    if not TG_NOTIFY.is_file():
        print("TG notify script не найден, только локальные файлы", flush=True)
        return
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    try:
        proc = subprocess.run(
            [sys.executable, str(TG_NOTIFY), text],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
            timeout=90,
        )
    except Exception as e:
        print(f"TG FAIL: {type(e).__name__}: {e}", flush=True)
        return
    out = ((proc.stdout or "") + (proc.stderr or "")).strip()
    if proc.returncode == 0:
        print("TG ok", flush=True)
    else:
        print(f"TG FAIL (code {proc.returncode}): {out or 'no output'}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="Скрины экрана + diff + TG alert")
    ap.add_argument("--interval", type=float, default=60.0, help="Секунд между скринами (default 60)")
    ap.add_argument("--threshold", type=float, default=0.4, help="% отличия для алерта (default 0.4)")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Папка скринов")
    ap.add_argument("--no-tg", action="store_true", help="Не слать в Telegram")
    ap.add_argument("--save-every", action="store_true", help="Сохранять каждый скрин, не только при изменении")
    args = ap.parse_args()

    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)
    latest = out / "latest.png"
    meta_path = out / "last_event.json"

    print(f"Папка: {out}")
    print(f"Интервал: {args.interval}s, порог: {args.threshold}%")
    print("Стоп: Ctrl+C  или  создай файл stop.txt в папке скринов")
    print("Клики сам.")
    print("Пауза 3с перед первым скрином (убери фокус с cmd)…", flush=True)
    print("---")

    stop_file = out / "stop.txt"
    if stop_file.is_file():
        stop_file.unlink()

    if sleep_interruptible(3.0, stop_file):
        if stop_file.is_file():
            print("Стоп (stop.txt).")
        else:
            print("\nСтоп (Ctrl+C).")
        return 0

    prev: Image.Image | None = None
    n = 0
    try:
        while True:
            if stop_file.is_file():
                print("Стоп (stop.txt).")
                break

            n += 1
            now = datetime.now()
            stamp = now.strftime("%Y%m%d_%H%M%S")
            try:
                img = grab()
            except KeyboardInterrupt:
                print("\nСтоп (Ctrl+C).")
                break

            img.save(latest, "PNG")

            changed = False
            pct = 0.0
            if prev is None:
                changed = False
                pct = 0.0
                reason = "базовый кадр (без алерта)"
                # всё равно сохраняем baseline локально
                path = out / f"screen_{stamp}_{sha(img)}.png"
                img.save(path, "PNG")
                meta_path.write_text(
                    json.dumps(
                        {
                            "time": now.isoformat(timespec="seconds"),
                            "file": str(path),
                            "latest": str(latest),
                            "diff_percent": 0.0,
                            "changed": False,
                            "n": n,
                            "baseline": True,
                        },
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )
                print(f"[{stamp}] #{n} {reason}", flush=True)
                prev = img
                if sleep_interruptible(max(5.0, args.interval), stop_file):
                    if stop_file.is_file():
                        print("Стоп (stop.txt).")
                    else:
                        print("\nСтоп (Ctrl+C).")
                    break
                continue
            else:
                pct = diff_percent(prev, img)
                if pct >= args.threshold:
                    changed = True
                    reason = f"diff {pct}%"
                else:
                    changed = False
                    reason = f"без изменений ({pct}%)"

            line = f"[{stamp}] #{n} {reason}"
            print(line, flush=True)

            if changed or args.save_every:
                path = out / f"screen_{stamp}_{sha(img)}.png"
                img.save(path, "PNG")
                event = {
                    "time": now.isoformat(timespec="seconds"),
                    "file": str(path),
                    "latest": str(latest),
                    "diff_percent": pct,
                    "changed": changed,
                    "n": n,
                }
                meta_path.write_text(json.dumps(event, ensure_ascii=False, indent=2), encoding="utf-8")
                if changed and not args.no_tg:
                    notify_tg(
                        f"1С/RDP экран изменился ({pct}%).\n"
                        f"Файл: {path.name}\n"
                        f"Папка: {out}"
                    )

            prev = img
            if sleep_interruptible(max(5.0, args.interval), stop_file):
                if stop_file.is_file():
                    print("Стоп (stop.txt).")
                else:
                    print("\nСтоп (Ctrl+C).")
                break
    except KeyboardInterrupt:
        print("\nСтоп (Ctrl+C).")

    if stop_file.is_file():
        try:
            stop_file.unlink()
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
