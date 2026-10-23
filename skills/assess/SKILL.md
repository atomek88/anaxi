---
name: assess
description: Assess one Anaxi design doc or item — structural nudges from the checker plus a read of whether its questions are really answered — and say what to do next, including "this is enough".
argument-hint: "<file.md | @id>"
disable-model-invocation: true
allowed-tools: Bash(node *), Read, Grep, Glob
---

Assess `$ARGUMENTS` with the **anaxi** skill (procedure "assess"). The method files are in `${CLAUDE_PLUGIN_ROOT}`.

1. Structural part, from the checker (for a file, first find its items in `status --json`):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/tools/anaxi-check.mjs" status --json
   node "${CLAUDE_PLUGIN_ROOT}/tools/anaxi-check.mjs" nudges @id
   node "${CLAUDE_PLUGIN_ROOT}/tools/anaxi-check.mjs" questions @id
   ```

2. Semantic part, by reading the doc and its parts: which questions are really answered (N05), over-engineering
   (N07), content outside the item's focus (N08), whether the risk score still fits (N12).
3. Report in nudge order, ending with the one or two next actions, or "enough: stop here". Don't edit the doc
   unless asked.
