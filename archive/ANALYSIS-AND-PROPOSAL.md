---
status: archived
created: 2026-10-10
reviews: STRATA.md v2, strata-check.mjs, examples/
---

# Layered design docs: analysis of Strata and a proposed system

> **Kept for its reasoning.** This is §1–5 of the 2026-10-10 review of Strata, the first layered-docs proposal.
> They explain why depth became the one thing Anaxi measures. The proposed redesign (§6–9) was judged too heavy
> and has been removed, along with Strata itself; both are in git history. The method that replaced it is in
> [the repo root](../README.md). Pointers to §6 in the text refer to that removed part.

## 1. What you are actually building

Take away the syntax and Strata is one idea:

> **A design is a set of statements at different distances from the code. Every statement has a stable
> address, and every statement is linked to the more abstract statement it answers to and the more concrete
> statements that answer to it. A reader, human or agent, can stop at any distance and see a picture that is
> complete and true at that distance.**

That gives you three things ordinary TDDs don't have:

1. **Altitude.** You can read the system at one level of detail without the levels below getting in the way.
2. **Lineage.** Any detail can be traced up to the reason it exists, and any reason can be traced down to the
   code that carries it out.
3. **Proportionality.** How deep you go is a choice, made per branch and driven by risk. It is not a template
   everyone fills in to the same depth.

None of the three requires markdown, word budgets, or the kind ladder. Those are one way to implement the idea,
and several of them are where the trouble comes from (§4).

## 2. Where it sits

| Prior art | What it shares with Strata | What Strata adds |
|---|---|---|
| **Stepwise refinement** (Wirth, 1971) | each level refines the one above | refinement made addressable and machine-checked |
| **C4 model** (context → container → component → code) | zoom levels | open depth, decisions, readiness; C4 has no "why" and no gate |
| **MDA** (CIM → PIM → PSM → code) | a vendor-free layer above a vendor-bound one | the vendor-leak check (S06) *is* the PIM purity rule |
| **Zachman rows** (planner → owner → designer → builder → subcontractor) | perspectives ordered from intent to build | Zachman is a taxonomy; Strata is a working method |
| **ADRs** | decisions with rejected alternatives | decision *scope*: decisions bind downward |
| **Requirements traceability** (DOORS, ReqIF) | stable IDs, links, impact | low ceremony, prose-first. Strata lacks DOORS's *suspect links* (§6.5) |
| **DDD ubiquitous language** | domain terms kept free of technology at the top | nothing yet. Strata has no lexicon (§4.6) |
| **Minto pyramid** | every parent summarizes its children | the growth ratio is a numeric stand-in for the pyramid rule |

Read honestly, Strata is a well-built modern blend of C4 + MDA + ADR + traceability. Its original
contributions are the **ghost-edge rule**, **risk-scored depth**, **parked/grow-when**, and the **readiness
gate**. Those four are worth keeping whatever the system ends up being called.

## 3. What is strong, and why

| Idea | Why it works | Keep? |
|---|---|---|
| **Edge lineage / ghost edges** (S10) | Forces every low-level interaction to show up in the high-level map, so the summary can't hide coupling. In the original example it found two hidden interactions. | Yes, generalized to every level (§6.5) |
| **`needs:` rubric** (blast radius, reversibility, novelty, certainty) | Detail proportional to the cost of being wrong. The best practical rule in the doc. | Yes, unchanged |
| **`parked` + `grow-when:`** | "Enough for now" made explicit, with a trigger to come back. Fixes the usual choice between over-documenting and forgetting. | Yes, generalized to `revisit-when` |
| **Gate** | A mechanical definition of ready. | Yes; it becomes the input to plan generation |
| **Decisions with `Rejected:`; `Local choice:`** | Separates choices that bind others from choices that don't. | Yes, with scope fixed (§4.5) |
| **Depth-free IDs, pointer parents, tombstones** | References survive moves and renames. The v2 migration proved it. | Yes; replace the ledger with a lock file (§6.5) |
| **Altitude views with link roll-up** (viewer slider) | The L2 interaction map comes out of the detailed graph, not a hand-drawn diagram. | Yes, and extend it |
| **Fixture-driven checker** (`broken/EXPECTED`) | Every rule has a test that breaks it. | Yes |
| **Truth flows up** | The right principle. Right now nothing enforces it. | Yes, made checkable (§6.5) |

