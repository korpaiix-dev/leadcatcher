#!/usr/bin/env bash
# ----------------------------------------------------------------
# LeadCatcher — first-time setup on macOS / Linux
# ----------------------------------------------------------------
set -e

echo "Setting up LeadCatcher repo..."

# Remove broken .git folders left behind by the Linux sandbox
rm -rf .git.broken .git.broken2 2>/dev/null || true

# Promote seed .git if present
if [ -d .git_seed ] && [ ! -d .git ]; then
  mv .git_seed .git
  echo "Restored .git from seed."
fi

# Fresh init if nothing is there
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Initializing fresh git repo..."
  git init -b main
  git config user.email "korpaiix@gmail.com"
  git config user.name "korpaiix"
  git add .
  git commit -m "Initial commit: Phase 0 spike scaffolding"
fi

git checkout . >/dev/null 2>&1 || true

echo
echo "Git is ready. Next:"
echo "  npm install"
echo "  npx playwright install chromium"
echo "  cp config.example.json config.json"
echo
