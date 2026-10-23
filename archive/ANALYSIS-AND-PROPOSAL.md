---
status: proposal
created: 2026-10-10
reviews: STRATA.md v2, strata-check.mjs, examples/
working-name: Anaxi (see §9)
---

# Layered design docs: analysis of Strata and a proposed system

> **Superseded in part (2026-10-10).** The analysis (§1–§5) stands. The proposed system (§6–§7) was judged too
> heavy. The simpler method that replaced it is in [the repo root](../README.md).

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

## 6. Proposed system

### 6.1 Principles

1. **Two drilldowns, kept apart.** *Zoom* goes into parts (part-of). *Resolution* goes from what to how within
   one element. Interfaces sit between parts, not under them.
2. **Statements have types, and types have lifetimes.** Descriptions last, contracts are versioned, plans are
   consumed.
3. **Dependencies have a direction.** One relation (`uses`) carries impact and build order. Verbs are labels.
4. **Every level is complete at its own altitude.** Enforced by lineage (edges) and coverage (children), with
   staleness detected when a child changes.
5. **Depth is proportional to risk.** Kept from Strata.
6. **Plans and context are views, not documents.** Generate them from the model; never write them twice.
7. **Ceremony belongs to tools.** Authors write prose and a few fields. IDs, ledgers, renders and plans are
   produced for them.

### 6.2 Ontology: entity types

**Structural (the zoom tree, `part-of`):**

| Type | Is | May contain | Binding |
|---|---|---|---|
| `intent` | the need, in the sponsor's words; success measures; **non-goals** | prose | no technology |
| `system` | the whole as one box; actors, boundary, owned data | prose | no technology |
| `capability` | one thing the system does: behavior, guarantees, owned data, dependencies on siblings | prose, diagrams | no technology (**the binding line**) |
| `component` | a technical part: technology, topology, patterns. Nests to any depth. | prose, diagrams, decisions | technology allowed |
| `resource` | a shared component with many users (store, bus, provider) | as component | technology allowed |

**Boundary (outside the tree, owned by one element):**

| Type | Is | Fields |
|---|---|---|
| `interface` | a contract between parts: API, event, message, schema, keyspace, state machine | `owner:`, `version:`, data, operations, errors, failure semantics. May `extend:` a parent interface (pagination rules under an API) |

**Work (ephemeral):**

| Type | Is | Fields |
|---|---|---|
| `plan` | how to build one component or interface: steps, code sketches, tests to write | `realizes:`. Collapses into `impl:` and `checks` on the target once done |

**Annotations (attach to any element or interface):**

| Type | ID | Is |
|---|---|---|
| decision | `D-…` | a choice that binds the holder's subtree and owned interfaces; `status: proposed / accepted / superseded-by D-…`; `Rejected:` required |
| constraint | `C-…` | a quality attribute with a budget; children `allocate:` parts of a parent budget |
| question / assumption | `Q-…` / `A-…` | open or resolved; `blocks:` names what it holds up. An assumption becomes a question once doubted. |
| check | `K-…` | how something is shown true: `acceptance`, `contract`, `integration`, `unit`; `verifies:`; `test:` path |
| term | `T-…` or glossary file | definition, synonyms to avoid, `realized-as:` per element (concept lineage) |

Strata's three kinds map as follows: `architecture` → `component`; `contract` → `interface`; `build` → `plan`.
Depth now means part-of distance only.

### 6.3 Relations

| Relation | From → to | Semantics | Used for |
|---|---|---|---|
| `part-of` (`up:`) | element → element | decomposition; the one tree | zoom, views, roll-up |
| `uses` | element → interface or resource | **the source depends on the target**. Optional role label: `calls`, `produces`, `consumes`, `reads`, `writes`, `subscribes` | impact, build order, lineage |
| `depends-on` | capability → capability | the summary-level form of `uses`; required by lineage | L2 interaction map |
| `owner` | interface → element | who may change it | impact, review routing |
| `extends` | interface → interface | refinement of a contract | contract drilldown |
| `decided-by` | any → decision | must be within the decision's scope | binding check |
| `allocates` | constraint → constraint | budget split | quality roll-up |
| `verifies` | check → any | evidence | gate, verified state |
| `realizes` | plan → component/interface | work target | plan derivation |
| `impl` | component/interface → code path | traceability to code | drift detection |
| `revisit-when` | any → any | trigger to deepen or review | G02-style signals |

