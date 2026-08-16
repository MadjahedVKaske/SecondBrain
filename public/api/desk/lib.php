<?php
/**
 * Desk storage: MySQL if db_name set, else JSON file.
 */

function desk_cfg(): array
{
    static $cfg;
    if ($cfg !== null) {
        return $cfg;
    }
    $path = __DIR__ . '/config.php';
    if (!is_file($path)) {
        $path = __DIR__ . '/config.sample.php';
    }
    $raw = require $path;
    $cfg = is_array($raw) ? $raw : [];
    return $cfg;
}

function desk_data_dir(): string
{
    $dir = __DIR__ . '/_data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

function desk_store_file(): string
{
    return desk_data_dir() . '/store.json';
}

function desk_uuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function desk_now(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function desk_statuses(): array
{
    return ['todo', 'doing', 'waiting_reply', 'on_test', 'paused', 'done'];
}

function desk_empty_store(): array
{
    return [
        'tasks' => [],
        'events' => [],
        'wake' => [],
        'comments' => [],
        'projects' => [],
        'goals' => [],
        'habits' => [],
        'clients' => [],
        'works' => [],
    ];
}

function desk_moscow_date(): string
{
    return (new DateTime('now', new DateTimeZone('Europe/Moscow')))->format('Y-m-d');
}

function desk_moscow_now(): string
{
    return (new DateTime('now', new DateTimeZone('Europe/Moscow')))->format('Y-m-d\TH:i:s');
}

function desk_pdo(): ?PDO
{
    static $pdo = false;
    if ($pdo !== false) {
        return $pdo;
    }
    $cfg = desk_cfg();
    $name = trim((string)($cfg['db_name'] ?? ''));
    if ($name === '') {
        $pdo = null;
        return null;
    }
    $host = (string)($cfg['db_host'] ?? 'localhost');
    $port = (int)($cfg['db_port'] ?? 0);
    if ($port <= 0 && preg_match('/^(.+):(\d+)$/', $host, $match)) {
        $host = $match[1];
        $port = (int)$match[2];
    }
    $user = (string)($cfg['db_user'] ?? '');
    $pass = (string)($cfg['db_pass'] ?? '');
    try {
        $dsn = "mysql:host={$host};";
        if ($port > 0) {
            $dsn .= "port={$port};";
        }
        $dsn .= "dbname={$name};charset=utf8mb4";
        $pdo = new PDO(
            $dsn,
            $user,
            $pass,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
        desk_ensure_schema($pdo);
    } catch (Throwable $e) {
        $GLOBALS['desk_db_error'] = $e->getMessage();
        $pdo = null;
        return null;
    }
    try {
        desk_maybe_import_json($pdo);
    } catch (Throwable $e) {
        $GLOBALS['desk_db_error'] = 'import: ' . $e->getMessage();
    }
    return $pdo;
}

function desk_ensure_schema(PDO $pdo): void
{
    $sql = (string)@file_get_contents(__DIR__ . '/schema.sql');
    if ($sql !== '') {
        foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
            $lines = [];
            foreach (preg_split("/\r\n|\n|\r/", $stmt) as $line) {
                $t = trim($line);
                if ($t === '' || strpos($t, '--') === 0) {
                    continue;
                }
                $lines[] = $line;
            }
            $stmt = trim(implode("\n", $lines));
            if ($stmt === '') {
                continue;
            }
            $pdo->exec($stmt);
        }
    }
    $alters = [
        "ALTER TABLE desk_tasks ADD COLUMN due_start DATETIME NULL",
        "ALTER TABLE desk_tasks ADD COLUMN due_end DATETIME NULL",
        "ALTER TABLE desk_tasks ADD COLUMN all_day TINYINT(1) NOT NULL DEFAULT 1",
        "ALTER TABLE desk_tasks ADD COLUMN wait_contact VARCHAR(190) NOT NULL DEFAULT ''",
        "ALTER TABLE desk_tasks ADD COLUMN wait_until VARCHAR(32) NOT NULL DEFAULT ''",
        "ALTER TABLE desk_tasks ADD COLUMN remind_at VARCHAR(32) NOT NULL DEFAULT ''",
        "ALTER TABLE desk_tasks ADD COLUMN remind_sent TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE desk_tasks ADD COLUMN project_id VARCHAR(36) NOT NULL DEFAULT ''",
        "ALTER TABLE desk_events ADD COLUMN all_day TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE desk_tasks ADD COLUMN client_id VARCHAR(64) NOT NULL DEFAULT ''",
        "ALTER TABLE desk_projects ADD COLUMN client_id VARCHAR(64) NOT NULL DEFAULT ''",
        "ALTER TABLE desk_tasks ADD COLUMN blocked_by VARCHAR(36) NOT NULL DEFAULT ''",
        "ALTER TABLE desk_tasks ADD COLUMN parent_task_id VARCHAR(36) NOT NULL DEFAULT ''",
    ];
    foreach ($alters as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Throwable $e) {
            // колонка уже есть
        }
    }
    try {
        $pdo->exec('ALTER TABLE desk_tasks ADD KEY idx_parent (parent_task_id)');
    } catch (Throwable $e) {
        // индекс уже есть
    }
    try {
        $pdo->exec("UPDATE desk_tasks SET due_start = CONCAT(due_date, ' 00:00:00') WHERE due_start IS NULL AND due_date IS NOT NULL");
    } catch (Throwable $e) {
    }
}

function desk_to_sql_dt($v): ?string
{
    $s = trim((string)$v);
    if ($s === '') {
        return null;
    }
    $s = str_replace('T', ' ', $s);
    $s = preg_replace('/Z$/', '', $s);
    $s = preg_replace('/[+-]\d{2}:\d{2}$/', '', $s);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
        return $s . ' 00:00:00';
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $s)) {
        return $s . ':00';
    }
    return substr($s, 0, 19);
}

function desk_from_sql_dt($v, bool $allDay = false): ?string
{
    if ($v === null || $v === '') {
        return null;
    }
    $s = str_replace(' ', 'T', substr((string)$v, 0, 19));
    if ($allDay) {
        return substr($s, 0, 10);
    }
    return $s;
}

function desk_sql_now(): string
{
    return gmdate('Y-m-d H:i:s');
}

function desk_load_json_file(): array
{
    $file = desk_store_file();
    if (!is_file($file)) {
        return desk_empty_store();
    }
    $raw = json_decode((string)file_get_contents($file), true);
    if (!is_array($raw)) {
        return desk_empty_store();
    }
    $store = desk_empty_store();
    foreach ($store as $k => $_) {
        if (isset($raw[$k]) && is_array($raw[$k])) {
            $store[$k] = $raw[$k];
        }
    }
    desk_attach_task_relations($store['tasks'], null);
    return $store;
}

function desk_maybe_import_json(PDO $db): void
{
    try {
        $n = (int)$db->query('SELECT COUNT(*) FROM desk_tasks')->fetchColumn();
    } catch (Throwable $e) {
        return;
    }
    if ($n > 0) {
        return;
    }
    $json = desk_load_json_file();
    if (!$json['tasks'] && !$json['projects'] && !$json['events']) {
        return;
    }
    desk_save_to_db($db, $json);
}

function desk_load_store(): array
{
    $db = desk_pdo();
    if ($db) {
        return desk_load_from_db($db);
    }
    return desk_load_json_file();
}

