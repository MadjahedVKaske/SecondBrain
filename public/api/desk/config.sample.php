<?php
/**
 * Скопируй в config.php на хостинге (www/buro1.tech/api/desk/config.php).
 * В git с секретами не коммитить.
 */
return [
    // Ссылка на доску: http://45.10.42.191/desk/?k=ВОТ_ЭТО
    'view_token' => 'change-me-view-token',

    // Синк с тачки / wake poller
    'admin_token' => 'change-me-long-random',

    // Пустой db_name = JSON-файл на VPS. MySQL не обязателен.
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => '',
    'db_user' => '',
    'db_pass' => '',

    // Куда VPS пушит при новом сообщении в бота (домашний HTTP desk_watch).
    // Пусто = только очередь. Пример: http://x.x.x.x:17890/wake
    'wake_url' => '',
];