## 4. Where the model is confused

This is the core of the review. Each problem below is a place where one word or one field carries two or more
meanings. That is a semantic problem before it is an engineering one.

### 4.1 "Depth" means five things

A level in Strata stands for all of these at once:

| Axis | Question it answers | Example |
|---|---|---|
| Decomposition (part-of) | what is this made of? | intake → intake-pipeline |
| Abstraction (what → how) | how concrete is this? | behavior → topology → schema → code |
| Binding (platform-free → platform-bound) | is a vendor named yet? | "a durable queue" → "SQS FIFO" |
| Resolution (word count) | how much is said? | 113 words per L2 node → 1,664 per build leaf |
| Audience | who stops reading here? | sponsor, lead, implementer |

v1 tied all five to the level number. v2 rightly split *abstraction* off into `kind`. It still left
decomposition and refinement sharing a single relation.

### 4.2 `up:` is two relations

- `TF.intake-pipeline up: TF.intake` means **part-of**: the pipeline is one part of intake. Siblings should
  *together cover* the parent.
- `TF.normalizer-lambda up: TF.submission-envelope` means **realizes**: the code carries out the contract. It
  is not a part of it. One child can realize the parent completely.
- `TF.submission-envelope up: TF.intake-pipeline` means **specifies the boundary of**: the envelope is the
  interface the pipeline exposes. Its other party, the planner, lives in another branch.

These relations have different logic. Part-of calls for coverage: do the children add up to the parent?
Realizes calls for conformance: does the child do what the parent says? Interfaces have two sides and no single
parent. Putting all three under one `up:` is why the spec needs rules like "a contract may sit under a contract,
but not under a build node". Those rules are patches for a missing distinction.

### 4.3 The three kinds are three different speech acts

| Kind | Speech act | Lifetime |
|---|---|---|
| `architecture` | **descriptive**: "the system is built like this" | as long as the part exists |
| `contract` | **normative**: "both sides agree to this" | versioned; outlives any one implementation |
| `build` | **imperative**: "write this code" | consumed when executed, then becomes a record |

Putting them on one ladder suggests they differ only in how much detail they hold. In fact they differ in what
they are. That has practical effects:

- **Contracts are boundaries, not levels.** The submission envelope has producers in intake and a consumer in
  scheduling. Filing it as a child of one side hides the other side.
- **Build leaves rot.** A 4,000-word hand-written code leaf duplicates the code the moment the code exists.
  The spec half-admits this ("a verified build leaf may shrink to its interop table"). A build leaf is a
  *plan*, and plans should be generated, carried out, and collapsed into a record.

### 4.4 Links have no defined meaning, so impact runs in the wrong direction

The example uses 16 link verbs across 27 nodes. Three of them (`submits`, `collects`, `authenticates-with`) are
not in the suggested list. The checker treats every link the same way, and impact follows inbound edges whatever
the verb. The result, from the shipped example:

```
$ strata-check examples/taskflow --impact TF.intake --hops 1
  direct   TF.identity   guards→TF.intake      ← backwards: intake depends on identity
  direct   TF.nudges     prompts→TF.intake
  ...                                           ← TF.scheduling is missing, though it consumes intake's output
```

`feeds` points *with* the data flow, `uses` points *against* it, and `guards` points from the provider. Impact
analysis needs one thing: **who depends on whom**. Verbs are fine as prose labels, but the graph needs a direction
with defined semantics.

### 4.5 A decision's scope is set by depth, not ancestry

S13 allows `decided-by` to cite any decision at a shallower depth. In the example:

- `D-TF-03` lives in `TF.auth` (L3, identity branch). It binds `TF.task-create-flow` (L4, intake branch).
- `D-TF-05` lives in `TF.intake-pipeline` (L3). It binds `TF.task-create-flow` (L4, under `TF.app-capture`, a
  sibling subtree).

