@echo off
REM ----------------------------------------------------------------
REM LeadCatcher — first-time setup on Windows
REM Cleans up scaffolding leftovers and gets git into a working state
REM ----------------------------------------------------------------

echo Setting up LeadCatcher repo...

REM Remove broken .git folders left behind by the Linux sandbox
if exist .git.broken  rmdir /s /q .git.broken
if exist .git.broken2 rmdir /s /q .git.broken2

REM If a seed .git folder is present, promote it to the real .git
if exist .git_seed (
  if exist .git (
    echo .git already exists, skipping seed rename.
  ) else (
    ren .git_seed .git
    echo Restored .git from seed.
  )
)

REM Clean up stray .lock and .bak files that the sandbox could not delete
if exist .git\config.lock     del /q .git\config.lock
if exist .git\config.lock.bak del /q .git\config.lock.bak
if exist .git\index.lock      del /q .git\index.lock
if exist .git\index.lock.bak  del /q .git\index.lock.bak

REM If no git repo at all, init a fresh one
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
  echo Initializing fresh git repo...
  git init -b main
  git config user.email "korpaiix@gmail.com"
  git config user.name "korpaii