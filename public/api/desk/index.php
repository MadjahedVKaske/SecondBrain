<?php
/**
 * Desk API: /api/desk/
 */
header('X-Content-Type-Options: nosniff');
require_once __DIR__ . '/lib.php';

function desk_respond($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function desk_body(): array
{
    $raw = json_decode((string)file_get_contents('php://input'), true);
    return is_array($raw) ? $raw : [];
}

function desk_need_view(): void
{
    if (!desk_is_view()) {
        desk_respond(['error' => 'unauthorized'], 401);
    }
}

function desk_need_admin(): void
{
    if (!desk_is_admin()) {
        desk_respond(['error' => 'unauthorized'], 401);
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '';
$rest = '';
if (preg_match('#/api/desk(?:/(.*))?$#', $path, $m)) {
    $rest = isset($m[1]) ? trim($m[1], '/') : '';
}

// Private bridge used only by the TG poller on the Docker-internal network.
// It deliberately uses a dedicated host-only secret, never a Desk browser key.
if ($method === 'POST' && ($rest === 'tg-wake' || $rest === 'tg-wake/')) {
    $expected = (string)(desk_cfg()['tg_wake_token'] ?? '');
    $provided = (string)($_SERVER['HTTP_X_SECONDBRAIN_TG'] ?? '');
    if ($expected === '' || !hash_equals($expected, $provided)) {
        desk_respond(['error' => 'not_found'], 404);
    }
    $raw = desk_body();
    if (trim((string)($raw['tg_id'] ?? '')) === '') {
        desk_respond(['error' => 'bad_request'], 400);
    }
    $db = desk_need_db();
    if (!$db) desk_respond(['error' => 'unavailable'], 503);
    desk_acquire_write_lock($db);
    desk_respond(['ok' => true, 'item' => desk_enqueue_wake($raw, 'tg')]);
}

if (desk_production_runtime() && in_array($method, ['POST', 'DELETE'], true) && !desk_csrf_ok()) {
    desk_respond(['error' => 'csrf'], 403);
}
if (desk_production_runtime() && in_array($method, ['POST', 'DELETE'], true)) {
    $db = desk_need_db();
    if (!$db) desk_respond(['error' => 'unavailable'], 503);
    desk_acquire_write_lock($db);
}

if ($method === 'GET' && ($rest === '' || $rest === 'health')) {
    $store = desk_load_store();
    if (desk_production_runtime()) {
        desk_respond([
            'ok' => true,
            'service' => 'desk',
            'storage' => 'mysql',
        ]);
    }
    $out = [
        'ok' => true,
        'service' => 'desk',
        'storage' => desk_pdo() ? 'mysql' : 'json',
        'tasks' => count($store['tasks']),
        'events' => count($store['events']),
        'projects' => count($store['projects']),
        'goals' => count($store['goals']),
        'habits' => count($store['habits']),
        'clients' => count($store['clients'] ?? []),
        'works' => count($store['works'] ?? []),
        'wake_pending' => count(desk_pending_wake()),
        'wake_push' => trim((string)(desk_cfg()['wake_url'] ?? '')) !== '',
    ];
    if (!empty($GLOBALS['desk_db_error'])) {
        $out['db_error'] = (string)$GLOBALS['desk_db_error'];
    }
    desk_respond($out);
}

if ($method === 'GET' && ($rest === 'state' || $rest === 'state/')) {
    desk_need_view();
    if (desk_production_runtime()) {
        $db = desk_need_db();
        if (!$db) desk_respond(['error' => 'unavailable'], 503);
        desk_acquire_write_lock($db);
    }
    desk_ensure_seed();
    $store = desk_load_store();
    $game = null;
    $gameDb = desk_pdo();
    if ($gameDb) {
        $game = desk_game_state($gameDb, $store);
    }
    desk_respond([
        'ok' => true,
        'storage' => desk_pdo() ? 'mysql' : 'json',
        'today' => desk_moscow_date(),
        'now' => desk_moscow_now(),
        'statuses' => desk_statuses(),
        'project_statuses' => desk_project_statuses(),
        'tasks' => $store['tasks'],
        'events' => $store['events'],
        'comments' => $store['comments'],
        'projects' => $store['projects'],
        'goals' => $store['goals'],
        'habits' => $store['habits'],
        'clients' => $store['clients'] ?? [],
        'works' => $store['works'] ?? [],
        'game' => $game,
    ]);
}

if ($method === 'GET' && ($rest === 'digest' || $rest === 'digest/')) {
    desk_need_view();
    $mode = (string)($_GET['mode'] ?? '');
    if (!in_array($mode, ['morning', 'evening'], true)) {
        $mode = (int)(new DateTime('now', new DateTimeZone('Europe/Moscow')))->format('G') < 15
            ? 'morning'
            : 'evening';
    }
    desk_respond(desk_build_digest($mode));
}

if ($method === 'GET' && ($rest === 'cron' || $rest === 'cron/')) {
    if (desk_production_runtime()) {
        desk_respond(['error' => 'not_found'], 404);
    }
    desk_need_admin();
    $sent = desk_run_reminders();
    desk_respond(['ok' => true, 'sent' => $sent]);
}

if ($method === 'POST' && ($rest === 'cron' || $rest === 'cron/')) {
    if (desk_production_runtime()) {
        desk_respond(['error' => 'not_found'], 404);
    }
    desk_need_admin();
    $sent = desk_run_reminders();
    desk_respond(['ok' => true, 'sent' => $sent]);
}

if ($method === 'POST' && preg_match('#^tasks/([^/]+)/status$#', $rest, $m)) {
    desk_need_view();
    $raw = desk_body();
    $db = desk_pdo();
    try {
        $row = $db
            ? desk_game_transaction($db, static function () use ($m, $raw, $db) {
                $task = desk_set_status($m[1], (string)($raw['status'] ?? ''));
                if ($task) desk_game_after_task_status($db, $task);
                return $task;
            })
            : desk_set_status($m[1], (string)($raw['status'] ?? ''));
    } catch (Throwable $e) {
        desk_respond(['error' => 'save_failed'], 500);
    }
    if (!$row) {
        desk_respond(['error' => 'not_found_or_bad_status'], 400);
    }
    desk_respond(['ok' => true, 'task' => $row]);
}

if ($method === 'POST' && ($rest === 'game/bindings' || $rest === 'game/bindings/')) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    $raw = desk_body();
    $ok = desk_game_bind($db, trim((string)($raw['object_type'] ?? '')), trim((string)($raw['object_id'] ?? '')), trim((string)($raw['skill_id'] ?? '')));
    desk_respond(['ok' => $ok], $ok ? 200 : 400);
}

if ($method === 'POST' && ($rest === 'game/ranks' || $rest === 'game/ranks/')) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    $raw = desk_body();
    $override = array_key_exists('xp_override', $raw) && $raw['xp_override'] !== '' ? (int)$raw['xp_override'] : null;
    $ok = desk_game_set_rank($db, trim((string)($raw['object_type'] ?? '')), trim((string)($raw['object_id'] ?? '')), trim((string)($raw['rank_id'] ?? '')), $override);
    desk_respond(['ok' => $ok], $ok ? 200 : 400);
}

if ($method === 'POST' && ($rest === 'game/pulse' || $rest === 'game/pulse/')) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    $raw = desk_body();
    try {
        $pulse = desk_game_save_pulse(
            $db,
            (string)($raw['date'] ?? desk_moscow_date()),
            array_key_exists('energy', $raw) ? (int)$raw['energy'] : null,
            array_key_exists('mood', $raw) ? (int)$raw['mood'] : null,
            (string)($raw['note'] ?? '')
        );
    } catch (InvalidArgumentException $e) {
        desk_respond(['error' => $e->getMessage()], 400);
    } catch (Throwable $e) {
        desk_respond(['error' => 'save_failed'], 500);
    }
    desk_respond(['ok' => true, 'pulse' => $pulse]);
}

