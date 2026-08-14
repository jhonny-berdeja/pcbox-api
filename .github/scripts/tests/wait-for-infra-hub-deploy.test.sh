#!/usr/bin/env bash
# Test harness for wait-for-infra-hub-deploy.sh. Stubs `gh` via PATH so
# no real GitHub API call happens, and forces zero retries/sleep so the
# test runs instantly regardless of the script's production defaults.
#
# Run: bash scripts/tests/wait-for-infra-hub-deploy.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../wait-for-infra-hub-deploy.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

FAKE_BIN_DIR="$(mktemp -d)"
RUN_LIST_JSON="$(mktemp)"
WATCHED_RUN_LOG="$(mktemp)"
trap 'rm -rf "$FAKE_BIN_DIR" "$RUN_LIST_JSON" "$WATCHED_RUN_LOG"' EXIT

# Fake gh: "run list" prints $RUN_LIST_JSON; "run watch <id>" logs the
# id it was called with and exits with $WATCH_EXIT_CODE.
cat > "$FAKE_BIN_DIR/gh" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = "run" ] && [ "$2" = "list" ]; then
  cat "$RUN_LIST_JSON"
elif [ "$1" = "run" ] && [ "$2" = "watch" ]; then
  echo "watching $3" >> "$WATCHED_RUN_LOG"
  exit "${WATCH_EXIT_CODE:-0}"
fi
EOF
chmod +x "$FAKE_BIN_DIR/gh"

cat > "$RUN_LIST_JSON" <<'JSON'
[
  {"databaseId": 111, "createdAt": "2026-01-01T10:00:00Z"},
  {"databaseId": 222, "createdAt": "2026-01-01T10:05:00Z"},
  {"databaseId": 333, "createdAt": "2026-01-01T10:10:00Z"}
]
JSON

# --- Watches the earliest run created at/after the given timestamp ---
: > "$WATCHED_RUN_LOG"
if PATH="$FAKE_BIN_DIR:$PATH" RUN_LIST_JSON="$RUN_LIST_JSON" WATCHED_RUN_LOG="$WATCHED_RUN_LOG" \
   WATCH_EXIT_CODE=0 WAIT_FOR_INFRA_HUB_DEPLOY_MAX_ATTEMPTS=1 WAIT_FOR_INFRA_HUB_DEPLOY_SLEEP_SECONDS=0 \
   "$TARGET" someowner "2026-01-01T10:05:00Z"; then
  if grep -q "watching 222" "$WATCHED_RUN_LOG"; then
    echo "PASS: watches the earliest run created at/after the timestamp"
    pass=$((pass + 1))
  else
    echo "FAIL: watched the wrong run: $(cat "$WATCHED_RUN_LOG")"
    fail=$((fail + 1))
  fi
else
  echo "FAIL: expected success, script exited non-zero"
  fail=$((fail + 1))
fi

# --- Propagates a failed watched run as a failure ---
: > "$WATCHED_RUN_LOG"
if PATH="$FAKE_BIN_DIR:$PATH" RUN_LIST_JSON="$RUN_LIST_JSON" WATCHED_RUN_LOG="$WATCHED_RUN_LOG" \
   WATCH_EXIT_CODE=1 WAIT_FOR_INFRA_HUB_DEPLOY_MAX_ATTEMPTS=1 WAIT_FOR_INFRA_HUB_DEPLOY_SLEEP_SECONDS=0 \
   "$TARGET" someowner "2026-01-01T10:05:00Z" >/dev/null 2>&1; then
  echo "FAIL (expected failure): a failed infra-hub run was reported as success"
  fail=$((fail + 1))
else
  echo "PASS (propagated failure): a failed infra-hub run makes this script fail too"
  pass=$((pass + 1))
fi

# --- Gives up after exhausting retries if no matching run ever shows up ---
: > "$RUN_LIST_JSON"
echo "[]" > "$RUN_LIST_JSON"
if PATH="$FAKE_BIN_DIR:$PATH" RUN_LIST_JSON="$RUN_LIST_JSON" WATCHED_RUN_LOG="$WATCHED_RUN_LOG" \
   WAIT_FOR_INFRA_HUB_DEPLOY_MAX_ATTEMPTS=2 WAIT_FOR_INFRA_HUB_DEPLOY_SLEEP_SECONDS=0 \
   "$TARGET" someowner "2026-01-01T10:05:00Z" >/dev/null 2>&1; then
  echo "FAIL (expected failure): no matching run was still reported as success"
  fail=$((fail + 1))
else
  echo "PASS (rejected): gives up after exhausting retries with no matching run"
  pass=$((pass + 1))
fi

# --- Missing arguments are rejected ---
if PATH="$FAKE_BIN_DIR:$PATH" "$TARGET" someowner >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing since-timestamp was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing since-timestamp"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
