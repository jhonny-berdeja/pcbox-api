#!/usr/bin/env bash
# Test harness for render-tag-list-markdown.sh.
#
# Run: bash scripts/render-tag-list-markdown.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../render-tag-list-markdown.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

# --- Non-empty file renders one bullet per tag, in order ---
TAG_FILE="$(mktemp)"
printf 'v1.0.0\nv1.1.0\n' > "$TAG_FILE"
ACTUAL="$("$TARGET" "$TAG_FILE")"
EXPECTED="$(printf -- '- `v1.0.0`\n- `v1.1.0`')"
if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "PASS: renders one bullet per tag, in order"
  pass=$((pass + 1))
else
  echo "FAIL: bullet rendering mismatch"
  echo "  expected: $EXPECTED"
  echo "  actual:   $ACTUAL"
  fail=$((fail + 1))
fi
rm -f "$TAG_FILE"

# --- Empty file with no empty-message prints nothing ---
TAG_FILE="$(mktemp)"
ACTUAL="$("$TARGET" "$TAG_FILE")"
if [ -z "$ACTUAL" ]; then
  echo "PASS: empty file with no empty-message prints nothing"
  pass=$((pass + 1))
else
  echo "FAIL: expected empty output, got: $ACTUAL"
  fail=$((fail + 1))
fi
rm -f "$TAG_FILE"

# --- Empty file with an empty-message prints that message, italicized ---
TAG_FILE="$(mktemp)"
ACTUAL="$("$TARGET" "$TAG_FILE" "(ninguno)")"
EXPECTED="- _(ninguno)_"
if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "PASS: empty file with an empty-message prints the fallback line"
  pass=$((pass + 1))
else
  echo "FAIL: empty-message fallback mismatch"
  echo "  expected: $EXPECTED"
  echo "  actual:   $ACTUAL"
  fail=$((fail + 1))
fi
rm -f "$TAG_FILE"

# --- Missing tag file is rejected ---
if "$TARGET" /tmp/does-not-exist-file.txt >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing tag file was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing tag file"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
