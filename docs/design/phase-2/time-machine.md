---
anaxi: "@time-machine"
depth: D2
risk: 1·0·2·2
about: [history]
uses: ["@engine", "@drift-both", "@stages"]
focus: next
built: no
code: [../../../tools/lib/history.mjs, ../../../tools/lib/git.mjs, ../../../tools/anaxi-check.mjs, ../../../tools/watch/history.js]
---
# A time machine

**Why.** A living design is only half useful if you can see it only as it is now. A returning reader wants what
changed since they last looked; a team wants to know how long items wait ready, and whether the design is keeping
ahead of the build. The docs are markdown in git, so all of this is already stored.

**What.** `--as-of <date | ref>` on `status`, `index`, the reader and MCP shows the project as it stood then.
`anaxi-check since <ref>` lists the items whose stage, depth, decisions or contracts changed; the reader marks
changed sections and remembers, per viewer, when they last looked. Per item, a timeline: the day it entered each
stage (@stages), time designing, waiting ready, building, drifting, with commits and PRs that mention its `@id`.
For the project, a burn-up: levels designed against items built over time, and the runway over time. Done when
`since` on Anaxi's own repo lists exactly the items changed in phase 2, and the burn-up renders its history.

**Shape.** `tools/lib/history.mjs` reads the design folder at a commit (`git show <ref>:<path>` through
`tools/lib/git.mjs`) and evaluates it with the current engine through the `read` option `evaluate` already has.
Snapshots: one per day that changed the design folder or a mapped path, evaluated lazily, cached under
`.git/anaxi/` (derived, deletable). Charts are hand-written SVG in the reader. Chosen over storing snapshots in the
repo (state the docs don't hold) and over a database.

## Open questions

- [ ] D2 · Old docs are measured with today's rules, which may differ from what the tool said then. → proposed: accept it, and show the engine version used with every chart
- [ ] D2 · Past changes to `anaxi.json`? → proposed: read `anaxi.json` at each commit too
- [ ] D2 · Moved files and changed ids? → proposed: follow tagged items by `@id`, untagged ones by file with git's rename detection
- [ ] D2 · How many snapshots, how fast? → proposed: at most 365, lazily; a year of 50 items in under 5 s, measured on Anaxi's own history first
- [ ] D2 · When is the cache invalid? → proposed: keyed by commit and engine version; anything else deletes it
