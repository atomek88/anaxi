# Anaxi tooling: what the system is made of, and how docs get built

## 1. Three layers

| Layer | What it is | Where it lives | Who edits it |
|---|---|---|---|
| **1 · Method** | this folder: principles and core questions, nudges, format, profiles, templates, the agent skill, the scripts | once per organization: a shared repo, vendored into each project (`tools/anaxi/`), or a git submodule | method owner |
| **2 · Project** | the project's own markdown design docs (any structure, marked up per [FORMAT.md](FORMAT.md)), shared items including `@stack`, `anaxi-questions.md`, `anaxi.json` | in the project repo, next to the code (e.g. `docs/`) | the team, and agents working with them |
| **3 · Output** | `INDEX.md` (committed, so readers and agents always have it); optional rendered documents and JSON (not committed) | `index` and `out` in `anaxi.json` | nobody; regenerate it |

The design documentation **is the project's markdown docs**, marked up. They stay readable and useful with
no tools at all. The method folder tells people, agents and scripts how to read them, and the output only
makes them easier to move around in.

A project repo looks like this:

```
my-project/
  anaxi.json                       settings (PROFILES.md); optional
  docs/
    anaxi-questions.md             the project's questions (QUESTIONS.md §5.1)
    INDEX.md                        generated index of every item (§4.2)
    shared/
      stack.md                      @stack: languages, frameworks, libraries, and why
      task-api.md                   @task-api
    features/
      recurring-tasks.md            a TDD in your usual template, with front matter
    _anaxi/                        rendered output (gitignored)
  tools/anaxi/                     the method, vendored (or point ANAXI_HOME at a shared copy)
  .claude/skills/anaxi → tools/anaxi/skill      the agent skill, linked
```

## 2. Scripts

Zero-dependency Node (≥ 18) and bash. The skill also works without them (by hand, with `grep`).

| Script | Does | Status |
|---|---|---|
| `tools/lib/` (`config.mjs`, `parse.mjs`, `questions.mjs`, `engine.mjs`) | shared code. **config:** profile → `anaxi.json` layering, finding the docs. **parse:** the four ways to declare an item, icons, `@id` and link references, section-to-level mapping, the canvas, checklists. **questions:** the core table in QUESTIONS.md and the project's `anaxi-questions.md`. **engine:** targets, caps, open questions, structural nudges, the gate, the index | built |
| `tools/anaxi-check.mjs` | `status`, `nudges` (with `--diff`), `gate`, `questions`, `uses`, `index` (with `--check`), `check`; JSON output | built |
| `tools/anaxi-ci.sh` | for CI or a pre-commit hook: `check`, then `INDEX.md` (fail if stale, or `--fix` to regenerate and stage it), new nudges since a ref (`--base`), gates (`--gate "@a @b"`) | built |
| `tools/hooks/pre-commit` | runs `anaxi-ci.sh --fix` on commits that touch markdown | built |
| `tools/selftest.mjs` | checks the example's statuses and that a broken project trips every structural check | built |
| `tools/anaxi-init.sh` | adds Anaxi to a new or existing project: vendors the method into `tools/anaxi`, writes `anaxi.json`, `anaxi-questions.md` and `@stack`, links the skill, installs the hook, builds the first index. Never overwrites | built |
| `tools/anaxi-render.mjs` | optional: composes several items into one document | not built: links and the index cover most needs |

Full command reference, grammar, rules and JSON: [tools/SPEC.md](tools/SPEC.md).

**Script or agent?** Scripts handle what can be computed from the marks: depth, targets, caps, references,
`later:` triggers, checklists, the index. The agent handles what needs the content read: are the questions
really answered (N05), over-engineering (N07), out of focus (N08), rescore (N12), question friction (N16),
canvas to promote (N17), and writing an item's own questions. The skill calls the scripts when they exist, so
the two never disagree on the structural part.

## 3. How documentation gets built

```
 write markdown, mark it up ──► anaxi-check (local, or via the skill) ──► nudges: deepen / stop / wait
           ▲                                                                       │
           └────────────────────────────── fix ◄───────────────────────────────────┘
                         │
                         ▼
 open PR  ──► anaxi-ci: check · INDEX.md regenerated · new nudges posted · gate for items to be built
                         │
                         ▼
 review   ──► reviewers read the doc itself, following links; INDEX.md for the big picture
              (or a rendered document, if they want one file)
                         │
                         ▼
 merge    ──► the docs are the source; INDEX.md is up to date
```

Day to day:

| When | Run | You get |
|---|---|---|
| starting a feature | copy [templates/TDD.md](templates/TDD.md) or [templates/item.md](templates/item.md), or ask the skill | an item with a target, and the questions for its next level |
| writing | `anaxi-check nudges @id` | what's missing, and when to stop |
| planning, stand-up | `anaxi-check status --focus now`, or read `INDEX.md` | gaps, blockers, and what is enough |
| before building | `anaxi-check gate @id` | ready or blocked, with reasons |
| onboarding, cross-team review | `INDEX.md`, then follow links | the whole project, one click from any item |

