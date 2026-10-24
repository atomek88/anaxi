---
name: watch
description: Open the Anaxi reader for this project — the design docs as linked pages with a depth control, and a map — live-reloading as docs are saved.
argument-hint: "[--port 4321]"
disable-model-invocation: true
allowed-tools: Bash(node *)
---

Start the reader in the background (it keeps running; it never writes to the docs):

```bash
node "${CLAUDE_PLUGIN_ROOT}/tools/anaxi-watch.mjs" --dir . $ARGUMENTS
```

Run it with the Bash tool's background option, wait for its first line, and give the user the URL it prints
(default http://127.0.0.1:4321/). If the port is taken, run it again with `--port 0` for a free one. If there is no
`anaxi.json`, offer `/anaxi:init` first. Mention: Overview → a topic → an item page; the D0–D4 buttons set how
deep to read; Map shows depth bars and what blocks what.
