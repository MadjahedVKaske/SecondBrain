$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$secretFile = Join-Path $projectRoot '.secrets\desk.local.json'
if (-not (Test-Path -LiteralPath $secretFile)) {
    throw 'Missing .secrets/desk.local.json.'
}

$credentials = Get-Content -LiteralPath $secretFile -Raw | ConvertFrom-Json
$key = [uri]::EscapeDataString($credentials.view_token)
Start-Process "http://127.0.0.1:8080/desk/?k=$key"
