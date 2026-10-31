---
anaxi: "@outline"
depth: D2
risk: 1·0·1·0
about: [agents, ui]
uses: ["@engine", "@mcp", "@reader"]
built: yes (2026-10-30)
code: [../../../tools/lib/read.mjs, ../../../tools/anaxi-mcp.mjs, ../../../tools/anaxi-check.mjs, ../../../tools/watch/app.js]
---
# Outline with anchors (`anaxi_outline`)

**Why.** To answer a question from the design, people and agents read an item top to bottom, and often keep
reading past the answer, or open the next level just in case. The levels are already marked; what's missing is a
map of where each answer is, so a reader can go straight to it and stop.

**What.** For an item, up to a depth: every section and lead-in in order, each with its level, a label, a link
(file and heading anchor), its word count and its first sentence, plus the item's own questions with their answers
and where its parts live. `anaxi_outline(id, at?)` for agents, `anaxi-check outline @id [--at Dn]` in a terminal,
and an Outline list in the reader's side pane that unfolds and scrolls to the entry clicked. Done when an agent can
answer "how does @x handle retries?" by reading the outline and one section. Out of scope: judging which section
answers a question, which is the reader's call.

**Shape.** Built on `blocks()` in `lib/read.mjs`, so the outline and the depth reader can't disagree: one entry per
heading and per lead-in, words counted up to the next entry, the first sentence cut at 160 characters. A lead-in has
no anchor of its own, so it links to the heading above it, with its line. Chosen over a generated outline file per
item, which would be one more thing to keep fresh. The risky part is long docs with few headings: an entry can hold
hundreds of words, and its first sentence is all the outline can say about it.