if ($method === 'POST' && ($rest === 'game/daily-quests' || $rest === 'game/daily-quests/')) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    $raw = desk_body();
    $date = (string)($raw['date'] ?? desk_moscow_date());
    $ok = desk_game_set_daily_quest($db, trim((string)($raw['task_id'] ?? '')), $date);
    desk_respond(['ok' => $ok], $ok ? 200 : 400);
}

if ($method === 'DELETE' && preg_match('#^game/daily-quests/([^/]+)$#', $rest, $m)) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    $date = (string)($_GET['date'] ?? desk_moscow_date());
    desk_respond(['ok' => desk_game_remove_daily_quest($db, $m[1], $date)]);
}

if ($method === 'POST' && preg_match('#^tasks/([^/]+)/comments$#', $rest, $m)) {
    desk_need_view();
    $raw = desk_body();
    $row = desk_add_comment($m[1], (string)($raw['text'] ?? ''));
    if (!$row) {
        desk_respond(['error' => 'bad_comment'], 400);
    }
    desk_respond(['ok' => true, 'comment' => $row]);
}

if ($method === 'POST' && preg_match('#^tasks/([^/]+)/delete$#', $rest, $m)) {
    desk_need_view();
    desk_respond(['ok' => desk_delete_task($m[1])]);
}

