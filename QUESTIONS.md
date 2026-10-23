# Anaxi questions and principles

What each level means, in three layers. Only the first two are maintained here.

| Layer | What it is | Where | Maintained by |
|---|---|---|---|
| **Principles** (§2) | a starting set of guideposts, adapted per project | this file, and the project's own | everyone |
| **Level definitions** (§3) | what each level is for, what belongs in it, and when it's done | this file, or `levels` in `anaxi.json` | method owner, then the project |
| **Core questions** (§4) | ten broad questions that hold for every item in every project | this file | method owner |
| **Your questions** (§5) | questions the people and agents working on a project add, for the project or for one item | the project's docs | whoever is working on it |

**Why it works this way.** Nobody can keep a global bank right for every API, mobile app, pipeline and
model. The people and agents doing the work know what they're working on, so they write the specific
questions, guided by the principles. The method keeps only what is true everywhere. For inspiration there is a
non-binding [question library](skills/anaxi/references/question-library.md) by topic and kind of project; nothing in it
applies unless someone copies it in.

How to choose and write questions for a project, a stage or a kind of item is in
[QUESTIONS_REFERENCE.md](QUESTIONS_REFERENCE.md).

## 1. How questions are used

- **Interpret, don't fill in.** Answer what the question is after, in whatever form fits: a sentence, a
  table, a diagram.
- **One answer can cover several questions.** No per-question headings needed.
- **"n/a" is an answer when it comes with a reason:** `skip: D3.failure (fire-and-forget metric, no caller)`.
- **Question the question.** If it doesn't fit, say so (§6) instead of quietly skipping it.
- **When no question covers something important, the level's "done when" still does** (§3). It is the final
  test of a level, whatever the questions say.

## 2. Principles

Principles are guideposts, not rules. They describe habits that keep docs useful at any level. This is a
**starting set**: a project can reword, drop or add its own in the `## Principles` section of
`anaxi-questions.md` (§5.1), and should, once it learns what keeps going wrong for it.

