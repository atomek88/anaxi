// Structural rules (tools/SPEC.md §4): targets, effective targets, open questions, structural nudges, the index.
import fs from 'node:fs';
import path from 'node:path';
import { lv, LV, top, docFiles, itemSettings, factorNames } from './config.mjs';
import { parseFile, SECTION_NAMES, slug } from './parse.mjs';
import { questionSet, questionsFor } from './questions.mjs';

const ICON = { blocked: '⛔', later: '⏸️', trim: '✂️', gap: '⬇️', open: '❓', enough: '🎯', none: '❓' };
const ORDER = ['N09', 'N02', 'N15', 'N03', 'N05', 'N01', 'N08', 'N07', 'N06', 'N14', 'N12', 'N10', 'N11', 'N13',
  'N16', 'N17', 'N04'];

/**
 * Read and evaluate a project. `read(rel)` returns a file's text (default: from disk), so the same code can run
 * on another git revision for `--diff`.
 */
export function evaluate(cfg, { read, files } = {}) {
  read ||= (rel) => fs.readFileSync(path.join(cfg.root, rel), 'utf8');
  files ||= docFiles(cfg);
  const names = { ...SECTION_NAMES };
  for (const [k, v] of Object.entries(cfg.sections || {})) names[k] = [...(names[k] || []), ...v.map((x) => x.toLowerCase())];
  for (const k of Object.keys(names)) { // a ladder without D4: its headings count at the top level
    if (/^D\d$/.test(k) && lv(k) < 0) { names[LV(top())] = [...names[LV(top())], ...names[k]]; delete names[k]; }
  }

  const items = [], untagged = [], errors = [], warnings = [];
  for (const f of files) {
    const r = parseFile(read(f), f, names);
    items.push(...r.items); untagged.push(...r.untagged); errors.push(...r.errors); warnings.push(...r.warnings);
  }
  const qs = questionSet(cfg);
  errors.push(...qs.errors);
  const ladder = `${LV(0)}–${LV(top())}`;
  for (const it of items) {
    for (const l of [it.depth, it.arrow, it.target?.level, ...it.uses.map((u) => u.level)]) {
      if (l && lv(l) < 0) errors.push(`${it.file}:${it.line}: can't read depth "${l}": this project's levels are ${ladder}`);
    }
    if (lv(it.depth) < 0) it.depth = null;
    if (lv(it.arrow) < 0) it.arrow = null;
    if (lv(it.target?.level) < 0) it.target = null;
  }

  // parts (`part-of: @id`): content kept in another file or an appendix, counted as the host item's own
  const parts = items.filter((it) => it.partOf);
  for (const p of parts) items.splice(items.indexOf(p), 1);

  // ids and references
  const byId = new Map();
  for (const it of items) {
    it.key = it.id || `${it.file}#${it.anchor || ''}`;
    if (!it.id) continue;
    if (byId.has(it.id)) errors.push(`${it.file}:${it.line}: ${it.id} is also declared in ${byId.get(it.id).file}:${byId.get(it.id).line}`);
    else byId.set(it.id, it);
  }
  for (const p of parts) {
    const host = byId.get(p.partOf);
    if (!host) { errors.push(`${p.file}:${p.line}: part-of ${p.partOf}, which doesn't exist (N15)`); continue; }
    (host.parts ||= []).push({ file: p.file, line: p.line, anchor: p.declared === 'front-matter' ? '' : p.anchor, title: p.title });
    host.sections.push(...p.sections.map((s) => ({ ...s, file: p.file })));
    host.checklist.push(...p.checklist.map((q) => ({ ...q, file: p.file })));
    host.open.push(...p.open);
    host.uses.push(...p.uses.filter((u) => !host.uses.some((h) => h.raw === u.raw)));
    for (const m of p.mentions) host.mentions.add(m);
    for (const c of p.children) { c.parent = host; host.children.push(c); }
  }
  const resolve = (ref, from) => {
    if (ref.id) return byId.get(ref.id) || null;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(from.file), ref.path));
    const inFile = items.filter((x) => x.file === target);
    if (ref.anchor) return inFile.find((x) => x.anchor === ref.anchor) || null;
    return inFile.find((x) => x.declared === 'front-matter') || inFile.find((x) => !x.parent) || null;
  };
  for (const it of items) {
    for (const u of it.uses) {
      u.item = resolve(u, it);
      if (!u.item) errors.push(`${it.file}:${it.line}: uses ${u.raw}, which ${u.id ? "doesn't exist" : 'is not a tagged item'} (N15)`);
    }
    for (const l of it.later) if (l.trigger) l.trigger.item = byId.get(l.trigger.id) || null;
  }

  // targets (SPEC §4)
  for (const it of items) {
    const c = itemSettings(cfg, it.profile);
    it.cfg = c;
    let t = null, src = null;
    if (it.target) { t = lv(it.target.level); src = 'target'; }
    let fromRisk = null;
    if (it.risk) {
      const fac = factorNames(c);
      if (it.risk.length !== fac.length) warnings.push(`${it.file}:${it.line}: risk has ${it.risk.length} scores; this project scores ${fac.length} (${fac.join('·')})`);
      const sum = it.risk.reduce((s, n, i) => s + Math.max(n, c.rubric.floors?.[fac[i]] ?? 0), 0);
      for (const [lvl, [lo, hi]] of Object.entries(c.rubric.thresholds)) if (sum >= lo && sum <= hi) fromRisk = lv(lvl) < 0 ? top() : lv(lvl); // a dropped level → the top one
      if (fromRisk == null) warnings.push(`${it.file}:${it.line}: risk total ${sum} is outside the thresholds`);
    }
    const written = it.arrow ? lv(it.arrow) : it.enough ? lv(it.depth) : null;
    if (t == null && fromRisk != null) { t = fromRisk; src = 'risk'; }
    if (t == null && written != null) { t = written; src = 'depth'; }
    if (src !== 'target' && fromRisk != null && written != null && fromRisk !== written) {
      warnings.push(`${it.file}:${it.line}: "${it.title}" risk gives ${LV(fromRisk)}, but the depth says ${LV(written)}. Re-score, or add target: Dn (reason)`);
    }
    if (t != null) {
      if (c.targets.min) t = Math.max(t, lv(c.targets.min));
      for (const r of c.targets.rules || []) if (it.about.includes(r.about) && r.min) t = Math.max(t, lv(r.min));
      if (c.targets.max && lv(c.targets.max) >= 0) t = Math.min(t, lv(c.targets.max));
    }
    it.targetN = t;
    it.targetSrc = src;
  }
  // raised by `uses: @this (Dn)`
  for (const it of items) for (const u of it.uses) if (u.item && u.level && u.item.targetN != null) u.item.targetN = Math.max(u.item.targetN, lv(u.level));

  for (const it of items) {
    const c = it.cfg;
    it.depthN = lv(it.depth);
    const caps = [it.targetN, lv(c.caps.focus?.[it.focus || 'now']), lv(c.caps.stage?.[c.stage])].filter((x) => x != null && x >= 0);
    it.effectiveN = it.targetN == null ? null : Math.min(...caps);
    if (it.enough && it.targetN != null && it.depthN < it.targetN) {
      warnings.push(`${it.file}:${it.line}: "${it.title}" says enough at ${it.depth}, but its target is ${LV(it.targetN)}`);
    }
    // open: `open:` entries, plus unchecked boxes at or below the effective target (no level: always)
    it.openList = [
      ...it.open.map((text) => ({ text, level: null, source: 'open' })),
      ...it.checklist.filter((q) => !q.checked && (q.level == null || it.effectiveN == null || lv(q.level) <= it.effectiveN))
        .map((q) => ({ text: q.text, level: q.level, source: 'checklist', line: q.line })),
    ];
    it.allOpen = [...it.open, ...it.checklist.filter((q) => !q.checked)];
    it.questions = questionsFor(it, qs);
    // template text left in place (templates/TDD.md, item.md)
    it.placeholders = [
      it.id === '@your-id' && 'the @id',
      ['Title', 'Item title'].includes(it.title) && 'the title',
      it.checklist.some((q) => /^(Open question )?…$/.test(q.text)) && 'the "…" question',
    ].filter(Boolean);
    if (it.placeholders.length && it.risk?.every((n) => n === 0)) it.placeholders.push('the risk scores');
  }

  const model = { cfg, items, byId, untagged, errors, warnings, questions: qs };
  model.nudges = nudges(model);
  for (const it of items) it.status = statusOf(it, model);
  return model;
}

