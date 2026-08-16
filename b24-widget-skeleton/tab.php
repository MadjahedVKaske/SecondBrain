<?php
/**
 * UI вкладки в карточке сделки: список клиентов из своей 1С.
 */
header('Content-Type: text/html; charset=utf-8');
header('Content-Security-Policy: frame-ancestors https://*.bitrix24.ru https://*.bitrix24.com https://*.bitrix24.eu');
header_remove('X-Frame-Options');

$placementOptions = [];
if (!empty($_REQUEST['PLACEMENT_OPTIONS'])) {
    $placementOptions = json_decode((string)$_REQUEST['PLACEMENT_OPTIONS'], true) ?: [];
}
$dealId = (int)($placementOptions['ID'] ?? 0);
$domain = (string)($_REQUEST['DOMAIN'] ?? '');
$cfg = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
$tabTitle = (string)($cfg['tab_title'] ?? 'Клиенты 1С');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title><?= htmlspecialchars($tabTitle) ?></title>
  <script src="//api.bitrix24.com/api/v1/"></script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 12px; font-size: 14px; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f5f5f5; }
    button { margin-top: 8px; padding: 8px 14px; cursor: pointer; }
    .muted { color: #666; }
    .err { color: #c00; }
    .ok { color: #0a0; }
  </style>
</head>
<body>
  <p class="muted">
    Демо: клиенты из своей базы 1С · сделка #<strong><?= $dealId ?></strong>
    <?php if ($domain) { ?> · <?= htmlspecialchars($domain) ?><?php } ?>
  </p>
  <button type="button" id="btnLoad">Загрузить клиентов из 1С</button>
  <div id="msg" class="muted">Нажми кнопку.</div>
  <table>
    <thead><tr><th>#</th><th>Клиент</th></tr></thead>
    <tbody id="rows"><tr><td colspan="2" class="muted">Пока пусто</td></tr></tbody>
  </table>

  <script>
    const msg = document.getElementById('msg');
    const rows = document.getElementById('rows');
    const CLIENTS_URL = <?= json_encode(
        (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
        . '://' . ($_SERVER['HTTP_HOST'] ?? 'buro1.tech')
        . rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/b24-widget')), '/')
        . '/clients.php',
        JSON_UNESCAPED_UNICODE
    ) ?>;

    function setMsg(t, isErr) {
      msg.className = isErr ? 'err' : 'muted';
      msg.textContent = t;
    }

    document.getElementById('btnLoad').onclick = async () => {
      setMsg('Запрос в 1С через buro1…');
      try {
        const res = await fetch(CLIENTS_URL, { credentials: 'same-origin' });
        const data = await res.json();
        if (!data.ok) {
          setMsg('Ошибка: ' + (data.error || res.status), true);
          rows.innerHTML = '<tr><td colspan="2" class="err">' +
            JSON.stringify(data).slice(0, 300) + '</td></tr>';
          return;
        }
        const items = data.items || [];
        if (!items.length) {
          rows.innerHTML = '<tr><td colspan="2">Клиентов нет</td></tr>';
          setMsg('Пусто', true);
          return;
        }
        rows.innerHTML = items.map((it, i) =>
          '<tr><td>' + (i + 1) + '</td><td>' + (it.name || '') + '</td></tr>'
        ).join('');
        const src = data.source === '1c' ? 'из 1С' : 'DEMO (1С с хостинга недоступна)';
        setMsg('Ок, клиентов: ' + items.length + ' · ' + src +
          (data.note ? ' · ' + data.note : ''));
        msg.className = data.source === '1c' ? 'ok' : 'muted';
      } catch (e) {
        setMsg(String(e), true);
      }
    };

    BX24.init(function () {
      setMsg('Вкладка готова. Deal=<?= (int)$dealId ?>. Жми «Загрузить».');
    });
  </script>
</body>
</html>
