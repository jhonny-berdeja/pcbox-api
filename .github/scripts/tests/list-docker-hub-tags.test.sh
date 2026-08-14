#!/usr/bin/env bash
# Test harness for list-docker-hub-tags.sh. Stubs `curl` via PATH to simulate
# a 2-page paginated Docker Hub Hub API response, so the test never
# makes a real network call. Mirrors the pass/fail-counter style of
# validate-image-tag.test.sh (this repo).
#
# Run: bash scripts/list-docker-hub-tags.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../list-docker-hub-tags.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

FAKE_BIN_DIR="$(mktemp -d)"
trap 'rm -rf "$FAKE_BIN_DIR"' EXIT

# Fake curl: returns page 1 (with a `next` link) for the first request,
# and page 2 (with `next: null`) for any URL containing "page=2" --
# ignores every other argument (-sf, -H, ...), same as the real call
# shape used by list-docker-hub-tags.sh.
cat > "$FAKE_BIN_DIR/curl" <<'EOF'
#!/usr/bin/env bash
URL="${*: -1}"
case "$URL" in
  *page=2*)
    echo '{"next": null, "results": [{"name": "v1.2.0"}]}'
    ;;
  *)
    echo '{"next": "https://hub.docker.com/v2/repositories/testuser/testrepo/tags/?page=2&page_size=100", "results": [{"name": "v1.0.0"}, {"name": "v1.1.0"}]}'
    ;;
esac
EOF
chmod +x "$FAKE_BIN_DIR/curl"

# --- Paginated listing returns every tag, in order, exactly once ---
ACTUAL="$(PATH="$FAKE_BIN_DIR:$PATH" DOCKERHUB_USERNAME="testuser" HUB_API_TOKEN="faketoken" "$TARGET" testrepo)"
EXPECTED="$(printf 'v1.0.0\nv1.1.0\nv1.2.0')"

if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "PASS: paginated listing returns all tags in order"
  pass=$((pass + 1))
else
  echo "FAIL: paginated listing mismatch"
  echo "  expected: $EXPECTED"
  echo "  actual:   $ACTUAL"
  fail=$((fail + 1))
fi

# --- Missing DOCKERHUB_USERNAME / HUB_API_TOKEN is rejected ---
if PATH="$FAKE_BIN_DIR:$PATH" "$TARGET" testrepo >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing DOCKERHUB_USERNAME/HUB_API_TOKEN was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing DOCKERHUB_USERNAME/HUB_API_TOKEN"
  pass=$((pass + 1))
fi

# --- Missing repository argument is rejected ---
if DOCKERHUB_USERNAME="testuser" HUB_API_TOKEN="faketoken" "$TARGET" >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing repository argument was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing repository argument"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
