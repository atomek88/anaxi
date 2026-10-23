#!/usr/bin/env bash
# release: publish a new Anaxi version for plugin users.
#
#   tools/release.sh 0.9.0 [--push]
#
# Checks (selftest, the example's CI, plugin validation, a CHANGELOG entry for the version), sets the version in
# .claude-plugin/plugin.json, commits, and tags anaxi--v<version>. Users then get it with
# `claude plugin marketplace update anaxi && claude plugin update anaxi@anaxi` and a restart.
# You don't need this while developing: the ~/.claude/skills/anaxi link loads the working copy every session.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
V="${1:?usage: tools/release.sh VERSION [--push]}"; PUSH="${2:-}"
[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "release: version must be X.Y.Z" >&2; exit 2; }
[ -z "$(git status --porcelain)" ] || { echo "release: commit or stash your changes first" >&2; exit 2; }
grep -Eq "^## ($V|${V%.0})( |$)" CHANGELOG.md || { echo "release: add a '## $V' entry to CHANGELOG.md first" >&2; exit 2; }
node tools/selftest.mjs
bash tools/anaxi-ci.sh --dir example
node -e "const f='.claude-plugin/plugin.json',fs=require('fs'),j=JSON.parse(fs.readFileSync(f));j.version='$V';fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n')"
claude plugin validate . --strict
claude plugin validate .claude-plugin/plugin.json --strict
git commit -qam "Release $V" && echo "committed Release $V"
claude plugin tag . -m "Anaxi %s" ${PUSH:+--push}
