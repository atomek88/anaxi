# Anaxi format: marking up ordinary markdown

Anaxi adds marks to markdown you already write. It doesn't impose a document structure. A doc that follows
a common TDD template works as-is once it has one tag; a loose page of notes works too. Everything here
reads fine on GitHub, in an IDE, and to an LLM, without being rendered.

**Rule of thumb:** use whichever form you like for each mark. The tools accept all of them, and so do agents.

## 1. Declaring an item

An item is anything with a depth: a whole TDD, one section of it, a story, a shared API. Declare it in any of
four ways:

| Form | Use for | Looks like |
|---|---|---|
| **Front matter** | a whole file is one item (a typical TDD) | YAML at the top of the file |
| **Tag line** | a section is an item | a `>` blockquote right under the heading |
| **Heading badge** | a small item that needs only an ID and a depth | inline code in the heading |
| **Comment** | marks that shouldn't show when the doc is read | an HTML comment under the heading |

```markdown
---
anaxi: "@recurring"
depth: D2 → D3
risk: 2·1·1·1
about: [data, async, ui]
uses: ["@task-api", "@scheduler"]
focus: now
later: custom recurrence rules (when 10% of active users use recurrence)
---
```

```markdown
## Task API
> @task-api · depth: D3 🎯 · risk: 2·2·0·0 · about: api · uses: @stack
```

```markdown
## Settings screen `@settings` `D1 🎯`
```

```markdown
## Offline sync
<!-- anaxi: @offline-sync · depth: D1 → D2 · risk: 1·1·1·1 -->
```

