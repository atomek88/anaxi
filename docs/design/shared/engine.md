---
anaxi: "@engine"
depth: D3
risk: 2·1·1·0
about: [engine]
uses: ["@format", "@method", "@questions"]
caveats: the word floor per level (nudges.levelWords, 10) is not calibrated on real docs yet
---
# The engine

**Why.** The CLI, CI, the reader, the MCP server and the skill all have to give the same answer about an item:
its depth, its target, what blocks it. Five surfaces with their own logic would drift within a release.

**What.** Loads `anaxi.json` and its profile; finds the doc files; finds items in all four forms and their
sections, checklists, parts and uses; measures what the text shows at each level (words per level, and the
deepest level with nothing missing before it); works out targets and caps; raises the structural nudges; answers
the gate; applies lifecycle marks; and reads an item at a depth (blocks, and the bounded context for building).
Zero dependencies, Node 18+. Out of scope: the semantic checks (is a question answered, over-engineering, out of
focus), which are the skill's (@skill).

**Shape.** Pure functions over the files, recomputed on every call (≈0.1 s on the example): `lib/config.mjs`
(settings, profile, doc files) → `lib/parse.mjs` (items, sections, checklists) → `lib/engine.mjs` (`evaluate`:
links, evidence, targets, nudges, `gate`) → `lib/read.mjs` (`blocks`, `visible`, `context`). Chosen over a
cached index, which would hand agents stale answers. A claim counts only as far as the text backs it without a
gap, so status, targets and the gate use the lower of the claim and what is shown. The risky part is the
evidence heuristic: words per level say something was written, not that it answers anything; that stays the
skill's call. Tested by `tools/selftest.mjs`, including mutation checks on the depth rules.

Contracts: [NUDGES.md](../../../NUDGES.md) and [tools/SPEC.md](../../../tools/SPEC.md) §3–§5 and §8.1.
