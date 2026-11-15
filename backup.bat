@echo off
setlocal
cd /d "%~dp0"
echo Creating a local backup and verifying restore...
echo This does not overwrite the running database.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\backup\Backup-And-Verify.ps1"
set "RAGYT_BACKUP_EXIT=%ERRORLEVEL%"
echo.
if "%RAGYT_BACKUP_EXIT%"=="0" (
    echo Backup and restore verification completed successfully.
    echo Backups: %~dp0backups
) else (
    echo ERROR: Backup or verification failed. Review the messages above.
    echo Do not treat this attempt as a verified backup.
)
if /i not "%~1"=="--no-pause" pause
exit /b %RAGYT_BACKUP_EXIT%