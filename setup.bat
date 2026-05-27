@echo off
setlocal
title LeadCatcher Setup

echo ===============================================
echo   LeadCatcher - one-click setup
echo ===============================================
echo.

REM ---------- Step 1: clean stray sandbox folders ----------
if exist .git.broken  rmdir /s /q .git.broken
if exist .git.broken2 rmdir /s /q .git.broken2

REM ---------- Step 2: promote .git_seed -> .git if needed ----------
if not exist .git_seed goto skip_seed
if exist .git goto skip_seed
ren .git_seed .git
echo [OK] Restored .git from seed.
:skip_seed

REM ---------- Step 3: clean stray .lock files ----------
if exist .git\config.lock     del /q .git\config.lock
if exist .git\config.lock.bak del /q .git\config.lock.bak
if exist .git\index.lock      del /q .git\index.lock
if exist .git\index.lock.bak  del /q .git\index.lock.bak

REM ---------- Step 4: ensure git repo exists ----------
git rev-parse --git-dir >nul 2>&1
if not errorlevel 1 goto git_ready
echo [..] Initializing fresh git repo...
git init -b main
git config user.email "korpaiix@gmail.com"
git config user.name "korpaiix"
git add .
git commit -m "Initial commit"
:git_ready
git config core.autocrlf true
git config core.filemode false
echo [OK] Git repo ready.

REM ---------- Step 5: npm install ----------
REM Check for the Windows .cmd shim, not just the package folder, because
REM installs done from a Linux sandbox leave node_modules without .cmd shims.
if exist node_modules\.bin\ts-node.cmd goto skip_npm
echo.
echo [..] Running npm install (this may take 30-60 seconds)...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 goto npm_fail
:skip_npm
echo [OK] npm dependencies ready.

REM ---------- Step 6: playwright install chromium ----------
if exist "%LOCALAPPDATA%\ms-playwright\chromium-1117" goto skip_pw
if exist "%LOCALAPPDATA%\ms-playwright\chromium-*" goto skip_pw
echo.
echo [..] Downloading Chromium for Playwright (about 130MB, 1-3 minutes)...
call npx --yes playwright install chromium
if errorlevel 1 goto pw_fail
:skip_pw
echo [OK] Chromium ready.

REM ---------- Step 7: create config.json from template ----------
if exist config.json goto skip_config
copy /Y config.example.json config.json >nul
echo [OK] Created config.json (please edit it before running scans).
:skip_config

echo.
echo ===============================================
echo   Setup complete!
echo ===============================================
echo.
echo Next steps:
echo   1. Edit config.json - add your Facebook group URLs and keywords
echo   2. npm run login          (one-time, opens browser to log in)
echo   3. npm run search -- "wedding"
echo   4. npm run scan
echo.
goto end

:npm_fail
echo.
echo [FAIL] npm install failed. Make sure Node.js is installed:
echo        https://nodejs.org/  (download LTS)
goto end

:pw_fail
echo.
echo [FAIL] Playwright Chromium download failed.
echo        Check your internet connection and retry:
echo        npx playwright install chromium
goto end

:end
echo.
pause
