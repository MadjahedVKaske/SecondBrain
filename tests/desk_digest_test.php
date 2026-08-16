<?php
require_once __DIR__ . '/../public/api/desk/lib.php';

function expect_digest(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$today = desk_moscow_date();
$yesterday = (new DateTime('yesterday', new DateTimeZone('Europe/Moscow')))->format('Y-m-d');
$tomorrow = (new DateTime('tomorrow', new DateTimeZone('Europe/Moscow')))->format('Y-m-d');
$old = (new DateTime('-4 days', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
$now = (new DateTime('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
$links = desk_empty_links();
$links['blocked_by'][] = ['from' => 'blocker'];

$store = desk_empty_store();
$store['tasks'] = [
    ['id' => 'late', 'title' => 'Просроченная', 'status' => 'todo', 'due' => $yesterday, 'updated_at' => $now, 'links' => desk_empty_links()],
    ['id' => 'today', 'title' => 'Сегодня', 'status' => 'doing', 'due' => $today, 'updated_at' => $old, 'links' => desk_empty_links()],
    ['id' => 'tomorrow', 'title' => 'Завтра', 'status' => 'todo', 'due' => $tomorrow, 'updated_at' => $now, 'links' => desk_empty_links()],
    ['id' => 'done', 'title' => 'Сделано', 'status' => 'done', 'due' => $yesterday, 'updated_at' => $today . ' 10:00:00', 'links' => desk_empty_links()],
    ['id' => 'blocker', 'title' => 'Блокер', 'status' => 'done', 'due' => '', 'updated_at' => $today . ' 09:00:00', 'links' => desk_empty_links()],
    ['id' => 'unlocked', 'title' => 'Разлоченная', 'status' => 'todo', 'due' => '', 'updated_at' => $now, 'links' => $links],
];
$store['events'][] = ['id' => 'event', 'title' => 'Созвон', 'start' => $today . 'T12:30:00', 'allDay' => false];
$store['works'][] = ['id' => 'work', 'task_id' => 'today', 'date' => $today, 'hours' => 2.5];

$morning = desk_build_digest('morning', $store);
expect_digest($morning['counts']['overdue'] === 1, 'morning overdue');
expect_digest($morning['counts']['today'] === 1, 'morning today');
expect_digest($morning['counts']['events_today'] === 1, 'morning calendar');
expect_digest($morning['counts']['stale'] === 1, 'morning stale');
expect_digest($morning['counts']['unlocked'] === 1, 'morning unlocked through links.blocked_by');
expect_digest(strpos($morning['text'], '12:30 Созвон') !== false, 'calendar time in text');

$evening = desk_build_digest('evening', $store);
expect_digest($evening['counts']['done_today'] === 2, 'evening done updated today');
expect_digest(abs($evening['counts']['hours_today'] - 2.5) < 0.001, 'evening logged hours');
expect_digest($evening['counts']['tomorrow'] === 1, 'evening tomorrow');
expect_digest($evening['counts']['open'] === 4, 'evening all open tasks');
expect_digest(strpos($evening['text'], 'Открыто: 4') !== false, 'all open tasks in text');
expect_digest(strpos($evening['text'], 'Завтра: 1') !== false, 'tomorrow in text');
expect_digest(strpos($evening['text'], 'В wiki:') !== false, 'wiki inbox in text');
expect_digest($morning['text'] !== $evening['text'], 'modes differ');

echo "PASS desk_digest\n";
