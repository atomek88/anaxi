# Anaxi scripts: specification

> **Status:** `anaxi-check.mjs`, `anaxi-ci.sh`, `anaxi-init.sh`, `release.sh`, `lib/` and the plugin hooks
> (`../hooks/`) are built (`node tools/selftest.mjs` checks the scripts). `anaxi-render.mjs` is not. Not implemented yet in `anaxi-check`: N11 (needs git history
> per item), folder-level `anaxi.json` files, and `uses --json`. [TOOLING.md](../TOOLING.md) explains what each
> script is for.

Zero-dependency Node (≥ 18) scripts. They handle what is **structural**, which needs only the marks and the
settings. They never judge content: the semantic checks (N05, N07, N08, N12, N16, N17) belong to the agent.

Every command finds `anaxi.json` by searching upward from the working directory (defaults apply if there is
none), then layers profile → `anaxi.json` → folder files → item marks ([PROFILES.md §1](../PROFILES.md#1-where-settings-come-from)).
The docs are the markdown files matching `docs`, minus `ignore`, the questions file, the index, the output
folder, `node_modules`, `.git`, `.claude`, and any folder holding its own `anaxi.json` (a separate project).

## 1. `anaxi-check.mjs`
<!-- anaxi: part-of: @check -->
<!-- D3 -->

```bash
node anaxi-check.mjs status    [--focus now|next|later] [--about T] [--json]   # status table
node anaxi-check.mjs nudges    [@id | --all] [--diff BASE] [--json]            # structural nudges, NUDGES.md §4 order
node anaxi-check.mjs gate      @id                                             # exit 0 ready · 1 blocked (N09)
node anaxi-check.mjs questions @id [--level Dn]                                # core + project + item questions for this item
node anaxi-check.mjs questions --repeated | --skips                            # inputs for promoting and relaxing questions
node anaxi-check.mjs uses      @id                                             # who depends on this item, transitively
node anaxi-check.mjs index     [--out docs/INDEX.md] [--check | --path]        # write the index (TOOLING.md §4.2)
node anaxi-check.mjs check                                                     # syntax, settings and references; for CI
node anaxi-check.mjs new       NAME [--title T] [--small] [--in DIR]          # a TDD (or small item) from the template, @id and title filled
node anaxi-check.mjs context   @id [--at Dn] [--history] [--json]              # the item to a depth + each use once, at the level needed; the gate
node anaxi-check.mjs supersede @old --by @new [--why W]                       # FORMAT.md §10: marks both sides
node anaxi-check.mjs retire    @id --why W [--date YYYY-MM-DD]                # dropped, no successor
node anaxi-check.mjs archive   @id [--why W]                                  # whole-file items only; moves to `archive`, rewrites links both ways
node anaxi-check.mjs restore   @id                                            # removes the marks (both sides) and moves back to archived-from
node anaxi-check.mjs delete    @id [--force]                                  # archived and committed only; appends a row to <archive>/RETIRED.md
```

Human output is coloured on a terminal and wrapped to its width; `NO_COLOR=1` or a pipe turns colour off. Each
item ends with a `→ Next:` line, the first one or two actions in nudge order. `--json` is unchanged.

- Every command takes `--dir DIR` (default: the current folder).
- `--diff BASE` re-reads the docs as they were at a git ref and reports only nudges that are new or changed
  since then. It uses today's settings and questions for both.
- `status --all` also lists superseded, retired and archived items; `status --json` has them in `inactive`, and
  the ids in `RETIRED.md` in `deleted`. Every item has `lifecycle`, `supersededBy`, `supersedes`, `retired`, `successor`.
- The lifecycle commands take `--dry-run`, edit only the marks (in the form they were declared), and never touch
  a file's other text except relative links to a moved file.
- `index --check` exits 1 if the file on disk differs from what would be generated; `index --path` prints where
  the index goes (used by the pre-commit hook).

## 1.1 `anaxi-ci.sh`
<!-- anaxi: part-of: @check -->
<!-- D3 -->

```bash
anaxi-ci.sh [--fix] [--base REF] [--gate "@a @b"] [--dir DIR]
```

Runs `check` (exit 2 on errors), then `index --check` (exit 1 if stale), or with `--fix` regenerates the index
and `git add`s it. `--base` prints the new nudges (never fails on them). `--gate` fails unless every listed item
is ready.

## 2. `anaxi-render.mjs` (optional)

```bash
node anaxi-render.mjs @id | @a,@b | --file GLOB | --about T | --focus F | --super
                       [--at Dn] [--refs-at Dn] [--follow N] [--used-by] [--no-canvas]
                       [--md | --html | --json] [--out FILE]
```

Selection and output order: [TOOLING.md §4.4](../TOOLING.md#44-a-rendered-document-anaxi-render-optional-not-built-yet).

## 3. Parsing
<!-- anaxi: part-of: @engine -->
<!-- D3 -->

### 3.1 Declaring an item ([FORMAT.md §1](../FORMAT.md#1-declaring-an-item))

| Form | Recognized as |
|---|---|
| front matter | YAML at the top of a file with a `anaxi:` or `depth:` key. The item is the whole file; its title is the first `#` heading or the file name |
| tag line | one or more `>` lines directly under a heading, containing `depth:` |
| heading badge | inline code in a heading matching `` `@id` `` and/or `` `Dn` ``, `` `Dn → Dt` ``, `` `Dn enough` ``, `` `Dn 🎯` `` |
| comment | `<!-- anaxi: … -->` directly under a heading, same fields as a tag line |

If one heading has several forms, the fields are merged, and a conflict is reported by `check`.

**Parts** ([FORMAT.md §9](../FORMAT.md#9-parts-detail-kept-in-another-file)): front matter or a tag line with
`part-of: @id` and no `depth:` declares a part, not an item. The engine removes parts from the item list and adds
their sections (with `file`), checklist, `open:`, `uses:` and mentions to the host, which gets
`parts: [{file, line, anchor, title}]` (also in JSON output and as links in `INDEX.md`). A part's own heading is
its first section; a `` `Dn` `` badge on it sets that section's level. A part whose host doesn't exist is an error
(N15).

A heading badge **inside** an item declares a sub-item only if it has an `@id`, an arrow or `enough`/🎯
(`` ### Upgrade policy `D2 🎯` ``). A bare `` `Dn` `` there marks the section's level instead
(`` ### Rollout `D4` ``). Outside any item, a bare `` `Dn` `` declares an item.

In front matter, keys that aren't Anaxi fields (`author:`, `status:` and so on) belong to the team's template
and are ignored. In tag lines and comments, unknown fields produce a warning.

### 3.2 Fields

```
fields   = [ "@" id SEP ] field { SEP field }
SEP      = " · " | " | "
field    = "depth:" level [ arrow level | done ]
         | "risk:" n { "·" n }                       ; one score per rubric factor, 0–2
         | "target:" level [ "(" reason ")" ]
         | "about:" word { "," word }                ; free-form topics
         | "uses:" ref { "," ref }
         | "open:" text { ";" text }
         | "skip:" qid "(" reason ")" { "," qid "(" reason ")" }
         | "caveats:" text | "later:" text           ; trigger: "when @id reaches Dn"
         | "focus:" ("now" | "next" | "later")
         | "profile:" name
         | "part-of:" "@" id
         | "superseded-by:" "@" id [ "(" reason ")" ] | "supersedes:" "@" id { "," "@" id }
         | "retired:" date [ "(" reason ")" ]          ; date YYYY-MM-DD; a date or a reason is required
         | "archived-from:" path                       ; written by `archive`, read by `restore`
ref      = ( "@" id | "[" text "](" path ")" ) [ "(" level ")" ]    ; a link counts if its target is a tagged item
level    = "D0" | "D1" | "D2" | "D3" | "D4"
arrow    = "→" | "->"
done     = "enough" | "🎯"
```

In front matter, the same fields are YAML keys; lists may be YAML lists. Icons in [FORMAT.md §2](../FORMAT.md#2-badges-and-icons)
are read as the words they stand for. Unknown fields are kept and reported by `check` as warnings, so the method
can grow without breaking older scripts.

### 3.3 Inside an item

- **Sections:** each heading below the item gets a level by explicit mark, then heading name, then the
  section above ([FORMAT.md §4](../FORMAT.md#4-what-level-a-piece-of-content-is-at)), with `sections` from
  `anaxi.json` added to the name table.
- **Canvas:** sections mapped to `canvas`, headings with 🎨, or content after `<!-- canvas -->` until the next
  heading of the same or a higher level.
- **Checklist:** `- [ ]` and `- [x]` lines, anywhere in the item outside the canvas. An optional `Dn ·` prefix
  gives the level; text after `→` is the answer. A sub-item's lines belong to the sub-item.
- **Mentions:** `@id` and links to tagged items in body text.

### 3.4 Questions

`questions.mjs` reads the table under `### Core` in [QUESTIONS.md](../QUESTIONS.md) (columns: ID, Question, Why it
matters; the level is the ID's prefix), then the project file ([QUESTIONS.md §5.1](../QUESTIONS.md#51-project-questions)):
`## Added` lines (`[**ID**] · Dn · question [· when: topics] [· why: text] [· opt]`) and `## Changes to core`
lines (`reword:`, `skip-all:`), and `## Principles` (shown by the skill, not checked). Profile `"core"` changes are applied before the project's.

## 4. Structural rules
<!-- anaxi: part-of: @engine -->
<!-- D3 -->

| Rule | Computed as |
|---|---|
| target | `target:` if present; else the sum of `risk:` through the thresholds (after `rubric.floors`); else `Dt` from `Dn → Dt`, or `Dn` from `Dn enough`. Then raised by `targets.min` and matching `rules`, lowered by `targets.max`, and raised to n if any item has `uses: @this (Dn)`. If `risk:` and the written `→ Dt` disagree, `check` warns |
| effective | min(target, focus cap, stage cap) ([METHOD §3.1](../METHOD.md#31-effective-target-what-is-needed-now)) |
| open | `open:` entries, plus unchecked checklist lines at a level ≤ effective. Lines with no level always count |
| current | the claimed `depth:`, capped at **shown**: the highest level n with every level 0…n written. A level is written when the item's blocks at that level (its headings' sections and `**Why.**`-style lead-ins, parts included, headings and marks not counted) hold at least `nudges.levelWords` words (default 10; 0 turns this off). A sub-item uses its parent's words for a level it doesn't write itself. An item with no levelled text isn't measured: current = the claim. **deepest** is the deepest written level, gaps allowed |
| N01 | current < effective |
| N02 | for each `uses:` ref: required = the `(Dn)` given, else the target's full target; fires when current(target) < required. `block`, or `info` when this item is `focus: later`. The used item gets an info line listing who waits |
| N03 | open is not empty |
| N04 | current = effective, nothing open, no N02. Says "for now" when effective < target |
| N06 | max(current, deepest) > effective (canvas and history never count) |
| N22 | shown > claimed: info, content past the claim |
| N05 (structural part) | shown < claimed: the message names each level up to the claim with nothing written; or the item claims D0 and every D0-mapped section is empty (HTML comments don't count). The rest of N05 (is it *answered*, not just written) is the agent's |
| N09 | gate fails when current < the **full** target, anything is open (any level), a `uses:` item isn't deep enough or doesn't resolve, or there is any other `block` nudge |
| N10 | a `later:` trigger `when @x reaches Dn` where current(@x) ≥ Dn |
| N11 | git: the last commit touching @x's section is newer than the commit that set this item's `enough` |
| N13 | a heading inside `docs` with more than 80 words and no item above it (`nudges.untaggedWords` in `anaxi.json`) |
| N14 | no `risk:`, no `target:`, and `depth:` has no `→ Dt` or `enough` (`Dn enough` sets target = Dn) |
| N15 | an `@id` in `uses:` or `later:` that nothing declares, or a link in `uses:` to an untagged target |
| check | errors: unreadable depth, risk or target; duplicate `@id`; a `uses:` that doesn't resolve; `skip:` or `skip-all:` without a reason; a change to a core question that doesn't exist. Warnings: risk and the written target disagree; `enough` below the target; a heading badge and a tag that disagree; unknown fields; the wrong number of risk scores |
| lifecycle | archived if the file is under `archive`; else superseded if `superseded-by:`; else retired if `retired:`; else current. A section item inherits a non-current parent's state. Non-current items are left out of `items`, targets, caps, N01–N06 and the status table; they're in `inactive`. The successor follows `superseded-by:` until a current item |
| N18 | a current item's `uses:` resolves to a non-current item (instead of N02) |
| N19 | `superseded-by: @x` where @x doesn't say `supersedes:` this id, or names a deleted id; `supersedes: @x` where @x doesn't say `superseded-by:` this item |
| N20 | a non-current item with anything open |
| N21 | an archived item with neither `superseded-by:` nor `retired:`; a declared id that `RETIRED.md` lists |
| gate (lifecycle) | a non-current item is never ready (the reason names its successor); a `uses:` that resolves to a non-current item fails the gate |
| status | ⛔ blocked (an N02 block) · ⏸️ `focus: later` · ✂️ over-documented (N06) · ⬇️ go deeper (N01) · ❓ open, or no target · 🎯 enough, in that order |

## 5. JSON output
<!-- anaxi: part-of: @engine -->
<!-- D3 -->

`status --json` and `nudges --json`:

```json
{
  "format": "anaxi/1",
  "settings": { "profile": "mobile", "stage": "pre-build" },
  "items": [
    { "id": "@recurring", "title": "Recurring tasks", "file": "features/recurring-tasks.md", "line": 1,
      "declared": "front-matter", "depth": "D2", "target": "D3", "effective": "D3", "risk": [2, 1, 1, 1],
      "about": ["data", "async", "ui"], "focus": "now",
      "uses": [{ "id": "@scheduler", "path": "shared/scheduler.md", "required": "D3", "actual": "D2" }],
      "open": [{ "text": "What happens to an occurrence in a DST gap?", "level": "D3", "source": "checklist" }],
      "sections": [{ "heading": "Proposed design", "level": "D2", "by": "name", "line": 24 },
                   { "heading": "Appendix: sketches", "level": "canvas", "by": "name", "line": 61 }],
      "caveats": "weekly and monthly only",
      "later": [{ "text": "custom recurrence rules", "trigger": null }] }
  ],
  "nudges": [
    { "code": "N02", "severity": "block", "item": "@recurring", "message": "uses @scheduler, which is at D2 of its target D3" }
  ]
}
```

The format is versioned. Add fields; don't rename them.

## 6. Exit codes
<!-- anaxi: part-of: @check -->
<!-- D3 -->

| Code | `anaxi-check` | `anaxi-render` |
|---|---|---|
| 0 | clean, or ready (`gate`) | rendered |
| 1 | blocked (`gate`), or `block` nudges (`nudges`) | — |
| 2 | syntax, settings or reference errors | unknown root, or a parse error |

## 7. Plugin hooks
<!-- anaxi: part-of: @check -->
<!-- D3 -->

`hooks/hooks.json` wires two Node scripts. Both read Claude Code's hook JSON on stdin, import `tools/lib/`
directly, and exit 0 whatever happens: a hook never fails a session or an edit.

| Hook | Script | Does |
|---|---|---|
| `SessionStart` | `hooks/session-start.mjs` | when `anaxi.json` is found upward from `cwd` and `hooks.sessionStart` isn't `false`: prints the status table (no colour, at most 40 lines) and the commands; stdout becomes session context. Also writes the plugin's folder to `~/.anaxi/home` for the git hook |
| `PostToolUse` (`Edit\|Write\|MultiEdit`) | `hooks/after-edit.mjs` | when `hooks.afterEdit` is `true` and the edited file is markdown in the project: the errors for that file and the nudges (except N04) of the items it holds or is a part of, returned as `additionalContext` |

`anaxi-init.sh --plugin` (run by `/anaxi:init`) is `--no-vendor --no-skill` with plugin wording.
`release.sh VERSION [--push]` refuses a dirty tree or a version with no CHANGELOG entry, runs the self-test, the
example's CI and `claude plugin validate --strict`, writes the version to `.claude-plugin/plugin.json`, commits,
and runs `claude plugin tag`.

## 8. Reading, the reader and the MCP server

### 8.1 Reading an item
<!-- anaxi: part-of: @engine -->
<!-- D3 -->

**Blocks** (`lib/read.mjs`). An item's lines are its whole file after the front matter, or its heading down to
the next heading of the same or a higher level, then each part's. They split into blocks (`heading`, `para`,
`list`, `table`, `code`, `mark`), each with a level: a heading's is its section level; a paragraph starting with a
level's name as a bold lead-in (`**Why.**`, `**What.**`, `**Shape.**`, `**Contract.**`, `**Build.**`, plus the
project's own level names) sets its own, and a paragraph with several is split at each; other blocks inherit.
A wrapped list line continues its item. At depth n a block shows when its level ≤ n, the canvas and history only
on request, and unlevelled text always; deeper never shows less, and nothing is lost (self-tested).

**Context** (`context @id`, `anaxi_context`). The item at `--at` (default: its target), then each item it uses,
transitively and once each, at the `(Dn)` asked for or that item's target, then the gate. A superseded or retired
item is replaced by its successor, with a note, unless `--history`.

### 8.2 anaxi-watch
<!-- anaxi: part-of: @reader -->
<!-- D3 -->

`GET /` the page · `GET /api/model` the model (`anaxi/1`: items and inactive items with their
blocks, gate, `shown` depth and `related` list, the doc `files`, deleted ids, nudges, errors, levels). `related` holds
`{ key, kind, level?, blocked? }` for each connection, both ways: `uses`/`used-by` (with the level needed and whether it
blocks), `mentions`/`mentioned-by` (an `@id` in the committed text that isn't already a use), `changed-with` (an `@id` in a
decision log: the changes went together; the same both ways), `supersedes`/`superseded-by`, and
`inside`/`contains` for sub-items; and `role`: `feature`, `shared` (in `anaxi.json` `shared`) or `foundation` (shared, using
nothing current) · `GET /events` server-sent `change` after a save
(`fs.watch`, debounced). Binds 127.0.0.1; GET only; never writes.

### 8.3 anaxi-mcp
<!-- anaxi: part-of: @mcp -->
<!-- D3 -->

MCP over stdio (JSON-RPC 2.0, one message per line): `initialize`, `tools/list`, `tools/call`,
`ping`. The project is `--dir`, else `$CLAUDE_PROJECT_DIR`, else the working folder, or a tool's `dir` argument.
Every call re-reads the docs. Errors (no `anaxi.json`, unknown id) come back as tool results with `isError`. `anaxi_related` returns the
same list as the reader (`related` in `lib/engine.mjs`), each entry with the other item's id, title, file, depth, shown
depth and status, sorted by kind, plus the item's `role`. Only
`anaxi_index` writes, and only the configured index file (`check: true` writes nothing; an unset `index` is an error).

