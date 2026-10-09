@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 18 or newer, then run this file again.
  pause
  exit /b 1
)

if not exist node_modules\ (
  echo Installing application dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

if not exist .env if exist .env.example copy .env.example .env >nul
call npm.cmd start
if errorlevel 1 pause