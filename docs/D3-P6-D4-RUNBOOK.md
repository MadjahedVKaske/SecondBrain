# D3 + P6 + D4: безопасный путь в production

Статус: план. Этот документ **не разрешает** изменения VPS. Каждый внешний шаг запускается только после отдельного подтверждения пользователя и собственного preflight.

## Зачем этапы объединены

P6 задаёт секреты, SSH, backup и release-механику. D3 использует их для обратимой выкладки P1–P5 на текущий VPS. D4 повторяет уже проверенный release на новой чистой VM и выполняет контролируемый cutover.

```text
P6.0 ротация и инвентаризация
  → P6.1 backup / SSH / TLS / release foundation
  → D3 обратимый Desk release на текущий VPS
  → наблюдение и restore drill
  → D4 параллельная чистая VM и cutover
  → P6.2 финальный аудит и регулярные backup
```

D3 не меняет TG/wake/infra. D4 не совмещается с новой фичей или массовой ротацией.

## Подтверждённые блокеры

- `scripts/desk_push_prod.py` отсутствует: deploy ещё не реализован.
- Старые SSH-скрипты используют `root`, фиксированный адрес и `AutoAddPolicy`; это не транспорт для D3/D4.
- `desk_wake_setup.py` и `desk_migrate_to_vps.py` содержат старые пути и могут менять prod. До отдельного брифа запрещены.
- В истории Git найден Telegram bot token в старой версии `src/pages/Contacts.tsx` и credential-bearing `public/api/config.php`. Значения не повторять. GitHub PAT текущим локальным сканом не найден, но ранее сообщённую внешнюю утечку считать действующей.
- Локально есть игнорируемые plaintext-конфиги. Игнорирование Git не заменяет ротацию и контроль доступа.
- Текущий dump не имеет off-host копии, шифрования, retention и доказанного restore.
- HTTPS, реальный TG poller unit, nginx/systemd/cron и recovery-доступ должны быть подтверждены инвентаризацией, а не предположены.

## P6.0 — containment и ротация

До D3 создать игнорируемый inventory без значений секретов: владелец, потребитель, место хранения, дата замены, дата отзыва, проверка.

Ротировать:

1. Telegram bot/admin/webhook secrets.
2. Desk view/admin tokens и пароль MySQL app-user.
3. GitHub/Yakor/deploy credentials.
4. Contact/boats/B24 credentials, если они используют затронутые значения.
5. SSH: отдельный `brain-deploy`, отдельный ключ, без постоянного root-доступа.

Правило: сначала новый секрет и health потребителя, затем отзыв старого. Отозванный секрет не является rollback; при сбое выпускается следующий новый секрет.

Gate P6.0:

- новый секрет работает, старый не работает;
- секрет не появился в URL, stdout, diff, release manifest или логах;
- локальные реальные значения только в `.secrets/`/`config.local.*` с ограниченным доступом;
- выполнен повторный history/working-tree secret scan.

До открытия D3 обязателен transport cleanup:

- все remote/prod Desk/TG/Yakor/admin клиенты используют только `https://`; HTTP fallback удалён, credential-bearing HTTP-запрос не редиректится с сохранением заголовка, а отклоняется до приложения. Локальный loopback `127.0.0.1` остаётся допустимым для dev/runtime;
- TG admin API больше не принимает `?token=`; только `Authorization: Bearer` или отдельный header по HTTPS;
- Desk больше не принимает постоянный `?k=`; вход — POST/одноразовый bootstrap с немедленной Secure+HttpOnly cookie, API — cookie/header;
- `tools/buro1-tg-inbox` и project rules не содержат HTTP default после cutover;
- `config.sample.php` никогда не используется как runtime config. Отсутствующий, пустой или `change-me` config даёт fail-closed `503`;
- real config существует до traffic enable, принадлежит `root:<service-group>`, mode не шире `0640`; sample содержит только пустые/фиктивные значения и никакие персональные ID.

## P6.1 — основа текущего VPS

### Read-only baseline

Сначала сохранить в игнорируемый `_tmp/audit/`:

- OS, PHP, MySQL, nginx и расширения;
- users, sshd, host fingerprint, firewall, открытые порты, fail2ban;
- nginx vhosts/document roots и TLS;
- systemd/cron units, TG poller, его offset/data/uploads;
- MySQL bind/grants, ownership/mode конфигов;
- текущий release SHA и фактический состав Desk/TG.

