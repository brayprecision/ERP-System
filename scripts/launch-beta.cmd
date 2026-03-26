@echo off
REM Repack and run BPERP (Windows beta). Pass-through args, e.g. launch-beta.cmd -Dev
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-beta.ps1" %*
