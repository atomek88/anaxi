#!/usr/bin/env node
// anaxi-mcp: the Anaxi engine as MCP tools for agents (ROADMAP step 4). Zero dependencies; JSON-RPC 2.0 over stdio.
//   node anaxi-mcp.mjs [--dir DIR]       the project: --dir, else $CLAUDE_PROJECT_DIR, else the current folder
// Every call re-reads the docs (≈0.1 s), so answers are always current. Read-only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, LV } from './lib/config.mjs';
import { evaluate, gate, dependents } from './lib/engine.mjs';
import { context } from './lib/read.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERSION = (() => { try { return JSON.parse(fs.readFileSync(path.join(HERE, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version; } catch { return '0'; } })();
const argDir = (() => { const i = process.argv.indexOf('--dir'); return i > 0 ? process.argv[i + 1] : null; })();
const projectDir = (dir) => path.resolve(dir || argDir || process.env.CLAUDE_PROJECT_DIR || process.cwd());

const DIR = { dir: { type: 'string', description: 'project folder (default: the session\'s project)' } };
const ID = { id: { type: 'string', description: 'the item: @id, a title, or a file path' } };
const TOOLS = [
  { name: 'anaxi_status', description: 'Every current design item with its depth, target, status (blocked, gap, enough…), open questions and dependencies, plus superseded/retired items and deleted ids. Call this first to see what is designed and what is ready.', inputSchema: { type: 'object', properties: { ...DIR } } },
  { name: 'anaxi_nudges', description: 'Structural nudges (what to do next) for one item, or for all items when id is omitted.', inputSchema: { type: 'object', properties: { ...ID, ...DIR } } },
  { name: 'anaxi_gate', description: 'Whether an item is designed enough to build (N09), and what blocks it. Check before implementing anything with a depth mark.', inputSchema: { type: 'object', properties: { ...ID, ...DIR }, required: ['id'] } },
  { name: 'anaxi_questions', description: 'The questions that apply to an item at each level (core, project and its own checklist), optionally for one level.', inputSchema: { type: 'object', properties: { ...ID, level: { type: 'string', description: 'e.g. D2' }, ...DIR }, required: ['id'] } },
  { name: 'anaxi_context', description: 'Exactly what to read before building or reviewing an item: its text up to a depth (default its target) plus each item it uses, transitively and once each, at the level needed, and the gate. Superseded items are replaced by their successor unless history is true. Use this instead of reading the design docs file by file.', inputSchema: { type: 'object', properties: { ...ID, at: { type: 'string', description: 'depth to read to, e.g. D2 (default: the item\'s target)' }, history: { type: 'boolean', description: 'read a superseded item itself, and decision logs' }, ...DIR }, required: ['id'] } },
  { name: 'anaxi_uses', description: 'What an item uses, and who uses it (transitively): the blast radius of changing it.', inputSchema: { type: 'object', properties: { ...ID, ...DIR }, required: ['id'] } },
];

function load(dir) {
  const cfg = loadConfig(projectDir(dir));
  if (!cfg.file) throw new Error(`no anaxi.json in ${projectDir(dir)} or above: not an Anaxi project (run /anaxi:init)`);
  return evaluate(cfg);
}
function find(model, q) {
  if (!q) throw new Error('id is required');
  const it = model.byId.get(q.startsWith('@') ? q : `@${q}`) || model.all.find((x) => x.title.toLowerCase() === String(q).toLowerCase()) || model.all.find((x) => x.file === q && !x.parent);
  if (!it) throw new Error(`no item "${q}"`);
  return it;
}
const brief = (it) => ({ id: it.id, title: it.title, file: it.file, line: it.line, depth: it.depth, shown: LV(it.depthN), target: LV(it.targetN), effective: LV(it.effectiveN),
  status: it.status, open: it.openList?.map((q) => (q.level ? `${q.level} · ${q.text}` : q.text)) || [], uses: it.uses.map((u) => u.item?.id || u.raw),
  ...(it.lifecycle && it.lifecycle !== 'current' ? { lifecycle: it.lifecycle, successor: it.successor?.id || null } : {}) });

const CALLS = {
  anaxi_status: (a) => { const m = load(a.dir); return { settings: { profile: m.cfg.profile, stage: m.cfg.stage }, items: m.items.map(brief), inactive: m.inactive.map(brief), deleted: [...m.retired.keys()], errors: m.errors }; },
  anaxi_nudges: (a) => { const m = load(a.dir); const key = a.id ? find(m, a.id).key : null; return { nudges: m.nudges.filter((n) => !key || n.item === key).map(({ code, severity, item, message, details }) => ({ code, severity, item, message, ...(details ? { details } : {}) })) }; },
  anaxi_gate: (a) => { const m = load(a.dir); const it = find(m, a.id); const g = gate(m, it); return { item: it.id || it.title, ready: g.ready, why: g.why }; },
  anaxi_questions: (a) => { const m = load(a.dir); const it = find(m, a.id); return { item: it.id, depth: it.depth, target: LV(it.targetN),
    questions: it.questions.filter((q) => !a.level || q.level === a.level).map((q) => ({ id: q.id, level: q.level, text: q.text, ...(q.skipped ? { skipped: q.skipped } : {}) })),
    own: it.checklist.filter((q) => !a.level || q.level === a.level).map((q) => ({ level: q.level, text: q.text, answered: q.checked, answer: q.answer })) }; },
  anaxi_context: (a) => { const m = load(a.dir); const it = find(m, a.id); const c = context(m, it, { at: a.at, history: !!a.history });
    const g = gate(m, it.successor && !a.history && it.lifecycle !== 'current' ? it.successor : it); return { ...c, gate: { ready: g.ready, why: g.why } }; },
  anaxi_uses: (a) => { const m = load(a.dir); const it = find(m, a.id); return { item: it.id, uses: it.uses.map((u) => ({ id: u.item?.id || u.raw, depth: u.item?.depth || null })),
    usedBy: dependents(m, it).map((d) => ({ id: d.item.id || d.item.title, hop: d.hop, depth: d.item.depth })) }; },
};

function handle(msg) {
  const { id, method, params = {} } = msg;
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  switch (method) {
    case 'initialize': return ok({ protocolVersion: params.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'anaxi', version: VERSION },
      instructions: 'Anaxi design-depth tools. Before implementing a design item, call anaxi_gate; to read what to build from, call anaxi_context instead of opening docs one by one.' });
    case 'ping': return ok({});
    case 'tools/list': return ok({ tools: TOOLS });
    case 'tools/call': {
      const fn = CALLS[params.name];
      if (!fn) return { jsonrpc: '2.0', id, error: { code: -32602, message: `unknown tool ${params.name}` } };
      try { return ok({ content: [{ type: 'text', text: JSON.stringify(fn(params.arguments || {}), null, 2) }] }); }
      catch (e) { return ok({ content: [{ type: 'text', text: `anaxi: ${e.message}` }], isError: true }); }
    }
    default: return id === undefined ? null : { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } };
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })}\n`); continue; }
    const res = handle(msg);
    if (res) process.stdout.write(`${JSON.stringify(res)}\n`);
  }
});
