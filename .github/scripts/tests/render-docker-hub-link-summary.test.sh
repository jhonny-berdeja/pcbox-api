#!/usr/bin/env bash
# Test harness for render-docker-hub-link-summary.sh.
#
# Run: bash scripts/render-docker-hub-link-summary.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../render-docker-hub-link-summary.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

# --- Renders the link with the given username ---
ACTUAL="$("$TARGET" someuser)"
EXPECTED="$(printf '\n**[▶ Ver los tags en Docker Hub](https://hub.docker.com/r/someuser/pcbox-api/tags)**')"
if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "PASS: renders the Docker Hub tags link"
  pass=$((pass + 1))
else
  echo "FAIL: link mismatch"
  echo "  expected:"
  echo "$EXPECTED"
  echo "  actual:"
  echo "$ACTUAL"
  fail=$((fail + 1))
fi

# --- Missing username argument is rejected ---
if "$TARGET" >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing username argument was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing username argument"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
