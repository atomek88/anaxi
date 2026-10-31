# Anaxi's own design

Anaxi documented with Anaxi, in one folder: nothing outside `docs/design/` carries a mark. One item per part of the
tool says what it is for, what it does and how it is shaped; its contract is the reference docs (METHOD, FORMAT,
QUESTIONS, NUDGES, tools/SPEC, the skill), listed on the item as `parts:` with the level they answer, so nothing is
written twice.

- `anaxi.json`: the settings, found from the repo root (docs/design is a conventional design folder)
- `shared/`: what the tool's features build on (the method, the markup, the questions, the engine)
- `features/`: what people and agents use (the CLI, the reader, the MCP server, the skill, init, release)
- [INDEX.md](INDEX.md): generated; `node tools/anaxi-check.mjs index`

Read it with `/anaxi:watch` from the repo root, or `node tools/anaxi-check.mjs status`.
