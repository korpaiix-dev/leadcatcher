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

# Clean up stray lock and bak files
rm -f .git/config.lock .git/config.lock.bak .git/index.lock .git/index.lock.bak 2>/dev/null || true

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
e