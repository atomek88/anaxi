---
name: plan
description: Plan the build of ready Anaxi items as a sequenced, tickable build plan (slices, tasks, subtasks, gate breakpoints) kept beside the design, never in it. Use when asked to plan, sequence or break down work that Anaxi docs describe ("plan the build of @x", "what order do we build these in?", "break this into tasks", "let's execute phase 2"), when resuming an active plan, and when ticking work done against one.
argument-hint: "[@id …] [--name NAME] | resume [NAME]"
allowed-tools: Bash(node *), Read, Grep, Glob, Edit, Write
---

# Anaxi build plans

The design docs say what must be true. A **plan** says in what order to build it and what the steps are, and it is
the tracker: the agent ticks it as the code lands, and a finished plan stays as the record of how the build went.
Plans live in `plans/` beside `anaxi.json` (`plan.dir`), are plain markdown, and are never read as design.

```bash
CHECK="${CLAUDE_PLUGIN_ROOT}/tools/anaxi-check.mjs"   # or tools/anaxi/anaxi-check.mjs when vendored
node "$CHECK" status                                  # stages, runway, active plans (▤)
node "$CHECK" plan [--all]                            # plans and their ticks
node "$CHECK" plan new @a @b --name NAME [--dry-run]  # the skeleton, from the design
node "$CHECK" context @a                              # the item's contract and what it uses, for the breakdown
```

## 1. Is a plan worth it?

A plan is for **medium scope and up: roughly a week of work or more**. Signs: several items, a `uses:` chain between
them, a ◆ complex item, or one item whose contract spans several modules. For anything smaller, don't plan: build
straight from the item, set `built:`, and add any notes to the item. Say which you chose and why in one line; the
person can overrule it. A plan is never required, and never opens the gate: an item's code stays held until the item
is ready, plan or not.

## 2. Choose the items with the person

Start from `status`: ready items (the runway) first, plus anything they `uses:` that isn't built. Propose a set that
delivers one outcome a user would notice, and confirm it before writing. If an item in the set isn't ready, say
what it waits on; the skeleton marks it `⏳ not ready` and its slice waits.

## 3. Cut the skeleton, then fill it

Run `plan new` with the chosen items. It writes, from the design, so nothing is re-typed:
the order (waves, the critical path, parallel lanes), Slice 0 for shared items, and per item a slice with its
acceptance criteria as test-first tasks, its files, a difficulty badge from `risk:`, a step for each risk factor
scored 2, a contract-first step for each item it uses in the plan, and a gate breakpoint.

Then fill each slice from `context @id` (the D3 contract and D4 build notes). The method:
1. **Outcome first.** Write the plan's one-sentence outcome: what is true for the user when it's done.
2. **Foundation first.** Slice 0 holds what every other slice needs (shared items, @stack changes, migrations,
   config). Write "nothing" if nothing; never invent architecture to fill it.
3. **Vertical slices.** Each slice delivers something testable end to end, not a layer. One item is usually one
   slice; split an item into slices only where its contract has a natural seam.
4. **Test first.** Each slice starts with its `Write test:` tasks, one per criterion. A criterion you can't write a
   test for isn't measurable yet: send it back to the item (step 5), don't paper over it.
5. **Tasks are actions with exact paths**: `Implement the tick loop \`src/scheduler/tick.ts\``, with line ranges for
   large files (`api.ts:120-180`). Subtasks indent two spaces under their task, and only where a task has real steps.
6. **Size check.** A slice past about 10 tasks or 8 files is two slices. A task you can't describe in one line is a
   slice.
7. **Order inside a slice**: tests → core → supporting code → migrations → the gate.
8. **Nothing the design doesn't say.** A gap in the design is a finding (step 5), never a guess written into the
   plan. Choices the design leaves open at D4 (a helper's name, a file's place) are yours to make.

Optional sections, only when they carry something: `## Risks` (per item, from its risk factors, with the mitigation),
`## Deploy` (prerequisites, sequence, how to verify), `## Team` (who builds which slice and rough sizes, only when the
person gives a team; Anaxi doesn't estimate).

## 4. Breakpoints are gates

A breakpoint is a task that starts with `🛑`, placed **only where a gate should pass and be verified** before going
on, so they're sparse: usually one at the end of a slice and one or two in `## Finish`. Kinds:
- **test gate**: the slice's tests pass (`🛑 gate unit: \`npm test -- scheduler\``);
- **verification gate**: a behaviour is confirmed by hand or by the agent (`🛑 gate verify: the sheet says "repeats
  every Monday"`);
- **e2e gate**: the flow works for real, in a browser with Playwright or on a simulator or device for a mobile app
  (`🛑 gate e2e: \`npx playwright test recurring\``);
- **deploy gate**: it runs in staging or behind a flag (`🛑 gate deploy: a day on staging, no duplicates in the logs`).

A project can name its gates in `anaxi.json` (`"plan": { "gates": { "unit": "npm test", "e2e": "npx playwright test" } }`)
and the skeleton uses them. Gates that need credentials or an environment name the variables (`STAGING_URL`,
`TEST_USER_TOKEN`) and never their values; the agent asks for what it doesn't have.

At a breakpoint: **stop, run the gate, and tick it only when it passes.** If it fails, fix it within the slice; if it
can't pass without changing the design, that's a finding (step 5). Breakpoints are instructions to you, not commit
hooks: they never stop a commit.

## 5. Building against the plan

- Work in order; parallel lanes may go at once. Before a slice, re-read its item with `context @id`.
- **Tick in the same commit as the code** (`- [ ]` → `- [x]`), so ticks add no commits. Add a task you discover where
  it belongs, unticked; don't rewrite finished ones.
- **What changes the design goes back to the item**, never into it from the plan: add the question to the item as an
  unchecked line with `→ proposed: …`, and note it in the plan under `## Found on the way` as `↩ design @id: …`. A
  person's decision stays theirs (`! anaxi-check decide …`).
- When every task of an item's slice is ticked and its criteria hold, suggest `built: yes (<day>)` on the item (a
  person or the building agent writes it). `N30` says so when a plan is finished and an item isn't built.
- `N31` says an item's design changed since the plan was made (`made:`): re-read the item and adjust the plan's
  unticked tasks, or cut a new plan.
- When the plan is done, set `status: done` and leave it: it's history. A plan that won't be finished is
  `status: dropped`, with one line saying why.

## Resume

`/anaxi:plan resume [NAME]`: run `plan`, open the active plan, read `## Found on the way`, check N30 and N31 in
`nudges --all`, then carry on from the first unticked task.

## The file

`PLAN.md` beside this skill is the template, with every section. Front matter: `plan:` (its name), `items:`,
`status: active | done | dropped`, `made:` (the commit the design was read at). Slices are `## Slice N · @id Title`;
a task is any `- [ ]` / `- [x]` line; the rest is free text.
