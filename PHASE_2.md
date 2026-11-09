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
- **Enforce where everyone passes.** Editor hooks are a convenience for one tool; commits and merges are where
  every person, agent and editor goes through (@gate-everywhere).
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
| [@drift-both](docs/design/phase-2/drift-both.md) | drift in both directions: the code moving on without the design is flagged too (N26) | now |
| [@gate-everywhere](docs/design/phase-2/gate-everywhere.md) | the gate at commit and merge, for every tool and person | now |
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

Already decided and built (0.11): **shared code isn't frozen by the gate.** An existing file that a built item maps
is never held, and an unready item's plans on it are a note; a new file is held while the items that plan it
aren't ready, and open to any of them that is (@hard-gate).

## Where it stands (2026-11-09)

Every phase 2 question is answered: yours from 2026-11-07, the rest on 2026-11-09, the technical ones by the agent
(D2 and deeper are anyone's) and the remaining why/what ones delegated to the agent's proposals, each recorded as such
on its line. **Ready to build (🎯, gate open):** @drift-both, @gate-everywhere and @decided (D3, contracts written),
@stages and @reverify (D2 is their target). The rest wait on depth, not on people: @time-machine, @progress and
@decide-reader need their D3 contracts, written when they're picked up; @adopt needs D2 and D3; @project-kinds,
@cross-repo and @hub stay parked at D1 until their triggers.

## Order

1. **Now, before the pilot:** @drift-both, @gate-everywhere, @decided and @stages: answer their questions, write their
   contracts, build them in that order (each gate says when).
2. **The pilot**, on a project where the design runs ahead of the build ([PILOT.md](PILOT.md)).
3. **After it, by what it shows:** @adopt early (the pilot is a real project, so mapping it in is the first job);
   @reverify and @time-machine for living docs; @hub's first ideas with @decide-reader
   if people who don't code take part; @project-kinds when a second kind of project appears; @progress when a team
   links its tracker; @cross-repo when a product spans repos.
