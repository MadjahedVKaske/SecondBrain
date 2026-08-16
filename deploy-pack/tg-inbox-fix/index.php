<?php
/**
 * Telegram inbox for Cursor (webhook + getUpdates pull + admin read API).
 * Routes under /api/tg/
 */
header('X-Content-Type-Options: nosniff');

function tg_respond($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function tg_load_config(): array
{
    $path = __DIR__ . '/config.php';
    if (!is_file($path)) {
        $path = __DIR__ . '/config.sample.php';
    }
    $cfg = require $path;
    return is_array($cfg) ? $cfg : [];
}

function tg_data_dir(array $cfg): string
{
    $dir = !empty($cfg['data_dir']) ? (string)$cfg['data_dir'] : (__DIR__ . '/_data');
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $uploads = $dir . '/uploads';
    if (!is_dir($uploads)) {
        @mkdir($uploads, 0775, true);
    }
    return $dir;
}

function tg_store_path(string $dataDir): string
{
    return $dataDir . '/inbox.json';
}

function tg_offset_path(string $dataDir): string
{
    return $dataDir . '/offset.json';
}

function tg_load_inbox(string $storeFile): array
{
    if (!is_file($storeFile)) {
        return ['items' => []];
    }
    $raw = json_decode((string)file_get_contents($storeFile), true);
    if (!is_array($raw) || !isset($raw['items']) || !is_array($raw['items'])) {
        return ['items' => []];
    }
    return $raw;
}

function tg_save_inbox(string $storeFile, array $store): void
{
    $tmp = $storeFile . '.tmp';
    file_put_contents(
        $tmp,
        json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
    rename($tmp, $storeFile);
}

function tg_load_offset(string $offsetFile): int
{
    if (!is_file($offsetFile)) {
        return 0;
    }
    $raw = json_decode((string)file_get_contents($offsetFile), true);
    return (int)($raw['offset'] ?? 0);
}

function tg_save_offset(string $offsetFile, int $offset): void
{
    file_put_contents(
        $offsetFile,
        json_encode(['offset' => $offset], JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );
}

function tg_require_admin(array $cfg): void
{
    $token = (string)($cfg['admin_token'] ?? '');
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $bearer = '';
    if (stripos($header, 'Bearer ') === 0) {
        $bearer = trim(substr($header, 7));
    }
    $alt = (string)($_SERVER['HTTP_X_YAKOR_TOKEN'] ?? ($_GET['token'] ?? ''));
    if ($token !== '' && ($bearer === $token || $alt === $token)) {
        return;
    }
    tg_respond(['error' => 'unauthorized'], 401);
}

function tg_uuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function tg_api(string $botToken, string $method, array $params = [])
{
    $url = 'https://api.telegram.org/bot' . $botToken . '/' . $method;
    $payload = json_encode($params, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $headers = ['Content-Type: application/json'];
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        $raw = (string)curl_exec($ch);
        curl_close($ch);
        return json_decode($raw, true);
    }
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $payload,
            'ignore_errors' => true,
            'timeout' => 60,
        ],
    ]);
    $raw = (string)@file_get_contents($url, false, $ctx);
    return json_decode($raw, true);
}

function tg_download_file(string $botToken, string $fileId, string $destPath): array
{
    $info = tg_api($botToken, 'getFile', ['file_id' => $fileId]);
    if (empty($info['ok']) || empty($info['result']['file_path'])) {
        $desc = $info['description'] ?? '';
        return ['ok' => false, 'error' => 'getFile_failed' . ($desc !== '' ? (': ' . $desc) : '')];
    }
    $filePath = (string)$info['result']['file_path'];
    $url = 'https://api.telegram.org/file/bot' . $botToken . '/' . $filePath;
    $bin = false;
    $curlErr = '';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 180);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        $bin = curl_exec($ch);
        $curlErr = (string)curl_error($ch);
        curl_close($ch);
    } else {
        $bin = @file_get_contents($url);
    }
    if ($bin === false || $bin === '') {
        return ['ok' => false, 'error' => $curlErr !== '' ? ('download: ' . $curlErr) : 'download_empty'];
    }
    if (file_put_contents($destPath, $bin) === false) {
        return ['ok' => false, 'error' => 'write_failed'];
    }
    return ['ok' => true];
}

