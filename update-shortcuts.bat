@echo off
setlocal enabledelayedexpansion
title BPERP Shortcut Updater

echo.
echo ╔════════════════════════════════════════╗
echo ║       BPERP Shortcut Updater           ║
echo ║   Updating to Loading Screen Launcher  ║
echo ╚════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [INFO] Removing old desktop shortcut...
if exist "%USERPROFILE%\Desktop\BPERP Dashboard.lnk" (
    del "%USERPROFILE%\Desktop\BPERP Dashboard.lnk"
    echo [SUCCESS] Old desktop shortcut removed
) else (
    echo [INFO] No old desktop shortcut found
)

echo [INFO] Removing old start menu shortcuts...
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Bray Precision Manufacturing" (
    rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Bray Precision Manufacturing"
    echo [SUCCESS] Old start menu shortcuts removed
) else (
    echo [INFO] No old start menu shortcuts found
)

echo [INFO] Creating new shortcuts with loading screen launcher...
cscript //nologo create-shortcut.vbs

echo [INFO] Testing the launcher...
start "" "launch-bperp-silent.bat"

echo.
echo ╔════════════════════════════════════════╗
echo ║           UPDATE COMPLETE!             ║
echo ║                                        ║
echo ║  Your desktop shortcut now shows:      ║
echo ║  • Professional loading screen         ║
echo ║  • Shop logo with animations           ║
echo ║  • No command prompt windows           ║
echo ║                                        ║
echo ║  Try your desktop shortcut now!        ║
echo ╚════════════════════════════════════════╝
echo.

pause