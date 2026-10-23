---
status: proposal
owner: docs
created: 2026-10-10
revised: 2026-10-10 (v2: open depth, kinds, resources, parked/grow-when, impact, graph export and viewer)
applies_to: requirements, TDDs, plans, backlog items — any project
---

# Strata — layered technical documentation

Strata writes a design as a **tree of nodes**. Each level down explains its parent more concretely, in more
words, with more connections to the rest of the system. The top three levels are fixed anchors: intent,
system, capabilities. Below that, depth is open. A branch stops wherever it has said enough, which may be
L3 for a simple part, or L7 for a subsystem that needs it. What a node *is* (architecture, contract, build)
is a declared **kind**, not a level number.

The docs are a graph. Parent pointers make the tree, and typed links, decisions and triggers are edges
across it. A zero-dependency checker, [`strata-check.mjs`](strata-check.mjs), validates the graph, traces
impact, and exports it. An interactive viewer, [`strata-viewer.html`](strata-viewer.html), draws it.

| Example | Shows |
|---|---|
| [examples/taskflow/](examples/taskflow/) | a task-scheduling app, 27 nodes: the spine, branches of different depths, a Redis resource used by three capabilities, a parked capability waiting on it |
| [examples/deep/](examples/deep/) | one path to L7 with repeated kinds (no depth ceiling) |
| [examples/broken/](examples/broken/) | every rule broken once |
| [examples/out/taskflow.html](examples/out/taskflow.html) | the viewer with the TaskFlow graph embedded |

```bash
node docs/standards/strata/strata-check.mjs --selftest
```

---

## 1. What every node carries

| Coordinate | Values | Source |
|---|---|---|
| **Depth** | L0, L1, L2, … open-ended | computed from the tree; never written by hand |
| **Kind** | `intent` · `system` · `capability` · `resource` · `architecture` · `contract` · `build` | declared (`kind:`) or defaulted |
| **State** | `draft` · `settled` · `verified` · `parked` | declared |
| **Relations** | parent (`up:`), typed `links:`, `decided-by:`, `grow-when:` | declared |

Depth tells you how far down you are. Kind tells you what sort of content is allowed there. State tells you
how resolved it is. Relations tell you what it touches.

---

## 2. Anchors and kinds

### 2.1 The anchors (fixed)

| Depth | Kind | Describes | Must not contain |
|---|---|---|---|
| **L0** | `intent` | the need in the user's or sponsor's words: who, the problem, what success feels like | any technology or solution shape |
| **L1** | `system` | the system as one box: actors, channels in and out, what it owns, what it depends on, the success measure | internal components, vendors |
| **L2** | `capability` | one thing the system does: behavior, data it owns, guarantees, **every interaction with a sibling** | vendor, framework or product names; code |
| **L2** | `resource` | one shared dependency used by several capabilities (a key-value store, a payment provider, a message bus) | code |

The anchors are what make the summary views and edge lineage (§4.2) work, so they do not move.

### 2.2 Below L2: open depth, three kinds

| Kind | Holds | Code | Decisions | Default size |
|---|---|---|---|---|
| `architecture` | technology choices, runtime topology, patterns, cross-cutting concerns, how a subsystem is split | Mermaid diagrams only | **yes**: architecture decisions | 150–900 words |
| `contract` | data models, routes and status codes, envelopes, state machines, algorithms with a worked run, failure semantics | yes | **yes**: component decisions | 300–1,800 |
| `build` | code, wiring, config, exact routing, tests, worked edge cases, an interop table per neighbor | yes | **never**; only `Local choice:` lines | 400–4,000 |

Rules for kinds along any path:
- **Kinds move toward `build` or stay.** An architecture node may sit under architecture (a large subsystem
  split in two levels). A contract may sit under a contract (an API, then its pagination rules). A contract
  may not sit under a build node.
- **Default kind:** a node under a capability or resource defaults to `architecture`; deeper nodes inherit
  their parent's kind. Declare `kind:` when it changes.
- **A leaf is any node without children,** at any depth and of any kind from capability down. A capability
  that stops at L2 is a leaf. So is a build node at L7.

### 2.3 Shared resources

A dependency that several capabilities use is declared **once**, as a `resource` at L2, the moment it is
introduced. The resource branch owns the **keyspace contract**: names, TTLs, limits, and what consumers must
do when it is unavailable. Each consumer owns its usage, inside its own branch, linked with
`uses→<resource node>`. The resource may name its vendor (it *is* the vendor). Links to and from resources
are exempt from edge lineage, because any capability may use one.

