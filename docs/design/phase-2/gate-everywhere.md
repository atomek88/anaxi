---
anaxi: "@gate-everywhere"
depth: D2
risk: 2·1·1·0
about: [enforcement]
uses: ["@hard-gate", "@code-map", "@check"]
focus: now
built: no
code: [../../../tools/anaxi-check.mjs, ../../../tools/anaxi-ci.sh, ../../../tools/hooks/pre-commit, ../../../tools/anaxi-init.sh, ../../../tools/ci/]
---
# The gate everywhere (commit and merge)

**Why.** The hard gate is a Claude Code hook. Cursor, Codex and people editing by hand never meet it, and the
pre-commit hook only runs when markdown changes. A gate that one tool honours is advice for everyone else.

**What.** The rule is one function, `gateFor(model, file)`, asked at four moments: advice (the skill, NOT READY in
tool results), edit time (the Claude Code hook; other tools where they offer a pre-edit hook), commit time (every
commit, every tool on that machine, skipped only by `--no-verify`) and merge time (a pull request's required check:
everyone, every tool, lifted only with repo permissions). Code written against the gate can exist on a branch; it
can't land. Branches matching `gate.spikeBranches` (default `spike/*`) skip it, and can't merge into the main branch
with held files, so exploring stays free. Lifting it is a person's act at every layer: editing `anaxi.json`, or a
maintainer's override on the PR. Shared code a built item maps is never held (decided 2026-11-07, built in 0.11), and
a path a ready item plans is open to it. Done when a commit and a PR that add a file under an unready item's planned
`code:` both fail with the same reasons the hook gives, and a spike branch commits freely.

**Shape.** One command, `anaxi-check gate-files [--staged | --since <ref> | <files…>]`, exits 1 listing each held
file, its items and what's missing; it calls `gateFor` and nothing else, so it can't disagree with the hook. The
pre-commit hook runs it on staged non-markdown files on every commit; `anaxi-ci.sh --pr <base>` runs it on the files a
PR changes; `/anaxi:init --ci github` writes a workflow that does. Chosen over a server-side hook (not every forge
has one) and over checking in the editor only (the problem). The risky part is speed on every commit, so only
staged files that some item maps are checked, and the model is built once.

## Open questions

- [ ] D1 · (decide: person) A feature that only changes existing shared code now holds nothing. Is a note enough? → proposed: yes: the code-map note at edit time (built) and one line in the pre-commit output; never a block, since blocking shared code is the freeze we just removed
- [ ] D2 · (decide: person) Start the merge-time override with GitHub only? → proposed: yes, a PR label `anaxi: override` read from the event payload; any other CI sets `ANAXI_OVERRIDE=1`, so it can be wired anywhere
- [ ] D2 · On a PR, is the design read from the PR itself or from the base branch? → proposed: from the PR, so design and code can land together; @decided keeps a PR from ticking a person's question itself
- [ ] D2 · How fast must the pre-commit check be? → proposed: under 0.3 s for 200 items; measure on a generated project before release
- [ ] D2 · Adapters for other agent tools' pre-edit hooks? → proposed: not in this item: research which tools offer one and write each as its own item; commit and merge cover them meanwhile
- [ ] D3 · The contract: `gate-files` output and exit codes, the workflow file, the override's exact form
