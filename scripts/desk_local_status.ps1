$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$secretFile = Join-Path $projectRoot '.secrets\desk.local.json'
if (-not (Test-Path -LiteralPath $secretFile)) {
    throw 'Missing .secrets/desk.local.json.'
}
$credentials = Get-Content -LiteralPath $secretFile -Raw | ConvertFrom-Json
$key = [uri]::EscapeDataString($credentials.view_token)
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/desk/state?k=$key" -UseBasicParsing -TimeoutSec 5
$body = $response.Content | ConvertFrom-Json
if ($response.StatusCode -ne 200 -or -not $body.ok) {
    throw 'Desk API health check failed.'
}

Write-Output "Second Brain OK; HTTP $($response.StatusCode); tasks=$($body.tasks.Count); clients=$($body.clients.Count)"
