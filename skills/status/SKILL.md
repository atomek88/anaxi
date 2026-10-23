---
name: status
description: Show the Anaxi status table for this project — every design item's depth, target, open questions and dependencies.
argument-hint: "[--focus now|next|later] [--about TOPIC]"
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Run the Anaxi checker from the project folder and show the result:

```bash
node "${CLAUDE_PLUGIN_ROOT}/tools/anaxi-check.mjs" status $ARGUMENTS
```

If it says there is no `anaxi.json`, offer `/anaxi:init`. Otherwise show the table as printed, then add one line on
what to do first: blocked items, then the ones below their target. Don't change any files.
