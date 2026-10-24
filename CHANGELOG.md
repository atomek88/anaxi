# Anaxi changelog

How the method changes, and why. One line per change to the ladder, the question bank, nudges or profiles.
Newest first. Format: `date · area · change · why`.

## 0.9 · unreleased

- method · **A claim counts only as far as the text backs it without a gap.** The script measures each level's
  words (headings and lead-ins, parts included); `depth:` is capped at the highest level with every level before
  it written (`nudges.levelWords`, default 10; 0 = off). Structural N05 names the empty levels; status, targets
  and the gate use the capped depth; N06 also fires for content past the target; new N22 (info) when the text
  goes deeper than the claim · @settings claimed D4 from one build paragraph with nothing at D2–D3, and the
  checker took the claim at its word.
- tooling · **The reader's item page has three panes** (TOOLING.md §4.3): a file tree with lines to every connected
  file, the doc with deeper levels folded to one line each that unfold in place, and a minimap of the item's levels
  with what it uses and what uses it as branches. Hovering any name previews it. `related` (uses, used by, mentions,
  supersedes, sub-items, both ways) and `files` in `/api/model` · reading deeper or across to a related item took a
  page load and a scroll each; now it's one click or a hover.
- tooling · `status`, the index and the reader show "D1 (claims D4)"; the reader's depth bars grey out levels
  written past a gap and outline empty claimed levels in red; JSON gains `shown` and `levelWords`.
- format · **Lifecycle marks:** `superseded-by:`, `supersedes:`, `retired:`, an `archive` folder with
  `RETIRED.md`, and `Decision log` sections that are kept but never counted (FORMAT.md §10, METHOD.md §6.1) ·
  replaced designs must stay readable without reading as current, especially to agents.
- tooling · `anaxi-check supersede | retire | archive | restore | delete`: edit the marks in whatever form they
  were declared, move whole files, rewrite links both ways; `restore` undoes exactly; `delete` only for committed
  archived files. `status --all`, `inactive` and `deleted` in the JSON, a "Superseded and retired" index section.
- nudges · N18 uses-superseded, N19 one-sided, N20 superseded-open, N21 archive-hygiene. The gate fails on a
  non-current item and on uses of one.
- roadmap · The reader shows the design as linked pages (overview, one page per item, an outline), never one
  endless scroll; one continuous document only for print or export.
- example · an archived superseded doc, a deleted id, a decision log.
- tooling · **`anaxi watch`** (`/anaxi:watch`): a read-only local reader. Overview, topic and item pages; D0–D4
  buttons set how deep to read; parts inline; gate, nudges, uses, used-by; next and previous in `uses:` order; a 2D
  depth-bar map that opens on topics past 12 items; reloads on save · chosen by an exploration on the example's
  real data (docs/prototypes/viewer): the 3D stack hid items already at 7, the city's labels collided at 7.