### Backup gate

До любого deploy:

- provider snapshot текущей VM;
- Desk MySQL dump `--single-transaction`;
- tar кода, TG data/uploads/offset и runtime-конфигов;
- SHA-256 manifest без содержимого секретов;
- две независимые копии, одна off-host и зашифрованная;
- restore в изолированную БД/директорию с проверкой schema, counts и контрольных записей.
- D3 backup не старше 15 минут; D4 final backup создаётся после write-freeze. Цель D4: RPO 0 для подтверждённых записей, rollback RTO не более 60 минут.
- новый dump включает schema/data, triggers, routines и events; grants сохраняются отдельно в зашифрованном inventory. Пароль передаётся через временный `0600` defaults-file/stdin, никогда аргументом процесса.
- ключ шифрования хранится вне VPS, репозитория и каталога backup (password manager/offline recovery copy); test decrypt обязателен.
- retention минимум 7 daily + 4 weekly; удаление старых копий только после успешного нового restore drill.

Непроверенный restore = backup отсутствует.

### Security baseline

- deploy user без password login, pinned host fingerprint, `RejectPolicy`;
- первичный fingerprint получить out-of-band через provider console и записать в отдельный known_hosts; смена fingerprint блокирует работу до отдельного подтверждения и повторной console-проверки;
- sudoers для `brain-deploy` разрешает только root-owned wrapper-команды release/rollback/status/backup; запрещены общий shell/sudo, чтение shared secrets и запись вне release staging;
- root/password SSH отключать только после двух проверенных deploy-сессий и проверки provider console;
- UFW default deny; публичны только управляемый SSH и 80/443;
- MySQL и внутренние сервисы только loopback;
- TLS для всех remote/prod credential-bearing endpoint: Desk, TG admin, Yakor/admin и служебные API. После перехода remote-клиенты не имеют HTTP fallback; loopback dev/runtime разрешён; HSTS только после проверки HTTPS;
- secrets вне release, права только root/process group;
- для Desk подготовить отдельный active symlink: nginx locations `/desk` и `/api/desk` указывают на `current/public`, а TG/boats/contact остаются на прежних независимых путях;
- `public/api/desk/config.php` и runtime `_data` внутри release — только symlink на `/var/www/brain/shared/desk/`; содержимое shared не копируется в artifact;
- ровно один TG poller; никаких reverse SSH, ngrok или входящих туннелей.

Gate P6.1: baseline зафиксирован, restore PASS, recovery-доступ PASS, порты/SSH/TLS PASS, TG runtime воспроизводим.

## D3 — обратимый release P1–P5

### Новый deploy harness

Нужен `scripts/desk_push_prod.py` со следующими свойствами:

- по умолчанию только `--dry-run`; запись требует `--apply --commit <exact-sha>`;
- чистый Git worktree и ожидаемый commit обязательны;
- transport читает ignored `.secrets/deploy.json`, не содержит host/user/key/token;
- pinned host key; non-root deploy user;
- allowlist только Desk UI/API; запрет `config.php`, `_data`, TG, boats, contact, brain, scripts и `_tmp`;
- release manifest: commit, timestamp, path, size, SHA-256, schema classification;
- upload в `releases/<sha>.tmp`, проверка checksum/PHP lint, затем rename;
- существующий `releases/<sha>` immutable и никогда не перезаписывается; после проверки staging получает root-owned read-only mode;
- shared config/runtime находятся вне release;
- один `flock` deploy lock блокирует конкурентные deploy/rollback;
- переключение active symlink — одна same-filesystem операция: создать `current.next`, затем `mv -Tf current.next current`; previous SHA сохраняется для rollback;
- команды `status`, `deploy`, `rollback`; логи без секретов.

### Предрелизный gate

- HEAD запушен и совпадает с exact SHA;
- secret scan, `git diff --check`, PHP/JS/Python syntax, unit tests;
- локальный API/CRUD/UI smoke;
- additive/non-destructive schema review;
- previous release обязан быть совместим с новой additive schema; иначе D3 блокируется до отдельного write-freeze + DB rollback плана;
- свежий backup + restore PASS;
- dry-run показывает только allowlist.

