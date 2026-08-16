<?php
/**
 * Точка входа локального приложения Битрикс24.
 * URL: https://buro1.tech/b24-widget/index.php
 */
header('Content-Type: text/html; charset=utf-8');
header('Content-Security-Policy: frame-ancestors https://*.bitrix24.ru https://*.bitrix24.com https://*.bitrix24.eu');
header_remove('X-Frame-Options');

$placement = (string)($_REQUEST['PLACEMENT'] ?? 'DEFAULT');

if ($placement === 'CRM_DEAL_DETAIL_TAB') {
    require __DIR__ . '/tab.php';
    exit;
}

$cfg = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
$tabTitle = (string)($cfg['tab_title'] ?? 'Клиенты 1С');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title><?= htmlspecialchars($tabTitle) ?> - установка</title>
  <script src="//api.bitrix24.com/api/v1/"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px; }
    code { background: #f3f3f3; padding: 2px 6px; border-radius: 4px; word-break: break-all; }
    .ok { color: #0a0; }
    .err { color: #c00; white-space: pre-wrap; }
    pre { background: #f6f6f6; padding: 12px; overflow: auto; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Виджет «<?= htmlspecialchars($tabTitle) ?>»</h1>
  <p id="status">Инициализация…</p>
  <pre id="log"></pre>
  <p class="muted">Если bind завис: Разработчикам → «Вывести свои данные в карточку CRM» → URL
    <code>https://buro1.tech/b24-widget/index.php</code> → вкладка сделки.</p>
  <script>
    const logEl = document.getElementById('log');
    const statusEl = document.getElementById('status');
    const TAB_TITLE = <?= json_encode($tabTitle, JSON_UNESCAPED_UNICODE) ?>;
    const TAB_HANDLER = 'https://buro1.tech/b24-widget/index.php';

    function log(x) {
      logEl.textContent += (typeof x === 'string' ? x : JSON.stringify(x, null, 2)) + '\n';
    }

    function dumpResult(result) {
      const pack = { status: result.status };
      try { pack.error = result.error(); } catch (e) {}
      try {
        if (result.answer) {
          pack.answer_error = result.answer.error;
          pack.answer_error_description = result.answer.error_description;
          pack.answer_result = result.answer.result;
        }
      } catch (e) {}
      try { pack.data = result.data(); } catch (e) {}
      return pack;
    }

    BX24.init(function () {
      statusEl.textContent = 'BX24 ok. Минимальный placement.bind…';
      log({ domain: (BX24.getAuth() || {}).domain, handler: TAB_HANDLER });

      const timer = setTimeout(function () {
        statusEl.innerHTML = '<span class="err">bind не ответил за 20с</span> - вешай вкладку вручную (см. ниже) или кинь лог.';
        try { BX24.installFinish(); } catch (e) {}
      }, 20000);

      // Только обязательные поля - без LANG_ALL/DESCRIPTION
      BX24.callMethod('placement.bind', {
        PLACEMENT: 'CRM_DEAL_DETAIL_TAB',
        HANDLER: TAB_HANDLER,
        TITLE: TAB_TITLE
      }, function (result) {
        clearTimeout(timer);
        const dump = dumpResult(result);
        log({ step: 'placement.bind', dump: dump });

        if (result.error()) {
          statusEl.innerHTML = '<span class="err">Ошибка placement.bind</span>';
          try { BX24.installFinish(); } catch (e) {}
          return;
        }
        statusEl.innerHTML = '<span class="ok">Готово.</span> Открой сделку → вкладка «' + TAB_TITLE + '».';
        try { BX24.installFinish(); } catch (e) { log('installFinish: ' + e); }
      });
    });
  </script>
</body>
</html>