## 4. Moving around the docs: links, index, render

Three ways, each needing a little more tooling than the last. Use the first that's enough.

### 4.1 Links (no tools)

Every item links to what it uses (`uses: [@task-api](../shared/task-api.md)`) and mentions what it touches.
A person on GitHub, or an agent reading files, follows the links. Standard markdown links work everywhere,
which is why [FORMAT.md §3](FORMAT.md#3-references) recommends `[@id](path)`.

### 4.2 The index (`anaxi-check index`)

`INDEX.md` is the super-TDD's front page. It is plain markdown, generated and committed:

```markdown
# Design index · mobile profile · stage: pre-build

| | Item | Depth | Target | Uses | Used by | Open |
|---|---|---|---|---|---|---|
| ⛔ | [Recurring tasks](features/recurring-tasks.md) `@recurring` | D2 | D3 | [@task-api](shared/task-api.md), [@scheduler](shared/scheduler.md) | — | 2 |
| ⬇️ | [Scheduler](shared/scheduler.md) `@scheduler` | D2 | D3 | [@task-api](shared/task-api.md) | @recurring, @multi-calendar | 1 |
| 🎯 | [Task API](shared/task-api.md) `@task-api` | D3 | D3 | [@stack](shared/stack.md) | @recurring, @scheduler | 0 |

## Nudges
- ⛔ **Recurring tasks** uses @scheduler, which is at D2 of its target D3
- …
```

Sections: the table (shared items last), then the structural nudges, then everything in `later:`. An agent
asked about the project starts here, then opens only the files it needs. The index has no date in it, so the
same docs always give the same file, and a stale one can be detected.

#### Keeping `INDEX.md` fresh

A committed index is only useful if it's current. Use one or more of these; most teams want the first two:

| Way | Set up | What happens |
|---|---|---|
| **CI** (the safety net) | run `tools/anaxi/tools/anaxi-ci.sh` in your pipeline | the build fails when the docs have errors or `INDEX.md` doesn't match them. Add `--base origin/main` to print only the nudges this PR introduced |
| **Pre-commit hook** (no failed builds) | `cp tools/anaxi/tools/hooks/pre-commit .git/hooks/` (or add it to your hook manager) | on any commit touching markdown, the index is regenerated and staged with the commit |
| **The agent** | nothing: the skill does it | after changing marks, the agent runs `anaxi-check index` (procedure 5 and 7 in the skill). If the scripts aren't there, it edits `INDEX.md` by hand and says so |

A GitHub Actions job, for example:

```yaml
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- run: tools/anaxi/tools/anaxi-ci.sh --base origin/${{ github.base_ref }}
```

If none of these is in place, don't commit `INDEX.md`: generate it when you need it (`anaxi-check index`), or
read `anaxi-check status`.

### 4.3 A rendered document (`anaxi-render`, optional, not built yet)

For people who want one file to read, print or send:

| Selector | Roots |
|---|---|
| `@id` / `@a,@b` | one or several items |
| `--file 'docs/features/*.md'` · `--about data` · `--focus now` | items matching a file pattern, topic or focus |
| `--super` | every item |

From the roots it takes sub-items, then follows `uses:` references transitively (`--follow N` limits hops),
including each item **once**. `--at Dn` shows content up to level n, using the section mapping in
[FORMAT.md §4](FORMAT.md#4-what-level-a-piece-of-content-is-at). Sections it can't classify are always shown. The
canvas is included and labelled, unless `--no-canvas` is given.

Output order: status table → the roots, in document order, with badges → "depends on" (referenced items, each
before the items that use it) → open questions, caveats and later items → nudges. `@id` mentions become links
within the document, and each item links back to its source file. Formats: markdown (default), `--html` (one
self-contained page with a depth slider; the [Strata viewer](archive/strata-viewer.html) is a starting point),
`--json`.

## 5. Installing

```bash
path/to/anaxi/tools/anaxi-init.sh my-project --profile service --stage shaping
```

That vendors the method into `my-project/tools/anaxi/`, writes `anaxi.json`, `docs/anaxi-questions.md` and
`docs/shared/stack.md`, links the skill into `.claude/skills/`, installs the pre-commit hook (in a git repo) and
builds the first index. It works on an existing project and never overwrites a file; `--docs DIR` points it at
where your docs already are, `--no-vendor` uses `$ANAXI_HOME` instead of a copy. Add CI yourself (§4.2).

Packaging as an npm package and a Claude Code plugin is on the [roadmap](ROADMAP.md).

Upgrading the method means replacing the vendored folder (or bumping the submodule) and reading
[CHANGELOG.md](CHANGELOG.md). Project docs don't need to change: new marks and settings are always optional.
