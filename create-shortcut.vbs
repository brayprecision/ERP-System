Option Explicit

' BPERP Dashboard Shortcut Creator
' Creates desktop and start menu shortcuts for easy access

Dim objShell, objFSO, strCurrentDir, strLauncherPath, strIconPath
Dim objDesktopShortcut, objStartMenuShortcut
Dim strDesktopPath, strStartMenuPath

' Initialize objects
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get current directory (where this VBScript is located)
strCurrentDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strLauncherPath = strCurrentDir & "\launch-bperp-gui.bat"
strIconPath = strCurrentDir & "\frontend\assets\bperp-icon.ico"

' Check if launcher exists
If Not objFSO.FileExists(strLauncherPath) Then
    MsgBox "Error: launch-bperp-gui.bat not found in " & strCurrentDir & vbCrLf & _
           "Please ensure all files are in the correct location.", vbCritical, "BPERP Installation Error"
    WScript.Quit 1
End If

' Fallback icon paths if bperp-icon.ico doesn't exist
If Not objFSO.FileExists(strIconPath) Then
    strIconPath = strCurrentDir & "\frontend\assets\modern-logo.png"
End If
If Not objFSO.FileExists(strIconPath) Then
    strIconPath = strCurrentDir & "\context files\shop_logo_app_version.jpg"
End If
If Not objFSO.FileExists(strIconPath) Then
    strIconPath = strCurrentDir & "\frontend\assets\logo.png"
End If

' Get paths for shortcuts
strDesktopPath = objShell.SpecialFolders("Desktop")
strStartMenuPath = objShell.SpecialFolders("Programs")

' Create Desktop Shortcut
Set objDesktopShortcut = objShell.CreateShortcut(strDesktopPath & "\BPERP Dashboard.lnk")
With objDesktopShortcut
    .TargetPath = strLauncherPath
    .WorkingDirectory = strCurrentDir
    .Description = "Bray Precision ERP Dashboard - Production Management System"
    .IconLocation = strIconPath & ",0"
    .WindowStyle = 1
    .Save
End With

' Create Start Menu Shortcut (single shortcut, no folder)
Set objStartMenuShortcut = objShell.CreateShortcut(strStartMenuPath & "\BPERP Dashboard.lnk")
With objStartMenuShortcut
    .TargetPath = strLauncherPath
    .WorkingDirectory = strCurrentDir
    .Description = "Bray Precision ERP Dashboard - Production Management System"
    .IconLocation = strIconPath & ",0"
    .WindowStyle = 1
    .Save
End With

' Show success message
MsgBox "BPERP Dashboard shortcuts created successfully!" & vbCrLf & vbCrLf & _
       "Created shortcuts:" & vbCrLf & _
       "• Desktop: BPERP Dashboard" & vbCrLf & _
       "• Start Menu: BPERP Dashboard" & vbCrLf & vbCrLf & _
       "You can now launch BPERP from your desktop or start menu!", _
       vbInformation, "BPERP Installation Complete"

' Cleanup
Set objDesktopShortcut = Nothing
Set objStartMenuShortcut = Nothing
Set objShell = Nothing
Set objFSO = Nothing

WScript.Quit 0