function desk_save_store(array $store): void
{
    $db = desk_pdo();
    if ($db) {
        desk_save_to_db($db, $store);
        return;
    }
    $out = desk_empty_store();
    foreach ($out as $k => $_) {
        $out[$k] = array_values($store[$k] ?? []);
    }
    $store = $out;
    $tmp = desk_store_file() . '.tmp';
    file_put_contents(
        $tmp,
        json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
    rename($tmp, desk_store_file());
}

/** Пустая структура связей задачи для state */
function desk_empty_links(): array
{
    return [
        'blocks_out' => [],
        'blocked_by' => [],
        'spawned_from' => [],
        'spawned_to' => [],
        'next' => [],
        'prev' => [],
        'related' => [],
    ];
}

/** Одним проходом: directions, links, checklists+items для всех задач */
function desk_load_task_relations(PDO $db): array
{
    $directions = [];
    try {
        foreach ($db->query('SELECT task_id, direction_id FROM desk_task_directions ORDER BY created_at')->fetchAll() as $r) {
            $tid = (string)$r['task_id'];
            if (!isset($directions[$tid])) {
                $directions[$tid] = [];
            }
            $directions[$tid][] = (string)$r['direction_id'];
        }
    } catch (Throwable $e) {
    }

    $checklists = [];
    $itemsByList = [];
    try {
        foreach ($db->query('SELECT * FROM desk_checklist_items ORDER BY checklist_id, position, created_at')->fetchAll() as $r) {
            $lid = (string)$r['checklist_id'];
            if (!isset($itemsByList[$lid])) {
                $itemsByList[$lid] = [];
            }
            $itemsByList[$lid][] = [
                'id' => (string)$r['id'],
                'text' => (string)$r['text'],
                'done' => !empty($r['done']),
                'position' => (int)$r['position'],
            ];
        }
        foreach ($db->query('SELECT * FROM desk_checklists ORDER BY task_id, position, created_at')->fetchAll() as $r) {
            $tid = (string)$r['task_id'];
            $lid = (string)$r['id'];
            if (!isset($checklists[$tid])) {
                $checklists[$tid] = [];
            }
            $checklists[$tid][] = [
                'id' => $lid,
                'title' => (string)$r['title'],
                'position' => (int)$r['position'],
                'items' => $itemsByList[$lid] ?? [],
            ];
        }
    } catch (Throwable $e) {
    }

    $links = [];
    try {
        foreach ($db->query('SELECT id, from_task, to_task, type FROM desk_task_links')->fetchAll() as $r) {
            $from = trim((string)$r['from_task']);
            $to = trim((string)$r['to_task']);
            $type = (string)$r['type'];
            $lid = (string)$r['id'];
            if (!isset($links[$from])) {
                $links[$from] = desk_empty_links();
            }
            if (!isset($links[$to])) {
                $links[$to] = desk_empty_links();
            }
            if ($type === 'blocks') {
                $links[$from]['blocks_out'][] = ['id' => $lid, 'to' => $to, 'title' => ''];
                $links[$to]['blocked_by'][] = ['id' => $lid, 'from' => $from, 'title' => ''];
            } elseif ($type === 'spawned_from') {
                $links[$to]['spawned_from'][] = ['id' => $lid, 'from' => $from, 'title' => ''];
                $links[$from]['spawned_to'][] = ['id' => $lid, 'to' => $to, 'title' => ''];
            } elseif ($type === 'next') {
                $links[$from]['next'][] = ['id' => $lid, 'to' => $to, 'title' => ''];
                $links[$to]['prev'][] = ['id' => $lid, 'from' => $from, 'title' => ''];
            } elseif ($type === 'related') {
                $links[$from]['related'][] = ['id' => $lid, 'task_id' => $to, 'title' => ''];
                $links[$to]['related'][] = ['id' => $lid, 'task_id' => $from, 'title' => ''];
            }
        }
    } catch (Throwable $e) {
    }

    return [
        'directions' => $directions,
        'checklists' => $checklists,
        'links' => $links,
    ];
}

/** Подставить title в связи по карте id=>title */
function desk_fill_link_titles(array &$links, array $titles): void
{
    $fill = static function (array &$e, string $idKey) use ($titles): void {
        $id = trim((string)($e[$idKey] ?? ''));
        if ($id === '' || trim((string)($e['title'] ?? '')) !== '') {
            return;
        }
        $e['title'] = $titles[$id] ?? '';
    };
    foreach ($links as &$bucket) {
        if (!is_array($bucket)) {
            continue;
        }
        foreach (['blocks_out', 'spawned_to', 'next'] as $k) {
            foreach ($bucket[$k] ?? [] as &$e) {
                $fill($e, 'to');
            }
            unset($e);
        }
        foreach (['blocked_by', 'spawned_from', 'prev'] as $k) {
            foreach ($bucket[$k] ?? [] as &$e) {
                $fill($e, 'from');
            }
            unset($e);
        }
        foreach ($bucket['related'] ?? [] as &$e) {
            $fill($e, 'task_id');
        }
        unset($e);
    }
    unset($bucket);
}

function desk_attach_task_relations(array &$tasks, ?PDO $db = null): void
{
    $titles = [];
    foreach ($tasks as $t) {
        $tid = trim((string)($t['id'] ?? ''));
        if ($tid !== '') {
            $titles[$tid] = (string)($t['title'] ?? '');
        }
    }
    if (!$db) {
        foreach ($tasks as &$t) {
            $t['parent_task_id'] = (string)($t['parent_task_id'] ?? '');
            $t['directions'] = [];
            $t['checklists'] = [];
            $t['links'] = desk_empty_links();
        }
        unset($t);
        return;
    }
    $rels = desk_load_task_relations($db);
    desk_fill_link_titles($rels['links'], $titles);
    foreach ($tasks as &$t) {
        $id = (string)$t['id'];
        $t['parent_task_id'] = (string)($t['parent_task_id'] ?? '');
        $t['directions'] = $rels['directions'][$id] ?? [];
        $t['checklists'] = $rels['checklists'][$id] ?? [];
        $t['links'] = $rels['links'][$id] ?? desk_empty_links();
    }
    unset($t);
}

/** id задачи по id или slug */
function desk_resolve_task_id(PDO $db, string $idOrSlug): ?string
{
    $st = $db->prepare('SELECT id FROM desk_tasks WHERE id = ? OR slug = ? LIMIT 1');
    $st->execute([$idOrSlug, $idOrSlug]);
    $row = $st->fetch();
    return $row ? (string)$row['id'] : null;
}

/** Цикл parent: нельзя сделать child потомком своего предка */
function desk_parent_would_cycle(PDO $db, string $childId, string $parentId): bool
{
    if ($parentId === '') {
        return false;
    }
    if ($childId === $parentId) {
        return true;
    }
    $cur = $parentId;
    $seen = [];
    while ($cur !== '') {
        if ($cur === $childId) {
            return true;
        }
        if (isset($seen[$cur])) {
            break;
        }
        $seen[$cur] = true;
        $st = $db->prepare("SELECT parent_task_id FROM desk_tasks WHERE id = ? LIMIT 1");
        $st->execute([$cur]);
        $row = $st->fetch();
        $cur = trim((string)($row['parent_task_id'] ?? ''));
    }
    return false;
}

/** Цикл blocks: BFS от to по исходящим blocks */
function desk_blocks_would_cycle(PDO $db, string $from, string $to): bool
{
    if ($from === $to) {
        return true;
    }
    $queue = [$to];
    $seen = [$to => true];
    $st = $db->prepare("SELECT to_task FROM desk_task_links WHERE from_task = ? AND type = 'blocks'");
    while ($queue) {
        $cur = array_shift($queue);
        if ($cur === $from) {
            return true;
        }
        $st->execute([$cur]);
        while ($row = $st->fetch()) {
            $next = (string)$row['to_task'];
            if (!isset($seen[$next])) {
                $seen[$next] = true;
                $queue[] = $next;
            }
        }
    }
    return false;
}

function desk_link_types(): array
{
    return ['blocks', 'spawned_from', 'next', 'related'];
}

function desk_load_from_db(PDO $db): array
{
    $out = desk_empty_store();
    try {
        $tasks = $db->query('SELECT * FROM desk_tasks ORDER BY due_start IS NULL, due_start, updated_at DESC')->fetchAll();
    } catch (Throwable $e) {
        $tasks = $db->query('SELECT * FROM desk_tasks ORDER BY updated_at DESC')->fetchAll();
    }
    $events = $db->query('SELECT * FROM desk_events ORDER BY start_at')->fetchAll();
    $wake = $db->query("SELECT * FROM desk_wake WHERE status = 'pending' ORDER BY created_at")->fetchAll();
    $out['tasks'] = array_map('desk_task_from_row', $tasks);
    desk_attach_task_relations($out['tasks'], $db);
    $out['events'] = array_map('desk_event_from_row', $events);
    $out['wake'] = array_map('desk_wake_from_row', $wake);
    try {
        $out['comments'] = array_map('desk_comment_from_row', $db->query('SELECT * FROM desk_comments ORDER BY created_at')->fetchAll());
        $out['projects'] = array_map('desk_project_from_row', $db->query('SELECT * FROM desk_projects ORDER BY updated_at DESC')->fetchAll());
        $out['goals'] = array_map('desk_goal_from_row', $db->query('SELECT * FROM desk_goals ORDER BY updated_at DESC')->fetchAll());
        $out['habits'] = array_map('desk_habit_from_row', $db->query('SELECT * FROM desk_habits ORDER BY updated_at DESC')->fetchAll());
    } catch (Throwable $e) {
    }
    try {
        $out['clients'] = array_map('desk_client_from_row', $db->query('SELECT * FROM desk_clients ORDER BY title')->fetchAll());
    } catch (Throwable $e) {
    }
    try {
        $out['works'] = array_map('desk_work_from_row', $db->query('SELECT * FROM desk_works ORDER BY work_date DESC, created_at DESC')->fetchAll());
    } catch (Throwable $e) {
    }
    return $out;
}

function desk_task_from_row(array $r): array
{
    $allDay = !array_key_exists('all_day', $r) || (int)$r['all_day'] === 1;
    $start = $r['due_start'] ?? $r['due_date'] ?? null;
    return [
        'id' => $r['id'],
        'slug' => $r['slug'],
        'title' => $r['title'],
        'area' => $r['area'],
        'client' => $r['client'],
        'status' => $r['status'],
        'due' => desk_from_sql_dt($start, $allDay),
        'due_end' => desk_from_sql_dt($r['due_end'] ?? null, $allDay),
        'all_day' => $allDay,
        'notes' => $r['notes'],
        'source_file' => $r['source_file'],
        'wait_contact' => $r['wait_contact'] ?? '',
        'wait_until' => $r['wait_until'] ?? '',
        'remind_at' => $r['remind_at'] ?? '',
        'remind_sent' => !empty($r['remind_sent']),
        'client_id' => $r['client_id'] ?? '',
        'parent_task_id' => trim((string)($r['parent_task_id'] ?? '')),
        'created_at' => $r['created_at'],
        'updated_at' => $r['updated_at'],
    ];
}

function desk_event_from_row(array $r): array
{
    $allDay = !empty($r['all_day']);
    return [
        'id' => $r['id'],
        'uid' => $r['uid'],
        'title' => $r['title'],
        'calendar' => $r['calendar_name'],
        'start' => desk_from_sql_dt($r['start_at'], $allDay),
        'end' => desk_from_sql_dt($r['end_at'], $allDay),
        'allDay' => $allDay,
        'description' => $r['description'],
        'updated_at' => $r['updated_at'],
    ];
}

function desk_comment_from_row(array $r): array
{
    return [
        'id' => $r['id'],
        'task_id' => $r['task_id'],
        'text' => $r['body'] ?? ($r['text'] ?? ''),
        'created_at' => $r['created_at'],
    ];
}

function desk_project_from_row(array $r): array
{
    return [
        'id' => $r['id'],
        'title' => $r['title'],
        'status' => $r['status'],
        'area' => $r['area'],
        'notes' => $r['notes'],
        'due' => $r['due_date'] ?? '',
        'client_id' => $r['client_id'] ?? '',
        'created_at' => $r['created_at'],
        'updated_at' => $r['updated_at'],
    ];
}

function desk_goal_from_row(array $r): array
{
    $krs = json_decode((string)($r['krs'] ?? '[]'), true);
    return [
        'id' => $r['id'],
        'title' => $r['title'],
        'horizon' => $r['horizon'],
        'progress' => (int)$r['progress'],
        'krs' => is_array($krs) ? $krs : [],
        'notes' => $r['notes'] ?? '',
        'created_at' => $r['created_at'],
        'updated_at' => $r['updated_at'],
    ];
}

function desk_client_from_row(array $r): array
{
    return [
        'id' => $r['id'],
        'title' => $r['title'],
        'source' => $r['source'] ?? 'desk',
        'created_at' => $r['created_at'],
        'updated_at' => $r['updated_at'],
    ];
}

function desk_work_from_row(array $r): array
{
    return [
        'id' => $r['id'],
        'task_id' => $r['task_id'],
        'date' => substr((string)$r['work_date'], 0, 10),
        'hours' => (float)$r['hours'],
        'note' => $r['note'] ?? '',
        'created_at' => $r['created_at'],
    ];
}

function desk_habit_from_row(array $r): array
{
    $checks = json_decode((string)($r['checks'] ?? '{}'), true);
    return [
        'id' => $r['id'],
        'title' => $r['title'],
        'checks' => is_array($checks) ? $checks : [],
        'created_at' => $r['created_at'],
        'updated_at' => $r['updated_at'],
    ];
}

function desk_wake_from_row(array $r): array
{
    $payload = json_decode((string)$r['payload'], true);
    return [
        'id' => $r['id'],
        'kind' => $r['kind'],
        'payload' => is_array($payload) ? $payload : ['text' => (string)$r['payload']],
        'status' => $r['status'],
        'created_at' => $r['created_at'],
    ];
}

function desk_save_to_db(PDO $db, array $store): void
{
    $db->beginTransaction();
    try {
        $db->exec('DELETE FROM desk_tasks');
        $db->exec('DELETE FROM desk_events');
        $db->exec('DELETE FROM desk_comments');
        $db->exec('DELETE FROM desk_projects');
        $db->exec('DELETE FROM desk_goals');
        $db->exec('DELETE FROM desk_habits');
        $db->exec('DELETE FROM desk_clients');
        $db->exec('DELETE FROM desk_works');
        $insT = $db->prepare('INSERT INTO desk_tasks (id,slug,title,area,client,status,due_date,due_start,due_end,all_day,notes,source_file,wait_contact,wait_until,remind_at,remind_sent,project_id,client_id,blocked_by,parent_task_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        foreach ($store['tasks'] ?? [] as $t) {
            $allDay = !array_key_exists('all_day', $t) || !empty($t['all_day']);
            $due = (string)($t['due'] ?? '');
            $insT->execute([
                $t['id'], $t['slug'], $t['title'], $t['area'] ?? '', $t['client'] ?? '',
                $t['status'] ?? 'todo',
                $due ? substr($due, 0, 10) : null,
                desk_to_sql_dt($due),
                desk_to_sql_dt($t['due_end'] ?? ''),
                $allDay ? 1 : 0,
                $t['notes'] ?? '',
                $t['source_file'] ?? '',
                $t['wait_contact'] ?? '',
                $t['wait_until'] ?? '',
                $t['remind_at'] ?? '',
                !empty($t['remind_sent']) ? 1 : 0,
                '', // project_id - архив, не пишем из задачи
                $t['client_id'] ?? '',
                '', // blocked_by - архив
                trim((string)($t['parent_task_id'] ?? '')),
                desk_to_sql_dt($t['created_at'] ?? '') ?: desk_sql_now(),
                desk_to_sql_dt($t['updated_at'] ?? '') ?: desk_sql_now(),
            ]);
        }
        $insE = $db->prepare('INSERT INTO desk_events (id,uid,title,calendar_name,start_at,end_at,all_day,description,updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
        foreach ($store['events'] ?? [] as $e) {
            $insE->execute([
                $e['id'], $e['uid'] ?? $e['id'], $e['title'], $e['calendar'] ?? '',
                desk_to_sql_dt($e['start'] ?? ''),
                desk_to_sql_dt($e['end'] ?? ''),
                !empty($e['allDay']) || !empty($e['all_day']) ? 1 : 0,
                $e['description'] ?? '',
                desk_to_sql_dt($e['updated_at'] ?? '') ?: desk_sql_now(),
            ]);
        }
        $insC = $db->prepare('INSERT INTO desk_comments (id,task_id,body,created_at) VALUES (?,?,?,?)');
        foreach ($store['comments'] ?? [] as $c) {
            $insC->execute([
                $c['id'], $c['task_id'], $c['text'] ?? '',
                desk_to_sql_dt($c['created_at'] ?? '') ?: desk_sql_now(),
            ]);
        }
        $insP = $db->prepare('INSERT INTO desk_projects (id,title,status,area,notes,due_date,client_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
        foreach ($store['projects'] ?? [] as $p) {
            $insP->execute([
                $p['id'], $p['title'], $p['status'] ?? 'idea', $p['area'] ?? '',
                $p['notes'] ?? '', $p['due'] ?? '', $p['client_id'] ?? '',
                desk_to_sql_dt($p['created_at'] ?? '') ?: desk_sql_now(),
                desk_to_sql_dt($p['updated_at'] ?? '') ?: desk_sql_now(),
            ]);
        }
        $insCl = $db->prepare('INSERT INTO desk_clients (id,title,source,created_at,updated_at) VALUES (?,?,?,?,?)');
        foreach ($store['clients'] ?? [] as $c) {
            $insCl->execute([
                $c['id'], $c['title'], $c['source'] ?? 'desk',
                desk_to_sql_dt($c['created_at'] ?? '') ?: desk_sql_now(),
                desk_to_sql_dt($c['updated_at'] ?? '') ?: desk_sql_now(),
            ]);
        }
        $insW = $db->prepare('INSERT INTO desk_works (id,task_id,work_date,hours,note,created_at) VALUES (?,?,?,?,?,?)');
        foreach ($store['works'] ?? [] as $w) {
            $insW->execute([
                $w['id'], $w['task_id'],
                substr((string)($w['date'] ?? ''), 0, 10) ?: desk_moscow_date(),
                (float)($w['hours'] ?? 0),
                $w['note'] ?? '',
                desk_to_sql_dt($w['created_at'] ?? '') ?: desk_sql_now(),
            ]);
        }
        $insG = $db->prepare('INSERT INTO desk_goals (id,title,horizon,progress,krs,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)');
        foreach ($store['goals'] ?? [] as $g) {
            $insG->execute([
                $g['id'], $g['title'], $g['horizon'] ?? '', (int)($g['progress'] ?? 0),
                json_encode($g['krs'] ?? [], JSON_UNESCAPED_UNICODE),
                $g['notes'] ?? '',
                desk_to_sql_dt($g['created_at'] ?? '') ?: desk_sql_now(),
                desk_to_sql_dt($g['updated_at'] ?? '') ?: desk_sql_now(),
            ]);
        }
        $insH = $db->prepare('INSERT INTO desk_habits (id,title,checks,created_at,updated_at) VALUES (?,?,?,?,?)');
        foreach ($store['habits'] ?? [] as $h) {
            $insH->execute([
                $h['id'], $h['title'],
                json_encode($h['checks'] ?? [], JSON_UNESCAPED_UNICODE),
                desk_to_sql_dt($h['created_at'] ?? '') ?: desk_sql_now(),
                desk_to_sql_dt($h['updated_at'] ?? '') ?: desk_sql_now(),
            ]);
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
}

function desk_token_ok(string $got, string $need): bool
{
    return $need !== '' && $got !== '' && hash_equals($need, $got);
}

function desk_client_ip(): string
{
    return (string)($_SERVER['REMOTE_ADDR'] ?? '0');
}

function desk_fail_file(): string
{
    $dir = sys_get_temp_dir() . '/desk-fail';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    return $dir . '/' . hash('sha256', desk_client_ip());
}

function desk_locked(): bool
{
    $f = desk_fail_file();
    if (!is_file($f)) {
        return false;
    }
    if (time() - (int)filemtime($f) > 900) {
        @unlink($f);
        return false;
    }
    return (int)@file_get_contents($f) >= 12;
}

function desk_fail_hit(): void
{
    $f = desk_fail_file();
    $n = is_file($f) ? (int)@file_get_contents($f) : 0;
    @file_put_contents($f, (string)($n + 1));
}

function desk_fail_clear(): void
{
    $f = desk_fail_file();
    if (is_file($f)) {
        @unlink($f);
    }
}

function desk_bearer(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (stripos($header, 'Bearer ') === 0) {
        return trim(substr($header, 7));
    }
    $alt = (string)($_SERVER['HTTP_X_YAKOR_TOKEN'] ?? '');
    if ($alt !== '') {
        return $alt;
    }
    return (string)($_GET['k'] ?? ($_GET['token'] ?? ''));
}

function desk_is_admin(): bool
{
    $cfg = desk_cfg();
    return desk_token_ok(desk_bearer(), (string)($cfg['admin_token'] ?? ''));
}

function desk_is_view(): bool
{
    if (desk_is_admin()) {
        return true;
    }
    if (desk_locked()) {
        return false;
    }
    $cfg = desk_cfg();
    $need = (string)($cfg['view_token'] ?? '');
    $got = desk_bearer();
    if (desk_token_ok($got, $need)) {
        desk_fail_clear();
        return true;
    }
    $cookie = (string)($_COOKIE['desk_k'] ?? '');
    if (desk_token_ok($cookie, $need)) {
        desk_fail_clear();
        return true;
    }
    if ($got !== '' || $cookie !== '') {
        desk_fail_hit();
    }
    return false;
}

function desk_enqueue_wake(array $payload, string $kind = 'tg'): array
{
    $item = [
        'id' => desk_uuid(),
        'kind' => $kind,
        'payload' => $payload,
        'status' => 'pending',
        'created_at' => desk_now(),
    ];
    $db = desk_pdo();
    if ($db) {
        $st = $db->prepare('INSERT INTO desk_wake (id,kind,payload,status,created_at) VALUES (?,?,?,?,?)');
        $st->execute([$item['id'], $kind, json_encode($payload, JSON_UNESCAPED_UNICODE), 'pending', gmdate('Y-m-d H:i:s')]);
    } else {
        $store = desk_load_store();
        $store['wake'][] = $item;
        if (count($store['wake']) > 80) {
            $store['wake'] = array_slice($store['wake'], -80);
        }
        desk_save_store($store);
    }
    $url = trim((string)(desk_cfg()['wake_url'] ?? ''));
    if ($url !== '') {
        desk_http_post($url, $item);
    }
    return $item;
}

function desk_pending_wake(): array
{
    $store = desk_load_store();
    $out = [];
    foreach ($store['wake'] as $w) {
        if (($w['status'] ?? '') === 'pending') {
            $out[] = $w;
        }
    }
    return $out;
}

function desk_ack_wake(string $id): bool
{
    $db = desk_pdo();
    if ($db) {
        $st = $db->prepare("UPDATE desk_wake SET status='acked', acked_at=? WHERE id=?");
        $st->execute([gmdate('Y-m-d H:i:s'), $id]);
        return $st->rowCount() > 0;
    }
    $store = desk_load_store();
    $ok = false;
    foreach ($store['wake'] as &$w) {
        if (($w['id'] ?? '') === $id) {
            $w['status'] = 'acked';
            $w['acked_at'] = desk_now();
            $ok = true;
        }
    }
    unset($w);
    if ($ok) {
        desk_save_store($store);
    }
    return $ok;
}

function desk_set_status(string $id, string $status): ?array
{
    if ($status === 'waiting') {
        $status = 'waiting_reply';
    }
    $allow = desk_statuses();
    if (!in_array($status, $allow, true)) {
        return null;
    }
    $store = desk_load_store();
    $found = null;
    foreach ($store['tasks'] as &$t) {
        if (($t['id'] ?? '') === $id || ($t['slug'] ?? '') === $id) {
            $t['status'] = $status;
            $t['updated_at'] = desk_now();
            $found = $t;
        }
    }
    unset($t);
    if (!$found) {
        return null;
    }
    $db = desk_pdo();
    if ($db) {
        $st = $db->prepare('UPDATE desk_tasks SET status=?, updated_at=? WHERE id=? OR slug=?');
        $st->execute([$status, gmdate('Y-m-d H:i:s'), $found['id'], $found['slug']]);
        return $found;
    }
    desk_save_store($store);
    return $found;
}

function desk_upsert_from_sync(array $tasks, array $events): array
{
    $store = desk_load_store();
    $bySlug = [];
    foreach ($store['tasks'] as $t) {
        $bySlug[(string)($t['slug'] ?? '')] = $t;
    }
    $out = [];
    foreach ($tasks as $t) {
        $slug = (string)($t['slug'] ?? '');
        if ($slug === '') {
            continue;
        }
        $old = $bySlug[$slug] ?? null;
        $status = (string)($t['status'] ?? 'todo');
        if ($status === 'waiting') {
            $status = 'waiting_reply';
        }
        if (!in_array($status, desk_statuses(), true)) {
            $status = 'todo';
        }
        if ($old && ($old['status'] ?? '') === 'done' && $status !== 'done') {
            $status = 'done';
        }
        $row = [
            'id' => $old['id'] ?? ($t['id'] ?? desk_uuid()),
            'slug' => $slug,
            'title' => (string)($t['title'] ?? $slug),
            'area' => (string)($t['area'] ?? ''),
            'client' => (string)($t['client'] ?? ''),
            'status' => $status,
            'due' => $t['due'] ?? null,
            'notes' => (string)($t['notes'] ?? ($old['notes'] ?? '')),
            'source_file' => (string)($t['source_file'] ?? ''),
            'wait_contact' => $old['wait_contact'] ?? '',
            'wait_until' => $old['wait_until'] ?? '',
            'remind_at' => $old['remind_at'] ?? '',
            'remind_sent' => $old['remind_sent'] ?? false,
            'client_id' => $old['client_id'] ?? '',
            'parent_task_id' => $old['parent_task_id'] ?? '',
            'due_end' => $old['due_end'] ?? '',
            'all_day' => $old['all_day'] ?? true,
            'created_at' => $old['created_at'] ?? desk_now(),
            'updated_at' => desk_now(),
        ];
        $out[] = $row;
        unset($bySlug[$slug]);
    }
    foreach ($bySlug as $left) {
        if (empty($left['source_file'])) {
            $out[] = $left;
        }
    }
    $store['tasks'] = $out;
    // Календарь свой (FullCalendar). Синк с тачки события не затирает.
    unset($events);
    desk_save_store($store);
    return $store;
}

function desk_find_in(array $list, string $id): ?int
{
    foreach ($list as $i => $row) {
        if (($row['id'] ?? '') === $id || ($row['slug'] ?? '') === $id) {
            return $i;
        }
    }
    return null;
}

function desk_norm_title(string $s): string
{
    $s = trim($s);
    if (function_exists('mb_strtolower')) {
        return mb_strtolower($s, 'UTF-8');
    }
    return strtolower($s);
}

function desk_item_title(array $list, string $id): string
{
    $i = desk_find_in($list, $id);
    if ($i === null) {
        return '';
    }
    return (string)($list[$i]['title'] ?? '');
}

function desk_bind_task_client_project(array $store, array &$task): void
{
    $cid = trim((string)($task['client_id'] ?? ''));
    $pid = '';
    if (!empty($task['directions']) && is_array($task['directions'])) {
        $pid = trim((string)($task['directions'][0] ?? ''));
    }
    if ($pid !== '' && $cid === '') {
        $pi = desk_find_in($store['projects'] ?? [], $pid);
        if ($pi !== null) {
            $pcid = trim((string)($store['projects'][$pi]['client_id'] ?? ''));
            if ($pcid !== '') {
                $task['client_id'] = $pcid;
                $cid = $pcid;
            }
        }
    }
    if ($cid !== '') {
        $title = desk_item_title($store['clients'] ?? [], $cid);
        if ($title !== '') {
            $task['client'] = $title;
        }
    }
}

function desk_patch_task(string $id, array $patch): ?array
{
    $store = desk_load_store();
    $i = desk_find_in($store['tasks'], $id);
    if ($i === null) {
        return null;
    }
    $allow = ['title','area','client','status','due','due_end','all_day','notes','wait_contact','wait_until','remind_at','client_id','parent_task_id'];
    foreach ($allow as $k) {
        if (array_key_exists($k, $patch)) {
            $store['tasks'][$i][$k] = $patch[$k];
        }
    }
    if (array_key_exists('parent_task_id', $patch)) {
        $store['tasks'][$i]['parent_task_id'] = trim((string)$patch['parent_task_id']);
        $dbCheck = desk_pdo();
        if ($dbCheck && desk_parent_would_cycle($dbCheck, (string)$store['tasks'][$i]['id'], $store['tasks'][$i]['parent_task_id'])) {
            throw new InvalidArgumentException('parent_cycle');
        }
    }
    if (isset($patch['status'])) {
        if ($patch['status'] === 'waiting') {
            $store['tasks'][$i]['status'] = 'waiting_reply';
        }
        if (!in_array($store['tasks'][$i]['status'], desk_statuses(), true)) {
            return null;
        }
    }
    if (array_key_exists('all_day', $patch)) {
        $v = $patch['all_day'];
        $store['tasks'][$i]['all_day'] = ($v === true || $v === 1 || $v === '1');
    }
    if (array_key_exists('remind_at', $patch)) {
        $store['tasks'][$i]['remind_sent'] = false;
    }
    desk_bind_task_client_project($store, $store['tasks'][$i]);
    $store['tasks'][$i]['updated_at'] = desk_now();
    desk_save_store($store);
    $row = $store['tasks'][$i];
    $db = desk_pdo();
    if ($db) {
        desk_attach_task_relations($store['tasks'], $db);
        foreach ($store['tasks'] as $t) {
            if (($t['id'] ?? '') === $row['id']) {
                return $t;
            }
        }
    } else {
        $row['directions'] = [];
        $row['checklists'] = [];
        $row['links'] = desk_empty_links();
    }
    return $row;
}

function desk_add_task(array $t): array
{
    $store = desk_load_store();
    $title = trim((string)($t['title'] ?? ''));
    if ($title === '') {
        throw new InvalidArgumentException('title');
    }
    $slug = (string)($t['slug'] ?? '');
    if ($slug === '') {
        $slug = 'desk-' . substr(desk_uuid(), 0, 8);
    }
    $status = (string)($t['status'] ?? 'todo');
    if ($status === 'waiting') {
        $status = 'waiting_reply';
    }
    if (!in_array($status, desk_statuses(), true)) {
        $status = 'todo';
    }
    $parentId = trim((string)($t['parent_task_id'] ?? ''));
    $db = desk_pdo();
    $row = [
        'id' => desk_uuid(),
        'slug' => $slug,
        'title' => $title,
        'area' => (string)($t['area'] ?? 'работа'),
        'client' => (string)($t['client'] ?? ''),
        'status' => $status,
        'due' => $t['due'] ?? desk_moscow_date(),
        'due_end' => (string)($t['due_end'] ?? ''),
        'all_day' => array_key_exists('all_day', $t) ? (bool)$t['all_day'] : true,
        'notes' => (string)($t['notes'] ?? ''),
        'source_file' => '',
        'wait_contact' => (string)($t['wait_contact'] ?? ''),
        'wait_until' => (string)($t['wait_until'] ?? ''),
        'remind_at' => (string)($t['remind_at'] ?? ''),
        'remind_sent' => false,
        'client_id' => (string)($t['client_id'] ?? ''),
        'parent_task_id' => $parentId,
        'created_at' => desk_now(),
        'updated_at' => desk_now(),
    ];
    if ($db && $parentId !== '' && desk_parent_would_cycle($db, $row['id'], $parentId)) {
        throw new InvalidArgumentException('parent_cycle');
    }
    $dirId = trim((string)($t['direction_id'] ?? $t['project_id'] ?? ''));
    if ($dirId !== '') {
        $row['directions'] = [$dirId];
    }
    desk_bind_task_client_project($store, $row);
    $store['tasks'][] = $row;
    desk_save_store($store);
    if ($db && $dirId !== '') {
        desk_direction_add($db, $row['id'], $dirId);
    }
    if ($db) {
        desk_attach_task_relations($store['tasks'], $db);
        foreach ($store['tasks'] as $out) {
            if (($out['id'] ?? '') === $row['id']) {
                return $out;
            }
        }
    }
    $row['directions'] = $dirId !== '' ? [$dirId] : [];
    $row['checklists'] = [];
    $row['links'] = desk_empty_links();
    return $row;
}

function desk_add_comment(string $taskId, string $text): ?array
{
    $text = trim($text);
    if ($text === '') {
        return null;
    }
    $store = desk_load_store();
    if (desk_find_in($store['tasks'], $taskId) === null) {
        return null;
    }
    $row = [
        'id' => desk_uuid(),
        'task_id' => $taskId,
        'text' => $text,
        'created_at' => desk_now(),
    ];
    $store['comments'][] = $row;
    desk_save_store($store);
    return $row;
}

function desk_delete_task(string $id): bool
{
    $store = desk_load_store();
    $i = desk_find_in($store['tasks'], $id);
    if ($i === null) {
        return false;
    }
    $tid = (string)$store['tasks'][$i]['id'];
    $db = desk_pdo();
    if ($db) {
        try {
            $db->beginTransaction();
            // дети остаются, только сбрасываем parent
            $db->prepare("UPDATE desk_tasks SET parent_task_id = '' WHERE parent_task_id = ?")->execute([$tid]);
            $db->prepare('DELETE FROM desk_task_directions WHERE task_id = ?')->execute([$tid]);
            $db->prepare('DELETE FROM desk_task_links WHERE from_task = ? OR to_task = ?')->execute([$tid, $tid]);
            $st = $db->prepare('SELECT id FROM desk_checklists WHERE task_id = ?');
            $st->execute([$tid]);
            $listIds = $st->fetchAll(PDO::FETCH_COLUMN);
            if ($listIds) {
                $ph = implode(',', array_fill(0, count($listIds), '?'));
                $db->prepare("DELETE FROM desk_checklist_items WHERE checklist_id IN ($ph)")->execute($listIds);
            }
            $db->prepare('DELETE FROM desk_checklists WHERE task_id = ?')->execute([$tid]);
            $db->prepare('DELETE FROM desk_comments WHERE task_id = ?')->execute([$tid]);
            $db->prepare('DELETE FROM desk_works WHERE task_id = ?')->execute([$tid]);
            $db->prepare('DELETE FROM desk_tasks WHERE id = ?')->execute([$tid]);
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            return false;
        }
        return true;
    }
    array_splice($store['tasks'], $i, 1);
    $comments = [];
    foreach ($store['comments'] as $c) {
        if (($c['task_id'] ?? '') !== $tid) {
            $comments[] = $c;
        }
    }
    $store['comments'] = $comments;
    $works = [];
    foreach ($store['works'] as $w) {
        if (($w['task_id'] ?? '') !== $tid) {
            $works[] = $w;
        }
    }
    $store['works'] = $works;
    desk_save_store($store);
    return true;
}

function desk_add_work(array $raw): ?array
{
    $taskId = trim((string)($raw['task_id'] ?? ''));
    $hours = (float)($raw['hours'] ?? 0);
    $date = trim((string)($raw['date'] ?? desk_moscow_date()));
    if ($taskId === '' || $hours <= 0) {
        return null;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        $date = desk_moscow_date();
    }
    $store = desk_load_store();
    if (desk_find_in($store['tasks'], $taskId) === null) {
        return null;
    }
    $row = [
        'id' => desk_uuid(),
        'task_id' => $taskId,
        'date' => $date,
        'hours' => round($hours, 2),
        'note' => trim((string)($raw['note'] ?? '')),
        'created_at' => desk_now(),
    ];
    $store['works'][] = $row;
    desk_save_store($store);
    return $row;
}

function desk_put_event(array $raw): array
{
    $store = desk_load_store();
    $id = (string)($raw['id'] ?? '');
    $i = $id !== '' ? desk_find_in($store['events'], $id) : null;
    $old = ($i !== null) ? $store['events'][$i] : [];
    $title = trim((string)($raw['title'] ?? ($old['title'] ?? '')));
    if ($title === '') {
        throw new InvalidArgumentException('title');
    }
    $start = (string)($raw['start'] ?? ($old['start'] ?? ''));
    $end = array_key_exists('end', $raw) ? (string)$raw['end'] : (string)($old['end'] ?? '');
    $allDay = array_key_exists('allDay', $raw) ? (bool)$raw['allDay'] : !empty($old['allDay']);
    $row = [
        'id' => $id !== '' ? $id : desk_uuid(),
        'uid' => (string)($raw['uid'] ?? ($old['uid'] ?? desk_uuid())),
        'title' => $title,
        'calendar' => (string)($raw['calendar'] ?? ($old['calendar'] ?? 'работа')),
        'start' => $start,
        'end' => $end,
        'allDay' => $allDay,
        'description' => (string)($raw['description'] ?? ($old['description'] ?? '')),
        'created_at' => $old['created_at'] ?? desk_now(),
        'updated_at' => desk_now(),
    ];
    if ($i === null) {
        $store['events'][] = $row;
    } else {
        $store['events'][$i] = $row;
    }
    desk_save_store($store);
    return $row;
}

function desk_upsert_item(string $bucket, array $row, array $required = ['title']): array
{
    $store = desk_load_store();
    if (!isset($store[$bucket])) {
        throw new InvalidArgumentException($bucket);
    }
    foreach ($required as $k) {
        if (trim((string)($row[$k] ?? '')) === '') {
            throw new InvalidArgumentException($k);
        }
    }
    $id = (string)($row['id'] ?? '');
    $i = $id !== '' ? desk_find_in($store[$bucket], $id) : null;
    if ($i === null) {
        $row['id'] = $id !== '' ? $id : desk_uuid();
        $row['created_at'] = $row['created_at'] ?? desk_now();
        $row['updated_at'] = desk_now();
        $store[$bucket][] = $row;
        desk_save_store($store);
        return $row;
    }
    $store[$bucket][$i] = array_merge($store[$bucket][$i], $row);
    $store[$bucket][$i]['id'] = $store[$bucket][$i]['id'];
    $store[$bucket][$i]['updated_at'] = desk_now();
    desk_save_store($store);
    return $store[$bucket][$i];
}

function desk_delete_item(string $bucket, string $id): bool
{
    $store = desk_load_store();
    $i = desk_find_in($store[$bucket] ?? [], $id);
    if ($i === null) {
        return false;
    }
    array_splice($store[$bucket], $i, 1);
    desk_save_store($store);
    return true;
}

function desk_run_reminders(): array
{
    $store = desk_load_store();
    $now = desk_moscow_now();
    $sent = [];
    foreach ($store['tasks'] as &$t) {
        $at = (string)($t['remind_at'] ?? '');
        if ($at === '' || !empty($t['remind_sent'])) {
            continue;
        }
        if ($at > $now) {
            continue;
        }
        $ok = desk_tg_send('Напоминание: ' . ($t['title'] ?? '') . ($t['wait_contact'] ? ' (ждём: ' . $t['wait_contact'] . ')' : ''));
        if ($ok) {
            $t['remind_sent'] = true;
            $sent[] = $t['id'];
        }
    }
    unset($t);
    if ($sent) {
        desk_save_store($store);
    }
    return $sent;
}

function desk_project_statuses(): array
{
    return ['idea', 'backlog', 'doing', 'waiting', 'done'];
}

function desk_ensure_seed(): void
{
    $store = desk_load_store();
    $changed = false;
    foreach ($store['tasks'] as &$t) {
        if (($t['status'] ?? '') === 'waiting') {
            $t['status'] = 'waiting_reply';
            $changed = true;
        }
    }
    unset($t);

    $have = [];
    foreach ($store['projects'] as $p) {
        $have[(string)($p['id'] ?? '')] = true;
    }
    $seeds = [
        [
            'id' => 'proj-desk-v1',
            'title' => 'Стол / персональный ассистент',
            'status' => 'doing',
            'area' => 'бюро',
            'notes' => "Фаза 1. Задачи, статусы, комментарии, свой календарь (FullCalendar), проекты, цели, привычки, PWA. Живёт на buro1.tech.",
            'due' => '',
        ],
        [
            'id' => 'proj-dispatch-v1',
            'title' => 'Диспетчер агента без человека за компом',
            'status' => 'backlog',
            'area' => 'инфра',
            'notes' => "Фаза 2. Автозагрузка Windows, подъём агента по wake с доски/бота. Пока не делаем - карточка, чтобы не потерялось в чатах.",
            'due' => '',
        ],
        [
            'id' => 'proj-tunnel-v1',
            'title' => 'Туннель Cloudflare → тачка',
            'status' => 'backlog',
            'area' => 'инфра',
            'notes' => "Фаза 3. cloudflared + поддомен agent.buro1.tech. Хостинг сам пнёт тачку, без поллинга. Пока не делаем.",
            'due' => '',
        ],
        [
            'id' => 'proj-agent24-v1',
            'title' => 'Агент 24/7 на Windows',
            'status' => 'idea',
            'area' => 'инфра',
            'notes' => "Фаза 4. Выделенный Windows-сервер. 1С/Designer только на Windows, cloud-агент УНФ не видит. Пока не делаем.",
            'due' => '',
        ],
        [
            'id' => 'proj-1c-sync-v1',
            'title' => 'Синк 1С: клиенты, проекты, работы',
            'status' => 'backlog',
            'area' => 'бюро',
            'client_id' => 'cli-buro',
            'notes' => "Позже. Подтянуть справочники Клиенты и Проекты из своей базы 1С (Works API) и работы. Сейчас заводим вручную на столе. Не делать в этой итерации.",
            'due' => '',
        ],
    ];
    foreach ($seeds as $p) {
        if (!empty($have[$p['id']])) {
            continue;
        }
        $p['created_at'] = desk_now();
        $p['updated_at'] = desk_now();
        $store['projects'][] = $p;
        $changed = true;
    }

    $haveH = [];
    foreach ($store['habits'] as $h) {
        $haveH[(string)($h['id'] ?? '')] = true;
    }
    $habitSeeds = [
        ['id' => 'habit-sergey', 'title' => 'Упражнения Сергей', 'checks' => []],
        ['id' => 'habit-home', 'title' => 'Убраться дома', 'checks' => []],
    ];
    foreach ($habitSeeds as $h) {
        if (!empty($haveH[$h['id']])) {
            continue;
        }
        $h['created_at'] = desk_now();
        $h['updated_at'] = desk_now();
        $store['habits'][] = $h;
        $changed = true;
    }

    $haveG = [];
    foreach ($store['goals'] as $g) {
        $haveG[(string)($g['id'] ?? '')] = true;
    }
    if (empty($haveG['goal-desk-q3'])) {
        $store['goals'][] = [
            'id' => 'goal-desk-q3',
            'title' => 'Стол как личный бизнес-ассистент',
            'horizon' => 'Q3 2026',
            'progress' => 80,
            'krs' => [
                ['id' => 'kr1', 'title' => 'Задачи с телефона (статус, коммент, ждать ответа)', 'current' => 1, 'target' => 1],
                ['id' => 'kr2', 'title' => 'Свой календарь без Яндекса', 'current' => 1, 'target' => 1],
                ['id' => 'kr3', 'title' => 'Проекты / цели / привычки на бюро', 'current' => 1, 'target' => 1],
            ],
            'notes' => 'Не SaaS, не Cursor iOS. Safari → На экран Домой.',
            'created_at' => desk_now(),
            'updated_at' => desk_now(),
        ];
        $changed = true;
    }

    if (!isset($store['clients']) || !is_array($store['clients'])) {
        $store['clients'] = [];
        $changed = true;
    }
    if (!isset($store['works']) || !is_array($store['works'])) {
        $store['works'] = [];
        $changed = true;
    }

    $byClient = [];
    foreach ($store['clients'] as $c) {
        $byClient[desk_norm_title((string)($c['title'] ?? ''))] = (string)($c['id'] ?? '');
    }
    $haveCli = [];
    foreach ($store['clients'] as $c) {
        $haveCli[(string)($c['id'] ?? '')] = true;
    }
    if (empty($haveCli['cli-buro'])) {
        $store['clients'][] = [
            'id' => 'cli-buro',
            'title' => 'Бюро',
            'source' => 'desk',
            'created_at' => desk_now(),
            'updated_at' => desk_now(),
        ];
        $haveCli['cli-buro'] = true;
        $byClient['бюро'] = 'cli-buro';
        $changed = true;
    } else {
        $byClient['бюро'] = $byClient['бюро'] ?? 'cli-buro';
    }

    foreach ($store['projects'] as &$p) {
        $pcid = trim((string)($p['client_id'] ?? ''));
        if ($pcid === '') {
            $p['client_id'] = 'cli-buro';
            $changed = true;
        }
    }
    unset($p);

    foreach ($store['tasks'] as &$t) {
        $cid = trim((string)($t['client_id'] ?? ''));
        $name = trim((string)($t['client'] ?? ''));
        if ($cid !== '' || $name === '') {
            continue;
        }
        $key = desk_norm_title($name);
        if (!isset($byClient[$key]) || $byClient[$key] === '') {
            $id = 'cli-' . substr(md5($key), 0, 12);
            if (empty($haveCli[$id])) {
                $store['clients'][] = [
                    'id' => $id,
                    'title' => $name,
                    'source' => 'desk',
                    'created_at' => desk_now(),
                    'updated_at' => desk_now(),
                ];
                $haveCli[$id] = true;
            }
            $byClient[$key] = $id;
            $changed = true;
        }
        $t['client_id'] = $byClient[$key];
        $changed = true;
    }
    unset($t);

    if ($changed) {
        desk_save_store($store);
    }
}

function desk_habit_check(string $id, string $date, bool $on): ?array
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return null;
    }
    $store = desk_load_store();
    $i = desk_find_in($store['habits'], $id);
    if ($i === null) {
        return null;
    }
    if (!isset($store['habits'][$i]['checks']) || !is_array($store['habits'][$i]['checks'])) {
        $store['habits'][$i]['checks'] = [];
    }
    if ($on) {
        $store['habits'][$i]['checks'][$date] = true;
    } else {
        unset($store['habits'][$i]['checks'][$date]);
    }
    $store['habits'][$i]['updated_at'] = desk_now();
    desk_save_store($store);
    return $store['habits'][$i];
}

function desk_tg_send(string $text): bool
{
    $url = 'http://127.0.0.1/api/tg/admin/send';
    $token = (string)(desk_cfg()['admin_token'] ?? '');
    $body = json_encode(['text' => $text], JSON_UNESCAPED_UNICODE);
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\nX-Yakor-Token: {$token}\r\n",
            'content' => $body,
            'timeout' => 8,
            'ignore_errors' => true,
        ],
    ]);
    $res = @file_get_contents($url, false, $ctx);
    if ($res === false) {
        return false;
    }
    $j = json_decode($res, true);
    return is_array($j) && !empty($j['ok']);
}

