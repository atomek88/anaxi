# Anaxi's own design

Anaxi documented with Anaxi. One item per part of the tool: what it is for, what it does and how it is shaped,
written here; the contracts are the reference docs (METHOD, FORMAT, QUESTIONS, NUDGES, tools/SPEC, the skill),
joined to their item as parts with an invisible `<!-- anaxi: part-of: @id -->` comment, so nothing is written twice.

- `shared/`: what the tool's features build on (the method, the markup, the questions, the engine)
- `features/`: what people and agents use (the CLI, the reader, the MCP server, the skill, init, release)
- [INDEX.md](INDEX.md): generated; `node tools/anaxi-check.mjs index`

Read it with `/anaxi:watch` from the repo root, or `node tools/anaxi-check.mjs status`.
