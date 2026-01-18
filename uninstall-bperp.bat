@echo off
title BPERP Dashboard Uninstaller
echo Removing BPERP Dashboard shortcuts...

:: Remove desktop shortcut
if exist "%USERPROFILE%\Desktop\BPERP Dashboard.lnk" (
    del "%USERPROFILE%\Desktop\BPERP Dashboard.lnk"
    echo [SUCCESS] Removed desktop shortcut
) else (
    echo [INFO] Desktop shortcut not found
)

:: Remove start menu folder
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Bray Precision Manufacturing" (
    rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Bray Precision Manufacturing"
    echo [SUCCESS] Removed start menu shortcuts
) else (
    echo [INFO] Start menu shortcuts not found
)

echo BPERP Dashboard shortcuts have been removed.
echo Installation files remain in C:\Users\user\Desktop\BPERP\
echo.
pause
