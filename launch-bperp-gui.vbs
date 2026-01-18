' BPERP Dashboard GUI Launcher
' Launches PowerShell GUI - minimized console, but forms display properly

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strScriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
strPSScript = strScriptPath & "\launch-bperp-gui.ps1"

' Window style 7 = minimized, no focus - console minimizes but forms show
objShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & strPSScript & """", 7, False
