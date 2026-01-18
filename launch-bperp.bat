@echo off
setlocal enabledelayedexpansion
title BPERP Dashboard Launcher

:: ASCII Art Banner
echo.
echo  ╔══════════════════════════════════════════════════════════════════════════╗
echo  ║                                                                          ║
echo  ║   ██████╗ ██████╗  ██████╗██╗      ██████╗ ███╗   ███╗██╗██████╗        ║
echo  ║   ██╔══██╗██╔══██╗██╔════╝██║      ██╔══██╗████╗ ████║██║██╔══██╗       ║
echo  ║   ██████╔╝██████╔╝█████╗  ██║█████╗██████╔╝██╔████╔██║██║██████╔╝       ║
echo  ║   ██╔══██╗██╔═══╝ ██╔══╝  ██║╚════╝██╔══██╗██║╚██╔╝██║██║██╔═══╝        ║
echo  ║   ██████╔╝██║     ███████╗██║      ██████╔╝██║ ╚═╝ ██║██║██║            ║
echo  ║   ╚═════╝ ╚═╝     ╚══════╝╚═╝      ╚═════╝ ╚═╝     ╚═╝╚═╝╚═╝            ║
echo  ║                                                                          ║
echo  ║        Bray Precision Manufacturing ERP Dashboard v2.0                  ║
echo  ║                          Starting System...                             ║
echo  ║                                                                          ║
echo  ╚══════════════════════════════════════════════════════════════════════════╝
echo.

:: Change to the directory where the batch file is located
cd /d "%~dp0"

:: Check if Node.js is installed
echo [INFO] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo [INFO] Please install Node.js from https://nodejs.org
    echo [INFO] This window will close in 10 seconds...
    timeout /t 10 >nul
    exit /b 1
)

:: Get Node.js version for display
for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VERSION=%%i
echo [SUCCESS] Node.js %NODE_VERSION% detected

:: Check if port 8080 is available
echo [INFO] Checking if port 8080 is available...
netstat -an | find "8080" | find "LISTENING" >nul
if not errorlevel 1 (
    echo [WARNING] Port 8080 is already in use.
    echo [INFO] Attempting to open browser to existing server...
    start "" "http://localhost:8080"
    echo [SUCCESS] Browser launched to existing BPERP Dashboard
    echo [INFO] This window will close in 5 seconds...
    timeout /t 5 >nul
    exit /b 0
)

echo [SUCCESS] Port 8080 is available

:: Check if frontend directory exists
if not exist "frontend" (
    echo [ERROR] Frontend directory not found.
    echo [INFO] Please ensure this launcher is in the BPERP root directory.
    echo [INFO] This window will close in 10 seconds...
    timeout /t 10 >nul
    exit /b 1
)

echo [SUCCESS] Frontend directory found

:: Start the server in a minimized window
echo [INFO] Starting BPERP server on port 8080...
echo [INFO] Server will run in minimized window...
start /min cmd /c "title BPERP Server - Port 8080 & cd frontend & npx serve -l 8080 -s --no-clipboard"

:: Wait for server to start
echo [INFO] Waiting for server startup (3 seconds)...
timeout /t 3 >nul

:: Verify server is running
echo [INFO] Verifying server startup...
for /l %%i in (1,1,5) do (
    netstat -an | find "8080" | find "LISTENING" >nul
    if not errorlevel 1 (
        echo [SUCCESS] Server is running on http://localhost:8080
        goto :server_ready
    )
    echo [INFO] Attempt %%i/5 - Server not ready yet, waiting 1 second...
    timeout /t 1 >nul
)

echo [WARNING] Server may not have started properly, but attempting to open browser...

:server_ready
:: Open browser to the application
echo [INFO] Launching browser to BPERP Dashboard...
start "" "http://localhost:8080"

echo.
echo  ╔══════════════════════════════════════════════════════════════════════════╗
echo  ║                                                                          ║
echo  ║                        🚀 BPERP DASHBOARD READY! 🚀                     ║
echo  ║                                                                          ║
echo  ║    Browser: http://localhost:8080                                       ║
echo  ║    Server:  Running in background on port 8080                          ║
echo  ║                                                                          ║
echo  ║    Note: Keep the server window open while using BPERP                  ║
echo  ║          Close the server window to stop the application                ║
echo  ║                                                                          ║
echo  ╚══════════════════════════════════════════════════════════════════════════╝
echo.

echo [SUCCESS] BPERP Dashboard launched successfully!
echo [INFO] This launcher window will close in 5 seconds...
echo [INFO] To stop BPERP, close the server window or press Ctrl+C in it.

timeout /t 5 >nul
exit /b 0