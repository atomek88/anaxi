---
anaxi: "@decided"
depth: D2
risk: 2·1·1·1
about: [decisions, enforcement]
uses: ["@questions", "@hard-gate", "@format"]
focus: now
built: no
code: [../../../tools/lib/decisions.mjs, ../../../tools/lib/parse.mjs, ../../../hooks/before-edit.mjs, ../../../tools/anaxi-check.mjs]
---
# Who decided

**Why.** Designing an item is always allowed, and the hook can't tell designing from deciding. An agent can tick a
person's open questions and write ten plausible words per level, and the gate opens. Only the skill's text says not
to, and the pushback tests showed that advice doesn't hold under pressure.

**What.** A question says who decides it, `(decide: person)` or `(decide: anyone)`, with a default per level, and an
answer records who did and when (`→ decided: <name> 2026-11-07`). Every edit the Claude Code hook sees is an agent's,
so it refuses an agent ticking a person's question on an item the gate holds, and points to the proposal form (`→
proposed: …`, box unchecked). The person answers in their editor, from the terminal (`anaxi-check decide`), or in the
reader (@decide-reader). At commit and merge time, a commit that ticks a person's question and carries an agent's
`Co-Authored-By:` trailer is flagged, and `anaxi-check decisions --who` lists who answered what, from git blame. Done
when an agent's edit ticking `(decide: person)` on a held item is refused, a person's isn't, and the record shows
both. Out of scope: proving identity; an agent outside every hook, writing a person's name in a commit, can still
fake it, and git history shows it.

**Shape.** The parser reads `(decide: …)` on a question and `→ decided: name day` on its answer; the defaults come
from `questions.decideBy` in `anaxi.json`. `tools/lib/decisions.mjs` holds the list (open, proposed, decided, by whom)
and the edit `decide(item, question, answer, who)` that `anaxi-check decide`, the reader and later MCP share. The
hook's markdown branch gains one check, beside the built and `code:` checks it already has. Chosen over signed
answers (heavy, and nobody would use them) and over trusting the skill (tested, didn't hold).

## Open questions

- [ ] D1 · (decide: person) Are why and what (D0–D1) a person's to decide by default, and shape and contract (D2+) anyone's? → proposed: yes, as `questions.decideBy`; a question's own `(decide: …)` overrides it
- [ ] D1 · (decide: person) When you give the agent an answer in the chat, may it tick the box? Options: (a) strict, you always tick; (b) the agent ticks and records `decided: <you> (in session)`, flagged for review; (c) the hook checks the session transcript for your words. → proposed: (a), made easy: you type `! anaxi-check decide @recurring 2 "series time zone"` in the session (the hook never sees a command you run yourself), or answer in the reader. (b) reopens the hole with a label on it; (c) is clever but fragile
- [ ] D2 · Only on items the gate holds, or on every item? → proposed: refused only where ticking would open a gate; elsewhere it's listed by `decisions --who`
- [ ] D2 · Where does the name come from? → proposed: `git config user.name` when written through `decide` or the reader; by hand, what the person writes; if blank, the commit author from blame
- [ ] D2 · Which agent trailers are recognised? → proposed: `Co-Authored-By:` naming Claude, Codex, Cursor or Copilot by default; `decisions.agentTrailers` adds patterns
- [ ] D3 · The contract: the question and answer syntax in FORMAT.md, `decide` and `decisions` output, the refusal text
