# Choosing questions: a reference

How to decide what a project and an item should be asked, depending on the kind of project, how far along it
is, and the kind of item. Also: how people and agents write their own questions, where unbound thinking goes,
and how the questions change over time. The principles and core questions themselves are in
[QUESTIONS.md](QUESTIONS.md).

## 1. Who decides what

| Layer | Where | Decided by | Applies |
|---|---|---|---|
| **Level definitions** | QUESTIONS.md §3 | fixed | always: they are what the levels mean |
| **Principles** | QUESTIONS.md §2, plus the project's own | everyone | a starting set each project adapts |
| **Core questions** (10) | QUESTIONS.md §4 | method owner | always, unless the project rewords or skips them with a reason |
| **Project questions** | `anaxi-questions.md` in the project | the project's team | to every item, or to items whose `about:` matches `when:` |
| **Item questions** | a checklist in the item | whoever works on the item: author, reviewer, agent | to that item |
| **Library** | [skills/anaxi/references/question-library.md](skills/anaxi/references/question-library.md) | anyone can add | **never on its own**; only what gets copied in |

**Overrides.** The project file can add questions, and make core ones optional, reworded or dropped (with a
reason). An item can `skip:` any question, with a reason. Nobody can change the principles or what a level
means. That keeps depth comparable across projects, so D3 in one team means D3 in another.

**Why the method keeps so little.** A global list has to be right for every project, and it never is. The
principles are general enough to be right everywhere; the specific questions come from people and agents who
know what they're working on.

## 2. A five-minute setup

1. **Pick a profile and a stage** in `anaxi.json` (§3, §4; [PROFILES.md](PROFILES.md)). They set targets, caps
   and nudges, not questions.
2. **Read the core.** For each required question, ask: would skipping this be fine on most items here? If so,
   reword it to fit, or `skip-all:` it in `anaxi-questions.md`, with the reason. With ten broad questions this
   should rarely be needed.
3. **Add what this project keeps getting wrong.** Look at the last few incidents, painful reviews and rewrites.
   Turn each into one question at the level where it would have been caught. Borrow wording from the
   library. Two to five questions is plenty.
4. **Stop.** Item questions will cover the rest as people work (§7). Revisit after the first few items (§8).

## 3. By kind of project

What to lean on, and where to borrow from. These are suggestions to copy, not rules that apply.

