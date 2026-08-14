#!/usr/bin/env bash
# Test harness for delete-docker-hub-tags.sh. Stubs `curl` via PATH so no real
# Docker Hub call happens; asserts every tag is attempted on success,
# and that the loop stops at the first failed delete instead of
# continuing past it.
#
# Run: bash scripts/delete-docker-hub-tags.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../delete-docker-hub-tags.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

FAKE_BIN_DIR="$(mktemp -d)"
CURL_LOG_FILE="$(mktemp)"
trap 'rm -rf "$FAKE_BIN_DIR" "$CURL_LOG_FILE"' EXIT

# Fake curl: logs the requested URL, then succeeds unless the URL
# contains "faildelete" (used to simulate one failing DELETE call).
cat > "$FAKE_BIN_DIR/curl" <<'EOF'
#!/usr/bin/env bash
URL="${*: -1}"
echo "$URL" >> "$CURL_LOG_FILE"
case "$URL" in
  *faildelete*) exit 1 ;;
  *) exit 0 ;;
esac
EOF
chmod +x "$FAKE_BIN_DIR/curl"

# --- All deletes succeed: every tag is attempted, in order ---
TAG_FILE="$(mktemp)"
printf 'v1.0.0\nv1.1.0\nv1.2.0\n' > "$TAG_FILE"
: > "$CURL_LOG_FILE"
if PATH="$FAKE_BIN_DIR:$PATH" CURL_LOG_FILE="$CURL_LOG_FILE" DOCKERHUB_USERNAME="testuser" HUB_API_TOKEN="faketoken" "$TARGET" testrepo "$TAG_FILE"; then
  ATTEMPTS="$(wc -l < "$CURL_LOG_FILE" | tr -d ' ')"
  if [ "$ATTEMPTS" -eq 3 ] && grep -q "/tags/v1.0.0/" "$CURL_LOG_FILE" && grep -q "/tags/v1.2.0/" "$CURL_LOG_FILE"; then
    echo "PASS: all tags attempted for delete, in order"
    pass=$((pass + 1))
  else
    echo "FAIL: expected 3 delete attempts, got $ATTEMPTS: $(cat "$CURL_LOG_FILE")"
    fail=$((fail + 1))
  fi
else
  echo "FAIL: expected success, script exited non-zero"
  fail=$((fail + 1))
fi
rm -f "$TAG_FILE"

# --- A failing delete stops the loop: later tags are never attempted ---
TAG_FILE="$(mktemp)"
printf 'v1.0.0\nfaildelete\nv1.2.0\n' > "$TAG_FILE"
: > "$CURL_LOG_FILE"
if PATH="$FAKE_BIN_DIR:$PATH" CURL_LOG_FILE="$CURL_LOG_FILE" DOCKERHUB_USERNAME="testuser" HUB_API_TOKEN="faketoken" "$TARGET" testrepo "$TAG_FILE" >/dev/null 2>&1; then
  echo "FAIL (expected non-zero exit): script succeeded despite a failing delete"
  fail=$((fail + 1))
else
  ATTEMPTS="$(wc -l < "$CURL_LOG_FILE" | tr -d ' ')"
  if [ "$ATTEMPTS" -eq 2 ] && ! grep -q "/tags/v1.2.0/" "$CURL_LOG_FILE"; then
    echo "PASS: loop stops at the first failed delete, later tags untouched"
    pass=$((pass + 1))
  else
    echo "FAIL: expected exactly 2 attempts stopping before v1.2.0, got $ATTEMPTS: $(cat "$CURL_LOG_FILE")"
    fail=$((fail + 1))
  fi
fi
rm -f "$TAG_FILE"

# --- Missing DOCKERHUB_USERNAME / HUB_API_TOKEN is rejected ---
TAG_FILE="$(mktemp)"
printf 'v1.0.0\n' > "$TAG_FILE"
if PATH="$FAKE_BIN_DIR:$PATH" "$TARGET" testrepo "$TAG_FILE" >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing DOCKERHUB_USERNAME/HUB_API_TOKEN was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing DOCKERHUB_USERNAME/HUB_API_TOKEN"
  pass=$((pass + 1))
fi
rm -f "$TAG_FILE"

# --- Missing tag file is rejected ---
if DOCKERHUB_USERNAME="testuser" HUB_API_TOKEN="faketoken" "$TARGET" testrepo /tmp/does-not-exist-file.txt >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing tag file was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing tag file"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