function desk_http_post(string $url, array $payload): bool
{
    $token = (string)(desk_cfg()['admin_token'] ?? '');
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $headers = ['Content-Type: application/json', 'Accept: application/json'];
        if ($token !== '') {
            $headers[] = 'X-Yakor-Token: ' . $token;
        }
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 3,
            CURLOPT_CONNECTTIMEOUT => 2,
        ]);
        $res = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $res !== false && $code >= 200 && $code < 300;
    }
    $hdr = "Content-Type: application/json\r\n";
    if ($token !== '') {
        $hdr .= 'X-Yakor-Token: ' . $token . "\r\n";
    }
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => $hdr,
            'content' => $body,
            'timeout' => 3,
            'ignore_errors' => true,
        ],
    ]);
    $res = @file_get_contents($url, false, $ctx);
    return $res !== false;
}

/** Добавить направление задаче */
function desk_direction_add(PDO $db, string $taskId, string $directionId): bool
{
    $directionId = trim($directionId);
    if ($directionId === '') {
        return false;
    }
    $tid = desk_resolve_task_id($db, $taskId);
    if (!$tid) {
        return false;
    }
    $st = $db->prepare('INSERT IGNORE INTO desk_task_directions (task_id, direction_id, created_at) VALUES (?, ?, ?)');
    $st->execute([$tid, $directionId, desk_sql_now()]);
    return true;
}

