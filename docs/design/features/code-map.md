---
anaxi: "@code-map"
depth: D2
risk: 1·0·1·1
about: [agents, engine]
uses: ["@built", "@engine", "@mcp"]
built: yes (2026-10-30)
code: [../../../tools/lib/engine.mjs, ../../../tools/anaxi-mcp.mjs, ../../../tools/anaxi-check.mjs, ../../../hooks/after-edit.mjs]
---
# Code → design lookup (`code:` as the map)

**Why.** An agent editing `src/messaging/send.ts` isn't told that the file is part of @messaging, that @messaging's
contract says retries are idempotent, or that the design is still being decided. It changes code against a design it
never read, and the design and the code drift apart silently.

**What.** The map is the `code:` field items already have: each item lists the files, folders or globs it's built in
(`code: [../../src/messaging/**, ../../src/shared/queue.ts]`), so a file can belong to several items, which is how
cross-cutting code is described: an @auth or @logging item lists what it spans. Nothing is written in code or config
files. From the map: `anaxi_for_file(path)` and `anaxi-check file <path>` list the items a file belongs to, with
their depth, built state, drift and contract links; and when Claude edits a mapped file, the plugin tells it once per
file per session which items it touches and to check the change against them. Done when an agent editing a mapped file
names the item and reads its contract before changing behaviour. Out of scope: finding the mapping automatically.

**Shape.** One reverse index built from `code:` on every call, no stored map: an entry matches a file exactly, as a
folder prefix, or as a glob (`*`, `**`, `?`, the same globs as `docs`). Mapping lives on the items, not in a central
`anaxi.json` table, so each feature says where it is built next to its design, and a review of the design is a review
of the map. Chosen over markers in code (`// @anaxi: @messaging`), which every file and language would need. Drift
works for globs through git's `:(glob)` pathspecs. The hook is a PostToolUse note, once per file per session, so it
doesn't repeat on every edit; `hooks.codeMap: false` turns it off. The risky part is a stale map: N25 flags a path or
glob that matches nothing.
