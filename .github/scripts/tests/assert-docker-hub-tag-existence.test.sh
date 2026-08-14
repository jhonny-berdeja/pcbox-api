#!/usr/bin/env bash
# Test harness for assert-docker-hub-tag-existence.sh. Stubs `curl` via
# PATH so no real Docker Hub call happens.
#
# Run: bash scripts/tests/assert-docker-hub-tag-existence.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../assert-docker-hub-tag-existence.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

FAKE_BIN_DIR="$(mktemp -d)"
trap 'rm -rf "$FAKE_BIN_DIR"' EXIT

cat > "$FAKE_BIN_DIR/curl" <<'EOF'
#!/usr/bin/env bash
URL="${*: -1}"
case "$URL" in
  *exists-tag*) echo -n "200" ;;
  *) echo -n "404" ;;
esac
EOF
chmod +x "$FAKE_BIN_DIR/curl"

# --- mode "exists" passes for an existing tag ---
if PATH="$FAKE_BIN_DIR:$PATH" DOCKERHUB_USERNAME="someuser" HUB_API_TOKEN="faketoken" "$TARGET" exists pcbox-api exists-tag; then
  echo "PASS: mode 'exists' passes for an existing tag"
  pass=$((pass + 1))
else
  echo "FAIL: mode 'exists' rejected an existing tag"
  fail=$((fail + 1))
fi

# --- mode "exists" fails for a missing tag ---
if PATH="$FAKE_BIN_DIR:$PATH" DOCKERHUB_USERNAME="someuser" HUB_API_TOKEN="faketoken" "$TARGET" exists pcbox-api missing-tag >/dev/null 2>&1; then
  echo "FAIL: mode 'exists' accepted a missing tag"
  fail=$((fail + 1))
else
  echo "PASS: mode 'exists' fails for a missing tag"
  pass=$((pass + 1))
fi

# --- mode "not-exists" passes for a missing tag ---
if PATH="$FAKE_BIN_DIR:$PATH" DOCKERHUB_USERNAME="someuser" HUB_API_TOKEN="faketoken" "$TARGET" not-exists pcbox-api missing-tag; then
  echo "PASS: mode 'not-exists' passes for a missing tag"
  pass=$((pass + 1))
else
  echo "FAIL: mode 'not-exists' rejected a missing tag"
  fail=$((fail + 1))
fi

# --- mode "not-exists" fails for an existing tag ---
if PATH="$FAKE_BIN_DIR:$PATH" DOCKERHUB_USERNAME="someuser" HUB_API_TOKEN="faketoken" "$TARGET" not-exists pcbox-api exists-tag >/dev/null 2>&1; then
  echo "FAIL: mode 'not-exists' accepted an existing tag"
  fail=$((fail + 1))
else
  echo "PASS: mode 'not-exists' fails for an existing tag"
  pass=$((pass + 1))
fi

# --- invalid mode is rejected ---
if PATH="$FAKE_BIN_DIR:$PATH" DOCKERHUB_USERNAME="someuser" HUB_API_TOKEN="faketoken" "$TARGET" bogus pcbox-api exists-tag >/dev/null 2>&1; then
  echo "FAIL (expected reject): invalid mode was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): invalid mode"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
