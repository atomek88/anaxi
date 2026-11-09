---
anaxi: "@project-kinds"
depth: D1
risk: 2·1·2·2
about: [kinds]
uses: ["@method", "@stages"]
focus: later
later: when the pilot and a second kind of project show which kinds and signals matter
built: no
code: [../../../profiles/, ../../../examples/research/]
---
# Kinds of project, and stages of a project's life

**Why.** Projects differ in where the design should sit relative to the work. A greenfield product wants a few
items ready ahead of the build; a legacy system wants its code covered; a research project progresses by answered
questions, not code; a content or policy project has outputs, not code. One set of defaults fits none of them well.

**What.** A kind sets what healthy looks like and which nudges are loud: greenfield (runway, depth, gaps), legacy or
maintenance (drift, unmapped code), research or spike (open questions, `later:` triggers), migration or operations
(readiness, caveats, a rollback), content, policy and other non-software work (drift against the outputs). A
project's stage changes the defaults as it ages: discovery, shaping, building, hardening, maintaining, sunsetting.
For legacy projects, "explain from code" (@adopt): map coverage lists what no item covers, and an agent drafts items from
the code at D1–D3, marked `source: code`, whose decisions still wait for a person. For work that isn't software,
`code:` names where the work lands and can be renamed per project (`fields: { code: "outputs" }`), so built, drift,
the map and the gate work the same. An example project that isn't software, to test it on. Done when the example
research project runs through the checker with its own kind and reads sensibly.

## Open questions

- [x] D0 · (decide: person) Kinds beside today's profiles (mobile, service, library, spike…), or as more profiles? → decided: Tomasz Michalik 2026-11-09 (delegated in session: "go ahead … with your answers", recorded by the agent): beside them: a `kind` in `anaxi.json`, combined with the profile; the profile says what the system is, the kind says what sort of project it is
- [x] D1 · (decide: person) The project stages? → decided: Tomasz Michalik 2026-11-09 (delegated in session: "go ahead … with your answers", recorded by the agent): discovery, shaping, building, hardening, maintaining, sunsetting, keeping today's `pre-build` and `change`
- [x] D1 · Renaming `code:` for non-software work? → decided: Tomasz Michalik 2026-11-09 (delegated in session: "go ahead … with your answers", recorded by the agent): `fields: { code: "outputs" }`, like levels are renamed today
- [x] D1 · Explain from code: in this item or its own? → decided: Tomasz Michalik 2026-11-09 (delegated in session: "go ahead … with your answers", recorded by the agent): its own item, @adopt, moved up to `next`: an agent reads the project and maps it into Anaxi docs, which is how a project catches up with its docs by instruction
- [x] D1 · Which example? → decided: Tomasz Michalik 2026-11-09 (delegated in session: "go ahead … with your answers", recorded by the agent): a small market study in `examples/research/`
