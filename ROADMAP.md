# Anaxi roadmap

Where Anaxi could go after the pilot. Nothing here is committed; the pilot decides the order. Today's state is
in [TOOLING.md](TOOLING.md).

## What Anaxi is today

Three parts, all working without the others:

| Part | What it is | Who uses it |
|---|---|---|
| **The convention** | marks in ordinary markdown: front matter, tag lines, badges ([FORMAT.md](FORMAT.md)) plus the method docs | people writing and reviewing TDDs |
| **The checker** | `anaxi-check` and `anaxi-ci`: zero-dependency Node scripts that read the marks and compute targets, nudges, gates and `INDEX.md` | CI, pre-commit hooks, people at the terminal |
| **The skill** | instructions that teach an agent the method, including the checks that need reading (N05, N07, N08…) | Claude Code and other agents |
| **The plugin** | the skill, the checker, `/anaxi:*` commands and hooks in one Claude Code install | Claude Code users |

```
   markdown docs (the source of truth)
        │  read by
        ├──► anaxi-check ──► status · nudges · gate · INDEX.md      (structural, deterministic)
        └──► agent + skill ──► assess · deepen · write questions      (semantic; calls anaxi-check)
```

With Claude Code it installs once per machine as a plugin (step 2), and `/anaxi:init` sets up a project without
copying anything into it. Without Claude Code, `tools/anaxi-init.sh` copies the method into the repo.

## Rules for everything below

- **Markdown stays the source of truth.** Tools read the docs; they never hold state the docs don't.
- **Everything works without the newer layers.** A team can stop at the convention, or at the checker.
- **One engine.** `tools/lib/` is the only place rules live; the CLI, CI, watcher, viewer and MCP server all
  call it, so they can't disagree.

## Next steps, roughly in order

### 1. A package instead of a copied folder

- **npm package** (`npx anaxi init | check | index | gate`). The scripts have no dependencies, so this is
  mostly a `package.json` and a `bin` entry. Projects pin a version (`devDependencies`) instead of vendoring;
  upgrading is a version bump plus the changelog.
- **For non-JS repos:** `npx` still works where Node is installed. Otherwise, a single-file binary (Node SEA or
  `bun build --compile`).
- **Name:** `anaxi`, free on npm (checked 2026-10-21); the command is `anaxi`.
- [ ] **To do: reserve `anaxi` on npm** with a placeholder 0.0.x package, before someone else takes it. Needs an
  npm login and a go-ahead, since it publishes to the public registry.

### 2. A Claude Code plugin · built in 0.8

