---
anaxi: "@reverify"
depth: D2
risk: 1·0·1·1
about: [living-docs, agents]
uses: ["@drift-both", "@mcp", "@engine"]
focus: next
built: no
code: [../../../tools/lib/reverify.mjs, ../../../tools/anaxi-mcp.mjs, ../../../tools/anaxi-check.mjs]
---
# The re-verify loop

**Why.** Drift (@drift-both) says the design and the code may disagree; someone still has to check. That check is
where the docs improve themselves, and it should take an agent one bounded call, not a reading of the whole repo.

**What.** `anaxi_reverify @id` (MCP) and `anaxi-check reverify @id` hand whoever checks one bundle: the code diff
since the baseline, limited to the item's `code:`; the design diff since then; the item's contracts and acceptance
criteria, and the contracts of what it uses. The checker then confirms they agree (`verify` writes the day), edits the
design where the code is now the truth and nothing is a decision, or proposes, as unchecked questions, where it's a
decision (@decided) or where the code broke the contract. `--bundle > recheck.md` writes the same bundle as a prompt
file for tools without MCP. `reverify --all` lists drifting items, sorted by drift size times how many items use them;
the reader shows it as a heat map. Done when an agent, given only `anaxi_reverify @x` on a drifted item, either
clears it or leaves proposals, with no other reads.

**Shape.** `tools/lib/reverify.mjs` builds the bundle from `git.mjs` (diffs since the baseline) and `context`
(contracts), cut to a word budget: the diff stat always, hunks until the budget runs out, contracts always. MCP gains
its second write, `anaxi_verify`, after `anaxi_index`. Chosen over handing agents raw `git log` (unbounded) and over
re-reading the whole item set (the reason `anaxi_context` exists).

## Open questions

- [x] D1 · (decide: person) Does an agent's "verified" count like a person's? → decided: Tomasz Michalik 2026-11-07 (in session, recorded by the agent): yes, recorded as the agent's (`built: yes (<day>, agent)`), shown apart, and replaced by a person's check (decided with @drift-both)
- [ ] D2 · The word budget? → proposed: 3,000 words by default, `--words` to change it
- [ ] D2 · May an agent edit the design from the code? → proposed: for descriptive facts only (names, paths, counts), with `→ from code <day>`; anything about behaviour or a decision goes as a question
