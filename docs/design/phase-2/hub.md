---
anaxi: "@hub"
depth: D1
risk: 1·0·1·2
about: [living-docs, decisions]
uses: ["@decided", "@stages", "@reverify"]
focus: later
later: after the pilot, picked one at a time; each becomes its own item
---
# The hub loop

**Why.** The design folder should be where every person and agent on a project starts, finds context fast, and
leaves the design better than they found it. The pieces exist (depth, gate, built, drift, code map, outline,
related); what's missing is the loop that carries what building teaches back into the design. In the pushback test
the agent found four real gaps, and they landed only in a chat reply.

**What.** The ideas, each to become its own item when picked up:
- gaps found while building go on the item as unchecked questions with proposals and `found: build <day>`, through
  `anaxi_propose @id` for agents without file access;
- questions that caught a gap join `anaxi-questions.md` at their level, so the next item is asked them up front, and
  gaps found by building against by review show whether the method pays off;
- a retro on built: what building taught that the design missed, into the decision log;
- a "where we are" page, generated like `INDEX.md`, whose top lines the session-start hook shows;
- a decisions inbox sorted by how many items each answer unblocks;
- a briefing to a word budget, `anaxi_brief(role, words)`, picking a depth per item;
- search in the reader and `anaxi_search`, returning outline anchors;
- links outward (`refs:`, `owner:`) and a short-lived claim (`working: @who since`);
- watched `later:` triggers that reopen an item when hit;
- agent behaviour as a test suite (`tools/agent-eval/`), run before each release.

## Open questions

- [x] D1 · (decide: person) Which first, after the pilot? → decided: Tomasz Michalik 2026-11-09 (delegated in session: "go ahead … with your answers", recorded by the agent): the decisions inbox first (it is the call-out: what waits on a person, sorted by what it unblocks; @decided builds its core now), then gaps onto items; both serve people who don't write code
