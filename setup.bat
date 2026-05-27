@echo off
setlocal
title LeadCatcher Setup

echo ===============================================
echo   LeadCatcher - setup and launch
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

REM ---------- Step 3: clean stray .lock files + npm trash dirs ----------
if exist .git\config.lock     del /q .git\config.lock
if exist .git\config.lock.bak del /q .git\config.lock.bak
if exist .git\index.lock      del /q .git\index.lock
if exist .git\index.lock.bak  del /q .git\index.lock.bak

REM Remove leftover npm install temp dirs from sandbox runs
if exist node_modules\.acorn-* for /d %%D in (node_modules\.acorn-*) do rmdir /s /q "%%D"
if exist node_modules\.mime-* for /d %%D in (node_modules\.mime-*) do rmdir /s /q "%%D"
if exist node_modules\.is-docker-* for /d %%D in (node_modules\.is-docker-*) do rmdir /s /q "%%D"
if exist node_modules\.playwright-* for /d %%D in (node_modules\.playwright-*) do rmdir /s /q "%%D"
if exist node_modules\.ts-node-* for /d %%D in (node_modules\.ts-node-*) do rmdir /s /q "%%D"
if exist node_modules\.typescript-* for /d %%D in (node_modules\.typescript-*) do rmdir /s /q "%%D"
if exist node_modules\.express-* for /d %%D in (node_modules\.express-*) do rmdir /s /q "%%D"
if exist node_modules\.open-* for /d %%D in (node_modules\.open-*) do rmdir /s /q "%%D"

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

REM ---------- Step 5: npm install (always run — fast if cached) ----------
echo.
echo [..] Running npm install (10-60 seconds)...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 goto npm_fail
echo [OK] npm dependencies ready.

REM ---------- Step 6: playwright install chromium ----------
echo.
echo [..] Ensuring Chromium for Playwright is installed...
call npx --yes playwright install chromium
if errorlevel 1 goto pw_fail
echo [OK] Chromium ready.

REM ---------- Step 7: create config.json from template ----------
if exist config.json goto skip_config
copy /Y config.example.json config.json >nul
echo [OK] Created config.json.
:skip_config

echo.
echo ===============================================
echo   Setup complete — starting dashboard...
echo ===============================================
echo.
echo Dashboard will open at http://localhost:3737
echo (Close this window to stop the dashboard)
echo.

REM ---------- Step 8: launch the dashboard ----------
call npm run dashboard
goto end

:npm_fail
echo.
echo [FAIL] npm install failed. Make sure Node.js is installed:
echo        https://nodejs.org/  (download LTS)
pause
goto end

:pw_fail
echo.
echo [FAIL] Playwright Chromium download failed.
echo        Check your internet connection and retry:
echo        npx playwright install chromium
pause
goto end

:end
