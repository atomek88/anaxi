---
anaxi: "@stages"
depth: D2
risk: 1·0·1·1
about: [visibility]
uses: ["@built", "@engine", "@reader", "@mcp"]
focus: now
built: yes (2026-11-09)
code: [../../../tools/lib/engine.mjs, ../../../tools/anaxi-check.mjs, ../../../tools/anaxi-mcp.mjs, ../../../tools/anaxi-watch.mjs, ../../../tools/watch/app.js, ../../../tools/watch/board.js, ../../../tools/watch/index.html]
---
# Lifecycle stages, a board, and the design runway

**Why.** To understand a project at a glance you need to see, across items, where the design is against the work.
Today each item has a depth and a built mark, but nothing puts them together, so "how many are ready, building,
drifting" means reading the whole status table.

**What.** Every item gets a stage, derived from its marks, never set by hand: idea (below D1), designing (below
target or open questions), ready (gate ready, not built), building (`built: partly`), built (`built: yes`, no drift),
drifting (built, with N23, or with drift on either side when @drift-both is on), superseded or retired. A line at the top of `status` and
`INDEX.md` ("2 designing · 1 ready · 1 building · 9 built · 1 drifting"); a board in the reader, a column per stage;
the stage in every `anaxi_status` row; `anaxi_board` for agents. The design runway is one number: items ready and not
built. Too few and builders will hit gates soon; too many and the design runs ahead of reality. Built-ahead items
(N24) are design debt and are counted too. Done when Anaxi's own docs show this line, with the phase 2 items as
designing, and the board renders the example.

**Shape.** `stageOf(model, it)` in the engine, next to `gate`, so every surface gets the same answer; `stages(model)`
counts them with the runway and debt. The reader gets a board page (`tools/watch/board.js`, cards with a depth bar and
the built icon, red where blocked), linked from the overview. Chosen over a stage mark people set (it would drift
from the marks it summarises) and over a kanban tool (Anaxi reads state, it doesn't track work, @progress).

**Highlights.** Decided on 2026-11-09: the board calls out where attention is needed and never blocks.
- Cards that wait on a person show `⚑ n` (@decided).
- Complex items show `◆`, for a risk sum of 6 or more, or a target of D4.
- Drifting cards show the drift size.

The overview's stage line ends with the same call-outs: `⚑ 6 for a person · ◆ 2 complex`. The runway's one nudge is
N28 (info): `runway 0: nothing is ready to build while 4 items are designing`.

## Open questions

- [x] D1 · What is the difference between an idea and a parked item? → decided: Tomasz Michalik 2026-11-09 (delegated in session: "go ahead … with your answers", recorded by the agent): an idea is below D1 and not `focus: later`; parked is `focus: later` below its target; nine stages (idea, designing, ready, building, built, drifting, parked, superseded, retired), with parked, superseded and retired folded on the board
- [x] D1 · (decide: person) Should the runway be judged before kinds of project (@project-kinds) set healthy bands? → decided: Tomasz Michalik 2026-11-07 (in session, recorded by the agent): show the number without judging it; one nudge only, when the runway is 0 while items are designing (builders will wait)
- [x] D2 · Unmarked items and sub-items? → decided: Claude (agent) 2026-11-09: unmarked counts as idea; sub-items have stages but show inside their parent's card
- [x] D2 · The JSON? → decided: Claude (agent) 2026-11-09: every item gains `stage` and `highlights: ["person", "complex", "drift"]`; `stages(model)` returns `{ counts: { idea, designing, … }, runway, debt, person, complex }`; `anaxi_board` returns that plus the cards per stage
