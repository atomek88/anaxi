---
anaxi: "@cross-repo"
depth: D1
risk: 2·1·2·1
about: [scale]
uses: ["@engine", "@hard-gate"]
focus: later
later: when a pilot product spans more than one repo
built: no
code: [../../../tools/lib/projects.mjs, ../../../tools/lib/config.mjs]
---
# Cross-repo projects and a portfolio

**Why.** Real products span repos: an app, a backend, infrastructure. A feature in the app depends on a contract in
the backend, and today Anaxi can't see past one repo, so that dependency is a sentence, not a checked use.

**What.** `uses: backend@task-api`, with `projects: { backend: "../backend/docs/design" }` in `anaxi.json`. The gate
counts the other repo's depth like a local use: a feature here waits for the backend's contract. An optional ref pins
the contract a build relies on (`backend@task-api (v1.4)`). A portfolio, `anaxi watch --portfolio app backend
infra`: each project's board (@stages) side by side, cross-repo uses as edges, the runway per project. Done when the
example's app and a split-out backend gate each other correctly.

## Open questions

- [ ] D1 · Local paths only, or git URLs too? → proposed: local paths first; git URLs later, read-only through the person's own git credentials, cached as derived data
- [ ] D1 · Id clashes between projects? → proposed: other projects' ids are always qualified (`backend@task-api`); local ids stay bare
- [ ] D1 · What does a pin mean when the other repo moves on? → proposed: the pin is read at that ref, and a nudge says when the current contract differs
