# Anaxi quickstart

One page. Everything else is reference, for when you need it.

## The idea

Every design item (epic, story, feature, shared component) gets a mark saying **how deep it's been designed**
and **how deep it needs to go**. Tools and agents read the marks and tell you: go deeper, stop, or wait.

| Level | Done when |
|---|---|
| **D0 Why** | someone could argue for or against doing it |
| **D1 What** | QA could write the acceptance tests |
| **D2 Shape** | a lead could estimate it and find the risky part |
| **D3 Contract** | two people could build the two sides separately |
| **D4 Build** | an agent could build it without asking |

These levels, the risk rubric and the questions are **defaults**. Rename, drop or add levels, change the risk
factors, or skip scoring and write the target yourself: [METHOD.md §0](METHOD.md#0-defaults-not-rules).

## 1. Set up (once, one command)

```bash
path/to/anaxi/tools/anaxi-init.sh my-project --profile service --stage shaping
```

A new folder or an existing repo; it never overwrites anything. It copies the method into `tools/anaxi/`,
writes `anaxi.json` and `docs/anaxi-questions.md` (leave it nearly empty for now), starts `docs/shared/stack.md`,
links the agent skill and installs a pre-commit hook that keeps `docs/INDEX.md` fresh. Docs elsewhere? Add
`--docs path`.

Profiles: `default`, `service`, `mobile`, `data`, `integration`, `library`, `spike`, `regulated`.
Stages: `discovery`, `shaping`, `pre-build`, `building`, `change`.

## 2. Mark an item (a minute)

Start a new TDD with `node tools/anaxi/tools/anaxi-check.mjs new my-feature --title "My feature"`. Or keep
your usual TDD template and add front matter:

```markdown
---
anaxi: "@recurring"
depth: D1
risk: 2·1·1·1
uses: ["@task-api"]
---
```

**Risk** is four scores, 0–2 each: blast radius · reversibility · novelty · certainty. The total sets the
target: 0–1 → D1, 2–3 → D2, 4–5 → D3, 6–8 → D4. Not sure? Score it anyway, then argue about it in review.
Or skip risk and write the target: `depth: D1 → D3`.

A section can be its own item: `> @task-api · depth: D3 🎯 · risk: 2·2·0·0` under its heading. TDD getting long?
Move deep detail to an `APPENDIX.md` section marked `> part-of: @recurring`; it still counts for the TDD.

## 3. Write until it says stop

```bash
node tools/anaxi/tools/anaxi-check.mjs nudges @recurring     # what's missing, or "enough"
node tools/anaxi/tools/anaxi-check.mjs questions @recurring  # the questions for each level
```

Answer the next level's questions in your own headings and prose; your template's headings already map to
levels. Raise `depth:` as you go. Questions you can't answer yet go in a checklist: `- [ ] D3 · …`. Sketches
and ideas go under `## Sketch` or `## Appendix`, where nothing counts or nags.

At the target, write `depth: D3 🎯` (or `D3 enough`) and stop.

## 4. Use it in your sprint

| When | Do |
|---|---|
| refinement | score risk, set the target |
| planning | read `docs/INDEX.md`: what's ready, blocked, or still a gap |
| before building | `anaxi-check gate @id`: ready only at the full target with nothing open (your Definition of Ready) |
| review | the reviewer checks the claimed depth against the "done when" above |

Tickets, estimates and "done" stay in your tracker.

## Next

- An example project: [example/](example/)
- All the marks: [FORMAT.md](FORMAT.md) · nudges: [NUDGES.md](NUDGES.md) · questions: [QUESTIONS.md](QUESTIONS.md)
- Trying it with a team: [PILOT.md](PILOT.md)
