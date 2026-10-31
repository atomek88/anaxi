#!/usr/bin/env node
// anaxi-check: structural checks for Anaxi-marked docs. Zero dependencies, Node 18+. Spec: tools/SPEC.md.
//
//   anaxi-check status    [--focus now|next|later] [--about T] [--json]
//   anaxi-check nudges    [@id | --all] [--diff BASE] [--json]     exit 1 when any nudge blocks
//   anaxi-check gate      @id                                      exit 0 ready · 1 not ready
//   anaxi-check questions @id [--level Dn]  |  --repeated  |  --skips
//   anaxi-check uses      @id
//   anaxi-check index     [--out FILE] [--check | --path]          --check: exit 1 if stale · --path: print where it goes
//   anaxi-check check                                              exit 2 on errors
//   anaxi-check new       NAME [--title T] [--small] [--in DIR]    a new TDD from the template, filled in
//   anaxi-check supersede @old --by @new [--why W]                 mark both sides
//   anaxi-check retire    @id --why W [--date YYYY-MM-DD]          dropped, nothing replaces it
//   anaxi-check archive   @id [--why W]                            move a whole-file item to the archive, fix links
//   anaxi-check restore   @id                                      back to current (and out of the archive)
//   anaxi-check delete    @id [--force]                            remove an archived file; RETIRED.md keeps its id
//   (the five lifecycle commands take --dry-run)
//   anaxi-check context   @id [--at Dn] [--history] [--json]       the item at a depth + what it uses, for building
//
// Every command takes --dir DIR (default: the current folder); anaxi.json is found by searching upward.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadConfig, globRe, LV, lv, top as topLevel, METHOD_DIR } from './lib/config.mjs';
import { evaluate, gate, dependents, icon, targetText, renderIndex, lifeText, builtText, usesBuilt } from './lib/engine.mjs';
import { transition } from './lib/lifecycle.mjs';
import { context, outline } from './lib/read.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith('--') ? argv.shift() : 'status';
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--json', '--all', '--check', '--path', '--repeated', '--skips', '--small', '--force', '--dry-run', '--history'].includes(argv[i - 1])));

function die(msg, code = 2) { console.error(`anaxi-check: ${msg}`); process.exit(code); }

let cfg, model;
try {
  cfg = loadConfig(opt('dir') || process.cwd());
  model = evaluate(cfg);
} catch (e) { die(e.message); }

const name = (it) => it.id || `"${it.title}"`;
const find = (q) => {
  if (!q) die(`${cmd} needs an item: @id, a title, or a file`);
  const it = model.byId.get(q.startsWith('@') ? q : `@${q}`)
    || model.all.find((x) => x.title.toLowerCase() === q.toLowerCase())
    || model.all.find((x) => x.file === q && !x.parent);
  if (!it) die(`no item "${q}"`);
  return it;
};
const pad = (s, n) => { s = String(s); const w = [...s].length; return w >= n ? s : s + ' '.repeat(n - w); };
const json = (o) => console.log(JSON.stringify(o, null, 2));
const itemJson = (it) => ({
  id: it.id, title: it.title, file: it.file, line: it.line, declared: it.declared, parent: it.parent?.key || null,
  depth: it.depth, shown: LV(it.depthN), levelWords: it.levelWords, target: LV(it.targetN), effective: LV(it.effectiveN), targetFrom: it.targetSrc, status: it.status,
  risk: it.risk, about: it.about, focus: it.focus || 'now', parts: it.parts || [],
  uses: it.uses.map((u) => ({ id: u.item ? u.item.key : null, raw: u.raw, path: u.item?.file || u.path, required: u.level || LV(u.item?.targetN), actual: u.item ? LV(u.item.depthN) : null })),
  open: it.openList, caveats: it.caveats, later: it.later.map((l) => ({ text: l.text, trigger: l.trigger ? { id: l.trigger.id, level: l.trigger.level } : null })),
  skip: it.skip, sections: it.sections, lifecycle: it.lifecycle,
  supersededBy: it.supersededBy, supersedes: it.supersedes, retired: it.retired, successor: it.successor?.key || null,
  ...(it.built ? { built: it.built } : {}), ...(it.builtChecked ? { builtChecked: it.builtChecked } : {}), ...(it.code?.length ? { code: it.codePaths } : {}), ...(it.builtParts ? { builtParts: it.builtParts } : {}), ...(it.drift ? { drift: it.drift } : {}),
});
// "D1 (D4?)": the text shows D1 of a claimed D4 (N05)
const depthText = (it) => (!it.depth ? '—' : it.depthN < it.claimedN ? `${it.depthN < 0 ? '—' : LV(it.depthN)} (${it.depth}?)` : it.depth);
const header = () => `${cfg.profile} profile · stage: ${cfg.stage} · ${model.items.length} items · ${cfg.file ? path.relative(process.cwd(), cfg.file) || 'anaxi.json' : 'no anaxi.json (defaults)'}`;

