[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$InputPath,
    [Parameter(Mandatory)]
    [switch]$ConfirmRestore
)

$ErrorActionPreference = 'Stop'
if (-not $ConfirmRestore) { throw 'Restore is destructive. Re-run with -ConfirmRestore after choosing the exact backup.' }
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backupRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '.local\desk-backups'))
$dumpPath = [System.IO.Path]::GetFullPath($InputPath)
if (-not $dumpPath.StartsWith($backupRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Restore input must be a backup inside .local/desk-backups/.' }
if (-not (Test-Path -LiteralPath $dumpPath)) { throw 'Restore input was not found.' }

& (Join-Path $PSScriptRoot 'desk_local_backup.ps1') | Write-Output
$configPath = Join-Path $projectRoot '.secrets\mysql.local.json'
$runtimeConfigPath = Join-Path $projectRoot 'public\api\desk\config.php'
$php = @(
    (Join-Path $projectRoot '.local\php\php-8.5.9\php.exe'),
    'C:\Codex\Projects\Second brain\.local\php\php-8.5.9\php.exe'
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
$mysqlExe = @(
    (Join-Path $projectRoot '.local\mysql\mysql-8.4.10-winx64\bin\mysql.exe'),
    'C:\Codex\Projects\Second brain\.local\mysql\mysql-8.4.10-winx64\bin\mysql.exe'
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not (Test-Path -LiteralPath $mysqlExe)) { throw 'Local MySQL runtime is missing.' }
if (Test-Path -LiteralPath $configPath) {
    $secret = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
    $config = [pscustomobject]@{ host = $secret.host; port = $secret.port; user = $secret.root_user; password = $secret.root_password; database = $secret.database }
} elseif ((Test-Path -LiteralPath $runtimeConfigPath) -and (Test-Path -LiteralPath $php)) {
    $phpCode = '$c = require $argv[1]; echo json_encode(["host" => $c["db_host"] ?? "", "port" => $c["db_port"] ?? 0, "user" => $c["db_user"] ?? "", "password" => $c["db_pass"] ?? "", "database" => $c["db_name"] ?? ""]);'
    $runtimeJson = & $php -r $phpCode $runtimeConfigPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not read local Desk database configuration.' }
    $config = $runtimeJson | ConvertFrom-Json
} else { throw 'Local MySQL configuration is missing.' }
if (-not $config.host -or -not $config.port -or -not $config.user -or -not $config.database) { throw 'Local Desk database configuration is incomplete.' }
$env:MYSQL_PWD = [string]$config.password
try {
    Get-Content -Raw -LiteralPath $dumpPath | & $mysqlExe --protocol=tcp --host=$config.host --port=$config.port --user=$config.user $config.database
    if ($LASTEXITCODE -ne 0) { throw "MySQL restore failed with exit code $LASTEXITCODE." }
} finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}
Write-Output "Restored local Desk from: $dumpPath"
