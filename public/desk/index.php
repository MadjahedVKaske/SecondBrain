<?php
require_once __DIR__ . '/../api/desk/lib.php';
$cfg = desk_cfg();
$view = (string)($cfg['view_token'] ?? '');
$k = (string)($_GET['k'] ?? ($_COOKIE['desk_k'] ?? ''));
$ok = $view !== '' && $view !== 'change-me-view-token' && hash_equals($view, $k);
if (function_exists('desk_locked') && desk_locked()) {
    $ok = false;
    http_response_code(429);
}
if ($ok) {
    if (function_exists('desk_fail_clear')) {
        desk_fail_clear();
    }
    setcookie('desk_k', $k, [
        'expires' => time() + 60 * 60 * 24 * 180,
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    if (isset($_GET['k']) && $_GET['k'] !== '') {
        header('Location: /desk/', true, 302);
        exit;
    }
} elseif (isset($_GET['k']) && $_GET['k'] !== '' && function_exists('desk_fail_hit')) {
    desk_fail_hit();
}
$ver = max(@filemtime(__DIR__ . '/app.js') ?: time(), @filemtime(__DIR__ . '/style.css') ?: time());
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?><!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <meta name="theme-color" content="#121418" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="Стол" />
  <link rel="manifest" href="manifest.webmanifest" />
  <link rel="icon" href="icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="icon.svg" />
  <title>Стол</title>
  <link rel="stylesheet" href="style.css?v=<?php echo (int)$ver; ?>" />
</head>
<body>
<?php if (!$ok): ?>
  <div class="gate">
    <h1>Стол</h1>
    <p class="sub">Нужна ссылка с ключом. Если есть - вставь ключ.</p>
    <form method="get">
      <input name="k" placeholder="ключ" autocomplete="off" />
      <button type="submit">Открыть</button>
    </form>
  </div>
<?php else: ?>
  <div class="wrap">
    <header class="top">
      <div>
        <h1>Стол</h1>
        <div class="sub" id="stamp">загрузка…</div>
      </div>
      <div class="sub" id="storage"></div>
    </header>
    <nav class="tabs">
      <a href="#tasks">Задачи</a>
      <a href="#ideas">Идеи</a>
      <a href="#client">Клиент</a>
      <a href="#digest">Дайджест</a>
      <a href="#calendar">Календарь</a>
      <a href="#projects">Проекты</a>
      <a href="#goals">Цели</a>
      <a href="#habits">Привычки</a>
    </nav>
    <div id="client-context" class="client-context" hidden></div>

    <section class="page" id="p-tasks">
      <nav class="tabs filters" id="area-filters"></nav>
      <div id="project-banner" class="proj-banner" hidden></div>
      <form class="form form-task" id="add-task">
        <label class="fld fld-title"><span>задача</span>
          <input id="nt-title" type="text" placeholder="что сделать" required /></label>
        <label class="fld"><span>срок</span>
          <input id="nt-due" type="date" /></label>
        <label class="fld"><span>статус</span>
          <select id="nt-status">
            <option value="todo">к выполнению</option>
            <option value="doing">в работе</option>
            <option value="waiting_reply">ждём ответа</option>
            <option value="on_test">на тесте</option>
            <option value="paused">отложено</option>
          </select></label>
        <label class="fld"><span>категория</span>
          <select id="nt-area">
            <option value="работа">работа</option>
            <option value="личное">личное</option>
            <option value="проект">проект</option>
          </select></label>
        <label class="fld"><span>клиент</span>
          <select id="nt-client"></select></label>
        <label class="fld"><span>направление</span>
          <select id="nt-proj"></select></label>
        <button type="submit">Добавить</button>
      </form>
      <div class="err" id="task-err"></div>
      <div class="col">
        <div id="task-board"></div>
      </div>
    </section>

    <section class="page" id="p-ideas">
      <form class="form form-idea" id="add-idea">
        <label class="fld fld-title"><span>идея</span>
          <input id="ni-title" type="text" placeholder="что стоит попробовать" required /></label>
        <label class="fld"><span>клиент</span>
          <select id="ni-client"></select></label>
        <button type="submit">Сохранить</button>
      </form>
      <p class="sub">Быстрый входящий список. Созревшую идею переводи в бэклог — она появится в проектах.</p>
      <div class="ideas" id="ideas"></div>
    </section>

    <section class="page" id="p-calendar">
      <div class="row cal-legend">
        <details class="hint-pop">
          <summary aria-label="Подсказка по календарю">?</summary>
          <p>Клик или выделение слота - одна форма (задача или событие). Карточку тащи, клик по задаче - детали, по событию - удалить.</p>
        </details>
        <span class="pill работа">работа</span>
        <span class="pill личное">личное</span>
        <span class="pill проект">проект</span>
        <select id="cal-area">
          <option value="работа">новое: работа</option>
          <option value="личное">новое: личное</option>
          <option value="проект">новое: проект</option>
        </select>
      </div>
      <div class="col"><div id="fc"></div></div>
    </section>

    <section class="page" id="p-client">
      <div class="client-mode-head">
        <label class="fld"><span>клиент</span><select id="client-mode-select"></select></label>
        <div class="client-mode-actions">
          <button type="button" class="ghost" id="client-open-tasks">Задачи</button>
          <button type="button" class="ghost" id="client-open-calendar">Календарь</button>
          <button type="button" class="ghost" id="client-open-projects">Проекты</button>
        </div>
      </div>
      <div id="client-mode"></div>
    </section>

    <section class="page" id="p-digest">
      <div class="digest-head">
        <div class="row">
          <button type="button" id="digest-morning">Утро</button>
          <button type="button" class="ghost" id="digest-evening">Вечер</button>
        </div>
        <button type="button" class="ghost" id="digest-refresh">Обновить</button>
      </div>
      <div class="digest-stats" id="digest-stats"></div>
      <pre class="digest-text" id="digest-text">загрузка…</pre>
      <p class="sub">Telegram: <code>python scripts/brain_digest.py --mode morning|evening --notify</code></p>
    </section>

    <section class="page" id="p-projects">
      <form class="form form-proj" id="add-proj">
        <label class="fld fld-title"><span>направление</span>
          <input id="np-title" type="text" placeholder="еком, розница, идея" required /></label>
        <label class="fld"><span>клиент</span>
          <select id="np-client"></select></label>
        <label class="fld"><span>статус</span>
          <select id="np-status">
            <option value="idea">идея</option>
            <option value="backlog">бэклог</option>
            <option value="doing">в работе</option>
          </select></label>
        <button type="submit">Добавить</button>
      </form>
      <p class="sub">Клик по карточке - детали направления. «задачи →» - только его задачи. Готовые в архив, из фильтров пропадают.</p>
      <div class="kanban" id="kanban"></div>
      <details class="card catalogs">
        <summary>Справочник (свернуть)</summary>
        <div id="catalogs"></div>
      </details>
    </section>

    <section class="page" id="p-goals">
      <form class="form form-goal" id="add-goal">
        <label class="fld fld-title"><span>цель</span>
          <input id="ng-title" type="text" placeholder="чего хочу" required /></label>
        <label class="fld"><span>цикл</span>
          <select id="ng-horizon"></select></label>
        <button type="submit">Добавить</button>
      </form>
      <p class="sub">Цель = направление на квартал/год. Ключевые результаты снизу, прогресс считается сам.</p>
      <div class="goals" id="goals"></div>
    </section>

    <section class="page" id="p-habits">
      <form class="form form-habit" id="add-habit">
        <label class="fld fld-title"><span>привычка</span>
          <input id="nh-title" type="text" placeholder="что отмечать каждый день" required /></label>
        <button type="submit">Добавить</button>
      </form>
      <div id="habit-stats" class="stats"></div>
      <div id="habits"></div>
    </section>
  </div>
  <div id="drawer" class="drawer" hidden></div>
  <script>window.DESK_KEY = <?php echo json_encode($k, JSON_UNESCAPED_UNICODE); ?>;</script>
  <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"></script>
  <script src="app.js?v=<?php echo (int)$ver; ?>"></script>
<?php endif; ?>
</body>
</html>
