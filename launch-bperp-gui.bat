@echo off
:: BPERP Dashboard GUI Launcher
:: Launches PowerShell GUI loading screen

cd /d "%~dp0"

:: Use wscript (not cscript) for completely silent VBS execution
if exist "launch-bperp-gui.vbs" (
    wscript "launch-bperp-gui.vbs"
    exit /b 0
)

:: Fallback: Direct PowerShell (console will briefly flash)
powershell -NoProfile -ExecutionPolicy Bypass -File "launch-bperp-gui.ps1"
exit /b 0