**Impact** of changing X is then well defined:

- X is an interface: everything that `uses` it, then everything that depends on those, and so on.
- X is an element: the interfaces X owns are *at risk*, and their users are flagged as possible impact.
- Interaction direction (who sends data to whom) appears as a label in the viewer and has no effect on impact.

### 6.4 Resolution ladder (the second drilldown)

Each element answers more questions as it matures. The resolution an element has reached is visible, and
`needs:` sets the target:

| R | Answers | Lives in |
|---|---|---|
| R0 Purpose | why it exists; success | intent, every element's first paragraph |
| R1 Behavior | what it does, owns, guarantees; who it depends on | system, capability |
| R2 Design | technology, topology, patterns, decisions | component |
| R3 Contract | exact boundaries | interface |
| R4 Plan | ordered steps, sketches, tests to write | plan (ephemeral) |
| R5 Realized | code, passing checks | `impl:` and checks on the element |

`needs: R3` on a capability means every leaf component under it reaches R2, every interface it touches is fully
specified, and each such interface has at least one `contract` check declared. Strata's `needs: contract`
becomes precise.

The first paragraph of every element is its **R0 summary** and must stand on its own. Views, roll-ups and
context packs quote it. This is the pyramid principle put into practice, and it replaces word budgets as the
main quality lever.

### 6.5 Invariants

Carried over from Strata (renumbered when building it): unique IDs, one parent, rooted tree, everything
resolves, tombstones redirect, no technology above the binding line, decisions have `Rejected:`, no open
question on a settled node, `needs` gaps, `revisit-when` signals.

Changed or new:

| Rule | Replaces | Check |
|---|---|---|
| **Lineage at every level** | S10, which checks L2 only | if A `uses` something owned under B, then each pair of their ancestors below the lowest common ancestor must have a `depends-on`. Shared resources and cross-cutting elements are exempt. |
| **Decision scope** | S13 (depth-based) | a cited decision must be held by an ancestor of the citing node, or by an interface it uses |
| **Superseded decisions** | — | citing a superseded decision is a warning that names its replacement |
| **Interface versioning** | — | a changed interface that has users needs a `version` bump or updated users (checked in `diff`) |
| **Coverage** | W02 growth ratio | every child and every `depends-on` is mentioned (`[[ID]]`) in the parent's body. Soft. |
| **Staleness ("suspect", after DOORS)** | "truth flows up" (unchecked) | a generated `design.lock` records each node's content hash and the child hashes its parent was last *attested* against. When a child changes, the parent is marked suspect until `attest` runs. Same for `impl:` files on verified nodes: code changed since verification means suspect. |
| **No silent deletions** | `strata.ids` ledger | `design.lock` lists every ID. CI compares it with the base branch: a removed ID with no tombstone is an error. |
| **Concept consistency** | `vendorTerms` | terms marked `technology` in the glossary may not appear above the binding line; listed synonyms raise a warning |
| **Verification** | — | `verified` needs `impl:` and at least one passing check reference; the gate at `needs ≥ R3` needs declared contract checks |
| **Size** | S11, W01 (errors and warnings) | hints only |

### 6.6 Views and operations

| Command | Output | For |
|---|---|---|
| `view --at N [--root ID]` | the model at one altitude; deeper links rolled up | reading, reviews |
| `path ID` | breadcrumb with each ancestor's R0 summary | orientation |
| `context ID [--budget 8k]` | the **context pack** (§6.7) | agents, onboarding, implementers |
| `impact ID` | directed dependents, by hop | change planning |
| `gate ID` | ready or blocked, with blockers | sprint entry |
| `plan ID` | ordered waves of work items (§6.9) | implementation plans |
| `diff BASE..HEAD` | the design delta (§6.8) | TDD review, PR bots |
| `render ID --as tdd` | one linear document in TDD template order | reviewers who want one doc |
| `attest ID` | re-sign a parent after checking it against changed children | keeping truth flowing up |
| `export json / mermaid / html` | as Strata | other tools, the viewer |

### 6.7 Context pack

For node N, in priority order, cut to a token budget from the bottom:

