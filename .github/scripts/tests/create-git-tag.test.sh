#!/usr/bin/env bash
# Test harness for create-git-tag.sh. Uses a real local git repository
# as "origin" and a real clone as the working checkout, so the push
# actually happens, without touching any real remote.
#
# Run: bash scripts/tests/create-git-tag.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../create-git-tag.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

ORIGIN_DIR="$WORK_DIR/origin.git"
CHECKOUT_DIR="$WORK_DIR/checkout"

git init --bare -q "$ORIGIN_DIR"
git clone -q "$ORIGIN_DIR" "$CHECKOUT_DIR"
cd "$CHECKOUT_DIR"
git config user.email "test@example.com"
git config user.name "Test"
echo "hello" > file.txt
git add file.txt
git commit -q -m "initial commit"
git push -q origin master

# --- Creates the tag locally and pushes it to origin ---
if "$TARGET" v1.0.0-test; then
  if git ls-remote --tags origin | grep -q "refs/tags/v1.0.0-test"; then
    echo "PASS: tag created and pushed to origin"
    pass=$((pass + 1))
  else
    echo "FAIL: tag not found on origin after push"
    fail=$((fail + 1))
  fi
else
  echo "FAIL: expected success, script exited non-zero"
  fail=$((fail + 1))
fi

# --- Missing tag argument is rejected ---
if "$TARGET" >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing tag was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing tag"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
