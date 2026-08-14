#!/usr/bin/env bash
# Test harness for call-docker-hub-api-login.sh. Stubs `curl` via PATH so no
# real Docker Hub call happens.
#
# Run: bash scripts/call-docker-hub-api-login.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../call-docker-hub-api-login.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

FAKE_BIN_DIR="$(mktemp -d)"
trap 'rm -rf "$FAKE_BIN_DIR"' EXIT

# Fake curl: ignores every argument, returns a canned login response.
cat > "$FAKE_BIN_DIR/curl" <<'EOF'
#!/usr/bin/env bash
echo '{"token": "fake.jwt.token"}'
EOF
chmod +x "$FAKE_BIN_DIR/curl"

# --- Prints the token extracted from the login response ---
ACTUAL="$(PATH="$FAKE_BIN_DIR:$PATH" "$TARGET" '{"username":"u","password":"p"}')"
if [ "$ACTUAL" = "fake.jwt.token" ]; then
  echo "PASS: prints the token extracted from the login response"
  pass=$((pass + 1))
else
  echo "FAIL: expected 'fake.jwt.token', got '$ACTUAL'"
  fail=$((fail + 1))
fi

# --- Missing login body argument is rejected ---
if PATH="$FAKE_BIN_DIR:$PATH" "$TARGET" >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing login body was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing login body"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
