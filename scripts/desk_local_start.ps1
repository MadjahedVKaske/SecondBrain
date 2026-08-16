$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$phpRoot = Join-Path $projectRoot '.local\php\php-8.5.9'
$php = Join-Path $phpRoot 'php.exe'
$phpIni = Join-Path $phpRoot 'php.ini'
$publicRoot = Join-Path $projectRoot 'public'
$localConfig = Join-Path $projectRoot 'docker\desk-config.local.php'
$apiConfig = Join-Path $publicRoot 'api\desk\config.php'
$pidFile = Join-Path $projectRoot '.local\php\desk-server.pid'
$logFile = Join-Path $projectRoot '.local\php\desk-server.log'
$errorLogFile = Join-Path $projectRoot '.local\php\desk-server-error.log'

if (-not (Test-Path -LiteralPath $php)) {
    throw 'Local PHP runtime is missing under .local/php/php-8.5.9.'
}
if (-not (Test-Path -LiteralPath $localConfig)) {
    throw 'Missing docker/desk-config.local.php.'
}

Copy-Item -LiteralPath $localConfig -Destination $apiConfig -Force

if (Test-Path -LiteralPath $pidFile) {
    $existingPid = [int](Get-Content -LiteralPath $pidFile -Raw)
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
        Write-Output 'Second Brain is already running at http://localhost:8080/desk/.'
        exit 0
    }
}

$arguments = "-c `"$phpIni`" -S 127.0.0.1:8080 -t `"$publicRoot`""
$process = Start-Process -FilePath $php -ArgumentList $arguments -RedirectStandardOutput $logFile -RedirectStandardError $errorLogFile -WindowStyle Hidden -PassThru
Set-Content -LiteralPath $pidFile -Value $process.Id
Start-Sleep -Seconds 2

if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
    throw "PHP server failed to start. See $logFile"
}

Write-Output 'Second Brain: http://localhost:8080/desk/'
