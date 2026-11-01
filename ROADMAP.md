# Anaxi roadmap

Where Anaxi could go after the pilot. Nothing here is committed; the pilot decides the order. Today's state is
in [TOOLING.md](TOOLING.md).

## What Anaxi is today

Its parts, each working without the newer ones:

| Part | What it is | Who uses it |
|---|---|---|
| **The convention** | marks in ordinary markdown: front matter, tag lines, badges ([FORMAT.md](FORMAT.md)) plus the method docs | people writing and reviewing TDDs |
| **The checker** | `anaxi-check` and `anaxi-ci`: zero-dependency Node scripts that read the marks and compute targets, nudges, gates and `INDEX.md` | CI, pre-commit hooks, people at the terminal |
| **The skill** | instructions that teach an agent the method, including the checks that need reading (N05, N07, N08…) | Claude Code and other agents |
| **The plugin** | the skill, the checker, `/anaxi:*` commands and hooks in one Claude Code install | Claude Code users |
| **The reader** | `anaxi watch`: the docs as linked pages, read to a depth, with what each item is connected to | anyone reading the design |
| **The MCP server** | the engine as agent tools, `anaxi_context` above all | agents in any MCP client |
| **The hard gate** | a hook that refuses to write an item's planned code until the item is designed enough | agents in Claude Code, even when told "just build it" |

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

## Left now · as of 0.10.0 (2026-10-31)

0.10.0 is released and published at github.com/atomek88/anaxi; Anaxi's own design is 🎯 throughout, with no drift.
Two things remain before anything below:

- [ ] **Reserve `anaxi` on npm** with a placeholder 0.0.x package (step 1). Needs the owner's npm login.
- [ ] **The pilot on a real project** ([PILOT.md](PILOT.md)): `/anaxi:init`, design one or two features through it,
  and watch whether the gate holds, gaps surface onto items, and the docs stay current while it's built. The pilot
  decides the order of everything below, starting with §9 and the roles in §7.4.

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
- [x] **Publish the repo** (2026-10-31): github.com/atomek88/anaxi, so `claude plugin marketplace add atomek88/anaxi`
  works for a team.
- [x] **The MCP server (step 4)** is in the same plugin, as an `mcpServers` entry in `plugin.json` (0.9; a root `.mcp.json` also loaded as a broken project server inside this repo).

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

Built: `tools/anaxi-mcp.mjs`, zero-dependency, started by the plugin (`mcpServers` in `plugin.json`). `anaxi_context` follows a
superseded item to its successor unless `history` is asked for; the same call is `anaxi-check context @id --at Dn`.

The same engine, exposed so any agent can query the design instead of grepping it:

| Tool | Returns |
|---|---|
| `anaxi_status` | every item: depth, target, status |
| `anaxi_nudges(id)` | the structural nudges for an item |
| `anaxi_gate(id)` | ready or not, with the reasons |
| `anaxi_questions(id, level)` | the questions that apply at a level |
| `anaxi_uses(id)` | what it uses, and who uses it, transitively |
| `anaxi_index(check?)` | regenerate the index, so agents never edit it by hand |
| `anaxi_context(id, at)` | the item at the depth asked for, plus the contracts of everything it `uses:`, each once: exactly what an agent needs before building, and no more |

`anaxi_context` is the important one. It turns "read the design docs" into one bounded, depth-aware call, and
it could run in the same process as `anaxi watch`.

- [x] **`anaxi_related(id)`** (built 2026-10-30, through @related): the reader's `related` list (uses, used by, mentions, supersedes) for agents, so an
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

- [x] **Release 0.9.0** (2026-10-25), tag pushed with 0.10.0 (2026-10-31).
- [ ] **Item roles beyond the folder**: see §7.4.
- [ ] **Calibrate the gap check** (`nudges.levelWords`, default 10) on pilot docs: how often a level with a few
  real words is flagged, and whether N22 (content past the claim) helps or is noise.
- [ ] **Explicit `related:`**, only if pilots find mentions too noisy or too sparse; mentions in the text are the
  related links today.
- [ ] **A browser check in CI** for the reader: open the example, unfold a level, hover a chip, follow a link
  (Playwright), alongside the self-test.

### 7.4 Roles: how an item's role is said, and how it changes the questions · open (@method)

Today a role is inferred: an item in the `shared` folder is shared, a shared item that uses nothing is a
foundation, everything else is a feature. Roles already change one thing (a shared item is judged by its contracts
first), but every item is asked the same questions, so a stack or a design system gets "what does the user do,
step by step" at D1. To evolve, with the pilot's docs as the evidence:

