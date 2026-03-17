#!/bin/bash
# Pruvi API Benchmark Script
# Usage: ./benchmark.sh [label]
# Requires: autocannon, curl, jq, running server on :3000, running postgres

set -e

LABEL="${1:-baseline}"
BASE_URL="http://localhost:3000"
DURATION=10        # seconds per test
CONNECTIONS=10     # concurrent connections
RESULTS_DIR="benchmark-results"

mkdir -p "$RESULTS_DIR"

echo "============================================"
echo "  Pruvi API Benchmark — $LABEL"
echo "  $(date)"
echo "  Duration: ${DURATION}s | Connections: $CONNECTIONS"
echo "============================================"
echo ""

# ── Step 1: Create a fresh test user ─────────────────────────────────
echo "→ Setting up test user..."
SIGNUP_RESP=$(curl -s -D /tmp/bench-headers.txt -X POST "$BASE_URL/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Bench User\",\"email\":\"bench-${LABEL}-$(date +%s)@test.com\",\"password\":\"benchpassword123\"}" 2>/dev/null)

COOKIE=$(grep -i 'set-cookie' /tmp/bench-headers.txt | head -1 | sed 's/set-cookie: //' | cut -d';' -f1)

if [ -z "$COOKIE" ]; then
  echo "  ✗ Failed to create user. Is the server running?"
  exit 1
fi
echo "  ✓ User created, cookie obtained"

# ── Step 2: Seed a session so we have data to query ──────────────────
echo "→ Creating a session to generate review data..."
curl -s --cookie "$COOKIE" -X POST "$BASE_URL/sessions/start" \
  -H "Content-Type: application/json" \
  -d '{"mode":"all"}' > /dev/null 2>&1

# Answer a few questions to create review_log entries
for QID in 1 2 3 4 5; do
  curl -s --cookie "$COOKIE" -X POST "$BASE_URL/questions/$QID/answer" \
    -H "Content-Type: application/json" \
    -d '{"selectedOptionIndex":2}' > /dev/null 2>&1
done
echo "  ✓ Session started, 5 questions answered"
echo ""

# ── Step 3: Benchmark each endpoint ──────────────────────────────────
OUTPUT="$RESULTS_DIR/${LABEL}.txt"
echo "" > "$OUTPUT"

echo "============================================" >> "$OUTPUT"
echo "  Pruvi API Benchmark — $LABEL" >> "$OUTPUT"
echo "  $(date)" >> "$OUTPUT"
echo "  Duration: ${DURATION}s | Connections: $CONNECTIONS" >> "$OUTPUT"
echo "============================================" >> "$OUTPUT"

run_bench() {
  local name="$1"
  local method="$2"
  local path="$3"
  local body="$4"

  echo "─────────────────────────────────────────"
  echo "  $name"
  echo "  $method $path"
  echo "─────────────────────────────────────────"

  echo "" >> "$OUTPUT"
  echo "── $name ($method $path) ──" >> "$OUTPUT"

  if [ "$method" = "GET" ]; then
    autocannon \
      -d "$DURATION" \
      -c "$CONNECTIONS" \
      -H "Cookie=$COOKIE" \
      "$BASE_URL$path" 2>&1 | tee -a "$OUTPUT"
  else
    autocannon \
      -d "$DURATION" \
      -c "$CONNECTIONS" \
      -m "$method" \
      -H "Cookie=$COOKIE" \
      -H "Content-Type=application/json" \
      -b "$body" \
      "$BASE_URL$path" 2>&1 | tee -a "$OUTPUT"
  fi

  echo ""
  sleep 1
}

# Health check (baseline — no DB, no auth)
run_bench "Health Check (no DB)" "GET" "/health"

# Auth-protected, simple DB read
run_bench "Get Lives" "GET" "/users/me/lives"

# Auth-protected, streak computation from daily_sessions
run_bench "Get Streaks" "GET" "/streaks"

# Auth-protected, today's session lookup
run_bench "Get Today's Session" "GET" "/sessions/today"

# Answer question — write-heavy (review_log insert + SM-2 + lives update)
run_bench "Answer Question" "POST" "/questions/6/answer" '{"selectedOptionIndex":1}'

echo ""
echo "============================================"
echo "  Benchmark complete!"
echo "  Results saved to: $OUTPUT"
echo "============================================"