/** Убрать направление у задачи */
function desk_direction_remove(PDO $db, string $taskId, string $directionId): bool
{
    $directionId = trim($directionId);
    $tid = desk_resolve_task_id($db, $taskId);
    if (!$tid || $directionId === '') {
        return false;
    }
    $st = $db->prepare('DELETE FROM desk_task_directions WHERE task_id = ? AND direction_id = ?');
    $st->execute([$tid, $directionId]);
    return $st->rowCount() > 0;
}

/** Создать чек-лист в задаче */
function desk_checklist_create(PDO $db, string $taskId, string $title): ?string
{
    $tid = desk_resolve_task_id($db, $taskId);
    if (!$tid) {
        return null;
    }
    $title = trim($title) !== '' ? trim($title) : 'Список';
    $st = $db->prepare('SELECT COALESCE(MAX(position), -1) FROM desk_checklists WHERE task_id = ?');
    $st->execute([$tid]);
    $pos = (int)$st->fetchColumn() + 1;
    $id = desk_uuid();
    $ins = $db->prepare('INSERT INTO desk_checklists (id, task_id, title, position, created_at) VALUES (?, ?, ?, ?, ?)');
    $ins->execute([$id, $tid, $title, $pos, desk_sql_now()]);
    return $id;
}

/** Обновить чек-лист (частично) */
function desk_checklist_update(PDO $db, string $listId, array $patch): bool
{
    $sets = [];
    $vals = [];
    if (array_key_exists('title', $patch)) {
        $sets[] = 'title = ?';
        $vals[] = trim((string)$patch['title']) !== '' ? trim((string)$patch['title']) : 'Список';
    }
    if (array_key_exists('position', $patch)) {
        $sets[] = 'position = ?';
        $vals[] = (int)$patch['position'];
    }
    if (!$sets) {
        return false;
    }
    $vals[] = $listId;
    $st = $db->prepare('UPDATE desk_checklists SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $st->execute($vals);
    return $st->rowCount() > 0;
}

/** Удалить чек-лист и все пункты */
function desk_checklist_delete(PDO $db, string $listId): bool
{
    $st = $db->prepare('SELECT id FROM desk_checklists WHERE id = ?');
    $st->execute([$listId]);
    if (!$st->fetch()) {
        return false;
    }
    $db->prepare('DELETE FROM desk_checklist_items WHERE checklist_id = ?')->execute([$listId]);
    $db->prepare('DELETE FROM desk_checklists WHERE id = ?')->execute([$listId]);
    return true;
}

/** Создать пункт чек-листа */
function desk_checklist_item_create(PDO $db, string $listId, string $text): ?string
{
    $text = trim((string)$text);
    $st = $db->prepare('SELECT id FROM desk_checklists WHERE id = ?');
    $st->execute([$listId]);
    if (!$st->fetch()) {
        return null;
    }
    $st = $db->prepare('SELECT COALESCE(MAX(position), -1) FROM desk_checklist_items WHERE checklist_id = ?');
    $st->execute([$listId]);
    $pos = (int)$st->fetchColumn() + 1;
    $id = desk_uuid();
    $ins = $db->prepare('INSERT INTO desk_checklist_items (id, checklist_id, text, done, position, created_at) VALUES (?, ?, ?, 0, ?, ?)');
    $ins->execute([$id, $listId, $text, $pos, desk_sql_now()]);
    return $id;
}

/** Обновить пункт чек-листа (частично) */
function desk_checklist_item_update(PDO $db, string $itemId, array $patch): bool
{
    $sets = [];
    $vals = [];
    if (array_key_exists('text', $patch)) {
        $sets[] = 'text = ?';
        $vals[] = (string)$patch['text'];
    }
    if (array_key_exists('done', $patch)) {
        $sets[] = 'done = ?';
        $v = $patch['done'];
        $vals[] = ($v === true || $v === 1 || $v === '1') ? 1 : 0;
    }
    if (array_key_exists('position', $patch)) {
        $sets[] = 'position = ?';
        $vals[] = (int)$patch['position'];
    }
    if (!$sets) {
        return false;
    }
    $vals[] = $itemId;
    $st = $db->prepare('UPDATE desk_checklist_items SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $st->execute($vals);
    return $st->rowCount() > 0;
}

/** Удалить пункт чек-листа */
function desk_checklist_item_delete(PDO $db, string $itemId): bool
{
    $st = $db->prepare('DELETE FROM desk_checklist_items WHERE id = ?');
    $st->execute([$itemId]);
    return $st->rowCount() > 0;
}

/** Привязать подзадачу к родителю */
function desk_subtask_link(PDO $db, string $parentRef, string $childRef): ?string
{
    $parentId = desk_resolve_task_id($db, $parentRef);
    $childId = desk_resolve_task_id($db, $childRef);
    if (!$parentId || !$childId) {
        return null;
    }
    if ($parentId === $childId) {
        return 'parent_cycle';
    }
    $st = $db->prepare('SELECT parent_task_id FROM desk_tasks WHERE id = ?');
    $st->execute([$childId]);
    $row = $st->fetch();
    $curParent = trim((string)($row['parent_task_id'] ?? ''));
    if ($curParent !== '') {
        return 'already_has_parent';
    }
    if (desk_parent_would_cycle($db, $childId, $parentId)) {
        return 'parent_cycle';
    }
    $db->prepare('UPDATE desk_tasks SET parent_task_id = ?, updated_at = ? WHERE id = ?')
        ->execute([$parentId, desk_sql_now(), $childId]);
    return 'ok';
}

/** Отвязать подзадачу от родителя */
function desk_subtask_unlink(PDO $db, string $parentRef, string $childRef): bool
{
    $parentId = desk_resolve_task_id($db, $parentRef);
    $childId = desk_resolve_task_id($db, $childRef);
    if (!$parentId || !$childId) {
        return false;
    }
    $st = $db->prepare("UPDATE desk_tasks SET parent_task_id = '', updated_at = ? WHERE id = ? AND parent_task_id = ?");
    $st->execute([desk_sql_now(), $childId, $parentId]);
    return $st->rowCount() > 0;
}

/** Создать связь между задачами */
function desk_link_create(PDO $db, string $fromRef, string $toRef, string $type): array
{
    $from = desk_resolve_task_id($db, $fromRef);
    $to = desk_resolve_task_id($db, $toRef);
    $type = trim($type);
    if (!$from || !$to) {
        return ['ok' => false, 'error' => 'not_found'];
    }
    if ($from === $to) {
        return ['ok' => false, 'error' => 'same_task'];
    }
    if (!in_array($type, desk_link_types(), true)) {
        return ['ok' => false, 'error' => 'bad_type'];
    }
    if ($type === 'blocks' && desk_blocks_would_cycle($db, $from, $to)) {
        return ['ok' => false, 'error' => 'cycle'];
    }
    $id = desk_uuid();
    try {
        $st = $db->prepare('INSERT INTO desk_task_links (id, from_task, to_task, type, created_at) VALUES (?, ?, ?, ?, ?)');
        $st->execute([$id, $from, $to, $type, desk_sql_now()]);
    } catch (Throwable $e) {
        // дубликат uq_edge
        return ['ok' => false, 'error' => 'duplicate'];
    }
    return ['ok' => true, 'id' => $id];
}

/** Удалить связь по id */
function desk_link_delete(PDO $db, string $linkId): bool
{
    $st = $db->prepare('DELETE FROM desk_task_links WHERE id = ?');
    $st->execute([$linkId]);
    return $st->rowCount() > 0;
}

/** Требует MySQL для мутаций новых таблиц */
function desk_need_db(): ?PDO
{
    $db = desk_pdo();
    return $db;
}
