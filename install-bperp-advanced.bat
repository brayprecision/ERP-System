@echo off
setlocal enabledelayedexpansion
title BPERP Dashboard Installation - Advanced Options

:: ASCII Art Banner
echo.
echo  ╔══════════════════════════════════════════════════════════════════════════╗
echo  ║                                                                          ║
echo  ║   ██████╗ ██████╗ ███████╗██████╗ ██████╗                               ║
echo  ║   ██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗                              ║
echo  ║   ██████╔╝██████╔╝█████╗  ██████╔╝██████╔╝                              ║
echo  ║   ██╔══██╗██╔═══╝ ██╔══╝  ██╔══██╗██╔═══╝                               ║
echo  ║   ██████╔╝██║     ███████╗██║  ██║██║                                   ║
echo  ║   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝                                   ║
echo  ║                                                                          ║
echo  ║              Bray Precision ERP Dashboard                               ║
echo  ║                    Advanced Installation Options                        ║
echo  ║                                                                          ║
echo  ╚══════════════════════════════════════════════════════════════════════════╝
echo.

:: Change to the directory where the batch file is located
cd /d "%~dp0"

echo [INFO] Advanced BPERP Dashboard installation with launcher options...
echo.

:: Check prerequisites
echo [INFO] Checking system prerequisites...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo [INFO] Please install Node.js from https://nodejs.org before continuing.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VERSION=%%i
echo [SUCCESS] Node.js %NODE_VERSION% detected

:: Check required files
if not exist "frontend" (
    echo [ERROR] Frontend directory not found.
    pause
    exit /b 1
)

echo [SUCCESS] All required files found
echo.

:: Using GUI Launcher (Windows Forms)
set LAUNCHER_FILE=launch-bperp-gui.bat
set LAUNCHER_NAME=GUI Launcher
echo [INFO] Using GUI Launcher with Windows Forms and loading screen

echo.

:: Note: Using GUI launcher by default

:: Create shortcuts
echo [INFO] Creating desktop and start menu shortcuts with %LAUNCHER_NAME%...
cscript //nologo create-shortcut.vbs
if errorlevel 1 (
    echo [ERROR] Failed to create shortcuts.
    pause
    exit /b 1
)

:: Create uninstaller
echo [INFO] Creating uninstaller...
(
echo @echo off
echo title BPERP Dashboard Uninstaller
echo echo Removing BPERP Dashboard shortcuts...
echo.
echo if exist "%%USERPROFILE%%\Desktop\BPERP Dashboard.lnk" (
echo     del "%%USERPROFILE%%\Desktop\BPERP Dashboard.lnk"
echo     echo [SUCCESS] Removed desktop shortcut
echo ^) else (
echo     echo [INFO] Desktop shortcut not found
echo ^)
echo.
echo if exist "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\BPERP Dashboard.lnk" (
echo     del "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\BPERP Dashboard.lnk"
echo     echo [SUCCESS] Removed start menu shortcut
echo ^) else (
echo     echo [INFO] Start menu shortcut not found
echo ^)
echo.
echo :: Also remove old folder-based shortcuts if they exist
echo if exist "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Bray Precision ERP" (
echo     rmdir /s /q "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Bray Precision ERP"
echo ^)
echo if exist "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Bray Precision Manufacturing" (
echo     rmdir /s /q "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Bray Precision Manufacturing"
echo ^)
echo.
echo echo BPERP Dashboard shortcuts have been removed.
echo pause
) > uninstall-bperp.bat

echo [SUCCESS] Uninstaller created

:: Installation complete
echo.
echo  ╔══════════════════════════════════════════════════════════════════════════╗
echo  ║                                                                          ║
echo  ║                    🎉 INSTALLATION COMPLETE! 🎉                         ║
echo  ║                                                                          ║
echo  ║    BPERP Dashboard installed with %LAUNCHER_NAME%                         ║
echo  ║                                                                          ║
echo  ║    Launch Options:                                                       ║
echo  ║    • Desktop shortcut: "BPERP Dashboard"                                ║
echo  ║    • Start Menu: BPERP Dashboard                                        ║
echo  ║    • Direct: %LAUNCHER_FILE%                                  ║
echo  ║                                                                          ║
echo  ║    Features:                                                             ║
echo  ║    ✓ Node.js %NODE_VERSION% ready                                                ║
echo  ║    ✓ Professional loading experience                                    ║
echo  ║    ✓ Multi-part work order system                                       ║
echo  ║    ✓ Hidden command prompts                                             ║
echo  ║                                                                          ║
echo  ╚══════════════════════════════════════════════════════════════════════════╝
echo.

echo [SUCCESS] Installation completed successfully!
echo.

set /p launch_now="Would you like to test the launcher now? (y/n): "
if /i "!launch_now!"=="y" (
    echo [INFO] Testing %LAUNCHER_NAME%...
    start "" "%LAUNCHER_FILE%"
) else (
    echo [INFO] You can launch BPERP Dashboard anytime from your desktop.
)

echo.
echo Installation complete. This window will close in 5 seconds...
timeout /t 5 >nul
exit /b 0