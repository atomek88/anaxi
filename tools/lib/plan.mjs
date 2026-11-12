// Build plans (@plan): the work for some ready items, in its own markdown files beside the design, never in it.
// A plan is the tracker: slices, tasks and gate breakpoints, ticked as the code lands. This file parses plans for the
// engine (progress per item, N30, N31) and writes a plan's skeleton from the model (`anaxi-check plan new`).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { LV } from './config.mjs';
import { parseFrontMatter } from './parse.mjs';
import { blocks } from './read.mjs';

export const planDir = (cfg) => path.posix.normalize(cfg.plan?.dir || 'plans');

const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const SLICE = /^##\s+Slice\s+[\w.]+\s*·?\s*(.*)$/i;

/** One plan file: { name, file, status, made, items, title, slices: [{ title, item, done, total, gates }], done, total }. */
export function parsePlan(text, file) {
  const lines = text.split('\n');
  let body = 0, fm = {};
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (end > 0) { fm = parseFrontMatter(lines.slice(1, end)); body = end + 1; }
  }
  const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const plan = { name: fm.plan || path.basename(file, '.md'), file, status: fm.status || 'active', made: fm.made || null,
    items: list(fm.items), title: null, slices: [], done: 0, total: 0, gates: { done: 0, total: 0 } };
  let slice = null, inFence = false;
  for (let i = body; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(```|~~~)/.test(l)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (!plan.title && /^#\s+/.test(l)) { plan.title = l.replace(/^#\s+/, '').trim(); continue; }
    if (/^##\s/.test(l)) {
      const m = l.match(SLICE);
      slice = m ? { title: l.replace(/^##\s+/, '').trim(), item: (m[1].match(/@[\w-]+/) || [null])[0], line: i + 1, done: 0, total: 0, gates: { done: 0, total: 0 } } : null;
      if (slice) plan.slices.push(slice);
      continue;
    }
    const t = l.match(TASK);
    if (!t) continue;
    const done = t[1] !== ' ', gate = t[2].startsWith('🛑');
    for (const c of [plan, slice].filter(Boolean)) {
      c.total++; if (done) c.done++;
      if (gate) { c.gates.total++; if (done) c.gates.done++; }
    }
  }
  return plan;
}

/** Every plan in the plans folder, newest file first. */
export function readPlans(cfg) {
  const dir = path.join(cfg.root, planDir(cfg));
  let names;
  try { names = fs.readdirSync(dir).filter((f) => f.endsWith('.md')); } catch { return []; }
  return names.sort().reverse().map((f) => {
    const rel = path.posix.join(planDir(cfg), f);
    return parsePlan(fs.readFileSync(path.join(cfg.root, rel), 'utf8'), rel);
  });
}

/** Per item in a plan that isn't dropped: its slices' ticks. Several plans: the newest active one wins. */
export function itemProgress(plans) {
  const out = new Map();
  for (const p of plans) {
    if (p.status === 'dropped') continue;
    for (const s of p.slices) {
      if (!s.item) continue;
      const cur = out.get(s.item);
      if (cur && cur.name !== p.name) { if (cur.status === 'active' || p.status !== 'active') continue; out.delete(s.item); }
      const e = out.get(s.item) || { name: p.name, file: p.file, status: p.status, done: 0, total: 0 };
      e.done += s.done; e.total += s.total;
      out.set(s.item, e);
    }
  }
  return out;
}

/** N30 (a finished plan, an item in it not built) and N31 (an item's design changed since the plan was made). */
export function planNudges(model, add) {
  const { cfg } = model;
  const run = (args) => execFileSync('git', args, { cwd: cfg.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  for (const p of model.plans || []) {
    if (p.status === 'dropped') continue;
    const finished = p.status === 'done' || (p.total > 0 && p.done === p.total);
    for (const id of new Set([...p.items, ...p.slices.map((s) => s.item).filter(Boolean)])) {
      const it = model.byId.get(id);
      if (!it || it.lifecycle !== 'current') continue;
      if (finished && it.built !== 'yes') add('N30', 'info', it, `plan "${p.name}" is ${p.status === 'done' ? 'done' : 'all ticked'}, but ${id} isn't built: yes. If every criterion holds, set built: yes (a person or the building agent)`, { plan: p.file });
      if (p.status !== 'active' || !p.made || !model.clock) continue;
      let n = 0;
      try { n = Number(run(['rev-list', '--count', `${p.made}..HEAD`, '--', it.file, ...(it.parts || []).map((x) => x.file)]).trim()) || 0; } catch { continue; }
      if (n) add('N31', 'info', it, `its design changed in ${n} commit${n > 1 ? 's' : ''} since plan "${p.name}" was made (${p.made}): check the plan still fits`, { plan: p.file });
    }
  }
}

