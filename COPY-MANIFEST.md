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
- каталог и файл исключены из Git;
- репозиторий содержит только `config.sample.json` без рабочих значений.

Изменения выполняются только внутри рабочего корня. Исходный проект Cursor не изменяется.
