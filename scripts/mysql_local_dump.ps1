[CmdletBinding()]
param(
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\.local\desk\desk-prod-seed.sql')
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$configPath = Join-Path $projectRoot '.secrets\mysql.local.json'
$runtimeConfigPath = Join-Path $projectRoot 'public\api\desk\config.php'
$php = @(
    (Join-Path $projectRoot '.local\php\php-8.5.9\php.exe'),
    'C:\Codex\Projects\Second brain\.local\php\php-8.5.9\php.exe'
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
$mysqlBin = @(
    (Join-Path $projectRoot '.local\mysql\mysql-8.4.10-winx64\bin'),
    'C:\Codex\Projects\Second brain\.local\mysql\mysql-8.4.10-winx64\bin'
) | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'mysqldump.exe') } | Select-Object -First 1
$dumpExe = Join-Path $mysqlBin 'mysqldump.exe'

if (-not (Test-Path -LiteralPath $dumpExe)) {
    throw 'Local mysqldump.exe was not found.'
}

if (Test-Path -LiteralPath $configPath) {
    $secret = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
    $config = [pscustomobject]@{ host = $secret.host; port = $secret.port; user = $secret.root_user; password = $secret.root_password; database = $secret.database }
} elseif ((Test-Path -LiteralPath $runtimeConfigPath) -and (Test-Path -LiteralPath $php)) {
    $phpCode = '$c = require $argv[1]; echo json_encode(["host" => $c["db_host"] ?? "", "port" => $c["db_port"] ?? 0, "user" => $c["db_user"] ?? "", "password" => $c["db_pass"] ?? "", "database" => $c["db_name"] ?? ""]);'
    $runtimeJson = & $php -r $phpCode $runtimeConfigPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not read local Desk database configuration.' }
    $config = $runtimeJson | ConvertFrom-Json
} else {
    throw 'Missing local MySQL credentials. Start Desk once or restore .secrets/mysql.local.json.'
}
if (-not $config.host -or -not $config.port -or -not $config.user -or -not $config.database) { throw 'Local Desk database configuration is incomplete.' }
$target = [System.IO.Path]::GetFullPath($OutputPath)
$localRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '.local'))
if (-not $target.StartsWith($localRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Dump target must stay inside .local/.'
}

$targetDir = Split-Path -Parent $target
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
$defaultsPath = Join-Path $targetDir ('.mysql-dump-{0}.cnf' -f [guid]::NewGuid().ToString('N'))
$escapedPassword = ([string]$config.password).Replace('\', '\\').Replace('"', '\"')
$defaults = @(
    '[client]'
    ('host={0}' -f $config.host)
    ('port={0}' -f $config.port)
    ('user={0}' -f $config.user)
    ('password="{0}"' -f $escapedPassword)
)

try {
    [System.IO.File]::WriteAllLines($defaultsPath, $defaults, [System.Text.UTF8Encoding]::new($false))
    $acl = Get-Acl -LiteralPath $defaultsPath
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($rule) }
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    [void]$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($currentUser, 'FullControl', 'Allow'))
    Set-Acl -LiteralPath $defaultsPath -AclObject $acl

    & $dumpExe `
        "--defaults-extra-file=$defaultsPath" `
        '--single-transaction' `
        '--routines' `
        '--events' `
        '--triggers' `
        '--hex-blob' `
        '--set-gtid-purged=OFF' `
        '--no-tablespaces' `
        "--result-file=$target" `
        ([string]$config.database)
    if ($LASTEXITCODE -ne 0) {
        throw "mysqldump failed with exit code $LASTEXITCODE."
    }
} finally {
    Remove-Item -LiteralPath $defaultsPath -Force -ErrorAction SilentlyContinue
}

$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $target
[pscustomobject]@{
    Path = $target
    Bytes = (Get-Item -LiteralPath $target).Length
    SHA256 = $hash.Hash.ToLowerInvariant()
}
