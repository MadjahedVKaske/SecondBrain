# Карта проекта SecondBrain

Один вход: ссылки на файлы и что внутри. Обновлять при новых этапах.

**Репо:** `C:\Codex\Projects\Second brain`

---

## С чего начать

| Файл | Зачем |
|------|--------|
| [PROJECT-MAP.md](PROJECT-MAP.md) | этот файл |
| [brain/README.md](brain/README.md) | мозг: что где, P0, dev/prod |
| [brain/wiki/INDEX.md](brain/wiki/INDEX.md) | клиенты, люди, фокус (личное, не в git) |
| [brain/wiki/focus.md](brain/wiki/focus.md) | что делаем сейчас |
| [brain/plans/2026-08-15-dev-prod-local.md](brain/plans/2026-08-15-dev-prod-local.md) | **активный план:** dev/prod, Docker, git, этапы D0-D4 |

---

## Prod и доступ

| Что | Где |
|-----|-----|
| Стол (живой) | current endpoint фиксируется P6 baseline; целевой — HTTPS без токена в URL |
| Ключ стола | prod secret, ротировать в P6; не в Git/URL/TG |
| VPS SSH | legacy root key в текущей копии отсутствует; целевой deploy-доступ — `.secrets/deploy.json` + pinned host |
| Бот API | base URL только из ignored config; P6 переводит credential calls на HTTPS-only |
| Код на сервере | `/var/www/brain/desk/`, `/var/www/brain/api/desk/` |
| БД | MySQL на VPS, реквизиты в `config.php` на сервере |

---

## Dev / prod (локально)

| Файл | Зачем |
|------|--------|
| [brain/plans/2026-08-15-dev-prod-local.md](brain/plans/2026-08-15-dev-prod-local.md) | полный план этапов |
| [docs/D3-P6-D4-RUNBOOK.md](docs/D3-P6-D4-RUNBOOK.md) | безопасный общий runbook: ротация → D3 release → новая VM |
| [brain/wiki/decisions/2026-08-15-p0-closed-dev-prod.md](brain/wiki/decisions/2026-08-15-p0-closed-dev-prod.md) | P0 закрыт + правило dev/prod |
| [docker/desk-compose.yml](docker/desk-compose.yml) | Альтернативный Docker runtime PHP + MySQL |
| [docker/desk-php.Dockerfile](docker/desk-php.Dockerfile) | образ PHP для стола |
| `docker/desk-config.local.php` | ignored локальный Docker-конфиг; реальные значения только локально |
| [scripts/desk_pull_prod.py](scripts/desk_pull_prod.py) | legacy prod → local; root/AutoAddPolicy, до P6 не запускать |
| [scripts/desk_dump_prod.py](scripts/desk_dump_prod.py) | legacy dump; до P6 заменить pinned/non-root backup harness |
| `_tmp/desk/desk-mysql-latest.sql` | последний дамп БД (не в git) |

Локальный Desk после D2: `http://127.0.0.1:8080/desk/`. Запуск и открытие: `scripts/desk_local_start.ps1`, `scripts/desk_local_open.ps1`.

---

## Стол (UI)

| Файл | Зачем |
|------|--------|
| [public/desk/app.js](public/desk/app.js) | логика: задачи, drawer, фильтры, календарь |
| [public/desk/style.css](public/desk/style.css) | стили |
| [public/desk/index.php](public/desk/index.php) | HTML оболочка |
| [public/desk/manifest.webmanifest](public/desk/manifest.webmanifest) | PWA |
| [public/desk/icon.svg](public/desk/icon.svg) | иконка |

---

## API стола

| Файл | Зачем |
|------|--------|
| [public/api/desk/README.md](public/api/desk/README.md) | как устроен API, prod/local |
| [public/api/desk/lib.php](public/api/desk/lib.php) | ядро: MySQL, задачи, связи, чек-листы |
| [public/api/desk/index.php](public/api/desk/index.php) | HTTP роуты |
| [public/api/desk/schema.sql](public/api/desk/schema.sql) | схема БД |
| [public/api/desk/migrate.php](public/api/desk/migrate.php) | миграции данных |
| [public/api/desk/config.sample.php](public/api/desk/config.sample.php) | шаблон конфига |
| `public/api/desk/config.php` | секреты prod (не в git) |

---

## TG / бот

| Файл | Зачем |
|------|--------|
| [public/api/tg/index.php](public/api/tg/index.php) | webhook бота @BuBuBuLu_Bot |
| [public/api/tg/config.sample.php](public/api/tg/config.sample.php) | шаблон |
| TG inbox tool | `tools/buro1-tg-inbox/` |

Чекай: `python tools/buro1-tg-inbox/scripts/tg_inbox.py`

Пинг: `python scripts/tg_notify.py "текст"`

---

## Скрипты (`scripts/`)

| Файл | Зачем |
|------|--------|
| [desk_pull_prod.py](scripts/desk_pull_prod.py) | скачать код стола с VPS |
| [desk_dump_prod.py](scripts/desk_dump_prod.py) | дамп MySQL с VPS |
| [desk_watch.py](scripts/desk_watch.py) | опрос wake стола (сейчас стоп) |
| [desk_sync.py](scripts/desk_sync.py) | legacy: Tasks MD → API |
| [desk_ftp_deploy.py](scripts/desk_ftp_deploy.py) | **не использовать** (REG.RU) |
| [brain_ingest_tg.py](scripts/brain_ingest_tg.py) | голос → raw + wiki |
| [brain_receipt.py](scripts/brain_receipt.py) | квитанция в бота после ingest |
| [brain_digest.py](scripts/brain_digest.py) | локальный утро/вечер дайджест; `--notify` отправляет в TG |
| [desk_local_start.ps1](scripts/desk_local_start.ps1) | запустить локальные MySQL + PHP |
| [desk_local_status.ps1](scripts/desk_local_status.ps1) | проверить runtime, API и MySQL |
| [desk_local_open.ps1](scripts/desk_local_open.ps1) | открыть Desk с локальным ключом из `.secrets/` |
| [brain_lint.py](scripts/brain_lint.py) | проверка wiki после правок |

