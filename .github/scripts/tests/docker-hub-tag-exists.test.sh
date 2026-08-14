#!/usr/bin/env bash
# Test harness for docker-hub-tag-exists.sh. Stubs `curl` via PATH so
# no real Docker Hub call happens.
#
# Run: bash scripts/tests/docker-hub-tag-exists.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../docker-hub-tag-exists.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

FAKE_BIN_DIR="$(mktemp -d)"
trap 'rm -rf "$FAKE_BIN_DIR"' EXIT

# Fake curl: returns HTTP 200 for a URL containing "exists-tag", 404
# for anything else -- mirrors `-o /dev/null -w '%{http_code}'`, so it
# only needs to print the status code, no body.
cat > "$FAKE_BIN_DIR/curl" <<'EOF'
#!/usr/bin/env bash
URL="${*: -1}"
case "$URL" in
  *exists-tag*) echo -n "200" ;;
  *) echo -n "404" ;;
esac
EOF
chmod +x "$FAKE_BIN_DIR/curl"

# --- A tag that exists reports success ---
if PATH="$FAKE_BIN_DIR:$PATH" DOCKERHUB_USERNAME="someuser" HUB_API_TOKEN="faketoken" "$TARGET" pcbox-api exists-tag; then
  echo "PASS: existing tag reported as existing"
  pass=$((pass + 1))
else
  echo "FAIL: existing tag reported as missing"
  fail=$((fail + 1))
fi

# --- A tag that does not exist reports failure ---
if PATH="$FAKE_BIN_DIR:$PATH" DOCKERHUB_USERNAME="someuser" HUB_API_TOKEN="faketoken" "$TARGET" pcbox-api missing-tag; then
  echo "FAIL: nonexistent tag reported as existing"
  fail=$((fail + 1))
else
  echo "PASS: nonexistent tag reported as missing"
  pass=$((pass + 1))
fi

# --- Missing arguments are rejected ---
if PATH="$FAKE_BIN_DIR:$PATH" DOCKERHUB_USERNAME="someuser" HUB_API_TOKEN="faketoken" "$TARGET" pcbox-api >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing tag argument was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing tag argument"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
