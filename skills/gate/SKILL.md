---
name: gate
description: Check whether an Anaxi item is designed deep enough to build (exit 0 ready, 1 blocked) and say why.
argument-hint: "@id"
disable-model-invocation: true
allowed-tools: Bash(node *)
---

```bash
node "${CLAUDE_PLUGIN_ROOT}/tools/anaxi-check.mjs" gate $ARGUMENTS
```

Say plainly whether the item is ready to build. If it's blocked, list what blocks it and the smallest next step
for each (answer a question, take a dependency deeper, or move an open question to `later:` with a trigger).
Don't change any files.
