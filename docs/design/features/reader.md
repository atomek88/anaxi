---
anaxi: "@reader"
depth: D3
risk: 1·1·2·0
about: [ui]
uses: ["@engine"]
later: search, a static export, per-item git history (when a pilot asks for them)
parts:
  - "../../../tools/SPEC.md#82-anaxi-watch (D3)"
built: yes (2026-10-31)
code: [../../../tools/anaxi-watch.mjs, ../../../tools/watch]
---
# The reader (`anaxi watch`)

**Why.** Reading a design at the right depth, and seeing what an item is connected to, took a file per item and
a scroll each. Nobody reads a design that way twice.

**What.** A local, read-only page that reloads on save: an overview grouped by what needs attention, topic pages,
an item page in three panes (a file tree with lines to connected files, the doc with deeper levels folded to one
line each, a minimap of its levels with uses and used-by as branches), and a 2D map. Hovering a name previews
it; keys `0`–`4` set the depth. **Which levels are open when an item page opens:** the reading depth is `?at=N`
in the link when there is one (the depth buttons, the keys and the pager set it), else the item's claimed `depth:`
(D0 when it has none). Every level up to it is open, each deeper level is one folded line, the canvas and the decision
log are always folded, and text before any level is always shown. A level the claim or the target needs with nothing
written shows as a red "nothing written yet" line where it would be. Unfolding one by hand, from the outline or a parts
chip opens it and every level before it; it stays open across live reloads and visits to other items, until the
browser page itself is reloaded. Out of scope: editing, which stays in the editor or with an agent.

**Shape.** A zero-dependency Node server (`tools/anaxi-watch.mjs`) serves one model (`/api/model`) and a static
page (`tools/watch/app.js`); server-sent events say when to reload. Linked pages plus a 2D depth-bar map won a
throwaway exploration on the example's real data; the 3D layer stack hid items at 7, and the city's labels
collided at 7. The risky part is size: past 25 files the tree shows only connected files, and the minimap folds
past 6 per side; neither is tested beyond 40 docs. `/api/model` is versioned (`anaxi/1`) so other pages can read it,
which makes it a contract: [tools/SPEC.md](../../../tools/SPEC.md) §8.2.
