---
anaxi: "@drift-both"
depth: D3
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

**Contract.** *Marks.* `built: no | partly | yes [(YYYY-MM-DD[, agent])]`; `, agent` means an agent checked it last.
`contract: [paths]` is optional, and each entry must equal or sit under a `code:` entry (`check` warns otherwise).
*Baseline.* The commit that last changed the item's `built:` line (`git blame --porcelain -L`). If that line isn't
committed, the baseline is the end of the day it names. With no day and no commit, there's no drift, only N23 as it is
today. *Design side.* Commits after the baseline that touch the item's file, plus uncommitted changes to it. A part
(`parts: [file#anchor]`) counts only when a change touches the lines from its heading to the next heading at the same
or a higher level: `git log -L <start>,<end>:<file>` for commits, `git diff -U0` hunks for uncommitted changes.
*Code side.* `git log --numstat <baseline>..HEAD` over the code paths, plus `git diff HEAD --numstat`. A commit with
an `Anaxi: no-design-impact` trailer is left out (`Anaxi: no-design-impact @a @b` leaves it out for those items
only). Test files count. Globs in `nudges.drift.ignore` are left out.
*Thresholds.* Settings: `nudges.drift: { commits: 5, lines: 200, ignore: [] }`. The code side is over the threshold
at `commits ≥ 5` or `added + removed ≥ 200`, or on any counted change to a `contract:` path.
*Nudges.*
- Design side only: N23, as today but measured from the baseline.
- Code side over the threshold: N26 (warn), `code moved since checked 2026-10-31: 12 commits, +340 −90 in
  src/recurring/ → check the design still holds, then anaxi-check verify @recurring; or update the design`. A
  contract change adds `, including its contract (src/recurring/rules.ts)`.
- Both sides: one N26, `design and code both changed since checked 2026-10-31 (…): reconcile them, then verify`.

*JSON.* Every built item gets `drift: { side: "none"|"design"|"code"|"both", since: { commit, day, by:
"person"|"agent" }, design: { commits }, code: { commits, added, removed, files, contract, skipped }, over }`.
`files` holds at most 10 entries; `skipped` lists the commits left out by the trailer. `status` shows `Δ12c` after
the built icon whenever the code side has commits, and `↯` when `over` is true.
*Commands.*
- `anaxi-check drift [@id | --all] [--json] [--fail]` prints that block per item. It exits 0, or 1 with `--fail`
  when any item is over the threshold.
- `anaxi-check verify @id [--by agent] [--dry-run] [--json]` rewrites only the `built:` mark, to today's local day,
  keeping the state. `--by agent` writes `, agent`; a verify without it drops `, agent`. It prints `built: yes
  (2026-10-31) → built: yes (2026-11-09)` and the drift it clears. It exits 0 when written, and 2 for an item with no
  `built:` or with `built: no`.

The skill and `anaxi_verify` always pass `--by agent`. *Pre-commit.* On every commit: staged non-markdown files →
items through the code map → built items whose file and part files aren't staged → one line each on stderr:
`anaxi: rules.ts changes @recurring (built yes, checked 2026-10-31) without its design; if the design still holds,
add "Anaxi: no-design-impact" to the message, else update features/recurring-tasks.md`. This never fails the commit.
*CI.* With `ci.sameChange: true`, `anaxi-ci.sh --pr BASE` exits 1 when the PR's counted commits change a built item's
code and don't touch its file. The default is off. `anaxi_status` rows carry `drift`.

## Open questions

- [x] D1 · (decide: person) May an agent settle drift (run `verify`, write the `no-design-impact` trailer), or only a person? → decided: Tomasz Michalik 2026-11-07 (in session, recorded by the agent): an agent may, and it's recorded: an agent's `verify` writes `built: yes (2026-11-07, agent)`, status and the reader show agent-checked items apart, and a person's check replaces it. Anyone may write the trailer; `anaxi-check drift` lists those commits (`since` later, @time-machine)
- [x] D2 · (decide: person) Add the `contract:` mark, a subset of `code:` where any change warns? → decided: Tomasz Michalik 2026-11-07 (in session, recorded by the agent): yes, optional; the cheapest signal that the D3 text is wrong, and most items won't need it
- [x] D2 · The baseline is a day, so code changed later that same day is missed. → decided: Claude (agent) 2026-11-09: the commit that last changed the `built:` line is the exact baseline; the day is for people, and is used only while that line isn't committed
- [x] D2 · Default threshold, and do test files count? → decided: Claude (agent) 2026-11-09: 5 commits or 200 changed lines, whichever comes first; tests count; `nudges.drift.ignore` takes globs; counts always show, the warning waits for the threshold
- [x] D2 · Per-section drift for parts now, or later? → decided: Claude (agent) 2026-11-09: now, for parts only (heading range, `git log -L`); it fixes the four false N23s on Anaxi's own docs
- [x] D3 · The contract: N26's message and JSON, `verify`'s output and exit codes, the pre-commit warning's text → decided: Claude (agent) 2026-11-09: written above
