---
anaxi: "@init"
depth: D1
risk: 1·0·0·0
about: [cli]
uses: ["@check"]
built: yes (2026-10-30)
code: [../../../tools/anaxi-init.sh, ../../../skills/init]
---
# Setting up a project (`/anaxi:init`)

**Why.** If starting takes more than a minute, nobody tries it on a real project. Most of the value shows up only
after the first few items are tagged.

**What.** `/anaxi:init` (or `tools/anaxi-init.sh`) sets up one design folder, `docs/design/` by default: `anaxi.json`
with a profile and stage, an `anaxi-questions.md`, a first shared item `@stack`, and the index, plus a pre-commit hook
that keeps the index fresh. Nothing outside the folder changes; the tools find it from the repo root.
Nothing is vendored when the plugin is installed. Running it twice changes nothing it already wrote. Out of scope:
tagging existing docs, which the skill does with the user (procedure 2).