---

## Мозг (`brain/`)

| Файл | Зачем |
|------|--------|
| [brain/SCHEMA.md](brain/SCHEMA.md) | дерево raw/wiki, куда класть входящее |
| [brain/plans/README.md](brain/plans/README.md) | формат брифов |
| [brain/raw/_inbox/README.md](brain/raw/_inbox/README.md) | сырьё до разбора |
| [brain/raw/meetings/README.md](brain/raw/meetings/README.md) | встречи |
| [brain/raw/tg/](brain/raw/tg/) | голоса с бота (gitignore) |
| [brain/wiki/declined.md](brain/wiki/declined.md) | что не делаем |

### Решения (`brain/wiki/decisions/`)

| Файл | Тема |
|------|------|
| [2026-08-15-p0-closed-dev-prod.md](brain/wiki/decisions/2026-08-15-p0-closed-dev-prod.md) | P0 закрыт, dev/prod |
| [2026-08-15-workflow-3-levels.md](brain/wiki/decisions/2026-08-15-workflow-3-levels.md) | 5 уровней агентов |
| [2026-08-15-desk-lock.md](brain/wiki/decisions/2026-08-15-desk-lock.md) | ключ стола, fail2ban |
| [2026-08-15-desk-ux.md](brain/wiki/decisions/2026-08-15-desk-ux.md) | UX стола |
| [2026-08-15-project-links.md](brain/wiki/decisions/2026-08-15-project-links.md) | клиент → направления |
| [2026-08-15-wake.md](brain/wiki/decisions/2026-08-15-wake.md) | wake / desk_watch |
| [2026-08-15-habits-goals.md](brain/wiki/decisions/2026-08-15-habits-goals.md) | цели и привычки |
| [2026-08-14-vps-brain.md](brain/wiki/decisions/2026-08-14-vps-brain.md) | VPS мозга |

### Брифы (`brain/plans/`)

| Файл | Статус |
|------|--------|
| [2026-08-15-dev-prod-local.md](brain/plans/2026-08-15-dev-prod-local.md) | **активный** |
| [2026-08-15-desk-task-full.md](brain/plans/2026-08-15-desk-task-full.md) | P0, закрыт |
| [2026-08-15-desk-task-card-compact.md](brain/plans/2026-08-15-desk-task-card-compact.md) | P0, закрыт |
| [2026-08-15-desk-watch-100.md](brain/plans/2026-08-15-desk-watch-100.md) | watcher, отложен |
| [2026-08-15-hook-guard-delai.md](brain/plans/2026-08-15-hook-guard-delai.md) | хук «делай», после P5 |

### Клиенты (`brain/wiki/clients/`)

Список имён: [brain/wiki/INDEX.md](brain/wiki/INDEX.md). Файлы: `rubrik.md`, `malina.md`, `delta.md`, `katervl.md`, `yakor.md`, `jewel.md`, `himprom.md`, `cmak.md`, `misshik.md`, `gerryweber.md`, `mis.md`, `polina-b24.md`, `igry.md`.

---

## Cursor rules (`.cursor/rules/`)

| Файл | Зачем |
|------|--------|
| [brain-workflow.mdc](.cursor/rules/brain-workflow.mdc) | 5 уровней, модели, «делай» |
| [second-brain.mdc](.cursor/rules/second-brain.mdc) | ingest, утро/вечер, чекай |
| [tg-inbox.mdc](.cursor/rules/tg-inbox.mdc) | VPS inbox, desk_watch |
| [desk-ui-check.mdc](.cursor/rules/desk-ui-check.mdc) | проверка вёрстки стола |
| [igry-comic-variants.mdc](.cursor/rules/igry-comic-variants.mdc) | комикс «Игры», v3 готов |

---

## Очередь фаз (фичи после dev)

| Фаза | Что | Бриф |
|------|-----|------|
| D0-D4 | dev/prod, docker, git | [dev-prod-local](brain/plans/2026-08-15-dev-prod-local.md) |
| P1 | вкладка «Идеи» | нет |
| P2 | режим клиента | нет |
| P3 | часы → оценка | нет |
| P4 | утро/вечер дайджест | реализовано локально: Desk + wiki + календарь, web + TG |
| P5 | микро-выжимки 3–5 слов + выбор существующей/новой задачи | реализовано через нативные Codex thread tools и `AGENTS.md` |
| P6 | VPS / безопасность | нет |

---

## Служебное (`_tmp/`, не в git)

| Путь | Зачем |
|------|--------|
| `_tmp/ssh/` | ключи VPS, URL стола |
| `_tmp/desk/` | дампы MySQL |
| `_tmp/handoff-2026-08-15-brain.md` | хендофф сессии 15.08 |
| `_tmp/token-analysis-2026-08-15.md` | разбор токенов агентов |
| `_tmp/desk_drawer_deploy.py` | SSH деплой стола на prod |

---

## Git

- Сейчас: стол и brain в основном **не закоммичены**.
- Правило: **коммит = готовый этап** (D1, P1, …).
- Не коммитить: `brain/wiki/`, `brain/raw/`, `brain/plans/`, секреты, `_tmp/`.

---

*Обновлено: 2026-08-15. P0 закрыт. Следующий шаг по плану: D2 Docker (по команде).*
