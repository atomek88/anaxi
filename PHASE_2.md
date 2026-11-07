# Anaxi phase 2

Phase 1 (up to 0.10) made depth measurable and the gate hard: items say how deep they're designed, what's built
and where the code is, and an agent in Claude Code can't build what isn't designed. Phase 2 is about **seeing a
project at any point in time**: where the design is against the work, how that changed, and what to do next,
for people and agents, in any tool, on any kind of project.

Nothing here is committed; the pilot ([PILOT.md](PILOT.md)) decides the order after §0. Phase 1's record and the
smaller follow-ups stay in [ROADMAP.md](ROADMAP.md).

## Rules (phase 1's, plus four)

- Markdown stays the source of truth; everything works without the newer layers; one engine (`tools/lib/`).
- **Git is the clock.** History, drift, timelines and "since" all come from git, so nothing new is stored. Caches
  are derived and deletable.
- **Progress stays out of the docs.** The docs say what must be true; tasks, subtasks, estimates and who is doing
  what live in a tracker (§C). The only progress marks in the docs are `built:` and the day it was checked.
- **Enforce where everyone passes.** Editor hooks are a convenience for one tool; commits and merges are where
  every person, agent and editor goes through (§0.2).
- **People decide.** An agent drafts and proposes; a decision that opens a gate is a person's (§0.3).

## 0. Holes to close first

Found reviewing 0.10 (2026-11-02). Small, and each makes the rest trustworthy.

### 0.1 Drift in both directions

**The hole.** N23 fires when the design changed after the code. When the code changes after the design, nothing
fires (`engine.mjs`, `builtNudges`: it returns when `docT <= codeT`). That's how docs usually go stale: an item
marked `built: yes` can take 40 commits of code and still show ✓.

