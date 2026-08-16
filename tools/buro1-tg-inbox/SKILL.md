---
name: buro1-tg-inbox
description: >-
  Чекай = inbox Telegram-бота на VPS brain (текст/фото/голос, CUDA whisper)
  и notify в того же бота. Use when user says чекай/забирай/проверь бота,
  mentions TG inbox/bot, or a long job finishes and needs a "готово" ping.
---

# Чекай = VPS

Приём 24/7 на VPS. Полллер `tg-poller` сам ходит в Telegram. Агент **только читает** уже лежащий inbox.

База: `http://45.10.42.191/api/tg` (потом `https://brain.buro1.tech/api/tg`).

**Не** getUpdates. **Не** `admin/pull`. **Не** `buro1.tech/api/tg`. **Не** `--direct`.
Не просить файлы с телефона, если они уже в боте.

## Чекай / забирай / проверь бота

```bash
python "C:/Codex/Projects/Second brain/tools/buro1-tg-inbox/scripts/tg_inbox.py"
```

1. GET `/admin/inbox` на VPS
2. файлы - GET `/admin/item/{id}?file=1`, сохранить на диск
3. text показать; photo - `Read` по `file`; voice/audio - **полный** `transcript`
4. пусто - коротко сказать, что новых нет

Флаги: `--no-transcribe`, `--force`, `--limit`.

## Notify после длинных задач

```bash
python "C:/Codex/Projects/Second brain/tools/buro1-tg-inbox/scripts/tg_notify.py" "Готово: кратко что сделано"
```

После успеха или явного фейла. Не спамить. Без токенов в тексте.

`POST http://45.10.42.191/api/tg/admin/send`  
Header `X-Yakor-Token: <из локального config.local.json или TG_ADMIN_TOKEN>`

## Конфиг

| Что | Значение |
|---|---|
| Base | `http://45.10.42.191/api/tg` |
| Token | `config.local.json` (не в git) или `TG_ADMIN_TOKEN` |
| Медиа | `tools/buro1-tg-inbox/_data/tg-media/` |
| Whisper | `C:/Cursor/skills/transcribe-audio-local` |

Env: `TG_ADMIN_TOKEN`, `TG_BASE_URL`, `TG_MEDIA_DIR`, `WHISPER_SKILL`.
`bot_token` / `config.local.json` не светить.

## Стол

Доска на VPS: `http://45.10.42.191/desk/?k=...` (ключ не в git).
Синк: `python "C:\Codex\Projects\Second brain\scripts\desk_sync.py"`

Не путать с Якорь `/api/yakors/...`.

## Wake агента

Тачка сама опрашивает VPS: `desk_watch.py` GET `/api/desk/wake` раз в ~8с. Reverse SSH нет.
Новое сообщение → строка `AGENT_LOOP_WAKE_DESK` (будит этот чат).
Если wake прилетел - чекай inbox, ответь в бота, делай здесь. Не спрашивай про новый чат. Новую вкладку из бота открыть нельзя.

```powershell
python "C:\Codex\Projects\Second brain\scripts\desk_watch.py"
```
