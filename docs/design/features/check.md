---
anaxi: "@check"
depth: D3
risk: 2·2·0·0
about: [cli]
uses: ["@engine"]
parts:
  - "../../../tools/SPEC.md#1-anaxi-checkmjs (D3)"
  - "../../../tools/SPEC.md#11-anaxi-cish (D3)"
  - "../../../tools/SPEC.md#6-exit-codes (D3)"
  - "../../../tools/SPEC.md#7-plugin-hooks (D3)"
built: yes (2026-10-30)
code: [../../../tools/anaxi-check.mjs, ../../../tools/anaxi-ci.sh, ../../../hooks]
---
# The checker (`anaxi-check`)

**Why.** People and CI need the engine's answer in a terminal and on every commit, without an agent in the loop.
A design that only an agent can read is not reviewable.

**What.** Commands: `status`, `nudges`, `gate`, `questions`, `context`, `uses`, `index`, `check`, and the
lifecycle commands (`supersede`, `retire`, `archive`, `delete`, `restore`), each with `--json`. `anaxi-ci.sh`
fails a build on errors or a stale index; the plugin's hooks show status at session start and after an edit.
Exit codes are part of the contract. Out of scope: editing an item's content.

**Shape.** One CLI over @engine: text for people, `--json` for tools. A generated `INDEX.md` committed next to
the docs, checked in CI with `index --check`, chosen over rendering on demand because the index is what a reader
on GitHub sees. Lifecycle commands change files, so the skill says what it will run before running it. The risky
part is the output: CI scripts and hooks parse it, so changing a column or an exit code breaks them.

Contracts: [tools/SPEC.md](../../../tools/SPEC.md) §1, §1.1, §6 and §7.