**The fix: one baseline, two sides.** A built item's baseline is the day it was last checked (`built: yes
(2026-10-31)`; with no day, the day `built:` was written, from git). Everything that changed after the baseline
is drift, whichever side moved:

| Since the baseline | Means | Says |
|---|---|---|
| design changed, code didn't | the code may need to follow | N23, as now |
| code changed, design didn't | the design may need to follow | N26 (new): "12 commits, +340 −90 in `src/recurring/` since checked" |
| both changed | they moved together, or apart | N23 + N26 as one: "both changed since checked: reconcile" |

Whichever prompted the change, the same thing settles it: someone checks the two still agree and writes the day
(`anaxi-check verify @x`, or an agent through `anaxi_reverify`, §D), or edits the side that's behind.

**Noise.** Not every code commit touches the design, so the code side is measured, not just flagged:

- commits and lines since the baseline, per item, shown always (status, index, reader heat);
- a warning only past a threshold (`nudges.drift: { commits: 5 }`, a project default);
- an optional `contract:` subset of `code:` (an API schema, a types file, a migration folder): any change there
  warns at once, because a contract that moved means the D3 text is wrong;
- a commit trailer `Anaxi: no-design-impact` (any person or agent can write it) leaves that commit out.

**Any system, not only Claude Code.** It's computed by the engine from git, so it reaches every surface that
already calls the engine: `anaxi-check status` and `nudges`, `anaxi-ci` (CI and pre-commit), the reader, MCP, the
session-start hook. Two git-level additions make it hard to miss:

- **pre-commit** (warns, never blocks): "this commit changes the code of built @recurring; its design wasn't
  touched. Still matches? `anaxi-check verify @recurring`";
- **CI on a pull request** (optional, `ci.sameChange: true`): a PR that changes mapped code of a built item must
  also touch its doc, its checked day, or carry the trailer. It's a check, not a gate: drift is about honesty, so
  a label lets it through.

Later, if file-level drift is noisy where one doc holds several items: per-section drift with `git log -L`.

### 0.2 The gate everywhere

**The hole.** The hard gate is a Claude Code PreToolUse hook. Cursor, Codex and people editing by hand never meet
it, and the pre-commit hook only runs when markdown changes.

**How the gate works, in layers.** The rule is one function, `gateFor(model, file)`: the items that hold a file
(they map it in `code:`, aren't built and aren't ready). Each layer asks it at a different moment:

| Layer | When | Who it stops | How strong |
|---|---|---|---|
| advice | an agent asks (skill, `anaxi_gate`, `anaxi_context` lead with NOT READY) | agents that read it | ignored under "just build it" (tested) |
| edit time | before a file is written | Claude Code (PreToolUse, built); other agent tools through a thin adapter where they offer a pre-edit hook, a warning where they only have after-edit hooks | strong, one tool at a time |
| commit time | `git commit` | everyone on that machine | `--no-verify` skips it; local only |
| merge time | a pull request's required check | everyone, every tool | the real one for a team: lifting it takes repo permissions |

**The fix.** One command for the lower layers, `anaxi-check gate-files [--staged | --since <ref> | <files…>]`:
exit 1 with each held file, its items and what's missing. The pre-commit hook runs it on every commit (not only
markdown ones); `anaxi-ci.sh --pr <base>` runs it in CI. Code written against the gate can still exist on a
branch; it can't land.

- **Spikes stay possible.** Branches matching `gate.spikeBranches` (default `spike/*`) skip it, and can't merge into
  the main branch with held files. Exploring is free; landing waits for the design.
- **Lifting it is a person's act at every layer:** editing `anaxi.json` (edit time and commit time), or a
  maintainer's label on the PR (merge time), which repo permissions already restrict.

**And a design problem found on the way: the shared-file freeze.** If a new, unbuilt item lists an existing file
in its `code:` (a new feature that extends `engine.mjs`), the gate today refuses every edit to that file, for all
work, until the new item is ready. In a real codebase most features touch shared files, so this would stall a
team. Fix: an item holds the **paths it creates** (that don't exist yet, or that no built item maps); a file a
built item already maps isn't held, and editing it gives a note instead ("@x, not ready, also plans changes
here"). New code waits for the design; shared code keeps moving.

### 0.3 Who decided

**The hole.** Designing an item is always allowed, and the hook can't tell designing from deciding. An agent can
tick your open questions on @recurring and write ten plausible words per level, and the gate opens. Only the
skill's text says not to, and phase 1's tests showed that advice doesn't hold under pressure.

**The fix: questions say who decides, and the record says who did.**

- A question may say `(decide: person)` or `(decide: anyone)`. The default is by level, a project setting
  (`questions.decideBy: { D0: "person", D1: "person", D2: "anyone", ... }`): why and what are product decisions,
  shape and contract are usually technical.
- An answer records who and when: `→ decided: <name> 2026-11-07`.
- **Edit time:** every edit the Claude Code hook sees is an agent's, so it refuses an agent ticking a
  `decide: person` question on a held item, and points to the proposal form (`→ proposed: …`, box unchecked).
  The person ticks it in their editor, or in the reader (§F).
- **Commit and merge time:** a commit that ticks a person-question and carries an agent's trailer
  (`Co-Authored-By: Claude …`, or patterns set in `anaxi.json`) is flagged; `anaxi-check decisions --who` lists
  who ticked what, from git blame.
- Honest limit: an agent outside every hook, impersonating a person in a commit, can still fake it; git history
  shows it, nothing prevents it.

### 0.4 Dogfood ahead of the build

**Checked against git (2026-11-07):** 14 of Anaxi's 15 self-doc items are `built: yes` (@method has no code). Only
@related was designed before it was built (added 10-25, built 10-30). @built, @outline, @code-map and @hard-gate
were designed with the user in conversation, but each doc landed in the same commit as its code; the rest were
written about existing code. So the gate has never held Anaxi itself back.

**From now:** each phase 2 feature enters `docs/design/` as an item at D1, with `built: no` and its planned
`code:`, before any of its code. That needs §0.2's shared-file fix first: almost every feature here touches
`tools/lib/engine.mjs`, which the gate would otherwise freeze.

## A. Lifecycle stages, a board, and the design runway

Every item is already in a stage that its marks determine. Derive it; never ask anyone to set it:

| Stage | From the marks |
|---|---|
| idea | below D1, or `focus: later` with nothing written |
| designing | below its target, or open questions, so not ready |
| ready | gate ready, not built |
| building | `built: partly` |
| built | `built: yes`, no drift |
| drifting | built (partly or yes) with drift on either side (§0.1) |
| superseded / retired | the lifecycle mark |

**Where it shows:** a line at the top of `status` and `INDEX.md` ("2 designing · 1 ready · 1 building · 9 built ·
1 drifting"), a board in the reader (a column per stage, cards with depth bars, red where blocked), the stage in
every `anaxi_status` row, and `anaxi_board` for agents.

**The design runway** is one number for the project: items that are ready and not built. Too few, and builders
will hit gates soon; too many, and the design is running ahead of reality and may go stale before anyone builds
it. Built-ahead items (N24) are the opposite, design debt. The healthy band depends on the kind of project (§E):
a greenfield product wants a few ready items, a legacy system wants coverage instead.

With §B, each stage also has a time: how long an item has been designing, waiting ready, or drifting.

## B. A time machine

The docs are markdown in git, so the engine can read the project at any commit (`git show <ref>:<path>`):

- **`--as-of <date | ref>`** on `status`, `index`, the reader and MCP: the project as it stood then.
- **`anaxi-check since <ref>`**: the items whose stage, depth, decisions or contracts changed, so a returning
  reader (or an agent) reads only the difference. The reader marks changed sections, and remembers per viewer
  when they last looked (browser storage, a convenience only).
- **Timelines per item:** the day it entered each stage; time designing, waiting ready, building; when it last
  drifted. Commits and PRs mentioning `@id` join the timeline (§C).
- **Burn-up for the project:** levels designed against items built, over time; the runway over time.

**How:** sample one snapshot per day that changed the design folder or a mapped path, evaluate each with the
current engine, cache the results under `.git/anaxi/` (derived, deletable). Caveat shown with every chart: history
is measured with today's rules, which may differ from what the tool said at the time.

## C. Progress: what must be true in the docs, the work in a tracker

**The question:** should the docs catalogue progress, subtasks and tasks? **Proposed answer: no.** Docs rot
fastest where they track fast-moving state, and trackers are built for exactly that. Anaxi's job is the
relation between the two, not a second tracker. So:

| In the docs | In a tracker (or a planner) | Read by Anaxi from |
|---|---|---|
| acceptance criteria (D1, design content already) | tasks, subtasks, estimates, assignees, sprints | the tracker, by `@id` |
| `built:` and the day it was checked | status of each task | — |
| evidence links per criterion (`checks:`) | — | the repo (tests), CI results |

- **Criteria with evidence.** An acceptance criterion may name what shows it: a test file or name, a demo link
  (`→ checks: tests/recurring.spec.ts "four occurrences"`). Progress becomes "4 of 6 criteria shown", from the
  repo, and with a test report path configured (JUnit or TAP), "4 of 6 passing". N27 for a built item with a
  criterion nothing shows. When every criterion is shown, Anaxi suggests `built: yes`; it never writes it.
- **The tracker owns the work.** Issues, PRs and commits link to items by `@id` (a label, the title, or a trailer
  `Anaxi: @recurring`). The zero-dependency baseline reads only git (trailers, PR merge commits); adapters for
  GitHub Issues and Linear are optional and read-only.
- **Export, once, one way.** `anaxi-check export-tasks @id --to github` turns an item's criteria into issues
  labelled `@id`; after that the tracker owns them.
- **A planner, if a project has no tracker:** a separate tool, like gedanken and prototype are, that reads the
  same engine and keeps its own file outside the items. Not in core Anaxi.

## D. The re-verify loop

The concrete form of "the docs improve themselves", and how §0.1's drift gets settled.

`anaxi_reverify @id` (MCP) and `anaxi-check reverify @id` give whoever checks it, in one bounded bundle:

- the code diff since the baseline, limited to the item's `code:` (stat, plus hunks up to a word budget);
- the design diff since the baseline;
- the item's contracts (D3) and acceptance criteria, and the contracts of what it uses.

The checker then does one of three things: confirms they agree (`anaxi-check verify @id` writes today's day; for
an agent this is MCP's second write, after `anaxi_index`); edits the design where the code is now the truth and
nothing is a decision; or proposes, as unchecked questions, where it's a decision (§0.3) or where the code broke
the contract.

- **Any tool:** `anaxi-check reverify @id --bundle > recheck.md` writes the same bundle as a prompt file, for
  agents and people without MCP.
- **A queue:** `anaxi-check reverify --all` lists drifting items, sorted by drift size times how many items use
  them; the reader shows it as a heat map (commits since checked, both sides).

## E. Profiles for kinds of project

Projects differ in where the design should sit relative to the work. A profile sets the defaults for one kind;
the stage (extended from today's `pre-build` and `building`) changes them as a project ages.

| Kind | Healthy looks like | Loud | Quiet |
|---|---|---|---|
| greenfield product | a runway of a few ready items, gates passing | depth, gaps, runway | coverage |
| legacy or maintenance | the code covered by the map, little drift | drift, unmapped code | depth on old items |
| research or spike | questions answered over time; outputs are findings | open questions, `later:` triggers | built, code |
| migration or operations | phases with gates, a rollback written | readiness, caveats, contracts | runway |
| content, policy, non-software | outputs built and reviewed | drift against the outputs | contracts |

**Project stages:** discovery → shaping → building → hardening → maintaining → sunsetting. Each changes the
targets, which nudges are loud, and how strict the gate is (strict while building, advisory while maintaining).

**Explain from code**, for legacy projects: map coverage lists what no item covers; an agent drafts items from the
code at D1–D3, marked `source: code`. Those levels describe what exists; any decision in them still waits for a
person (§0.3).

**Not only software:** `code:` names where the work lands. A profile can rename it, as levels are renamed today
(`fields: { code: "outputs" }`), so a research project writes `outputs: [reports/q3-findings.md]`, and built,
drift, the map and the gate work the same. An example project that isn't software, to test it on.

**Roles** inside a project (feature, shared, foundation, and more) are [ROADMAP §7.4](ROADMAP.md#74-roles-how-an-items-role-is-said-and-how-it-changes-the-questions--open-method);
a profile can bring its own roles and questions.

## F. A writable reader, for decisions only

The one place a person who doesn't write code meets the design is a decision. The reader can take it:

- **One write:** answer an open question (tick it, keep or edit the proposal, add the answer). The engine makes the
  same minimal text edit a person would, records `→ decided: <git user> <day>`, and the watcher reloads.
  Nothing else in the reader writes.
- **Safe:** refused if the file changed since the page loaded; shows the diff it will make before writing.
- **Where:** `anaxi watch --decide`, a local server, so the person is whoever runs it (`git config user.name`).
- **Honest limit:** a non-technical person rarely runs Node. For them: the decisions inbox (§H) exported to a
  shared page or an issue, answered there, and turned into a PR by an agent; or a hosted reader later, whose
  writes become PRs.

## G. Cross-repo projects and a portfolio

Real products span repos (an app, a backend, infrastructure).

- **Uses across repos:** `uses: backend@task-api`, with `projects: { backend: "../backend/docs/design" }` in
  `anaxi.json` (a local path first; a git URL later, fetched into a derived cache). The gate counts the other
  repo's depth like a local use: a feature here waits for the backend's contract. An optional ref pins the
  contract a build relies on (`backend@task-api (v1.4)`).
- **A portfolio:** `anaxi watch --portfolio app backend infra`: each project's board side by side, cross-repo uses
  as edges, the runway per project.

## H. The hub loop (from ROADMAP §9)

The design folder as where every person and agent starts, and the loop that makes it better each time:

```
   decide ──► design to target ──► gate ──► build ──► mark built ──► drift ──► re-verify (§D)
     ▲                                        │                                    │
     └──── questions and proposals ◄──── gaps found while building ◄───────────────┘
                     │
                     └──► the project's question list grows (the next item is asked them up front)
```

- **Gaps found while building go on the item, not in the chat:** an unchecked question with a proposal and
  `found: build <day>`; a gap in a used item goes on that item. `anaxi_propose @id "question" "proposal"` does it
  for agents without file access.
- **Questions that caught a gap join the project's questions** (`anaxi-questions.md`) at the level they belonged,
  so the next item is asked them; a count of gaps found by building against by review shows whether the method
  pays off here.
- **A retro on built:** what did building teach that the design missed? Into the decision log; many gaps from one
  kind of item suggests a higher target for that kind.
- **A "where we are" page,** generated like `INDEX.md`: the stage line (§A), what's blocked and on what, the
  decisions inbox, what changed this week (§B). The session-start hook shows its top lines.
- **A decisions inbox:** every open question with a proposal, sorted by how many items its answer unblocks
  ("answering this unblocks @recurring and @multi-calendar"). `anaxi-check decisions`, a reader page,
  `anaxi_decisions`; answered in the reader (§F).
- **A briefing to a budget:** depth is a zoom level, so `anaxi_brief(role, words)` picks a depth per item to fit
  the whole project into 300 words for a PM or 2,000 for a new engineer or agent.
- **Search** in the reader and `anaxi_search` for agents, returning outline anchors.
- **Links outward** (`refs:`, `owner:`, [ROADMAP step 5](ROADMAP.md#5-references-and-attribution)), and a
  short-lived claim (`working: @who since`) so two agents don't take the same item.
- **Watched `later:` triggers:** "when 10 % of users use recurrence" becomes a condition someone can mark as hit,
  which reopens the item.
- **Agent behaviour as a test suite:** the phase 1 headless runs (build ready, build blocked, "just build it", a
  design question, a code change) as `tools/agent-eval/`, with checks on what was written, which tools were
  called, and the cost; run before each release.

## Order

1. **§0, before the pilot:** drift both ways, the gate at commit and merge with the shared-file fix, who decided,
   and phase 2's own items in `docs/design/` from here on.
2. **§A, before the pilot:** stages, the board and the runway, so the pilot can be read at a glance.
3. **The pilot**, on a project where the design runs ahead of the build.
4. **After it, by what it shows:** §D and §B for living docs; §H's inbox with §F if people who don't code take
   part; §E when a second kind of project appears; §C when a team links its tracker; §G when a product spans repos.