function tg_media_from_message(array $msg): array
{
    $media = [
        'type' => '',
        'file_id' => '',
        'filename' => '',
        'mime' => '',
        'duration' => 0,
    ];
    if (!empty($msg['photo']) && is_array($msg['photo'])) {
        $best = end($msg['photo']);
        $media['type'] = 'photo';
        $media['file_id'] = (string)($best['file_id'] ?? '');
        $media['filename'] = 'photo.jpg';
        $media['mime'] = 'image/jpeg';
        return $media;
    }
    if (!empty($msg['voice']['file_id'])) {
        $media['type'] = 'voice';
        $media['file_id'] = (string)$msg['voice']['file_id'];
        $media['filename'] = 'voice.ogg';
        $media['mime'] = (string)($msg['voice']['mime_type'] ?? 'audio/ogg');
        $media['duration'] = (int)($msg['voice']['duration'] ?? 0);
        return $media;
    }
    if (!empty($msg['audio']['file_id'])) {
        $media['type'] = 'audio';
        $media['file_id'] = (string)$msg['audio']['file_id'];
        $media['filename'] = (string)($msg['audio']['file_name'] ?? 'audio.bin');
        $media['mime'] = (string)($msg['audio']['mime_type'] ?? '');
        $media['duration'] = (int)($msg['audio']['duration'] ?? 0);
        return $media;
    }
    if (!empty($msg['video_note']['file_id'])) {
        $media['type'] = 'video_note';
        $media['file_id'] = (string)$msg['video_note']['file_id'];
        $media['filename'] = 'video_note.mp4';
        $media['mime'] = 'video/mp4';
        $media['duration'] = (int)($msg['video_note']['duration'] ?? 0);
        return $media;
    }
    if (!empty($msg['document']['file_id'])) {
        $media['type'] = 'document';
        $media['file_id'] = (string)$msg['document']['file_id'];
        $media['filename'] = (string)($msg['document']['file_name'] ?? 'file.bin');
        $media['mime'] = (string)($msg['document']['mime_type'] ?? '');
        return $media;
    }
    if (!empty($msg['video']['file_id'])) {
        $media['type'] = 'video';
        $media['file_id'] = (string)$msg['video']['file_id'];
        $media['filename'] = 'video.mp4';
        $media['mime'] = (string)($msg['video']['mime_type'] ?? 'video/mp4');
        $media['duration'] = (int)($msg['video']['duration'] ?? 0);
        return $media;
    }
    if (!empty($msg['sticker']['file_id'])) {
        $s = $msg['sticker'];
        $ext = !empty($s['is_video']) ? 'webm' : (!empty($s['is_animated']) ? 'tgs' : 'webp');
        $media['type'] = 'sticker';
        $media['file_id'] = (string)$s['file_id'];
        $media['filename'] = 'sticker.' . $ext;
        $media['mime'] = (string)($s['mime_type'] ?? '');
        return $media;
    }
    if (!empty($msg['animation']['file_id'])) {
        $a = $msg['animation'];
        $media['type'] = 'animation';
        $media['file_id'] = (string)$a['file_id'];
        $media['filename'] = (string)($a['file_name'] ?? 'animation.mp4');
        $media['mime'] = (string)($a['mime_type'] ?? 'video/mp4');
        $media['duration'] = (int)($a['duration'] ?? 0);
        return $media;
    }
    return $media;
}

/**
 * @return array{status:string,item?:array,from_id?:int}
 */