- tooling · **`anaxi-mcp`** (in the plugin's `.mcp.json`): `anaxi_status`, `anaxi_nudges`, `anaxi_gate`,
  `anaxi_questions`, `anaxi_context`, `anaxi_uses`; and `anaxi-check context @id --at Dn` · agents read one bounded,
  depth-aware answer instead of the docs file by file.
- format · Levels also come from paragraph lead-ins named after the levels (`**Why.**` … `**Build.**`, and a
  project's own level names), split mid-paragraph · headings alone gave the depth control nothing on 6 of the
  example's 8 items.

## 0.8 · 2026-10-23

- tooling · **Claude Code plugin.** The repo is the plugin and its own marketplace: the skill, the checker,
  `/anaxi:status`, `/anaxi:assess`, `/anaxi:gate`, `/anaxi:init`, a session-start hook (status table) and an opt-in
  after-edit hook (that file's nudges) · one install per machine instead of a copy per repo (TOOLING.md §5).
- tooling · `anaxi-init.sh --plugin` (what `/anaxi:init` runs): nothing vendored, no skill link. The git pre-commit
  hook now finds the checker through `$ANAXI_HOME`, a vendored copy or the plugin, and skips instead of failing.
- tooling · `tools/release.sh VERSION`: checks, sets the plugin version, commits and tags; developing stays live
  through the `~/.claude/skills/anaxi` link.
- settings · `ignore` globs, and a folder with its own `anaxi.json` is a separate project (the repo root no longer
  reads `templates/` or `example/` as its own items); `hooks.sessionStart` / `hooks.afterEdit`.
- repo · Own repo, `~/Professional/anaxi` (was `doc-layers/anaxi`). The skill moved to `skills/anaxi/`, profiles to
  `profiles/`. The archive keeps only the Strata review (§1–5) and its viewer; the rest is in git history.
- roadmap · Plugin marked built; step 3 is now the zoomable map (2D graph, 3D layer stack, city, house) and step 5
  references and attribution (`refs:`, `owner:`, last changed).
- roadmap · Step 3 starts with a markdown reader for the docs themselves (depth filter, parts inline, links and
  backlinks, the super-TDD live, diffs, static export); new step 6, superseding and archiving design knowledge
  (`superseded-by:`, `supersedes:`, `retired:`, `docs/archive/`, `RETIRED.md`) · seeing the actual docs matters
  more than the picture, and stale docs mislead agents.

## 0.7 · 2026-10-21

- method · **The levels, rubric and questions are defaults, not rules** (METHOD.md §0). Only three ideas stay
  fixed: depth means answered questions, levels are cumulative, markdown is the source of truth · retrofitting
  ideas into a fixed ladder and rubric limited them.
- tools · `levels` in `anaxi.json`: rename a level, rewrite its "done when", drop the top ones (`"D4": null`)
  or add D5…. Headings, questions and thresholds for a dropped level fall back to the top level · teams think in
  different ladders.
- tools · `questions` shows each level's name and "done when"; a level with no questions yet points at its
  "done when" · a new level is usable before anyone writes questions for it.
- docs · The team overview is in the repo as OVERVIEW.md, kept in step with the Claude doc.
- format · **Parts**: `part-of: @id` on a section (e.g. in `APPENDIX.md`) or a file makes it count as that item's
  own content; the index lists each item's parts (FORMAT.md §9) · TDDs shouldn't need thousands of lines to
  cover every level, and content should be free to move as the docs grow.

## 0.6 · 2026-10-19

- tools · `anaxi-check new NAME`: a TDD from the template with its `@id` and title filled in. `anaxi-init`
  suggests it · starting from raw placeholders made the first nudges about the template, not the feature.
- tools · Readable terminal output: one block per item with its file, wrapped lines, colour on a terminal, open
  questions and the next level's questions listed in full, and a `→ Next:` line · the output should be a guide to
  follow, not a log to decode.
- tools · An item claiming D0 with empty D0 sections now gets N05 from the script, with the D0 questions ·
  a new doc used to skip straight to D1.
- docs · New shareable overview for engineering teams (a Claude doc), with a diagram of the parts.

## 0.5 · 2026-10-11

- tools · **Built** `tools/lib/` (config, parse, questions, engine), `anaxi-check.mjs` (status, nudges with
  `--diff`, gate, questions, uses, index with `--check`, check), `anaxi-ci.sh`, a pre-commit hook and
  `selftest.mjs`. The example's index and nudges are now generated. Not built: `anaxi-render`, `anaxi-init`,
  N11 · the method was unusable at scale while the structural part was done by hand.
- tools · Three ways to keep `INDEX.md` fresh: CI (`anaxi-ci.sh` fails when stale), a pre-commit hook
  (regenerates and stages it), and the agent (regenerates after changing marks). The index has no date, so it is
  deterministic · a committed index that drifts is worse than none.
- format · An unchecked checklist line with no level counts as open at any depth (it used to belong to "the next
  level", which let it be ignored once the item reached its target). A bare `` `Dn` `` heading badge inside an
  item marks a section's level; one with an `@id`, arrow or 🎯 declares a sub-item.
- docs · New QUICKSTART.md (one page) and PILOT.md (a two-sprint trial with two-person calibration).
- tools · `anaxi-init.sh`: one command adds Anaxi to a new or existing project, never overwriting. HTML
  comments in `anaxi-questions.md` are now ignored (the template's commented examples were being applied).
- docs · New ROADMAP.md: npm package, Claude Code plugin, `anaxi watch` viewer, MCP server.

## 0.4 · 2026-10-11

- questions · Core cut from 25 to **10 broad questions**: two per level, one at D4 (`D0.why`, `D0.non-goals`,
  `D1.behavior`, `D1.acceptance`, `D1.touches`, `D2.shape`, `D2.decisions`, `D3.contracts`, `D3.failure`,
  `D4.plan`). The narrower ones moved to the library under "Core extras". Old IDs map to the question that
  absorbed them · 25 was a form; broad prompts, with specifics added per item, are not.
- questions · Changes to core are now `reword:` and `skip-all:` only. There is no "optional" core.
- principles · No longer a fixed, numbered list. A **starting set**, unnumbered, which each project adapts in the
  `## Principles` section of `anaxi-questions.md`. The level definitions (aim, bounds, done-when) stay fixed,
  because they are what makes depth comparable.
- format · **No check marks.** `enough` / 🎯 means "reached its target depth", not "done"; Anaxi doesn't track
  delivery. New ✂️ `trim` for over-documented (it used to share ⚠️ with caveats). 🔗 dropped, since links show
  dependencies already.
- method · New METHOD §8.1: how Anaxi attaches to refinement, Definition of Ready, planning, review, spikes,
  retros and tickets, without adding ceremonies or touching the tracker.

## 0.3 · 2026-10-11

- questions · Topic and project **packs removed** from the method. The method keeps **principles** (P1–P10, plus
  aim, bounds and done-when per level) and a smaller core; projects keep their own questions in
  `anaxi-questions.md` (markdown); people and agents add **item questions** as a checklist. The old pack
  questions became a non-binding **library** in the skill · a global question set can't stay right for every
  project, and the people doing the work know what to ask.
- questions · Core trimmed: `D3.data-model` and `D3.compat` merged into `D3.data`; `D2.observability`,
  `D2.size`, `D3.limits`, `D3.example` moved to the library · not universal.
- format · New FORMAT.md: items declared by front matter, tag line, heading badge or comment; icons; `[@id](path)`
  references; section levels from common TDD headings; checklists; canvas. Level markers are no longer
  required · docs must stay plain markdown that works with LLMs and existing TDD templates.
- method · **Canvas**: unbound space for shape, sketches, visuals and ideas; doesn't count toward depth; exempt
  from nudges except the new N17 (canvas-promote).
- method · Sub-items inherit their parent's answers. `Dn ✅` and `Dn → Dt` give the target, so small items need
  no risk score.
- tooling · The super-TDD is the linked docs plus a generated, committed `INDEX.md`; rendering a combined
  document is optional and last in the build order.
- templates · TDD, small item, `anaxi-questions.md`, `anaxi.json`.
- repo · Strata files moved to `../archive/`.

## 0.2 · 2026-10-11

- questions · Bank split into a small **core** and opt-in **packs** (topic packs via `about:`, project packs via
  `anaxi.json`) · a single global set put the burden on every question being right for every project.
- questions · Admission test for core: "would it be wrong to skip this on any reasonable project?"; IDs for
  project questions get a prefix · keeps the global bank safe to apply anywhere.
- questions · `D2.tech` → `D2.stack` (languages, frameworks, libraries, and what is new); new `D4.dependencies`
  (exact packages and versions); `D4.layout` → `D4.where`; `D3.compat`, `D3.states` and `D1.permissions` moved
  into packs · the docs had no clear place for libraries and frameworks; moved questions weren't universal.
- method · `@stack` shared item recommended for project-wide technology choices.
- method · A shared item is satisfied at **its own target**; `uses: @x (Dn)` asks for more. The D3 cap is
  removed · the cap restricted items for no reason.
- method · **Effective target** = min(target, focus cap, stage cap); new `stage` setting. N08(a) and the special
  focus suppression of N01/N02 removed: over-documented (N06) now covers depth the plan doesn't need yet. The
  gate always uses the full target · one rule instead of three.
- docs · New QUESTIONS_REFERENCE.md (choosing questions by project kind, stage and item type; how the bank
  adapts) and TOOLING.md (the three layers, the script list, the build flow, rendering across references).
  `skill/SCRIPT.md` → `tools/SPEC.md`, split into `anaxi-check.mjs` and `anaxi-render.mjs`.
- profiles · New `library` profile; profiles now switch packs on, and `packs.everywhere` applies a topic pack to
  every item.

## 0.1 · 2026-10-10 · first version

- method · Depth means one thing: which questions are answered. Kinds, word budgets, the ID ledger and the
  required tree from Strata are dropped · Strata's "depth" carried five meanings and `up:` three relations;
  the team found it too heavy to use under deadline.
- ladder · D0 Why, D1 What, D2 Shape, D3 Contract, D4 Build. No "done/shipped" level · shipped status
  belongs to the tracker and the repo; D4 may hold illustrative code, but docs never live in code.
- questions · Several questions per level, required, optional or topic-conditional, with skip-with-reason and
  a proposal/challenge process · one exit question per level was too narrow to be useful.
- rubric · Kept Strata's four risk factors, with new thresholds: 0–1 D1, 2–3 D2, 4–5 D3, 6–8 D4.
- nudges · Catalogue N01–N16 in its own document, including over-engineered (N07) and out of focus (N08) ·
  the method has to say "stop" as clearly as "go deeper".
- profiles · Projects tune questions, topics, rubric, min/max targets and nudges through `anaxi.json`;
  seven built-in profiles · different kinds of work need different questions.
- tools · Skill written; script specified, not built.
