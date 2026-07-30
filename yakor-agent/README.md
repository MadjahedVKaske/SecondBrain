# Yakor agent mock (buro1.tech)

Мини-агент: очередь задач + LongPoll + приём results. Витрина сайта не трогается.

## URL для Якоря (ИсточникURL = user)

Подставь свой `yakor_id` (сейчас factory: `4fc729bb-ee85-4943-bb71-6710c7db4aa4`):

- Агент / LongPoll: `https://buro1.tech/api/yakors/<yakor_id>/tasks/`
- Results: `https://buro1.tech/api/yakors/<yakor_id>/tasks/results`
- Files / files projects: `https://buro1.tech/api/yakors/<yakor_id>/files/`

`projects/` строится Якорем из `/files/` → `/projects/`.

## Локально

```bash
cd yakor-agent
npm install
set YAKOR_AGENT_TOKEN=yakor-dev-token
npm start
```

Health: `http://127.0.0.1:3100/health`

## Положить задачу (я / Cursor)

```bash
curl -s -X POST "http://127.0.0.1:3100/api/yakors/<yakor_id>/admin/enqueue" ^
  -H "Authorization: Bearer yakor-dev-token" ^
  -H "Content-Type: application/json" ^
  -d "{\"tool\":\"heartbeat\",\"project_id\":\"<project_uuid>\",\"params\":{}}"
```

## Чекнуть results

```bash
curl -s "http://127.0.0.1:3100/api/yakors/<yakor_id>/admin/results" ^
  -H "Authorization: Bearer yakor-dev-token"
```

## Nginx (на сервере)

```nginx
location /api/yakors/ {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 60s;
}
```

PM2:

```bash
cd /var/www/buro1.tech/yakor-agent
npm install
pm2 start server.js --name yakor-agent --update-env
pm2 save
```

Env на сервере: `YAKOR_AGENT_TOKEN`, опционально `YAKOR_DEFAULT_REPO_URL`.
