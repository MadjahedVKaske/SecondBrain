# Стол мозга (desk API)

## Prod (живой)

- URL: `http://45.10.42.191/desk/?k=...` (ключ в `_tmp/ssh/desk-url.txt`, не в git)
- Код на VPS: `/var/www/brain/desk/`, `/var/www/brain/api/desk/`
- Хранение: **MySQL** на VPS (`config.php` → `db_*`)
- Деплой prod: SSH (`scripts/desk_pull_prod.py` / push - см. план dev-prod)

`buro1.tech` / REG.RU FTP - **не использовать** для стола.

## Local dev

План: `brain/plans/2026-08-15-dev-prod-local.md`

```powershell
# зеркало с prod
python scripts/desk_pull_prod.py
python scripts/desk_dump_prod.py

# native Windows runtime
powershell -ExecutionPolicy Bypass -File scripts/mysql_local_start.ps1
powershell -ExecutionPolicy Bypass -File scripts/desk_local_start.ps1
powershell -ExecutionPolicy Bypass -File scripts/desk_local_open.ps1
```

Стол: `http://localhost:8080/desk/?k=dev-local`

Конфиг docker: `docker/desk-config.local.php` → монтируется как `api/desk/config.php`.

Локальные PHP/MySQL runtime и реальные конфиги лежат в `.local/` и `.secrets/`, Git их не отслеживает.
Проверка: `powershell -ExecutionPolicy Bypass -File scripts/desk_local_status.ps1`.

## Синк Tasks (legacy)

`scripts/desk_sync.py` - старый путь Tasks MD → API. Основной источник задач теперь MySQL на столе.

## Бот

`desk_watch.py` - опрос wake на VPS. Reverse SSH запрещён. Не поднимать без команды Жени.