### Prod smoke после переключения

- health и авторизованный state;
- pre/post counts задач, клиентов, проектов, works;
- список, drawer, checklists/links;
- P1 идеи, P2 клиент, P3 estimate, P4 digest;
- P5 не входит в prod artifact: отдельно проверить native Codex current/existing/new routing contract;
- тестовая create/update/delete запись удалена;
- TG inbox/poller не изменён;
- независимая visual/API приёмка.

При сбое сначала rollback кода на previous SHA. DB restore — только при доказанном повреждении данных, чтобы не потерять новые записи.

Gate D3: smoke PASS, rollback-путь проверен, TG notification только после независимого PASS. Затем период наблюдения 7 дней.

## D4 — параллельная чистая VM

Не переустанавливать живой VPS. Поднять вторую VM; старый VPS остаётся rollback-контуром минимум 7 дней после cutover.

Версионируемые артефакты без секретов:

```text
infra/vps/bootstrap.sh
infra/vps/nginx/brain.conf
infra/vps/systemd/brain-tg-poller.service
infra/vps/systemd/brain-backup.service
infra/vps/systemd/brain-backup.timer
infra/vps/release.sh
infra/vps/rollback.sh
infra/vps/restore-verify.sh
infra/vps/release-allowlist.txt
infra/vps/secret-inventory.template.md
```

Последовательность:

1. Bootstrap новой VM по P6 baseline; TG poller не запускать.
2. Deploy exact D3 SHA тем же release harness.
3. Передать новые secrets вне Git, проверить ownership/mode.
4. Restore копий Desk DB и TG data; health без внешнего трафика.
5. Независимый restore/infra audit.
6. Снизить DNS TTL заранее.
7. Maintenance window: включить на старом Desk серверный maintenance/write-freeze для POST/PUT/PATCH/DELETE, дождаться завершения PHP/MySQL writes и зафиксировать единую точку отсечения.
8. Снять final DB snapshot после freeze; на новой VM restore и повторная сверка schema/counts/checksums. До совпадения DNS не переключать.
9. Fencing TG: штатно остановить old poller, дождаться exit, выполнить `disable --now` + `mask`, убрать его runtime credential из unit environment в encrypted backup; проверить отсутствие cron, процесса и активных соединений.
10. Зафиксировать old offset N, inbox count/hash, атомарно скопировать TG data. На новой VM до старта должны совпасть offset N/count/hash.
11. Запустить ровно один new poller, выполнить DNS/routing cutover. Первый controlled update должен обработаться ровно один раз и иметь монотонный update id.
12. Desk smoke и один контролируемый TG send/receive, затем снять maintenance.
13. Rollback до новых записей: fence new poller, вернуть routing, восстановить old credential/unit и offset. После новых записей простой DNS rollback запрещён: снова freeze, fence new, перенести свежий DB/TG state обратно, сверить counts/offset и только затем включить old.
14. Удаление старой VM — отдельное подтверждение после 7 дней и проверенного backup.

## После D4

- Git `main` — источник кода; auto-deploy запрещён.
- Ежедневный encrypted dump Desk + TG data backup, checksum и retention.
- Периодический restore drill, а не только проверка наличия файла.
- Server release status хранит только SHA/time/schema/health, без secrets.
- Prod → local только read-only backup/pull; local DB никогда автоматически не пушится в prod.

## Решения пользователя

Отдельное подтверждение требуется перед каждым пунктом:

1. Ротация внешних credentials.
2. Изменение SSH/firewall/TLS текущего VPS.
3. D3 deploy exact SHA.
4. Заказ новой VM и DNS cutover.
5. Удаление/остановка старой VM.

Stop: неизвестный host fingerprint, нет provider console, restore не доказан, dirty tree, checksum/count mismatch, secret в artifact/log, нет previous SHA или smoke FAIL.

## Агентские роли

- Research/classification: Luna medium.
- Architecture/runbook: Terra high.
- Deploy code: Terra high.
- Secrets/SSH/firewall threat review: Sol high.
- Independent D3 acceptance: отдельный Terra medium.
- D4: два независимых reviewer-а при возможности — Terra medium + Sol high.
- Финальный prod migration audit: Sol max.

Самоотчёт кодера не закрывает ни один gate.
