#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): after Claude edits a markdown doc, tell it the structural nudges for the
// items in that file. Opt-in per project: "hooks": { "afterEdit": true } in anaxi.json. Never blocks the edit.
import path from 'node:path';
import { PLUGIN_ROOT, input, project, quiet } from './lib.mjs';

quiet(async () => {
  const { cwd = process.cwd(), tool_input: t = {} } = await input();
  const file = t.file_path || t.path;
  if (!file || !file.endsWith('.md')) return;
  const cfg = await project(path.dirname(path.resolve(cwd, file)));
  if (!cfg || cfg.hooks?.afterEdit !== true) return;
  const { evaluate } = await import(path.join(PLUGIN_ROOT, 'tools/lib/engine.mjs'));
  const model = evaluate(cfg);
  const rel = path.relative(cfg.root, path.resolve(cwd, file));
  const keys = new Set(model.items.filter((it) => it.file === rel || (it.parts || []).some((p) => p.file === rel)).map((it) => it.key));
  const errors = model.errors.filter((e) => e.startsWith(`${rel}:`));
  const list = model.nudges.filter((n) => keys.has(n.item) && n.code !== 'N04');
  if (!list.length && !errors.length) return;
  const text = [`Anaxi, after editing ${rel}:`, ...errors.map((e) => `error ${e}`),
    ...list.map((n) => `${n.code} ${n.severity} ${n.item}: ${n.message}`)].join('\n');
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } }));
});