// Human output: colour on a terminal (off with NO_COLOR or when piped), wrapped to the window.
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint(1), dim = paint(2), red = paint(31), yellow = paint(33), green = paint(32), cyan = paint(36);
const SEV = { block: red, warn: yellow, info: dim };
const LABEL = { N05: 'not written', N01: 'go deeper', N02: 'blocked', N03: 'open', N04: 'enough', N06: 'trim', N22: 'claims less', N10: 'revisit', N13: 'untagged',
  N14: 'no target', N15: 'dangling' };
const WIDTH = Math.min(process.stdout.columns || 100, 110);
function wrap(text, indent, first = indent) {
  const words = String(text).split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const lead = lines.length ? indent : first;
    if (cur && lead + [...cur].length + 1 + [...w].length > WIDTH) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  lines.push(cur);
  return lines.map((l, i) => ' '.repeat(i ? indent : first) + l).join('\n');
}

function nextStep(it, mine) {
  const has = (c, sev) => mine.find((n) => n.code === c && (!sev || n.severity === sev));
  const steps = [];
  if (it.placeholders?.length) steps.push(`fill in the template: ${it.placeholders.join(', ')}`);
  if (mine.some((n) => n.empty)) steps.push(`write the why and the non-goals${it.risk?.every((x) => x === 0) ? ', and score the risk factors' : ''}`);
  if (has('N14')) steps.push('score its risk so it gets a target, or write depth: Dn → Dt');
  if (has('N15')) steps.push('fix the reference, or create the shared item at D0');
  const ns = mine.find((n) => n.code === 'N05' && n.missing);
  if (ns) steps.push(ns.lower ? `lower the claim to depth: ${ns.shown}` : `write ${ns.missing[0]}, or lower the claim to ${ns.shown || 'D0'}`);
  const b = has('N02', 'block');
  if (b) steps.push(`wait for ${b.uses}, or help take it deeper`);
  if (has('N03')) steps.push('answer the open questions, or move them to later: with a trigger');
  const g = has('N01');
  if (g) steps.push(`write the ${g.next} answers under your own headings, then set depth: ${g.next}`);
  if (has('N06')) steps.push('stop writing; trim back to the target, or re-score if the risk is higher');
  if (!steps.length && has('N04')) steps.push('stop: this is designed enough');
  return steps.slice(0, 2).join('; then ');
}

function printNudges(list) {
  const groups = [];
  for (const n of list) {
    const g = groups.at(-1);
    if (g && g.key === n.item) g.list.push(n); else groups.push({ key: n.item, list: [n] });
  }
  for (const g of groups) {
    const it = model.all.find((x) => x.key === g.key);
    if (it) {
      console.log(`\n${icon(it.status)}  ${bold(name(it))}  ${it.title}`);
      console.log(dim(`    ${it.file}:${it.line} · depth ${depthText(it)} · target ${targetText(it)}${it.risk ? ` · risk ${it.risk.join('·')}` : ''}${it.parts ? ` · parts in ${[...new Set(it.parts.map((p) => p.file))].join(', ')}` : ''}`));
    } else console.log(`\n${bold('Untagged headings')}`);
    for (const n of g.list) {
      const word = n.code === 'N02' && n.severity === 'info' ? (n.uses ? 'waits on' : 'waited on') : LABEL[n.code] || n.code;
      const label = (SEV[n.severity] || dim)(pad(word, 11));
      const text = !n.details?.length ? `${n.message} ${dim(`(${n.code})`)}`
        : n.code === 'N03' ? `${n.details.length} to answer ${dim('(N03)')}:`
          : n.empty ? `${n.message}. Answer these first ${dim('(N05)')}:`
          : `${n.message.split('. ')[0]}. Answer these for ${n.next} ${dim('(N01)')}:`;
      console.log(`    ${label} ${wrap(text, 16, 16).slice(16)}`);
      for (const d of n.details || []) console.log(wrap(`• ${d}`, 18, 16));
    }
    if (it) { const s = nextStep(it, g.list); if (s) console.log(wrap(cyan(`→ Next: ${s}.`), 6, 4)); }
  }
}

