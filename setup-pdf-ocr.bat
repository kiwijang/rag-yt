@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-pdf-ocr.ps1" %*
set "RAGYT_OCR_EXIT=%ERRORLEVEL%"
if not "%RAGYT_OCR_EXIT%"=="0" echo OCR setup failed. See output above.
pause
exit /b %RAGYT_OCR_EXIT%