function tg_ingest_update(array $update, array $cfg, string $storeFile, string $uploadsDir): array
{
    $msg = $update['message'] ?? $update['edited_message'] ?? null;
    if (!is_array($msg)) {
        return ['status' => 'no_message'];
    }

    $fromId = (int)($msg['from']['id'] ?? 0);
    $allowedInts = [];
    foreach ((array)($cfg['allowed_user_ids'] ?? []) as $a) {
        $allowedInts[] = (int)$a;
    }
    if (!in_array($fromId, $allowedInts, true)) {
        return ['status' => 'user_not_allowed', 'from_id' => $fromId];
    }

    $botToken = (string)($cfg['bot_token'] ?? '');
    $item = [
        'id' => tg_uuid(),
        'update_id' => $update['update_id'] ?? null,
        'chat_id' => $msg['chat']['id'] ?? null,
        'from_id' => $fromId,
        'from_username' => $msg['from']['username'] ?? '',
        'date' => $msg['date'] ?? null,
        'received_at' => gmdate('c'),
        'type' => 'text',
        'text' => '',
        'caption' => '',
        'file_id' => '',
        'mime' => '',
        'filename' => '',
        'local_path' => '',
    ];

    if (!empty($msg['text'])) {
        $item['type'] = 'text';
        $item['text'] = (string)$msg['text'];
    } elseif (!empty($msg['caption'])) {
        $item['caption'] = (string)$msg['caption'];
    }

    $store = tg_load_inbox($storeFile);
    $uid = $update['update_id'] ?? null;
    foreach ($store['items'] as $prev) {
        if ($uid !== null && ($prev['update_id'] ?? null) === $uid) {
            return ['status' => 'duplicate', 'item' => $prev];
        }
    }

    $media = tg_media_from_message($msg);
    $fileId = $media['file_id'];
    if ($fileId !== '') {
        $item['type'] = $media['type'];
        $item['file_id'] = $fileId;
        $item['filename'] = $media['filename'];
        $item['mime'] = $media['mime'];
        if ((int)$media['duration'] > 0) {
            $item['duration'] = (int)$media['duration'];
        }
        if ($botToken === '') {
            return ['status' => 'download_failed', 'error' => 'bot_token_empty', 'update_id' => $uid];
        }
        $ext = pathinfo($media['filename'], PATHINFO_EXTENSION);
        if ($ext === '') {
            $ext = 'bin';
        }
        $safeName = gmdate('YmdHis') . '_' . bin2hex(random_bytes(3)) . '.' . $ext;
        $dest = $uploadsDir . '/' . $safeName;
        $dl = tg_download_file($botToken, $fileId, $dest);
        if (empty($dl['ok']) || !is_file($dest) || filesize($dest) <= 0) {
            return [
                'status' => 'download_failed',
                'error' => (string)($dl['error'] ?? 'download_failed'),
                'update_id' => $uid,
                'type' => $item['type'],
            ];
        }
        $item['local_path'] = $dest;
        $item['stored_as'] = $safeName;
    } elseif ($item['text'] === '' && $item['caption'] === '') {
        $safeName = gmdate('YmdHis') . '_' . bin2hex(random_bytes(3)) . '.json';
        $dest = $uploadsDir . '/' . $safeName;
        if (file_put_contents($dest, json_encode($msg, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) === false) {
            return ['status' => 'download_failed', 'error' => 'raw_write_failed', 'update_id' => $uid];
        }
        $item['type'] = 'raw';
        $item['filename'] = 'message.json';
        $item['mime'] = 'application/json';
        $item['local_path'] = $dest;
        $item['stored_as'] = $safeName;
    }

    $store = tg_load_inbox($storeFile);
    $store['items'][] = $item;
    if (count($store['items']) > 500) {
        $store['items'] = array_slice($store['items'], -500);
    }
    tg_save_inbox($storeFile, $store);

    return ['status' => 'saved', 'item' => $item];
}

$cfg = tg_load_config();
$dataDir = tg_data_dir($cfg);
$storeFile = tg_store_path($dataDir);
$offsetFile = tg_offset_path($dataDir);
$uploadsDir = $dataDir . '/uploads';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '';
$rest = '';
if (preg_match('#/api/tg(?:/(.*))?$#', $path, $m) || preg_match('#/tg(?:/(.*))?$#', $path, $m)) {
    $rest = isset($m[1]) ? trim($m[1], '/') : '';
}

// Health / root
if ($method === 'GET' && ($rest === '' || $rest === 'health')) {
    $store = tg_load_inbox($storeFile);
    tg_respond([
        'ok' => true,
        'service' => 'tg-inbox',
        'mode' => 'pull+webhook',
        'items' => count($store['items']),
    ]);
}

// Admin: set webhook (на shared часто таймаутит - лучше pull)
if ($method === 'GET' && ($rest === 'admin/setwebhook' || $rest === 'admin/setwebhook/')) {
    tg_require_admin($cfg);
    $botToken = (string)($cfg['bot_token'] ?? '');
    $secret = (string)($cfg['webhook_secret'] ?? '');
    if ($botToken === '') {
        tg_respond(['error' => 'bot_token empty in config.php'], 500);
    }
    $webhookUrl = 'https://buro1.tech/api/tg/webhook';
    $params = [
        'url' => $webhookUrl,
        'allowed_updates' => ['message'],
        'drop_pending_updates' => true,
    ];
    if ($secret !== '') {
        $params['secret_token'] = $secret;
    }
    $res = tg_api($botToken, 'setWebhook', $params);
    tg_respond([
        'ok' => !empty($res['ok']),
        'webhook_url' => $webhookUrl,
        'telegram' => $res,
        'hint' => 'Если Connection timed out - используй admin/pull',
    ], !empty($res['ok']) ? 200 : 500);
}

// Admin: delete webhook (нужно для getUpdates)
if ($method === 'GET' && ($rest === 'admin/deletewebhook' || $rest === 'admin/deletewebhook/')) {
    tg_require_admin($cfg);
    $botToken = (string)($cfg['bot_token'] ?? '');
    $res = tg_api($botToken, 'deleteWebhook', ['drop_pending_updates' => false]);
    tg_respond(['ok' => !empty($res['ok']), 'telegram' => $res], !empty($res['ok']) ? 200 : 500);
}

// Admin: webhook info
if ($method === 'GET' && ($rest === 'admin/webhookinfo' || $rest === 'admin/webhookinfo/')) {
    tg_require_admin($cfg);
    $botToken = (string)($cfg['bot_token'] ?? '');
    $res = tg_api($botToken, 'getWebhookInfo', []);
    tg_respond(['ok' => true, 'telegram' => $res]);
}

// Admin: send message to allowed user (уведомления из Cursor)
if (($method === 'POST' || $method === 'GET') && ($rest === 'admin/send' || $rest === 'admin/send/')) {
    tg_require_admin($cfg);
    $botToken = (string)($cfg['bot_token'] ?? '');
    if ($botToken === '') {
        tg_respond(['error' => 'bot_token empty'], 500);
    }

    $text = '';
    $chatId = 0;
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $body = json_decode((string)$raw, true);
        if (!is_array($body)) {
            $body = [];
        }
        $text = (string)($body['text'] ?? '');
        $chatId = (int)($body['chat_id'] ?? 0);
    }
    if ($text === '' && isset($_GET['text'])) {
        $text = (string)$_GET['text'];
    }
    if ($chatId === 0 && isset($_GET['chat_id'])) {
        $chatId = (int)$_GET['chat_id'];
    }
    if ($chatId === 0) {
        $allowed = (array)($cfg['allowed_user_ids'] ?? []);
        if (count($allowed) > 0) {
            $chatId = (int)$allowed[0];
        }
    }
    $text = trim($text);
    if ($text === '') {
        tg_respond(['error' => 'text required'], 400);
    }
    if ($chatId === 0) {
        tg_respond(['error' => 'chat_id empty and allowed_user_ids empty'], 400);
    }
    // Только в whitelist
    $allowedInts = [];
    foreach ((array)($cfg['allowed_user_ids'] ?? []) as $a) {
        $allowedInts[] = (int)$a;
    }
    if (count($allowedInts) > 0 && !in_array($chatId, $allowedInts, true)) {
        tg_respond(['error' => 'chat_id not allowed'], 403);
    }
    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($text) > 4000) {
            $text = mb_substr($text, 0, 3990) . '…';
        }
    } elseif (strlen($text) > 4000) {
        $text = substr($text, 0, 3900) . '...';
    }

    $res = tg_api($botToken, 'sendMessage', [
        'chat_id' => $chatId,
        'text' => $text,
        'disable_web_page_preview' => true,
    ]);
    tg_respond([
        'ok' => !empty($res['ok']),
        'chat_id' => $chatId,
        'telegram' => $res,
    ], !empty($res['ok']) ? 200 : 500);
}

