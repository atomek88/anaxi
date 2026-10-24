# Anaxi: depth-aware design docs

An overview for engineering teams deciding whether Anaxi fits their work. Version 0.7: built and tested on an
example project, not yet piloted.

Anaxi is a light markup convention, a checker and an agent skill. Together they tell engineers and agents how
deep each design item has been taken, how deep it needs to go, and when to stop. It works inside the TDDs and
sprint process teams already have, and its levels, rubric and questions are **defaults a team changes**, not
rules to fit into.

## At a glance

```
   markdown docs in the repo (the source of truth; together they are the "super-TDD")
        │  read by
        ├──► anaxi-check ──► status · nudges · gate · INDEX.md      (structural, the same every run)
        └──► agent + skill ──► assess · deepen · write questions      (needs reading; calls anaxi-check)
```

The checker computes everything that follows from the marks. The agent skill handles what needs reading, and
calls the checker, so the two never disagree.

## The problem

Teams rarely know how deep a design doc needs to go before building. The result is both kinds of waste:

- **Too shallow:** a contract or failure mode nobody wrote down surfaces mid-sprint, or an agent guesses it.
- **Too deep:** pages of design for a low-risk change, or detail on work that isn't in the plan yet.
- **Invisible dependencies:** a feature is "ready" while the shared API it relies on is still a sketch.

Anaxi makes depth explicit per item, suggests the needed depth from risk, and says out loud when something is
enough.

## How it works: a ladder of levels

Depth is one thing: which questions about an item have been answered. Levels are cumulative, and each has a
concrete test. The default ladder:

