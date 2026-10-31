---
anaxi: "@built"
depth: D3
risk: 2·1·1·1
about: [format, engine]
uses: ["@format", "@engine"]
caveats: drift is per file: an edit anywhere in a doc that holds several items counts for all of them
later: per-section drift with `git log -L` (when shared docs make the file-level check noisy)
built: yes (2026-10-30)
code: [../../../tools/lib/engine.mjs, ../../../tools/lib/parse.mjs, ../../../tools/watch/app.js]
---
# What's built (`built:`, `code:`, drift)

**Why.** Depth says how far an item is designed, not whether it exists. While a project is being built, the docs
can't say which items are already code, which are half done, and, the dangerous case, which ones changed after the
code was written. Readers then trust a design the code no longer follows, or rebuild what's there. It worked when
the docs show what's built at a glance, and flag a built item whose design moved on.

**What.** Any item or sub-item can say `built: no`, `partly` or `yes`; sections that are sub-items are checked off
on their own, and their host shows the roll-up ("built 2/3"). `code:` lists the files or folders it's built in. A
built item whose design changed after its code last did gets a warning: check the code still matches. A built item
below its target is flagged too: it was built ahead of its design. Status, the index, the reader and the MCP tools
show it; a project that never writes `built:` sees nothing new. Out of scope: tasks, estimates, who's doing it:
the tracker keeps those, and a ticket can still link to the item.

**Shape.** One field each, no new structure: `built:` is the only completion mark, kept coarse on purpose, and
checkboxes keep meaning "answered". Chosen over checkboxes on D4 tasks, which would collide with that meaning, and
over a status per level, which is more marks to keep true. Drift comes from git: the last commit (or an uncommitted
edit) to the item's doc and its parts, against the last one to its `code:` paths. Without git, or without `code:`,
there is no drift check, only the mark. The risky part is false alarms: a typo fix in the doc warns; the fix is to
commit the code check with it, or set `built: partly` until it is.

**Contract.** Fields: `built: no | partly | yes`, optionally with the day the code was last checked against the
design (`built: yes (2026-10-30)`), so backfilling marks on an existing project doesn't flag everything; `code: path, path` (front matter: a YAML list), relative to the
item's file like a link, files or folders. Nudges: **N23** (warn) "built, but the design changed after the code"
when `built` is `partly` or `yes`, `code:` is set, and the doc's last change is newer than the code's and falls after the checked day (local dates); **N24** (warn)
"built ahead of its design" when `built` is `partly` or `yes` and the depth is below the full target; **N25** (warn)
"code path doesn't exist". Status and the index get a Built column only when some item has `built:` or `code:`:
✓ yes, ◐ partly, · no, and `k/n` for a host whose sub-items are marked. JSON: `built`, `code`, `builtParts`
(`{ yes, partly, no }`), `drift` (`{ doc, code }` as ISO dates) when there is one.
