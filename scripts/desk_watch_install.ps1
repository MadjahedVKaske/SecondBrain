# Регистрирует Scheduled Task DeskWatchGuard (watchdog desk_watch.py).
$ErrorActionPreference = "Stop"

$TaskName = "DeskWatchGuard"
$WatchdogScript = "C:\Cursor\buro1-insight-hub\scripts\desk_watch_watchdog.ps1"
$UserName = $env:USERNAME

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Task '$TaskName' exists, recreating..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Триггер 1: при входе текущего пользователя
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $UserName

# Триггер 2: каждую минуту бесконечно.
# TimeSpan::MaxValue планировщик Windows не принимает - используем 9999 дней (~27 лет).
$repetitionDays = 9999
$triggerRepeat = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 1) `
    -RepetitionDuration (New-TimeSpan -Days $repetitionDays)

Write-Host "RepetitionDuration: $repetitionDays days (MaxValue not supported by Task Scheduler)"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$WatchdogScript`""

$settings = New-ScheduledTaskSettingsSet `
    -Hidden `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -WakeToRun:$false

$principal = New-ScheduledTaskPrincipal `
    -UserId $UserName `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Trigger @($triggerLogon, $triggerRepeat) `
    -Action $action `
    -Settings $settings `
    -Principal $principal `
    -Description "Watchdog for desk_watch.py (poll VPS desk wake queue)"

Write-Host "Scheduled task '$TaskName' registered for user '$UserName'."