function nudges(model) {
  const { cfg, items, untagged } = model;
  const out = [];
  const add = (code, sev, it, message, extra = {}) => {
    const c = it?.cfg || cfg;
    if ((c.nudges.off || []).includes(code) && code !== 'N09') return;
    out.push({ code, severity: c.nudges.severity?.[code] || sev, item: it ? it.key : null, title: it?.title,
      file: it?.file, line: it?.line, message, ...extra });
  };
  const waiters = new Map();

  for (const it of items) {
    for (const u of it.uses) {
      if (!u.item) { add('N15', 'warn', it, `uses ${u.raw}, which ${u.id ? "doesn't exist" : 'is not a tagged item'}`); continue; }
      const need = u.level ? lv(u.level) : u.item.targetN;
      if (need == null || u.item.depthN >= need) continue;
      const late = it.focus === 'later';
      add('N02', late ? 'info' : 'block', it, `uses ${name(u.item)}, which is at ${u.item.depth} of ${u.level ? 'the ' + u.level + ' asked for' : 'its target ' + LV(need)}`, { uses: u.item.key });
      if (!waiters.has(u.item)) waiters.set(u.item, []);
      waiters.get(u.item).push(`${name(it)} (${it.focus || 'now'})`);
    }
    for (const l of it.later) {
      if (!l.trigger) continue;
      if (!l.trigger.item) add('N15', 'warn', it, `later: names ${l.trigger.id}, which doesn't exist`);
      else if (l.trigger.item.depthN >= lv(l.trigger.level)) add('N10', 'info', it, `${l.trigger.id} reached ${l.trigger.level}: "${l.text}" is due`);
    }
    if (it.openList.length) {
      add('N03', 'warn', it, `${it.openList.length} open: ${it.openList.map((q) => (q.level ? `${q.text} (${q.level})` : q.text)).join(' · ')}`,
        { details: it.openList.map((q) => `${q.level ? q.level + ' · ' : ''}${q.text}`) });
    }
    if (it.targetN == null) { add('N14', 'warn', it, 'has no target. Score its risk, or write depth: Dn → Dt'); continue; }
    const capped = it.effectiveN < it.targetN;
    const d0 = it.sections.filter((s) => s.level === 'D0');
    if (it.depthN === 0 && d0.length && d0.every((s) => s.words === 0)) {
      const qs = it.questions.filter((q) => q.level === 'D0' && !q.skipped);
      add('N05', 'warn', it, `claims D0, but its ${d0.map((s) => `"${s.heading}"`).join(' and ')} section${d0.length > 1 ? 's are' : ' is'} empty`,
        { next: 'D0', empty: true, details: qs.map((q) => `${q.id} · ${q.text}`) });
    } else if (it.depthN < it.effectiveN) {
      const next = LV(it.depthN + 1);
      const ids = it.questions.filter((q) => q.level === next && !q.skipped && !q.optional).map((q) => q.id);
      const own = it.checklist.filter((q) => !q.checked && q.level === next).length;
      const qs = it.questions.filter((q) => q.level === next && !q.skipped && !q.optional);
      add('N01', 'warn', it, `${it.depth} → ${LV(it.effectiveN)}${capped ? ` (full target ${LV(it.targetN)})` : ''}. ${ids.length || own ? `Questions for ${next}: ${ids.join(', ') || '—'}` : `No questions for ${next} yet${it.cfg.levels[next]?.done ? `; it's reached when ${it.cfg.levels[next].done}` : ''}`}${own ? ` + ${own} of its own` : ''}`,
        { next, details: qs.map((q) => `${q.id} · ${q.text}`) });
    } else if (it.depthN > it.effectiveN) {
      const why = !capped ? `risk ${it.risk ? it.risk.join('·') : '—'} gives target ${LV(it.targetN)}`
        : it.focus && it.focus !== 'now' && lv(it.cfg.caps.focus[it.focus]) === it.effectiveN ? `focus: ${it.focus} caps it at ${LV(it.effectiveN)} for now`
          : `stage ${it.cfg.stage} caps it at ${LV(it.effectiveN)} for now`;
      add('N06', 'warn', it, `at ${it.depth}, but ${why}: over-documented`);
    }
  }
  for (const [it, who] of waiters) {
    const n = out.find((x) => x.code === 'N01' && x.item === it.key);
    if (n) n.message += ` · ${who.length} item${who.length > 1 ? 's' : ''} wait on it: ${who.join(', ')}`;
    else add('N02', 'info', it, `waited on by ${who.join(', ')}`);
  }
  for (const it of items) {
    if (it.targetN == null) continue;
    const mine = out.filter((x) => x.item === it.key && x.severity !== 'info');
    if (!mine.length && it.depthN === it.effectiveN) {
      const capped = it.effectiveN < it.targetN;
      add('N04', 'info', it, `${it.depth} 🎯 enough${capped ? ` for now (full target ${LV(it.targetN)})` : ''}${it.caveats ? `. Caveats: ${it.caveats}` : ''}`);
    }
  }
  const words = cfg.nudges.untaggedWords ?? 80;
  for (const u of untagged) {
    if (u.words > words) add('N13', 'info', null, `"${u.heading}" (${u.file}:${u.line}) has ${u.words} words and no tag`, { file: u.file, line: u.line, title: u.heading });
  }
  const pos = new Map(items.map((it, i) => [it.key, i]));
  return out.sort((a, b) => (pos.get(a.item) ?? 1e9) - (pos.get(b.item) ?? 1e9) || ORDER.indexOf(a.code) - ORDER.indexOf(b.code));
}

