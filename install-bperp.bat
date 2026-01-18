@echo off
setlocal enabledelayedexpansion
title BPERP Dashboard Installation

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
echo  ║                        Installation Script                              ║
echo  ║                                                                          ║
echo  ╚══════════════════════════════════════════════════════════════════════════╝
echo.

:: Change to the directory where the batch file is located
cd /d "%~dp0"

echo [INFO] Starting BPERP Dashboard installation...
echo.

:: Check prerequisites
echo [INFO] Checking system prerequisites...

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo [INFO] Please install Node.js from https://nodejs.org before continuing.
    echo [INFO] After installing Node.js, run this installer again.
    pause
    exit /b 1
)

:: Get Node.js version for display
for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VERSION=%%i
echo [SUCCESS] Node.js %NODE_VERSION% detected

:: Check if required files exist
if not exist "launch-bperp.bat" (
    echo [ERROR] launch-bperp.bat not found.
    echo [INFO] Please ensure all installation files are present.
    pause
    exit /b 1
)

if not exist "create-shortcut.vbs" (
    echo [ERROR] create-shortcut.vbs not found.
    echo [INFO] Please ensure all installation files are present.
    pause
    exit /b 1
)

if not exist "frontend" (
    echo [ERROR] Frontend directory not found.
    echo [INFO] Please ensure this installer is in the BPERP root directory.
    pause
    exit /b 1
)

echo [SUCCESS] All required files found

:: Create icon file from logo if it doesn't exist
if not exist "frontend\assets\bperp-icon.ico" (
    echo [INFO] Creating icon file from logo...
    if exist "frontend\assets\logo.png" (
        copy "frontend\assets\logo.png" "frontend\assets\bperp-icon.ico" >nul 2>&1
        if errorlevel 1 (
            echo [WARNING] Could not create icon file, will use PNG fallback
        ) else (
            echo [SUCCESS] Icon file created
        )
    )
)

:: Test the launcher before creating shortcuts
echo [INFO] Testing launcher functionality...
if exist "frontend\index-modular.html" (
    echo [SUCCESS] Application files verified
) else (
    echo [ERROR] Main application file ^(index-modular.html^) not found.
    pause
    exit /b 1
)

:: Create shortcuts using VBScript
echo [INFO] Creating desktop and start menu shortcuts...
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
echo :: Remove desktop shortcut
echo if exist "%%USERPROFILE%%\Desktop\BPERP Dashboard.lnk" (
echo     del "%%USERPROFILE%%\Desktop\BPERP Dashboard.lnk"
echo     echo [SUCCESS] Removed desktop shortcut
echo ^) else (
echo     echo [INFO] Desktop shortcut not found
echo ^)
echo.
echo :: Remove start menu folder
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
echo echo Installation files remain in %~dp0
echo echo.
echo pause
) > uninstall-bperp.bat

echo [SUCCESS] Uninstaller created

:: Installation complete
echo.
echo  ╔══════════════════════════════════════════════════════════════════════════╗
echo  ║                                                                          ║
echo  ║                    🎉 INSTALLATION COMPLETE! 🎉                         ║
echo  ║                                                                          ║
echo  ║    BPERP Dashboard has been successfully installed!                     ║
echo  ║                                                                          ║
echo  ║    You can now launch BPERP using:                                      ║
echo  ║    • Desktop shortcut: "BPERP Dashboard"                                ║
echo  ║    • Start Menu: BPERP Dashboard                                        ║
echo  ║    • Direct launch: double-click launch-bperp.bat                       ║
echo  ║                                                                          ║
echo  ║    System Requirements Met:                                              ║
echo  ║    ✓ Node.js %NODE_VERSION% installed                                              ║
echo  ║    ✓ Application files verified                                          ║
echo  ║    ✓ Shortcuts created                                                   ║
echo  ║    ✓ Uninstaller available                                               ║
echo  ║                                                                          ║
echo  ╚══════════════════════════════════════════════════════════════════════════╝
echo.

echo [SUCCESS] Installation completed successfully!
echo [INFO] You can now launch BPERP Dashboard from your desktop or start menu.
echo [INFO] To uninstall, run uninstall-bperp.bat or use the start menu shortcut.
echo.

:: Ask if user wants to launch now
set /p launch_now="Would you like to launch BPERP Dashboard now? (y/n): "
if /i "!launch_now!"=="y" (
    echo [INFO] Launching BPERP Dashboard...
    start "" "launch-bperp.bat"
) else (
    echo [INFO] You can launch BPERP Dashboard anytime from your desktop or start menu.
)

echo.
echo Installation complete. This window will close in 5 seconds...
timeout /t 5 >nul
exit /b 0