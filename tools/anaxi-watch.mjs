#!/usr/bin/env node
// anaxi-watch: a read-only local reader for the design docs (ROADMAP step 3). Zero dependencies, Node 18+.
//   node anaxi-watch.mjs [--dir DIR] [--port 4321] [--host 127.0.0.1]
// Serves the reader (overview → topic → item pages with a depth control, and a 2D map) and reloads it when a doc is
// saved. It never writes: edit the docs in your editor, or with an agent.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, LV, LEVELS } from './lib/config.mjs';
import { evaluate, gate } from './lib/engine.mjs';
import { blocks } from './lib/read.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const dir = path.resolve(opt('dir', process.cwd()));
const port = Number(opt('port', 4321)), host = opt('host', '127.0.0.1');

let state = { version: 0, json: null, model: null, error: null };
function build() {
  try {
    const cfg = loadConfig(dir);
    const model = evaluate(cfg);
    const item = (it) => ({ key: it.key, id: it.id, title: it.title, file: it.file, line: it.line, declared: it.declared,
      parent: it.parent?.key || null, depth: it.depth, shown: LV(it.depthN), levelWords: it.levelWords, minWords: it.minWords, target: LV(it.targetN), effective: LV(it.effectiveN), status: it.status,
      risk: it.risk, about: it.about, focus: it.focus || 'now', caveats: it.caveats, later: it.later.map((l) => l.text),
      uses: it.uses.map((u) => ({ key: u.item?.key || null, raw: u.raw, level: u.level, actual: u.item ? LV(u.item.depthN) : null, required: u.level || LV(u.item?.targetN) })),
      parts: it.parts || [], open: it.openList || [], lifecycle: it.lifecycle, supersededBy: it.supersededBy, supersedes: it.supersedes,
      retired: it.retired, successor: it.successor?.key || null, gate: gate(model, it),
      blocks: blocks(model, it).map(({ kind, level, text, file, line, depth, lead, part }) => ({ kind, level, text, file, line, depth, lead, part })) });
    state = { version: state.version + 1, model, error: null, json: JSON.stringify({
      format: 'anaxi/1', root: path.basename(cfg.root), config: cfg.file ? path.relative(cfg.root, cfg.file) : null,
      settings: { profile: cfg.profile, stage: cfg.stage }, levels: LEVELS.map((l) => ({ id: l, ...(cfg.levels[l] || {}) })),
      items: model.items.map(item), inactive: model.inactive.map(item), deleted: [...model.retired].map(([id, r]) => ({ id, ...r })),
      nudges: model.nudges.map(({ code, severity, item: k, message }) => ({ code, severity, item: k, message })), errors: model.errors,
      version: state.version + 1 }) };
  } catch (e) { state = { ...state, version: state.version + 1, error: e.message }; }
}
build();

const clients = new Set();
let timer = null;
const watched = state.model?.cfg.root || dir;
try {
  fs.watch(watched, { recursive: true }, (_, f) => {
    if (!f || !String(f).endsWith('.md') && !String(f).endsWith('anaxi.json')) return;
    clearTimeout(timer);
    timer = setTimeout(() => { build(); for (const c of clients) c.write(`event: change\ndata: ${state.version}\n\n`); }, 120);
  });
} catch (e) { console.error(`anaxi-watch: can't watch ${watched} (${e.message}); reload the page by hand`); }

const STATIC = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/app.css': ['app.css', 'text/css'] };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  if (url.pathname === '/api/model') {
    if (state.error && !state.json) { res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: state.error })); return; }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(state.error ? state.json.replace(/"errors":\[/, `"errors":[${JSON.stringify(`reload failed: ${state.error}`)},`) : state.json);
    return;
  }
  if (url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(`event: hello\ndata: ${state.version}\n\n`);
    clients.add(res); req.on('close', () => clients.delete(res));
    return;
  }
  const s = STATIC[url.pathname];
  if (!s) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': `${s[1]}; charset=utf-8`, 'cache-control': 'no-store' }).end(fs.readFileSync(path.join(HERE, 'watch', s[0])));
});
server.listen(port, host, () => {
  const a = server.address();
  console.log(`anaxi watch: http://${host === '0.0.0.0' ? 'localhost' : host}:${a.port}/  (${state.model ? `${state.model.items.length} items in ${state.model.cfg.root}` : state.error})`);
  console.log('Read-only; it reloads when a doc is saved. Ctrl-C to stop.');
});
export { server };
