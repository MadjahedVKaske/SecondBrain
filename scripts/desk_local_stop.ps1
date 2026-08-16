$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot '.local\php\desk-server.pid'
if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Output 'Second Brain is not running.'
    exit 0
}

$serverPid = [int](Get-Content -LiteralPath $pidFile -Raw)
$process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Id $serverPid
}
Remove-Item -LiteralPath $pidFile
Write-Output 'Second Brain stopped.'
