@echo off
setlocal enabledelayedexpansion
title BPERP Icon Creator

echo.
echo ╔════════════════════════════════════════╗
echo ║        BPERP Icon Creator              ║
echo ║   Converting logo.png to .ico format  ║
echo ╚════════════════════════════════════════╝
echo.

cd /d "%~dp0"

if not exist "frontend\assets\logo.png" (
    echo [ERROR] logo.png not found in frontend\assets\
    pause
    exit /b 1
)

echo [INFO] Converting logo.png to bperp-icon.ico...

:: Simple copy as fallback (Windows will handle it for basic icon needs)
copy "frontend\assets\logo.png" "frontend\assets\bperp-icon.ico" >nul 2>&1

if errorlevel 1 (
    echo [ERROR] Failed to create icon file
    pause
    exit /b 1
)

echo [SUCCESS] Icon file created: frontend\assets\bperp-icon.ico
echo.
echo [INFO] For professional ICO files with multiple sizes:
echo        • Use online converter: https://convertio.co/png-ico/
echo        • Or use tools like ImageMagick, GIMP, or IrfanView
echo        • Replace the generated bperp-icon.ico with high-quality version
echo.
echo [INFO] Icon will be used for:
echo        • Desktop shortcut
echo        • Start menu shortcut  
echo        • Windows file association
echo.
pause