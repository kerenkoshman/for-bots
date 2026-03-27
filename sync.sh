#!/bin/bash
# Bot-landing auto-sync: regenerate pages and push to GitHub Pages
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Running generator..."
node generate.js

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Checking for changes..."
git add -A

if git diff --cached --quiet; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] No changes. Nothing to push."
  exit 0
fi

git commit -m "Auto-update: $(date -u +%Y-%m-%d) — new/updated Medium articles"
git push origin main
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Pushed to GitHub Pages."
