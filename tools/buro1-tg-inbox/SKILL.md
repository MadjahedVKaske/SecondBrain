---
name: buro1-tg-inbox
description: >-
  Чекай = inbox Telegram-бота на VPS brain (текст/фото/голос, CUDA whisper)
  и notify в того же бота. Use when user says чекай/забирай/проверь бота,
  mentions TG inbox/bot, or a long job finishes and needs a "готово" ping.
---

# Чекай = VPS

Приём 24/7 на VPS. Полллер `tg-poller` сам ходит в Telegram. Агент **только читает** уже лежащий inbox.

Транспорт — только закрытая SSH-команда `secondbrain-operator`; публичного TG
API в Caddy нет. Перед вызовом в локальной сессии установить
`TG_OPERATOR_COMMAND` в pinned-host-key SSH-команду, оканчивающуюся
`sudo /usr/local/sbin/secondbrain-operator`.

**Не** getUpdates. **Не** `admin/pull`. **Не** `buro1.tech/api/tg`. **Не** `--direct`.
Не просить файлы с телефона, если они уже в боте.

## Чекай / забирай / проверь бота

```bash
python "C:/Codex/Projects/Second brain/tools/buro1-tg-inbox/scripts/tg_inbox.py"
```

1. вызывает `secondbrain-operator tg-inbox` через SSH;
2. сохраняет только sanitised metadata и текст в локальный `_data/inbox.json`;
3. медиа не скачивает: для него нужен отдельный одобренный transport.

Флаг: `--limit`.

## Notify после длинных задач

```bash
python "C:/Codex/Projects/Second brain/tools/buro1-tg-inbox/scripts/tg_notify.py" --chat-id 123 "Готово: кратко что сделано"
```

После успеха или явного фейла. Не спамить. Без токенов в тексте.

Команда кодирует только текст и chat ID, а Bot token остаётся внутри TG
контейнера. Ошибки транспорта не печатают секреты.

## Конфиг

| Что | Значение |
|---|---|
| Transport | `TG_OPERATOR_COMMAND` (SSH с pinned host key) |
| Локальный cache | `tools/buro1-tg-inbox/_data/inbox.json` |

Не задавать `TG_ADMIN_TOKEN`, `TG_BASE_URL` или `TG_BOT_TOKEN`: legacy public/direct
transport удалён. Bot token и config на VPS не читать и не печатать.

## Стол

Доска на новой VPS: `https://brain.buro1.tech/desk/` (сессия, ключ не в URL).
Синк использует только `DESK_OPERATOR_COMMAND` — SSH-команду с pinned host key,
оканчивающуюся `sudo /usr/local/sbin/secondbrain-operator`:

```powershell
python "C:\Codex\Projects\Second brain\scripts\desk_sync.py"
```

Не путать с Якорь `/api/yakors/...`.

## Wake агента

Тачка сама опрашивает закрытую `secondbrain-operator desk-wake-list` команду
раз в ~8с. Reverse SSH и публичный wake API для оператора не используются.
Новое сообщение → строка `AGENT_LOOP_WAKE_DESK` (будит этот чат).
Если wake прилетел - чекай inbox, ответь в бота, делай здесь. Не спрашивай про новый чат. Новую вкладку из бота открыть нельзя.

```powershell
python "C:\Codex\Projects\Second brain\scripts\desk_watch.py"
```
