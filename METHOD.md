# Anaxi method

## 0. Defaults, not rules

Almost everything in this method is a **starting point** that a project changes in `anaxi.json` or
`anaxi-questions.md` when it gets in the way. Use the defaults until they don't fit, then change them and say
why in the commit. Only three ideas are fixed, because the tools and shared items depend on them:

1. **Depth means answered questions**, not word count or position in a doc.
2. **Levels are cumulative.** Being at a level means the levels below it are answered too.
3. **Markdown is the source of truth.** The tools read the docs; they hold no state of their own.

| Default | Change it with | Example |
|---|---|---|
| five levels, D0 Why … D4 Build | `levels` in `anaxi.json`: rename, redefine "done when", drop the top ones, add D5… | `"levels": {"D2": {"name": "Design"}, "D4": null}` |
| four risk factors | `rubric.factors`: replace `base`, or `add` your own dimensions | `"add": [{"id": "compliance"}]` |
| the totals that map to targets | `rubric.thresholds` | `"D3": [3, 5]` |
| a target from risk at all | don't score risk: write the target yourself | `depth: D1 → D3` |
| ten core questions | `anaxi-questions.md`: reword, skip project-wide, add your own | `skip-all: D4.plan · agents plan from tickets` |
| which headings count as which level | `sections` in `anaxi.json` | `"sections": {"D2": ["how it works"]}` |
| focus and stage caps | `caps` | `"caps": {"stage": {"shaping": "D3"}}` |
| any nudge | `nudges.off` or `nudges.severity` | `"off": ["N06"]` |

Some ideas won't fit any of these: a different axis than depth, a review step, a new kind of item. Try them in
the docs first, as headings, `about:` tags, checklists or a canvas. If one keeps proving useful, it can become a
default ([CHANGELOG.md](CHANGELOG.md) records each change and why). The levels and rubric below are the defaults.

## 1. Items

