#!/usr/bin/env bash
# Test harness for render-kept-tags-summary.sh.
#
# Run: bash scripts/render-kept-tags-summary.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../render-kept-tags-summary.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

TAG_FILE="$(mktemp)"
trap 'rm -f "$TAG_FILE"' EXIT
printf 'v1.0.0\nv1.2.0\n' > "$TAG_FILE"

ACTUAL="$("$TARGET" v1.0.0 v1.2.0 "$TAG_FILE")"
EXPECTED="$(printf '## 🧹 Limpieza de tags de pcbox-api en Docker Hub\n\nSe conservaron los tags `v1.0.0` (estable anterior) y `v1.2.0` (recién deployado). El resto se borró del repositorio en Docker Hub.\n\n**Tags conservados:**\n\n- `v1.0.0`\n- `v1.2.0`')"

if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "PASS: renders the full kept-tags summary section"
  pass=$((pass + 1))
else
  echo "FAIL: kept-tags summary mismatch"
  echo "  expected:"
  echo "$EXPECTED"
  echo "  actual:"
  echo "$ACTUAL"
  fail=$((fail + 1))
fi

# --- Missing arguments are rejected ---
if "$TARGET" v1.0.0 v1.2.0 >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing tag-file argument was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing tag-file argument"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
