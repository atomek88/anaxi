---
anaxi: "@gate-everywhere"
depth: D3
risk: 2·1·1·0
about: [enforcement]
uses: ["@hard-gate", "@code-map", "@check"]
focus: now
built: yes (2026-11-09)
code: [../../../tools/anaxi-check.mjs, ../../../tools/hooks/pre-commit, ../../../tools/lib/engine.mjs]
---
# The gate everywhere (at commit, through git)

**Why.** The hard gate is a Claude Code hook. Cursor, Codex and people editing by hand never meet it, and the
pre-commit hook only runs when markdown changes. A gate that one tool honours is advice for everyone else.

**What.** The rule is one function, `gateFor(model, file)`, asked at three moments:
- advice: the skill, and NOT READY in tool results;
- edit time: the Claude Code hook, and other tools where they offer a pre-edit hook;
- commit time: every commit, from every tool and person on that machine. **It warns by default and doesn't stop the
  commit** (decided 2026-11-09): `gate.commit` is `"warn"`, and a team that wants it to stop commits sets `"block"`.
  It's silent unless a staged file is held, and it adds nothing to the commit.

Anaxi uses git: its history, its index and its local hooks. It isn't part of any pull-request or merge process.
Decided 2026-11-09: no PR checks, no merge gate, no CI workflow, no forge integration. A team that wants a server-side
check can run the same command there itself, but Anaxi doesn't design for it.

Branches matching `gate.spikeBranches` (default `spike/*`) skip the commit check, so exploring stays free. With `"block"`, lifting
it is a person's act: editing `anaxi.json`, or `git commit --no-verify`. Shared code a built item maps is never
held (decided 2026-11-07, built in 0.11), and a path a ready item plans is open to it. Done when a commit that adds a
file under an unready item's planned `code:` warns (or, with `"block"`, fails) with the same reasons the hook gives, and a spike branch commits
freely.

**Shape.** One command, `anaxi-check gate-files [--staged | FILE…]`, exits 1 listing each held file, its items and
what's missing. It calls `gateFor` and nothing else, so it can't disagree with the hook. The pre-commit hook runs it
on staged non-markdown files on every commit. Chosen over checking in the editor only, which was the problem. The
risky part is speed on every commit, so only staged files that some item maps are checked, and the model is built
once.

**Contract.** *Command.* `anaxi-check gate-files [--staged | FILE…] [--json] [--dir DIR]`.
- Which files: `--staged` takes `git diff --cached --name-only --diff-filter=ACMR`. Markdown and `anaxi.json` are
  left out, because the hook's design checks cover them.
- Which design: with `--staged`, the docs are read from the index (`git show :path`), so an unstaged design edit
  can't pass a commit. Otherwise they're read from the working tree.
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
items: [{ id, title, file, depth, target, why }] }], "notes": [{ file, items }], "skipped": null | "spike" }`. Exit
codes with `--staged`: per `gate.commit` (`warn`, the default: prints and exits 0; `block`: 1 when something is held;
`off`: silent, 0). With explicit files: 1 when something is held. 2 for errors. *Spike branches.*
`git rev-parse --abbrev-ref HEAD` matching `gate.spikeBranches` is skipped (`skipped: "spike"`).
*Pre-commit*, on every commit and no longer only on markdown commits:
1. If markdown is staged, `anaxi-ci.sh --fix` runs as it does today.
2. `gate-files --staged` runs on commits with code: silent when nothing is held; a warning by default; with
   `"block"`, a 1 fails the commit, ending `bypass: git commit --no-verify`.
3. With `"drift": true` only, the drift warning from @drift-both is printed (when it's built).

Step 2 reads only docs with unstaged changes from the index, so it takes about 0.3 s for 200 items (a self-test fails past
1.5 s). `anaxi-init.sh` already installs the hook; nothing else is installed.

## Open questions

- [x] D1 · (decide: person) Should the commit check stop commits? → decided: Tomasz Michalik 2026-11-09 (in session: "I'm not sure we should force stop at every commit, this will bloat our commits", recorded by the agent): no, it warns by default (`gate.commit: "warn"`), silent unless a staged file is held; `"block"` is opt-in

- [x] D1 · (decide: person) A feature that only changes existing shared code now holds nothing. Is a note enough? → decided: Tomasz Michalik 2026-11-07 (in session, recorded by the agent): yes: the code-map note at edit time (built) and one line in the pre-commit output; never a block, since blocking shared code is the freeze we just removed
- [x] D1 · (decide: person) Is Anaxi part of the pull-request and merge process? → decided: Tomasz Michalik 2026-11-09 (in session: "we don't need this to be a part of pr process, this is not what we want with anaxi", recorded by the agent): no; Anaxi uses git (history, index, local hooks) and stops at the commit. This replaces the 2026-11-07 answer on a GitHub-label merge override, and the PR questions with it
- [x] D2 · How fast must the pre-commit check be? → decided: Claude (agent) 2026-11-09: under 0.3 s for 200 items, measured by a self-test on a generated project
- [x] D2 · Adapters for other agent tools' pre-edit hooks? → decided: Claude (agent) 2026-11-09: not in this item; each tool's adapter is its own item, and the commit check covers them meanwhile
- [x] D3 · The contract: `gate-files` output and exit codes, the pre-commit steps → decided: Claude (agent) 2026-11-09: written above