if ($method === 'POST' && ($rest === 'tasks' || $rest === 'tasks/')) {
    desk_need_view();
    try {
        $row = desk_add_task(desk_body());
    } catch (InvalidArgumentException $e) {
        desk_respond(['ok' => false, 'error' => $e->getMessage()], 400);
    }
    desk_respond(['ok' => true, 'task' => $row]);
}

if ($method === 'POST' && preg_match('#^tasks/([^/]+)$#', $rest, $m)) {
    desk_need_view();
    try {
        $patch = desk_body();
        $db = desk_pdo();
        $row = $db
            ? desk_game_transaction($db, static function () use ($m, $patch, $db) {
                $task = desk_patch_task($m[1], $patch);
                if ($task) desk_game_after_task_status($db, $task);
                return $task;
            })
            : desk_patch_task($m[1], $patch);
    } catch (InvalidArgumentException $e) {
        desk_respond(['ok' => false, 'error' => $e->getMessage()], 400);
    } catch (Throwable $e) {
        desk_respond(['ok' => false, 'error' => 'save_failed'], 500);
    }
    if (!$row) {
        desk_respond(['ok' => false, 'error' => 'not_found_or_bad_status'], 400);
    }
    desk_respond(['ok' => true, 'task' => $row]);
}

if ($method === 'POST' && ($rest === 'works' || $rest === 'works/')) {
    desk_need_view();
    $row = desk_add_work(desk_body());
    if (!$row) {
        desk_respond(['error' => 'bad_work'], 400);
    }
    desk_respond(['ok' => true, 'work' => $row]);
}

if ($method === 'POST' && preg_match('#^works/([^/]+)/delete$#', $rest, $m)) {
    desk_need_view();
    desk_respond(['ok' => desk_delete_item('works', $m[1])]);
}

if ($method === 'POST' && ($rest === 'events' || $rest === 'events/')) {
    desk_need_view();
    try {
        $row = desk_put_event(desk_body());
    } catch (InvalidArgumentException $e) {
        desk_respond(['error' => $e->getMessage()], 400);
    }
    desk_respond(['ok' => true, 'event' => $row]);
}

if ($method === 'POST' && preg_match('#^events/([^/]+)/delete$#', $rest, $m)) {
    desk_need_view();
    desk_respond(['ok' => desk_delete_item('events', $m[1])]);
}

if ($method === 'POST' && preg_match('#^events/([^/]+)$#', $rest, $m)) {
    desk_need_view();
    $raw = desk_body();
    $raw['id'] = $m[1];
    try {
        $row = desk_put_event($raw);
    } catch (InvalidArgumentException $e) {
        desk_respond(['error' => $e->getMessage()], 400);
    }
    desk_respond(['ok' => true, 'event' => $row]);
}

