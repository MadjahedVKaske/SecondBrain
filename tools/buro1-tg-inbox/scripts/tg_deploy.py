#!/usr/bin/env python3
"""Мёртвый. Бота на REG.RU больше нет, inbox на VPS. Сюда не заливать."""
import json
import sys

print(json.dumps({"ok": False, "error": "tg bot retired from REG.RU, use VPS"}, ensure_ascii=False))
raise SystemExit(1)
