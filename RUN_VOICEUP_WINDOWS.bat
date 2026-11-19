@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto neednode
node -e "require('node:sqlite').DatabaseSync || process.exit(1)" >nul 2>nul
if errorlevel 1 goto neednode
echo Keep this window open while using Voice Up.
node server.cjs --open-account
pause
exit /b
:neednode
echo Install Node.js 22.13 or later with SQLite support, then reopen this launcher.
echo Download Node.js from https://nodejs.org/
pause
