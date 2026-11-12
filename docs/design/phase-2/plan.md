---
anaxi: "@plan"
depth: D3
risk: 1·1·1·1
about: [progress, agents]
uses: ["@progress (D2)", "@stages", "@decided", "@skill"]
focus: now
built: yes (2026-11-12)
code: [../../../skills/plan/SKILL.md, ../../../skills/plan/PLAN.md, ../../../tools/lib/plan.mjs, ../../../tools/anaxi-check.mjs, ../../../tools/lib/engine.mjs, ../../../tools/lib/config.mjs]
---
# Build plans: the work, in its own docs

**Why.** Ready items say what must be true, not in what order to build them or what the steps are. Agents need a
sequenced list to work through, tick and resume from, and people need a record of how the build went. Writing that
into the design docs bloats them and churns the source of truth. A tracker isn't always there, and an agent's own
todo list dies with the session.

**What.** A plan is a markdown file in the plans folder, separate from the design. **The plan is the tracker**: it
holds the work for one or more ready items (order, slices, tasks, subtasks, files, breakpoints, ticks, and what was
found on the way). An external tracker is optional, for teams that already have one. A plan links to items by `@id`
and to criteria by `{#ac-id}`; it never restates the design. Agents tick the plan, not the item, in the same commit as
the code, so ticks add no commits. A finished plan is kept as history (`status: done`) and isn't edited again.
Done when `plan new` on the example's @recurring writes a skeleton with its criteria as tasks and a gate, and
ticking its tasks shows `▤ n/m` in status, with N30 once all are ticked.

Plans are for medium scope and up, roughly a week of work or more: several items, a `uses:` chain between them, or a ◆
complex item. Smaller work is built straight from its item: set `built:` and add any notes there. The person chooses
which items go in, and makes a new plan when the docs have moved on. Plans are never required.

What a plan finds that changes the design goes back to the item as a `→ proposed:` question (marked `↩ design` in
the plan), never edited into the item from the plan.

