#!/usr/bin/env bash
# anaxi-init: add Anaxi to a project, new or existing. Never overwrites a file that's already there.
#
#   anaxi-init.sh [TARGET] [--profile NAME] [--stage STAGE] [--docs DIR] [--no-vendor] [--no-hook] [--no-skill] [--plugin]
#
#   TARGET       the project folder (default: current folder; created if missing)
#   --profile    default · service · mobile · data · integration · library · spike · regulated (default: default)
#   --stage      discovery · shaping · pre-build · building · change (default: shaping)
#   --docs       where the design docs live, relative to TARGET (default: docs)
#   --no-vendor  don't copy the method into TARGET/tools/anaxi; use $ANAXI_HOME or this copy instead
#   --no-hook    don't install the pre-commit hook
#   --no-skill   don't link the agent skill into .claude/skills/
#   --plugin     for the Claude Code plugin (/anaxi:init): no vendored copy, no skill link; the plugin has both
set -euo pipefail

METHOD="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="."; PROFILE="default"; STAGE="shaping"; DOCS="docs"; VENDOR=1; HOOK=1; SKILL=1; PLUGIN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="$2"; shift ;;
    --stage) STAGE="$2"; shift ;;
    --docs) DOCS="${2%/}"; shift ;;
    --no-vendor) VENDOR=0 ;;
    --no-hook) HOOK=0 ;;
    --no-skill) SKILL=0 ;;
    --plugin) PLUGIN=1; VENDOR=0; SKILL=0 ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    -*) echo "anaxi-init: unknown option $1" >&2; exit 2 ;;
    *) TARGET="$1" ;;
  esac
  shift
done

[ -f "$METHOD/profiles/$PROFILE.json" ] || { echo "anaxi-init: unknown profile \"$PROFILE\"" >&2; exit 2; }
case "$STAGE" in discovery|shaping|pre-build|building|change) ;; *) echo "anaxi-init: unknown stage \"$STAGE\"" >&2; exit 2 ;; esac

mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"
cd "$TARGET"
say() { echo "  $1"; }
put() { # put FILE (content on stdin): write only if missing
  if [ -e "$1" ]; then say "kept     $1 (already there)"; cat >/dev/null; else mkdir -p "$(dirname "$1")"; cat >"$1"; say "created  $1"; fi
}

echo "Anaxi → $TARGET  (profile: $PROFILE, stage: $STAGE, docs: $DOCS/)"

# 1. the method
if [ "$VENDOR" = 1 ]; then
  if [ -e tools/anaxi ]; then say "kept     tools/anaxi (already there; replace it to upgrade)"
  else
    mkdir -p tools/anaxi
    (cd "$METHOD" && tar cf - --exclude ./example --exclude .DS_Store .) | (cd tools/anaxi && tar xf -)
    say "created  tools/anaxi (the method, scripts and skill)"
  fi
  RUN="tools/anaxi"
else
  RUN="${ANAXI_HOME:-$METHOD}"
  if [ "$PLUGIN" = 1 ]; then say "using    the Claude Code plugin (CI needs ANAXI_HOME or a vendored copy: QUICKSTART.md)"
  else say "using    $RUN (not vendored; set ANAXI_HOME on other machines and in CI)"; fi
fi

# 2. settings, questions, the stack, a place for features
put anaxi.json <<EOF
{
  "profile": "$PROFILE",
  "stage": "$STAGE",
  "docs": ["$DOCS/**/*.md"],
  "shared": "$DOCS/shared",
  "questions": "$DOCS/anaxi-questions.md",
  "index": "$DOCS/INDEX.md",
  "archive": "$DOCS/archive"
}
EOF
put "$DOCS/anaxi-questions.md" <"$METHOD/templates/anaxi-questions.md"
put "$DOCS/shared/stack.md" <<'EOF'
# Shared: project stack

## Stack
> @stack · depth: D0 · risk: 2·1·0·0 · about: infra

**Why.** One place for the project's technology choices, so items only say what is new or different.

**Shape.** (D2: one row per layer)

| Layer | Choice | Why | Rejected |
|---|---|---|---|
| | | | |
EOF
mkdir -p "$DOCS/features"

# 3. agent skill and hook
if [ "$SKILL" = 1 ]; then
  if [ -e .claude/skills/anaxi ]; then say "kept     .claude/skills/anaxi"
  else mkdir -p .claude/skills; ln -s "$( [ "$VENDOR" = 1 ] && echo ../../tools/anaxi/skills/anaxi || echo "$RUN/skills/anaxi")" .claude/skills/anaxi; say "linked   .claude/skills/anaxi → skill"; fi
fi
if [ "$HOOK" = 1 ]; then
  if git rev-parse --git-dir >/dev/null 2>&1; then
    hook="$(git rev-parse --git-path hooks)/pre-commit"
    if [ -e "$hook" ]; then say "kept     $hook (you have one: add a line calling $RUN/tools/anaxi-ci.sh --fix)"
    else mkdir -p "$(dirname "$hook")"; cp "$METHOD/tools/hooks/pre-commit" "$hook"; chmod +x "$hook"; say "created  $hook (keeps $DOCS/INDEX.md fresh)"; fi
  else say "skipped  pre-commit hook (not a git repo; run git init, then anaxi-init again)"; fi
fi

# 4. first index and status
node "$RUN/tools/anaxi-check.mjs" index --dir . >/dev/null && say "indexed  $DOCS/INDEX.md"
echo
node "$RUN/tools/anaxi-check.mjs" status --dir .
if [ "$PLUGIN" = 1 ]; then cat <<EOF

Next (in Claude Code):
  1. Start a TDD:   ask "start a TDD for <feature> with anaxi", or add front matter to one you have
  2. See status:    /anaxi:status
  3. Assess a doc:  /anaxi:assess $DOCS/features/<name>.md
EOF
exit 0; fi
cat <<EOF

Next:
  1. Start a TDD:   node $RUN/tools/anaxi-check.mjs new <name> --title "Your feature"
                    (or add front matter to a TDD you already have: see $RUN/QUICKSTART.md)
  2. See nudges:    node $RUN/tools/anaxi-check.mjs nudges
  3. Or ask Claude: "assess $DOCS/features/<name>.md with anaxi"
EOF
