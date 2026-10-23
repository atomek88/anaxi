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

**What it must answer, at a glance:** what's ready to build, what's blocked and by what, what's still a gap,
and what's over-designed. Everything else is secondary.

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
zoomable overview, both driven by the same JSON and the same depth slider. The prototype decides.

**Needed from the checker first:** `anaxi-check context @id --at D2` (an item's text up to a level, plus the
contracts of what it uses: the same thing the MCP server's `anaxi_context` returns), and a stable section id in
the JSON so a view can link to and open a section.

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

### 6. Smaller things

- `anaxi render`: one combined document for people who want a single file ([TOOLING.md §4.3](TOOLING.md#43-a-rendered-document-anaxi-render-optional-not-built-yet)).
- N11, recheck after a shared item changes, from git history.
- Folder-level `anaxi.json` for monorepos.
- Editor support: badges, hovers and diagnostics through a small language server.
- Import from Confluence or Notion, for teams whose design docs live there.

## Deciding what's next

After the pilot, ask:

- Did people use the CLI, or only the agent? If only the agent, build the MCP server before the viewer.
- Did anyone want to *see* the whole design? If yes, `anaxi watch` and the map (step 3).
- Did reviewers ask "where did this come from?" If yes, `refs:` (step 5).
- Is a second team asking to use it? Then package it (step 1) before anything else.