**Breakpoints are gates.** `🛑` tasks are sparse, placed where a gate should pass and be verified before going on: a
test gate (the item's `checks:` pass), a verification gate (a person or agent confirms a behaviour), an e2e gate
(Playwright in a browser, a device run for a mobile app), a deploy gate. The agent stops there, runs the gate, and ticks
it only when it passes. They are instructions to the agent, never commit hooks. A project may name its gates in
`anaxi.json` (`plan.gates`, a name and a command each); credentials stay in the environment, and a plan names the
variables it needs, never their values.

**Shape.** Two parts, one engine.
- `anaxi-check plan new` writes the plan's skeleton from the model, so nothing is re-typed: the order from `uses:` with
  the critical path and parallel lanes; "Slice 0" for shared items the others need; per item, its criteria as
  test-first tasks, files from `code:`, difficulty from `risk:`, and a gate breakpoint at the end.
- `/anaxi:plan` (the skill) has the agent decide whether a plan is worth it, cut it, then break each slice into tasks
  and subtasks from the item's D3 contract and D4 notes. The method is its own: outcome first, foundation first,
  vertical slices, test first, measurable criteria, and split a slice past about 10 tasks or 8 files. It doesn't use
  the separate complex-project-planner skill.
- `tools/lib/plan.mjs` parses plans for the engine: progress per item, two nudges, and plans in status, the board and
  the reader.

A plan never opens the gate; only an item's readiness does. Chosen over task lists in the item docs (bloat, the
reason for @progress) and over a computed-only plan (an agent can't tick it or resume from it). Sprints, estimates and
who builds what are an optional section, filled only when the person gives a team.

**Contract.** *Where.* `plan.dir` (default `plans`) under the docs root, beside `anaxi.json`. The design parser never
reads it. Files are `YYYY-MM-DD-<name>.md`.

*The file.*
```markdown
---
plan: "recurring"
items: ["@recurring", "@scheduler"]
status: active            # active | done | dropped
made: 3f2a91c             # the commit the design was read at
---
# Plan: Recurring tasks

**Outcome.** <one sentence>

## Order
@scheduler → @recurring (critical path) · lanes: 1

## Slice 0 · Foundation
## Slice 1 · @scheduler The scheduler · ②
> criteria: #ac-tick, #ac-catchup · files: src/scheduler/*.ts
- [ ] Write test: catch-up after downtime (#ac-catchup)
  - [ ] subtask
- [x] Implement the tick loop `src/scheduler/tick.ts`
- [ ] 🛑 gate unit: `npm test -- scheduler`

## Found on the way
- ↩ design @recurring: weekly rules need a timezone (proposed in the item)
```
- A slice is a `## Slice N · …` heading. Its item is the first `@id` in the heading; Slice 0 and slices with no `@id`
  count for the plan only.
- A task is any `- [ ]` or `- [x]` line, at any indent. A breakpoint is a task whose text starts with `🛑`.
- Everything else is free text and is ignored.

*Commands.*
- `anaxi-check plan new @a [@b …] [--name NAME] [--dry-run]` writes the skeleton and prints its path. Items that
  aren't ready get a `⏳ not ready: <why>` line in their slice; the plan is still written. It never overwrites a file.
  Exit 0, 1 for an unknown item, 2 when the plans folder can't be written.
- `anaxi-check plan [--all] [--json]` lists active plans (all with `--all`): name, status, items, and `done/total`
  tasks and breakpoints.
- JSON: `{ format, plans: [{ name, file, status, made, items, slices: [{ title, item, done, total, gates: { done,
  total } }], done, total }] }`.

*Config.* `plan: { dir: "plans", gates: {} }`, gates as `{ "unit": "npm test", "e2e": "npx playwright test" }`. The
skeleton uses `gates.unit` (or the item's `checks:`) for each slice's breakpoint and adds `gates.e2e` at the end when
it's set; otherwise the breakpoint says `🛑 gate: <how to verify>` for the agent to fill.

*The engine.*
- Items in an active plan gain `plan: { name, done, total }` in JSON, a `▤ 7/12` mark in status, and a badge on the
  board's card.
- `status` prints `▤ 1 plan active: recurring 7 of 12` under the stage line.
- **N30** (info): a plan is `done`, or all its tasks are ticked, while an item in it isn't `built: yes`. Anaxi
  suggests `built: yes`; a person or the building agent writes it.
- **N31** (info): an item in an active plan has commits to its doc since `made`, so the plan may be stale. It's one
  `git rev-list --count` per item, and silent without git.

## Open questions

- [x] D0 · (decide: person) Amend @progress: the plan doc is Anaxi's tracker, and an external tracker is optional; the design docs still hold no tasks. Confirm? → decided: Tomasz Michalik 2026-11-12: yes (your words 2026-11-12: "why isn't the plan doc the tracker?")
- [x] D1 · (decide: person) When is a plan needed? → decided: Tomasz Michalik 2026-11-12: for medium scope, about a week of work or more; never required; smaller work is built straight from its item (your words 2026-11-12)
- [x] D1 · (decide: person) Where do breakpoints go? → decided: Tomasz Michalik 2026-11-12: sparse, only where a gate should pass and be verified (test, verification, e2e, deploy); per-project gates and credentials are named in config and the environment, not built further now (your words 2026-11-12)
- [x] D1 · (decide: person) The existing complex-project-planner skill? → decided: Tomasz Michalik 2026-11-12: keep it as it is; `/anaxi:plan` is a new, self-contained skill with its own method and template and no dependency on it (your words 2026-11-12)
- [x] D2 · Plan file names, place and front matter? → decided: Claude (agent) 2026-11-12: `plans/YYYY-MM-DD-<name>.md` under the docs root, with `plan:`, `items:`, `status:`, `made:`; written above
- [x] D2 · Which parts of the planner template go in the plan template? → decided: Claude (agent) 2026-11-12: keep slices, tasks, files with line ranges, gate breakpoints, the order and lanes, risks per item, deploy steps; drop the legend (it lives in the skill), context and stack (links to items and @stack), the two checkbox symbols (plain `- [ ]`), the "don't change the structure" rule and the coverage figure
- [x] D3 · The contract: the plan file, `plan new` and `plan` commands, config, N30 and N31 → decided: Claude (agent) 2026-11-12: written above