function nudgesAt(base) {
  const prefix = execFileSync('git', ['-C', cfg.root, 'rev-parse', '--show-prefix'], { encoding: 'utf8' }).trim();
  const res = (Array.isArray(cfg.docs) ? cfg.docs : [cfg.docs]).map(globRe);
  const files = execFileSync('git', ['-C', cfg.root, 'ls-tree', '-r', '--name-only', base, '--', '.'], { encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('.md') && res.some((r) => r.test(f)) && f !== cfg.index && f !== cfg.questions);
  const read = (rel) => execFileSync('git', ['-C', cfg.root, 'show', `${base}:${prefix}${rel}`], { encoding: 'utf8' });
  return evaluate(cfg, { read, files }).nudges;
}

switch (cmd) {
  case 'status': {
    let items = model.items;
    if (opt('focus')) items = items.filter((it) => (it.focus || 'now') === opt('focus'));
    if (opt('about')) items = items.filter((it) => it.about.includes(opt('about')));
    if (flag('json')) {
      json({ format: 'anaxi/1', settings: { profile: cfg.profile, stage: cfg.stage }, items: items.map(itemJson), nudges: model.nudges,
        inactive: model.inactive.map(itemJson), deleted: [...model.retired].map(([id, r]) => ({ id, ...r })) });
      break;
    }
    console.log(header());
    const B = usesBuilt(model.all);
    console.log(`\n   ${pad('Item', 34)} ${pad('Depth', 8)} ${pad('Target', 12)} ${B ? `${pad('Built', 6)} ` : ''}${pad('Open', 5)} Uses`);
    for (const it of items) {
      const title = `${it.parent ? '↳ ' : ''}${it.id ? it.id + ' ' : ''}${it.title}`;
      console.log(`${pad(icon(it.status), 3)}${pad(title.slice(0, 33), 34)} ${pad(depthText(it), 8)} ${pad(targetText(it), 12)} ${B ? `${pad(builtText(it) || '—', 6)} ` : ''}${pad(it.openList.length, 5)} ${it.uses.map((u) => (u.item ? name(u.item) : u.raw)).join(' ')}`);
    }
    if (items.some((it) => it.depthN < it.claimedN)) console.log(dim('\nD1 (D4?): the text shows D1 of the D4 it claims; levels count only up to the first one with nothing written (N05)'));
    const past = model.inactive.filter((it) => !it.parent || it.parent.lifecycle === 'current');
    if (past.length && flag('all')) {
      console.log('');
      for (const it of past) console.log(`${pad(icon(it.lifecycle), 3)}${pad(`${it.id ? it.id + ' ' : ''}${it.title}`.slice(0, 33), 34)} ${lifeText(it)}${it.successor ? ` → ${name(it.successor)}` : ''}`);
    } else if (past.length) console.log(dim(`\n${past.length} superseded, retired or archived (not counted): ${past.map(name).join(', ')} · --all lists them`));
    const skipped = model.questions.list.filter((q) => q.skippedAll);
    for (const q of skipped) console.log(`\nskip-all ${q.id}: ${q.skippedAll}`);
    if (model.errors.length) console.log(`\n${model.errors.length} error(s): run \`anaxi-check check\``);
    break;
  }

  case 'nudges': {
    const target = positional[0];
    let list = target && !flag('all') ? model.nudges.filter((n) => n.item === find(target).key) : model.nudges;
    if (opt('diff')) {
      let before;
      try { before = nudgesAt(opt('diff')); } catch (e) { die(`--diff: ${e.message.split('\n')[0]}`); }
      const seen = new Set(before.map((n) => `${n.code}|${n.item}|${n.message}`));
      list = list.filter((n) => !seen.has(`${n.code}|${n.item}|${n.message}`));
    }
    if (flag('json')) json({ format: 'anaxi/1', nudges: list });
    else if (!list.length) console.log(opt('diff') ? 'No new nudges.' : 'No nudges.');
    else printNudges(list);
    process.exitCode = list.some((n) => n.severity === 'block') ? 1 : 0;
    break;
  }

  case 'gate': {
    const it = find(positional[0]);
    const g = gate(model, it);
    if (flag('json')) json({ format: 'anaxi/1', item: it.key, ready: g.ready, why: g.why });
    else console.log(g.ready ? `N09 READY    ${name(it)} — ${LV(it.depthN)} 🎯, nothing open, every use deep enough`
      : `N09 BLOCKED  ${name(it)} — ${g.why.join(' · ')}`);
    process.exitCode = g.ready ? 0 : 1;
    break;
  }

  case 'questions': {
    if (flag('repeated') || flag('skips')) {
      const groups = new Map();
      for (const it of model.items) {
        const keys = flag('repeated')
          ? it.checklist.map((q) => [q.text.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim(), q.text])
          : it.skip.map((s) => [`${s.id} (${(s.reason || '').toLowerCase()})`, `${s.id} (${s.reason})`]);
        for (const [k, label] of keys) { if (!groups.has(k)) groups.set(k, { label, items: [] }); groups.get(k).items.push(name(it)); }
      }
      const hits = [...groups.values()].filter((g) => g.items.length > 1);
      if (!hits.length) console.log(flag('repeated') ? 'No question repeats across items.' : 'No skip repeats across items.');
      for (const g of hits) console.log(`${g.items.length}× ${g.label}\n   ${g.items.join(', ')}`);
      break;
    }
    const it = find(positional[0]);
    const only = opt('level');
    const top = Math.max(it.targetN ?? topLevel(), it.depthN ?? 0);
    console.log(`${name(it)} — ${it.title} · depth ${it.depth} · target ${targetText(it)}`);
    for (let n = 0; n <= top; n++) {
      const L = LV(n);
      if (only && only !== L) continue;
      const qs = it.questions.filter((q) => q.level === L);
      const own = it.checklist.filter((q) => q.level === L || (q.level == null && n === Math.min((it.depthN ?? -1) + 1, topLevel())));
      if (!qs.length && !own.length) continue;
      const def = cfg.levels[L] || {};
      console.log(`\n${L}${def.name ? ` ${def.name}` : ''}${n <= (it.depthN ?? -1) ? ' (claimed)' : n <= (it.effectiveN ?? -1) ? ' (needed now)' : ''}${def.done ? dim(` · done when ${def.done}`) : ''}`);
      for (const q of qs) console.log(`  ${pad(q.id, 18)} ${q.skipped ? `[skipped: ${q.skipped}] ` : ''}${q.optional ? '[opt] ' : ''}${q.text}${q.source === 'project' ? '  · project' : ''}`);
      for (const q of own) console.log(`  ${pad(q.checked ? '[x] item' : '[ ] item', 18)} ${q.text}${q.answer ? ` → ${q.answer}` : ''}`);
    }
    const skipped = model.questions.list.filter((q) => q.skippedAll);
    if (skipped.length) console.log(`\nskipped project-wide: ${skipped.map((q) => q.id).join(', ')}`);
    console.log('\nWhether each one is answered needs reading: ask the skill (procedure 4), or a reviewer.');
    break;
  }

  case 'outline': {
    const it = find(positional[0]);
    const o = outline(model, it, { at: opt('at') });
    if (flag('json')) { json({ item: it.id || it.title, outline: o }); break; }
    console.log(`${name(it)} — ${it.title} · ${depthText(it)} of ${targetText(it)}`);
    for (const e of o) console.log(`  ${pad(e.level || '·', 8)} ${pad(e.label.slice(0, 34), 35)} ${pad(`${e.words}w`, 6)} ${dim(`${e.file}:${e.line}`)}${e.first ? `\n${' '.repeat(11)}${dim(e.first)}` : ''}`);
    break;
  }

  case 'uses': {
    const it = find(positional[0]);
    console.log(`${name(it)} uses: ${it.uses.map((u) => (u.item ? `${name(u.item)} (${u.item.depth})` : u.raw)).join(', ') || 'nothing'}`);
    const deps = dependents(model, it);
    console.log(`used by${deps.length ? '' : ': nobody'}`);
    for (const d of deps) console.log(`  ${'  '.repeat(d.hop - 1)}${name(d.item)} — ${d.item.title} (${d.item.depth}, focus ${d.item.focus || 'now'})`);
    break;
  }

  case 'index': {
    const out = opt('out') || cfg.index;
    const file = path.resolve(cfg.root, out);
    if (flag('path')) { console.log(file); break; }
    const text = renderIndex(model, path.posix.normalize(path.relative(cfg.root, file).split(path.sep).join('/')));
    if (flag('check')) {
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (current === text) console.log(`${out} is up to date.`);
      else { console.error(`${out} is stale. Run: anaxi-check index`); process.exitCode = 1; }
      break;
    }
    fs.writeFileSync(file, text);
    console.log(`wrote ${path.relative(process.cwd(), file)} (${model.items.length} items, ${model.nudges.filter((n) => n.code !== 'N04').length} nudges)`);
    break;
  }

  case 'check': {
    for (const e of model.errors) console.log(`error   ${e}`);
    for (const w of model.warnings) console.log(`warning ${w}`);
    for (const it of model.items) if (it.depth && lv(it.depth) < 0) console.log(`error   ${it.file}:${it.line}: bad depth`);
    if (!model.errors.length && !model.warnings.length) console.log(`ok · ${header()}`);
    process.exitCode = model.errors.length ? 2 : 0;
    break;
  }

  case 'new': {
    const slugName = positional[0];
    if (!slugName || !/^[a-z0-9][a-z0-9-]*$/.test(slugName)) die('new needs a name in lower-case-with-dashes, e.g. anaxi-check new recurring-tasks');
    if (model.byId.has(`@${slugName}`)) die(`@${slugName} already exists in ${model.byId.get(`@${slugName}`).file}`);
    const title = opt('title') || slugName.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
    const dir = opt('in') || path.posix.join(path.posix.dirname(cfg.questions || 'docs/x'), 'features');
    const rel = path.posix.join(dir, `${slugName}.md`);
    const file = path.join(cfg.root, rel);
    if (fs.existsSync(file)) die(`${rel} already exists`);
    let text = fs.readFileSync(path.join(METHOD_DIR, 'templates', flag('small') ? 'item.md' : 'TDD.md'), 'utf8')
      .replace(/"@your-id"/g, `"@${slugName}"`).replace(/@your-id/g, `@${slugName}`)
      .replace(/^# Title$/m, `# ${title}`).replace(/^## Item title$/m, `## ${title}`)
      .replace(/^- \[ \] D1 · (Open question )?…$/m, '<!-- - [ ] D3 · a question you can\'t answer yet -->');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    console.log(`created ${rel} (@${slugName})`);
    console.log(`\nNext:\n  1. Write the why (Context and goals, Non-goals) and score the four risk factors in the front matter.\n  2. Run: anaxi-check nudges @${slugName}   (or ask Claude: "assess ${rel} with anaxi")`);
    break;
  }

  case 'context': {
    const it = find(positional[0]);
    if (opt('at') && lv(opt('at')) < 0) die(`--at ${opt('at')}: this project's levels are ${LV(0)}–${LV(topLevel())}`);
    const c = context(model, it, { at: opt('at'), history: flag('history') });
    c.gate = gate(model, it.successor && !flag('history') && it.lifecycle !== 'current' ? it.successor : it);
    if (flag('json')) { json(c); break; }
    const head = (x) => `# ${x.id || x.title} · ${x.title} · read at ${x.at} (depth ${x.shown && x.shown !== x.depth ? `${x.shown}, claims ${x.depth}` : x.depth || '—'}, target ${x.target || '—'}) · ${x.file}:${x.line}`;
    if (c.note) console.log(`> ${c.note}\n`);
    console.log(`${head(c.item)}\n\n${c.item.markdown}`);
    for (const u of c.uses) console.log(`\n---\n\n${head(u)} · used by ${u.via}${u.replaces ? ` (replaces ${u.replaces})` : ''}\n\n${u.markdown}`);
    console.log(`\n---\n${c.gate.ready ? 'N09 READY' : `N09 BLOCKED: ${c.gate.why.join(' · ')}`}`);
    break;
  }

  case 'supersede': case 'retire': case 'archive': case 'restore': case 'delete': {
    try {
      const r = transition(model, cmd, { item: find(positional[0]), by: opt('by') && find(opt('by')), why: opt('why'),
        date: opt('date'), force: flag('force'), dryRun: flag('dry-run') });
      for (const line of r.log) console.log(line);
      if (!flag('dry-run')) console.log(dim('\nRegenerate the index: anaxi-check index (the pre-commit hook does it too)'));
    } catch (e) { die(e.message); }
    break;
  }

  default:
    die(`unknown command "${cmd}". Commands: status, nudges, gate, questions, uses, index, check, new, context, supersede, retire, archive, restore, delete`);
}