| Project kind | Principle to lean on, or add | Borrow from the library | Typical changes to core |
|---|---|---|---|
| Web app (frontend + backend) | domain words before technology; commit or explore | UI, APIs | — |
| Backend service / API | one home per fact (shared APIs) | APIs, queues, infrastructure, core extras (qualities) | — |
| Mobile app | add your own: "old app versions are users too" | mobile apps, UI, APIs | — |
| Data pipeline / analytics | truth flows up (schemas drift) | data pipelines, data and storage | reword `D1.behavior` as "what bad, late or duplicated input arrives" |
| ML / LLM feature | name the unknown (quality is uncertain) | ML and LLM features | — |
| Library / SDK | decide visibly (every public choice is a promise) | libraries and SDKs, APIs | `D0.why` means "which teams" |
| Infrastructure / platform | proportional (blast radius is large) | infrastructure, changes to existing systems | `D1.acceptance` phrased as checks, not user stories |
| Third-party integration | name the unknown (their behavior isn't yours) | integrations, queues | — |
| Internal tool / script | proportional | — | `skip-all: D2.decisions` when items are trivial |
| Spike / prototype | commit or explore: most of it is canvas | spikes | `D0.why` reworded as "what question does this answer?" |
| Regulated (PII, payments, health) | decide visibly; say what you leave out | security and privacy, data | none relaxed in security |

## 4. By how far along the project is

The stage caps how deep anything needs to be *for now* ([METHOD §3.1](METHOD.md#31-effective-target-what-is-needed-now)).
It also changes which questions are worth asking.

| Stage | You know | Cap | Ask mostly | Use the canvas for |
|---|---|---|---|---|
| **discovery** | the problem, roughly | D1 | D0, `D1.behavior`, `D1.touches` | the shape of possible solutions; competitor screenshots; rough flows |
| **shaping** | what to build | D2 | D1, `D2.shape`, `D2.decisions` | options not yet decided; architecture sketches |
| **pre-build** | most of it | none | D3 on risky items; D4 where agents will build | edge cases still being explored |
| **building** | it's being built | none | `D4.plan`; `later:` triggers | what was learned while building, before it is promoted |
| **change** (brownfield) | an existing system | none | `D1.touches`, `D3.contracts`, migration questions from the library | how it works today, before the change |

**Brownfield:** before the first change, give the existing system's important shared parts (APIs, stores, auth)
a tag at D1–D2. New items `uses:` them, and a shared item that doesn't exist can't warn anyone.

## 5. By kind of item

Targets come from risk, not from item type. In practice items tend to land in these ranges. Well outside the
range, check the risk score.

| Item | Usual target | Notes |
|---|---|---|
| Epic / initiative | D1, sometimes D2 | D2 when it fixes the stack or crosses teams. The detail lives in its stories |
| Feature / story | D2–D3 | D3 when it stores data or crosses a boundary |
| Shared item (API, store, auth, scheduler) | D3 | many things depend on it, so its risk scores high |
| `@stack` | D2 | §6.1 |
| Bug fix | D1 | D2 when the fix changes a contract |
| Spike | ≤ D2 | the output is a decision, not a design |
| Item an agent will build | D4 when novelty ≥ 1 | §6.2 |

## 6. Special cases

### 6.1 Libraries, frameworks and the stack

| Where | What |
|---|---|
| **`@stack`**, one shared item per project | languages, frameworks, main libraries, services, and why each was chosen |
| **each item, D2** (`D2.shape`) | only what is new or different from `@stack`, and why |
| **each item, D4** (`D4.plan`) | exact packages, versions and config added or changed |

Items that rely on the stack add `uses: @stack`. When `@stack` changes (a framework upgrade, say), every item
using it gets a recheck nudge (N11). D0–D1 never name technologies (domain words before technology).

### 6.2 When agents build

Agents ask fewer questions than colleagues, so the written answers matter more. Either raise the floor for
agent-built items (`"targets": { "rules": [{ "about": "agent", "min": "D4" }] }` in `anaxi.json`, plus
`about: agent` on the item), or add a rubric factor, *implementer familiarity* (0 = the builder knows the area,
2 = new to it).

### 6.3 A question that doesn't fit one item

Skip it with a reason. When the same skip and reason show up on several items, the question is wrong for the
project, not for the items: change `anaxi-questions.md` (N16 points this out).

## 7. Writing your own questions

### 7.1 Generating an item's questions (people and agents)

When you start on a level, generate the item's questions from the principles rather than from a list:

1. **Read what the item is:** its D0–D1, `about:`, what it `uses:`, and the kind of project.
2. **Take the level's "done when"** ([QUESTIONS.md §3](QUESTIONS.md#3-the-levels-aim-bounds-done)).
   Ask: *for this item, what could stop that being true?* For D3, "two people could build the two sides
   separately": what would they have to ask each other?
3. **Each answer is a question.** Check the core and project questions first, and don't repeat them. Borrow
   wording from the library if something there fits.
4. **Write them as the item's checklist**, with the level: `- [ ] D3 · What happens to an occurrence in a DST
   gap?` Keep it short: zero to five per level. The core already covers the basics.
5. **Answer, then check the box.** Questions that keep coming up across items are candidates for the project
   file (§8).

### 7.2 What makes a good question

| Test | Bad | Good |
|---|---|---|
| **Prevents a named failure** | "Have you considered performance?" | "Which qualities matter here, with numbers?" |
| **Answerable** | "Is this the best design?" | "Which alternatives were rejected, and why?" |
| **Asks, doesn't prescribe** | "Which microservices will this use?" | "What are the parts, and what is each one's job?" |
| **One concern** | "What are the APIs, errors and SLAs?" | three separate questions |
| **At the right level** | D1: "Which database?" | D1: "What information is owned?" · D2: "Which store, and why?" |
| **Specific to its scope** | core: "How is the GraphQL schema versioned?" | project file, `when: api`: "How is the schema versioned?" |

### 7.3 Where a question goes

```
Is it about this item only?                                    → item checklist
Does this project keep needing it?                             → anaxi-questions.md
Would it help other projects?                                  → also add it to the library
Would it be wrong to skip it on any reasonable project?        → propose it for core (rare)
Is it really a rule about what belongs at a level?             → propose a principle (rarer)
```

## 8. How the questions adapt

| Signal | Source | Suggests |
|---|---|---|
| The same item question on several items | review, `anaxi-check questions --repeated` | promote it to the project file |
| The same skip and reason on several items | N16 | relax or drop that question in the project file |
| Several projects drop or relax the same core question | their `anaxi-questions.md` | move it out of core, into the library |
| A project question copied into several projects | the library | candidate for core |
| An incident or rewrite whose cause "should have been asked" | postmortems | a project question, with the incident as its *why* |
| An agent couldn't interpret a question | N16 from the skill | reword it |
| A question answered with boilerplate everywhere | review | reword or drop it |

**Cadence:** the project file whenever the team likes; core and principles once a quarter, or when Proposed
has a few rows. Prefer removing to adding. A question set that only grows turns into the form the method set out
to avoid.

## 9. The canvas: shape, ideas, visuals and other unbound thinking

Not everything worth writing answers a question. The **shape** of a feature before anyone has decided
anything, a mockup, a flow sketched on a whiteboard, an analogy, a "what if we…": these belong in the
**canvas**, a part of any item that no question governs ([FORMAT.md §6](FORMAT.md#6-canvas-unbound-space)).

**What goes in it**

- The shape of the feature or idea: how it might feel, the rough parts, the order things happen in.
- Visualizations: Mermaid diagrams, screenshots, mockups, sequence sketches, tables of options.
- Alternatives still in play, before one becomes a decision.
- Context that helps but isn't a commitment: links, prior art, conversations, notes from a call.
- Thoughts for later that aren't concrete enough for `later:`.

**How it relates to the levels**

| | Levels (D0–D4) | Canvas |
|---|---|---|
| Governed by | principles and questions | nothing |
| Counts toward depth | yes | no |
| Nudges | all of them | none, except "promote this" (N17) |
| Readers may rely on it | yes | as context only, never as decided |

**Using it well**

- **Start there when you don't know the shape yet.** In discovery and shaping, most of an item can be canvas
  with only D0 committed. That's fine, and nothing will nag about it.
- **Promote as you decide.** When something in the canvas becomes a decision, an answer or a contract, move it
  into its level (commit or explore, and say which). The canvas keeps the sketch; the level keeps the commitment.
- **Visuals can live in both.** A diagram in the canvas is a sketch. The same diagram under "Proposed design" is
  the design. Move it when it stops changing.
- **Don't use it to hide work.** If reviewers or agents need something to do their job, it isn't canvas.
