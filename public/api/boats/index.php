<?php
/**
 * Уведомления бука катеров (katervl.ru).
 * Сайт на REG.RU шлёт сюда, VPS пишет в Telegram.
 * Ловит /start от pending_usernames (Поля), id кладёт в _data/chats.json.
 */
header('X-Content-Type-Options: nosniff');

function boats_respond($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function boats_cfg(): array
{
    $path = (string)(getenv('BOATS_CONFIG_PATH') ?: (__DIR__ . '/config.php'));
    if (!is_file($path)) {
        http_response_code(503);
        exit;
    }
    $cfg = require $path;
    return is_array($cfg) ? $cfg : [];
}

function boats_data_dir(): string
{
    $dir = (string)(getenv('BOATS_DATA_DIR') ?: (__DIR__ . '/_data'));
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

function boats_load_json(string $file, array $default): array
{
    if (!is_file($file)) {
        return $default;
    }
    $raw = json_decode((string)file_get_contents($file), true);
    return is_array($raw) ? $raw : $default;
}

function boats_save_json(string $file, array $obj): void
{
    $tmp = $file . '.tmp';
    file_put_contents(
        $tmp,
        json_encode($obj, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );
    rename($tmp, $file);
}

function boats_log(string $line): void
{
    @file_put_contents(boats_data_dir() . '/sent.log', '[' . gmdate('c') . '] ' . $line . "\n", FILE_APPEND);
}

function boats_tg(string $bot, string $method, array $payload): array
{
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => json_encode($payload, JSON_UNESCAPED_UNICODE),
            'timeout' => 12,
            'ignore_errors' => true,
        ],
    ]);
    $res = @file_get_contents('https://api.telegram.org/bot' . $bot . '/' . $method, false, $ctx);
    $j = json_decode((string)$res, true);
    return is_array($j) ? $j : ['ok' => false];
}

function boats_require(array $cfg): void
{
    $got = (string)($_SERVER['HTTP_X_BOATS_TOKEN'] ?? '');
    $want = (string)($cfg['inbound_token'] ?? '');
    if ($want === '' || !hash_equals($want, $got)) {
        boats_respond(['error' => 'forbidden'], 403);
    }
}

function boats_all_chats(array $cfg): array
{
    $ids = [];
    foreach ((array)($cfg['chat_ids'] ?? []) as $c) {
        $i = (int)$c;
        if ($i) {
            $ids[] = $i;
        }
    }
    $extra = boats_load_json(boats_data_dir() . '/chats.json', ['ids' => []]);
    foreach ((array)($extra['ids'] ?? []) as $c) {
        $i = (int)$c;
        if ($i) {
            $ids[] = $i;
        }
    }
    return array_values(array_unique($ids));
}

function boats_discover(array $cfg): array
{
    $bot = trim((string)($cfg['bot_token'] ?? ''));
    if ($bot === '') {
        return ['ok' => false, 'error' => 'no_bot'];
    }
    $pending = [];
    foreach ((array)($cfg['pending_usernames'] ?? ['Yarozemna']) as $u) {
        $u = strtolower(ltrim((string)$u, '@'));
        if ($u !== '') {
            $pending[] = $u;
        }
    }
    $chatsFile = boats_data_dir() . '/chats.json';
    $offsetFile = boats_data_dir() . '/offset.json';
    $store = boats_load_json($chatsFile, ['ids' => [], 'users' => []]);
    $ids = array_map('intval', (array)($store['ids'] ?? []));
    $users = is_array($store['users'] ?? null) ? $store['users'] : [];
    $offset = (int)(boats_load_json($offsetFile, ['offset' => 0])['offset'] ?? 0);

    $res = boats_tg($bot, 'getUpdates', [
        'offset' => $offset,
        'limit' => 50,
        'timeout' => 0,
        'allowed_updates' => ['message'],
    ]);
    $updates = is_array($res['result'] ?? null) ? $res['result'] : [];
    $new = [];
    $max = $offset;
    foreach ($updates as $u) {
        if (!is_array($u)) {
            continue;
        }
        $uid = (int)($u['update_id'] ?? 0);
        if ($uid >= $max) {
            $max = $uid + 1;
        }
        $msg = $u['message'] ?? [];
        $frm = is_array($msg['from'] ?? null) ? $msg['from'] : [];
        $un = strtolower((string)($frm['username'] ?? ''));
        $id = (int)($frm['id'] ?? 0);
        if ($id > 0 && $un !== '' && in_array($un, $pending, true) && !in_array($id, $ids, true)) {
            $ids[] = $id;
            $users[$un] = $id;
            $new[] = ['id' => $id, 'username' => $un];
        }
    }
    if ($max !== $offset) {
        boats_save_json($offsetFile, ['offset' => $max]);
    }
    boats_save_json($chatsFile, ['ids' => array_values(array_unique($ids)), 'users' => $users]);
    foreach ($new as $n) {
        boats_tg($bot, 'sendMessage', [
            'chat_id' => $n['id'],
            'text' => 'Ок, бронь katervl.ru будет приходить сюда.',
            'disable_web_page_preview' => true,
        ]);
    }
    return [
        'ok' => true,
        'known' => count(array_unique($ids)),
        'new' => count($new),
        'caught' => array_column($new, 'username'),
    ];
}

function boats_send(array $cfg, string $text): array
{
    $bot = trim((string)($cfg['bot_token'] ?? ''));
    $chats = boats_all_chats($cfg);
    if ($bot === '' || $chats === []) {
        return ['ok' => false, 'sent' => 0, 'errors' => ['bot not configured']];
    }
    $sent = 0;
    $errors = [];
    foreach ($chats as $chatId) {
        $j = boats_tg($bot, 'sendMessage', [
            'chat_id' => $chatId,
            'text' => $text,
            'disable_web_page_preview' => true,
        ]);
        if (!empty($j['ok'])) {
            $sent++;
        } else {
            $errors[] = (string)($j['description'] ?? 'fail');
        }
    }
    boats_log('sent=' . $sent . ' err=' . implode(',', $errors));
    return ['ok' => $sent > 0, 'sent' => $sent, 'errors' => $errors];
}

$cfg = boats_cfg();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '';
$rest = '';
if (preg_match('#/api/boats(?:/(.*))?$#', $path, $m)) {
    $rest = isset($m[1]) ? trim($m[1], '/') : '';
}

if ($method === 'GET' && ($rest === '' || $rest === 'health')) {
    boats_respond(['ok' => true, 'service' => 'boats-notify']);
}

if ($method === 'GET' && ($rest === 'discover' || $rest === 'discover/')) {
    boats_require($cfg);
    boats_respond(boats_discover($cfg));
}

if ($method === 'POST' && ($rest === '' || $rest === 'notify' || $rest === 'notify/')) {
    boats_require($cfg);
    $length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length < 1 || $length > 16384) {
        boats_respond(['error' => 'invalid body size'], 413);
    }
    boats_discover($cfg);
    $raw = file_get_contents('php://input');
    $body = json_decode((string)$raw, true);
    if (!is_array($body)) {
        $body = [];
    }
    $text = trim((string)($body['text'] ?? ''));
    if ($text === '') {
        boats_respond(['error' => 'text required'], 400);
    }
    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($text) > 3500) {
            $text = mb_substr($text, 0, 3490) . '...';
        }
    } elseif (strlen($text) > 3500) {
        $text = substr($text, 0, 3400) . '...';
    }
    $out = boats_send($cfg, $text);
    boats_respond($out, !empty($out['ok']) ? 200 : 502);
}

boats_respond(['error' => 'not_found'], 404);
