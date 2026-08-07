#!/usr/bin/env bash
# Syncs the "stable" worktree (../heraklios-stable, branch `stable`) to
# whatever this repo's local `main` currently is, then rebuilds it.
#
# `stable` is otherwise never touched: it only moves when this script runs,
# so it stays put while `main` gets worked on in this checkout. The already
#-running `vite preview` server for the stable worktree serves straight
# from its `dist/` folder, so no restart is needed after this completes —
# just reload the page.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STABLE_DIR="$(cd "$REPO_DIR/../heraklios-stable" && pwd)"

echo "Updating stable ($STABLE_DIR) to match main ($(git -C "$REPO_DIR" rev-parse --short main))..."

cd "$STABLE_DIR"
git checkout stable
git reset --hard main
npm install
npm run build

echo "Stable is now at $(git rev-parse --short HEAD) and rebuilt. Reload http://localhost:4173/ to see it."
