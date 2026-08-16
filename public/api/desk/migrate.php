<?php
/**
 * Одноразовая миграция данных desk: направления, блокировки, чек-листы из notes.
 * CLI: php migrate.php
 * Web: GET/POST с admin-токеном (X-Yakor-Token).
 */
require_once __DIR__ . '/lib.php';

function desk_migrate_respond(array $data, int $code = 200): void
{
    if (PHP_SAPI !== 'cli') {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if (PHP_SAPI === 'cli') {
        echo $json . "\n";
    } else {
        echo $json;
    }
    exit;
}

function desk_migrate_run(PDO $db): array
{
    desk_ensure_schema($db);
    $now = desk_sql_now();

    // Направления из project_id
    $beforeDirs = (int)$db->query('SELECT COUNT(*) FROM desk_task_directions')->fetchColumn();
    $db->exec(
        "INSERT IGNORE INTO desk_task_directions (task_id, direction_id, created_at)
         SELECT id, project_id, NOW() FROM desk_tasks WHERE project_id <> ''"
    );
    $afterDirs = (int)$db->query('SELECT COUNT(*) FROM desk_task_directions')->fetchColumn();
    $directionsInserted = $afterDirs - $beforeDirs;

    // Блокировки из blocked_by
    $beforeLinks = (int)$db->query("SELECT COUNT(*) FROM desk_task_links WHERE type = 'blocks'")->fetchColumn();
    $db->exec(
        "INSERT INTO desk_task_links (id, from_task, to_task, type, created_at)
         SELECT UUID(), blocked_by, id, 'blocks', NOW()
         FROM desk_tasks
         WHERE blocked_by <> ''
           AND NOT EXISTS (
             SELECT 1 FROM desk_task_links l
             WHERE l.from_task = desk_tasks.blocked_by
               AND l.to_task = desk_tasks.id
               AND l.type = 'blocks'
           )"
    );
    $afterLinks = (int)$db->query("SELECT COUNT(*) FROM desk_task_links WHERE type = 'blocks'")->fetchColumn();
    $linksInserted = $afterLinks - $beforeLinks;

    // Чек-листы из markdown-строк в notes
    $checklistsCreated = 0;
    $itemsCreated = 0;
    $notesUpdated = 0;

    $checklistPattern = '/^\s*-\s*\[( |x|X)\]\s*(.*)$/u';
    $tasks = $db->query("SELECT id, notes FROM desk_tasks WHERE notes IS NOT NULL AND notes <> ''")->fetchAll();

    $hasChecklist = $db->prepare('SELECT COUNT(*) FROM desk_checklists WHERE task_id = ?');
    $insList = $db->prepare(
        'INSERT INTO desk_checklists (id, task_id, title, position, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    $insItem = $db->prepare(
        'INSERT INTO desk_checklist_items (id, checklist_id, text, done, position, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $updNotes = $db->prepare('UPDATE desk_tasks SET notes = ?, updated_at = ? WHERE id = ?');

    foreach ($tasks as $task) {
        $notes = (string)($task['notes'] ?? '');
        if ($notes === '') {
            continue;
        }

        $lines = preg_split("/\r\n|\n|\r/", $notes);
        $checkItems = [];
        $otherLines = [];

        foreach ($lines as $line) {
            if (preg_match($checklistPattern, $line, $m)) {
                $checkItems[] = [
                    'text' => trim($m[2]),
                    'done' => strtolower($m[1]) === 'x' ? 1 : 0,
                ];
            } else {
                $otherLines[] = $line;
            }
        }

        if (!$checkItems) {
            continue;
        }

        $taskId = (string)$task['id'];
        $hasChecklist->execute([$taskId]);
        if ((int)$hasChecklist->fetchColumn() > 0) {
            continue;
        }

        $listId = desk_uuid();
        $insList->execute([$listId, $taskId, 'Список', 0, $now]);
        $checklistsCreated++;

        foreach ($checkItems as $pos => $item) {
            $insItem->execute([
                desk_uuid(),
                $listId,
                $item['text'],
                $item['done'],
                $pos,
                $now,
            ]);
            $itemsCreated++;
        }

        // Убираем чек-лист строки из notes, оставляем описание
        $newNotes = trim(implode("\n", $otherLines));
        $updNotes->execute([$newNotes, $now, $taskId]);
        $notesUpdated++;
    }

    return [
        'ok' => true,
        'directions_inserted' => $directionsInserted,
        'links_inserted' => $linksInserted,
        'checklists_created' => $checklistsCreated,
        'items_created' => $itemsCreated,
        'notes_updated' => $notesUpdated,
    ];
}

// --- точка входа ---

if (PHP_SAPI !== 'cli') {
    if (!desk_is_admin()) {
        desk_migrate_respond(['ok' => false, 'error' => 'unauthorized'], 401);
    }
}

$db = desk_pdo();
if (!$db) {
    $err = ['ok' => false, 'error' => 'no_db'];
    if (!empty($GLOBALS['desk_db_error'])) {
        $err['db_error'] = (string)$GLOBALS['desk_db_error'];
    }
    desk_migrate_respond($err, 500);
}

try {
    desk_migrate_respond(desk_migrate_run($db));
} catch (Throwable $e) {
    desk_migrate_respond(['ok' => false, 'error' => $e->getMessage()], 500);
}