// Admin: убрать старое меню/кнопки (BotFather часто не снимает reply keyboard)
if ($method === 'GET' && ($rest === 'admin/clearmenu' || $rest === 'admin/clearmenu/')) {
    tg_require_admin($cfg);
    $botToken = (string)($cfg['bot_token'] ?? '');
    if ($botToken === '') {
        tg_respond(['error' => 'bot_token empty'], 500);
    }
    $chatId = isset($_GET['chat_id']) ? (int)$_GET['chat_id'] : 0;
    if ($chatId === 0) {
        $allowed = (array)($cfg['allowed_user_ids'] ?? []);
        if (count($allowed) > 0) {
            $chatId = (int)$allowed[0];
        }
    }
    if ($chatId === 0) {
        tg_respond(['error' => 'chat_id empty'], 400);
    }

    $steps = [];
    $steps['deleteMyCommands'] = tg_api($botToken, 'deleteMyCommands', []);
    $steps['setChatMenuButton'] = tg_api($botToken, 'setChatMenuButton', [
        'chat_id' => $chatId,
        'menu_button' => ['type' => 'default'],
    ]);
    $steps['removeKeyboard'] = tg_api($botToken, 'sendMessage', [
        'chat_id' => $chatId,
        'text' => 'Меню сброшено. Если кнопки остались - закрой чат и открой снова.',
        'reply_markup' => [
            'remove_keyboard' => true,
            'selective' => false,
        ],
    ]);

    $ok = !empty($steps['removeKeyboard']['ok']);
    tg_respond(['ok' => $ok, 'chat_id' => $chatId, 'steps' => $steps], $ok ? 200 : 500);
}

