---
name: anaxi
description: Track and steer how deep technical design docs go, using Anaxi depth marks (D0 Why → D4 Build) in ordinary markdown. Use when writing, reviewing or planning a TDD, epic, story, feature or shared component; when asked "is this designed enough?", "how deep do we need to go?", "what's left to document?", "is this ready to build?"; before implementing anything with a `depth:` mark (front matter, `>` tag line, heading badge or comment); and when building an index or a combined TDD from marked-up docs.
---

# Anaxi

Anaxi marks every design item with how deep it has been taken (D0–D4 by default; a project's `anaxi.json` can change the ladder), how deep it needs to go, and what it
uses. Your job is to read the marks, check them against the principles and questions, write the questions this
particular item needs, and **nudge**: say what to do next, including "this is enough, stop".

## Method files

Read only what the current procedure needs. Paths are relative to the method folder.

| File | Read for |
|---|---|
| `METHOD.md` | the ladder, rubric, targets and caps, shared items, composition (once per session) |
| `FORMAT.md` | every way an item, reference, level, checklist and canvas can be marked in markdown |
| `QUESTIONS.md` | principles (§2), level definitions (§3), the ten core questions (§4), project and item questions (§5) |
| `QUESTIONS_REFERENCE.md` | choosing and writing questions by project kind, stage and item type; the canvas |
| `NUDGES.md` | nudge codes, messages, the signals for N07 and N08, reporting order |
| `PROFILES.md` | `anaxi.json` settings and profiles |
| `skills/anaxi/references/question-library.md` | wording to borrow when writing questions; never applied automatically |
| `templates/` | starting files for a TDD, a small item, project questions, settings |
| `TOOLING.md`, `tools/SPEC.md` | the scripts, the index, rendering |

**Finding the method folder**, first match wins: `$ANAXI_HOME`; the `method` key in the project's
`anaxi.json`; a vendored `tools/anaxi/` in the project; when loaded from the Claude Code plugin,
`${CLAUDE_PLUGIN_ROOT}` (if that reads as a literal variable, you weren't loaded from the plugin); otherwise two
folders above this skill (`skills/anaxi/` → the method root).

Then load the project's `anaxi.json` and `anaxi-questions.md`, if they exist, and apply them over the
profile (`PROFILES.md §1`). Item fields (`profile:`, `target:`, `skip:`, `focus:`) win over everything.

## The scripts

If they're installed (`node <method>/tools/anaxi-check.mjs`; see `tools/SPEC.md`), use them for everything
structural: finding items, targets and caps, gaps, blocked items, `later:` triggers, checklists,
the question set, the index. Do the semantic checks yourself (N05, N07, N08, N12, N16, N17).

**Without the scripts**, find the items by hand. Items can be declared four ways (`FORMAT.md §1`), so search for
all of them:

```bash
grep -rln "^depth:\|^anaxi:" <docs>          # front matter (whole-file items)
grep -rn -A2 "^> .*depth:" <docs>             # tag lines
grep -rn "^#.*\`D[0-4]" <docs>                # heading badges
grep -rn "<!-- anaxi:" <docs>                # comments
grep -rn "@<id>\|<path-of-item>" <docs>       # who references an item
```

Then apply `METHOD.md §3–§6` and the triggers in `NUDGES.md §2`. Work out section levels with the heading
table in `FORMAT.md §4`.

## Procedures

### 1. Orient (start of any Anaxi task)

Read `INDEX.md` if the project has one; otherwise run `anaxi-check status`, or build the status table
yourself. Tell the user where things stand in at most five lines, then do the task.

### 2. Start an item

1. Make sure D0 is answered: problem, who, success, non-goals. If it isn't, ask the user. Never invent the *why*.
2. Score the risk (`METHOD.md §3`), one clause per score. Work out the target, then the effective target
   (`METHOD.md §3.1`).
3. Declare it in whichever form fits the doc (`FORMAT.md §1`): front matter for a whole TDD, a tag line for a
   section. For a new TDD, start from `templates/TDD.md`; for a small item, `templates/item.md`. Keep the
   team's own template if they have one: its headings map to levels already.
4. Add `uses:` for every dependency D1.touches names, as `[@id](path)`. If a shared item doesn't exist yet,
   create it at D0 and tell the user.
5. Report the target, and the questions for the next level (procedure 3).

### 3. Write the item's questions

For the item's next level, up to its effective target:

1. Collect what already applies: core questions (`QUESTIONS.md §4`) and project questions whose `when:`
   matches the item's `about:` (or that have no `when:`), with the project's changes to core.
2. Generate the item's own questions from the level's principles (`QUESTIONS_REFERENCE.md §7.1`). Take the
   "done when" and ask what, for *this* item, could stop it being true. Don't repeat questions that already
   apply. Borrow wording from the library when something fits.
3. Write them as a checklist in the item (`FORMAT.md §5`): zero to five per level, each with its level.
4. Point out to the user any question that would help the whole project; it could go in `anaxi-questions.md`.

### 4. Assess an item ("is this enough?", review)

1. List the questions that apply (procedure 3, steps 1–2, plus the existing checklist).
2. For each required one, decide: **answered** (quote the sentence), **skipped** (a `skip:` with a reason), or
   **missing**. Answers can be anywhere in the item, in any form. **Ignore the canvas** when deciding what is
   answered.
3. Check the level's "done when" (`QUESTIONS.md §3`) as a final test.
4. The *supported* depth is the highest level where nothing is missing at that level or any level before it
   (levels are cumulative). If it differs from the claimed depth, report N05 and propose the corrected mark. The
   script already reports levels with nothing written; you judge whether written levels are answered.
5. Check `uses:` (N02), open questions and unchecked boxes (N03), depth against the effective target (N01,
   N06), out of focus (N08), over-engineering (N07), and canvas content that something relies on (N17). For N07,
   N08 and N17, quote the text.
6. Report in the `NUDGES.md §4` order:

```
Recurring tasks — D2 → D3 (risk 2·1·1·1)     supported depth: D2
  N02 block  uses @scheduler, which is at D2 of its target D3 (owner: scheduling)
  N03 warn   2 open: DST handling (D3); paused series and the weekly cap (D2)
  N01 warn   missing at D3: D3.contracts, D3.failure
  N08 warn   "Rule grammar" designs RRULE parsing, which is in later:
Next: answer D3.contracts and D3.failure; leave RRULEs in later:.
```

### 5. Deepen an item

1. Assess first (procedure 4), and write the next level's questions (procedure 3).
2. Answer the **next level's** missing questions only. Don't jump levels, and don't go past the effective
   target.
3. Put the answers under the doc's own headings. Use the team's template if there is one, otherwise the
   headings in `FORMAT.md §4`. D0–D1 in domain words; technology from D2; D4 code is illustrative and stays in
   the doc. If the TDD is getting long, or the team keeps deep detail elsewhere, put it in a part instead
   (`part-of: @id` in `APPENDIX.md` or a file beside the TDD, linked from the TDD; `FORMAT.md §9`). When
   assessing, read an item's parts too: `anaxi-check status --json` lists them.
4. Exploration, options still in play and sketches go in the canvas. Out-of-scope design goes to `later:` with
   a trigger (N07, N08).
5. Decisions the user hasn't made become unchecked questions. Don't make them silently. Ask the user when a
   decision is theirs: anything costly or one-way, or anything touching product scope. **A proposal is not an
   answer:** write it on the open question (`- [ ] D3 · Retry policy? → proposed: 3 tries, then dead-letter`) and
   leave the box unchecked. Check a box, or write an answer as settled, only when the user gave or accepted it.
6. Update the marks: the new depth, `skip:`, `caveats:`, `later:`. Re-score if certainty changed (N12). Then
   regenerate the index (`anaxi_index`, or `anaxi-check index`) if the project commits one. Never edit the index by
   hand.
7. When the effective target is reached with nothing open, say **enough** (N04) and stop.

### 5.1 Read before building

To answer a question about an item, start with `anaxi_outline` (or `anaxi-check outline @id`): every section with
its level, link, size and first sentence. Read only the section that answers it, and stop there. Before changing an
item, `anaxi_related` says what else the change touches. To build, read an item through `anaxi_context` (MCP) or
`anaxi-check context @id [--at Dn]`, not file by file: it returns the
item to the depth needed plus each thing it uses, once each, at the level needed, and the gate, and it follows a
superseded item to its successor. When the user wants to see the design, offer `/anaxi:watch`.

### 6. Gate (before implementing, always)

An item is **ready** when: it is at its **full** target (caps don't apply); nothing is open and every box is
checked; every `uses:` item is deep enough; and there are no `block` nudges. If it is ready, implement from the
item's levels and the contracts of what it uses. **Never from the canvas, and never from a guess at a missing
contract.** If it isn't ready, report N09 with the blockers and **stop: don't build, and don't open the gate
yourself.** Asked to build, you were not asked to design: offer to draft the missing answers as proposals
(procedure 5, step 5), list the decisions that are the user's, and wait. Deepen without asking only when the
user asked you to design or deepen the item. Never deepen an item someone else owns (a `uses:` blocker) without
being asked; name it as the blocker.

After building, mark it: `built: yes (today)` or `partly`, and `code:` with where it went (relative to the item's
file). On N23 (the design changed after the code), read what changed in the design and check the code against it
before anything else; then fix the code, or write today's date on `built:` once it matches. On N24 (built ahead of its
design), write the missing levels from what the code actually does, and say which parts you inferred. Never set
`built: yes` on something you didn't build or check.

### 6.1 Superseded, retired, archived (FORMAT.md §10)

- **Never build from, cite or extend a superseded, retired or archived item** (`status --all`, or a
  `superseded-by:` / `retired:` mark, or a file under the archive). Follow `superseded-by:` to the current
  successor and use that; mention the old one only when asked why something is the way it is.
- When a change to an item isn't compatible and something was built from it, or other items depend on it,
  propose superseding rather than rewriting: `anaxi-check supersede @old --by @new --why "…"`. Dropped with no
  replacement: `retire`. Out of the way: `archive`; gone: `delete` (only committed files). `restore` undoes.
  These change files, so say what you'll run and why before running them.
- Act on N18 (point uses at the successor), N19 (add the missing side), N20 (move open questions to the
  successor) and N21 (say why it was archived; pick a new id).
- A replaced decision inside a living TDD goes under a `Decision log` heading, not deleted.

### 7. Index and compose

- **Index:** `anaxi_index` (MCP) or `anaxi-check index` after any change to marks. Only when neither is available,
  edit `INDEX.md` by hand in the shape of `TOOLING.md §4.2` and say it was edited by hand (CI will regenerate it if
  set up).
- **A combined document** (only if asked): the roots and their sub-items, then everything they `uses`,
  transitively (`anaxi-check uses` lists them), each once; the status table first; canvas labelled; superseded
  and retired items left out unless asked for history. Assemble it
  yourself (`anaxi-render` isn't built yet) and say so.
- Prefer pointing people (and yourself) at the docs and the index over generating a copy.

### 8. Improve the questions

- Item questions that keep recurring: suggest moving them to `anaxi-questions.md`. Edit it if the user agrees.
- Good project questions that would help others: suggest adding them to the library.
- A core question that didn't fit, or a principle that seems wrong: add a row to `QUESTIONS.md §7`, with the
  failure the change would prevent, and tell the user. Don't change core or the principles yourself.

## Rules

- The marks are a claim; the content is the evidence. When they disagree, say so and propose the fix.
- "Enough" is an outcome to report clearly, not a gap to fill.
- Shallow on purpose (`later:`, `caveats:`, canvas) is fine. Shallow by accident is the problem.
- Don't restructure people's docs to fit Anaxi. Mark them up where they are.
- Keep reports short. Point at the item and the question; don't restate the method.
- The levels, rubric and questions are defaults. Use the project's ladder (`anaxi.json` → `levels`) and its
  "done when" tests. When a default keeps getting in the way (people fight a score, skip the same question,
  or an idea doesn't fit a level), suggest the change to `anaxi.json` or `anaxi-questions.md` instead of
  bending the doc to fit.
