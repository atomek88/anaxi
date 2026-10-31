#!/usr/bin/env node
// Self-test: the example project gives the expected statuses, and a broken project trips the checks.
//   node tools/selftest.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { evaluate, gate } from './lib/engine.mjs';
import { transition } from './lib/lifecycle.mjs';
import { blocks, visible, words, context } from './lib/read.mjs';
import { spawn, execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log(`FAIL ${msg}`); } };

// 1. the example
const ex = evaluate(loadConfig(path.join(HERE, '..', 'example')));
const st = Object.fromEntries(ex.items.map((it) => [it.key, it.status]));
const expect = { '@recurring': 'blocked', '@settings': 'trim', '@multi-calendar': 'later', '@scheduler': 'gap',
  '@task-api': 'enough', '@stack': 'enough' };
for (const [id, s] of Object.entries(expect)) ok(st[id] === s, `example ${id}: expected ${s}, got ${st[id]}`);
ok(ex.errors.length === 0, `example has no errors (${ex.errors.join('; ')})`);
ok(gate(ex, ex.byId.get('@task-api')).ready, 'gate @task-api is ready');
ok(!gate(ex, ex.byId.get('@recurring')).ready, 'gate @recurring is blocked');
ok(!gate(ex, ex.byId.get('@multi-calendar')).ready, 'gate @multi-calendar uses the full target');
ok(ex.byId.get('@recurring').openList.length === 2, '@recurring has 2 open (checklist; canvas ignored)');
ok(ex.byId.get('@recurring').sections.find((s) => s.heading === 'Appendix: sketches')?.level === 'canvas', 'appendix is canvas');
ok(ex.byId.get('@recurring').sections.find((s) => s.heading === 'Rule grammar')?.level === 'D2', 'Rule grammar inherits D2');
ok(ex.items.some((it) => it.parent && it.title === 'Upgrade policy'), 'badge sub-item found');