const name = (it) => it.id || `"${it.title}"`;

function statusOf(it, model) {
  const mine = model.nudges.filter((n) => n.item === it.key);
  if (it.targetN == null) return 'none';
  if (mine.some((n) => n.code === 'N02' && n.severity === 'block')) return 'blocked';
  if (it.focus === 'later') return 'later';
  if (mine.some((n) => n.code === 'N06')) return 'trim';
  if (mine.some((n) => n.code === 'N01' || (n.code === 'N05' && n.empty))) return 'gap';
  if (it.openList.length) return 'open';
  return 'enough';
}

/** N09: ready only at the full target, nothing open (any level), uses deep enough, no block nudges. */
export function gate(model, it) {
  const why = [];
  if (it.targetN == null) why.push('no target');
  else if (it.depthN < it.targetN) why.push(`${it.depth} → ${LV(it.targetN)}${it.effectiveN < it.targetN ? ' (the full target applies to the gate)' : ''}`);
  if (it.allOpen.length) why.push(`${it.allOpen.length} open`);
  for (const u of it.uses) {
    if (!u.item) why.push(`${u.raw} doesn't resolve`);
    else {
      const need = u.level ? lv(u.level) : u.item.targetN;
      if (need != null && u.item.depthN < need) why.push(`${name(u.item)} at ${u.item.depth} of ${LV(need)}`);
    }
  }
  for (const n of model.nudges) if (n.item === it.key && n.severity === 'block' && n.code !== 'N02') why.push(`${n.code}: ${n.message}`);
  return { ready: why.length === 0, why };
}

