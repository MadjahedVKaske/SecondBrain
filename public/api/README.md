# PHP Yakor agent on shared hosting (reg.ru / ISPmanager)

Сайт на виртуальном хостинге без Node/SSH снаружи. Агент = PHP в `/api/`.

## URL для Якоря (ИсточникURL = user)

```
https://buro1.tech/api/yakors/4fc729bb-ee85-4943-bb71-6710c7db4aa4/tasks/
https://buro1.tech/api/yakors/4fc729bb-ee85-4943-bb71-6710c7db4aa4/tasks/results
https://buro1.tech/api/yakors/4fc729bb-ee85-4943-bb71-6710c7db4aa4/files/
```

Token админки (enqueue / чек results): по умолчанию `yakor-dev-token`  
Файл: `public/api/config.php`

## Как залить через панель (без SSH)

1. **Сайты** → buro1.tech → запомни **корневую папку** сайта (document root).
2. **Менеджер файлов** → зайди в эту папку.
3. Залей туда каталог `api` целиком из репы:
   - из `public/api/` (все файлы: `index.php`, `.htaccess`, `config.php`, `_data/`)
4. Рядом с `index.html` сайта должен лежать `.htaccess` из `public/.htaccess` (чтобы `/api/` не уезжал в React SPA).
5. Права на `api/_data`: запись для PHP (обычно 755/775 на папку).

Проверка в браузере:
`https://buro1.tech/api/health`

Должно вернуть JSON `{"ok":true,"service":"yakor-agent-php",...}`.

## Если сайт собирается через `npm run build`

Vite копирует `public/` → `dist/`. После билда в document root должны попасть:
- `dist/api/`
- `dist/.htaccess`
- `dist/index.html` и ассеты

Либо просто руками держи `api/` в корне сайта и не затирай его при выкладке статики.

## Положить задачу (Cursor / ты)

```bash
curl -s -X POST "https://buro1.tech/api/yakors/4fc729bb-ee85-4943-bb71-6710c7db4aa4/admin/enqueue" ^
  -H "Authorization: Bearer yakor-dev-token" ^
  -H "Content-Type: application/json" ^
  -d "{\"tool\":\"heartbeat\",\"project_id\":\"<uuid проекта>\",\"params\":{}}"
```

## Чекнуть results

```bash
curl -s "https://buro1.tech/api/yakors/4fc729bb-ee85-4943-bb71-6710c7db4aa4/admin/results" ^
  -H "Authorization: Bearer yakor-dev-token"
```
