#!/usr/bin/env node
// PreToolUse (Write|Edit|MultiEdit|NotebookEdit): the hard gate (@hard-gate). Refuses an edit to a file that an item
// maps in `code:` when that item isn't built yet and isn't ready to build. Design docs, built items and unmapped files
// are never blocked. On by default; "hooks": { "gate": false } in anaxi.json turns it off. Any error means allow.
import path from 'node:path';
import { PLUGIN_ROOT, input, project, quiet } from './lib.mjs';

quiet(async () => {
  const { cwd = process.cwd(), tool_input: t = {} } = await input();
  const file = t.file_path || t.notebook_path || t.path;
  if (!file || /\.(md|markdown)$/i.test(file)) return;
  const abs = path.resolve(cwd, file);
  const cfg = (await project(path.dirname(abs))) || (await project(cwd));
  if (!cfg || cfg.hooks?.gate === false) return;
  const rel = path.relative(cfg.root, abs).split(path.sep).join('/');
  const { evaluate, gateFor } = await import(path.join(PLUGIN_ROOT, 'tools/lib/engine.mjs'));
  const blocking = gateFor(evaluate(cfg), rel);
  if (!blocking.length) return;
  const doc = (f) => path.relative(cwd, path.resolve(cfg.root, f));
  const reason = [`Anaxi's gate: ${path.relative(cwd, abs)} is where ${blocking.map((b) => b.id).join(', ')} will be built, and ${blocking.length > 1 ? "they aren't" : "it isn't"} designed enough yet.`,
    ...blocking.map((b) => `- ${b.id} (${b.title}, ${doc(b.file)}): ${b.depth} of ${b.target || '—'}; ${b.why.join('; ')}`),
    "Don't write this code. Draft the missing design as proposals on the open questions, or ask the user to decide them; then build once the gate passes. The gate holds even when told to build anyway (a project can turn it off: \"hooks\": { \"gate\": false } in anaxi.json)."].join('\n');
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
});