In the example, Redis arrives as `TF.kv-store` (resource) → `TF.redis` (architecture, the ElastiCache choice and its
VPC consequences) → `TF.keyspaces` (contract: dedupe, token and cache keyspaces, with the fallback behavior of
each). The consumers are the planner's dedupe step, notifications' redelivery guard, and identity's token
cache. `--impact TF.kv-store` lists them, and what depends on them.

---

## 3. Size, growth, splitting

- **Growth:** a node's children together hold **2–8×** the node's words. Under 2×, the level below adds too
  little. Over 8×, the parent no longer summarizes its children: enrich it, or split it into siblings.
  `intent → system` is a translation and is exempt.
- **Ceiling:** a node over its kind's ceiling splits into **siblings**. A large area grows by adding siblings
  and depth, never by one 6,000-word node.
- **Floors** are warnings, and parked nodes are exempt.
- Budgets are per kind and can be overridden in `strata.config.json`.

Measured in the example (27 nodes): L0 71 words, L1 162, L2 903 (8 nodes), L3 2,552 (10), L4 3,089 (5),
L5 3,328 (2). The build leaves average 1,664 words against 113 per L2 node. Depth totals stop growing once
branches end, which is expected: growth is judged per node, not per level.

---

## 4. What lives where

### 4.1 Decisions bind downward
Decisions are written as `#### D-<SYS>-<n> · <decision>`, with why and a `Rejected:` line. They live in
`architecture` (system-wide) or `contract` (component-scoped) nodes, at whatever depth those are. A node may
cite (`decided-by:`) only decisions made higher than itself. `build` nodes never decide. A choice whose
effect stays inside the leaf is recorded as `Local choice:`. If changing it would touch a sibling, raise it
into a contract.

### 4.2 Interactions are visible at L2 (edge lineage)
A typed link between nodes under two different L2 capabilities is valid only if those two capabilities are
linked. Each level down refines the same interaction: L2 says intake feeds scheduling; architecture names the
queue; the contract defines the envelope; build shows the consumer. A link without that lineage is a
**ghost edge**: an interaction hidden from everyone reading the summary. When the first version of the example was
checked, this rule found two interactions its own L2 had hidden. Resources and `scope: cross-cutting`
capabilities are exempt.

### 4.3 Open questions
`- ⚑ Q-<SYS>-<n> · question` is open; `- ✓ Q-<SYS>-<n> · question → answer` is resolved. An open ⚑ keeps a
node out of `settled`. Say what each question blocks.

---

## 5. How deep, and when

### 5.1 `needs:` — optional, per branch
Without `needs`, a branch is complete wherever it stops. Set `needs: architecture | contract | build` on a
node (usually the L2) when a branch must reach that kind before it is built. Every non-parked leaf below it
must then reach that kind, or the checker reports a **depth gap** (G01).

Score the four factors from 0 to 2 to pick it:

| Factor | 0 | 1 | 2 |
|---|---|---|---|
| Blast radius | inside one component | one capability | crosses capabilities, clients, or services |
| Reversibility | revert a commit | needs a migration | one-way (stored data, public API, external contract) |
| Novelty | done before here | a variant | new mechanism or new integration |
| Certainty | measured | inferred | guessed, or an open question |

| Total | `needs` |
|---|---|
| 0–2 | none: stop where it is clear |
| 3–5 | `contract` |
| 6–8 | `build`: write the leaf before building, because mistakes are expensive |

### 5.2 `parked` and `grow-when:` — "enough for now"
`state: parked` marks a node that is deliberately shallow: "L2 is enough until more is built." Add
`grow-when: <ID>[, <ID>]` to name what would make it worth deepening. When every trigger becomes `settled`
or `verified`, the checker reports **G02: deepen it**. In the example, `TF.caching` is parked with
`grow-when: TF.kv-store`. Adding the Redis resource flagged it with no one having to remember.

---

## 6. Addressing: no lost links

| Rule | Why |
|---|---|
| Node IDs are `<SYS>.<slug>` (e.g. `TF.token-cache`); decisions `D-<SYS>-<n>`; questions `Q-<SYS>-<n>` | short, stable, greppable |
| **No depth in the ID** | depth is open and nodes move; tools show it instead (`TF.token-cache [L4·contract]`) |
| The parent is a pointer (`up:`), not a path | moving a node changes one line, and no reference |
| Prose references are `[[ID]]` | resolved by the checker, greppable across files |
| `strata.ids` is an append-only ledger | an issued ID that is neither defined nor tombstoned is an error |
| `_tombstones.md` holds `- OLD → NEW · date · why` (or `→ retired`) | old references still resolve, with a warning to update them |

