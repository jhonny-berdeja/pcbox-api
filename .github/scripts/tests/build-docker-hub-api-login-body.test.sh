#!/usr/bin/env bash
# Test harness for build-docker-hub-api-login-body.sh.
#
# Run: bash scripts/build-docker-hub-api-login-body.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../build-docker-hub-api-login-body.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

# --- Prints the expected single-line JSON body to stdout ---
ACTUAL="$(DOCKERHUB_USERNAME="someuser" DOCKERHUB_TOKEN="sometoken" "$TARGET")"
LINE_COUNT="$(echo "$ACTUAL" | wc -l | tr -d ' ')"
EXPECTED='{"username":"someuser","password":"sometoken"}'
if [ "$LINE_COUNT" -eq 1 ] && [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "PASS: prints a single-line login body JSON to stdout"
  pass=$((pass + 1))
else
  echo "FAIL: login body JSON mismatch (lines: $LINE_COUNT)"
  echo "  expected: $EXPECTED"
  echo "  actual:   $ACTUAL"
  fail=$((fail + 1))
fi

# --- Missing DOCKERHUB_USERNAME / DOCKERHUB_TOKEN is rejected ---
if "$TARGET" >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing DOCKERHUB_USERNAME/DOCKERHUB_TOKEN was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing DOCKERHUB_USERNAME/DOCKERHUB_TOKEN"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
