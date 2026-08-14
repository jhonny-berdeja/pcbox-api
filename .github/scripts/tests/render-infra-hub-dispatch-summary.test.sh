#!/usr/bin/env bash
# Test harness for render-infra-hub-dispatch-summary.sh.
#
# Run: bash scripts/tests/render-infra-hub-dispatch-summary.test.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../render-infra-hub-dispatch-summary.sh"

pass=0
fail=0

if [ ! -f "$TARGET" ]; then
  echo "FAIL: $TARGET does not exist yet (expected in RED phase)"
  exit 1
fi

ACTUAL="$("$TARGET" someuser v1.2.3 someowner)"
EXPECTED="$(printf '## 🚀 Deploy aprobado y disparado hacia infra-hub\n\nEste run pusheó `someuser/pcbox-api:v1.2.3` y, una vez aprobado arriba, le avisó a `infra-hub` que despliegue esa imagen en el cluster microk8s de pcbox. infra-hub la aplica automáticamente - no hace falta otra aprobación ahí.\n\n**[▶ Ver el run de deploy en infra-hub](https://github.com/someowner/infra-hub/actions/workflows/deploy-pcbox-api.yml)**')"

if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "PASS: renders the infra-hub dispatch summary"
  pass=$((pass + 1))
else
  echo "FAIL: summary mismatch"
  echo "  expected:"
  echo "$EXPECTED"
  echo "  actual:"
  echo "$ACTUAL"
  fail=$((fail + 1))
fi

# --- Missing arguments are rejected ---
if "$TARGET" someuser v1.2.3 >/dev/null 2>&1; then
  echo "FAIL (expected reject): missing repository-owner was accepted"
  fail=$((fail + 1))
else
  echo "PASS (rejected): missing repository-owner"
  pass=$((pass + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
