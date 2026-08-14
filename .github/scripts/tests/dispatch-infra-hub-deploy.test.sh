#!/usr/bin/env bash
# Test harness for dispatch-infra-hub-deploy.sh. Stubs `gh` via PATH so
# no real GitHub API call happens.
#
# Run: bash scripts/tests/dispatch-infra-hub-deploy.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../dispatch-infra-hub-deploy.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

FAKE_BIN_DIR="$(mktemp -d)"
GH_LOG_FILE="$(mktemp)"
trap 'rm -rf "$FAKE_BIN_DIR" "$GH_LOG_FILE"' EXIT

# Fake gh: logs every argument it was called with, then succeeds.
cat > "$FAKE_BIN_DIR/gh" <<'EOF'
#!/usr/bin/env bash
echo "$@" >> "$GH_LOG_FILE"
exit 0
EOF
chmod +x "$FAKE_BIN_DIR/gh"

# --- Calls gh workflow run with the expected repo, ref, and image_tag ---
: > "$GH_LOG_FILE"
if PATH="$FAKE_BIN_DIR:$PATH" GH_LOG_FILE="$GH_LOG_FILE" "$TARGET" someowner v1.2.3; then
  LOGGED="$(cat "$GH_LOG_FILE")"
  if echo "$LOGGED" | grep -q "workflow run deploy-pcbox-api.yml" \
     && echo "$LOGGED" | grep -q -- "--repo someowner/infra-hub" \
     && echo "$LOGGED" | grep -q -- "--ref master" \
     && echo "$LOGGED" | grep -q -- "-f image_tag=v1.2.3"; then
    echo "PASS: dispatches gh workflow run with the expected arguments"
    pass=$((pass + 1))
  else
    echo "FAIL: unexpected gh invocation: $LOGGED"
    fail=$((fail + 1))
  fi
else
  echo "FAIL: expected success, script exited non-zero"
  fail=$((fail + 1))
fi

# --- Missing image tag argument is rejected ---
if PATH="$FAKE_BIN_DIR:$PATH" "$TARGET" someowner >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing image tag was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing image tag"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
