---
anaxi: "@related"
depth: D1
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

- [ ] D2 · The `related` list is built inside `anaxi-watch.mjs`: move it into the engine so both share it, or call it from the MCP server? → proposed: move `rel`/`link` and `roleOf` (`anaxi-watch.mjs:27–41`) into `tools/lib/engine.mjs` as `related(model, it)` and `roleOf(cfg, it)`, beside `usedBy`; the reader and the MCP server both call them. The MCP server can't import the watch script: it starts an HTTP server on load.
- [ ] D2 · Should mentions inside the canvas or a decision log count as related? → proposed: no. The parser already drops them (`parse.mjs:330`, `if (inCanvas) continue`), and the method ignores the canvas when judging an item (skill, procedure 4). Nothing to change; accept and check.
