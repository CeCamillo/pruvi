#!/usr/bin/env bash
set -euo pipefail

MAX_ITERATIONS="${1:-5}"
cd "$(dirname "$0")/../.."

echo "=== RALPH: AFK mode ($MAX_ITERATIONS iterations max) ==="
echo "Started at $(date)"

for i in $(seq 1 "$MAX_ITERATIONS"); do
  echo ""
  echo "--- Iteration $i of $MAX_ITERATIONS ---"

  OUTPUT=$(claude --print "$(cat plans/backlog/prompt.md)" 2>&1) || true
  echo "$OUTPUT"

  if echo "$OUTPUT" | grep -q '<promise>COMPLETE</promise>'; then
    echo ""
    echo "=== RALPH: Backlog empty. Stopping. ==="
    break
  fi

  echo "--- Iteration $i complete ---"
done

echo ""
echo "=== RALPH: AFK session done ==="
echo "Finished at $(date)"
