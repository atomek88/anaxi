---
anaxi: "@release"
depth: D2
risk: 1·1·0·0
about: [cli]
uses: ["@check"]
built: yes (2026-10-31)
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
`plugin.json`; the changelog is the release notes. The repo is published at github.com/atomek88/anaxi (`claude plugin marketplace add atomek88/anaxi`);
`--push` sends the tag there. The risky part is a release pushed without the checks, which the script makes the
only way to tag.

- [x] D2 · Where does the marketplace repo live (GitHub owner and name), and who can push a release tag? → github.com/atomek88/anaxi; the owner pushes release tags, with `tools/release.sh <version> --push` (2026-10-31)