1. Intent R0 (one paragraph).
2. Ancestor chain: each ancestor's R0 summary.
3. N in full, including its plan if one exists.
4. Every interface N owns or uses, in full.
5. Decisions in scope that bind N: title, why, rejected.
6. Constraints allocated to N, and the checks N must satisfy.
7. Open questions on N, its interfaces, and its ancestors.
8. Glossary entries for terms used in 3–4.
9. Neighbors (owners and users of N's interfaces): R0 only.

This is what makes the system worth having for AI-assisted development. A planning or coding agent gets
exactly the bounded slice it needs, and every claim in it has an address the agent can cite back
("implements `TF.submission-envelope` v1, rule 3").

### 6.8 TDD = delta + rendering

A TDD becomes a **branch of the design model**: new and changed nodes, opened as a PR.

- **Greenfield:** the TDD is the intent, the system, the capabilities, and the branches taken to the depth their
  `needs` requires.
- **Brownfield:** first, a spine of the existing system, written once. It can be bootstrapped from the code
  graph (ArchOwl is the obvious source) and kept at R1–R2. Each feature TDD is then a delta against that spine.

`diff main..HEAD` gives the reviewer the part that matters:

```
Design delta: feature/recurring-tasks
  L2 map:      + TF.recurrence   depends-on TF.intake, TF.scheduling
  Interfaces:  ~ TF.submission-envelope  v1 → v2 (adds `recurrence`)  users: normalizer, planner (2 updated, 0 missing)
  Decisions:   + D-TF-14 (proposed) · RRULE subset, not free text
  Suspect:     TF.scheduling (child TF.placement changed, parent not attested)
  Impact:      TF.nudges (morning summary reads placements)
  Gate:        TF.recurrence BLOCKED by Q-TF-07 (timezone of recurrences across DST)
```

`render --as tdd` produces the linear document for people who want one. The standard TDD sections map like
this:

| TDD section | Comes from |
|---|---|
| Context, problem | intent R0, system R1 (or links to the existing spine) |
| Goals, non-goals | intent success measures and non-goals; new capabilities |
| Proposed design | new and changed elements, depth-first, down to their `needs` |
| APIs, data | interfaces (new versions highlighted) |
| Alternatives considered | decisions' `Rejected:` |
| Cross-cutting (security, privacy, observability, cost) | constraints, plus cross-cutting elements |
| Testing | checks |
| Rollout, migration | a `rollout` section on the delta's root, plus interface version notes |
| Open questions | open ⚑ in the delta, ordered by what they block |
| Impact | `impact` over the changed nodes |

When the PR merges, the TDD's content *becomes the model*. There is no separate TDD to rot. The rendered PDF or
doc is a snapshot.

### 6.9 The implementation plan is a query

`plan ROOT`:

1. **Candidates:** components and interfaces in the subtree that are below `verified`.
2. **Ready filter:** the gate passes for each (no blocking ⚑, `needs` met, decisions accepted). Blocked items
   are listed separately with their blockers. Open questions on the critical path rise to the top.
3. **Order:** a DAG from `uses`. An interface comes before its owner's build and its users' integration. A
   resource comes before its users. Contract checks come before implementations (contract-first). Cycles are
   reported as design smells.
4. **Waves:** topological layers. Items within a wave can run in parallel (people or agents).
5. **Each item carries:** a title, `done when` (its checks), its context pack, and a plan node if a sketch is
   needed (R4, `needs: build` branches only).
6. **On completion:** the item's target gets `impl:` and check references and moves to `verified`. Its plan node
   collapses into a record: deleted, with a tombstone, or archived.

So the plan is never written by hand and can't drift from the design, and "what can we start Monday?" is a
command.

### 6.10 What it looks like (TaskFlow, re-expressed)

```markdown
## TF.intake · Task capture
> type: capability · state: settled · needs: R3 · depends-on: TF.identity

Users submit tasks by typing, texting, or speaking; every submission becomes one normalized [[T-task]] owned
by one user, and is durable before it is acknowledged. …

## TF.submission-envelope · Submission envelope
> type: interface · owner: TF.intake-pipeline · version: 1 · state: settled · decided-by: D-TF-05

#### D-TF-05 · One message group per user; dedupe on submissionId
… Rejected: …

## TF.app-capture · iOS capture
> type: component · up: TF.intake · state: settled · uses: TF.task-api (calls), TF.auth-tokens (reads)

## TF.planner-run · Planning run
> type: component · up: TF.scheduler · uses: TF.task-record (reads), TF.keyspaces (writes)
  ← lineage: TF.scheduling must depend-on TF.intake, which owns TF.task-record

- C-TF-02 · allocates C-TF-01 · a "do now" task is placed within 60 s of acknowledgement (p95)
- K-TF-09 · contract · verifies TF.submission-envelope · test: functions/normalize/envelope.contract.test.ts
```

D-TF-05 now sits on the interface it governs, and both the app and the pipeline cite it legally. Changing the
envelope flags exactly its users. `--impact TF.intake` now reaches scheduling, because scheduling `uses` an
interface intake owns.

## 7. Building it

| Phase | Deliverable | Exit criterion |
|---|---|---|
| **0 · Decide** | Name; accept or adjust §6.1–6.4; rewrite the spec as one short "core" page plus a reference | team sign-off; the spec core fits on one screen |
| **1 · Model** | Checker v3: entity types, `uses` direction, interfaces, decision scope and status, lineage at every level, coverage. Port TaskFlow; rebuild `broken/` with one fixture per rule. | `--impact TF.intake` includes TF.scheduling; every fixture rule fires |
| **2 · Truth** | `design.lock`, `attest`, suspect propagation, CI comparison of IDs (drop `strata.ids`), glossary and concept checks, constraints and checks | editing `TF.placement` marks `TF.scheduler` and `TF.scheduling` suspect |
| **3 · Views** | `context`, `path`, `render --as tdd`, `diff`; viewer gets a resolution toggle, suspect overlay, decision-scope highlight | one real TDD reviewed from `render` plus `diff` alone |
| **4 · Plans and agents** | `plan`; a Claude skill set: *scaffold node*, *drill down one level*, *write interface*, *context pack → implement → collapse plan*; a PR bot that posts `diff` | an agent implements a gated leaf from its context pack without extra prompting |
| **5 · Code link** | `impl:` drift detection; optional `@design TF.x` code annotations for the reverse lookup; brownfield spine bootstrap from the ArchOwl code graph | an existing service gets a spine in one session |
| **6 · Pilot** | one brownfield feature TDD and one greenfield design, end to end | see metrics below |

Pilot metrics: reviewer time per TDD; questions caught before build compared with after; number of suspect
nodes left unattested after 30 days (doc rot); agent first-pass success on gated leaves; author minutes per
node.

## 8. Risks and open questions

| Risk | Mitigation |
|---|---|
| **Ceremony kills adoption.** Every field is a reason not to write. | Only `id`, `type`, `up` and `state` are required. Everything else is optional or generated. Agents scaffold, the checker enforces, humans write prose. |
| **Two drilldowns confuse authors.** | In practice, type determines resolution. Authors rarely think about R-levels; the gate and the context pack do. |
| **Tree versus reality.** Functional and technical decomposition are really two hierarchies mapped many-to-many. | Keep one primary tree for readability. `resource`, `cross-cutting` and interfaces are the sanctioned ways out. Revisit if more than ~20% of edges use them. |
| **Suspect fatigue.** Every edit flags parents. | Attest is one command. Suspect status only blocks the gate for elements with `needs ≥ R3`. Trivial edits (whitespace, typos) are hashed out. |
| **A living model versus a point-in-time TDD.** | §6.8: the TDD is a branch; the rendered doc is a snapshot. |
| **Plan nodes rot like build leaves.** | They are ephemeral by type, and collapsing them is part of "done". |

Open for the team:

- Q1 · Do interfaces need their own files, or do they live next to their owner? (Proposal: next to the owner;
  the checker doesn't care.)
- Q2 · Markdown meta line, or YAML front block per node? The meta line reads better on GitHub; YAML is easier
  for tools and editors. Pick one before Phase 1.
- Q3 · Should constraints get a full allocation model, or is "cite the parent constraint" enough for v1?
  (Proposal: cite only.)
- Q4 · Where does the brownfield spine live: in each repo, or in a central design repo with `impl:` pointing
  across repos?

## 9. Naming

The idea is *depth you can measure and stop at*. Candidates:

- **Altitude**: already the word the spec uses for views; reads naturally ("at altitude 2").
- **Loupe**: a zoom instrument; short, and nothing else in dev tooling uses it.
- **Plumb**: measuring depth, and "true and vertical". It suggests lineage; `plumb impact` reads well.

Chosen: **Anaxi**. Short, and commands read well (`anaxi-check gate @intake`).
