<?php
/**
 * JSON-прокси клиентов из Works API.
 * Если 1С с хостинга недоступна (firewall) - отдаём DEMO_FALLBACK,
 * чтобы проверить виджет в Б24.
 */
header('Content-Type: application/json; charset=utf-8');
header('Content-Security-Policy: frame-ancestors https://*.bitrix24.ru https://*.bitrix24.com https://*.bitrix24.eu');
header_remove('X-Frame-Options');

$DEMO_FALLBACK = [
    ['name' => 'Malina (demo)', 'ref' => 'demo-malina'],
    ['name' => 'Дельта (demo)', 'ref' => 'demo-delta'],
    ['name' => 'Miss Chic (demo)', 'ref' => 'demo-misschic'],
    ['name' => 'ЦЭМАК (demo)', 'ref' => 'demo-cemak'],
];

$forceDemo = isset($_GET['demo']) && $_GET['demo'] === '1';
if ($forceDemo) {
    echo json_encode([
        'ok' => true,
        'source' => 'demo',
        'count' => count($DEMO_FALLBACK),
        'items' => $DEMO_FALLBACK,
        'note' => 'Принудительный demo (?demo=1)',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$cfgPath = __DIR__ . '/config.php';
if (!is_file($cfgPath)) {
    echo json_encode([
        'ok' => true,
        'source' => 'demo',
        'count' => count($DEMO_FALLBACK),
        'items' => $DEMO_FALLBACK,
        'note' => 'Нет config.php - demo',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$cfg = require $cfgPath;
$base = rtrim((string)($cfg['works_api_base'] ?? ''), '/');
$token = (string)($cfg['works_api_token'] ?? '');
$user = (string)($cfg['works_basic_user'] ?? '');
$pass = (string)($cfg['works_basic_password'] ?? '');

if ($base === '') {
    echo json_encode([
        'ok' => true,
        'source' => 'demo',
        'count' => count($DEMO_FALLBACK),
        'items' => $DEMO_FALLBACK,
        'note' => 'Пустой works_api_base - demo',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$url = $base . '/catalogs/clients';
$ch = curl_init($url);
$headers = [
    'Accept: application/json',
    'X-Works-Token: ' . $token,
];
if ($user !== '') {
    curl_setopt($ch, CURLOPT_USERPWD, $user . ':' . $pass);
}
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 12,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_SSL_VERIFYPEER => true,
]);
$body = curl_exec($ch);
$errno = curl_errno($ch);
$err = curl_error($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($errno || $code >= 400 || $body === false) {
    echo json_encode([
        'ok' => true,
        'source' => 'demo',
        'count' => count($DEMO_FALLBACK),
        'items' => $DEMO_FALLBACK,
        'note' => '1С недоступна с хостинга (' . ($err !== '' ? $err : ('HTTP ' . $code)) . ') - demo',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$decoded = json_decode((string)$body, true);
if (!is_array($decoded) || empty($decoded['ok'])) {
    echo json_encode([
        'ok' => true,
        'source' => 'demo',
        'count' => count($DEMO_FALLBACK),
        'items' => $DEMO_FALLBACK,
        'note' => 'Плохой ответ 1С - demo',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$items = [];
foreach (($decoded['items'] ?? []) as $it) {
    $items[] = [
        'name' => (string)($it['name'] ?? ''),
        'ref' => (string)($it['ref'] ?? ''),
    ];
}

echo json_encode([
    'ok' => true,
    'source' => '1c',
    'count' => count($items),
    'items' => $items,
], JSON_UNESCAPED_UNICODE);
