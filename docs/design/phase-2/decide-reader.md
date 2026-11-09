---
anaxi: "@decide-reader"
depth: D2
risk: 1·1·1·2
about: [decisions, ui]
uses: ["@reader", "@decided"]
focus: next
built: no
code: [../../../tools/watch/decide.js, ../../../tools/anaxi-watch.mjs]
---
# A writable reader, for decisions only

**Why.** The one place a person who doesn't write code meets the design is a decision: a product owner, a client,
a manager. Today answering one means editing markdown, so they ask someone else, and the build waits.

**What.** In the reader, an open question can be answered: tick it, keep or edit the proposal, add the answer.
Nothing else in the reader writes. The answer is recorded with who and when (@decided), the file is rewritten with
the same minimal edit a person would make, and the page reloads. It's refused if the file changed since the page
loaded, and the diff is shown before writing. Done when a decision answered in the reader appears in the markdown
exactly as if typed, and opens the gate it was holding.

**Shape.** `anaxi watch --decide` turns on one POST route in the local server, which calls `decide()` from
`tools/lib/decisions.mjs`; the person is whoever runs it (`git config user.name`). `tools/watch/decide.js` adds the
answer form to open questions. Chosen over a general editor in the reader (the docs belong in editors; this is one
narrow write) and over a hosted service (later, if at all).

## Open questions

- [x] D0 · (decide: person) A narrow exception to "the reader never writes": answering questions only, behind a flag? → decided: Tomasz Michalik 2026-11-09 (delegated in session: "go ahead … with your answers", recorded by the agent): yes
- [x] D1 · (decide: person) How does a person who never runs Node reach it? → decided: Tomasz Michalik 2026-11-09 (delegated in session: "go ahead … with your answers", recorded by the agent): for now, `anaxi-check decisions --export` to a shared page or an issue, answered there, and recorded in the docs with `decide --as <their name>` by whoever runs the project; a hosted reader is its own item later, if ever
- [x] D2 · Two people answering at once? → decided: Claude (agent) 2026-11-09: the file's hash at page load is checked before writing; a mismatch refuses and reloads
