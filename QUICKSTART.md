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

## 1. Set up (once)

**With Claude Code (recommended):** install the plugin once per machine, then run `/anaxi:init` in any project.

```bash
claude plugin marketplace add <anaxi repo: a git URL or a local path>
claude plugin install anaxi@anaxi
```

In the project, `/anaxi:init` (or `/anaxi:init --profile service --stage shaping`) writes `anaxi.json` and
`docs/anaxi-questions.md` (leave it nearly empty for now), starts `docs/shared/stack.md` and installs a pre-commit
hook that keeps `docs/INDEX.md` fresh. Nothing is copied into the project: the plugin brings the skill, the
checker and the commands (`/anaxi:status`, `/anaxi:assess`, `/anaxi:gate`). Updating: [TOOLING.md §5](TOOLING.md#5-installing).

**Without Claude Code** (other agents, or CI): one script copies the method into the project.

```bash
path/to/anaxi/tools/anaxi-init.sh my-project --profile service --stage shaping
```

A new folder or an existing repo; it never overwrites anything. It copies the method into `tools/anaxi/`,
writes the same files, links the agent skill and installs the hook. Docs elsewhere? Add `--docs path`.

Profiles: `default`, `service`, `mobile`, `data`, `integration`, `library`, `spike`, `regulated`.
Stages: `discovery`, `shaping`, `pre-build`, `building`, `change`.

## 2. Mark an item (a minute)

Start a new TDD by asking Claude ("start a TDD for my feature with anaxi") or with
`node tools/anaxi/tools/anaxi-check.mjs new my-feature --title "My feature"`. Or keep your usual TDD template and
add front matter:

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

```text
/anaxi:assess @recurring                                     # in Claude Code: what's missing, or "enough"
node tools/anaxi/tools/anaxi-check.mjs nudges @recurring     # the same structural part, from the script
node tools/anaxi/tools/anaxi-check.mjs questions @recurring  # the questions for each level
```

Answer the next level's questions in your own headings and prose; your template's headings already map to
levels. Raise `depth:` as you go. Questions you can't answer yet go in a checklist: `- [ ] D3 · …`. Sketches
and ideas go under `## Sketch` or `## Appendix`, where nothing counts or nags.

At the target, write `depth: D3 🎯` (or `D3 enough`) and stop.

Replaced later? Don't delete or rewrite history: `anaxi-check supersede @old --by @new --why "…"` (or `retire`,
`archive`). The old doc stays readable and stops counting ([FORMAT.md §10](FORMAT.md#10-superseded-retired-archived)).

## 4. Use it in your sprint

| When | Do |
|---|---|
| refinement | score risk, set the target |
| planning | read `docs/INDEX.md`: what's ready, blocked, or still a gap |
| before building | `/anaxi:gate @id` (or `anaxi-check gate @id`): ready only at the full target with nothing open (your Definition of Ready) |
| review | the reviewer checks the claimed depth against the "done when" above |

Tickets, estimates and "done" stay in your tracker.

**To read the design:** `/anaxi:watch` (or `node tools/anaxi/tools/anaxi-watch.mjs`) opens a local reader: an
overview, a page per item with D0–D4 buttons for how deep to read, and a map. **Agents** call `anaxi_context` (MCP)
or `anaxi-check context @id` for exactly what to read before building.

## Next

- An example project: [example/](example/)
- All the marks: [FORMAT.md](FORMAT.md) · nudges: [NUDGES.md](NUDGES.md) · questions: [QUESTIONS.md](QUESTIONS.md)
- Trying it with a team: [PILOT.md](PILOT.md)
