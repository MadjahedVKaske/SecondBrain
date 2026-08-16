' Старт Cursor при логине в Windows.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
exe = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\cursor\Cursor.exe"
If fso.FileExists(exe) Then
  sh.Run """" & exe & """", 1, False
End If
