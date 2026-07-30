<?php
/**
 * Yakor agent mock for shared hosting (PHP).
 * Routes under /api/yakors/{yakor_id}/...
 */
header('X-Content-Type-Options: nosniff');

function yakor_is_list(array $arr): bool
{
    if ($arr === []) {
        return true;
    }
    return array_keys($arr) === range(0, count($arr) - 1);
}

function yakor_starts_with(string $haystack, string $needle): bool
{
    if ($needle === '') {
        return true;
    }
    return strpos($haystack, $needle) === 0;
}

/** Создаёт пустой private GitHub repo. Возвращает clone_url или '' при ошибке. */
function github_create_empty_repo(string $token, string $repoName, string $description): array
{
    $payload = json_encode([
        'name' => $repoName,
        'description' => $description,
        'private' => true,
        'auto_init' => false,
        'has_issues' => false,
        'has_projects' => false,
        'has_wiki' => false,
    ]);
    $headers = [
        'Authorization: Bearer ' . $token,
        'Accept: application/vnd.github+json',
        'Content-Type: application/json',
        'User-Agent: yakor-agent-php',
        'X-GitHub-Api-Version: 2022-11-28',
    ];
    $raw = '';
    $code = 0;
    if (function_exists('curl_init')) {
        $ch = curl_init('https://api.github.com/user/repos');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        $raw = (string)curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    } else {
        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers),
                'content' => $payload,
                'ignore_errors' => true,
                'timeout' => 60,
            ],
        ]);
        $raw = (string)@file_get_contents('https://api.github.com/user/repos', false, $ctx);
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
            $code = (int)$m[1];
        }
    }
    $data = json_decode($raw, true);
    if (($code === 201 || $code === 200) && is_array($data) && !empty($data['clone_url'])) {
        return [
            'ok' => true,
            'clone_url' => (string)$data['clone_url'],
            'html_url' => (string)($data['html_url'] ?? ''),
            'full_name' => (string)($data['full_name'] ?? ''),
            'http_code' => $code,
        ];
    }
    return [
        'ok' => false,
        'clone_url' => '',
        'html_url' => '',
        'full_name' => '',
        'http_code' => $code,
        'error' => is_array($data) ? (string)($data['message'] ?? $raw) : $raw,
    ];
}

function github_safe_repo_name(string $projectId, string $projectName): string
{
    $short = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $projectId));
    $short = substr($short, 0, 8);
    if ($short === '') {
        $short = bin2hex(random_bytes(4));
    }
    $base = strtolower(preg_replace('/[^a-zA-Z0-9._-]+/', '-', $projectName));
    $base = trim($base, '-._');
    if ($base === '' || strlen($base) > 20) {
        $base = 'proj';
    }
    // GitHub max 100; держим короче
    return 'yakor-' . $base . '-' . $short;
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    $configPath = __DIR__ . '/config.sample.php';
}
$config = require $configPath;

$dataDir = !empty($config['data_dir']) ? (string)$config['data_dir'] : (__DIR__ . '/_data');
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0775, true);
}
$uploadsDir = $dataDir . '/uploads';
if (!is_dir($uploadsDir)) {
    @mkdir($uploadsDir, 0775, true);
}

$storeFile = $dataDir . '/store.json';

