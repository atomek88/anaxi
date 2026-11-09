---
anaxi: "@adopt"
depth: D1
risk: 1·1·1·1
about: [agents, progress, living-docs]
uses: ["@code-map", "@decided", "@skill"]
focus: next
built: no
code: [../../../skills/adopt/, ../../../tools/lib/coverage.mjs, ../../../tools/anaxi-check.mjs]
---
# Adopt: an agent maps a project into its docs

**Why.** Docs fall behind the work. An existing project has no docs at all, and an active one has work that nothing
links to an item. Catching up by hand is the bookkeeping people skip. When the docs are behind, the fix should be
an instruction: "map the project in". It shouldn't be a chore.

**What.** `/anaxi:adopt` (a skill) and `anaxi-check coverage` (the map's other side) work together:
- `coverage` lists code no item's `code:` covers, by folder and size, and items whose `code:` matches nothing.
- The agent reads the code, tests, README, tracker and git log. For a folder no item covers, it drafts items at
  D1–D3 from the code, marked `source: code`, with `code:` filled in.
- For existing items, it proposes `code:` paths, acceptance `checks:` (@progress) and `Anaxi: @id` links to issues
  and commits.
- It marks what it inferred as `→ proposed:`, on unchecked questions, and leaves every why and what to a person
  (@decided).

Run again later, it only adds what's new since its last run, from git. It never blocks anything. It calls out what
it couldn't place and which decisions it left. Done when a run on an unmapped repo leaves every source folder
covered or listed, with no decision ticked.

## Open questions

- [x] D1 · (decide: person) Should an agent ever draft items from code, or only map existing ones? → decided: Tomasz Michalik 2026-11-09 (in session: "easily rectified by instructions and having an agent consume more of your project and map it to anaxi docs", recorded by the agent): draft them too, marked `source: code`, with the decisions left open as proposals
- [x] D1 · (decide: person) Is this its own item, or part of @project-kinds? → decided: Tomasz Michalik 2026-11-09 (delegated in session, recorded by the agent): its own item, `next`, ahead of @project-kinds, since every kind of project falls behind its docs