- **Proportional.** Depth follows risk. Stop at enough.
- **Answer, don't fill.** Questions are prompts, not forms. Prose, tables, diagrams; several answers in one paragraph.
- **Say what you leave out.** `skip:`, `caveats:` and `later:`, each with a reason or a trigger.
- **One home per fact.** Write shared things once (`@task-api`, `@stack`) and link to them.
- **Domain words before technology.** D0–D1 name no technology, so they stay true when the technology changes.
- **Truth flows up.** When deeper detail changes the story, fix the higher level in the same change.
- **Decide visibly.** Every decision names what it beat, and why.
- **Name the unknown.** Open questions are written down, with what they block.
- **Commit or explore, and say which.** Committed content goes in the levels; exploration goes in the canvas
  ([FORMAT.md §6](FORMAT.md#6-canvas-unbound-space)).

## 3. The levels: aim, bounds, done

These are the default definitions. A project can rename a level, rewrite its "done when", drop the top levels
or add new ones in `anaxi.json` ([METHOD.md §0](METHOD.md#0-defaults-not-rules)). Projects that share items
should keep the same ladder, so D3 means the same thing on both sides.

| Level | Aim | In bounds | Out of bounds | Done when |
|---|---|---|---|---|
| **D0 Why** | why this is worth doing | the problem, the people, the outcome, non-goals | any solution | someone could argue for or against doing it |
| **D1 What** | what it does, seen from outside | flows, scope in and out, acceptance, edge behavior, dependencies | technology, internal structure | QA could write the acceptance tests |
| **D2 Shape** | how it is built, roughly | parts, flow, stack, decisions, risks, qualities | field-level detail, code | a lead could estimate it and find the risky part |
| **D3 Contract** | the boundaries, exactly | interfaces, data, errors, failure behavior, states, versioning | implementation steps | two people could build the two sides separately |
| **D4 Build** | buildable without asking | steps, files, dependencies, examples, tests, rollout, done-when | new decisions (raise them to D2 or D3) | an agent could build it without asking a question |

Out-of-bounds content isn't wrong, it's misplaced. Move it to the level it belongs to, to `later:`, or to the
canvas.

## 4. Core questions

Two per level, one at D4. They are deliberately broad: each one is a prompt that the item answers in its own
way, and the item's own questions (§5.2) fill in the specifics. A question is core only if **it would be wrong
to skip it on any reasonable project**. The narrower questions that used to be core are in the
[library](skills/anaxi/references/question-library.md#core-extras).

The table has fixed columns (ID, Question, Why it matters) because the scripts read it ([TOOLING.md](TOOLING.md)).
All core questions are required: answer them, or skip them with a reason.

### Core

| ID | Question | Why it matters |
|---|---|---|
| D0.why | What problem are we solving, for whom, and how will we know it worked? | solutions without a stated problem and outcome can't be judged |
| D0.non-goals | What are we deliberately not solving? | the cheapest scope control there is |
| D1.behavior | What does it do, and not do, step by step, including when things are empty, wrong, duplicated or late? | the shared picture everything else refines; most surprises live in the edge cases |
| D1.acceptance | How will we know it behaves that way? Give acceptance criteria someone could test. | turns intent into something QA and agents can check |
| D1.touches | What other features, systems or shared items does it depend on or change? | becomes `uses:`; hidden dependencies cause most late surprises |
| D2.shape | What are the parts, how do they connect, and what do they run on (only what's new compared with @stack)? | gives D3 its boundaries, and fixes the platform |
| D2.decisions | Which decisions were made, what did each one beat, and what is the riskiest part? | stops the same debate happening twice; points the next level at what matters |
| D3.contracts | For every boundary, what crosses it, in exactly what shape, and what must stay compatible? | lets each side be built separately; stored data and shared formats are the hardest things to change |
| D3.failure | What can go wrong at each boundary, and what does each side do then? | callers handle only what they're told about; most systems fail here |
| D4.plan | What are the steps, files, exact dependencies and tests, with code examples for anything non-obvious, and how does the builder know it's finished? | the plan an engineer or agent follows, and its stopping condition |

## 5. Your questions

### 5.1 Project questions

A project keeps its own questions in **`anaxi-questions.md`** at its docs root: plain markdown, next to the
docs, and edited like them. It can add questions and change core ones:

```markdown
# Project questions

## Added
- **D2.pci** · Does card data pass through this, and which PCI scope does it touch? · when: payments · why: PCI scope found late forces a redesign
- **D1.offline** · What works offline, and what happens to actions taken offline? · why: half our users commute
- D3 · Which app versions still in the field call this? · when: api

## Changes to core
- skip-all: D2.decisions · every item here is a small config change
- reword: D1.behavior → What does it do with good input, and with bad, late or duplicated input?

## Principles
- **Old app versions are users too.** Anything the app calls is a public contract.
```

- A line is `level · question`, with optional `when:` (topics from the item's `about:`; without it, the
  question applies to every item) and `why:`. An `opt` marker makes it optional.
- **Changes to core:** `reword:` keeps the question but asks it the project's way; `skip-all:` skips it on every
  item, with a reason (shown once in `status`).
- **Principles:** the project's own, added to or replacing the starting set (§2). Write `drop: <name>` to drop
  a starting one.
- **IDs are optional.** Give one (`**D2.pci**`) when people will `skip:` it or refer to it. Otherwise the tools
  make one from the text.
- Template: [templates/anaxi-questions.md](templates/anaxi-questions.md).

### 5.2 Item questions

The questions for *this* item, added by the author, a reviewer or an agent as they work, are a markdown
checklist inside the item, usually under an "Open questions" heading:

```markdown
### Open questions
- [x] D1 · Editing a series: this one, or all future ones? → all future ones (see Behavior)
- [ ] D3 · What happens to an occurrence that falls in a DST gap?
- [ ] Should paused series still count toward the weekly cap?
```

- **Unchecked** questions at or below the item's effective target block it from reaching that level, just like
  `open:` in the tag (N03).
- **Checked** questions are answered. Write the answer after `→`, or point to where it is.
- The level prefix is optional; without it, the question counts as open whatever the item's depth.
- An item question that keeps coming up across items should be promoted to the project file (§6).

## 6. A living set

**Promotion path:**

```
item question → project question (anaxi-questions.md) → core question (this file)
```

A question moves up when it has proven itself in more than one place. Promoting to core is rare and has to pass
the core test (§4). The library ([skills/anaxi/references/question-library.md](skills/anaxi/references/question-library.md))
collects good project questions for other projects to borrow. Getting a question into the library is easy;
getting into core is hard, and core should shrink before it grows.

**Proposing a change** to core or the principles: add a row to Proposed (§7) with the failure it would have
prevented, ideally a real one. **Challenging** a core question: add a row to Challenged with what didn't fit and
the change you suggest. Agents do the same: they say how they interpreted an unclear question, answer that
interpretation, and offer a row. The method owner reviews both, and every accepted change is one line in
[CHANGELOG.md](CHANGELOG.md).

Signals and cadence are in [QUESTIONS_REFERENCE.md §8](QUESTIONS_REFERENCE.md#8-how-the-questions-adapt).

## 7. Proposed, challenged, retired

### Proposed

| Level | Question or principle | Failure it prevents | Proposed by | Status |
|---|---|---|---|---|
| — | | | | |

### Challenged

| ID | What didn't fit | Suggested change | Raised by | Status |
|---|---|---|---|---|
| 25 core questions | too many; most were specifics of a broader question | merged into 10 broad questions; the rest moved to the library | 0.4 review | resolved 0.4 |

### Retired

| ID | Retired | Why |
|---|---|---|
| D0.problem, D0.who, D0.success, D0.why-now, D1.scope, D1.edges, D1.terms, D2.parts, D2.flow, D2.stack, D2.risky, D2.qualities, D3.interfaces, D3.errors, D3.data, D4.steps, D4.where, D4.dependencies, D4.examples, D4.tests, D4.done-when | 0.4 | merged into the ten core questions, or moved to the library. Old `skip:` entries map to the question that absorbed them |
