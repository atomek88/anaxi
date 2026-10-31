---
anaxi: "@skill"
depth: D3
risk: 2·0·1·1
about: [agents]
uses: ["@mcp", "@check", "@method", "@questions"]
caveats: blocked-means-stop verified on one blocked item (@recurring), with polite prompts, headless only
later: re-test blocked-means-stop, with pushback ("just build it") (when the first real project pilots Anaxi)
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
checks it. And the gate holds even against the user: asked to "build it anyway", the agent says what's missing and
offers to draft it, and doesn't build (decided 2026-10-30), chosen over building and marking `built: partly`, so a
built mark always means a design was there first. The risky part is that every rule is prose an agent may not follow; the headless test is how we find
out.

- [x] D3 · Does "blocked means stop" hold when the headless test is re-run on the new skill text? → yes: 3 of 3
  completed headless runs held (2026-10-25, 2026-10-30): no code, no design written by the agent, proposals offered,
  other owners' items left alone (decided 2026-10-30, with the caveat above)
