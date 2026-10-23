# Anaxi — know how deep you are, and how deep you need to go

Anaxi is a **markup convention** for technical design docs. Any epic, story, feature, component or shared
part of a system gets a small mark: front matter, a tag line, a heading badge, or a comment. The mark says how
deep the item has been taken, how deep it needs to go, what it uses, and what is deliberately left for later.
An agent skill and a small zero-dependency script read the marks and **nudge**: go deeper, enough, blocked by a
dependency, over-engineered, out of focus.

It replaces nothing you already write. Your TDDs keep their usual layout, because common TDD headings map to
levels on their own. The design documentation *is* those markdown docs, linked to each other; this folder is the
method for reading them ([TOOLING.md](TOOLING.md)).

**New here? Start with the one-page [QUICKSTART.md](QUICKSTART.md).** Evaluating it for a team? Read [OVERVIEW.md](OVERVIEW.md).

**Using Claude Code?** This repo is a plugin: `claude plugin marketplace add <this repo>`, then
`claude plugin install anaxi@anaxi`, then `/anaxi:init` in any project ([TOOLING.md §5](TOOLING.md#5-installing)).

## The whole method in one screen

1. **Depth is one thing:** which questions about an item have been answered. Five levels by default, D0–D4
   (a project can rename, drop or add levels, and change or skip the risk rubric: [METHOD.md §0](METHOD.md#0-defaults-not-rules)):

   | Level | Aim | Done when |
   |---|---|---|
   | **D0 Why** | why it's worth doing | someone could argue for or against doing it |
   | **D1 What** | what it does, seen from outside | QA could write the acceptance tests |
   | **D2 Shape** | how it's built, roughly: parts, stack, decisions, risky part | a lead could estimate it and find the risky part |
   | **D3 Contract** | the boundaries, exactly | two people could build the two sides separately |
   | **D4 Build** | steps, files, dependencies, examples, tests | an agent could build it without asking |

2. **Ten broad core questions, and your own** ([QUESTIONS.md](QUESTIONS.md)). The method keeps only what is
   true everywhere: each level's aim, bounds and "done when", two broad questions per level (one at D4), and a
   starting set of principles that each project adapts. Each project adds its own questions and principles in
   `anaxi-questions.md`. People and agents add an item's own questions
   as a checklist while they work. A [library](skills/anaxi/references/question-library.md) offers wording to borrow;
   nothing in it applies unless it's copied in. Choosing and writing questions:
   [QUESTIONS_REFERENCE.md](QUESTIONS_REFERENCE.md).

3. **A canvas for unbound thinking.** The shape of an idea, sketches, diagrams, mockups, options still in play.
   No question governs it, it doesn't count toward depth, and no nudge polices it
   ([FORMAT.md §6](FORMAT.md#6-canvas-unbound-space)).

4. **Target depth comes from risk.** Score four factors 0–2 (blast radius, reversibility, novelty, certainty):
   0–1 → D1, 2–3 → D2, 4–5 → D3, 6–8 → D4. What's needed *now* can be lower: `focus: next/later` and the
   project's stage cap it, and depth beyond the cap is over-documented. The gate before building always uses the
   full target.

5. **Marks fit the doc, not the other way round** ([FORMAT.md](FORMAT.md)):

   ```markdown
   ---
   anaxi: "@recurring"
   depth: D2 → D3
   risk: 2·1·1·1
   uses: ["@task-api", "@scheduler"]
   ---
   ```
   ```markdown
   ## Task API
   > @task-api · depth: D3 🎯 · uses: [@stack](stack.md) · caveats: no batch submit
   ```
   ```markdown
   ### Upgrade policy `D2 🎯`
   ```

6. **Shared items** (`@task-api`, `@stack`) are written once and referenced as `[@id](path)`. A shared item
   needs to reach its own target; an item that needs more asks for it: `uses: @x (D4)`.

7. **Nudges** tell people and agents what to do next ([NUDGES.md](NUDGES.md)).

8. **Projects tune it** with `anaxi.json` (profile, stage, targets, caps, nudges, heading names) and
   `anaxi-questions.md` ([PROFILES.md](PROFILES.md)).

9. **The super-TDD is the docs, linked.** An `INDEX.md` lists every item with badges and links, and is the
   place to start, for people and agents. A combined document can be rendered, but is optional
   ([TOOLING.md §4](TOOLING.md#4-moving-around-the-docs-links-index-render)).

## Files

| File | Holds | Read it when |
|---|---|---|
| [QUICKSTART.md](QUICKSTART.md) | set up, mark an item, use it in a sprint, on one page | first |
| [OVERVIEW.md](OVERVIEW.md) | what Anaxi is, how it fits a sprint, what it costs, how to evaluate it | sharing with a team |
| [METHOD.md](METHOD.md) | the ladder, rubric, targets and caps, fields, shared items, workflow | adopting the method |
| [FORMAT.md](FORMAT.md) | marking up markdown: items, badges, icons, references, levels from headings, checklists, canvas, a standard TDD | writing docs |
| [QUESTIONS.md](QUESTIONS.md) | principles, core questions, project and item questions, how they change | writing or reviewing an item |
| [QUESTIONS_REFERENCE.md](QUESTIONS_REFERENCE.md) | choosing and writing questions by project kind, stage and item type; the canvas; how questions adapt | setting up a project; writing questions |
| [NUDGES.md](NUDGES.md) | every nudge: trigger, who detects it, message, action, severity | deciding what to do next; building tools |
| [PROFILES.md](PROFILES.md) | `anaxi.json`, built-in profiles, per-item overrides | setting up a project |
| [templates/](templates/) | a TDD, a small item, `anaxi-questions.md`, `anaxi.json` | starting something |
| [TOOLING.md](TOOLING.md) | the three layers (method, project docs, output), the scripts, the index, rendering, installing | setting up; building the tools |
| [tools/SPEC.md](tools/SPEC.md) | the scripts: commands, parsing, rules, JSON, exit codes | building or calling the scripts |
| [skills/anaxi/SKILL.md](skills/anaxi/SKILL.md) | the agent skill | installing for Claude or another agent |
| [.claude-plugin/](.claude-plugin/), [skills/](skills/), [hooks/](hooks/) | the Claude Code plugin: manifest and marketplace, the skill and `/anaxi:*` commands, session and edit hooks | installing or changing the plugin |
| [skills/anaxi/references/question-library.md](skills/anaxi/references/question-library.md) | questions to borrow, by concern and kind of project | writing questions |
| [profiles/](profiles/) | the built-in profiles | choosing a profile |
| [example/](example/) | a small project using every form of markup, with its index and nudges | learning by example |
| [PILOT.md](PILOT.md) | a two-sprint trial with a calibration sheet and retro questions | trying it with a team |
| [ROADMAP.md](ROADMAP.md) | where it could go: an npm package, a live viewer (`anaxi watch`), an MCP server for agents | deciding what to build next |
| [CHANGELOG.md](CHANGELOG.md) | how the method has changed, and why | proposing a change |

## What it deliberately does not do

- **No code in the method's scope.** D4 can hold code *examples* in the docs. The docs never live in the code,
  and Anaxi never tracks shipped status. That belongs to your tracker and your repo.
- **No required structure.** No tree, ID ledger, word counts, document kinds or mandatory headings. `@ids`
  exist only for items that are shared or referenced.
- **No forms.** The questions are prompts. Answer them in prose, several at once, in whatever order reads
  well.

Origin: a simplification of an earlier proposal, Strata. Why depth became the one thing measured is in
[archive/ANALYSIS-AND-PROPOSAL.md](archive/ANALYSIS-AND-PROPOSAL.md).
