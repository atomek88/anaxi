---
anaxi: "@release"
depth: D2
risk: 1·1·0·0
about: [cli]
uses: ["@check"]
built: partly (2026-10-30)
code: [../../../tools/release.sh, ../../../.claude-plugin]
---
# Releasing the plugin

**Why.** Projects get Anaxi through the Claude Code plugin; a release that breaks the checker breaks every
project's hooks and CI at its next session.

**What.** `tools/release.sh <version> [--push]` needs a CHANGELOG entry for the version, runs the self-test, the
example's CI and the plugin validation, sets the version in `plugin.json`, commits, and tags `anaxi--v<version>`.
Users update with `claude plugin marketplace update anaxi && claude plugin update anaxi@anaxi`; on this machine
the plugin loads live from the repo through a symlink.

**Shape.** One script, no CI service: the checks are the ones that already run locally. The version lives only in
`plugin.json`; the changelog is the release notes. The risky part is that nothing is published yet: there is no
remote, so only this machine has 0.9.0.

- [ ] D2 · Where does the marketplace repo live (GitHub owner and name), and who can push a release tag?