function respond_json($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function respond_no_content(): void
{
    http_response_code(204);
    exit;
}

function load_store(string $storeFile): array
{
    if (!is_file($storeFile)) {
        return ['tasks' => [], 'results' => [], 'projects' => [], 'files' => []];
    }
    $raw = json_decode((string)file_get_contents($storeFile), true);
    if (!is_array($raw)) {
        return ['tasks' => [], 'results' => [], 'projects' => [], 'files' => []];
    }
    return [
        'tasks' => isset($raw['tasks']) && is_array($raw['tasks']) ? $raw['tasks'] : [],
        'results' => isset($raw['results']) && is_array($raw['results']) ? $raw['results'] : [],
        'projects' => isset($raw['projects']) && is_array($raw['projects']) ? $raw['projects'] : [],
        'files' => isset($raw['files']) && is_array($raw['files']) ? $raw['files'] : [],
    ];
}

function save_store(string $storeFile, array $store): void
{
    $tmp = $storeFile . '.tmp';
    file_put_contents($tmp, json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
    rename($tmp, $storeFile);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function require_admin(array $config): void
{
    $token = (string)($config['admin_token'] ?? '');
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $bearer = '';
    if (stripos($header, 'Bearer ') === 0) {
        $bearer = trim(substr($header, 7));
    }
    $alt = (string)($_SERVER['HTTP_X_YAKOR_TOKEN'] ?? ($_GET['token'] ?? ''));
    if ($token !== '' && ($bearer === $token || $alt === $token)) {
        return;
    }
    respond_json(['error' => 'unauthorized'], 401);
}

function uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function take_pending(array &$store, string $yakorId, string $projectId, int $limit = 10): array
{
    $out = [];
    $now = gmdate('c');
    foreach ($store['tasks'] as &$task) {
        if (($task['yakor_id'] ?? '') !== $yakorId) {
            continue;
        }
        if (($task['status'] ?? '') !== 'pending') {
            continue;
        }
        $taskProject = (string)($task['project_id'] ?? '');
        if ($projectId !== '' && $taskProject !== '' && $taskProject !== $projectId) {
            continue;
        }
        $task['status'] = 'delivered';
        $task['delivered_at'] = $now;
        $out[] = [
            'id' => $task['id'],
            'tool' => $task['tool'],
            'params' => $task['params'] ?? new stdClass(),
        ];
        if (count($out) >= $limit) {
            break;
        }
    }
    unset($task);
    return $out;
}

function parse_route(string $uri): array
{
    $path = parse_url($uri, PHP_URL_PATH) ?: '';
    // Accept both /api/yakors/... and /yakors/... if mounted oddly
    if (!preg_match('#/api/yakors/([^/]+)(?:/(.*))?$#', $path, $m)
        && !preg_match('#/yakors/([^/]+)(?:/(.*))?$#', $path, $m)) {
        return [null, null];
    }
    $yakorId = $m[1];
    $rest = isset($m[2]) ? trim($m[2], '/') : '';
    return [$yakorId, $rest];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = $_SERVER['REQUEST_URI'] ?? '/';
[$yakorId, $rest] = parse_route($uri);

if ($yakorId === null) {
    if ($method === 'GET' && preg_match('#/api/health/?$#', parse_url($uri, PHP_URL_PATH) ?: '')) {
        $store = load_store($storeFile);
        respond_json([
            'ok' => true,
            'service' => 'yakor-agent-php',
            'pending' => count(array_filter($store['tasks'], function ($t) {
                return ($t['status'] ?? '') === 'pending';
            })),
            'results' => count($store['results']),
        ]);
    }
    respond_json(['error' => 'not_found', 'path' => parse_url($uri, PHP_URL_PATH)], 404);
}

$store = load_store($storeFile);
$restNorm = $rest === null ? '' : $rest;

// GET /api/health under yakor? skip

// Admin enqueue
if ($method === 'POST' && ($restNorm === 'admin/enqueue' || $restNorm === 'admin/enqueue/')) {
    require_admin($config);
    $body = read_json_body();
    $items = [];
    if (isset($body['tasks']) && is_array($body['tasks'])) {
        $items = $body['tasks'];
    } elseif (yakor_is_list($body)) {
        $items = $body;
    } else {
        $items = [$body];
    }
    $created = [];
    $now = gmdate('c');
    foreach ($items as $item) {
        if (!is_array($item) || empty($item['tool'])) {
            continue;
        }
        $task = [
            'id' => (string)($item['id'] ?? uuid_v4()),
            'yakor_id' => $yakorId,
            'project_id' => isset($item['project_id']) ? (string)$item['project_id'] : '',
            'tool' => (string)$item['tool'],
            'params' => $item['params'] ?? new stdClass(),
            'status' => 'pending',
            'created_at' => $now,
            'delivered_at' => null,
        ];
        $store['tasks'][] = $task;
        $created[] = $task;
    }
    save_store($storeFile, $store);
    respond_json(['ok' => true, 'created' => $created], 201);
}

// Admin queue
if ($method === 'GET' && yakor_starts_with($restNorm, 'admin/queue')) {
    require_admin($config);
    $status = isset($_GET['status']) ? (string)$_GET['status'] : '';
    $tasks = array_values(array_filter($store['tasks'], function ($t) use ($yakorId) {
        return ($t['yakor_id'] ?? '') === $yakorId;
    }));
    if ($status !== '') {
        $tasks = array_values(array_filter($tasks, function ($t) use ($status) {
            return ($t['status'] ?? '') === $status;
        }));
    }
    $tasks = array_reverse($tasks);
    respond_json(['payload' => $tasks, 'count' => count($tasks)]);
}

// Admin results
if ($method === 'GET' && yakor_starts_with($restNorm, 'admin/results')) {
    require_admin($config);
    $since = isset($_GET['since']) ? (string)$_GET['since'] : '';
    $results = array_values(array_filter($store['results'], function ($r) use ($yakorId) {
        return ($r['yakor_id'] ?? '') === $yakorId;
    }));
    if ($since !== '') {
        $results = array_values(array_filter($results, function ($r) use ($since) {
            return ($r['received_at'] ?? '') >= $since;
        }));
    }
    $results = array_reverse($results);
    respond_json(['payload' => $results, 'count' => count($results)]);
}

// Admin credentials (push_token for existing projects)
if ($method === 'GET' && yakor_starts_with($restNorm, 'admin/credentials')) {
    require_admin($config);
    $pushToken = (string)($config['github_token'] ?? '');
    respond_json([
        'repo_url' => (string)($config['default_repo_url'] ?? ''),
        'branch' => (string)($config['default_branch'] ?? 'main'),
        'push_token' => $pushToken,
        'has_token' => $pushToken !== '',
    ]);
}

// Admin reset
if ($method === 'POST' && yakor_starts_with($restNorm, 'admin/reset')) {
    require_admin($config);
    $body = read_json_body();
    $keepProjects = !empty($body['keep_projects']);
    $store['tasks'] = array_values(array_filter($store['tasks'], function ($t) use ($yakorId) {
        return ($t['yakor_id'] ?? '') !== $yakorId;
    }));
    $store['results'] = array_values(array_filter($store['results'], function ($r) use ($yakorId) {
        return ($r['yakor_id'] ?? '') !== $yakorId;
    }));
    $store['files'] = array_values(array_filter($store['files'], function ($f) use ($yakorId) {
        return ($f['yakor_id'] ?? '') !== $yakorId;
    }));
    if (!$keepProjects) {
        $store['projects'] = array_values(array_filter($store['projects'], function ($p) use ($yakorId) {
            return ($p['yakor_id'] ?? '') !== $yakorId;
        }));
    }
    save_store($storeFile, $store);
    respond_json(['ok' => true]);
}

// LongPoll GET tasks/
if ($method === 'GET' && ($restNorm === 'tasks' || $restNorm === 'tasks/')) {
    $projectId = isset($_GET['project_id']) ? (string)$_GET['project_id'] : '';
    @set_time_limit(35);
    $waitMs = (int)($config['longpoll_ms'] ?? 14000);
    $deadline = (int)(microtime(true) * 1000) + $waitMs;

    $payload = take_pending($store, $yakorId, $projectId);
    if ($payload) {
        save_store($storeFile, $store);
        respond_json(['status' => 'OK', 'payload' => $payload, 'pageInfo' => ['count' => count($payload)]]);
    }

    while ((int)(microtime(true) * 1000) < $deadline) {
        usleep(400000); // 0.4s
        clearstatcache(true, $storeFile);
        $store = load_store($storeFile);
        $payload = take_pending($store, $yakorId, $projectId);
        if ($payload) {
            save_store($storeFile, $store);
            respond_json(['status' => 'OK', 'payload' => $payload, 'pageInfo' => ['count' => count($payload)]]);
        }
    }
    respond_no_content();
}

// POST results
if ($method === 'POST' && yakor_starts_with($restNorm, 'tasks/results')) {
    $body = read_json_body();
    $items = [];
    if (yakor_is_list($body)) {
        $items = $body;
    } elseif (isset($body['results']) && is_array($body['results'])) {
        $items = $body['results'];
    } elseif (isset($body['payload']) && is_array($body['payload'])) {
        $items = $body['payload'];
    } else {
        respond_json(['error' => 'expected JSON array of results'], 400);
    }

    $now = gmdate('c');
    $saved = 0;
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $status = $item['status'] ?? 'error';
        if ($status !== 'done' && $status !== 'error') {
            $status = 'error';
        }
        $taskId = (string)($item['task_id'] ?? $item['id'] ?? '');
        $record = [
            'yakor_id' => $yakorId,
            'db_id' => (string)($_GET['db_id'] ?? ($item['db_id'] ?? '')),
            'task_id' => $taskId,
            'status' => $status,
            'result' => $item['result'] ?? null,
            'error' => $item['error'] ?? null,
            'log' => $item['log'] ?? null,
            'raw' => $item,
            'received_at' => $now,
        ];
        $store['results'][] = $record;
        foreach ($store['tasks'] as &$task) {
            if (($task['yakor_id'] ?? '') === $yakorId && ($task['id'] ?? '') === $taskId) {
                $task['status'] = $status === 'done' ? 'done' : 'error';
                $task['finished_at'] = $now;
            }
        }
        unset($task);
        $saved++;
    }
    save_store($storeFile, $store);
    respond_json(['ok' => true, 'accepted' => $saved]);
}

// Projects POST
if ($method === 'POST' && ($restNorm === 'projects' || $restNorm === 'projects/')) {
    $body = read_json_body();
    $pushToken = (string)($config['github_token'] ?? '');
    $projectId = uuid_v4();
    $projectName = (string)($body['name'] ?? 'unnamed');
    $description = (string)($body['description'] ?? '');
    $repoUrl = (string)($config['default_repo_url'] ?? 'https://github.com/MadjahedVKaske/YakorPushTest.git');
    $repoHtml = '';
    $repoCreated = false;
    $repoError = '';

    // Одна кнопка = своя ПУСТАЯ репа. Иначе non-fast-forward на общий YakorPushTest.
    if ($pushToken !== '') {
        $repoName = github_safe_repo_name($projectId, $projectName);
        $gh = github_create_empty_repo(
            $pushToken,
            $repoName,
            'Yakor project: ' . $projectName . ' (' . $projectId . ')'
        );
        if (!empty($gh['ok']) && $gh['clone_url'] !== '') {
            $repoUrl = $gh['clone_url'];
            $repoHtml = (string)$gh['html_url'];
            $repoCreated = true;
        } else {
            $repoError = (string)($gh['error'] ?? 'github create failed');
        }
    }

    $project = [
        'yakor_id' => $yakorId,
        'project_id' => $projectId,
        'db_id' => (string)($body['db_id'] ?? ($_GET['db_id'] ?? '')),
        'name' => $projectName,
        'description' => $description,
        'repo_url' => $repoUrl,
        'repo_html_url' => $repoHtml,
        'branch' => (string)($config['default_branch'] ?? 'main'),
        'repo_created' => $repoCreated,
        'repo_error' => $repoError,
        'created_at' => gmdate('c'),
    ];
    $store['projects'][] = $project;
    save_store($storeFile, $store);
    respond_json([
        'project_id' => $project['project_id'],
        'repo_url' => $project['repo_url'],
        'repo_html_url' => $repoHtml,
        'branch' => $project['branch'],
        'name' => $project['name'],
        'push_token' => $pushToken,
        'repo_created' => $repoCreated,
        'repo_error' => $repoError,
    ], 201);
}

// Projects GET
if ($method === 'GET' && ($restNorm === 'projects' || $restNorm === 'projects/')) {
    $dbId = isset($_GET['db_id']) ? (string)$_GET['db_id'] : '';
    $list = array_values(array_filter($store['projects'], function ($p) use ($yakorId) {
        return ($p['yakor_id'] ?? '') === $yakorId;
    }));
    if ($dbId !== '') {
        $list = array_values(array_filter($list, function ($p) use ($dbId) {
            return ($p['db_id'] ?? '') === '' || ($p['db_id'] ?? '') === $dbId;
        }));
    }
    $payload = array_map(function ($p) {
        return [
            'project_id' => $p['project_id'],
            'name' => $p['name'],
            'description' => $p['description'] ?? '',
            'repo_url' => $p['repo_url'],
            'branch' => $p['branch'],
        ];
    }, $list);
    respond_json(['status' => 'OK', 'payload' => $payload]);
}

// Files POST
if ($method === 'POST' && ($restNorm === 'files' || $restNorm === 'files/')) {
    $meta = [
        'yakor_id' => $yakorId,
        'db_id' => (string)($_GET['db_id'] ?? ''),
        'project_id' => (string)($_GET['project_id'] ?? ($_POST['project_id'] ?? '')),
        'originalname' => '',
        'filename' => '',
        'size' => 0,
        'path' => '',
        'received_at' => gmdate('c'),
    ];
    if (!empty($_FILES['file']) && is_uploaded_file($_FILES['file']['tmp_name'])) {
        $name = basename((string)$_FILES['file']['name']);
        $destName = gmdate('YmdHis') . '_' . bin2hex(random_bytes(4)) . '_' . $name;
        $dest = $uploadsDir . '/' . $destName;
        if (!move_uploaded_file($_FILES['file']['tmp_name'], $dest)) {
            respond_json(['error' => 'upload_failed'], 500);
        }
        $meta['originalname'] = $name;
        $meta['filename'] = $destName;
        $meta['size'] = (int)$_FILES['file']['size'];
        $meta['path'] = $dest;
    }
    $store['files'][] = $meta;
    save_store($storeFile, $store);
    respond_json(['ok' => true, 'file' => $meta]);
}

respond_json(['error' => 'not_found', 'method' => $method, 'rest' => $restNorm], 404);
