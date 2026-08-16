$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$secretFile = Join-Path $projectRoot '.secrets\mysql.local.json'
$client = Join-Path $projectRoot '.local\mysql\mysql-8.4.10-winx64\bin\mysql.exe'

if (-not (Test-Path -LiteralPath $secretFile)) {
    throw 'Missing .secrets/mysql.local.json.'
}

$credentials = Get-Content -LiteralPath $secretFile -Raw | ConvertFrom-Json
$env:MYSQL_PWD = $credentials.app_password
try {
    & $client --protocol=tcp --host=$($credentials.host) --port=$($credentials.port) --user=$($credentials.app_user) --database=$($credentials.database) --batch --skip-column-names --execute="SELECT CONCAT('MySQL ', VERSION(), '; tables=', COUNT(*)) FROM information_schema.tables WHERE table_schema=DATABASE();"
} finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}