| Level | Covers | Done when |
| --- | --- | --- |
| D0 Why | problem, who has it, success, non-goals | someone could argue for or against doing it |
| D1 What | behaviour, edge cases, acceptance, what it touches | QA could write the acceptance tests |
| D2 Shape | parts, stack (only what's new), decisions, the risky part | a lead could estimate it and find the risky part |
| D3 Contract | every boundary's exact shape, compatibility, failure handling | two people could build the two sides separately |
| D4 Build | steps, files, exact dependencies, tests, illustrative code | an agent could build it without asking |

Ten broad core questions (two per level, one at D4) prompt each level. Projects add their own questions in a
markdown file; people and agents add item-specific ones as a checklist. There is no "done" level: Anaxi tracks
design depth, not delivery.

## Target depth: suggested by risk

By default, score four factors 0–2 in refinement; the total suggests the target. The scores are written in the
doc, so a disagreement is visible and arguable.

| Factor | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Blast radius | one component | one feature | crosses features, clients or services |
| Reversibility | revert a commit | needs a migration | one-way: stored data, public API |
| Novelty | done before here | a variant | new mechanism or integration |
| Certainty | measured or known | inferred | guessed, or open questions |

Total 0–1 → D1 · 2–3 → D2 · 4–5 → D3 · 6–8 → D4. Don't want a rubric? Write the target yourself:
`depth: D1 → D3`.

- **What's needed now can be lower.** Items marked `focus: next` cap at D2 and `focus: later` at D1; early
  project stages cap too. Writing past the cap is flagged as over-documented.
- **The gate before building always uses the full target.** Caps decide what's worth writing now, never what's
  ready to build.
- **Shared items** (an API, a scheduler, the stack) are written once and referenced as `@id`. An item that uses
  one is blocked until the shared item reaches its own target.

## Defaults you can change

Only three ideas are fixed: depth means answered questions, levels are cumulative, and markdown is the source of
truth. Everything else is a starting point, changed in `anaxi.json` or `anaxi-questions.md`:

| Default | How a team changes it |
| --- | --- |
| five levels D0–D4 | rename a level, rewrite its "done when", drop the top ones, or add D5 (e.g. "Operate") |
| four risk factors | replace them, or add your own dimensions (compliance, cost, data sensitivity…) |
| risk → target totals | set your own thresholds, or skip scoring and write targets by hand |
| ten core questions | reword, skip project-wide with a reason, add your own |
| heading → level mapping | add your template's heading names |
| caps and nudges | change or switch off |

Ideas that fit none of these (a different axis, a new review step) start in the docs as headings, `about:`
tags, checklists or a canvas. The ones that keep proving useful become defaults, recorded in the changelog.

## What a marked-up TDD looks like

Your template stays as it is. A whole TDD gets front matter; common headings (Context, Requirements, Proposed
design, API, Implementation plan…) already map to levels.

```markdown
---
anaxi: "@recurring"
depth: D2 → D3
risk: 2·1·1·1
uses: ["@task-api", "@scheduler"]
later: custom recurrence rules (when 10% of users use recurrence)
---
# Recurring tasks
## Context and goals        ← D0
## Requirements             ← D1
## Proposed design          ← D2
## API                      ← D3
## Open questions
- [ ] D3 · Which time zone does a recurrence follow when the user travels?
## Appendix: sketches       ← canvas: free exploration, never counted or policed
```

A section can be its own item with one line under its heading:

```markdown
## Task API
> @task-api · depth: D3 🎯 · risk: 2·2·0·0 · caveats: no batch submit
```

Deep detail doesn't have to sit in the TDD. A section in `APPENDIX.md` (or a file beside the TDD) marked
`> part-of: @recurring` counts as that item's content, and the index links to it, so TDDs stay short.

`D3 🎯` (or `D3 enough`) means designed deep enough for its risk, not done. Everything is plain markdown: it
reads fine on GitHub, in an IDE and to an LLM, with no rendering step.

## What you get back

The checker reads the marks and returns nudges: short messages that say go deeper, wait, trim, or stop, each
ending with a next step. Output from the example project:

```
⛔  @recurring  Recurring tasks
    features/recurring-tasks.md:1 · depth D2 · target D3 · risk 2·1·1·1
    blocked     uses @scheduler, which is at D2 of its target D3 (N02)
    open        2 to answer (N03):
                • D2 · Do paused series still count toward the daily nudge cap?
                • D3 · Which time zone does a recurrence follow when the user travels?
    go deeper   D2 → D3. Answer these for D3 (N01):
                • D3.contracts · For every boundary, what crosses it, in exactly what shape, and
                  what must stay compatible?
                • D3.failure · What can go wrong at each boundary, and what does each side do then?
    → Next: wait for @scheduler, or help take it deeper; then answer the open questions, or move
      them to later: with a trigger.

$ anaxi-check gate @recurring
N09 BLOCKED  @recurring — D2 → D3 · 2 open · @scheduler at D2 of D3
```

- **Structural nudges** (targets, gaps, blocked dependencies, open questions, over-documented) come from the
  script and are the same for everyone, every run.
- **Judgment nudges** (claim not supported by the text, over-engineered, out of focus) come from the agent skill,
  which quotes the text that triggered them.
- **`INDEX.md`** is a generated, committed table of every item with status icons and links: the front page of the
  combined design, for people and agents. CI or a pre-commit hook keeps it fresh.

## How it fits a normal sprint

No new ceremonies, and the tracker is untouched.

| You already do | With Anaxi | Extra effort |
| --- | --- | --- |
| Backlog refinement | score risk (or write the target), set the target | about a minute per item |
| Definition of Ready | one line: the gate passes | none; replaces a judgment call |
| Sprint planning | read `INDEX.md`: ready, blocked, gaps | none |
| Design / TDD review | same PR review; reviewer checks claimed depth against the done-when test | less: expected depth is known |
| Spikes | spike profile: target at most D2, mostly free exploration | none |
| Retro | adjust the questions, levels or rubric that caused friction | a few minutes, occasionally |
| Tickets | link the ticket to the doc; status, points and done stay in the tracker | none |

## Does it fit your team?

**Likely a good fit if:**

- design docs live as markdown in the repo, or could;
- you build features that depend on shared components or APIs;
- agents implement from your docs, and need to know what is decided versus guessed;
- reviews keep arguing about whether a doc is "detailed enough".

**Likely a poor fit, or extra work, if:**

- design lives in Confluence, Notion or Google Docs: the marks work as text, but the checker and agents can't
  reach them (an importer is on the roadmap);
- the team writes no design docs at all: Anaxi is a light layer on docs, not a replacement for writing them;
- changes are almost all small and low-risk: most items would target D1 and the method adds little.

## Adopting it

With Claude Code, Anaxi is a plugin: install it once per machine, then run `/anaxi:init` in any repo.

```bash
claude plugin marketplace add <anaxi repo>
claude plugin install anaxi@anaxi
```

`/anaxi:init` writes `anaxi.json` (settings) and `docs/anaxi-questions.md` (the project's own questions), starts a
shared `@stack` item, installs a pre-commit hook and builds the first index. It never overwrites a file and copies
nothing into the repo. Then `/anaxi:status`, `/anaxi:assess <doc>` and `/anaxi:gate @id`, and Claude sees the
status table at the start of every session in the repo.

Without Claude Code (other agents, CI), one script copies the method into `tools/anaxi/` instead:
`anaxi/tools/anaxi-init.sh my-project --profile service --stage shaping`. Requirements: Node 18 or newer; no
packages.

| Changes | Stays the same |
| --- | --- |
| front matter or one tag line per design item | your TDD template and headings |
| a risk score or a written target in refinement | the tracker, estimates, velocity |
| one Definition of Ready line | review as pull requests |
| an optional CI step | where docs live in the repo |

Profiles tune the defaults per project kind: default, service, mobile, data, integration, library, spike,
regulated.

## Status, limits and roadmap

**Today (v0.8):** the method, the checker (`status`, `nudges`, `gate`, `questions`, `uses`, `index`, `check`,
`new`), CI and pre-commit support, an install script, the agent skill and a Claude Code plugin are built and
self-tested on an example project. Projects can change the ladder and the rubric.

**Known limits:**

- not yet piloted on real features, so the default thresholds and questions are reasoned, not measured;
- risk scores and "is this answered?" are judgment calls; the pilot calibrates them with two people scoring the
  same items;
- the heading-to-level mapping is a heuristic; a badge on the heading overrides it;
- not built yet: a combined rendered document, recheck-after-shared-change (N11), folder-level settings for
  monorepos.

**Roadmap,** ordered by what the pilot shows ([ROADMAP.md](ROADMAP.md)):

1. **Package it:** `npx anaxi init | check | gate` for teams without Claude Code (published on npm as `anaxi`).
2. **Claude Code plugin:** built in 0.8.
3. **See the design:** `anaxi watch`, a live local reader for the docs themselves (marks as badges, read any
   item or the whole project, as linked pages, at a chosen depth, working `@id` links and backlinks, nudges alongside), plus a map
   where zoom is depth: project → topic → item → level → section. Candidate pictures to compare: a 2D graph with depth bars, a 3D layer stack, a city (items as
   buildings, levels as floors, `uses:` as roads).
4. **MCP server:** the same engine as agent tools; `anaxi_context(@id, at: D3)` returns an item plus the
   contracts it depends on, at exactly the depth needed.
5. **References and attribution:** `refs:` to tickets, designs, ADRs, data and prototype evidence, checked by
   the checker; `owner:`; last changed, from git.
6. **Superseding and archiving:** built in 0.9. `superseded-by:`, `supersedes:` and `retired:` marks, an archive
   folder, and `anaxi-check supersede | retire | archive | restore | delete`, so replaced designs stay readable but
   stop counting, and agents are pointed to what replaced them.

**To do:**

- [ ] Reserve `anaxi` on npm with a placeholder 0.0.x package, before someone else takes it. Needs an npm login
  and a go-ahead, since it publishes to the public registry.

Every layer runs on the same rules engine, so they can't disagree, and each stays optional: markdown remains the
source of truth.

## How to evaluate it

Run a two-sprint pilot on one or two features about to be designed, ideally one routine and one risky
([PILOT.md](PILOT.md)).

1. **Sprint 1, calibration:** two people score the same five items independently and compare targets; two
   people assess the same two items question by question. Disagreements become changes to questions, thresholds
   or levels.
2. **Sprint 2, real use:** refinement, review and the gate as above, with a one-line log of each nudge and
   whether it helped.
3. **Retro:** did targets feel right, did "enough" help anyone stop, did the gate catch anything, which nudges
   were noise, which defaults did you change, what did it cost.

**Questions for reviewing teams:**

- [ ] Where do your design docs live today, and could they move to repo markdown?
- [ ] Would the four risk factors rank your last five features the way you would? If not, which would you use?
- [ ] Does the five-level ladder match how your team thinks, or would you rename, drop or add levels?
- [ ] Which of the ten core questions would you reword or skip?
- [ ] Would your Definition of Ready accept the gate as one line?
- [ ] Do your agents need `anaxi_context`-style bounded design context?
