#!/usr/bin/env bash
# Test harness for git-tag-exists.sh. Uses a real local git repository
# so tag lookups are genuine, without touching any real remote.
#
# Run: bash scripts/tests/git-tag-exists.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../git-tag-exists.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

REPO_DIR="$(mktemp -d)"
trap 'rm -rf "$REPO_DIR"' EXIT

git init -q "$REPO_DIR"
cd "$REPO_DIR"
git config user.email "test@example.com"
git config user.name "Test"
echo "hello" > file.txt
git add file.txt
git commit -q -m "initial commit"
git tag v1.0.0-test

# --- An existing tag is reported as existing ---
if "$TARGET" v1.0.0-test; then
  echo "PASS: existing tag reported as existing"
  pass=$((pass + 1))
else
  echo "FAIL: existing tag reported as missing"
  fail=$((fail + 1))
fi

# --- A tag that was never created is reported as missing ---
if "$TARGET" v9.9.9-does-not-exist; then
  echo "FAIL: nonexistent tag reported as existing"
  fail=$((fail + 1))
else
  echo "PASS: nonexistent tag reported as missing"
  pass=$((pass + 1))
fi

# --- Missing argument is rejected ---
if "$TARGET" >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing tag argument was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing tag argument"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