$buckets = ['projects' => 'project', 'goals' => 'goal', 'habits' => 'habit', 'clients' => 'client'];
foreach ($buckets as $bucket => $one) {
    if ($method === 'POST' && ($rest === $bucket || $rest === $bucket . '/')) {
        desk_need_view();
        $raw = desk_body();
        if ($bucket === 'projects' && isset($raw['status']) && !in_array($raw['status'], desk_project_statuses(), true)) {
            $raw['status'] = 'idea';
        }
        if ($bucket === 'habits' && !isset($raw['checks'])) {
            $raw['checks'] = [];
        }
        if ($bucket === 'goals' && !isset($raw['krs'])) {
            $raw['krs'] = [];
        }
        if ($bucket === 'clients' && !isset($raw['source'])) {
            $raw['source'] = 'desk';
        }
        try {
            $row = desk_upsert_item($bucket, $raw, ['title']);
        } catch (InvalidArgumentException $e) {
            desk_respond(['error' => $e->getMessage()], 400);
        }
        desk_respond(['ok' => true, $one => $row]);
    }
    if ($method === 'POST' && preg_match('#^' . $bucket . '/([^/]+)/delete$#', $rest, $m)) {
        desk_need_view();
        desk_respond(['ok' => desk_delete_item($bucket, $m[1])]);
    }
    if ($method === 'POST' && preg_match('#^' . $bucket . '/([^/]+)$#', $rest, $dm) && $bucket === 'habits') {
        continue;
    }
    if ($method === 'POST' && preg_match('#^' . $bucket . '/([^/]+)$#', $rest, $m)) {
        desk_need_view();
        $raw = desk_body();
        $raw['id'] = $m[1];
        try {
            $row = desk_upsert_item($bucket, $raw, []);
        } catch (InvalidArgumentException $e) {
            desk_respond(['error' => $e->getMessage()], 400);
        }
        desk_respond(['ok' => true, $one => $row]);
    }
}

if ($method === 'POST' && preg_match('#^habits/([^/]+)/check$#', $rest, $m)) {
    desk_need_view();
    $raw = desk_body();
    $date = (string)($raw['date'] ?? desk_moscow_date());
    $on = true;
    if (array_key_exists('on', $raw)) {
        $v = $raw['on'];
        $on = $v === true || $v === 1 || $v === '1';
    }
    $db = desk_pdo();
    try {
        $variantId = trim((string)($raw['variant_id'] ?? ''));
        if ($db && $on && desk_game_habit_step_plan($db, $m[1], $date)) {
            desk_respond(['error' => 'habit_steps_required'], 400);
        }
        if ($db && !desk_game_validate_habit_variant($db, $m[1], $date, $variantId, $on)) {
            desk_respond(['error' => 'bad_habit_variant'], 400);
        }
        $row = $db
            ? desk_game_transaction($db, static function () use ($m, $date, $on, $variantId, $db) {
                $habit = desk_habit_check($m[1], $date, (bool)$on);
                if ($habit) desk_game_after_habit_check($db, $habit, $date, $on, $variantId);
                return $habit;
            })
            : desk_habit_check($m[1], $date, (bool)$on);
    } catch (Throwable $e) {
        desk_respond(['error' => 'save_failed'], 500);
    }
    if (!$row) {
        desk_respond(['error' => 'not_found'], 400);
    }
    desk_respond(['ok' => true, 'habit' => $row]);
}

if ($method === 'POST' && preg_match('#^habits/([^/]+)/steps$#', $rest, $m)) {
    desk_need_view();
    $raw = desk_body();
    $date = (string)($raw['date'] ?? desk_moscow_date());
    $step = (int)($raw['step'] ?? 0);
    $db = desk_pdo();
    if (!$db) desk_respond(['error' => 'steps_need_mysql'], 503);
    try {
        $progress = desk_game_transaction($db, static fn() => desk_game_habit_step_add($db, $m[1], $date, $step));
    } catch (Throwable $e) {
        desk_respond(['error' => 'save_failed'], 500);
    }
    if (!$progress) desk_respond(['error' => 'bad_habit_step'], 400);
    desk_respond(['ok' => true, 'progress' => $progress]);
}

if ($method === 'POST' && ($rest === 'game/habit-step-plans' || $rest === 'game/habit-step-plans/')) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    $raw = desk_body();
    $plan = desk_game_set_habit_step_plan(
        $db,
        trim((string)($raw['habit_id'] ?? '')),
        (int)($raw['steps_required'] ?? 0),
        (int)($raw['target_ml'] ?? 0)
    );
    if (!$plan) desk_respond(['ok' => false, 'error' => 'bad_step_plan'], 400);
    desk_respond(['ok' => true, 'plan' => $plan]);
}

if ($method === 'POST' && preg_match('#^habits/([^/]+)$#', $rest, $m)) {
    desk_need_view();
    $raw = desk_body();
    $raw['id'] = $m[1];
    try {
        $row = desk_upsert_item('habits', $raw, []);
    } catch (InvalidArgumentException $e) {
        desk_respond(['error' => $e->getMessage()], 400);
    }
    desk_respond(['ok' => true, 'habit' => $row]);
}

