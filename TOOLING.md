# Anaxi tooling: what the system is made of, and how docs get built

## 1. Three layers

| Layer | What it is | Where it lives | Who edits it |
|---|---|---|---|
| **1 · Method** | this folder: principles and core questions, nudges, format, profiles, templates, the agent skill, the scripts | once per organization: a shared repo, vendored into each project (`tools/anaxi/`), or a git submodule | method owner |
| **2 · Project** | the project's own markdown design docs (any structure, marked up per [FORMAT.md](FORMAT.md)), shared items including `@stack`, `anaxi-questions.md`, `anaxi.json` | in the project repo, next to the code (e.g. `docs/`) | the team, and agents working with them |
| **3 · Output** | `INDEX.md` (committed, so readers and agents always have it); optional rendered documents and JSON (not committed) | `index` and `out` in `anaxi.json` | nobody; regenerate it |

The design documentation **is the project's markdown docs**, marked up. They stay readable and useful with
no tools at all. The method folder tells people, agents and scripts how to read them, and the output only
makes them easier to move around in.

A project repo looks like this:

```
my-project/
  anaxi.json                       settings (PROFILES.md); optional
  docs/
    anaxi-questions.md             the project's questions (QUESTIONS.md §5.1)
    INDEX.md                        generated index of every item (§4.2)
    shared/
      stack.md                      @stack: languages, frameworks, libraries, and why
      task-api.md                   @task-api
    features/
      recurring-tasks.md            a TDD in your usual template, with front matter
    _anaxi/                        rendered output (gitignored)
  tools/anaxi/                     the method, vendored (or point ANAXI_HOME at a shared copy)
  .claude/skills/anaxi → tools/anaxi/skill      the agent skill, linked
```

## 2. Scripts

Zero-dependency Node (≥ 18) and bash. The skill also works without them (by hand, with `grep`).

| Script | Does | Status |
|---|---|---|
| `tools/lib/` (`config.mjs`, `parse.mjs`, `questions.mjs`, `engine.mjs`) | shared code. **config:** profile → `anaxi.json` layering, finding the docs. **parse:** the four ways to declare an item, icons, `@id` and link references, section-to-level mapping, the canvas, checklists. **questions:** the core table in QUESTIONS.md and the project's `anaxi-questions.md`. **engine:** targets, caps, open questions, structural nudges, the gate, the index | built |
| `tools/anaxi-check.mjs` | `status`, `nudges` (with `--diff`), `gate`, `questions`, `uses`, `index` (with `--check`), `check`, `new`; the lifecycle: `supersede`, `retire`, `archive`, `restore`, `delete`; JSON output | built |
| `tools/anaxi-ci.sh` | for CI or a pre-commit hook: `check`, then `INDEX.md` (fail if stale, or `--fix` to regenerate and stage it), new nudges since a ref (`--base`), gates (`--gate "@a @b"`) | built |
| `tools/hooks/pre-commit` | runs `anaxi-ci.sh --fix` on commits that touch markdown; on commits with code, `anaxi-check gate-files --staged`: silent unless a staged file is held, then a warning (`gate.commit: "warn"`, the default), or a stopped commit with `"block"` | built |
| `tools/selftest.mjs` | checks the example's statuses and that a broken project trips every structural check | built |
| `tools/anaxi-init.sh` | adds Anaxi to a new or existing project: vendors the method into `tools/anaxi`, writes `anaxi.json`, `anaxi-questions.md` and `@stack`, links the skill, installs the hook, builds the first index. Never overwrites | built |
| `tools/anaxi-watch.mjs` | the reader: linked pages (overview → topic → item) with a depth control, parts inline, uses and used-by, the gate, and a 2D map; reloads on save; read-only (§4.3) | built |
| `tools/anaxi-mcp.mjs` | the engine as MCP tools for agents: `anaxi_status`, `anaxi_nudges`, `anaxi_gate`, `anaxi_questions`, `anaxi_context`, `anaxi_outline`, `anaxi_uses`, `anaxi_related`, `anaxi_for_file`, and `anaxi_index` (the one write: regenerates the index) | built |
| `tools/lib/read.mjs` | an item's text as levelled blocks (headings, and lead-ins named after the levels), the depth filter, and the bounded context for building | built |
| `tools/release.sh` | releases a plugin version: checks, sets the version, commits, tags (§5.1) | built |
| `hooks/` | the plugin's session-start and after-edit hooks ([tools/SPEC.md §7](tools/SPEC.md#7-plugin-hooks)) | built |
| `tools/anaxi-render.mjs` | optional: composes several items into one document | not built: links and the index cover most needs |

