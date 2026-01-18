@echo off
setlocal enabledelayedexpansion

:: Change to the directory where the batch file is located
cd /d "%~dp0"

:: Hide this window immediately
powershell -Command "(Add-Type '[DllImport(\"user32.dll\")] public static extern bool ShowWindow(int handle, int state);' -name Win32ShowWindow -namespace Win32Functions -passThru)::ShowWindow((Get-Process -id $pid).MainWindowHandle, 0)" >nul 2>&1

:: Check if Node.js is installed (silently)
node --version >nul 2>&1
if errorlevel 1 (
    :: Show error message and exit
    powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Node.js is not installed or not found in PATH.`n`nPlease install Node.js from https://nodejs.org and try again.', 'BPERP Dashboard - Error', 'OK', 'Error')"
    exit /b 1
)

:: Check if port is already in use
netstat -an | find "8080" | find "LISTENING" >nul
if not errorlevel 1 (
    :: Port is in use, just open browser to loading screen
    start "" "http://localhost:8080/loading.html"
    exit /b 0
)

:: Start the server in completely hidden mode
start /B "" cmd /c "cd frontend && npx serve -l 8080 -s --no-clipboard >nul 2>&1"

:: Open browser to loading screen immediately
start "" "http://localhost:8080/loading.html"

:: Exit silently
exit /b 0