// 2. a broken project
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anaxi-'));
fs.writeFileSync(path.join(dir, 'anaxi.json'), '{ "stage": "shaping" }');
fs.writeFileSync(path.join(dir, 'anaxi-questions.md'), '## Changes to core\n- skip-all: D2.decisions\n- reword: D1.nope → x\n');
fs.writeFileSync(path.join(dir, 'a.md'), [
  '## A', '> @a · depth: D1 → D3 · risk: 0·0·0·0 · uses: @missing, @b (D3) · skip: D1.touches · later: x (when @b reaches D1)',
  '## B', '> @b · depth: D2 · risk: 1·1·1·1',
  '## C', '> @a · depth: D7',
  '## D', '> @d · depth: D1',
  '## Loose', 'word '.repeat(100),
].join('\n'));
const br = evaluate(loadConfig(dir));
const has = (re) => br.errors.some((e) => re.test(e));
ok(has(/@a is also declared/), 'duplicate id');
ok(has(/can't read depth/), 'bad depth');
ok(has(/@missing.*doesn't exist/), 'dangling uses');
ok(has(/skip D1.touches needs a reason/), 'skip without reason');
ok(has(/skip-all: D2.decisions needs a reason/), 'skip-all without reason');
ok(has(/D1.nope.*not a core question/), 'reword of unknown question');
ok(br.warnings.some((w) => /risk gives D1, but the depth says D3/.test(w)), 'risk vs written target');
const codes = (key) => br.nudges.filter((n) => n.item === key).map((n) => n.code);
ok(codes('@b').includes('N06') === false && br.byId.get('@b').targetN === 3, '@b raised to D3 by uses (D3)');
ok(br.byId.get('@b').effectiveN === 2, 'stage shaping caps @b at D2');
ok(codes('@a').includes('N02'), '@a blocked by @b');
ok(codes('@a').includes('N10'), 'later trigger met');
ok(codes('@d').includes('N14'), 'no target');
ok(br.nudges.some((n) => n.code === 'N13'), 'untagged heading');
fs.writeFileSync(path.join(dir, 'b.md'), '---\nanaxi: "@e"\ndepth: D0\nrisk: 1·1·1·1\n---\n# E\n## Context and goals\n<!-- D0: notes -->\n## Non-goals\n');
ok(evaluate(loadConfig(dir)).nudges.some((n) => n.item === '@e' && n.code === 'N05' && n.empty), 'empty D0 sections → N05');
// 3. a project's own ladder: rename D2, drop D4, risk totals that gave D4 now give the top level
const own = fs.mkdtempSync(path.join(os.tmpdir(), 'anaxi-'));
fs.writeFileSync(path.join(own, 'anaxi.json'), JSON.stringify({ levels: { D2: { name: 'Design' }, D4: null } }));
fs.writeFileSync(path.join(own, 'a.md'), '## Big\n> @big · depth: D1 · risk: 2·2·1·1\n## Odd\n> @odd · depth: D4\n');
const om = evaluate(loadConfig(own));
ok(om.cfg.levels.D2.name === 'Design' && om.cfg.levels.D2.done && !om.cfg.levels.D4, 'own ladder: rename keeps done-when, D4 dropped');
ok(om.byId.get('@big').targetN === 3, 'own ladder: risk 6 → top level D3');
ok(!om.questions.list.some((q) => q.level === 'D4'), 'own ladder: D4 questions gone');
ok(om.errors.some((e) => /"D4": this project's levels are D0–D3/.test(e)), 'own ladder: D4 is an error');
ok(evaluate(loadConfig(dir)).cfg.levels.D4, 'default ladder restored for the next project');
fs.rmSync(own, { recursive: true });

// 4. parts: detail kept in another file or an appendix counts as the host item's own
const pd = fs.mkdtempSync(path.join(os.tmpdir(), 'anaxi-'));
fs.writeFileSync(path.join(pd, 'anaxi.json'), '{}');
fs.writeFileSync(path.join(pd, 'tdd.md'), '---\nanaxi: "@pay"\ndepth: D3\nrisk: 2·2·0·0\n---\n# Pay\n## Context\nWhy text.\n## Requirements\nWhat text.\n## Design\nShape text.\n');
fs.writeFileSync(path.join(pd, 'APPENDIX.md'), '# Appendix\n\n## Pay: API `D3`\n> part-of: @pay\n\nContract text.\n- [ ] D3 · Which currency rounding?\n### Errors\nFailure text.\n\n## Ghost\n> part-of: @nobody\n');
const pm = evaluate(loadConfig(pd));
const pay = pm.byId.get('@pay');
ok(pay.parts?.length === 1 && pay.parts[0].file === 'APPENDIX.md' && pay.parts[0].anchor === 'pay-api-d3', 'part listed on its host');
ok(pay.sections.some((s) => s.heading === 'Pay: API' && s.level === 'D3' && s.file === 'APPENDIX.md')
  && pay.sections.some((s) => s.heading === 'Errors' && s.level === 'D3'), 'part sections count for the host');
ok(pay.openList.some((q) => /currency rounding/.test(q.text)), 'part checklist counts for the host');
ok(pm.errors.some((e) => /part-of @nobody, which doesn't exist/.test(e)), 'part of a missing item');
ok(!pm.items.some((it) => it.partOf), 'parts are not items');
fs.rmSync(pd, { recursive: true });

// ignore globs, and a folder with its own anaxi.json is a separate project
const ig = fs.mkdtempSync(path.join(os.tmpdir(), 'anaxi-'));
fs.writeFileSync(path.join(ig, 'anaxi.json'), '{ "ignore": ["templates/**"] }');
for (const d of ['templates', 'sub']) fs.mkdirSync(path.join(ig, d));
fs.writeFileSync(path.join(ig, 'templates', 't.md'), '---\nanaxi: "@tpl"\ndepth: D0\n---\n# T\n');
fs.writeFileSync(path.join(ig, 'sub', 'anaxi.json'), '{}');
fs.writeFileSync(path.join(ig, 'sub', 's.md'), '---\nanaxi: "@sub"\ndepth: D0\n---\n# S\n');
fs.writeFileSync(path.join(ig, 'a.md'), '---\nanaxi: "@a"\ndepth: D0\n---\n# A\n');
const igm = evaluate(loadConfig(ig));
ok(igm.byId.has('@a') && !igm.byId.has('@tpl'), 'ignore skips matching files');
ok(!igm.byId.has('@sub') && evaluate(loadConfig(path.join(ig, 'sub'))).byId.has('@sub'), 'a nested anaxi.json is its own project');
fs.rmSync(ig, { recursive: true });

// levels are cumulative: a claim counts only up to the first level with nothing written (N05), content past it is N06
const ev = fs.mkdtempSync(path.join(os.tmpdir(), 'anaxi-'));
const ten = 'one two three four five six seven eight nine ten';
fs.writeFileSync(path.join(ev, 'anaxi.json'), '{}');
fs.writeFileSync(path.join(ev, 'gap.md'), `---\nanaxi: "@gap"\ndepth: D3\nrisk: 1·1·1·1\n---\n# Gap\n**Why.** ${ten}\n\n**What.** ${ten}\n\n**Contract.** ${ten}\n`);
fs.writeFileSync(path.join(ev, 'full.md'), `---\nanaxi: "@full"\ndepth: D1\nrisk: 0·0·1·0\n---\n# Full\n**Why.** ${ten}\n\n**What.** ${ten}\n\n**Shape.** ${ten}\n`);
fs.writeFileSync(path.join(ev, 'thin.md'), `---\nanaxi: "@thin"\ndepth: D1\nrisk: 0·0·1·0\n---\n# Thin\n**Why.** too short\n\n**What.** ${ten}\n`);
fs.writeFileSync(path.join(ev, 'meta.md'), `---\nanaxi: "@meta"\ndepth: D2\nrisk: 1·1·1·1\n---\n# Meta\nA paragraph that starts with \`**Why.**\`, \`**What.**\` or \`**Shape.**\` sets its level; ${ten}\n`);
fs.writeFileSync(path.join(ev, 'note.md'), `---\nanaxi: "@note"\ndepth: D1\nrisk: 0·0·1·0\n---\n# Note\n<!-- D0 -->\n${ten}\n\n<!-- D1 -->\n${ten}\n\n<!-- canvas -->\n${ten}\n`);
fs.writeFileSync(path.join(ev, 'host.md'), `---\nanaxi: "@host"\ndepth: D3\nrisk: 2·1·1·0\n---\n# The \`host\` tool \`D3\`\n**Why.** ${ten}\n\n**What.** ${ten}\n\n**Shape.** ${ten}\n`);
fs.writeFileSync(path.join(ev, 'ref.md'), `# Reference\n<!-- anaxi: part-of: @host -->\n<!-- D3 -->\n\n## 1. One\n${ten}\n\n### 1.1 Deeper\n${ten}\n`);
fs.writeFileSync(path.join(ev, 'plain.md'), `---\nanaxi: "@plain"\ndepth: D2\nrisk: 1·1·1·1\n---\n# Plain\n${ten}\n`);
let evm = evaluate(loadConfig(ev));
const gp = evm.byId.get('@gap'), ncodes = (id) => evm.nudges.filter((n) => n.item === id).map((n) => n.code);
ok(gp.claimedN === 3 && gp.depthN === 1 && gp.deepestN === 3, `evidence: D3 claimed with D2 empty counts as D1 (${gp.depthN})`);
ok(evm.nudges.some((n) => n.item === '@gap' && n.code === 'N05' && /D2 has nothing written: it shows D1/.test(n.message)), 'evidence: N05 names the empty level');
ok(!gate(evm, gp).ready && /D1 \(claims D3\)/.test(gate(evm, gp).why.join(' ')), 'evidence: the gate uses what the text shows');
ok(evm.byId.get('@thin').depthN === -1 && ncodes('@thin').includes('N05'), 'evidence: a D0 under the minimum shows nothing');
ok(ncodes('@full').includes('N22') && ncodes('@full').includes('N06'), 'evidence: content past the claim is a hint (N22), and past the target over-documented (N06)');
ok(String(evm.byId.get('@note').levelWords) === '10,10,0,0,0', `evidence: <!-- Dn --> comments set levels, <!-- canvas --> counts for nothing (${evm.byId.get('@note').levelWords})`);
ok(evm.byId.get('@host').shownN === 3 && evm.byId.get('@host').levelWords[3] === 20, `evidence: a level comment under a part's heading covers its subsections (${evm.byId.get('@host').levelWords})`);
ok(evm.byId.get('@host').title === 'The host tool', `parse: inline code stays in a title, badges go (${evm.byId.get('@host').title})`);
ok(evm.byId.get('@meta').shownN == null, 'evidence: lead-ins quoted in inline code set no level');
ok(evm.byId.get('@plain').shownN == null && !ncodes('@plain').includes('N05'), 'evidence: a doc with no level markers is not measured');
fs.writeFileSync(path.join(ev, 'anaxi.json'), '{ "nudges": { "levelWords": 0 } }');
evm = evaluate(loadConfig(ev));
ok(evm.byId.get('@gap').depthN === 3 && !ncodes('@gap').includes('N05'), 'evidence: levelWords 0 turns the check off');
fs.rmSync(ev, { recursive: true });
const ar = fs.mkdtempSync(path.join(os.tmpdir(), 'anaxi-'));
fs.writeFileSync(path.join(ar, 'anaxi.json'), '{ "docs": ["docs/**/*.md"] }');
fs.mkdirSync(path.join(ar, 'archive')); fs.mkdirSync(path.join(ar, 'docs'));
fs.writeFileSync(path.join(ar, 'archive', 'old.md'), `# Old notes\n${'word '.repeat(120)}\n`);
fs.writeFileSync(path.join(ar, 'docs', 'new.md'), `# New notes\n${'word '.repeat(120)}\n`);
const arn = evaluate(loadConfig(ar)).nudges.filter((n) => n.code === 'N13').map((n) => n.message.match(/\((.*?):/)[1]);
ok(arn.join() === 'docs/new.md', `untagged: old notes in the archive are not nudged (${arn})`);
fs.rmSync(ar, { recursive: true });
ok(ex.byId.get('@settings').depthN === 1 && ex.byId.get('@settings').status === 'trim', 'example: @settings claims D4 but shows D1, and is still over-documented');

// lifecycle: the example's archived item, and the marks, nudges and transitions (FORMAT.md §10)
const old = ex.byId.get('@polling-sync');
ok(old?.lifecycle === 'archived' && old.successor?.id === '@scheduler' && !ex.items.includes(old), 'example: archived item, not counted, successor found');
ok(ex.retired.has('@email-digest'), 'example: RETIRED.md read');
ok(ex.byId.get('@task-api').sections.some((s) => s.heading === 'Decision log' && s.level === 'history'), 'example: a decision log section is history');
ok(!gate(ex, old).ready && /gate @scheduler instead/.test(gate(ex, old).why[0]), 'gate on a superseded item points to its successor');
const lc = fs.mkdtempSync(path.join(os.tmpdir(), 'anaxi-'));
fs.writeFileSync(path.join(lc, 'anaxi.json'), '{}');
fs.mkdirSync(path.join(lc, 'f'));
const A = '---\nanaxi: "@a"\ndepth: D1\nrisk: 0·0·0·0\n---\n# A\n## Context\nSee [b](b.md).\n';
const B = '# B\n\n## B item\n> @b · depth: D1 · risk: 0·0·0·0\n\nWhy. Uses [a](a.md).\n';
const U = '## User\n<!-- anaxi: @u · depth: D1 · risk: 0·0·0·0 · uses: @a -->\n\nText.\n';
const put = () => { fs.writeFileSync(path.join(lc, 'f', 'a.md'), A); fs.writeFileSync(path.join(lc, 'f', 'b.md'), B); fs.writeFileSync(path.join(lc, 'u.md'), U); };
const read = (f) => fs.readFileSync(path.join(lc, f), 'utf8');
const m = () => evaluate(loadConfig(lc));
put();
transition(m(), 'supersede', { item: m().byId.get('@a'), by: m().byId.get('@b'), why: 'b is simpler' });
let lm = m();
ok(lm.byId.get('@a').lifecycle === 'superseded' && lm.byId.get('@b').supersedes.includes('@a'), 'supersede marks both sides');
ok(lm.nudges.some((n) => n.code === 'N18' && n.item === '@u' && /point it at @b/.test(n.message)), 'N18: using a superseded item');
ok(!gate(lm, lm.byId.get('@u')).ready, 'gate: using a superseded item blocks');
transition(lm, 'archive', { item: lm.byId.get('@a') });
ok(fs.existsSync(path.join(lc, 'archive', 'a.md')) && /\]\(\.\.\/archive\/a\.md\)/.test(read('f/b.md')) && /\]\(\.\.\/f\/b\.md\)/.test(read('archive/a.md')), 'archive moves the file and fixes links both ways');
transition(m(), 'restore', { item: m().byId.get('@a') });
ok(read('f/a.md') === A && read('f/b.md') === B && read('u.md') === U, 'restore undoes supersede and archive exactly');
transition(m(), 'retire', { item: m().byId.get('@u'), why: 'cut', date: '2026-01-02' });
ok(m().byId.get('@u').lifecycle === 'retired' && /retired: 2026-01-02 \(cut\)/.test(read('u.md')), 'retire marks a comment-declared item');
transition(m(), 'restore', { item: m().byId.get('@u') });
ok(read('u.md') === U, 'restore undoes retire');
fs.writeFileSync(path.join(lc, 'f', 'b.md'), B.replace('· risk', '· superseded-by: @a · risk'));
ok(m().nudges.some((n) => n.code === 'N19' && n.item === '@b'), "N19: one side says superseded-by, the other doesn't say supersedes");
put();
transition(m(), 'archive', { item: m().byId.get('@a'), why: 'cut' });
transition(m(), 'delete', { item: m().byId.get('@a'), force: true });
lm = m();
ok(!fs.existsSync(path.join(lc, 'archive', 'a.md')) && lm.retired.has('@a'), 'delete removes the file and keeps the id in RETIRED.md');
fs.writeFileSync(path.join(lc, 'f', 'a.md'), A);
ok(m().nudges.some((n) => n.code === 'N21' && n.item === '@a'), 'N21: a deleted id used again');
fs.rmSync(lc, { recursive: true });
fs.rmSync(dir, { recursive: true });

// reading at a depth (tools/lib/read.mjs): levels from headings and lead-ins, deeper never shows less, nothing lost
for (const it of ex.all) {
  const bs = blocks(ex, it), w = [0, 1, 2, 3, 4].map((d) => words(bs.filter((b) => visible(b, d))));
  ok(w.every((x, i) => !i || x >= w[i - 1]), `read: ${it.id || it.title} shows more at each depth (${w.join('/')})`);
  ok(words(bs.filter((b) => visible(b, 4, { canvas: true, history: true }))) === words(bs.filter((b) => b.kind !== 'mark')), `read: ${it.id || it.title} loses no text`);
}
const settings = blocks(ex, ex.byId.get('@settings'));
ok(settings.some((b) => b.level === 'D0' && /^\*\*Why/.test(b.text[0])) && settings.some((b) => b.level === 'D1' && /^\*\*What/.test(b.text[0])), 'read: a paragraph with two lead-ins is split into two levels');
ok(!blocks(ex, ex.byId.get('@recurring')).some((b) => b.kind === 'para' && /^day; deleting/.test(b.text[0])), 'read: a wrapped list item stays in its item');
ok(blocks(ex, ex.byId.get('@recurring')).some((b) => b.file === 'features/APPENDIX.md' && b.level === 'D3'), 'read: parts are read inline, at their level');
const cx = context(ex, ex.byId.get('@polling-sync'));
ok(cx.item.id === '@scheduler' && /successor/.test(cx.note), 'context: a superseded item is replaced by its successor');
ok(context(ex, ex.byId.get('@polling-sync'), { history: true }).item.id === '@polling-sync', 'context: history reads the old item itself');
const rc = context(ex, ex.byId.get('@recurring'), { at: 'D1' });
ok(rc.item.at === 'D1' && rc.uses.map((u) => u.id).sort().join() === '@scheduler,@stack,@task-api' && rc.item.words < context(ex, ex.byId.get('@recurring')).item.words, 'context: the item at a depth, plus each use once');

// the MCP server answers over stdio, and the reader serves the model (both from the example)
const mcp = execFileSync('node', [path.join(HERE, 'anaxi-mcp.mjs'), '--dir', path.join(HERE, '..', 'example')], { encoding: 'utf8', input: [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'anaxi_gate', arguments: { id: '@recurring' } } },
  { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'anaxi_gate', arguments: { id: '@nope' } } }].map((m) => JSON.stringify(m)).join('\n') + '\n' })
  .trim().split('\n').map((l) => JSON.parse(l));
ok(mcp.length === 4 && mcp[0].result.serverInfo.name === 'anaxi', 'mcp: initialize (and no reply to a notification)');
ok(mcp[1].result.tools.some((t) => t.name === 'anaxi_context'), 'mcp: tools/list has anaxi_context');
ok(JSON.parse(mcp[2].result.content[0].text).ready === false, 'mcp: anaxi_gate answers');
ok(mcp[3].result.isError && /no item/.test(mcp[3].result.content[0].text), 'mcp: a bad id is a tool error, not a crash');
const mx = fs.mkdtempSync(path.join(os.tmpdir(), 'anaxi-'));
fs.cpSync(path.join(HERE, '..', 'example'), mx, { recursive: true });
const good = fs.readFileSync(path.join(mx, 'INDEX.md'), 'utf8');
fs.writeFileSync(path.join(mx, 'INDEX.md'), 'edited by hand\n');
const mcall = (args) => JSON.parse(JSON.parse(execFileSync('node', [path.join(HERE, 'anaxi-mcp.mjs'), '--dir', mx], { encoding: 'utf8', input: `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'anaxi_index', arguments: args } })}\n` })).result.content[0].text);
ok(mcall({ check: true }).stale && !mcall({ check: true }).wrote && fs.readFileSync(path.join(mx, 'INDEX.md'), 'utf8') !== good, 'mcp: anaxi_index check reports a stale index and writes nothing');
ok(mcall({}).wrote && fs.readFileSync(path.join(mx, 'INDEX.md'), 'utf8') === good && !mcall({}).stale, 'mcp: anaxi_index regenerates the index');
fs.rmSync(mx, { recursive: true });
const watch = spawn('node', [path.join(HERE, 'anaxi-watch.mjs'), '--dir', path.join(HERE, '..', 'example'), '--port', '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
const url = await new Promise((res) => { let out = ''; watch.stdout.on('data', (d) => { out += d; const m = out.match(/http:\/\/[^\s]+/); if (m) res(m[0]); }); setTimeout(() => res(null), 5000); });
const api = url && await fetch(`${url}api/model`).then((r) => r.json()).catch(() => null);
ok(api?.items?.length === ex.items.length && api.items.every((i) => Array.isArray(i.blocks)) && api.inactive.some((i) => i.id === '@polling-sync'), 'watch: /api/model serves the items with their blocks');
ok(url && (await fetch(url).then((r) => r.text())).includes('/app.js'), 'watch: serves the reader page');
const rel = (k) => api.items.concat(api.inactive).find((i) => i.key === k).related;
ok(rel('@scheduler').some((r) => r.key === '@recurring' && r.kind === 'used-by' && r.blocked) && rel('@recurring').some((r) => r.key === '@scheduler' && r.kind === 'uses' && r.level === 'D3'), 'watch: uses and used-by, both ways, with the level needed and whether it blocks');
ok(rel('@multi-calendar').some((r) => r.key === '@settings' && r.kind === 'mentions') && rel('@settings').some((r) => r.key === '@multi-calendar' && r.kind === 'mentioned-by'), 'watch: an @id in the text is a mention, both ways');
ok(rel('@polling-sync').some((r) => r.key === '@scheduler' && r.kind === 'superseded-by'), 'watch: superseded-by is a relation');
ok(api.files.includes('features/APPENDIX.md'), 'watch: the file list includes part files');
const role = (k) => api.items.find((i) => i.key === k).role;
ok(role('@stack') === 'foundation' && role('@task-api') === 'shared' && role('@recurring') === 'feature', 'watch: roles from the shared folder: foundation (uses nothing), shared, feature');
watch.kill();

console.log(fails ? `${fails} failed` : 'selftest ok');
process.exit(fails ? 1 : 0);
