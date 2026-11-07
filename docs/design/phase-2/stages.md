---
anaxi: "@stages"
depth: D2
risk: 1·0·1·1
about: [visibility]
uses: ["@built", "@engine", "@reader", "@mcp"]
focus: now
built: no
code: [../../../tools/lib/engine.mjs, ../../../tools/anaxi-check.mjs, ../../../tools/anaxi-mcp.mjs, ../../../tools/watch/app.js, ../../../tools/watch/board.js]
---
# Lifecycle stages, a board, and the design runway

**Why.** To understand a project at a glance you need to see, across items, where the design is against the work.
Today each item has a depth and a built mark, but nothing puts them together, so "how many are ready, building,
drifting" means reading the whole status table.

**What.** Every item gets a stage, derived from its marks, never set by hand: idea (below D1), designing (below
target or open questions), ready (gate ready, not built), building (`built: partly`), built (`built: yes`, no drift),
drifting (built, with drift on either side, @drift-both), superseded or retired. A line at the top of `status` and
`INDEX.md` ("2 designing · 1 ready · 1 building · 9 built · 1 drifting"); a board in the reader, a column per stage;
the stage in every `anaxi_status` row; `anaxi_board` for agents. The design runway is one number: items ready and not
built. Too few and builders will hit gates soon; too many and the design runs ahead of reality. Built-ahead items
(N24) are design debt and are counted too. Done when Anaxi's own docs show this line, with the phase 2 items as
designing, and the board renders the example.

**Shape.** `stageOf(model, it)` in the engine, next to `gate`, so every surface gets the same answer; `stages(model)`
counts them with the runway and debt. The reader gets a board page (`tools/watch/board.js`, cards with a depth bar and
the built icon, red where blocked), linked from the overview. Chosen over a stage mark people set (it would drift
from the marks it summarises) and over a kanban tool (Anaxi reads state, it doesn't track work, @progress).

## Open questions

- [ ] D1 · What is the difference between an idea and a parked item? → proposed: an idea is below D1 and not `focus: later`; parked is `focus: later` below its target; so nine stages, with parked folded on the board
- [ ] D1 · (decide: person) Should the runway be judged before kinds of project (@project-kinds) set healthy bands? → proposed: show the number without judging it; one nudge only, when the runway is 0 while items are designing (builders will wait)
- [ ] D2 · Unmarked items and sub-items? → proposed: unmarked counts as idea; sub-items have stages but show inside their parent's card