// Admin: pull via getUpdates (надёжно на shared hosting)
if ($method === 'GET' && ($rest === 'admin/pull' || $rest === 'admin/pull/')) {
    tg_require_admin($cfg);
    $botToken = (string)($cfg['bot_token'] ?? '');
    if ($botToken === '') {
        tg_respond(['error' => 'bot_token empty'], 500);
    }

    // Webhook и getUpdates взаимоисключающие
    $info = tg_api($botToken, 'getWebhookInfo', []);
    $whUrl = (string)($info['result']['url'] ?? '');
    if ($whUrl !== '') {
        tg_api($botToken, 'deleteWebhook', ['drop_pending_updates' => false]);
    }

    $offset = tg_load_offset($offsetFile);
    $res = tg_api($botToken, 'getUpdates', [
        'offset' => $offset,
        'limit' => 50,
        'timeout' => 0,
        'allowed_updates' => ['message'],
    ]);
    if (empty($res['ok']) || !is_array($res['result'] ?? null)) {
        tg_respond(['ok' => false, 'telegram' => $res], 500);
    }

    $saved = [];
    $skipped = [];
    $maxId = $offset;
    $confirmable = ['saved', 'duplicate', 'no_message', 'user_not_allowed', 'ignored'];
    foreach ($res['result'] as $update) {
        if (!is_array($update)) {
            continue;
        }
        $uid = (int)($update['update_id'] ?? 0);
        $ing = tg_ingest_update($update, $cfg, $storeFile, $uploadsDir);
        $status = (string)($ing['status'] ?? '');
        if (!in_array($status, $confirmable, true)) {
            $ing['update_id'] = $uid;
            $skipped[] = $ing;
            break;
        }
        if ($uid >= $maxId) {
            $maxId = $uid + 1;
        }
        if ($status === 'saved' || $status === 'duplicate') {
            $saved[] = [
                'id' => $ing['item']['id'],
                'type' => $ing['item']['type'],
                'text' => $ing['item']['text'] ?? '',
                'file_id' => $ing['item']['file_id'] ?? '',
                'has_file' => !empty($ing['item']['local_path']),
                'download_error' => $ing['item']['download_error'] ?? '',
                'status' => $status,
            ];
        } else {
            $skipped[] = $ing;
        }
    }
    if ($maxId > $offset) {
        tg_save_offset($offsetFile, $maxId);
    }

    tg_respond([
        'ok' => true,
        'pulled' => count($res['result']),
        'saved' => count($saved),
        'items' => $saved,
        'skipped' => $skipped,
        'offset' => $maxId,
        'webhook_was' => $whUrl,
    ]);
}