Full command reference, grammar, rules and JSON: [tools/SPEC.md](tools/SPEC.md).

**Script or agent?** Scripts handle what can be computed from the marks: depth, targets, caps, references,
`later:` triggers, checklists, the index. The agent handles what needs the content read: are the questions
really answered (N05), over-engineering (N07), out of focus (N08), rescore (N12), question friction (N16),
canvas to promote (N17), and writing an item's own questions. The skill calls the scripts when they exist, so
the two never disagree on the structural part.

## 3. How documentation gets built

```
 write markdown, mark it up ──► anaxi-check (local, or via the skill) ──► nudges: deepen / stop / wait
           ▲                                                                       │
           └────────────────────────────── fix ◄───────────────────────────────────┘
                         │
                         ▼
 open PR  ──► anaxi-ci: check · INDEX.md regenerated · new nudges posted · gate for items to be built
                         │
                         ▼
 review   ──► reviewers read the doc itself, following links; INDEX.md for the big picture
              (or a rendered document, if they want one file)
                         │
                         ▼
 merge    ──► the docs are the source; INDEX.md is up to date
```

Day to day:

| When | Run | You get |
|---|---|---|
| starting a feature | copy [templates/TDD.md](templates/TDD.md) or [templates/item.md](templates/item.md), or ask the skill | an item with a target, and the questions for its next level |
| writing | `anaxi-check nudges @id` | what's missing, and when to stop |
| planning, stand-up | `anaxi-check status --focus now`, or read `INDEX.md` | gaps, blockers, and what is enough |
| before building | `anaxi-check gate @id` | ready or blocked, with reasons |
| onboarding, cross-team review | `INDEX.md`, then follow links | the whole project, one click from any item |

## 4. Moving around the docs: links, index, render

Three ways, each needing a little more tooling than the last. Use the first that's enough.

### 4.1 Links (no tools)

