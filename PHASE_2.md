# Anaxi phase 2

Phase 1 (up to 0.10) made depth measurable and the gate hard: items say how deep they're designed, what's built
and where the code is, and an agent in Claude Code can't build what isn't designed. Phase 2 is about **seeing a
project at any point in time**: where the design is against the work, how that changed, and what to do next,
for people and agents, in any tool, on any kind of project.

**Phase 2 is designed with Anaxi itself.** Each part is an item in [docs/design/phase-2/](docs/design/phase-2/), with
its depth, `built: no`, its planned `code:` and its open questions; the gate holds each one's new files until it's
ready. Read it with `node tools/anaxi-check.mjs status` or `/anaxi:watch`. This page is the overview; the items are
the source of truth. Phase 1's record and the smaller follow-ups are in [ROADMAP.md](ROADMAP.md).

## Rules (phase 1's, plus five)

- Markdown stays the source of truth; everything works without the newer layers; one engine (`tools/lib/`).
- **Git is the clock.** History, drift, timelines and "since" all come from git, so nothing new is stored. Caches
  are derived and deletable.
- **Progress stays out of the docs.** The docs say what must be true; tasks, subtasks, estimates and who is doing
  what live in a tracker (@progress). The only progress marks in the docs are `built:` and the day it was checked.
- **Enforce where everyone passes, through git.** Editor hooks are a convenience for one tool; the commit is where
  every person, agent and editor goes through (@gate-everywhere). Anaxi uses git's history, index and local hooks,
  and stays out of pull requests, merges and CI workflows.
- **People decide.** An agent drafts and proposes; a decision that opens a gate is a person's (@decided).
- **Call out, don't block.** The gate holds one thing, code for an item that isn't designed. Everything else is
  highlighted, never stopped: decisions waiting on a person (⚑), complex items (◆), drift, an empty runway.
- **Catch up by instruction.** When the docs fall behind the work, an agent maps the project in (@adopt) and a person
  accepts what it proposes; nobody keeps progress by hand.
- **Design ahead of the build.** Each phase 2 feature is an item at D1 or deeper, with `built: no` and planned
  `code:`, before any of its code. Checked on 2026-11-07: in phase 1, only @related was designed before it was built.

## The items

| Item | What | Focus |
|---|---|---|
| [@drift-both](docs/design/phase-2/drift-both.md) | drift in both directions, opt-in: the code moving on without the design is flagged too (N26) | next |
| [@gate-everywhere](docs/design/phase-2/gate-everywhere.md) | the gate at commit, for every tool and person | now |
| [@decided](docs/design/phase-2/decided.md) | questions say who decides; an agent can't tick a person's decision | now |
| [@stages](docs/design/phase-2/stages.md) | a derived lifecycle stage per item, a board, the design runway | now |
| [@time-machine](docs/design/phase-2/time-machine.md) | the project as of any date; what changed since; timelines and burn-up | next |
| [@progress](docs/design/phase-2/progress.md) | acceptance criteria with evidence in the docs; the work in a tracker | next |
| [@reverify](docs/design/phase-2/reverify.md) | one bounded call that settles drift, or leaves proposals | next |
| [@adopt](docs/design/phase-2/adopt.md) | an agent maps a project's code, tests and tracker into its docs, as proposals | next |
| [@decide-reader](docs/design/phase-2/decide-reader.md) | the reader can answer a decision, and nothing else | next |
| [@project-kinds](docs/design/phase-2/project-kinds.md) | kinds of project and stages of a project's life; work that isn't software | later |
| [@cross-repo](docs/design/phase-2/cross-repo.md) | uses across repos, and a portfolio | later |
| [@hub](docs/design/phase-2/hub.md) | the loop from building back to design, and the ideas it holds | later |

## Built (0.11, 2026-11-09)

- **@stages:** every item has a stage derived from its marks (idea, designing, ready, building, built, drifting,
  parked, superseded, retired). The stage line opens `status` and `INDEX.md` (`4 designing · 6 ready · 14 built ·
  runway 6 · ◆ 3 complex`). The reader has a board (`#/board`), MCP has `anaxi_board`, and N28 fires when the runway
  is 0 while items are designing.
- **@decided:** questions say who decides them (`(decide: person)`, or `decideBy`, D0–D1 a person's by default), and
  answers say who gave them (`→ decided: name day: …`). `anaxi-check decide` is the person's command and
  `anaxi-check decisions` lists what waits on whom (⚑). On an item the gate holds, the Claude Code hook refuses an
  agent ticking a person's question or running `decide`; everywhere else, an agent's answer is called out (N29,
  `decisions --who`).
- **@gate-everywhere:** `anaxi-check gate-files --staged` runs from the pre-commit hook for every tool. It's silent
  unless a staged file is held, and then it **warns by default**; `"gate": { "commit": "block" }` makes it stop the
  commit. Spike branches skip it. It takes about 0.3 s for 200 items.
- **A drift fix:** N23 counts only a part's own section of a shared file, so editing SPEC.md no longer flags every
  item with a part there. (Two-way drift, @drift-both, stays opt-in and unbuilt.)
- Earlier in 0.11: **shared code isn't frozen by the gate.** An existing file that a built item maps is never held,
  and an unready item's plans on it are a note. A new file is held while the items that plan it aren't ready, and is
  open to any of them that is (@hard-gate).

Nothing here makes editing harder while building:
- docs stay writable, except an agent ticking a held item's person question;
- code a built item maps stays writable;
- commits only warn;
- nothing touches pull requests.

Every phase 2 question is answered and recorded on its line. Still unbuilt:
- ready, built when the pilot asks for them: @reverify and @drift-both (opt-in);
- waiting on depth, not on people: @time-machine, @progress, @decide-reader and @adopt;
- parked until their triggers: @project-kinds, @cross-repo and @hub.

## Order

1. **Now, before the pilot:** @gate-everywhere, @decided and @stages: built in 0.11.
2. **The pilot**, on a project where the design runs ahead of the build ([PILOT.md](PILOT.md)).
3. **After it, by what it shows:** @drift-both if the pilot's docs go stale unseen; @adopt early (the pilot is a real project, so mapping it in is the first job);
   @reverify and @time-machine for living docs; @hub's first ideas with @decide-reader
   if people who don't code take part; @project-kinds when a second kind of project appears; @progress when a team
   links its tracker; @cross-repo when a product spans repos.