Both citations are legal only because of an accident of depth. Move `task-create-flow` up one level and the
same citations become errors. The real situation is that D-TF-05 (deduplicate on `submissionId`) is a decision
about the **interface between the app and the queue**. It has no proper home because interfaces aren't
first-class. The fix: a decision binds the subtree of the node that holds it, plus the interfaces that node
owns. A decision several branches need belongs at their common ancestor or on the shared interface.

### 4.6 There is no lexicon, and terms drift across layers

The word "task" names four different things depending on altitude:

| Altitude | "task" is | Representation |
|---|---|---|
| intent | something I need to do | prose |
| capability | a normalized submission owned by a user | prose |
| contract | a `TaskDraft`, then an `EnvelopeV1`, then a task record | three schemas |
| build | `TaskDraft` struct, `EnvelopeV1` zod type, `TASK#` item | code |

That is **concept lineage**, the vertical counterpart of interaction lineage, and it is where most TDD
misunderstandings start ("by *task* do you mean the draft or the record?"). Strata tracks lineage for edges but
not for concepts. A small glossary, where each term lists its representation at each layer, closes the gap. It
also replaces the hand-kept `vendorTerms` list with something more principled: terms marked as technology may
not appear above the binding line.

### 4.7 Only the left side of the V

In V-model terms, Strata describes requirement → design → code but not acceptance ← system test ← contract test
← unit test. It is also missing:

- **Non-goals.** Every good TDD has them, and they are the cheapest scope control there is.
- **Quality attributes** (latency, availability, cost, privacy) with budgets that split as they go down.
  "200 ms command timeout" appears in the Redis node, but nothing ties it to a system-level latency target.
- **Verification.** Nothing says how a node will be shown to be true. A `verified` state with no named checks
  rests on trust.
- **Rollout and migration**, which most real TDDs are mostly about.

### 4.8 Word budgets measure the wrong thing

The 2–8× growth ratio and per-kind ceilings stand in for "the parent summarizes its children". They are easy to
game: pad or trim words. They also fire on content that is fine, such as a terse but complete contract. What the
rule is really after is **coverage** (does the parent account for every child and every interaction?) and
**consistency** (does any child contradict the parent?). Coverage can be checked mechanically. Consistency can't,
but going stale can be detected (§6.5). Keep size as a soft hint at most.

### 4.9 Ceremony that the tools should carry

The append-only `strata.ids` ledger, hand-managed tombstones, the `·`-separated meta line, and kind defaulting
rules are fine for an expert team using the checker. For a team writing TDDs under deadline they are friction.
Most of it can be generated, for example by comparing IDs against the base branch in CI, or written by an
authoring agent.

## 5. Fit for TDDs, implementation plans, and software design

| Use | Fit today | Why | Fit after §6 |
|---|---|---|---|
| **Software design** (living architecture model) | **High** | Already shaped as an architecture model; views and impact are the right tools | High: first-class interfaces and qualities fill the gaps |
| **TDDs** | **Medium** | Maps onto TDD sections, but one TDD is spread across many files, there is no linear rendering for reviewers, no non-goals, rollout or testing, and it assumes a greenfield project. A TDD is a point-in-time *proposal*; Strata is a living *model*, and the spec never reconciles the two. | High: **a TDD is a delta against the model plus a linear rendering** (§6.8) |
| **Implementation plans** | **Low–medium** | The gate exists, but "a plan is a list of gate IDs" gives no ordering, no tasks and no acceptance. Build leaves are hand-written code that rots. | High: **the plan is a query over the graph** (§6.9) |
| **Agent context** (not in the spec, but probably the biggest win) | Latent | `--view` and paths already hint at it | Very high: a context pack per node (§6.7) |

The fourth row matters most. A coding agent fails when it gets either too little context (it guesses the
contract) or too much (it drowns in the whole TDD). A typed, addressable design graph is the right shape for
assembling **just enough context for one unit of work**: the reasons above it, the contracts around it, the
decisions that bind it, and nothing else. That is drilldown documentation used as context engineering.
