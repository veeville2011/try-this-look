@echo off
REM Wrapper batch file for npx that works with cmd /c
REM This file ensures npx runs correctly even when cmd is not in PATH

REM Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"

REM Use PowerShell to run npx (more reliable than cmd)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { npx %* }"

REM Exit with the same code as npx
exit /b %ERRORLEVEL%

