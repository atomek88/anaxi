---
anaxi: "@drift-both"
depth: D2
risk: 2·1·1·1
about: [living-docs]
uses: ["@built", "@engine", "@check"]
focus: now
built: no
code: [../../../tools/lib/git.mjs, ../../../tools/lib/engine.mjs, ../../../tools/anaxi-check.mjs, ../../../tools/hooks/pre-commit]
---
# Drift in both directions

**Why.** Docs usually go stale because the code moves on and nobody touches the doc. Today N23 fires only when the
design changed after the code (`builtNudges` returns when `docT <= codeT`), so an item marked `built: yes` can take
40 commits of code and still show ✓. Living docs need to stay in step whichever side moved.

**What.** A built item has one baseline, the day it was last checked (`built: yes (2026-10-31)`). Everything that
changed after it is drift: the design changed (the code may need to follow, N23 as now), the code changed (the
design may need to follow, N26, new: "12 commits, +340 −90 in `src/recurring/` since checked"), or both (one
warning: reconcile). The same act settles any of them: someone checks the two still agree and writes the day
(`anaxi-check verify @id`, or an agent through @reverify), or edits the side that's behind. The code side is
measured, not just flagged: commits and lines since the baseline always show; a warning only past a threshold; an
optional `contract:` subset of `code:` warns on any change; a commit trailer `Anaxi: no-design-impact` leaves a commit
out. It works for every tool because the engine computes it from git: status, CI, the reader, MCP. The pre-commit
hook warns when a built item's code changes without its doc, and CI can require a PR to touch the doc, the day, or
carry the trailer (`ci.sameChange`). Done when an item whose code moved past the threshold shows N26 in status, the
index, the reader and `anaxi_status`, and `verify` clears it. Out of scope: judging whether a change matters; that's
the person or agent who checks.

**Shape.** History moves out of the engine into `tools/lib/git.mjs` (the clock, commit counts and line stats per
path set since a time, the commit that last changed a line), shared with @time-machine and @reverify. The engine
keeps the rule: `builtNudges` compares both sides against the baseline and adds N26. `anaxi-check verify @id
[--by agent]` is the only writer: it rewrites the item's `built:` mark with today's day. The pre-commit hook gains
one step (staged files → items via the code map → a warning for built items whose doc isn't staged). Chosen over
counting only commits (a one-line rename and a rewrite look the same) and over per-commit review (too much noise).
The risky part is noise: per-file drift already fired falsely four times on Anaxi's own docs (an edit to SPEC.md
outside an item's section counted for it), so per-section drift for parts is part of this item.

## Open questions

- [ ] D1 · (decide: person) May an agent settle drift (run `verify`, write the `no-design-impact` trailer), or only a person? → proposed: an agent may, and it's recorded: an agent's `verify` writes `built: yes (2026-11-07, agent)`, status and the reader show agent-checked items apart, and a person's check replaces it. Anyone may write the trailer; `anaxi-check since` lists those commits
- [ ] D2 · (decide: person) Add the `contract:` mark, a subset of `code:` where any change warns? → proposed: yes, optional; the cheapest signal that the D3 text is wrong, and most items won't need it
- [ ] D2 · The baseline is a day, so code changed later that same day is missed. → proposed: keep the day in the text for people; the engine takes the commit that last changed the `built:` line (git blame) as the exact baseline, and the day only while that line isn't committed
- [ ] D2 · Default threshold, and do test files count? → proposed: warn at 5 commits or 200 changed lines, whichever comes first; tests count (a changed test usually means changed behaviour); `nudges.drift.ignore` takes globs
- [ ] D2 · Per-section drift for parts now, or later? → proposed: now, for parts only: a part's heading range in its file, through `git log -L`; whole files stay per file
- [ ] D3 · The contract: N26's message and JSON (`drift: { side, commits, added, removed, since }`), `verify`'s output and exit codes, the pre-commit warning's text
