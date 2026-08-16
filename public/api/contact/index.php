<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function contact_reply(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    contact_reply(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    contact_reply(503, ['ok' => false, 'error' => 'contact_not_configured']);
}

$config = require $configFile;
$botToken = trim((string)($config['bot_token'] ?? ''));
$chatId = trim((string)($config['chat_id'] ?? ''));
if ($botToken === '' || $chatId === '') {
    contact_reply(503, ['ok' => false, 'error' => 'contact_not_configured']);
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw === false ? '' : $raw, true);
if (!is_array($payload)) {
    contact_reply(400, ['ok' => false, 'error' => 'invalid_json']);
}

$field = static function (string $name, int $max) use ($payload): string {
    $value = trim((string)($payload[$name] ?? ''));
    return mb_substr($value, 0, $max);
};

$name = $field('name', 120);
$company = $field('company', 160);
$phone = $field('phone', 80);
$email = $field('email', 160);
$message = $field('message', 3000);
if ($name === '' || $phone === '' || $message === '') {
    contact_reply(422, ['ok' => false, 'error' => 'required_fields']);
}

$escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$text = "🔔 <b>Новая заявка с сайта BURO1</b>\n\n"
    . "👤 <b>Имя:</b> " . $escape($name) . "\n"
    . "🏢 <b>Компания:</b> " . $escape($company !== '' ? $company : 'Не указана') . "\n"
    . "📞 <b>Телефон:</b> " . $escape($phone) . "\n"
    . "📧 <b>Email:</b> " . $escape($email !== '' ? $email : 'Не указан') . "\n\n"
    . "💬 <b>Сообщение:</b>\n" . $escape($message) . "\n\n"
    . "⏰ <b>Время:</b> " . date('d.m.Y H:i:s');

$ch = curl_init('https://api.telegram.org/bot' . rawurlencode($botToken) . '/sendMessage');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode([
        'chat_id' => $chatId,
        'text' => $text,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
]);
$response = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$error = curl_error($ch);
curl_close($ch);

$telegram = is_string($response) ? json_decode($response, true) : null;
if ($error !== '' || $status < 200 || $status >= 300 || !is_array($telegram) || !($telegram['ok'] ?? false)) {
    contact_reply(502, ['ok' => false, 'error' => 'telegram_failed']);
}

contact_reply(200, ['ok' => true]);
