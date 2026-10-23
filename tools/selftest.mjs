#!/usr/bin/env node
// Self-test: the example project gives the expected statuses, and a broken project trips the checks.
//   node tools/selftest.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { evaluate, gate } from './lib/engine.mjs';

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
fs.rmSync(dir, { recursive: true });

console.log(fails ? `${fails} failed` : 'selftest ok');
process.exit(fails ? 1 : 0);
