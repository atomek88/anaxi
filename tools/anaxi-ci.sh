#!/usr/bin/env bash
# anaxi-ci: keep the docs valid and INDEX.md fresh. For CI and pre-commit hooks (TOOLING.md §4.2).
#
#   anaxi-ci.sh                  CI: check, then fail if INDEX.md is stale
#   anaxi-ci.sh --fix            pre-commit: check, regenerate INDEX.md and stage it
#   anaxi-ci.sh --base origin/main     also print only the nudges that are new since that ref (for a PR comment)
#   anaxi-ci.sh --gate "@a @b"   also fail unless these items are ready to build
#   --dir DIR                     where to look for anaxi.json (default: current folder)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK=(node "$HERE/anaxi-check.mjs")
FIX=0; BASE=""; GATE=""; DIR="."

while [ $# -gt 0 ]; do
  case "$1" in
    --fix) FIX=1 ;;
    --base) BASE="$2"; shift ;;
    --gate) GATE="$2"; shift ;;
    --dir) DIR="$2"; shift ;;
    *) echo "anaxi-ci: unknown option $1" >&2; exit 2 ;;
  esac
  shift
done

# 1. syntax, settings, references: errors fail, warnings are printed
"${CHECK[@]}" check --dir "$DIR"

# 2. INDEX.md
if [ "$FIX" = 1 ]; then
  out="$("${CHECK[@]}" index --dir "$DIR")"
  echo "$out"
  git add "$("${CHECK[@]}" index --path --dir "$DIR")" 2>/dev/null || true
else
  "${CHECK[@]}" index --check --dir "$DIR"
fi

# 3. new nudges since BASE (informational: block nudges are for the gate)
if [ -n "$BASE" ]; then
  "${CHECK[@]}" nudges --diff "$BASE" --dir "$DIR" || true
fi

# 4. gates
status=0
for id in $GATE; do
  "${CHECK[@]}" gate "$id" --dir "$DIR" || status=1
done
exit $status
