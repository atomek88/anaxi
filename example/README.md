# Example: TaskFlow

A small project using the `mobile` profile at the `pre-build` stage ([anaxi.json](anaxi.json)), with its own
questions ([anaxi-questions.md](anaxi-questions.md)) and an index ([INDEX.md](INDEX.md)). It deliberately mixes
every way of marking up an item ([../FORMAT.md](../FORMAT.md)):

| File | Item | Declared with | Shows |
|---|---|---|---|
| [features/recurring-tasks.md](features/recurring-tasks.md) | @recurring | **front matter**; an ordinary TDD layout | headings mapped to levels, a question checklist, a canvas; blocked, claim unsupported, over-engineered, out of focus |
| [shared/scheduler.md](shared/scheduler.md) | @scheduler | **tag line** | go deeper, open question, a project question unanswered; two items wait on it |
| [shared/task-api.md](shared/task-api.md) | @task-api | **tag line** | enough: D3 🎯, with caveats and a `later:` |
| [shared/stack.md](shared/stack.md) | @stack, and a sub-item | **tag line**, and a **heading badge** on the sub-item | where libraries and frameworks are documented; a sub-item inheriting its parent's answers |
| [features/settings-screen.md](features/settings-screen.md) | @settings | **HTML comment** | over-documented for its risk |
| [features/multi-calendar.md](features/multi-calendar.md) | @multi-calendar | **tag line** | over-documented for the plan (`focus: later`) |
| [features/APPENDIX.md](features/APPENDIX.md) | part of @recurring | **`part-of:`** tag line | detail kept out of the TDD, counted as @recurring's own |

`INDEX.md` is generated (`node ../tools/anaxi-check.mjs index`, run from this folder). The output below is
real script output, followed by what the skill adds after reading the content.

## Nudges

```
$ node ../tools/anaxi-check.mjs nudges
⏸️  @multi-calendar  Multiple calendars
    features/multi-calendar.md:3 · depth D3 · target D4 (now D1) · risk 2·1·2·2
    waits on    uses @scheduler, which is at D2 of its target D3 (N02)
    trim        at D3, but focus: later caps it at D1 for now: over-documented (N06)
    → Next: stop writing; trim back to the target, or re-score if the risk is higher.

⛔  @recurring  Recurring tasks
    features/recurring-tasks.md:1 · depth D2 · target D3 · risk 2·1·1·1 · parts in features/APPENDIX.md
    blocked     uses @scheduler, which is at D2 of its target D3 (N02)
    open        2 to answer (N03):
                • D2 · Do paused series still count toward the daily nudge cap?
                • D3 · Which time zone does a recurrence follow when the user travels?
    go deeper   D2 → D3. Answer these for D3 (N01):
                • D3.contracts · For every boundary, what crosses it, in exactly what shape, and
                  what must stay compatible?
                • D3.failure · What can go wrong at each boundary, and what does each side do then?
    → Next: wait for @scheduler, or help take it deeper; then answer the open questions, or move
      them to later: with a trigger.

✂️  @settings  Settings screen
    features/settings-screen.md:3 · depth D4 · target D1 · risk 0·0·1·0
    trim        at D4, but risk 0·0·1·0 gives target D1: over-documented (N06)
    → Next: stop writing; trim back to the target, or re-score if the risk is higher.

⬇️  @scheduler  Scheduler
    shared/scheduler.md:3 · depth D2 · target D3 · risk 2·1·1·1
    open        1 to answer (N03):
                • what the planner does with a task whose deadline has already passed
    go deeper   D2 → D3. Answer these for D3 (N01):
                • D3.contracts · For every boundary, what crosses it, in exactly what shape, and
                  what must stay compatible?
                • D3.failure · What can go wrong at each boundary, and what does each side do then?
    → Next: answer the open questions, or move them to later: with a trigger; then write the D3
      answers under your own headings, then set depth: D3.

🎯  @stack  Stack
    shared/stack.md:3 · depth D2 · target D2 · risk 2·1·0·0
    enough      D2 🎯 enough (N04)
    → Next: stop: this is designed enough.

🎯  "Upgrade policy"  Upgrade policy
    shared/stack.md:24 · depth D2 · target D2
    enough      D2 🎯 enough (N04)
    → Next: stop: this is designed enough.

🎯  @task-api  Task API
    shared/task-api.md:3 · depth D3 · target D3 · risk 2·2·0·0
    enough      D3 🎯 enough. Caveats: no batch submit (N04)
    → Next: stop: this is designed enough.
```

The skill then reads the content and adds the nudges that need judgment:

```
@recurring
  N05 warn   claims D2, but D2.decisions is half answered (decisions, but no riskiest part)
  N08 warn   "Rule grammar" designs RRULE parsing, which is in later:
  N07 warn   "pluggable RecurrenceRule interface" for the two rule types in scope
  (the sequence diagram and the "suggest recurring" idea are in the canvas: no nudges)

@scheduler
  N05 warn   claims D2, but D2.decisions and the project question on calendar quotas
             (when: integration) aren't answered
```

## What each mark contributed

- **Recurring tasks** needed no restructuring. "Context and goals" and "Non-goals" read as D0, "Requirements"
  and "Dependencies" as D1, "Proposed design" as D2, "Open questions" as its checklist, and "Appendix:
  sketches" as its canvas.
- **Project questions** came in where they apply. Recurring tasks is `about: ui`, so it had to answer
  `D1.offline` and `D1.in-progress` (it does). Scheduler is `about: integration`, so it gets the calendar
  quota question (it doesn't answer it yet).
- **Upgrade policy** is a two-line sub-item with only a badge. It inherits its why and scope from @stack.

## Gates

```
$ node ../tools/anaxi-check.mjs gate @task-api
N09 READY    @task-api — D3 🎯, nothing open, every use deep enough
$ node ../tools/anaxi-check.mjs gate @recurring
N09 BLOCKED  @recurring — D2 → D3 · 2 open · @scheduler at D2 of D3
$ node ../tools/anaxi-check.mjs gate @multi-calendar
N09 BLOCKED  @multi-calendar — D3 → D4 (the full target applies to the gate) · @scheduler at D2 of D3
```

## What the team does next

1. The scheduling owner names the risky part and the quota limits, takes @scheduler to D3, and answers its open
   question. That unblocks @recurring.
2. The @recurring author names the risky part (DST and month-end dates are the obvious candidates), answers the
   nudge-cap question, moves "Rule grammar" to `later:` as one line, replaces the pluggable interface with the
   two rules in scope, and writes the API, data model and failure modes.
3. @settings is cut back to its why and what. The code goes to the implementer's branch, not the doc.
4. @multi-calendar keeps its why and what; the sync contract moves to its canvas until the item is `focus: now`.
5. Nobody touches @task-api or @stack. They are enough.
