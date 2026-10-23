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

```
   markdown docs (the source of truth)
        │  read by
        ├──► anaxi-check ──► status · nudges · gate · INDEX.md      (structural, deterministic)
        └──► agent + skill ──► assess · deepen · write questions      (semantic; calls anaxi-check)
```

It's installed by copying the method into the repo (`tools/anaxi-init.sh`). That's fine for a pilot. It isn't
fine for twenty repos, and it means the agent skill exists only in repos that ran the install. The plugin (step 2)
fixes both.

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

### 2. A Claude Code plugin

One install that gives every session the same Anaxi: the skills, the scripts, commands and hooks. Planned in
detail because it's the next thing to build; it can come before the npm package, since a plugin carries its own
copy of the scripts.

**What's in it**

| Part | What | Notes |
|---|---|---|
| skills | `anaxi` | `gedanken`, `prototype` and `prototype-harvest` stay separate global skills while they're refined. They call `anaxi-check` when it's there, so with the plugin installed their Anaxi steps work in every repo |
| scripts | `tools/` and the method docs, run from the plugin's folder (`${CLAUDE_PLUGIN_ROOT}`) | projects stop vendoring `tools/anaxi` |
| commands | `/anaxi status`, `/anaxi assess @id`, `/anaxi gate @id`, `/anaxi init` | `init` writes only `anaxi.json`, `anaxi-questions.md`, the `@stack` seed and the git hook |
| hook: session start | if the repo has a `anaxi.json`, print the status table (a few lines) | silent everywhere else |
| hook: after an edit | when Claude edits a markdown doc, run `nudges` for the items in that file and show them | ~0.1 s per run; never blocks the edit |
| hook: before commit | unchanged: the git pre-commit hook keeps `INDEX.md` fresh | a git hook, not a Claude hook, so it also runs for people |
| MCP server | later: step 4 adds a `.mcp.json` entry, same plugin | |

**Layout:** the plugin is this repo itself, plus `.claude-plugin/plugin.json`, `commands/` and
`hooks/hooks.json`. No second copy of anything. A `.claude-plugin/marketplace.json` in the same repo lists it for installing.

**Two ways to load it**

| Mode | How | When Anaxi changes |
|---|---|---|
| **Developing Anaxi** (you, now) | link the folder as a skills-dir plugin: `ln -s ~/Professional/anaxi ~/.claude/skills/anaxi` (loads as `anaxi@skills-dir`), or `claude --plugin-dir ~/Professional/anaxi` for one session | live: edits apply in the next session, no reinstall |
| **Using Anaxi** (a team) | `claude plugin marketplace add <repo>`, then `claude plugin install anaxi@<marketplace>` | installed copies are cached by version: bump `version` in `plugin.json`, then `claude plugin update anaxi` and restart. Unchanged version, no update |

**Keeping versions straight as it evolves**

- **The docs never need migrating.** Markdown is the source of truth, and the plugin only reads it. A plugin
  update changes the checker, never the files. Mark changes go in the changelog and `check` warns about old forms
  for a release before they stop working.
- **Projects can pin.** `anaxi.json` gets an optional `"requires": ">=0.8"`; the checker warns when the plugin
  is older or newer by a major version.
- **A vendored copy still wins.** If a repo has `tools/anaxi`, the hooks and commands use it, so CI, the git
  hook and Claude agree. Remove it to follow the plugin.
- **One skill per name.** When the plugin is installed, remove any project `.claude/skills/anaxi` link, or there are two.
- **JSON output is versioned** (`anaxi/1`). Anything built on it (the viewer, the MCP server, CI) checks the
  version.

**How later steps fit**

- **`anaxi watch` (step 3)** is a long-running process, so it isn't a hook: `/anaxi watch` starts it in the
  background and prints the URL. It lives in the same plugin and uses the same engine, so an update brings it
  along.
- **The MCP server (step 4)** is declared in the plugin's `.mcp.json`. Claude Code starts it per session, so an
  update and a restart are enough. `anaxi watch` and the MCP server can share one process later.
- **Questions, levels and rubric stay per project** (`anaxi.json`, `anaxi-questions.md`). The plugin ships only
  defaults, so a project's choices survive every update.

**Open before building:** whether the after-edit hook is on by default or opt-in per project.

**Decided:** `gedanken`, `prototype` and `prototype-harvest` are not in the plugin; they stay separate skills while
they're refined, and may become their own plugin later.

### 3. `anaxi watch`: a live local viewer

A small local server that watches the docs, re-evaluates on every save, and serves a read-only page:

- the index, live, with filters (focus, topic, status);
- a dependency graph of `uses:`, coloured by status, so blocked chains are obvious;
- any item read "at a depth": a slider showing D0 only, up to D1, and so on (the archived
  [Strata viewer](archive/strata-viewer.html) is a starting point);
- the nudges for whatever file you just saved.

It edits nothing. Writing still happens in your editor, and an agent writes through files as now.

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

### 5. Smaller things

- `anaxi render`: one combined document for people who want a single file ([TOOLING.md §4.3](TOOLING.md#43-a-rendered-document-anaxi-render-optional-not-built-yet)).
- N11, recheck after a shared item changes, from git history.
- Folder-level `anaxi.json` for monorepos.
- Editor support: badges, hovers and diagnostics through a small language server.
- Import from Confluence or Notion, for teams whose design docs live there.

## Deciding what's next

After the pilot, ask:

- Did people use the CLI, or only the agent? If only the agent, build the MCP server before the viewer.
- Did anyone want to *see* the whole design? If yes, `anaxi watch`.
- Is a second team asking to use it? Then package it (step 1) before anything else.
