---
anaxi: "@mcp"
depth: D3
risk: 2·2·1·0
about: [agents]
uses: ["@engine"]
parts:
  - "../../../tools/SPEC.md#83-anaxi-mcp (D3)"
built: yes (2026-10-30)
code: [../../../tools/anaxi-mcp.mjs]
---
# The MCP server (`anaxi-mcp`)

**Why.** Agents read design docs file by file: they miss what an item depends on, read the canvas as committed,
and build from items that aren't ready. The engine already knows all of that.

**What.** Tools: `anaxi_status`, `anaxi_nudges`, `anaxi_gate`, `anaxi_questions`, `anaxi_context` (the item to a
depth plus each use once, at the level needed, and the gate), `anaxi_uses`, `anaxi_related` (@related), `anaxi_outline` (@outline), and `anaxi_index`, the one tool that
writes, and only the generated index. Every call re-reads the docs. Measured on 2026-10-25: in three headless
runs, every agent called `anaxi_gate` and `anaxi_context` without being told to, including one whose prompt named
no item, and the two blocked ones built nothing.

**Shape.** JSON-RPC over stdio, zero dependencies, started by the plugin (`mcpServers` in `plugin.json`), the project taken from
`$CLAUDE_PROJECT_DIR`. One bounded `anaxi_context` call, chosen over exposing the files, because it is what makes
an agent read the right depth and follow a superseded item to its successor. The risky part: tool names and
fields are a contract with every agent and skill that calls them; renaming one breaks them silently.

Contract: [tools/SPEC.md](../../../tools/SPEC.md) §8.3.