if ($method === 'DELETE' && preg_match('#^habits/([^/]+)$#', $rest, $m)) {
    desk_need_view();
    $db = desk_pdo();
    if (!$db) desk_respond(['error' => 'archive_needs_mysql'], 503);
    try {
        $archived = desk_game_transaction($db, static function () use ($db, $m): bool {
            $st = $db->prepare('UPDATE desk_habits SET archived = 1, updated_at = ? WHERE id = ? AND archived = 0');
            $st->execute([desk_sql_now(), $m[1]]);
            if ($st->rowCount() < 1) return false;
            // An archived habit must not remain a current daily. Historical checks,
            // XP events and skill binding remain intact for the archive.
            $db->prepare('DELETE FROM game_daily_habits WHERE habit_id = ?')->execute([$m[1]]);
            return true;
        });
    } catch (Throwable $e) {
        desk_respond(['error' => 'archive_failed'], 500);
    }
    if (!$archived) desk_respond(['error' => 'not_found'], 404);
    desk_respond(['ok' => true, 'archived_id' => $m[1]]);
}

if ($method === 'POST' && ($rest === 'sync' || $rest === 'sync/')) {
    desk_need_admin();
    $raw = desk_body();
    if (!$raw) {
        desk_respond(['error' => 'bad_json'], 400);
    }
    $store = desk_upsert_from_sync(
        isset($raw['tasks']) && is_array($raw['tasks']) ? $raw['tasks'] : [],
        isset($raw['events']) && is_array($raw['events']) ? $raw['events'] : []
    );
    desk_respond([
        'ok' => true,
        'tasks' => count($store['tasks']),
        'events' => count($store['events']),
        'storage' => desk_pdo() ? 'mysql' : 'json',
    ]);
}

if ($method === 'GET' && ($rest === 'wake' || $rest === 'wake/')) {
    desk_need_admin();
    desk_respond(['ok' => true, 'items' => desk_pending_wake()]);
}

if ($method === 'POST' && ($rest === 'wake' || $rest === 'wake/')) {
    desk_need_admin();
    $raw = desk_body();
    if (!$raw) {
        desk_respond(['error' => 'bad_json'], 400);
    }
    $item = desk_enqueue_wake($raw, (string)($raw['kind'] ?? 'tg'));
    desk_respond(['ok' => true, 'item' => $item]);
}

if ($method === 'POST' && preg_match('#^tasks/([^/]+)/directions/add$#', $rest, $m)) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) {
        desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    }
    $raw = desk_body();
    $dirId = trim((string)($raw['direction_id'] ?? ''));
    if ($dirId === '') {
        desk_respond(['ok' => false, 'error' => 'direction_id'], 400);
    }
    if (!desk_direction_add($db, $m[1], $dirId)) {
        desk_respond(['ok' => false, 'error' => 'not_found'], 400);
    }
    desk_respond(['ok' => true]);
}

if ($method === 'POST' && preg_match('#^tasks/([^/]+)/directions/remove$#', $rest, $m)) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) {
        desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    }
    $raw = desk_body();
    $dirId = trim((string)($raw['direction_id'] ?? ''));
    if ($dirId === '') {
        desk_respond(['ok' => false, 'error' => 'direction_id'], 400);
    }
    desk_direction_remove($db, $m[1], $dirId);
    desk_respond(['ok' => true]);
}

if ($method === 'POST' && preg_match('#^tasks/([^/]+)/checklists$#', $rest, $m)) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) {
        desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    }
    $raw = desk_body();
    $id = desk_checklist_create($db, $m[1], (string)($raw['title'] ?? 'Список'));
    if (!$id) {
        desk_respond(['ok' => false, 'error' => 'not_found'], 400);
    }
    desk_respond(['ok' => true, 'id' => $id]);
}

if ($method === 'POST' && preg_match('#^checklists/([^/]+)/items$#', $rest, $m)) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) {
        desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    }
    $raw = desk_body();
    $id = desk_checklist_item_create($db, $m[1], (string)($raw['text'] ?? ''));
    if (!$id) {
        desk_respond(['ok' => false, 'error' => 'bad_item'], 400);
    }
    desk_respond(['ok' => true, 'id' => $id]);
}