// ------------------------------------------------------------------ the skeleton (anaxi-check plan new)

const BADGE = ['①', '①', '②', '②', '③', '③', '④', '⑤', '⑤'];
/** Difficulty from the risk factors (0–2 each): ① routine … ⑤ expert. */
export const difficulty = (it) => (it.risk ? BADGE[Math.min(8, it.risk.reduce((a, b) => a + b, 0))] : '');
const MITIGATE = { // a step per risk factor scored 2
  blast: 'Contain the blast radius: a flag or a staged rollout, and a way to turn it off',
  reversibility: 'Make it reversible: a down migration or a kill switch, written before the change',
  novelty: 'Spike first, time-boxed: prove the unfamiliar part before building on it',
  certainty: 'Check the assumption it rests on before building on it',
};

/** An item's acceptance criteria: its D1 bullets (not the ones that only name an item it uses), and its "Acceptance:"
 *  and "Done when …" sentences, wherever they are. */
export function criteria(model, it) {
  let bs; try { bs = blocks(model, it); } catch { return []; }
  const parse = (t) => {
    const id = (t.match(/\{#([\w-]+)\}/) || [])[1] || null, checks = (t.match(/→\s*checks:\s*(\S+)/) || [])[1] || null;
    return { text: t.replace(/\{#[\w-]+\}/, '').replace(/→\s*checks:.*$/, '').replace(/^(Acceptance|Done when)[:\s]\s*/i, '').replace(/\s+/g, ' ').trim().replace(/\.$/, ''), id, checks };
  };
  const bullets = bs.filter((b) => b.level === 'D1' && b.kind === 'list')
    .flatMap((b) => b.text.map((l) => l.replace(/^\s*([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/, '')))
    .filter((t) => !/^\[?`?@[\w-]+/.test(t));
  const sentences = bs.filter((b) => b.kind === 'para')
    .flatMap((b) => b.text.join(' ').match(/(?:Acceptance:|Done when)\s[^.]*(?:\.(?=\s|$)|$)/g) || []);
  return [...bullets, ...sentences].map(parse).filter((c) => c.text);
}

/** The chosen items in build order: waves of items whose uses (within the plan) come earlier, and the critical path. */
export function order(items) {
  const set = new Set(items), dep = (it) => it.uses.map((u) => u.item).filter((d) => set.has(d));
  const depth = new Map(), via = new Map();
  const visit = (it, seen = new Set()) => {
    if (depth.has(it)) return depth.get(it);
    if (seen.has(it)) return 0; // a cycle: stop
    seen.add(it);
    let d = 0, from = null;
    for (const x of dep(it)) { const v = visit(x, seen) + 1; if (v > d) { d = v; from = x; } }
    depth.set(it, d); via.set(it, from);
    return d;
  };
  items.forEach((it) => visit(it));
  const waves = [];
  for (const it of items) (waves[depth.get(it)] ||= []).push(it);
  let end = items.reduce((a, b) => (depth.get(b) > depth.get(a) ? b : a), items[0]);
  const path_ = [];
  while (end) { path_.unshift(end); end = via.get(end); }
  return { waves: waves.filter(Boolean), critical: path_, dep };
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** The skeleton's markdown and its path. `ready(it)` → { ready, why } (the gate). */
export function skeleton(model, items, { name, gate, date = today() } = {}) {
  const { cfg } = model;
  const run = (args) => execFileSync('git', args, { cwd: cfg.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let made = null, top = null;
  try { made = run(['rev-parse', '--short', 'HEAD']); top = run(['rev-parse', '--show-toplevel']); } catch { /* no git, or no commits */ }
  const repoPath = (p) => (top ? path.relative(top, path.join(cfg.root, p)).split(path.sep).join('/') : p);
  const id = (it) => it.id || `"${it.title}"`;
  name ||= (items[0].id || items[0].title).replace(/^@/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const gates = cfg.plan?.gates || {};
  const { waves, critical, dep } = order(items);
  const shared = (it) => cfg.shared && (it.file === cfg.shared || it.file.startsWith(`${cfg.shared.replace(/\/$/, '')}/`));
  const ordered = waves.flat(), foundation = ordered.filter(shared), rest = ordered.filter((it) => !shared(it));
  const factors = cfg.rubric?.factors?.base ? [...cfg.rubric.factors.base, ...(cfg.rubric.factors.add || [])] : [];
  const L = [];
  L.push('---', `plan: "${name}"`, `items: [${ordered.map((it) => `"${id(it)}"`).join(', ')}]`, 'status: active', `made: ${made || ''}`, '---');
  L.push(`# Plan: ${ordered.map((it) => it.title).join(', ')}`, '');
  L.push('**Outcome.** <one sentence: what is true for the user when this plan is done>', '');
  L.push('## Order', '');
  L.push(waves.map((w) => w.map(id).join(' + ')).join(' → '));
  if (critical.length > 1) L.push('', `Critical path: ${critical.map(id).join(' → ')}${waves.some((w) => w.length > 1) ? ` · parallel lanes: ${Math.max(...waves.map((w) => w.length))}` : ''}`);
  const slice = (n, it) => {
    const g = gate(it), c = criteria(model, it), d = difficulty(it);
    L.push('', `## Slice ${n} · ${id(it)} ${it.title}${d ? ` · ${d}` : ''}`, '');
    const meta = [c.some((x) => x.id) && `criteria: ${c.filter((x) => x.id).map((x) => `#${x.id}`).join(', ')}`,
      it.codePaths?.length && `files: ${it.codePaths.map((p) => `\`${repoPath(p)}\``).join(', ')}`,
      `design: ${path.posix.relative(planDir(cfg), it.file)} (${LV(it.depthN) || '—'})`].filter(Boolean);
    L.push(`> ${meta.join(' · ')}`);
    if (!g.ready) L.push('', `⏳ not ready: ${g.why.join(' · ')}`);
    L.push('');
    (it.risk || []).forEach((v, i) => { if (v >= 2 && MITIGATE[factors[i]]) L.push(`- [ ] ${MITIGATE[factors[i]]}`); });
    for (const d2 of dep(it)) L.push(`- [ ] Build against ${id(d2)}'s contract (D3), not its internals`);
    for (const x of c) L.push(`- [ ] Write test: ${x.text}${x.id ? ` (#${x.id})` : ''}${x.checks ? ` \`${x.checks}\`` : ''}`);
    if (!c.length) L.push('- [ ] Write test: <the first acceptance criterion>');
    L.push(`- [ ] Implement: <break this down from ${id(it)}'s contract and build notes>`);
    const checks = [...new Set(c.map((x) => x.checks).filter(Boolean))];
    L.push(gates.unit ? `- [ ] 🛑 gate unit: \`${gates.unit}\`` : checks.length ? `- [ ] 🛑 gate test: ${checks.map((x) => `\`${x}\``).join(', ')} pass`
      : `- [ ] 🛑 gate: <how to verify ${id(it)}'s criteria>`);
  };
  L.push('', '## Slice 0 · Foundation', '');
  if (foundation.length) { L.push('Shared items the others need, first.'); foundation.forEach((it, i) => slice(`0.${i + 1}`, it)); }
  else L.push('<what the slices need first (from @stack and shared code), or "nothing"; delete this note when settled>');
  rest.forEach((it, i) => slice(i + 1, it));
  const finish = Object.entries(gates).filter(([k]) => k !== 'unit');
  L.push('', '## Finish', '');
  for (const [k, v] of finish) L.push(`- [ ] 🛑 gate ${k}: \`${v}\``);
  if (!finish.length) L.push('- [ ] 🛑 gate: <the end-to-end check: e2e in a browser, a device run, a staging deploy>');
  for (const it of ordered) L.push(`- [ ] ${id(it)}: every criterion holds → set built: yes`);
  L.push('', '## Found on the way', '', '<!-- ↩ design @id: what changes the design (proposed on the item\'s own unchecked line) -->', '');
  return { name, made, rel: path.posix.join(planDir(cfg), `${date}-${name}.md`), text: L.join('\n') };
}
