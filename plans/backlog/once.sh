#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

echo "=== RALPH: Single iteration ==="
echo "Started at $(date)"

git checkout main && git pull --ff-only

claude --print "$(cat plans/backlog/prompt.md)"

echo "=== RALPH: Done ==="
echo "Finished at $(date)"
