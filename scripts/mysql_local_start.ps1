$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$mysqlRoot = Join-Path $projectRoot '.local\mysql\mysql-8.4.10-winx64'
$server = Join-Path $mysqlRoot 'bin\mysqld.exe'
$config = Join-Path $projectRoot '.local\mysql\my.ini'

if (-not (Test-Path -LiteralPath $server) -or -not (Test-Path -LiteralPath $config)) {
    throw 'Local MySQL runtime is not installed. See COPY-MANIFEST.md.'
}

$running = Get-CimInstance Win32_Process -Filter "Name = 'mysqld.exe'" |
    Where-Object { $_.CommandLine -like "*$config*" }
if ($running) {
    Write-Output 'Local MySQL is already running on 127.0.0.1:3307.'
    exit 0
}

Start-Process -FilePath $server -ArgumentList "--defaults-file=$config" -WindowStyle Hidden
Start-Sleep -Seconds 2
& (Join-Path $mysqlRoot 'bin\mysqladmin.exe') --protocol=tcp --host=127.0.0.1 --port=3307 ping
