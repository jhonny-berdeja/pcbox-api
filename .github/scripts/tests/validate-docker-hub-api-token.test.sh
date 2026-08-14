#!/usr/bin/env bash
# Test harness for validate-docker-hub-api-token.sh.
#
# Run: bash scripts/validate-docker-hub-api-token.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../validate-docker-hub-api-token.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

# --- A non-empty, non-"null" token is accepted ---
if "$TARGET" "sometoken123"; then
  echo "PASS (accepted): valid token"
  pass=$((pass + 1))
else
  echo "FAIL (expected accept): valid token was rejected"
  fail=$((fail + 1))
fi

# --- An empty token is rejected ---
if "$TARGET" "" >/dev/null 2>&1; then
  echo "FAIL (expected reject): empty token was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): empty token"
  pass=$((pass + 1))
fi

# --- The literal "null" token (failed jq extraction) is rejected ---
if "$TARGET" "null" >/dev/null 2>&1; then
  echo "FAIL (expected reject): 'null' token was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): 'null' token"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
