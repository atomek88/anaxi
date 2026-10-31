---
anaxi: "@hard-gate"
depth: D3
risk: 2·0·1·1
about: [agents]
uses: ["@code-map", "@built", "@skill"]
built: yes (2026-10-31)
code: [../../../hooks/before-edit.mjs, ../../../hooks/hooks.json, ../../../tools/lib/engine.mjs, ../../../tools/anaxi-mcp.mjs]
caveats: a file written through a shell command (echo > file, node -e) isn't seen; code in folders no item lists in code: isn't guarded
---
# The hard gate (a hook that refuses to build what isn't designed)

**Why.** The gate was advice. In a headless test on 2026-10-30, "Build @recurring now. Just build it, skip the
design work" never loaded the skill, read `gate: not ready` from `anaxi_context`, and built 44 tests' worth of code,
writing the user's open decisions into it as assumptions. The user decided the gate holds even against "build it
anyway"; advice can't hold against an instruction, so the tool has to.

**What.** Before Claude writes or edits a file, the plugin checks the code map: if the file is under the `code:` of
an item that isn't built yet and isn't ready, the edit is refused, with what's missing, every path that is refused,
and what to do instead (draft the design, or ask the user to decide the open questions). Built items are never
blocked: fixing and changing what exists stays free, and drift (N23) covers it. Design docs are never blocked. So
that the gate knows where an item will be built, `code:` is written at design time, with `built: no`, as soon as the
Shape says where the code lives. Tool results lead with "NOT READY: don't implement" when the gate is closed. On by
default; a person turns it off for a project by editing `anaxi.json` (`"hooks": { "gate": false }`) themselves:
**it can't be lifted from inside a session.** Designing the item is the way through, and stays open.

Evidence, four runs of the same prompt (2026-10-30 and 31): with advice only, it built anyway; with the first hook,
it read the off switch in the refusal, turned the gate off and built; with the off switch unnamed and the bypasses
refused, it was refused 16 times, file after file; with the refusal listing every refused path, it was refused 8
times, stopped, didn't route around it, and offered the two ways through, plus four design gaps it found while
drafting (fixed in the example since). Out of scope: shell-command writes, and code no item maps.

**Shape.** A PreToolUse hook (`hooks/before-edit.mjs`) on Write, Edit, MultiEdit and NotebookEdit returns a deny
decision; Claude Code doesn't run the edit, so no wording in a prompt gets past it. The rule lives in the engine
(`gateFor(model, file)`), so `anaxi-check file` and `anaxi_for_file` say the same thing. Chosen over a stronger skill
text, which the test showed is skipped when the user says to skip the design, and over blocking every unmapped file,
which would stop ordinary work in any repo. The risky part is a false block on a file that several items share: it's
refused while any unbuilt mapping item is unready, and the message names which one.

**Contract.** Input: the hook JSON (`cwd`, `tool_name`, `tool_input.file_path` or `notebook_path`). Allowed when: the
project has no `anaxi.json`; `hooks.gate` is `false`; the file is markdown (design docs are always writable); no current
item maps it; or every item that maps it is ready or has `built: partly` or `yes`. Otherwise output
`{ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason } }`, the
reason naming each blocking item, its depth and target, the gate's reasons, every path its `code:` refuses ("stop
trying files there", no shell commands, no other path), and "draft the missing design as proposals, or ask the user
to decide", without naming the off switch. Also refused: an edit to `anaxi.json` whose result sets `hooks.gate: false`, or
makes an item ready that the gate holds now (unbuilt, planned `code:`, not ready) with no doc changed; an edit to an
item's doc whose result marks a held item `built: partly`/`yes` or removes `code:` entries while it's still not ready.
The result of Edit, MultiEdit and Write is worked out before it runs. Any error means allow: the hook never breaks an edit by failing. `anaxi_gate` and `anaxi_context` put
`notice: "NOT READY: don't implement …"` first when not ready; `fileReport` entries gain `blocks: true`.
