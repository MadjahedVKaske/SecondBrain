# План: Git как транспорт и как helper агента

## Цель
Пользак ставит только `git.exe`. Репу, токен, remote, галки авторизации он не настраивает.
Тяжёлая конфа идёт git push, не через HTTP API.

## Два режима git

| Роль | Когда | Кто даёт remote/token |
|---|---|---|
| **Транспорт** (`РежимТранспорта=git`) | REQ/RESP через репу | Dev: PAT + галка. Прод: позже тоже от агента |
| **Helper агента** | `dump_config_git` при `РежимТранспорта=agent` | Агент в `POST /projects/` → `repo_url` + `push_token` → `task.json` |

## Поток prod (агент + git helper)

1. Агент создаёт проект → `{project_id, repo_url, branch, push_token}`
2. Якорь пишет `task.json` (в т.ч. `push_token`), сам `git init` + `origin` с URL+token
3. LongPoll/`dump_config_git` → DESIGNER dump → `configuration/`
4. Перед push: если нет `.git` / origin — доинициализировать из `task.json`
5. `git add configuration` → commit → push (токен уже в remote)
6. Results агенту: `commit_sha` (маленький JSON)

## Правила Якоря

- `GitRemoteРазрешён` (таймер git-транспорта) — по-прежнему галка (не ломать UI auth-диалогами)
- `GitПушРазрешён` — галка **ИЛИ** `push_token` проекта **ИЛИ** глобальный `GitПароль`
- `dump_config_git` / init workdir — через `GitПушРазрешён` + авто-remote
- В лог не писать URL с токеном

## Агент (PHP buro1)

- `config.php`: `github_token`
- `POST .../projects/` → отдаёт `push_token` (= github_token)
- `GET .../admin/credentials` → тот же токен (обновить существующий проект)

## Пользак видит

Git установлен → Якорь → проект → LongPoll → «готово, commit …»  
Не видит: PAT, remote, галку авторизации (в prod UI).

## Тест сейчас

1. Обновить `api/config.php` на хостинге (token)
2. Обновить Якорь (авто-git)
3. Положить `task.json` с `push_token` / `repo_url` в Путепровод
4. Задача `dump_config_git` с агента
