# Anaxi changelog

How the method changes, and why. One line per change to the ladder, the question bank, nudges or profiles.
Newest first. Format: `date · area · change · why`.

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
