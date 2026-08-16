# Манифест рабочей копии

- Источник: `C:\Cursor\buro1-insight-hub` — только чтение.
- Рабочий корень: `C:\Codex\Projects\Second brain`.
- Дата копирования: 2026-08-16.

## Скопировано

- публичный React/Vite-сайт (`src/` и корневые конфиги);
- desk UI и API (`public/desk/`, `public/api/desk/`);
- Telegram, boats и Yakor API (`public/api/`);
- Docker и рабочие скрипты (`docker/`, `scripts/`);
- `brain/`, включая локальные `wiki/`, `raw/`, `plans/`;
- Yakor agent, Bitrix24 widget, deploy-документация и Cursor rules;
- локальная копия инструмента `buro1-tg-inbox` без runtime и секретного конфига;
- SQL-дамп для локального импорта в `.local/desk/`.

## Исключено из обычной копии

- исходный `.git/`;
- `node_modules/`, сборки, логи, zip и Python cache;
- `_tmp/`, SSH-ключи, браузерные профили и runtime `_data/`;
- сгенерированные deploy stage-каталоги;
- реальные `config.php`, `.env*`, `*.local*` и `config.local.json`.

## Локальные секреты

- `tools/buro1-tg-inbox/config.local.json` — доступ к VPS notify;
- `.secrets/mysql.local.json` — учётные данные локальной MySQL;
- `.secrets/desk.local.json` и `docker/desk-config.local.php` — локальные ключи desk;
- секретные файлы исключены из Git;
- репозиторий содержит только `config.sample.json` без рабочих значений.

## Локальная база

- MySQL Community Server 8.4.10 LTS установлен в `.local/mysql/`;
- сервер работает на `127.0.0.1:3307`;
- база `desk` импортирована из локального prod-дампа: 13 таблиц;
- управление: `scripts/mysql_local_start.ps1`, `mysql_local_status.ps1`, `mysql_local_stop.ps1`.

## Локальный web

- PHP 8.5.9 NTS установлен в `.local/php/`, официальный SHA256 проверен;
- Second Brain работает на `http://127.0.0.1:8080/desk/`;
- управление: `scripts/desk_local_start.ps1`, `desk_local_status.ps1`, `desk_local_stop.ps1`;
- `scripts/desk_local_open.ps1` открывает авторизованный локальный URL без хранения токена в Git.

Изменения выполняются только внутри рабочего корня. Исходный проект Cursor не изменяется.
