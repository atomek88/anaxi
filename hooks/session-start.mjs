#!/usr/bin/env node
// SessionStart: in a project with anaxi.json, give Claude the status table (stdout becomes session context).
// Off with "hooks": { "sessionStart": false } in anaxi.json.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PLUGIN_ROOT, input, project, quiet, rememberHome } from './lib.mjs';

quiet(async () => {
  rememberHome();
  const { cwd = process.cwd() } = await input();
  const cfg = await project(cwd);
  if (!cfg || cfg.hooks?.sessionStart === false) return;
  const out = execFileSync('node', [path.join(PLUGIN_ROOT, 'tools/anaxi-check.mjs'), 'status', '--dir', cwd],
    { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
  const lines = out.split('\n');
  const shown = lines.length > 40 ? [...lines.slice(0, 40), `… ${lines.length - 40} more lines: run /anaxi:status`] : lines;
  console.log(`Anaxi project (design depth, from ${path.relative(cwd, cfg.file) || 'anaxi.json'}):\n${shown.join('\n')}\n` +
    'Use the anaxi skill before designing or building a marked item. Commands: /anaxi:status, /anaxi:assess <file|@id>, /anaxi:gate @id, /anaxi:watch, /anaxi:init. MCP tools: anaxi_context (what to read before building), anaxi_gate, anaxi_status.');
});