The v2 migration proved this works. All 22 old IDs (`TF.L3.auth` and so on) were renamed in one pass, one
tombstone line each, and every old reference still resolves.

| Guarantee | Rule |
|---|---|
| every reference, link, `decided-by`, `grow-when` and tombstone resolves | S04 |
| no issued ID disappears silently | S05 |
| renames are redirects | W04 |
| one parent per node, every node reaches a root | S03 |
| every cross-capability interaction is visible at L2 | S10 |

---

## 7. Node syntax

```markdown
## TF.token-cache · Google access-token cache
> up: TF.calendar-access · kind: contract · state: settled · decided-by: D-TF-13 · links: uses→TF.keyspaces

Body. Prose references use [[TF.keyspaces]].

#### D-TF-14 · A component decision (contract or architecture nodes only)
Why.
Rejected: the alternatives, and why not.

- ⚑ Q-TF-05 · An open question, and what it blocks.
```

| Meta field | Meaning |
|---|---|
| `up:` | parent ID (every node except the root) |
| `kind:` | needed at L2 for a resource, and below L2 whenever the kind changes |
| `state:` | `draft` · `settled` · `verified` · `parked` |
| `needs:` | optional: `architecture` · `contract` · `build` |
| `grow-when:` | optional, with `parked`: the IDs whose settling means "deepen this" |
| `scope: cross-cutting` | optional on a capability: exempt from edge lineage |
| `links:` | comma list of `type→ID`. Suggested types: `feeds` `uses` `calls` `guards` `triggers` `writes` `reads` `records` `informs` `alerts` `prompts` `sends-via` `returns` |
| `decided-by:` | decisions this node implements |
| `impl:` | for `verified` nodes: the path to the code; a verified build leaf may shrink to its interop table |

Node headings may use any `#` level; the checker reads the ID. Sub-headings inside a node are body text.
Text above the first node in a file is ignored. Files starting with `_` are not parsed.

---

## 8. State and the gate

| State | Meaning |
|---|---|
| `draft` | open questions, or content still moving |
| `settled` | no open ⚑; decisions recorded with their alternatives |
| `verified` | built and checked against the doc; add `impl:` |
| `parked` | shallow on purpose; see `grow-when` |

`--gate <ID>` passes when the subtree has no errors, depth gaps or deepen-signals, and no `draft`, `parked`
or open ⚑. Use it as the sprint-entry check. In the example, scheduling and the kv-store are **ready**.
Intake is **blocked** by one question (the SMS provider). Caching is **blocked** by G02: the store it waited
for has arrived.

---

## 9. Seeing the system: graph, impact, views

The docs form a typed graph:

| Graph element | Comes from |
|---|---|
| tree edges | `up:` |
| cross edges | `links:` (typed), `decided-by:` (to the node holding the decision), `grow-when:` |

Four ways to look at it:

| Command | Use |
|---|---|
| `--view 2 [--root ID]` | text at one altitude; nodes cut off there end with `↳ deeper: [[…]]` |
| `--impact ID [--hops N]` | everything that depends on this node's subtree: direct users, then who uses them, hop by hop |
| `--export json` | `strata-graph/1`: nodes (id, title, kind, depth, state, parent, children, branch, file, line, words, needs, growWhen, openQuestions, decisions, dependents), edges (`from`, `to`, `type`, `rel`: `link` · `decided-by` · `grow-when`), findings |
| `--export mermaid` | a diagram to paste into a markdown file or PR |
| `--export html --out f.html` | a single self-contained page: [`strata-viewer.html`](strata-viewer.html) with the graph embedded |

What the viewer does:
- **Tree by depth:** columns L0…Ln; boxes colored by kind. Draft nodes are dashed, parked nodes dotted,
  verified nodes heavy.
- **Badges:** open ⚑, errors, depth signals, and "+n hidden".
- **Depth slider:** view the system at any altitude. Links between hidden nodes **roll up** to their nearest
  visible ancestors, so the L2 view shows the capability-level interaction map.
- **Click:** shows the path, children, "uses", "used by" (this node or below), decisions, questions, findings
  and file:line. **Show impact** highlights every dependent, labeled by hop.
- **Other controls:** double-click to collapse a subtree; search; toggles for links, `grow-when` and `decided-by`;
  pan and zoom; light and dark themes.
- **No embedded data?** The bare `strata-viewer.html` accepts a dropped JSON export.

**For later:** `strata-graph/1` is a plain node/edge format with stable IDs, so other tools can consume it
without touching the markdown. It could feed ArchOwl's D3 graph renderer, a CI job that posts the impact of a
PR's changed nodes, or an index that maps nodes to code through `impl:` paths. Keep the format versioned and
add fields; don't rename them.

