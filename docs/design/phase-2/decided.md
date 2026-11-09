---
anaxi: "@decided"
depth: D3
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

**Call out, don't stop.** Decided on 2026-11-09 that Anaxi blocks only one thing here: an agent ticking a person's
question on an item the gate holds, because that would open the gate. Everything else about decisions is a call-out:
- every surface shows how many open questions wait on a person, and which items each one unblocks;
- commits and PRs where an agent ticked a person's question are flagged, never failed.

**Contract.** *Syntax (FORMAT.md §5).* `- [ ] Dn · [(decide: person|anyone)] question [→ proposed: text]`. An answer:
`- [x] Dn · [(decide: …)] question → decided: <name> <YYYY-MM-DD>[ (note)]: answer`. A name ending in `(agent)` is an
agent's answer. A ticked line with no `decided:` stays valid (older docs) and counts as "unrecorded". Who decides is
the marker if one is given, else `questions.decideBy` (default `{ "D0": "person", "D1": "person" }`; other levels
are anyone's), else anyone.
*The hook* (`hooks/before-edit.mjs`):
- Markdown branch: for each item in the file that the gate holds, the edit is refused when it turns a person's
  question from unchecked to checked, adds a checked one, or removes or changes its `(decide: person)` marker or its
  level.
- `anaxi.json`: refused when it lowers `questions.decideBy` while a held item has an open person question.
- Bash: the hook gains a `Bash` matcher and refuses a command matching `anaxi-check(\.mjs)?\s+decide\b`. A person's
  own `! command` isn't seen by the hook.
- The refusal text: `Anaxi's gate: @recurring is held, and question 2 ("Weekly on which day?", D1) is a person's to
  decide. Write your answer as a proposal on the unchecked line (→ proposed: …) and ask the user; they record it
  with ! node tools/anaxi-check.mjs decide @recurring 2 "answer", or in their editor.`

*Commands.*
- `anaxi-check decide @id <n> ("answer" | --accept) [--as NAME] [--dry-run]`. `n` is the question's number in
  `decisions @id`, and `--accept` takes the proposal as the answer. It rewrites that one line: `[ ]`→`[x]`, `→
  proposed: …` → `→ decided: <name> <today>: answer`. The name is `--as`, else `git config user.name`. It prints the
  line before and after. Exit codes: 0 when written; 1 when there's no such question, or it's already answered;
  2 when there's no name.
- `anaxi-check decisions [@id | --all] [--open | --who] [--since REF] [--json]`.
  - `--open`, the default: open questions, each with who decides, its proposal, and `unblocks: @a @b` (held items
    whose gate it's in), sorted by how many it unblocks.
  - `--who`: answered questions, each with the recorded name and day, the blame commit and its author, and flags:
    `agent-ticked` (a person's question whose name ends in `(agent)`, or whose blame commit carries an agent
    trailer) and `unrecorded`.
  - It always exits 0.

The agent trailers are a `Co-Authored-By:` matching `/claude|codex|cursor|copilot/i`, plus any regexes in
`decisions.agentTrailers`. *JSON.* `open` entries gain `decideBy: "person" | "anyone"` and, once answered,
`decided: { by, day, agent }`; `decisions --json` has `{ format, open: [...], decided: [...], flags: [...] }`.
*Call-outs.*
- `status` adds a `⚑ 2` column (open person questions) and a summary line: `⚑ 6 decisions wait on a person; first
  @recurring #2 (unblocks 2)`.
- The session-start hook shows that summary line.
- `anaxi-ci.sh --pr` prints the `agent-ticked` flags for the PR's commits as warnings.
- N29 (info) on an item with an agent-ticked person question.

## Open questions

- [x] D1 · (decide: person) Are why and what (D0–D1) a person's to decide by default, and shape and contract (D2+) anyone's? → decided: Tomasz Michalik 2026-11-07 (in session, recorded by the agent): yes, as `questions.decideBy`; a question's own `(decide: …)` overrides it
- [x] D1 · (decide: person) When you give the agent an answer in the chat, may it tick the box? Options: (a) strict, you always tick; (b) the agent ticks and records `decided: <you> (in session)`, flagged for review; (c) the hook checks the session transcript for your words. → decided: Tomasz Michalik 2026-11-07 (in session, recorded by the agent): (a): you always tick, made easy: `! anaxi-check decide @id <n> "answer"` in the session (the hook never sees a command you run yourself), or the reader
- [x] D2 · Only on items the gate holds, or on every item? → decided: Claude (agent) 2026-11-09: refused only on items the gate holds; everywhere else it's a call-out (`decisions --who`, N29), following your rule that Anaxi calls out rather than blocks
- [x] D2 · Where does the name come from? → decided: Claude (agent) 2026-11-09: `--as`, else `git config user.name`, through `decide` or the reader; by hand, what the person writes; if blank, the blame commit's author, flagged `unrecorded`
- [x] D2 · Which agent trailers are recognised? → decided: Claude (agent) 2026-11-09: `Co-Authored-By:` naming Claude, Codex, Cursor or Copilot; `decisions.agentTrailers` adds patterns
- [x] D2 · An agent can run `anaxi-check decide` through its shell, which the edit hook doesn't see. → decided: Claude (agent) 2026-11-09: the hook gains a Bash matcher for that one command; other shell writes stay the known hole, flagged at commit
- [x] D3 · The contract: the question and answer syntax in FORMAT.md, `decide` and `decisions` output, the refusal text → decided: Claude (agent) 2026-11-09: written above