Every item links to what it uses (`uses: [@task-api](../shared/task-api.md)`) and mentions what it touches.
A person on GitHub, or an agent reading files, follows the links. Standard markdown links work everywhere,
which is why [FORMAT.md §3](FORMAT.md#3-references) recommends `[@id](path)`.

### 4.2 The index (`anaxi-check index`)

`INDEX.md` is the super-TDD's front page. It is plain markdown, generated and committed:

```markdown
# Design index · mobile profile · stage: pre-build

| | Item | Depth | Target | Uses | Used by | Open |
|---|---|---|---|---|---|---|
| ⛔ | [Recurring tasks](features/recurring-tasks.md) `@recurring` | D2 | D3 | [@task-api](shared/task-api.md), [@scheduler](shared/scheduler.md) | — | 2 |
| ⬇️ | [Scheduler](shared/scheduler.md) `@scheduler` | D2 | D3 | [@task-api](shared/task-api.md) | @recurring, @multi-calendar | 1 |
| 🎯 | [Task API](shared/task-api.md) `@task-api` | D3 | D3 | [@stack](shared/stack.md) | @recurring, @scheduler | 0 |

## Nudges
- ⛔ **Recurring tasks** uses @scheduler, which is at D2 of its target D3
- …
```

Sections: the table (shared items last), then the structural nudges, then everything in `later:`. An agent
asked about the project starts here, then opens only the files it needs. The index has no date in it, so the
same docs always give the same file, and a stale one can be detected.

#### Keeping `INDEX.md` fresh

A committed index is only useful if it's current. Use one or more of these; most teams want the first two:

| Way | Set up | What happens |
|---|---|---|
| **CI** (the safety net) | run `tools/anaxi/tools/anaxi-ci.sh` in your pipeline | the build fails when the docs have errors or `INDEX.md` doesn't match them. Add `--base origin/main` to print only the nudges this PR introduced |
| **Pre-commit hook** (no failed builds) | `cp tools/anaxi/tools/hooks/pre-commit .git/hooks/` (or add it to your hook manager) | on any commit touching markdown, the index is regenerated and staged with the commit |
| **The agent** | nothing: the skill does it | after changing marks, the agent runs `anaxi-check index` (procedure 5 and 7 in the skill). If the scripts aren't there, it edits `INDEX.md` by hand and says so |

A GitHub Actions job, for example:

```yaml
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- run: tools/anaxi/tools/anaxi-ci.sh --base origin/${{ github.base_ref }}
```

If none of these is in place, don't commit `INDEX.md`: generate it when you need it (`anaxi-check index`), or
read `anaxi-check status`.

### 4.3 The reader (`anaxi watch`)

```bash
/anaxi:watch                                     # in Claude Code
node tools/anaxi/tools/anaxi-watch.mjs           # or from a terminal; --port N, --dir DIR
```

A local, read-only page at `http://127.0.0.1:4321/` that reloads when a doc is saved:

| Page | Shows |
|---|---|
| **overview** | every item grouped by what needs attention (blocked, go deeper, open, over-designed, later, enough), with what blocks it and who uses it; superseded, retired and deleted items |
| **topic** | a topic's items (`about:`, else the folder) and what they use outside it |
| **item** | three panes. **Left:** the doc files, with lines from this item's file to every file it's connected to (uses, used by, mentions, parts; red where it blocks); above 25 files only the connected ones, the rest one click away. **Middle:** the doc as written, read to a depth (D0–D4 buttons, keys `0`–`4`, `[` `]`); each deeper level is one line (`▸ D2 Shape · Proposed design · 99 words`) that unfolds in place, and so do the canvas and decision log; a level the claim or the target needs with nothing written shows as a red line; chips for everything it's connected to; parts inline at their level. **Below the files, a minimap:** the item's levels as a stack (filled where written, dashed line at the target; click a level to unfold up to it and jump there), what it uses on the left, what uses it on the right (meeting the stack at the level they need), mentions and replaced items below. **Right:** the nudges, and the build gate ("Ready to build?"), hidden until you press *show* (remembered in this browser). Items in the `shared` folder are marked 🔗 shared, or 🧱 foundation when they build on nothing (a stack, a platform), and the overview lists them after the features, by how many items use them. **Hovering** any name, chip, file or node previews that item (its why and what, depth bar, how it's connected) without leaving the page. Previous and next in `uses:` order |
| **map** | the 2D graph: what an item uses is to its left, a bar per item filled to its depth and dashed to its target, red where blocked, history below; above 12 items it opens on topics |

Links between docs open in the reader; a superseded page has a banner pointing at its successor.

### 4.4 A rendered document (`anaxi-render`, optional, not built yet)

For people who want one file to print or send (reading is the reader's job, §4.3):

| Selector | Roots |
|---|---|
| `@id` / `@a,@b` | one or several items |
| `--file 'docs/features/*.md'` · `--about data` · `--focus now` | items matching a file pattern, topic or focus |
| `--super` | every item |

From the roots it takes sub-items, then follows `uses:` references transitively (`--follow N` limits hops),
including each item **once**. `--at Dn` shows content up to level n, using the section mapping in
[FORMAT.md §4](FORMAT.md#4-what-level-a-piece-of-content-is-at). Sections it can't classify are always shown. The
canvas is included and labelled, unless `--no-canvas` is given.

Output order: status table → the roots, in document order, with badges → "depends on" (referenced items, each
before the items that use it) → open questions, caveats and later items → nudges. `@id` mentions become links
within the document, and each item links back to its source file. Formats: markdown (default), `--html` (one
self-contained page with a depth slider; the [Strata viewer](archive/strata-viewer.html) is a starting point),
`--json`.

## 5. Installing

### 5.1 The Claude Code plugin (recommended)

This repo is a Claude Code plugin and its own marketplace (`.claude-plugin/plugin.json`, `marketplace.json`).

```bash
claude plugin marketplace add atomek88/anaxi   # or a local path to a clone
claude plugin install anaxi@anaxi
```

Then, in any project, `/anaxi:init [--profile P] [--stage S] [--docs DIR]`. The plugin provides:

| Part | What |
|---|---|
| skill `anaxi` | the agent skill ([skills/anaxi/SKILL.md](skills/anaxi/SKILL.md)); Claude uses it on its own for marked docs |
| `/anaxi:status` | the status table |
| `/anaxi:assess <file or @id>` | checker nudges plus the skill's read of the content: what's missing, or "enough" |
| `/anaxi:gate @id` | ready to build or not, and why |
| `/anaxi:plan [@id …]` | a build plan for ready items, beside the design: the order, slices, test-first tasks and gate breakpoints, ticked as the code lands (`anaxi-check plan new` writes the skeleton). Claude also uses it on its own when asked to plan or break down work |
| `/anaxi:init` | `anaxi-init.sh --plugin`: settings, questions, `@stack`, the git hook; nothing vendored |
| `/anaxi:watch` | the reader (§4.3), in the background; prints its URL |
| MCP server `anaxi` | `anaxi_status`, `anaxi_nudges`, `anaxi_gate`, `anaxi_questions`, `anaxi_context`, `anaxi_outline`, `anaxi_uses`, `anaxi_related`, `anaxi_for_file`, `anaxi_index` for any agent in the session |
| hook: session start | in a project with `anaxi.json`, gives Claude the status table. Off: `"hooks": {"sessionStart": false}` |
| hook: the hard gate | on by default (`"hooks": {"gate": false}` to turn off): an edit to the planned `code:` of an item that isn't built and isn't ready is refused before it runs, with what's missing. Built items, design docs, unmapped files, and shared code a built item also maps are never blocked |
| hook: editing code | on by default (`"hooks": {"codeMap": false}` to turn off): the first time Claude edits a file that items list in `code:`, it's told which items, their depth and built state, and where their design and contract are. Never blocks |
| hook: after an edit | opt-in, `"hooks": {"afterEdit": true}`: after Claude edits a markdown doc, it sees that file's nudges. Never blocks |

The git pre-commit hook finds the checker at `$ANAXI_HOME`, then a vendored `tools/anaxi`, then the plugin
(its location is kept in `~/.anaxi/home`, refreshed each session). If none is found it skips, never blocking a
commit. CI has no plugin: set `ANAXI_HOME` to a checkout of this repo, or vendor it (§5.2).

**Updating.** Installed plugins are copies, pinned to `version` in `plugin.json`:

| You are | How updates reach you |
|---|---|
| **using** Anaxi | `claude plugin marketplace update anaxi && claude plugin update anaxi@anaxi`, then restart Claude Code |
| **developing** Anaxi | link the repo once: `ln -s ~/Professional/anaxi ~/.claude/skills/anaxi`. It loads as `anaxi@skills-dir`, straight from the working copy: every edit applies in the next session, no reinstall, no version bump. (Don't also install `anaxi@anaxi`, or there are two.) For one session only: `claude --plugin-dir ~/Professional/anaxi` |
| **releasing** | `tools/release.sh 0.9.0 [--push]`: needs a CHANGELOG entry; runs the self-test, the example's CI and plugin validation, sets the version, commits and tags `anaxi--v0.9.0` |

Project docs never need migrating: the plugin only reads them, and new marks and settings are always optional.

### 5.2 Vendored, without the plugin

```bash
path/to/anaxi/tools/anaxi-init.sh my-project --profile service --stage shaping
```

That vendors the method into `my-project/tools/anaxi/`, writes `docs/design/anaxi.json`,
`docs/design/anaxi-questions.md` and `docs/design/shared/stack.md` (everything in one folder, found from the repo root), links the skill into `.claude/skills/`, installs the pre-commit hook (in a git repo) and
builds the first index. It works on an existing project and never overwrites a file; `--docs DIR` points it at
where your docs already are (an `anaxi.json` already at the root is kept), `--no-vendor` uses `$ANAXI_HOME` instead of a copy. Add CI yourself (§4.2). A
vendored copy wins over the plugin for the git hook, so CI, the hook and Claude agree.

Upgrading means replacing the vendored folder (or bumping the submodule) and reading [CHANGELOG.md](CHANGELOG.md).
An npm package is on the [roadmap](ROADMAP.md).
