#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit), never blocks the edit:
// - a code or config file that items list in `code:` (@code-map): once per file per session, tell Claude which items
//   it belongs to and to check the change against them. On by default; "hooks": { "codeMap": false } turns it off.
// - a markdown doc: the structural nudges for the items in it. Opt-in: "hooks": { "afterEdit": true }.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN_ROOT, input, project, quiet } from './lib.mjs';

quiet(async () => {
  const { cwd = process.cwd(), session_id: sid = 'none', tool_input: t = {} } = await input();
  const file = t.file_path || t.path;
  if (!file) return;
  const abs = path.resolve(cwd, file);
  // the design folder may not be above the file (docs/design vs src/): look from the file, then from the session
  const cfg = (await project(path.dirname(abs))) || (await project(cwd));
  if (!cfg) return;
  const { evaluate, fileReport } = await import(path.join(PLUGIN_ROOT, 'tools/lib/engine.mjs'));
  const rel = path.relative(cfg.root, abs).split(path.sep).join('/');
  const say = (text) => console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } }));

  if (!file.endsWith('.md')) {
    if (cfg.hooks?.codeMap === false) return;
    const seen = path.join(os.tmpdir(), `anaxi-codemap-${String(sid).replace(/[^\w-]/g, '')}.txt`);
    let done = ''; try { done = fs.readFileSync(seen, 'utf8'); } catch {}
    if (done.split('\n').includes(abs)) return;
    const items = fileReport(evaluate(cfg), rel, cwd);
    if (!items.length) return;
    fs.appendFileSync(seen, `${abs}\n`);
    say([`Anaxi: ${path.relative(cwd, abs)} is part of the design of ${items.map((x) => x.id).join(', ')}.`,
      ...items.map((x) => `- ${x.id} (${x.title}): ${x.shown || 'nothing'} of ${x.target || '—'}${x.built ? `, built ${x.built}` : ''}${x.drift ? ', its design changed after the code' : ''}${x.ready ? '' : x.plans ? ', not ready: it plans changes here, so keep this edit to what the built items need' : ', not ready to build'}; design: ${x.doc}${x.contract.length ? `, contract: ${x.contract.join(', ')}` : ''}`),
      'If this edit changes what one of them does, read it (anaxi_context) and check the change against it; update the design in the same change, or say why not.'].join('\n'));
    return;
  }

  if (cfg.hooks?.afterEdit !== true) return;
  const model = evaluate(cfg);
  const keys = new Set(model.items.filter((it) => it.file === rel || (it.parts || []).some((p) => p.file === rel)).map((it) => it.key));
  const errors = model.errors.filter((e) => e.startsWith(`${rel}:`));
  const list = model.nudges.filter((n) => keys.has(n.item) && n.code !== 'N04');
  if (!list.length && !errors.length) return;
  say([`Anaxi, after editing ${rel}:`, ...errors.map((e) => `error ${e}`),
    ...list.map((n) => `${n.code} ${n.severity} ${n.item}: ${n.message}`)].join('\n'));
});