All four take the same fields ([METHOD §4](METHOD.md#4-the-tag-line)). Items nest the way headings nest: a
file-level item contains its section items.

## 2. Badges and icons

Badges are inline code (`` `D2 → D3` ``), which GitHub and most editors show as a small chip. Icons are
optional, and the tools treat each one exactly like the word next to it:

| Icon | Word | Meaning |
|---|---|---|
| 🎯 | `enough` | reached its target depth. It means "designed enough", not "done" |
| ⬇️ | `gap` | below its target: go deeper |
| ⛔ | `blocked` | waiting on something it uses, or on an open question |
| ❓ | `open` | an open question |
| ✂️ | `trim` | deeper than it needs to be now: over-documented |
| ⏸️ | `later` | deferred, with a trigger |
| ⚠️ | `caveat` | a known limit accepted at this depth |
| 🎨 | `canvas` | unbound exploration, not committed (§6) |

**No check marks.** A design doc doesn't track whether work is done; that belongs in your tracker. The
closest Anaxi gets is 🎯, which means the design is deep enough for its risk. The checkboxes in an item's
question list (§5) mean "answered", not "done".

Writing `D3 🎯` or `D3 enough` in a tag is the same thing. Generated output (the index, the status table) uses icons,
because they scan quickly in a long list.

## 3. References

| Form | Example | Counts as |
|---|---|---|
| `@id` | `@task-api` | a reference anywhere: tag, front matter or text |
| markdown link to a tagged item | `[Task API](../shared/task-api.md)` or `[Task API](../shared/task-api.md#task-api)` | a reference, when the target file or heading is tagged |
| both | `[@task-api](../shared/task-api.md)` | both; the recommended form, readable and clickable |

- References in **`uses:`** are dependencies: they drive the blocked nudge (N02) and the order things are
  rendered in.
- References in **body text** are mentions. They are used for navigation and "mentioned by", not for nudges.
- A link to an untagged doc is an ordinary link. Anaxi ignores it.

## 4. What level a piece of content is at

Inside an item, the tools work out which level each section belongs to, in this order:

1. **An explicit mark wins:** a heading that starts with `D0`–`D4` (`### D2 Shape`), a badge in the heading
   (``### Rollout `D4` ``), a bold lead-in (`**Shape.**`), or a comment (`<!-- D3 -->`) before a paragraph.
   A comment directly under a heading marks the whole section, like an invisible badge, so its subsections inherit it:
   the way to join a reference doc to an item as a part without changing how it reads.
2. **Otherwise the heading name:** common TDD section names map to levels (table below). Matching ignores
   case and ignores words like "the", "our", "proposed" or "detailed".
3. **Otherwise the section above:** an unmapped heading takes the level of the nearest mapped heading above
   it. If there isn't one, the section is *unclassified*: it is shown at every level and counts for nothing.

**The claim needs its levels written.** Levels are cumulative, so the script counts an item only up to the
first level, from D0, with nothing written under it (fewer than `nudges.levelWords` words, default 10).
`depth: D4` over a why, a what and a build paragraph counts as D1, and the status says "D1 (claims D4)" (N05).
Write the missing level or lower the claim. Items with no levelled text at all aren't measured.

| Level | Heading names that map to it |
|---|---|
| D0 | Summary, Overview, TL;DR, Context, Background, Problem, Motivation, Goals, Non-goals, Success metrics, Why |
| D1 | Requirements, User stories, Use cases, Scope, Out of scope, Acceptance criteria, Behavior, User experience, User flow, Edge cases, Dependencies |
| D2 | Design, Architecture, High-level design, Approach, Solution, Alternatives considered, Tech stack, Decisions, Trade-offs, Risks, Cross-cutting concerns, Security, Privacy, Observability, Scalability, Cost |
| D3 | API, Interfaces, Contracts, Data model, Schema, Events, Messages, Error handling, Failure modes, State machine, Compatibility, Versioning, Limits |
| D4 | Implementation, Implementation plan, Tasks, Work breakdown, Milestones, Code, Examples, Testing, Test plan, Rollout, Migration plan, Deployment |
| canvas | Canvas, Sketch, Ideas, Brainstorm, Notes, Thoughts, Visuals, Mockups, Appendix |
| questions | Open questions, Questions, FAQ |

A project can add or change names in `anaxi.json` (`"sections": { "D2": ["Shape of it"] }`), for example to
match its own TDD template.

The mapping is what lets a standard TDD be read at one altitude ("show me D0–D1") without changing it. It is
a guide for readers and tools; it is **not** how depth is measured. Depth is still which questions are
answered, wherever the answers are.

## 5. Item questions

A checklist inside the item ([QUESTIONS.md §5.2](QUESTIONS.md#52-item-questions)):

```markdown
### Open questions
- [x] D1 · Editing a series: this one, or all future ones? → all future ones (see Behavior)
- [ ] D3 · What happens to an occurrence that falls in a DST gap?
```

Unchecked boxes count as open questions. Checked ones are answered.

## 6. Canvas: unbound space

Every item can have a **canvas**: a place for the shape of the idea, sketches, visualizations, diagrams,
mockups, half-formed thoughts, links, alternatives you're still playing with. Anything that doesn't fit a
question, or that you aren't ready to commit to.

Mark it with a canvas-named heading (`## Sketch`, `## Ideas`, `### Canvas`), a 🎨 in the heading, or
`<!-- canvas -->`.

| Rule | Why |
|---|---|
| **Anything goes.** No questions, no budget, any format (Mermaid, images, tables, lists, prose) | thinking needs room |
| **Doesn't count toward depth.** A canvas can't make an item D3 | depth means committed answers |
| **Exempt from** over-documented, over-engineered and out-of-focus nudges (N06, N07, N08) | exploring isn't over-engineering |
| **Not a source of truth.** Readers and agents may use it for context, but must not treat it as decided | commit or explore, and say which |
| **Promote what matters.** When a decision or answer relies on something in the canvas, move it into the level it belongs to | N17 points this out |

Rendered and indexed output shows the canvas, clearly labelled "🎨 exploration, not committed".

## 7. A standard TDD, marked up

Most TDD templates (Google-style design docs, RFCs, ADR-heavy docs) need only front matter and a checklist.
Their headings already map to levels:

```markdown
---
anaxi: "@recurring"
depth: D2 → D3
risk: 2·1·1·1
about: [data, async, ui]
uses: ["@task-api", "@scheduler", "@stack"]
---
# Recurring tasks

## Context and goals            ← D0
## Non-goals                    ← D0
## Requirements                 ← D1
## Proposed design              ← D2
## Alternatives considered      ← D2
## API                          ← D3
## Data model                   ← D3
## Implementation plan          ← D4
## Testing                      ← D4
## Rollout                      ← D4
## Open questions               ← checklist
## Appendix: sketches           ← canvas
```

Full template: [templates/TDD.md](templates/TDD.md). A smaller one for stories and small items:
[templates/item.md](templates/item.md).

## 8. Writing for LLMs

Agents work best with the same habits that help people:

- **Keep marks near what they describe.** A tag under its heading beats a separate status file.
- **Prefer `[@id](path)` links**, so an agent can follow a reference without searching.
- **Use real headings.** Agents (and the tools) find sections by heading. Bold text pretending to be a heading
  is harder to find.
- **Put the why first.** An agent that reads only the first screen of a file should still get D0.
- **Don't hide decisions in the canvas.** Agents are told not to treat it as decided.
- **Split long docs with parts** (§9), not with one 2,000-line file. An agent can open only the part it needs.

## 9. Parts: detail kept in another file

A TDD doesn't have to hold every level itself. Deep detail (contracts, data models, build steps) can live in an
`APPENDIX.md`, or in its own file next to the TDD, and still count as the item's content. Mark it `part-of:`:

```markdown
## Recurring tasks: series record `D3`
> part-of: @recurring
```

or, for a whole file, front matter `part-of: "@recurring"`. Then link to it from the TDD, so readers find it:
`The series record is in the [appendix](APPENDIX.md#recurring-tasks-series-record-d3).`

| Rule | Why |
|---|---|
| **A part counts as its host's own content.** Its sections, levels, checklist and `uses:` add to the host's | depth is about what's answered, not which file it's in |
| **A part has no depth, target or status of its own.** The host's `depth:` is the one claim | one item, one claim |
| **Section levels work as usual**: heading names, or a `` `D3` `` badge on the part's heading | nothing new to learn |
| **One appendix can hold parts of many items**, one heading each | a single place for detail, if the team prefers it |
| **`INDEX.md` lists each item's parts** | the super-TDD shows where everything is |
| **Move parts freely** as the docs grow: inline into the TDD, out to an appendix, into their own file | where content lives is a reading choice; only `part-of:` has to stay |

**Listed from the item's side.** When the detail is a file that shouldn't carry Anaxi marks (a spec, a README,
anything outside the design folder), list it on the item instead: `parts: ["../../tools/SPEC.md#3-parsing (D3)"]`
(front matter) or `parts: [Spec §3](../../tools/SPEC.md#3-parsing) (D3)` (tag line). The path is relative to the
item's file, like a link; the anchor picks a heading and everything under it, or leave it out for the whole file;
`(D3)` sets the level of all of it, subsections included (without it, heading names decide). Nothing is written in
the listed file; a part whose file or heading is gone is an error. This is how a design folder stays self-contained.

A part is committed content. Exploration still goes in a canvas: a heading named `Appendix` *inside* a TDD is
canvas (§6); a `part-of:` section in `APPENDIX.md` is not. When a part grows into something other items use
(an API, a store), make it a shared item with its own `@id` instead.

## 10. Superseded, retired, archived

Designs get replaced. The old one is still worth reading (it explains what was built from it, and why the new
one exists), but it must not read as current: agents read everything and can't tell. So the change is a mark,
never just a folder name or a deletion.

| State | Mark | What changes |
|---|---|---|
| **current** | (none) | counted, nudged and gated as usual |
| **superseded** | `superseded-by: @new (why)` on the old item, and `supersedes: @old` on the new one | stays where it is, so links still work; leaves the status table, targets and gates; `INDEX.md` lists it under "Superseded and retired" with its successor |
| **retired** | `retired: 2026-11-02 (why)`: dropped, nothing replaces it | the same, with no successor |
| **archived** | the file is in the archive folder (`archive` in `anaxi.json`, `docs/archive` by default), with `archived-from:` | still read for references, never for status |

```markdown
---
anaxi: "@polling-sync"
depth: D2
superseded-by: "@scheduler (an event-driven planner replaced the per-minute poll)"
---
```

The marks work in every declaration form: front matter, tag line, comment, heading badge. A section item inside
a superseded doc goes with it.

**Inside a living TDD**, a replaced decision or section is kept under a heading named `Decision log` (or
`History`, `Previous design`), or a heading with a `` `superseded` `` badge, or with a `> superseded-by: …` line
under it. Like the canvas, it's kept and labelled and never counted. An `@id` written there isn't an ordinary
mention: it says the change went with a change to that item, and shows as **changed with**, both ways.

**Deleting.** Once an archived doc is no longer read, it can be deleted: git keeps it. `archive/RETIRED.md`
keeps one row per deleted `@id` (date, why, successor, last commit), so the id is never reused by accident.

**Moving between states** is done by the checker, which edits the marks, moves the file and fixes the links:

```bash
anaxi-check supersede @old --by @new --why "…"   # both sides marked
anaxi-check retire    @id --why "…"              # dropped, no successor
anaxi-check archive   @id [--why "…"]            # a whole-file item moves to the archive; links are rewritten
anaxi-check restore   @id                        # back to current, and out of the archive
anaxi-check delete    @id                        # an archived, committed file is removed; RETIRED.md keeps the id
```

Each takes `--dry-run`. `restore` undoes `supersede`, `retire` and `archive` exactly. When to supersede rather
than edit: [METHOD.md §6.1](METHOD.md#61-superseding-retiring-archiving).
