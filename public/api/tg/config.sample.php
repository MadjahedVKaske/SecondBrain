<?php
/**
 * Скопируй в config.php на VPS (/var/www/brain/api/tg/config.php).
 * На REG.RU / buro1.tech бота нет.
 * В git с секретами не коммитить.
 */
return [
    // От BotFather
    'bot_token' => '',

    // Numeric id (не @username). Реальное значение только в ignored config.php.
    'allowed_user_ids' => [],

    // Секрет для заголовка X-Telegram-Bot-Api-Secret-Token при setWebhook
    'webhook_secret' => 'change-me-long-random',

    // Токен для меня (Cursor): GET inbox / item
    'admin_token' => 'change-me-long-random',

    'data_dir' => null, // null = api/tg/_data
];
