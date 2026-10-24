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
| **The reader** | `anaxi watch`: the docs as linked pages, read to a depth, with what each item is connected to | anyone reading the design |
| **The MCP server** | the engine as agent tools, `anaxi_context` above all | agents in any MCP client |

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
- [x] **The MCP server (step 4)** is in the same plugin, as a `.mcp.json` entry (0.9).

### 3. Seeing the design: `anaxi watch` · built in 0.9

`tools/anaxi-watch.mjs` (`/anaxi:watch`) serves a read-only reader and a 2D map from one model, reloading on save.
It edits nothing: writing still happens in your editor, or through an agent. What each page shows:
[TOOLING.md §4.3](TOOLING.md#43-the-reader-anaxi-watch).

**Built:**

- [x] **The reader as linked pages**, never one endless scroll: overview → topic → item, next and previous in
  `uses:` order. Marks become badges; `@id` and `[@id](path)` links open in the reader.
- [x] **Reading at a depth with few clicks:** D0–D4 buttons (keys `0`–`4`, `[` `]`); every deeper level is one
  line that unfolds in place; the canvas and decision log fold the same way; parts show inline at their level.
- [x] **What it's connected to, on the same page:** a file tree with lines to every connected file (uses, used
  by, mentions, parts; red where it blocks, only connected files above 25); a minimap of the item's levels with
  what it uses and what uses it as branches; chips; a hover preview of any item. `related` and `files` in the JSON.
- [x] **The claim against the text:** "claims D4 · shows D1"; empty levels shown as a red line (levels are cumulative,
  [METHOD.md §2](METHOD.md#2-the-ladder)).
- [x] **History:** superseded and retired items with a banner to their successor; deleted ids listed.
- [x] **Shared items marked** 🔗 shared or 🧱 foundation, and listed after the features.
- [x] **The build gate and nudges** beside each item; the gate hidden until asked for.
- [x] **The 2D map:** a depth bar per item, `uses:` as edges, red where blocked, topics first above 12 items.

**Decided by an exploration** on the example's real data ([docs/prototypes/viewer/](docs/prototypes/viewer/gedanken/contact.html)):
the reader plus a 2D map, not a picture first. The 3D layer stack was rejected (it hid an item already at 7
items, and 17 of 40 at 40, with no readable labels); the city is kept as a later idea (its labels collided at 7).

**Not built yet:**

- [ ] **Search** over titles, `@id`s, headings and text.
- [ ] **What changed** since a git ref (changed sections marked, new nudges listed), and a short per-item history
  from git (depth over time, last changed, by whom).
- [ ] **A static export** (`anaxi watch --export site/`) for people without the tool, or GitHub Pages.
- [ ] **Open in editor** per section (`vscode://` or a file link).
- [ ] **Images and mermaid** in the reader (vendored, loaded only by the page).
- [ ] **A two-hop minimap** (what the things it uses depend on), faded, for the "why is this blocked" chain.
- [ ] **Touch:** previews by long-press; today a tap opens the item.

**Letting it evolve:** the JSON is the contract (`anaxi/1`, versioned); views read only that and the raw files,
so new marks reach them through the checker. The example project is the fixture every view must render; the
self-test checks the JSON the reader relies on.

### 4. An MCP server: Anaxi as tools for agents · built in 0.9

Built: `tools/anaxi-mcp.mjs`, zero-dependency, started by the plugin (`.mcp.json`). `anaxi_context` follows a
superseded item to its successor unless `history` is asked for; the same call is `anaxi-check context @id --at Dn`.

The same engine, exposed so any agent can query the design instead of grepping it:

| Tool | Returns |
|---|---|
| `anaxi_status` | every item: depth, target, status |
| `anaxi_nudges(id)` | the structural nudges for an item |
| `anaxi_gate(id)` | ready or not, with the reasons |
| `anaxi_questions(id, level)` | the questions that apply at a level |
| `anaxi_uses(id)` | what it uses, and who uses it, transitively |
| `anaxi_context(id, at)` | the item at the depth asked for, plus the contracts of everything it `uses:`, each once: exactly what an agent needs before building, and no more |

`anaxi_context` is the important one. It turns "read the design docs" into one bounded, depth-aware call, and
it could run in the same process as `anaxi watch`.

- [ ] **`anaxi_related(id)`**: the reader's `related` list (uses, used by, mentions, supersedes) for agents, so an
  agent sees what else a change touches without reading every doc.

### 5. References and attribution

So a reader (or an agent) can see where a design came from and check it against the source:

- **`refs:`** on an item or section: tickets, Figma frames, ADRs, PRs, dashboards, data sources, a prototype's
  evidence pack. The checker verifies what it can (a local path exists, a URL is well formed) and lists them in
  `INDEX.md`, the viewer and `anaxi_context`.
- **`owner:`**, optional: who to ask. Not a sign-off.
- **Last changed, and by whom**, from git per item, which is also what N11 (recheck after a shared item changes)
  needs.

### 6. Superseding and archiving design knowledge · built in 0.9

Built as below in 0.9, including `anaxi_context` following a successor (step 4) and the reader's banner (step 3).
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

### 7. Follow-ups from 0.9

- [ ] **Release 0.9.0:** date the CHANGELOG entry, then `tools/release.sh 0.9.0 --push` (needs the GitHub remote,
  step 2).
- [ ] **Item roles beyond the folder.** Today an item is shared only because it lives in the `shared` folder, and
  a foundation only because it uses nothing. Pilots may want an explicit `role:` mark (feature, shared,
  foundation), and role-aware questions: a stack's D1 is "what it applies to", not user behaviour. The levels
  stay the same; the questions per role come from the project's `anaxi-questions.md` (`when: role:foundation`).
- [ ] **Calibrate the gap check** (`nudges.levelWords`, default 10) on pilot docs: how often a level with a few
  real words is flagged, and whether N22 (content past the claim) helps or is noise.
- [ ] **Explicit `related:`**, only if pilots find mentions too noisy or too sparse; mentions in the text are the
  related links today.
- [ ] **A browser check in CI** for the reader: open the example, unfold a level, hover a chip, follow a link
  (Playwright), alongside the self-test.

### 8. Smaller things

- `anaxi render` to a single file, for people who want one to attach; the reader's super-TDD covers reading
  ([TOOLING.md §4.4](TOOLING.md#44-a-rendered-document-anaxi-render-optional-not-built-yet)).
- N11, recheck after a shared item changes, from git history.
- Folder-level `anaxi.json` for monorepos.
- Editor support: badges, hovers and diagnostics through a small language server.
- Import from Confluence or Notion, for teams whose design docs live there.

## Deciding what's next

After the pilot, ask:

- Did people use the CLI, the reader, or only the agent? Put the next effort where they were.
- Did anyone open `anaxi watch` more than once? If yes, search and "what changed" next (step 3); if not, why.
- Did reviewers ask "where did this come from?" If yes, `refs:` (step 5).
- Did a design change after something was built from it? Then superseding (step 6), before more docs pile up.
- Is a second team asking to use it? Then package it (step 1) before anything else.
