---
anaxi: "@gate-everywhere"
depth: D3
risk: 2·1·1·0
about: [enforcement]
uses: ["@hard-gate", "@code-map", "@check"]
focus: now
built: no
code: [../../../tools/anaxi-check.mjs, ../../../tools/anaxi-ci.sh, ../../../tools/hooks/pre-commit, ../../../tools/anaxi-init.sh, ../../../tools/ci/]
---
# The gate everywhere (commit and merge)

**Why.** The hard gate is a Claude Code hook. Cursor, Codex and people editing by hand never meet it, and the
pre-commit hook only runs when markdown changes. A gate that one tool honours is advice for everyone else.

**What.** The rule is one function, `gateFor(model, file)`, asked at four moments: advice (the skill, NOT READY in
tool results), edit time (the Claude Code hook; other tools where they offer a pre-edit hook), commit time (every
commit, every tool on that machine, skipped only by `--no-verify`) and merge time (a pull request's required check:
everyone, every tool, lifted only with repo permissions). Code written against the gate can exist on a branch; it
can't land. Branches matching `gate.spikeBranches` (default `spike/*`) skip it, and can't merge into the main branch
with held files, so exploring stays free. Lifting it is a person's act at every layer: editing `anaxi.json`, or a
maintainer's override on the PR. Shared code a built item maps is never held (decided 2026-11-07, built in 0.11), and
a path a ready item plans is open to it. Done when a commit and a PR that add a file under an unready item's planned
`code:` both fail with the same reasons the hook gives, and a spike branch commits freely.

**Shape.** One command, `anaxi-check gate-files [--staged | --since <ref> | <files…>]`, exits 1 listing each held
file, its items and what's missing; it calls `gateFor` and nothing else, so it can't disagree with the hook. The
pre-commit hook runs it on staged non-markdown files on every commit; `anaxi-ci.sh --pr <base>` runs it on the files a
PR changes; `/anaxi:init --ci github` writes a workflow that does. Chosen over a server-side hook (not every forge
has one) and over checking in the editor only (the problem). The risky part is speed on every commit, so only
staged files that some item maps are checked, and the model is built once.

**Contract.** *Command.* `anaxi-check gate-files [--staged | --since REF | FILE…] [--json] [--dir DIR]`.
- Which files: `--staged` takes `git diff --cached --name-only --diff-filter=ACMR`; `--since` takes `git diff
  --name-only --diff-filter=ACMR REF...HEAD`. Markdown and `anaxi.json` are left out, because the hook's design
  checks cover them.
- Which design: with `--staged`, the docs are read from the index (`git show :path`), so an unstaged design edit
  can't pass a commit. Otherwise they're read from the working tree, which on a PR is the PR's head.
- How a file is judged: each file goes through `gateFor`, with nothing else added.
- No `anaxi.json`: exits 0 silently.

*Output.*
```
anaxi: 1 file is held by the gate
  src/recurring/rules.ts → @recurring (Recurring tasks, features/recurring-tasks.md): D2 of D3; 2 open questions
note: tools/lib/engine.mjs is shared code; @stages (not ready) plans changes here
→ Design it first (answer its questions, write its levels), or explore on a spike/ branch.
```
The `note:` lines are the shared-code plans, and they never fail. JSON: `{ "format": "anaxi/1", "held": [{ file,
items: [{ id, title, file, depth, target, why }] }], "notes": [{ file, items }], "skipped": null | "spike" |
"override" }`. Exit codes: 0 when nothing is held or the check is skipped, 1 when something is held, 2 for errors.
*Spike branches.* The branch comes from `GITHUB_HEAD_REF`, else `git rev-parse --abbrev-ref HEAD`.
- A branch matching `gate.spikeBranches` (default `["spike/*"]`) is skipped (`skipped: "spike"`). This applies to
  `--staged`, and to `--since` when the PR's base isn't one of `gate.mainBranches` (default `["main", "master"]`).
- A spike PR into a main branch is checked like any other.

*Override.* `ANAXI_OVERRIDE=1` or `true` exits 0. It still prints every held file, under `override: allowed by
ANAXI_OVERRIDE`. *Pre-commit*, on every commit and no longer only on markdown commits:
1. If markdown is staged, `anaxi-ci.sh --fix` runs as it does today.
2. `gate-files --staged` runs; a 1 fails the commit, ending `bypass: git commit --no-verify (the pull request check
   still runs)`.
3. The drift warning from @drift-both is printed.

Steps 2 and 3 share one model and take under 0.3 s for 200 items, checked by a self-test timing on a generated
project. *CI.* `anaxi-ci.sh --pr BASE` runs `check`, `index --check`, `gate-files --since BASE`, the same-change
check (@drift-both) and the decisions call-outs (@decided, warnings only); its exit code is the highest of them.
`/anaxi:init --ci github` (`anaxi-init.sh --ci github`) copies `tools/ci/github.yml` to
`.github/workflows/anaxi.yml`:
```yaml
name: anaxi
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: git clone --depth 1 --branch anaxi--v${{ vars.ANAXI_VERSION || 'X.Y.Z' }} https://github.com/atomek88/anaxi "$RUNNER_TEMP/anaxi"
      - run: '"$RUNNER_TEMP/anaxi/tools/anaxi-ci.sh" --pr "origin/${{ github.base_ref }}"'
        env:
          ANAXI_OVERRIDE: ${{ contains(github.event.pull_request.labels.*.name, 'anaxi: override') }}
```
Init fills `X.Y.Z` with its own version. A vendored `tools/anaxi` is used instead when present, and so is `npx
anaxi` once the package is published. Init prints how to make the `anaxi / gate` check required, because that's a
repo setting a person changes.

## Open questions

- [x] D1 · (decide: person) A feature that only changes existing shared code now holds nothing. Is a note enough? → decided: Tomasz Michalik 2026-11-07 (in session, recorded by the agent): yes: the code-map note at edit time (built) and one line in the pre-commit output; never a block, since blocking shared code is the freeze we just removed
- [x] D2 · (decide: person) Start the merge-time override with GitHub only? → decided: Tomasz Michalik 2026-11-07 (in session, recorded by the agent): yes, a PR label `anaxi: override` read from the event payload; any other CI sets `ANAXI_OVERRIDE=1`, so it can be wired anywhere
- [x] D2 · On a PR, is the design read from the PR itself or from the base branch? → decided: Claude (agent) 2026-11-09: from the PR, so design and code can land together; @decided calls out a PR that ticks a person's question itself
- [x] D2 · How fast must the pre-commit check be? → decided: Claude (agent) 2026-11-09: under 0.3 s for 200 items, measured by a self-test on a generated project
- [x] D2 · Adapters for other agent tools' pre-edit hooks? → decided: Claude (agent) 2026-11-09: not in this item; each tool's adapter is its own item, and commit and merge cover them meanwhile
- [x] D3 · The contract: `gate-files` output and exit codes, the workflow file, the override's exact form → decided: Claude (agent) 2026-11-09: written above
