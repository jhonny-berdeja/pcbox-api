#!/usr/bin/env bash
# Test harness for render-deleted-tags-summary.sh.
#
# Run: bash scripts/render-deleted-tags-summary.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../render-deleted-tags-summary.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

# --- Non-empty file renders the title and bullet list ---
TAG_FILE="$(mktemp)"
printf 'v1.3.0\nv1.4.0\n' > "$TAG_FILE"
ACTUAL="$("$TARGET" "$TAG_FILE")"
EXPECTED="$(printf '\n**Tags eliminados:**\n\n- `v1.3.0`\n- `v1.4.0`')"
if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "PASS: renders the title and bullet list for deleted tags"
  pass=$((pass + 1))
else
  echo "FAIL: deleted-tags summary mismatch"
  echo "  expected:"
  echo "$EXPECTED"
  echo "  actual:"
  echo "$ACTUAL"
  fail=$((fail + 1))
fi
rm -f "$TAG_FILE"

# --- Empty file renders the "(ninguno)" fallback ---
TAG_FILE="$(mktemp)"
ACTUAL="$("$TARGET" "$TAG_FILE")"
EXPECTED="$(printf '\n**Tags eliminados:**\n\n- _(ninguno)_')"
if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "PASS: renders the (ninguno) fallback when nothing was deleted"
  pass=$((pass + 1))
else
  echo "FAIL: empty deleted-tags summary mismatch"
  echo "  expected:"
  echo "$EXPECTED"
  echo "  actual:"
  echo "$ACTUAL"
  fail=$((fail + 1))
fi
rm -f "$TAG_FILE"

# --- Missing tag-file argument is rejected ---
if "$TARGET" >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing tag-file argument was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing tag-file argument"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
