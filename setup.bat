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

REM ---------- Step 5