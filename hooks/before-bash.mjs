#!/usr/bin/env node
// PreToolUse (Bash): `anaxi-check decide` records a person's answer (@decided), so an agent doesn't run it. The person
// runs it themselves (typed after `!` in Claude Code, which no hook sees). Any error means allow.
import path from 'node:path';
import { input, project, quiet } from './lib.mjs';

quiet(async () => {
  const { cwd = process.cwd(), tool_input: t = {} } = await input();
  if (!/anaxi-check(\.mjs)?["']?\s+decide\b/.test(t.command || '')) return;
  const cfg = await project(cwd);
  if (!cfg || cfg.hooks?.gate === false) return;
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason:
    `Anaxi: \`anaxi-check decide\` records a person's answer, so it's theirs to run. Put your answer on the question as → proposed: …, and ask the user; they can type the same command after ! to run it as themselves (${path.relative(cwd, cfg.file) || 'anaxi.json'}).` } }));
});
