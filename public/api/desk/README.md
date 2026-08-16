# Стол мозга (desk API)

## Prod (живой)

- URL: текущий prod endpoint фиксируется read-only baseline P6; целевой доступ только по HTTPS. Токен не хранить и не передавать в URL.
- Код на VPS: `/var/www/brain/desk/`, `/var/www/brain/api/desk/`
- Хранение: **MySQL** на VPS (`config.php` → `db_*`)
- Деплой prod: push-скрипт ещё не реализован; безопасный SSH release/rollback описан в `docs/D3-P6-D4-RUNBOOK.md`

`buro1.tech` / REG.RU FTP - **не использовать** для стола.

## Local dev

План: `brain/plans/2026-08-15-dev-prod-local.md`

```powershell
# native Windows runtime
powershell -ExecutionPolicy Bypass -File scripts/mysql_local_start.ps1
powershell -ExecutionPolicy Bypass -File scripts/desk_local_start.ps1
powershell -ExecutionPolicy Bypass -File scripts/desk_local_open.ps1
```

Legacy `desk_pull_prod.py` / `desk_dump_prod.py` заблокированы до P6: root SSH и `AutoAddPolicy`. Безопасная замена описана в runbook.

Стол: `http://127.0.0.1:8080/desk/`. Ключ берётся из игнорируемого `.secrets/desk.local.json`; безопасно открыть страницу можно через `scripts/desk_local_open.ps1`.

Конфиг docker: `docker/desk-config.local.php` → монтируется как `api/desk/config.php`.

Локальные PHP/MySQL runtime и реальные конфиги лежат в `.local/` и `.secrets/`, Git их не отслеживает.
Проверка: `powershell -ExecutionPolicy Bypass -File scripts/desk_local_status.ps1`.

## Дайджест

Вкладка `#digest` показывает утреннюю/вечернюю выжимку из Desk, локальных wiki и календарных событий. CLI использует тот же защищённый API:

```powershell
python scripts/brain_digest.py --mode morning
python scripts/brain_digest.py --mode evening --notify
```

URL и view token читаются из `.secrets/desk.local.json`; TG-реквизиты остаются в отдельных игнорируемых файлах.

## Синк Tasks (legacy)

`scripts/desk_sync.py` - старый путь Tasks MD → API. Основной источник задач теперь MySQL на столе.

## Бот

`desk_watch.py` - опрос wake на VPS. Reverse SSH запрещён. Не поднимать без команды Жени.
