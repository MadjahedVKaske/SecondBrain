[CmdletBinding()]
param(
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\.local\desk\desk-prod-seed.sql')
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$configPath = Join-Path $projectRoot '.secrets\mysql.local.json'
$mysqlBin = Join-Path $projectRoot '.local\mysql\mysql-8.4.10-winx64\bin'
$dumpExe = Join-Path $mysqlBin 'mysqldump.exe'

if (-not (Test-Path -LiteralPath $configPath)) {
    throw 'Missing .secrets/mysql.local.json.'
}
if (-not (Test-Path -LiteralPath $dumpExe)) {
    throw 'Local mysqldump.exe was not found.'
}

$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
$target = [System.IO.Path]::GetFullPath($OutputPath)
$localRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '.local'))
if (-not $target.StartsWith($localRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Dump target must stay inside .local/.'
}

$targetDir = Split-Path -Parent $target
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
$defaultsPath = Join-Path $targetDir ('.mysql-dump-{0}.cnf' -f [guid]::NewGuid().ToString('N'))
$escapedPassword = ([string]$config.root_password).Replace('\', '\\').Replace('"', '\"')
$defaults = @(
    '[client]'
    ('host={0}' -f $config.host)
    ('port={0}' -f $config.port)
    ('user={0}' -f $config.root_user)
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