This repo is the plugin and its own marketplace. One install per machine gives every session the skill, the
checker, `/anaxi:status`, `/anaxi:assess`, `/anaxi:gate`, `/anaxi:init`, a session-start hook (the status
table) and an opt-in after-edit hook (the nudges for the doc Claude just edited). Install, update, develop and
release: [TOOLING.md §5](TOOLING.md#5-installing).

Decided along the way:

- **`gedanken`, `prototype` and `prototype-harvest` are not in it.** They stay separate skills while they're
  refined, and may become their own plugin later. They call `anaxi-check` when it's there.
- **The after-edit hook is opt-in** per project (`"hooks": {"afterEdit": true}`), until a pilot shows it helps
  more than it distracts.
- **Developing is live:** `~/.claude/skills/anaxi` links to the working copy, so edits apply next session.
  Users get a release (`tools/release.sh`) with `claude plugin update`.

Still to do:

- **Pin a version per project:** an optional `"requires": ">=0.8"` in `anaxi.json`; the checker warns when the
  plugin is a major version off.
- **Publish the repo** (GitHub) so `claude plugin marketplace add <owner>/anaxi` works for a team.
- **The MCP server (step 4)** goes in the same plugin as a `.mcp.json` entry.

### 3. Seeing the design: `anaxi watch` and a zoomable map

A small local server that watches the docs, re-evaluates on every save, and serves a read-only page. Started
from Claude Code with `/anaxi:watch` (it prints the URL), or from a terminal. It edits nothing: writing still
happens in your editor, and an agent writes through files as now.

It has two halves over one model: **the reader**, which shows the documentation itself, and **the map**, which
shows where you are in it. The reader comes first: it's useful every day, and the map is a way into it.

#### 3.1 The reader: the docs themselves

A markdown reader for the project's actual design docs, kept in step with them on every save. Why not GitHub's
or the editor's preview: they show raw front matter and tag lines, can't hide what's deeper than you asked for,
don't follow `@id` links or show who uses an item, and have no idea what's blocked.

| It shows | How |
|---|---|
| **the doc as written** | GitHub-flavoured markdown: headings, tables, code, images, mermaid diagrams. Marks become badges (depth, target, status icon, `🎯`) instead of raw YAML |
| **an item at a depth** | a depth control per item, and one for the page: "up to D2" hides sections at D3 and deeper (sections already carry levels). The canvas shows or hides with one toggle; it's always labelled |
| **an item and its parts** | a part (`part-of:`, e.g. in `APPENDIX.md`) shows inline under its host's matching level, or collapsed with a link, never as a separate item |
| **links that work** | `@id` and `[@id](path)` open in the reader; each item lists what it uses and what uses it (backlinks); a breadcrumb project → topic → item → level |
| **the whole design, paged** | a project, epic or topic as linked pages, never one endless scroll: an overview page (status table and map), one page per item with its levels as sections and an outline beside it, next and previous in `uses:` order, at the chosen depth. One continuous document only for print or export (`anaxi render`) |
| **what to do** | the item's nudges beside it, and the gate: ready, or what blocks it |
| **what changed** | since a git ref (`--diff`): changed sections marked, new nudges listed. Per item, a short history from git: depth over time, last changed, by whom |
| **what's no longer true** | superseded and retired items and sections (step 6) shown greyed with a banner pointing to what replaced them; hidden by default from the super-TDD |

Read-only: each section has "open in editor" (a `vscode://` or file link), and writing still happens in files.
Search covers titles, `@id`s, headings and text. The same renderer can write a **static site**
(`anaxi watch --export site/`) for sharing or GitHub Pages, so people without the tool can read it.

Building it: the checker stays dependency-free. The reader is one page that may vendor a single markdown renderer
(e.g. markdown-it) and mermaid, loaded only by the viewer. The server is plain Node (`http`, `fs.watch`), and
the page gets the model as JSON plus each file's raw markdown, so one engine decides depth everywhere.

#### 3.2 The map: where you are

**What it must answer, at a glance:** what's ready to build, what's blocked and by what, what's still a gap,
and what's over-designed. Everything else is secondary. Clicking anything on the map opens it in the reader at
that depth.

**The one idea behind every view: zoom is depth.** Zooming out shows less depth; zooming in reads deeper, down to
the text of one level of one item. The data is already in `anaxi-check status --json`: each item's depth and
target, its status, `uses:` links, parts, `about:` topics and every section's level.

| Zoom | You see | Opens |
|---|---|---|
| the project | every item, its depth against its target, the `uses:` links | |
| a topic, epic or folder | its items and what they depend on outside it | |
| an item | its levels stacked D0 up to its depth, faint up to its target; its parts beside it | the item's nudges |
| a level of an item | the sections at that level, the open questions for it | the text, as written |

**Candidate pictures** (compare them on the example project's real data before choosing one):

| Picture | How depth shows | Good at | Risk |
|---|---|---|---|
| **2D graph with depth bars** | each item a node with a D0–D4 bar, filled to its depth, outlined to its target; edges are `uses:` | blocked chains, fast reading, works on any screen | flat; "how much is designed" reads less physically |
| **3D layer stack** | D0–D4 are stacked planes; each item a column rising to its depth, ghosted to its target; `uses:` edges between columns; a slider cuts the stack at a level ("the project as designed to D2") | seeing the whole design's depth at once | 3D is slower to read and harder to click; needs WebGL |
| **City** | items are buildings: floors are levels (D0 foundation … D4 finishing), built floors solid, target floors scaffolding; districts are topics or folders; roads are `uses:` links, red where blocked; a 🎯 flag on the roof when enough; floors above the target marked for trimming | a metaphor people get instantly; zooming city → district → building → floor → room maps exactly onto project → topic → item → level → section | the metaphor can mislead (tall isn't better); cost of building it |
| **House, for one feature** | the same metaphor for one TDD: D0 foundation (why), D1 floor plan (what), D2 frame (shape), D3 utilities and connections to the neighbours (contracts), D4 fit-out (build steps) | reviewing one TDD with its team | doesn't scale to a project |

The likely answer is two views over one model: a 2D graph for daily use, and the city (or the 3D stack) as the
zoomable overview, both driven by the same JSON and the same depth slider as the reader. A throwaway prototype on
the example project's real data decides, before any of it is built.

#### 3.3 Letting it evolve

- **The JSON is the contract** (`anaxi/1`, versioned). The reader and the map read only that and the raw
  files, so new marks reach them through the checker, not through viewer code.
- **Views are plugins of the page, not forks:** a new picture (another metaphor, a timeline) is one more view
  over the same model and the same depth control.
- **The example project is the test fixture:** every view must render it, including a superseded item and a
  part, and the self-test checks the JSON it relies on.

**Needed from the checker first:** `anaxi-check context @id --at D2` (an item's text up to a level, plus the
contracts of what it uses: the same thing the MCP server's `anaxi_context` returns); a stable section id and
line range in the JSON, so a view can open, hide or link to a section; and the lifecycle fields (step 6).

### 4. An MCP server: Anaxi as tools for agents

The same engine, exposed so any agent can query the design instead of grepping it:

| Tool | Returns |
|---|---|
| `anaxi_status` | every item: depth, target, status |
| `anaxi_nudges(id)` | the structural nudges for an item |
| `anaxi_gate(id)` | ready or not, with the reasons |
| `anaxi_questions(id, level)` | the questions that apply at a level |
| `anaxi_context(id, at)` | the item at the depth asked for, plus the contracts of everything it `uses:`, each once: exactly what an agent needs before building, and no more |

`anaxi_context` is the important one. It turns "read the design docs" into one bounded, depth-aware call, and
it could run in the same process as `anaxi watch`.

### 5. References and attribution

So a reader (or an agent) can see where a design came from and check it against the source:

- **`refs:`** on an item or section: tickets, Figma frames, ADRs, PRs, dashboards, data sources, a prototype's
  evidence pack. The checker verifies what it can (a local path exists, a URL is well formed) and lists them in
  `INDEX.md`, the viewer and `anaxi_context`.
- **`owner:`**, optional: who to ask. Not a sign-off.
- **Last changed, and by whom**, from git per item, which is also what N11 (recheck after a shared item changes)
  needs.

### 6. Superseding and archiving design knowledge · built in 0.9

Built as below, except `anaxi_context` (step 4) and the reader's banner (step 3), which come with those steps.
Marks and commands: [FORMAT.md §10](FORMAT.md#10-superseded-retired-archived).

Designs get replaced, and the old reasoning is still worth having, but a stale doc that reads as current is worse
than no doc: agents read everything and can't tell. So what replaced what is marked, checked and shown, not
left to folder names.

**Four states, each a mark, never a deletion first:**

| State | Mark | What happens |
|---|---|---|
| **current** | (none) | counted, nudged, gated as now |
| **superseded** | `superseded-by: @new (why)` on the old item; the new one says `supersedes: @old` | stays where it is, so links still work. Leaves the status table, targets and gates; listed in `INDEX.md` under "Superseded and retired" with its successor. The reader shows it greyed with a banner |
| **retired** | `retired: 2026-11-02 (why)`: dropped with no successor (a feature cut, a spike that answered its question) | same as superseded, with no successor |
| **archived** | the file moves to `docs/archive/` (`anaxi-check archive @id` moves it and rewrites links to it) | still read for references, never for status. After that, deleting it is safe: git keeps it, and `docs/archive/RETIRED.md` keeps one line per removed `@id` (date, why, successor, last commit) so the id is never silently reused |

**The same works inside a living TDD.** A replaced decision or section gets the same mark on its heading or tag
line (`> superseded-by: @new` or a `superseded` badge) and drops out of the item's depth, or moves to a
`## Decision log` section, which counts like the canvas: kept, labelled, never counted.

**What the checker adds:** a nudge when a current item `uses:` a superseded or retired one (point it at the
successor); when only one side says `supersedes`/`superseded-by`; when a superseded item still has open
questions (move them to the successor or close them); and when an archived `@id` is reused. `anaxi_context` and
the skill follow the chain to the successor and never hand superseded content to an agent unless asked for history.

**When to supersede rather than edit:** edit while the item is being designed. Supersede once something was
built from it, or once other items depend on it and the change isn't compatible: the old version then explains
what exists in the code.

**The method dogfoods it.** Anaxi's own knowledge follows the same rules: changes are a line in
[CHANGELOG.md](CHANGELOG.md); questions move through Proposed, Challenged and Retired
([QUESTIONS.md §7](QUESTIONS.md#7-proposed-challenged-retired)); a method doc that's replaced moves to `archive/`
with a header saying why it's kept and what replaced it, and is deleted (git keeps it) once nothing in it is
still used, as the Strata files were in 0.8.

### 7. Smaller things

- `anaxi render` to a single file, for people who want one to attach; the reader's super-TDD covers reading
  ([TOOLING.md §4.3](TOOLING.md#43-a-rendered-document-anaxi-render-optional-not-built-yet)).
- N11, recheck after a shared item changes, from git history.
- Folder-level `anaxi.json` for monorepos.
- Editor support: badges, hovers and diagnostics through a small language server.
- Import from Confluence or Notion, for teams whose design docs live there.

## Deciding what's next

After the pilot, ask:

- Did people use the CLI, or only the agent? If only the agent, build the MCP server before the viewer.
- Did anyone want to *see* the whole design? If yes, `anaxi watch` and the map (step 3).
- Did reviewers ask "where did this come from?" If yes, `refs:` (step 5).
- Did a design change after something was built from it? Then superseding (step 6), before more docs pile up.
- Is a second team asking to use it? Then package it (step 1) before anything else.
