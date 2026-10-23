---
name: init
description: Add Anaxi to this project — anaxi.json, project questions, the @stack item and a git pre-commit hook. Never overwrites a file.
argument-hint: "[--profile default|service|mobile|data|integration|library|spike|regulated] [--stage discovery|shaping|pre-build|building|change] [--docs DIR]"
disable-model-invocation: true
allowed-tools: Bash(bash *), Bash(node *), Read
---

If the user gave no profile, look at the repo (what it builds) and suggest one from
`${CLAUDE_PLUGIN_ROOT}/PROFILES.md` in one line, then run:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/tools/anaxi-init.sh" . --plugin $ARGUMENTS
```

`--plugin` skips the vendored copy and the skill link: the plugin provides both. Show what it created, then the
next steps it prints. If the project has CI, mention that CI needs `ANAXI_HOME` or a vendored copy
(`${CLAUDE_PLUGIN_ROOT}/QUICKSTART.md`).