---

## 10. Files

| File | Holds |
|---|---|
| `00-spine.md` | L0, L1, and every L2 node: the summary, readable top to bottom |
| `NN-<branch>.md` | the architecture and contract nodes of one branch (or a few small ones) |
| `NN-<branch>.build.<slug>.md` | one build leaf per file |
| `strata.ids` · `_tombstones.md` · `strata.config.json` | ledger, redirects, settings (system prefix, vendor terms for the leak check, budget overrides) |

---

## 11. Writing workflow

1. **Write the spine:** intent, system, then every capability and resource with its interactions. Set
   `needs` only where the rubric says so; park what is not needed yet.
2. **Go down one branch at a time.** For each node, decide its kind and stay inside what that kind allows.
   Split into siblings when a node gets too large; add a level when a node needs more than one kind of
   explanation.
3. **Truth flows up.** When a deeper node changes the story, rewrite its ancestors. They may be coarser than
   their children, but they must never contradict them.
4. **New interaction?** Link it at L2 first. **New shared dependency?** Add a resource at L2, and run
   `--impact` on it.
5. **New IDs:** `--update-ledger`. Renamed or moved: add a tombstone line.
6. **Before building:** `--gate <ID>`. To review or share: `--export html`.

---

## 12. Checker reference

```bash
node strata-check.mjs <dir>                              # profile, branch table, findings; exit 1 on errors
node strata-check.mjs <dir> --view 2 [--root ID]
node strata-check.mjs <dir> --gate TF.intake             # exit 1 when blocked
node strata-check.mjs <dir> --impact TF.kv-store [--hops 1]
node strata-check.mjs <dir> --export json|mermaid|html [--out FILE]
node strata-check.mjs <dir> --update-ledger
node strata-check.mjs --selftest
```

| Code | Severity | Rule |
|---|---|---|
| S01 | error | duplicate ID |
| S02 | error | wrong kind for the depth (anchors), or a kind moving back up a path |
| S03 | error | orphan: missing parent, or not connected to a root |
| S04 | error | reference, link, `decided-by`, `grow-when` or tombstone does not resolve |
| S05 | error | ledger ID neither defined nor tombstoned |
| S06 | error | vendor name in an intent, system or capability node |
| S07 | error | code outside contract and build nodes (Mermaid allowed from capability down) |
| S08 | error | decision outside architecture and contract nodes |
| S09 | error | decision without `Rejected:` |
| S10 | error | ghost edge: cross-capability link without an L2 link |
| S11 | error | node over its kind's ceiling: split into siblings |
| S12 | error | open ⚑ on a `settled` or `verified` node |
| S13 | error | `decided-by` cites a decision at the same depth or deeper |
| S14 | error | missing or unknown state or kind, invalid `needs`, malformed link |
| G01 | depth signal | leaf has not reached its branch's `needs` |
| G02 | depth signal | parked node's `grow-when` triggers are settled: deepen it |
| W01 | warning | node under its kind's floor |
| W02 | warning | growth outside 2–8× |
| W03 | warning | ID not in the ledger yet |
| W04 | warning | reference to a tombstoned ID |

---

## 13. Using Strata in existing doc types

| Doc type | Strata shape |
|---|---|
| Idea / product requirement | the spine only; capabilities parked or with `needs` set |
| TDD | one or more branches taken as deep as they need; links to the spine |
| Plan / sprint | a list of gate IDs; an item enters the sprint when its gate passes |
| Backlog item | one capability or architecture node with `needs`, ⚑ and links |
| New infrastructure (cache, queue, provider) | a `resource` at L2, then `--impact` to see what changes |
| Completion log | the subtree flipped to `verified` with `impl:` |

For this repo's buckets ([DOCS_CONVENTION.md](../../DOCS_CONVENTION.md)):

| Bucket | What it holds |
|---|---|
| `docs/future/` | spines and parked capabilities |
| `docs/plans/` | gated subtrees |
| `docs/current/` | verified nodes, viewed at `--view 3` |
| `docs/archive/` | retired subtrees, with their tombstones kept |

---

## 14. Where this came from

Three passes:

| Pass | Added |
|---|---|
| Depth ladder | resolution state, open questions as first-class items, required depth, links that carry depth |
| Technical altitude | each level explains the system more concretely and grows larger |
| v2 | open depth, with content governed by **kind** rather than level number, shared **resources**, **parked / grow-when**, depth-free IDs, and the graph made explicit: impact, export, viewer |
