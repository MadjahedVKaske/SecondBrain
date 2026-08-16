$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$secretFile = Join-Path $projectRoot '.secrets\mysql.local.json'
$admin = Join-Path $projectRoot '.local\mysql\mysql-8.4.10-winx64\bin\mysqladmin.exe'

if (-not (Test-Path -LiteralPath $secretFile)) {
    throw 'Missing .secrets/mysql.local.json.'
}

$credentials = Get-Content -LiteralPath $secretFile -Raw | ConvertFrom-Json
$env:MYSQL_PWD = $credentials.root_password
try {
    & $admin --protocol=tcp --host=$($credentials.host) --port=$($credentials.port) --user=$($credentials.root_user) shutdown
} finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}
