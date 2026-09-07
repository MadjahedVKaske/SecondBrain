[CmdletBinding()]
param(
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backupRoot = Join-Path $projectRoot '.local\desk-backups'
if (-not $OutputPath) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $OutputPath = Join-Path $backupRoot "desk-$stamp.sql"
}

& (Join-Path $PSScriptRoot 'mysql_local_dump.ps1') -OutputPath $OutputPath
if ($LASTEXITCODE -ne 0) { throw "Local Desk backup failed with exit code $LASTEXITCODE." }

$dump = Get-Item -LiteralPath $OutputPath
if ($dump.Length -lt 1kb) { throw 'Local Desk backup is unexpectedly small.' }
Write-Output "Recovery backup created: $($dump.FullName)"
