# Watchdog: проверяет desk_watch.py и перезапускает через pythonw при падении.
$ErrorActionPreference = "Stop"

$RepoRoot = "C:\Cursor\buro1-insight-hub"
$LogDir = Join-Path $RepoRoot "_tmp"
$WatchdogLog = Join-Path $LogDir "desk-watch-watchdog.log"
$PythonW = Join-Path $env:LOCALAPPDATA "Programs\Python\Python313\pythonw.exe"
$DeskWatchScript = Join-Path $RepoRoot "scripts\desk_watch.py"

function Write-WatchdogLog {
    param([string]$Message)
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $WatchdogLog -Value "[$ts] $Message" -Encoding UTF8
}

try {
    $allDeskWatch = Get-CimInstance Win32_Process |
        Where-Object { $_.CommandLine -like '*desk_watch.py*' }

    # Системный вотчер = только pythonw.exe; сессионный python.exe в Cursor не считается.
    $systemAlive = @($allDeskWatch | Where-Object { $_.Name -eq 'pythonw.exe' })
    $sessionProcs = @($allDeskWatch | Where-Object { $_.Name -eq 'python.exe' })

    foreach ($proc in $sessionProcs) {
        Write-WatchdogLog "desk_watch session pid=$($proc.ProcessId) name=$($proc.Name) (ignored)"
    }

    if ($systemAlive.Count -gt 0) {
        foreach ($proc in $systemAlive) {
            Write-WatchdogLog "desk_watch alive pid=$($proc.ProcessId) name=$($proc.Name)"
        }
        exit 0
    }

    Write-WatchdogLog "desk_watch not running, starting via pythonw"

    if (-not (Test-Path $PythonW)) {
        Write-WatchdogLog "ERROR: pythonw not found: $PythonW"
        exit 1
    }

    if (-not (Test-Path $DeskWatchScript)) {
        Write-WatchdogLog "ERROR: script not found: $DeskWatchScript"
        exit 1
    }

    # pythonw без консоли; stdout/stderr пишет сам desk_watch.py в desk-watch.log
    Start-Process -FilePath $PythonW -ArgumentList "`"$DeskWatchScript`"" -WindowStyle Hidden
    Write-WatchdogLog "desk_watch started"
    exit 0
}
catch {
    Write-WatchdogLog "ERROR: $($_.Exception.Message)"
    exit 1
}