if ($method === 'POST' && preg_match('#^checklists/([^/]+)$#', $rest, $m)) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) {
        desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    }
    if (!desk_checklist_update($db, $m[1], desk_body())) {
        desk_respond(['ok' => false, 'error' => 'not_found'], 400);
    }
    desk_respond(['ok' => true]);
}

if ($method === 'DELETE' && preg_match('#^checklists/([^/]+)$#', $rest, $m)) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) {
        desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    }
    if (!desk_checklist_delete($db, $m[1])) {
        desk_respond(['ok' => false, 'error' => 'not_found'], 400);
    }
    desk_respond(['ok' => true]);
}

if ($method === 'POST' && preg_match('#^items/([^/]+)$#', $rest, $m)) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) {
        desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    }
    $itemPatch = desk_body();
    try {
        $updated = desk_game_transaction($db, static function () use ($db, $m, $itemPatch) {
            if (!desk_checklist_item_update($db, $m[1], $itemPatch)) return false;
            if (array_key_exists('done', $itemPatch)) desk_game_after_checklist_item($db, $m[1]);
            return true;
        });
    } catch (Throwable $e) {
        desk_respond(['ok' => false, 'error' => 'save_failed'], 500);
    }
    if (!$updated) {
        desk_respond(['ok' => false, 'error' => 'not_found'], 400);
    }
    desk_respond(['ok' => true]);
}

if ($method === 'DELETE' && preg_match('#^items/([^/]+)$#', $rest, $m)) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) {
        desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    }
    if (!desk_checklist_item_delete($db, $m[1])) {
        desk_respond(['ok' => false, 'error' => 'not_found'], 400);
    }
    desk_respond(['ok' => true]);
}

if ($method === 'POST' && preg_match('#^tasks/([^/]+)/subtask/link$#', $rest, $m)) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) {
        desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    }
    $raw = desk_body();
    $childId = trim((string)($raw['child_id'] ?? ''));
    if ($childId === '') {
        desk_respond(['ok' => false, 'error' => 'child_id'], 400);
    }
    $res = desk_subtask_link($db, $m[1], $childId);
    if ($res === null) {
        desk_respond(['ok' => false, 'error' => 'not_found'], 400);
    }
    if ($res !== 'ok') {
        desk_respond(['ok' => false, 'error' => $res], 400);
    }
    desk_respond(['ok' => true]);
}

if ($method === 'POST' && preg_match('#^tasks/([^/]+)/subtask/unlink$#', $rest, $m)) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) {
        desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    }
    $raw = desk_body();
    $childId = trim((string)($raw['child_id'] ?? ''));
    if ($childId === '') {
        desk_respond(['ok' => false, 'error' => 'child_id'], 400);
    }
    if (!desk_subtask_unlink($db, $m[1], $childId)) {
        desk_respond(['ok' => false, 'error' => 'not_found'], 400);
    }
    desk_respond(['ok' => true]);
}

if ($method === 'POST' && ($rest === 'links' || $rest === 'links/')) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) {
        desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    }
    $raw = desk_body();
    $from = trim((string)($raw['from_task'] ?? ''));
    $to = trim((string)($raw['to_task'] ?? ''));
    $type = trim((string)($raw['type'] ?? ''));
    if ($from === '' || $to === '' || $type === '') {
        desk_respond(['ok' => false, 'error' => 'bad_request'], 400);
    }
    $res = desk_link_create($db, $from, $to, $type);
    if (!$res['ok']) {
        desk_respond(['ok' => false, 'error' => $res['error']], 400);
    }
    desk_respond(['ok' => true, 'id' => $res['id']]);
}

if ($method === 'DELETE' && preg_match('#^links/([^/]+)$#', $rest, $m)) {
    desk_need_view();
    $db = desk_need_db();
    if (!$db) {
        desk_respond(['ok' => false, 'error' => 'no_db'], 503);
    }
    if (!desk_link_delete($db, $m[1])) {
        desk_respond(['ok' => false, 'error' => 'not_found'], 400);
    }
    desk_respond(['ok' => true]);
}

if ($method === 'POST' && preg_match('#^wake/([^/]+)/ack$#', $rest, $m)) {
    desk_need_admin();
    $ok = desk_ack_wake($m[1]);
    desk_respond(['ok' => $ok]);
}

desk_respond(['error' => 'not_found', 'rest' => $rest], 404);
