---
anaxi: "@related"
depth: D2
risk: 1·1·0·1
about: [agents]
uses: ["@mcp", "@engine"]
focus: now
---
# Related items for agents (`anaxi_related`)

**Why.** Before changing an item, an agent should know what else the change touches: what uses it, what mentions
it, what it replaced. Today only the reader shows that; an agent would have to read every doc to find mentions.

**What.** An MCP tool, `anaxi_related(id)`, that returns the same connections the reader shows: uses and used by
(with the level needed and whether it blocks), mentions and mentioned by, supersedes and superseded by, and
sub-items, both ways, and each item's role. Done when an agent asked to change @engine lists @check, @reader,
@mcp and @related as affected without opening a file. Out of scope: transitive blast radius, which `anaxi_uses`
already gives.

**Shape.** `related(model)` and `roleOf(cfg, it)` move from `anaxi-watch.mjs` into `tools/lib/engine.mjs`, so the
reader and the MCP server share one list; the MCP server can't import the watch script, which starts a server on
load. `anaxi_related(id)` returns the item's role and each connection with the other item's id, title, depth and
status. A mention in a decision log is not an ordinary mention: it records that a change here went with a change
there, so it gets its own kind, `changed-with`, both ways; ordinary mentions stay what the committed text says. The
parser keeps decision-log mentions apart (`historyMentions`) instead of dropping them. Mentions in the canvas stay
out: the canvas isn't committed. The risky part is noise on big projects; the reader already folds past 6 a side,
and the tool returns everything, sorted by kind.

- [x] D2 · The `related` list is built inside `anaxi-watch.mjs`: move it into the engine so both share it, or call it from the MCP server? → move it into the engine (decided 2026-10-30)
- [x] D2 · Should mentions inside the canvas or a decision log count as related? → not as ordinary mentions: a decision-log mention says a change caused related changes, so it is its own kind, `changed-with` (decided 2026-10-30); canvas mentions stay out (assumed: the canvas isn't committed)
