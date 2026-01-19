@echo off
title BPERP Dashboard Uninstaller
echo Removing BPERP Dashboard shortcuts...

if exist "%USERPROFILE%\Desktop\BPERP Dashboard.lnk" (
    del "%USERPROFILE%\Desktop\BPERP Dashboard.lnk"
    echo [SUCCESS] Removed desktop shortcut
) else (
    echo [INFO] Desktop shortcut not found
)

if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\BPERP Dashboard.lnk" (
    del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\BPERP Dashboard.lnk"
    echo [SUCCESS] Removed start menu shortcut
) else (
    echo [INFO] Start menu shortcut not found
)

:: Also remove old folder-based shortcuts if they exist
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Bray Precision ERP" (
    rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Bray Precision ERP"
)
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Bray Precision Manufacturing" (
    rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Bray Precision Manufacturing"
)

echo BPERP Dashboard shortcuts have been removed.
pause
