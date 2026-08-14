#!/usr/bin/env bash
# Test harness for filter-tags.sh. Table-driven against a fixed input
# file, asserting exact stdout for both keep and delete modes.
#
# Run: bash scripts/filter-tags.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../filter-tags.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

TAG_FILE="$(mktemp)"
trap 'rm -f "$TAG_FILE"' EXIT
printf 'v1.0.0\nv1.1.0\nv1.2.0\nv1.3.0\n' > "$TAG_FILE"

# --- keep mode returns only the two kept tags, in file order ---
ACTUAL="$("$TARGET" keep "$TAG_FILE" v1.0.0 v1.2.0)"
EXPECTED="$(printf 'v1.0.0\nv1.2.0')"
if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "PASS: keep mode returns the two kept tags in order"
  pass=$((pass + 1))
else
  echo "FAIL: keep mode mismatch"
  echo "  expected: $EXPECTED"
  echo "  actual:   $ACTUAL"
  fail=$((fail + 1))
fi

# --- delete mode returns everything except the two kept tags ---
ACTUAL="$("$TARGET" delete "$TAG_FILE" v1.0.0 v1.2.0)"
EXPECTED="$(printf 'v1.1.0\nv1.3.0')"
if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "PASS: delete mode returns everything except the two kept tags"
  pass=$((pass + 1))
else
  echo "FAIL: delete mode mismatch"
  echo "  expected: $EXPECTED"
  echo "  actual:   $ACTUAL"
  fail=$((fail + 1))
fi

# --- invalid mode is rejected ---
if "$TARGET" bogus "$TAG_FILE" v1.0.0 v1.2.0 >/dev/null 2>&1; then
  echo "FAIL (expected reject): invalid mode was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): invalid mode"
  pass=$((pass + 1))
fi

# --- missing tag file is rejected ---
if "$TARGET" keep /tmp/does-not-exist-file.txt v1.0.0 v1.2.0 >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing tag file was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing tag file"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