- [ ] **Which roles exist.** Start from the three, and collect what pilots actually write: feature, shared (an API,
  a service others call), foundation (stack, infrastructure, a design system, conventions), and candidates seen
  in practice, such as integration (a third party), data (a schema or pipeline), policy (a rule others follow),
  or, outside software, deliverable and process. Keep the list a project default, renamable like levels.
- [ ] **How a role is said.** An optional `role:` mark on an item (front matter or tag line), overriding the
  folder; the folder stays the default, so nobody has to write it. Open: whether a sub-item inherits its parent's
  role, and whether one item can have two (a feature that is also shared). The checker reports where the mark and
  the folder disagree.
- [ ] **How a role changes the questions.** The levels stay the same; what changes is the questions asked at each
  one, by the selectors that already exist in `anaxi-questions.md` (`when: role:foundation`). A first draft per
  role, written as a table in METHOD.md and tried on the pilot: a foundation's D1 is "what it applies to and what
  it rules out"; its D2 the choices and why; its D3 the version and upgrade policy. A shared item's D1 is who
  calls it and what they rely on; its D3 the contract and its versioning. A feature keeps today's questions.
- [ ] **How a role changes the target and the gate.** Whether the rubric weighs roles (a foundation that many items
  use needs depth before they do), and whether a feature's gate checks that its foundations are written down
  at all, not only its uses.
- [ ] **Evidence before rules.** For each pilot item, note which default questions felt wrong for its kind, and
  which questions people added; a role and its questions join the defaults only when two projects ask for
  them. Until then, `when: role:` in a project's own questions is the way to try one.

### 7.1 Dogfooding: Anaxi documents itself · started 2026-10-25

`docs/design/` holds one item per part of the tool; the reference docs are listed on the items as `parts:`, so
nothing is written twice and nothing outside the folder carries a mark. `node tools/anaxi-check.mjs status` and `/anaxi:watch` at the repo root read it.
It found three bugs on its first run, all fixed and self-tested: lead-ins quoted in inline code counted as levels,
`<!-- D3 -->` comments were ignored when measuring, and titles lost their inline code.

- [x] **Agents stop at a blocked gate**, measured headless: 3 of 3 called `anaxi_gate` and `anaxi_context` unprompted;
  the blocked ones built nothing. One wrote the missing contracts itself, so the skill now has proposals go on the open
  question, unchecked. Agents without a shell hand-edited `INDEX.md`, so MCP gained `anaxi_index`.
- [x] **An unmeasured claim gets full credit** (fixed 2026-10-30: it now shows nothing until marked, N05). A doc with no levelled text, tagged `depth: D4`, shows plain D4. Show
  it as unmeasured ("D4 ?") in status, the index and the reader, without a nudge, so a claim never looks verified.
- [ ] **Keep the design current:** a change to the tool changes its item in the same commit; the index is checked by
  `anaxi-ci.sh` at the root like any project.
- [x] **@related** went through Anaxi before it was built: D1, two open questions with an agent's proposals, decided
  by the user, D2 written, gate ready, built (2026-10-30).

### 7.2 Living docs while a project is built · decided 2026-10-30

- [x] **One design folder.** `anaxi.json` lives in the design folder and is found from the repo root; parts are listed
  from the item's side, so specs and code carry no marks; `/anaxi:init` writes `docs/design/`.
- [x] **What's built.** `built: no | partly | yes (date)` on items and sub-items, `code:` paths, the roll-up, and drift
  from git (N23), built ahead of its design (N24), a missing code path (N25).