An **item** is anything you design: an epic, a story, a feature, a component, an API, a shared store, or one
section of a TDD. An item is a whole file (declared in front matter) or a heading (declared with a tag line, a
badge or a comment); see [FORMAT.md §1](FORMAT.md#1-declaring-an-item). Items can sit in any file, at any
heading level, in any doc you already have, including docs that follow your usual TDD template.

Items nest the way headings nest. A story under an epic is part of it. A small sub-item can be at D4 while its
epic is at D1.

**Sub-items inherit answers.** A sub-item doesn't repeat its parent's why, users or scope; it answers only what
is different about it. A question counts as answered for a sub-item when its parent answers it and nothing in
the sub-item contradicts that. This is what keeps small sub-items small.

An item gets an `@id` only if something else refers to it, for example a shared API. Everything else is
identified by its heading.

## 2. The ladder

Depth means **which questions have been answered**. It does not mean position in a document, word count, or
audience.

| Level | Name | It answers | Typical reader |
|---|---|---|---|
| D0 | **Why** | the problem, who has it, what success looks like, what we are not solving | sponsor, PM |
| D1 | **What** | behavior, scope in and out, acceptance criteria, edge behavior the user sees, what it touches | PM, QA, lead |
| D2 | **Shape** | parts and their jobs, technology choices, decisions with rejected alternatives, the risky part, quality needs | lead, architect |
| D3 | **Contract** | interfaces, data model, errors, failure behavior, state, compatibility | engineers on both sides |
| D4 | **Build** | ordered steps, file layout, code examples, test cases, rollout, done-when | implementer, agent |

Rules:

- **Levels are cumulative.** D3 means D0–D3 are all answered. The five levels are the default ladder; a
  project can rename, drop or add levels (§0). A claim counts only as far as the text backs it without a gap:
  build detail under a D4 heading doesn't make an item D4 when nothing is written at D2 and D3. The script
  counts it at the highest level reached with every level before it written (N05), and judges over-documentation
  by the deepest content (N06). Whether each level is *well* answered is still read, not counted.
- **Each level has principles and questions** ([QUESTIONS.md](QUESTIONS.md)): principles (aim, bounds,
  done-when) that hold everywhere; a small *core* of questions; the project's own questions
  (`anaxi-questions.md`); and the item's own questions, a checklist written by whoever works on it. A level
  is reached when every required, applicable question at that level and every level before it is **answered** or **skipped
  with a reason**, and the level's "done when" holds.
- **Not everything has to answer a question.** Each item can have a **canvas** for the shape of the idea,
  sketches, visuals and anything unbound. It doesn't count toward depth and no nudge polices it
  ([FORMAT.md §6](FORMAT.md#6-canvas-unbound-space)).
- **Questions are prompts, not forms.** One paragraph can answer three questions. The reviewer (person or agent)
  judges whether the question has been answered; the author doesn't tick boxes.
- **Technology names appear from D2.** D0 and D1 are written in the domain's own words, so they stay true if the
  technology changes. Languages, frameworks and libraries are chosen at D2 (`D2.shape`), with the project-wide
  choices in one shared `@stack` item. Exact packages and versions are D4 (`D4.plan`)
  ([QUESTIONS_REFERENCE.md §6.1](QUESTIONS_REFERENCE.md#61-libraries-frameworks-and-the-stack)).
- **D4 code is illustrative.** Code examples live in the doc to show the non-obvious parts. They are not the
  implementation, and the doc is not updated to track the code once it is built.

## 3. Target depth

Risk is a suggestion for the target, not a rule: write `depth: D1 → D3` and the written target is used. By
default, score four factors from 0 to 2:

| Factor | 0 | 1 | 2 |
|---|---|---|---|
| **Blast radius** | inside one component | one feature | crosses features, clients or services |
| **Reversibility** | revert a commit | needs a migration | one-way: stored data, public API, external contract |
| **Novelty** | done before here | a variant | new mechanism or new integration |
| **Certainty** | measured or known | inferred | guessed, or open questions |

| Total | Target |
|---|---|
| 0–1 | D1 |
| 2–3 | D2 |
| 4–5 | D3 |
| 6–8 | D4 |

- Write the scores in the tag (`risk: 2·2·1·0`) so the reasoning is visible and can be argued with.
- **Override** with a reason when the rubric is wrong for the item: `target: D3 (security review requires it)`.
- **Re-score when you learn something.** Certainty usually drops as questions get answered, and the target can
  come down with it.
- Profiles can change the factors, the thresholds, and set a minimum or maximum target ([PROFILES.md](PROFILES.md)).

### 3.1 Effective target: what is needed *now*

The risk target says how deep an item must go before it is built. Whether it needs to go that deep *now*
depends on the plan. Two caps say so:

| Cap | Set by | Values |
|---|---|---|
| **focus** | the item's `focus:` | `now`: no cap · `next`: D2 · `later`: D1 |
| **stage** | `stage` in `anaxi.json` | `discovery`: D1 · `shaping`: D2 · `pre-build`, `building`, `change`: no cap |

```
target    = rubric score → threshold, or target: override
            then raised by min rules, lowered by profile max
effective = min(target, focus cap, stage cap)
```

Every nudge compares depth with the **effective** target. The status table shows both (`D1 (D4)`). A
`focus: later` item doesn't nag to go deeper, and the same item written to D3 gets **over-documented**,
with no special rules. When the item moves to `focus: now`, the cap lifts and the full target applies.
The caps can be changed in `anaxi.json`.

**The gate always uses the full target.** Caps decide how much is worth writing now; they never make an item
ready to build with half its design.

## 4. The tag line

The fields below can be written as a tag line (a blockquote under the heading, shown here), as YAML front
matter for a whole file, as a heading badge, or in an HTML comment ([FORMAT.md §1](FORMAT.md#1-declaring-an-item)).
In a tag line, fields are separated by `·`, and the tag may run over several `>` lines.

```markdown
## Recurring tasks
> @recurring · depth: D2 → D3 · risk: 2·1·1·1 · about: data, async · focus: now
> uses: [@task-api](shared/task-api.md), @scheduler · open: DST handling for recurrences
> caveats: weekly and monthly only · later: custom RRULEs (when 10% of users use recurrence)
```

| Field | Meaning | Required |
|---|---|---|
| `@id` | first token; makes the item referenceable | only if referenced |
| `depth:` | `Dn → Dt` (current → target), `Dn enough` (or `Dn 🎯`) once it has reached its target depth, or just `Dn` (the target is then computed from `risk:`) | yes |
| `risk:` | the four scores, blast·reversibility·novelty·certainty | yes, unless the target is already known: from `target:`, from `Dn → Dt`, or from `Dn enough` (which means the target is Dn) |
| `target:` | explicit target with a reason; overrides the rubric | no |
| `about:` | free-form topics; project questions with a matching `when:` apply ([QUESTIONS.md §5.1](QUESTIONS.md#51-project-questions)) | no |
| `uses:` | shared items this depends on, as `@x` or `[@x](path)`; `@x (D3)` asks for a specific depth (§5) | no |
| `open:` | open questions, separated by `;`. Unchecked items in the item's question checklist count the same. Any open question keeps the item from *enough* | no |
| `skip:` | questions skipped on purpose, with a reason: `skip: D3.contracts (nothing stored or exchanged)` | no |
| `caveats:` | known limits accepted at this depth | no |
| `later:` | what is deliberately deferred, and what should trigger it (§6) | no |
| `superseded-by:` / `supersedes:` / `retired:` | the item was replaced, or dropped (§6.1) | no |
| `focus:` | `now` (default), `next` or `later`: is this item part of the current plan? Caps the effective target (§3.1) | no |
| `profile:` | use a different profile for this item | no |

`depth:` is the author's claim. The skill and reviewers check it against the questions. If the claim is
wrong, the tag gets corrected; nobody argues about the number.

## 5. Shared items

A **shared item** is anything several items depend on: an API, a data store, an auth flow, a scheduler. It is
tagged like any item, has an `@id`, and lives once, usually in a `shared/` folder or the doc of the team that
owns it.

- An item lists what it depends on in `uses:`.
- **How deep must a shared item be?** Deep enough for *its own* target: the shared item's risk decides its
  depth, not the items using it. `uses: @x` is satisfied when @x has reached its (full) target.
- **When you need more,** say so: `uses: @x (D4)` is satisfied only when @x is at D4. That raises @x's
  target to at least D4, and its owner sees who asked.
- When a shared item is short of what its users need, each user gets a **blocked-by-shared** nudge, and the
  shared item gets a nudge listing who is waiting on it.
- Relations are just `uses`. The direction is always "this item depends on that one", so "what is affected if
  @task-api changes" is the list of items whose `uses:` names it.

## 6. Enough, caveats, later

"Enough" is a first-class outcome, not a gap:

- `depth: D2 enough` (or `D2 🎯`) means the item reached its target depth and nothing is open. It is **documented
  and planned enough**. It says nothing about whether the item is built: Anaxi doesn't track delivery, so there
  is no "done" mark anywhere in it.
- `caveats:` records the limits accepted at this depth ("weekly and monthly only").
- `later:` records what is deliberately deferred, and the trigger for coming back: another item reaching a
  depth (`when @bulk-import reaches D1`), or an event in words (`when usage passes 10%`). Triggers that name an
  item and a depth are checked by the script. The others are surfaced for a person to judge.

### 6.1 Superseding, retiring, archiving

Docs are living: edit an item freely while it's being designed. **Supersede** it instead once something was
built from it, or once other items depend on it and the change isn't compatible: the old version then still
explains what exists, and the new one starts its own depth from D0 or wherever it really is. **Retire** what is
dropped with nothing in its place (a cut feature, a spike that answered its question). **Archive** a superseded
or retired doc when it gets in the way of reading the current ones, and **delete** it once nothing needs it;
git and `RETIRED.md` keep the trail. Marks, commands and what each state does: [FORMAT.md §10](FORMAT.md#10-superseded-retired-archived).

The method's own knowledge works the same way: changes are a line in [CHANGELOG.md](CHANGELOG.md), questions
move through Proposed, Challenged and Retired ([QUESTIONS.md §7](QUESTIONS.md#7-proposed-challenged-retired)),
and a replaced method doc goes to `archive/` with a header saying why it's kept, until git history is enough.

## 7. Composing TDDs and the super-TDD

Nobody writes a super-TDD. The docs, linked to each other, already are one; the tools only make it easier
to move around in. In order of how much tooling they need:

1. **The docs themselves.** Each item links to what it uses (`[@task-api](shared/task-api.md)`). A reader, or an
   agent, follows the links. Nothing has to be generated.
2. **The index** (`INDEX.md`): one generated, plain-markdown page listing every item with its badge, status
   icon, links, what it uses and what uses it. It is the super-TDD's table of contents, readable on GitHub and
   easy for an agent to start from.
   A TDD that would run to thousands of lines can keep its deep levels in **parts**: sections in an
   `APPENDIX.md` or files next to it, marked `part-of: @id`, that count as the item's own content
   ([FORMAT.md §9](FORMAT.md#9-parts-detail-kept-in-another-file)).
3. **A rendered document** (optional): one file composed from several items, for people who want to read a
   single doc or send it around.

| View | Contents | Use |
|---|---|---|
| **Item view** | one item, its depth badge, its questions answered and missing | writing, review |
| **Feature TDD** | one item and its sub-items, plus every shared item it `uses` (followed through their own `uses:`), at their current depth | design review, sign-off |
| **Super-TDD** | every tagged item in the project, read at a chosen depth (`--at D1` for sponsors, `--at D3` for engineers). Each shared item appears once, with the list of items that use it | onboarding, planning, cross-team review |
| **Status table** | item · depth → target · state (gap / enough / blocked) · holding it back · open questions · focus | stand-ups, planning |

"Read at D1" means each item shows only its D0–D1 content. The tools work out each section's level from the
headings you already use: common TDD section names map to levels ("Goals" → D0, "API" → D3), and an explicit
mark overrides that ([FORMAT.md §4](FORMAT.md#4-what-level-a-piece-of-content-is-at)). Nothing needs
restructuring. How the index and rendering work is in [TOOLING.md](TOOLING.md).

## 8. Workflow

1. **Tag** a new item: write the D0 answers, score the risk, set the target, and add the tag line. Takes
   minutes.
2. **Look up** the questions that apply at the next level (skill, or `anaxi-check questions @id`), and add the
   item's own questions as a checklist ([QUESTIONS_REFERENCE.md §7.1](QUESTIONS_REFERENCE.md#71-generating-an-items-questions-people-and-agents)).
   Put unbound thinking in the canvas.
3. **Deepen one level at a time.** Answer the next level's required questions. Record what you leave out as
   `skip:`, `caveats:` or `later:`.
4. **Stop at the target.** When the nudge says *enough*, stop. Going further triggers *over-documented*.
5. **Share** what others depend on: give it an `@id`, and have its users list it in `uses:`.
6. **Gate** before building: an item is ready to implement when it reaches its target with nothing open, and
   everything it `uses` is deep enough.
7. **Improve the questions:** promote item questions that keep recurring into `anaxi-questions.md`; share good
   ones in the library; propose or challenge core ones ([QUESTIONS.md §6](QUESTIONS.md#6-a-living-set)).

### 8.1 In a normal sprint

Anaxi adds no ceremonies, and it doesn't touch the tracker. It attaches to the ones you already have:

| You already do | With Anaxi | Extra effort |
|---|---|---|
| **Backlog refinement** | Score the risk of each candidate and set its target. Write D0–D1, or link the ticket to the doc that has them | a minute per item |
| **Definition of Ready** | The gate: the item is at its full target, nothing is open, and everything it uses is deep enough. Add it to your DoR as one line | none; it replaces a judgment call |
| **Sprint planning** | Read `INDEX.md` or `anaxi-check status --focus now`: what's ready, what's blocked and by whom, what's enough | none |
| **Design review / TDD review** | Review the doc as a PR, as now. The reviewer checks the claimed depth against the level's "done when" | less: reviewers know what depth to expect |
| **Spikes** | `profile: spike`, target at most D2, most of it in the canvas | none |
| **Retro** | Look at question friction (N16) and at incidents that "should have been asked"; adjust `anaxi-questions.md` | a few minutes, occasionally |
| **Tickets** | Link the ticket to the item (`[@recurring](docs/features/recurring-tasks.md)`). Status, estimates and "done" stay in the tracker | none |

What it does **not** do: estimate, assign, track progress or mark anything done. Velocity, story points and
boards are unchanged.

## 9. Who does what

| Actor | Does |
|---|---|
| **Author** | writes answers, claims depth, scores risk, adds item questions |
| **Reviewer** | checks the claimed depth against the questions; can lower it |
| **Scripts** | `anaxi-check` parses tags and reports structural nudges (gaps, blocked, enough, revisit, over-documented); `anaxi-render` composes TDDs ([TOOLING.md](TOOLING.md)) |
| **Agent skill** | everything the script does, plus semantic checks: which questions are really answered, over-engineering, content outside the item's focus ([skills/anaxi/SKILL.md](skills/anaxi/SKILL.md)) |
| **Project team** | keeps `anaxi-questions.md` short and current |
| **Method owner** | reviews proposed and challenged core questions and principles; updates [CHANGELOG.md](CHANGELOG.md) |