// Admin: inbox list
if ($method === 'GET' && ($rest === 'admin/inbox' || $rest === 'admin/inbox/')) {
    tg_require_admin($cfg);
    $store = tg_load_inbox($storeFile);
    $since = isset($_GET['since']) ? (string)$_GET['since'] : '';
    $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 30;
    $items = $store['items'];
    if ($since !== '') {
        $items = array_values(array_filter($items, function ($it) use ($since) {
            return ($it['received_at'] ?? '') >= $since;
        }));
    }
    $items = array_reverse($items);
    $items = array_slice($items, 0, $limit);
    foreach ($items as &$it) {
        $local = (string)($it['local_path'] ?? '');
        $it['has_file'] = ($local !== '' && is_file($local));
        $it['has_file_id'] = !empty($it['file_id']);
        $it['needs_download'] = !$it['has_file'] && $it['has_file_id'];
        unset($it['local_path']);
    }
    unset($it);
    tg_respond(['ok' => true, 'count' => count($items), 'payload' => $items]);
}

// Admin: one item (+ optional file base64)
if ($method === 'GET' && preg_match('#^admin/item/([^/]+)/?$#', $rest, $mm)) {
    tg_require_admin($cfg);
    $id = $mm[1];
    $store = tg_load_inbox($storeFile);
    $found = null;
    foreach ($store['items'] as $it) {
        if (($it['id'] ?? '') === $id) {
            $found = $it;
            break;
        }
    }
    if ($found === null) {
        tg_respond(['error' => 'not_found'], 404);
    }
    $includeFile = isset($_GET['file']) && (string)$_GET['file'] === '1';
    $botToken = (string)($cfg['bot_token'] ?? '');
    if ($includeFile && (empty($found['local_path']) || !is_file($found['local_path'])) && !empty($found['file_id']) && $botToken !== '') {
        $filename = (string)($found['filename'] ?? 'file.bin');
        $ext = pathinfo($filename, PATHINFO_EXTENSION);
        if ($ext === '') {
            $ext = 'bin';
        }
        $safeName = gmdate('YmdHis') . '_' . bin2hex(random_bytes(3)) . '.' . $ext;
        $dest = $uploadsDir . '/' . $safeName;
        $dl = tg_download_file($botToken, (string)$found['file_id'], $dest);
        if (!empty($dl['ok'])) {
            foreach ($store['items'] as $idx => $it) {
                if (($it['id'] ?? '') === $id) {
                    $store['items'][$idx]['local_path'] = $dest;
                    $store['items'][$idx]['stored_as'] = $safeName;
                    unset($store['items'][$idx]['download_error']);
                    $found = $store['items'][$idx];
                    break;
                }
            }
            tg_save_inbox($storeFile, $store);
        } else {
            $found['download_error'] = (string)($dl['error'] ?? 'download_failed');
        }
    }
    if ($includeFile && !empty($found['local_path']) && is_file($found['local_path'])) {
        $bin = file_get_contents($found['local_path']);
        $found['file_base64'] = base64_encode($bin);
        $found['file_size'] = strlen($bin);
    }
    if (isset($found['local_path'])) {
        $found['has_file'] = is_file($found['local_path']);
        unset($found['local_path']);
    }
    $found['has_file_id'] = !empty($found['file_id']);
    $found['needs_download'] = empty($found['has_file']) && $found['has_file_id'];
    tg_respond(['ok' => true, 'item' => $found]);
}

// Telegram webhook (если хостинг пускает входящие от Telegram)
if ($method === 'POST' && ($rest === 'webhook' || $rest === 'webhook/')) {
    $secret = (string)($cfg['webhook_secret'] ?? '');
    $hdr = (string)($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '');
    if ($secret !== '' && !hash_equals($secret, $hdr)) {
        tg_respond(['error' => 'forbidden'], 403);
    }

    $raw = file_get_contents('php://input');
    $update = json_decode((string)$raw, true);
    if (!is_array($update)) {
        tg_respond(['ok' => true, 'skipped' => 'bad_json']);
    }

    $ing = tg_ingest_update($update, $cfg, $storeFile, $uploadsDir);
    $status = (string)($ing['status'] ?? '');
    if ($status === 'saved' || $status === 'duplicate') {
        tg_respond(['ok' => true, 'saved' => $ing['item']['id'] ?? '', 'type' => $ing['item']['type'] ?? '', 'status' => $status]);
    }
    if ($status === 'download_failed') {
        tg_respond(['ok' => false, 'skipped' => $status] + $ing, 500);
    }
    tg_respond(['ok' => true, 'skipped' => $status !== '' ? $status : 'unknown'] + $ing);
}

tg_respond(['error' => 'not_found', 'rest' => $rest], 404);

