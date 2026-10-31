---
anaxi: "@skill"
depth: D3
risk: 2·0·1·1
about: [agents]
uses: ["@mcp", "@check", "@method", "@questions"]
parts:
  - "../../../skills/anaxi/SKILL.md (D3)"
built: yes (2026-10-30)
code: [../../../skills]
---
# The skill

**Why.** Half of Anaxi is judgement the scripts can't make: whether a question is answered, whether a section is
over-engineered or out of focus. And an agent needs to know when to stop: when a design is enough, and when an
item isn't ready to build.

**What.** Procedures: orient, start an item, write its questions, assess, deepen, read before building, the gate,
lifecycle, the index, and improving the questions. Slash skills for the common ones (`/anaxi:init`, `status`,
`gate`, `assess`, `watch`). Two rules matter most: a blocked gate means stop, and a proposal is not an answer.
Out of scope: changing the core questions or principles, which only people do.

**Shape.** One `SKILL.md` that reads the method files only when a procedure needs them; the scripts for anything
structural, the model for anything semantic. In headless runs on 2026-10-25, an agent asked to "implement
recurring tasks" found a blocked gate, then wrote the missing D3 contracts itself, which would have opened its own
gate. So proposals now go on the open question with the box unchecked (`→ proposed: …`), and only the user
checks it. The risky part is that every rule is prose an agent may not follow; the headless test is how we find
out.

- [ ] D3 · Does "blocked means stop" hold when the headless test is re-run on the new skill text? → proposed: yes, so far. On
  2026-10-25, "Add an anaxi_related tool…" on this repo gated, built nothing, and wrote its proposals on @related's open
  questions with the boxes unchecked; both runs stopped early at the account's spend limit. Re-run 2026-10-30 (5 runs):
  both blocked prompts stopped, left @scheduler alone and offered proposals without writing them; the ready one built,
  tested, marked `built:`/`code:` and called `anaxi_index`; a code change updated SPEC and @outline with it; a design
  question skipped the design tools until the skill's description named questions (fixed, re-run passed).
