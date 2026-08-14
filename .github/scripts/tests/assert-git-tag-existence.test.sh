#!/usr/bin/env bash
# Test harness for assert-git-tag-existence.sh. Uses a real local git
# repository so tag lookups are genuine.
#
# Run: bash scripts/tests/assert-git-tag-existence.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../assert-git-tag-existence.sh"

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

# --- mode "exists" passes for an existing tag ---
if "$TARGET" exists v1.0.0-test; then
  echo "PASS: mode 'exists' passes for an existing tag"
  pass=$((pass + 1))
else
  echo "FAIL: mode 'exists' rejected an existing tag"
  fail=$((fail + 1))
fi

# --- mode "exists" fails for a missing tag ---
if "$TARGET" exists v9.9.9-missing >/dev/null 2>&1; then
  echo "FAIL: mode 'exists' accepted a missing tag"
  fail=$((fail + 1))
else
  echo "PASS: mode 'exists' fails for a missing tag"
  pass=$((pass + 1))
fi

# --- mode "not-exists" passes for a missing tag ---
if "$TARGET" not-exists v9.9.9-missing; then
  echo "PASS: mode 'not-exists' passes for a missing tag"
  pass=$((pass + 1))
else
  echo "FAIL: mode 'not-exists' rejected a missing tag"
  fail=$((fail + 1))
fi

# --- mode "not-exists" fails for an existing tag ---
if "$TARGET" not-exists v1.0.0-test >/dev/null 2>&1; then
  echo "FAIL: mode 'not-exists' accepted an existing tag"
  fail=$((fail + 1))
else
  echo "PASS: mode 'not-exists' fails for an existing tag"
  pass=$((pass + 1))
fi

# --- invalid mode is rejected ---
if "$TARGET" bogus v1.0.0-test >/dev/null 2>&1; then
  echo "FAIL (expected reject): invalid mode was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): invalid mode"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
