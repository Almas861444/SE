#!/usr/bin/env bash
# Re-creates every file in evidence/ (actual commands + actual results).
cd "$(dirname "$0")/.." || exit 1
mkdir -p evidence
rec() { out="$1"; shift; { echo "\$ $*"; echo "# date: $(date -u '+%Y-%m-%d %H:%M UTC')  node: $(node -v)"; "$@" 2>&1; echo "# exit code: $?"; } > "$out"; }
rec evidence/test-results-initial.txt     npm run test:initial
rec evidence/test-results-final.txt       npm run test:final
rec evidence/test-results-regression.txt  npm run test:regression
rec evidence/test-results-all.txt         npm test
rec evidence/demo-output.txt              node scripts/demo.mjs
rec evidence/metrics-output.txt           node scripts/metrics.mjs
rec evidence/mutation-check-output.txt    python3 scripts/mutation_check.py
if python3 -c "import playwright" 2>/dev/null; then rec evidence/e2e-results.txt python3 tests/e2e/ui_check.py; fi
grep -H -E "^# (tests|pass|fail)" evidence/test-results-*.txt