- [x] **Outline with anchors** (`anaxi_outline`, `outline`, the reader's Outline).
- [ ] **A summary line per item in `INDEX.md` and `anaxi_status`**: the first Why/What sentence, so many questions are
  answered from the index without opening an item. Proposed.
- [x] **Code → design lookup** (built 2026-10-30, @code-map): `code:` paths, folders and globs are the map;
  `anaxi_for_file`, `anaxi-check file`, and a hook the first time Claude edits a mapped file.
- [ ] **Map coverage**: list the code files no item covers (`anaxi-check file --unmapped`), so a project sees what
  its design doesn't describe yet. Proposed.
- [ ] **What changed since**: from git, which items' depth, decisions or contracts changed since a date or a commit,
  so a returning reader reads only the difference. Proposed.
- [ ] **Per-section drift** with `git log -L`, if file-level drift is noisy in docs that hold several items.

### 7.3 The hard gate · built 2026-10-31

- [x] **The gate holds against "just build it".** A PreToolUse hook refuses writes to an unbuilt, unready item's planned
  `code:`; it can't be lifted from inside a session; tool results lead with "NOT READY". Four headless runs: advice
  alone was ignored, the first hook was switched off by the agent, the final one held and the agent stopped
  (@hard-gate has the evidence).
- [x] **The blocked run found four real design gaps** in the example while drafting (no withdraw in @task-api, no
  token for the daily job, a `409` on a series edit, acceptance against the 7-day horizon), fixed in the example.
  Gaps surfacing is a main benefit, which is what §9 builds on.
- [ ] **Shell writes** (`echo >`, `node -e`) into a held path aren't seen. A PostToolUse check on Bash that compares
  `git status` before and after, and reports (or reverts) new files under held paths.
- [ ] **Unmapped code** isn't guarded; map coverage (§7.2) shows how much of a project that is.

### 9. The hub: a living design that improves itself while the project is built · proposed 2026-10-31

The aim: the design folder is where every person and agent on a project, technical or not, starts, finds context
fast, and leaves the design better than they found it. The parts so far (depth, gate, built, drift, code map,
outline, related) are the steps of one cycle; what's missing is mostly the arrows between them.

```
   decide ──► design to target ──► gate ──► build ──► mark built ──► drift
     ▲                                        │                       │
     └──── questions and proposals ◄──── gaps found while building ◄──┘
                     │
                     └──► the project's question list grows (the next item is asked them up front)
```

**Close the loop from building back to design.**
- [ ] **Gaps found while building go on the item, not in the chat.** The run-4 gaps were only in a terminal reply.
  The skill writes each one as an unchecked question on the item it belongs to, with a proposal and where it came
  from (`found: build 2026-10-31`); a gap in a used item (@task-api) goes on that item and lowers its depth
  until answered. An MCP tool (`anaxi_propose @id "question" "proposal"`) does it without hand-editing markdown,
  for agents with no file access.
- [ ] **Questions that caught a gap become the project's questions.** "Does a server job have credentials to call
  this?" and "Can queued work be withdrawn?" go into `anaxi-questions.md` at the level where they'd have been
  asked, so the next item gets them up front. A count of gaps found by building versus by design review shows
  whether the method is working on this project.
- [ ] **Retro on built.** When an item goes `built: yes`, one prompt: what did building teach that the design
  missed? The answer lands in its decision log, and if many gaps came from one kind of item, a nudge suggests a
  higher target for similar items (the rubric calibrating itself per project).
- [ ] **Acceptance tied to evidence.** `checks:` on an item links its acceptance criteria to tests or demos; N26
  for a criterion with nothing behind it, so `built: yes` means shown, not claimed.

**Make the hub the first stop, for people and agents.**
- [ ] **A "where we are" page**, generated like `INDEX.md`: current focus, what's blocked and on what, decisions
  waiting for a person, what changed since last week, what's built. The session-start hook shows its top lines,
  so every session (and every new team member) starts from it.
- [ ] **A decisions inbox.** Every open question with a proposal on it, in one list: `anaxi-check decisions`, a
  reader page, and `anaxi_decisions`. Answering is checking the box and keeping or editing the proposal, so a
  product owner or a client can unblock the build without reading code.
- [ ] **A summary line per item** (§7.2) and **what changed since** (§7.2): together they let a returning reader,
  or an agent with a small context, read the difference and nothing else.
- [ ] **Search in the reader**, and `anaxi_search` for agents: across items, at a depth, returning anchors from the
  outline, so an answer comes with the link to follow and nothing more.
- [ ] **Links outward** (step 5, `refs:` and `owner:`), and the commits touching an item's `code:` in
  `anaxi_context`, so the hub points to tickets, PRs and people instead of copying them.

**Beyond software.**
- [ ] **Non-technical projects.** `code:` generalizes to the item's outputs: any paths or links where the work
  lands (a report draft, a campaign folder, a policy page). Built, drift, the code map and the gate then work for
  research, operations, content or policy projects as they do for code. A profile for each, with level names
  and questions in that field's words (levels are already renamable in `anaxi.json`), and an example project
  that isn't software, to test it on.
- [ ] **Several people and agents at once.** `owner:` on an item, and a short-lived claim (`working: @who since`)
  that the reader and `anaxi_status` show, so two agents don't design or build the same item in parallel.

**Keep the cycle honest.**
- [ ] **Agent behaviour as a test suite.** The headless runs in this repo (build a ready item, build a blocked one,
  "just build it", a design question, a code change) as `tools/agent-eval/`: scratch copy, scripted prompt, checks
  on what was written and which tools were called, cost recorded. Run before each release, because a skill or
  hook change can break behaviour the self-test can't see.
- [ ] **Anaxi on itself, continuously.** Every change to the tool changes its item in the same commit (§7.1);
  drift at zero is part of `release.sh`; the cycle above is tried on Anaxi's own items first.

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
- Did building find gaps the design missed? If they stayed in chat, close the loop first (§9); if they landed on
  items, count them per project to see where the method pays off.
- Did anyone who doesn't write code use it to decide something? If yes, the decisions inbox and non-software
  profiles (§9).
