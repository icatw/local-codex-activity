#!/bin/zsh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

PROJECT_DIR="/Users/icatw/Documents/Codex/2026-06-08/codex-app"
PROFILE_REPO="$PROJECT_DIR/work/profile-readme"
SVG_PATH="$PROFILE_REPO/assets/codex-activity.svg"

cd "$PROJECT_DIR"
npm run export:profile -- --output "$SVG_PATH" --timezone Asia/Shanghai

cd "$PROFILE_REPO"
git add README.md assets/codex-activity.svg

if git diff --cached --quiet; then
  echo "No Codex activity README changes to publish."
  exit 0
fi

git commit -m "chore: update local Codex activity"
git push origin main
