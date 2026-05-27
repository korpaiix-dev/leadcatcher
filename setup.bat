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

REM If no git repo at all, init a fresh one
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
  echo Initializing fresh git repo...
  git init -b main
  git config user.email "korpaiix@gmail.com"
  git config user.name "korpaiix"
  git add .
  git commit -m "Initial commit: Phase 0 spike scaffolding"
)

REM Reset working tree to match the recorded snapshot
git checkout . >nul 2>&1

echo.
echo Git is ready. Next:
echo   npm install
echo   npx playwright install chromium
echo   copy config.example.json config.json
echo.
