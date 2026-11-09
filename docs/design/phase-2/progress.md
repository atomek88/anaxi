---
anaxi: "@progress"
depth: D2
risk: 1·1·1·1
about: [progress]
uses: ["@built", "@stages"]
focus: next
built: no
code: [../../../tools/lib/evidence.mjs, ../../../tools/adapters/, ../../../tools/anaxi-check.mjs]
---
# Progress: what must be true in the docs, the work in a tracker

**Why.** "Built partly" is too coarse to show progress, but cataloguing every task and subtask in the design docs
would bloat them, and docs rot fastest where they track fast-moving state. Trackers are built for that; Anaxi's job
is the relation between the work and the design, not a second tracker.

**What.** The docs hold what must be true: acceptance criteria (already D1 design content) and `built:` with its
checked day. A tracker holds the work: tasks, subtasks, estimates, who does what. Anaxi reads the link. An acceptance
criterion may name what shows it (`→ checks: tests/recurring.spec.ts "four occurrences"`), so progress becomes "4 of
6 criteria shown", from the repo, and "4 of 6 passing" with a test report configured; N27 for a built item with a
criterion nothing shows. When every criterion is shown, Anaxi suggests `built: yes`. Issues, PRs and commits link
to items by `@id` (a label, the title, or a trailer `Anaxi: @recurring`); the baseline reads only git, and tracker
adapters (GitHub Issues, Linear) are optional and read-only. `anaxi-check export-tasks @id --to github` turns an
item's criteria into issues once, after which the tracker owns them. A planner for projects without a tracker would
be a separate tool on the same engine, not core Anaxi. Done when the example's @recurring shows criteria with
evidence and the progress line, from git alone.

**Progress as a whole.** Decided on 2026-11-09: progress is read across the whole project, not item by item. One
line in `status`, `INDEX.md` and the reader puts the stages (@stages) together with the criteria shown, built items
and drift: `14 items · 9 built (2 drifting) · criteria 31 of 40 shown · ⚑ 6 for a person`. When it's wrong, because
work is done but nothing links it, the fix is an instruction, not bookkeeping. The user asks an agent to map the
project in (@adopt): it reads the code, the tests, the tracker and the git log, and proposes `checks:`, `code:` and
`Anaxi: @id` links on the items as proposals that a person accepts. The holistic line is computed; nobody keeps it.

**Shape.** `tools/lib/evidence.mjs` parses criteria and their `checks:`, finds the tests, and reads a JUnit report
if one is configured; adapters live in `tools/adapters/`, one file per tracker, each a function from a token and an
`@id` to links and states. Chosen over task lists in the docs (bloat, the reason for this item) and over writing
progress back into markdown (state the docs shouldn't hold).

## Open questions

- [x] D0 · (decide: person) Keep progress out of the docs: they hold acceptance criteria and `built:`; the tracker holds the work. Confirm? → decided: Tomasz Michalik 2026-11-07 (in session, recorded by the agent): yes; you leaned this way on 2026-11-07
- [x] D1 · (decide: person) Should Anaxi ever write `built: yes` itself from evidence? → decided: Tomasz Michalik 2026-11-07 (in session, recorded by the agent): never; it suggests, a person or the building agent writes it
- [x] D2 · Criterion syntax and stable ids? → decided: Claude (agent) 2026-11-09: acceptance bullets get an optional `{#ac-weekly}` id and `→ checks: <path> "<test name>"` at the end
- [x] D2 · Which test reports? → decided: Claude (agent) 2026-11-09: JUnit XML first (most runners write it), TAP later
- [x] D2 · (decide: person) Tracker adapters need tokens. → decided: Tomasz Michalik 2026-11-09 (delegated in session: "go ahead … with your answers", recorded by the agent): read-only, from environment variables only (`GITHUB_TOKEN`, `LINEAR_API_KEY`), never stored, logged or sent anywhere but that tracker; git trailers need none, so the holistic line works with no token
- [x] D2 · Export: how safe? → decided: Claude (agent) 2026-11-09: one way, once per criterion, `--dry-run` by default
