' Тихий старт desk_watch при логине. Исходящий опрос VPS, без reverse SSH.
' Будильник Cursor работает, только если этот скрипт убит и вотчер крутится в чате.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pyw = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Python\Python313\pythonw.exe"
script = "C:\Cursor\buro1-insight-hub\scripts\desk_watch.py"
If Not fso.FileExists(pyw) Then
  pyw = "pythonw"
End If
sh.CurrentDirectory = "C:\Cursor\buro1-insight-hub"
sh.Run """" & pyw & """ """ & script & """", 0, False