/** Who depends on `it`, transitively. */
export function dependents(model, it) {
  const seen = new Set(), out = [];
  const visit = (x, hop) => {
    for (const other of model.items) {
      if (seen.has(other) || !other.uses.some((u) => u.item === x)) continue;
      seen.add(other); out.push({ item: other, hop }); visit(other, hop + 1);
    }
  };
  visit(it, 1);
  return out;
}

export const icon = (status) => ICON[status];
export const targetText = (it) => (it.targetN == null ? '—'
  : it.effectiveN < it.targetN ? `${LV(it.targetN)} (now ${LV(it.effectiveN)})` : LV(it.targetN));

/** INDEX.md (TOOLING.md §4.2). Deterministic: no dates, so CI can compare it. */
export function renderIndex(model, indexPath) {
  const { cfg, items } = model;
  const dir = path.posix.dirname(indexPath);
  const link = (it) => {
    const rel = path.posix.relative(dir, it.file) + (it.anchor ? `#${it.anchor}` : '');
    return `[${it.title.replace(/[[\]|]/g, '')}](${rel})`;
  };
  const shared = (it) => cfg.shared && (it.file === cfg.shared || it.file.startsWith(`${cfg.shared.replace(/\/$/, '')}/`));
  const order = [...items].sort((a, b) => Number(shared(a)) - Number(shared(b)) || items.indexOf(a) - items.indexOf(b));
  const usedBy = (it) => items.filter((o) => o.uses.some((u) => u.item === it)).map(name);
  const rows = order.map((it) => {
    const uses = it.uses.map((u) => (u.item ? `[${name(u.item)}](${path.posix.relative(dir, u.item.file)}${u.item.anchor ? '#' + u.item.anchor : ''})` : u.raw));
    const parts = (it.parts || []).map((p) => `[${p.title.replace(/[[\]|]/g, '')}](${path.posix.relative(dir, p.file)}${p.anchor ? '#' + p.anchor : ''})`);
    return `| ${icon(it.status)} | ${it.parent ? '↳ ' : ''}${link(it)}${it.id ? ` \`${it.id}\`` : ''}${parts.length ? ` · parts: ${parts.join(', ')}` : ''} | ${it.depth || '—'} | ${targetText(it)} | ${uses.join(', ') || '—'} | ${usedBy(it).join(', ') || '—'} | ${it.openList.length} |`;
  });
  const NI = { N02: '⛔', N15: '⛔', N03: '❓', N01: '⬇️', N06: '✂️', N14: '❓', N10: '⏸️', N13: 'ℹ️' };
  const nud = model.nudges.filter((n) => n.code !== 'N04' && !(n.code === 'N02' && n.severity === 'info'))
    .map((n) => `- ${NI[n.code] || 'ℹ️'} **${n.title}** ${n.message}`);
  const later = items.flatMap((it) => it.later.map((l) => `- **${it.title}**: ${l.text}`));
  return [
    `# Design index · ${cfg.profile} profile · stage: ${cfg.stage}`,
    '',
    '<!-- Generated by `anaxi-check index`. Don\'t edit: change the docs and regenerate. -->',
    '',
    '| | Item | Depth | Target | Uses | Used by | Open |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Nudges',
    '',
    ...(nud.length ? nud : ['None.']),
    '',
    '## Later',
    '',
    ...(later.length ? later : ['None.']),
    '',
    `<sub>${icon('enough')} enough · ${icon('gap')} go deeper · ${icon('blocked')} blocked · ${icon('open')} open · ${icon('trim')} over-documented · ${icon('later')} later. Structural nudges only; the skill and reviewers add the ones that need reading (N05, N07, N08, N12, N16, N17).</sub>`,
    '',
  ].join('\n');
}

export { slug };
