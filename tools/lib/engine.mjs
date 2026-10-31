// Structural rules (tools/SPEC.md §4): targets, effective targets, open questions, structural nudges, the index.
import fs from 'node:fs';
import path from 'node:path';
import { lv, LV, top, docFiles, itemSettings, factorNames, retiredFile } from './config.mjs';
import { parseFile, SECTION_NAMES, slug } from './parse.mjs';
import { questionSet, questionsFor } from './questions.mjs';
import { blocks } from './read.mjs';

const ICON = { blocked: '⛔', later: '⏸️', trim: '✂️', gap: '⬇️', open: '❓', enough: '🎯', none: '❓',
  superseded: '↪️', retired: '⏹️', archived: '🗄️' };
const ORDER = ['N09', 'N02', 'N18', 'N15', 'N19', 'N21', 'N03', 'N05', 'N22', 'N01', 'N08', 'N07', 'N06', 'N14', 'N12', 'N10',
  'N11', 'N13', 'N16', 'N17', 'N20', 'N04'];

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
  // lifecycle (FORMAT.md §10): superseded, retired or archived items stay readable but stop counting
  const archiveDir = cfg.archive ? `${path.posix.normalize(cfg.archive)}/` : null;
  for (const it of items) {
    it.lifecycle = archiveDir && it.file.startsWith(archiveDir) ? 'archived'
      : it.supersededBy ? 'superseded' : it.retired ? 'retired' : 'current';
  }
  for (const it of items) { // a section item inside a superseded doc goes with it
    for (let p = it.parent; p && it.lifecycle === 'current'; p = p.parent) if (p.lifecycle !== 'current') it.lifecycle = p.lifecycle;
  }
  const retired = readRetired(cfg, read);
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

  // what the text shows (SPEC §4.1): levels are cumulative, so only the highest level reached without a gap counts
  for (const it of items) evidence(cfg, it, read);
  for (const it of items) { // a sub-item leans on its parent's levels
    if (!it.parent?.levelWords || !it.minWords || it.depth == null) continue;
    const min = it.minWords, own = it.levelWords || it.parent.levelWords.map(() => 0);
    it.levelWords = own.map((w, i) => (w >= min ? w : Math.max(w, it.parent.levelWords[i])));
    Object.assign(it, reach(it.levelWords, min));
  }
  for (const it of items) {
    const c = it.cfg;
    it.claimedN = lv(it.depth);
    it.depthN = it.shownN == null || it.claimedN == null ? it.claimedN : Math.min(it.claimedN, it.shownN);
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

  const successor = (it) => { // follow superseded-by to the current item, if there is one
    const seen = new Set();
    let x = it;
    while (x?.supersededBy && !seen.has(x)) { seen.add(x); x = byId.get(x.supersededBy.id); }
    return x && x !== it && x.lifecycle === 'current' ? x : null;
  };
  for (const it of items) it.successor = it.lifecycle === 'current' ? null : successor(it);
  const active = items.filter((it) => it.lifecycle === 'current');
  const inactive = items.filter((it) => it.lifecycle !== 'current');
  const model = { cfg, items: active, inactive, all: items, byId, retired, untagged, errors, warnings, questions: qs };
  model.nudges = nudges(model);
  for (const it of active) it.status = statusOf(it, model);
  for (const it of inactive) it.status = it.lifecycle;
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
      if (u.item.lifecycle !== 'current') {
        add('N18', 'warn', it, `uses ${name(u.item)}, which is ${lifeText(u.item)}${u.item.successor ? `: point it at ${name(u.item.successor)}` : ''}`, { uses: u.item.key });
        continue;
      }
      const need = u.level ? lv(u.level) : u.item.targetN;
      if (need == null || u.item.depthN >= need) continue;
      const late = it.focus === 'later';
      add('N02', late ? 'info' : 'block', it, `uses ${name(u.item)}, which is at ${at(u.item)} of ${u.level ? 'the ' + u.level + ' asked for' : 'its target ' + LV(need)}`, { uses: u.item.key });
      if (!waiters.has(u.item)) waiters.set(u.item, []);
      const w = `${name(it)} (${it.focus || 'now'})`;
      if (!waiters.get(u.item).includes(w)) waiters.get(u.item).push(w);
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
    if (it.depthN < it.claimedN) {
      const missing = it.levelWords.slice(0, it.claimedN + 1).map((w, i) => (w < it.minWords ? LV(i) : null)).filter(Boolean);
      const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)} have` : `${missing[0]} has`;
      const enough = it.effectiveN != null && it.shownN >= it.effectiveN;
      add('N05', 'warn', it, `claims ${it.depth}, but ${list} nothing written: it shows ${it.shownN < 0 ? 'no level yet' : LV(it.shownN)}. ${enough ? `Lower the claim to ${LV(it.shownN)}: that's all it needs` : `Write ${missing[0]}, or lower the claim`}`,
        { claimed: it.depth, shown: LV(it.shownN), missing, lower: enough });
    } else if (it.shownN > it.claimedN) {
      add('N22', 'info', it, `has content through ${LV(it.shownN)} but claims ${it.depth}: raise its depth if those questions are answered`);
    }
    if (it.targetN == null) { add('N14', 'warn', it, 'has no target. Score its risk, or write depth: Dn → Dt'); continue; }
    const capped = it.effectiveN < it.targetN;
    const d0 = it.sections.filter((s) => s.level === 'D0');
    if (it.claimedN === 0 && d0.length && d0.every((s) => s.words === 0)) {
      const qs = it.questions.filter((q) => q.level === 'D0' && !q.skipped);
      add('N05', 'warn', it, `claims D0, but its ${d0.map((s) => `"${s.heading}"`).join(' and ')} section${d0.length > 1 ? 's are' : ' is'} empty`,
        { next: 'D0', empty: true, details: qs.map((q) => `${q.id} · ${q.text}`) });
    } else if (it.depthN < it.effectiveN) {
      const next = LV(it.depthN + 1);
      const ids = it.questions.filter((q) => q.level === next && !q.skipped && !q.optional).map((q) => q.id);
      const own = it.checklist.filter((q) => !q.checked && q.level === next).length;
      const qs = it.questions.filter((q) => q.level === next && !q.skipped && !q.optional);
      add('N01', 'warn', it, `${at(it)} → ${LV(it.effectiveN)}${capped ? ` (full target ${LV(it.targetN)})` : ''}. ${ids.length || own ? `Questions for ${next}: ${ids.join(', ') || '—'}` : `No questions for ${next} yet${it.cfg.levels[next]?.done ? `; it's reached when ${it.cfg.levels[next].done}` : ''}`}${own ? ` + ${own} of its own` : ''}`,
        { next, details: qs.map((q) => `${q.id} · ${q.text}`) });
    } else if (Math.max(it.depthN, it.deepestN ?? -1) > it.effectiveN) {
      const why = !capped ? `risk ${it.risk ? it.risk.join('·') : '—'} gives target ${LV(it.targetN)}`
        : it.focus && it.focus !== 'now' && lv(it.cfg.caps.focus[it.focus]) === it.effectiveN ? `focus: ${it.focus} caps it at ${LV(it.effectiveN)} for now`
          : `stage ${it.cfg.stage} caps it at ${LV(it.effectiveN)} for now`;
      add('N06', 'warn', it, `${it.deepestN > it.depthN ? `has ${LV(it.deepestN)} content` : `at ${it.depth}`}, but ${why}: over-documented`);
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
    if (!mine.length && it.depthN >= it.effectiveN) {
      const capped = it.effectiveN < it.targetN;
      add('N04', 'info', it, `${it.depth} 🎯 enough${capped ? ` for now (full target ${LV(it.targetN)})` : ''}${it.caveats ? `. Caveats: ${it.caveats}` : ''}`);
    }
  }
  lifecycleNudges(model, add);
  const words = cfg.nudges.untaggedWords ?? 80;
  const archived = (f) => cfg.archive && `${f}/`.startsWith(`${path.posix.normalize(cfg.archive)}/`); // old notes there aren't designs to tag
  for (const u of untagged) {
    if (u.words > words && !archived(u.file)) add('N13', 'info', null, `"${u.heading}" (${u.file}:${u.line}) has ${u.words} words and no tag`, { file: u.file, line: u.line, title: u.heading });
  }
  const pos = new Map([...items, ...model.inactive].map((it, i) => [it.key, i]));
  return out.sort((a, b) => (pos.get(a.item) ?? 1e9) - (pos.get(b.item) ?? 1e9) || ORDER.indexOf(a.code) - ORDER.indexOf(b.code));
}

const name = (it) => it.id || `"${it.title}"`;
/** "D1", or "D1 (claims D4)" when the text doesn't back the claim. */
export const at = (it) => (it.depthN == null ? '—' : it.depthN < 0 ? `nothing (claims ${it.depth})`
  : it.depthN < it.claimedN ? `${LV(it.depthN)} (claims ${it.depth})` : LV(it.depthN));

/**
 * Words written at each level (headings, lead-ins; parts count for their host), and the levels they reach:
 * shownN, the highest level with every level up to it written (≥ nudges.levelWords words; -1: not even D0), and
 * deepestN, the deepest level with any. No levelled text at all, or levelWords 0: null (nothing to measure).
 */
function evidence(cfg, it, read) {
  const min = it.cfg.nudges.levelWords ?? 10;
  it.minWords = min;
  it.levelWords = null; it.shownN = null; it.deepestN = null;
  if (!min || it.depth == null) return;
  let bs;
  try { bs = blocks({ cfg }, it, read); } catch { return; }
  const w = Array(top() + 1).fill(0);
  let any = false;
  for (const b of bs) {
    if (b.kind === 'title' || b.kind === 'heading' || b.kind === 'mark' || b.level == null || lv(b.level) < 0) continue;
    any = true;
    w[lv(b.level)] += b.text.join(' ').replace(/\*\*[^*]+\.\*\*/, '').split(/\s+/).filter(Boolean).length;
  }
  if (!any) return;
  it.levelWords = w;
  Object.assign(it, reach(w, min));
}
const reach = (w, min) => {
  let shownN = -1;
  while (shownN + 1 < w.length && w[shownN + 1] >= min) shownN++;
  return { shownN, deepestN: w.reduce((d, x, i) => (x >= min ? i : d), -1) };
};

/** "superseded by @new", "retired 2026-11-02 (why)", "archived". */
export function lifeText(it) {
  if (it.supersededBy) return `superseded by ${it.supersededBy.id}${it.supersededBy.reason ? ` (${it.supersededBy.reason})` : ''}${it.lifecycle === 'archived' ? ', archived' : ''}`;
  if (it.retired) return `retired${it.retired.date ? ` ${it.retired.date}` : ''}${it.retired.reason ? ` (${it.retired.reason})` : ''}${it.lifecycle === 'archived' ? ', archived' : ''}`;
  return it.lifecycle === 'archived' ? 'archived' : it.lifecycle;
}

/** `<archive>/RETIRED.md`: one table row per deleted id. Returns Map id → { date, why, successor, commit }. */
function readRetired(cfg, read) {
  const out = new Map(), file = retiredFile(cfg);
  let text = '';
  try { text = file ? read(file) : ''; } catch { return out; }
  for (const line of text.split('\n')) {
    const c = line.split('|').map((x) => x.trim());
    if (/^@[A-Za-z][\w-]*$/.test(c[1] || '')) out.set(c[1], { date: c[2] || null, why: c[3] || null, successor: c[4] && c[4] !== '—' ? c[4] : null, commit: c[5] || null });
  }
  return out;
}

/** N15, N19, N20, N21: the lifecycle marks agree with each other, and nothing deleted comes back. */
function lifecycleNudges(model, add) {
  const { all, byId, retired } = model;
  for (const it of all) {
    const s = it.supersededBy;
    if (s) {
      const to = byId.get(s.id);
      if (!to) add(retired.has(s.id) ? 'N19' : 'N15', 'warn', it, `superseded-by ${s.id}, which ${retired.has(s.id) ? 'was deleted (RETIRED.md)' : "doesn't exist"}`);
      else if (!to.supersedes.includes(it.id)) add('N19', 'warn', it, `says superseded-by ${s.id}, but ${s.id} doesn't say supersedes: ${name(it)}`);
      else if (to === it) add('N19', 'warn', it, 'supersedes itself');
    }
    for (const old of it.supersedes) {
      const o = byId.get(old);
      if (!o) { if (!retired.has(old)) add('N15', 'warn', it, `supersedes ${old}, which doesn't exist`); continue; }
      if (o.supersededBy?.id !== it.id) add('N19', 'warn', it, `says supersedes: ${old}, but ${old} doesn't say superseded-by: ${name(it)}`);
    }
    if (it.lifecycle === 'archived' && !it.supersededBy && !it.retired) add('N21', 'warn', it, 'is in the archive but says neither superseded-by nor retired: say why it was archived');
    if (it.id && retired.has(it.id)) add('N21', 'warn', it, `${it.id} was deleted (RETIRED.md, ${retired.get(it.id).date || 'no date'}): pick a new id, so old references don't point here`);
    if (it.lifecycle !== 'current' && it.allOpen.length) {
      add('N20', 'info', it, `is ${lifeText(it)} but still has ${it.allOpen.length} open question${it.allOpen.length > 1 ? 's' : ''}: move them to ${it.successor ? name(it.successor) : 'the item that took over'}, or close them`);
    }
  }
}

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
  if (it.lifecycle && it.lifecycle !== 'current') return { ready: false, why: [`${lifeText(it)}${it.successor ? `: gate ${name(it.successor)} instead` : ''}`] };
  if (it.targetN == null) why.push('no target');
  else if (it.depthN < it.targetN) why.push(`${at(it)} → ${LV(it.targetN)}${it.effectiveN < it.targetN ? ' (the full target applies to the gate)' : ''}`);
  if (it.allOpen.length) why.push(`${it.allOpen.length} open`);
  for (const u of it.uses) {
    if (!u.item) why.push(`${u.raw} doesn't resolve`);
    else if (u.item.lifecycle !== 'current') why.push(`uses ${name(u.item)}, which is ${lifeText(u.item)}`);
    else {
      const need = u.level ? lv(u.level) : u.item.targetN;
      if (need != null && u.item.depthN < need) why.push(`${name(u.item)} at ${at(u.item)} of ${LV(need)}`);
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
    return `| ${icon(it.status)} | ${it.parent ? '↳ ' : ''}${link(it)}${it.id ? ` \`${it.id}\`` : ''}${parts.length ? ` · parts: ${parts.join(', ')}` : ''} | ${it.depth ? at(it) : '—'} | ${targetText(it)} | ${uses.join(', ') || '—'} | ${usedBy(it).join(', ') || '—'} | ${it.openList.length} |`;
  });
  const NI = { N02: '⛔', N15: '⛔', N03: '❓', N01: '⬇️', N05: '⚠️', N06: '✂️', N14: '❓', N10: '⏸️', N13: 'ℹ️' };
  const nud = model.nudges.filter((n) => n.code !== 'N04' && !(n.code === 'N02' && n.severity === 'info'))
    .map((n) => `- ${NI[n.code] || 'ℹ️'} **${n.title}** ${n.message}`);
  const later = items.flatMap((it) => it.later.map((l) => `- **${it.title}**: ${l.text}`));
  const past = (model.inactive || []).filter((it) => !it.parent || it.parent.lifecycle === 'current').map((it) => {
    const to = it.successor ? ` → [${name(it.successor)}](${path.posix.relative(dir, it.successor.file)}${it.successor.anchor ? '#' + it.successor.anchor : ''})` : '';
    return `- ${icon(it.lifecycle)} ${link(it)}${it.id ? ` \`${it.id}\`` : ''}: ${lifeText(it)}${to}`;
  });
  const gone = [...(model.retired || new Map())].map(([id, r]) => `${id}${r.successor ? ` → ${r.successor}` : ''}`);
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
    ...(past.length || gone.length ? ['## Superseded and retired', '', ...past,
      ...(gone.length ? [`- Deleted (in git history, listed in ${path.posix.relative(dir, retiredFile(cfg))}): ${gone.join(', ')}`] : []), ''] : []),
    `<sub>${icon('enough')} enough · ${icon('gap')} go deeper · ${icon('blocked')} blocked · ${icon('open')} open · ${icon('trim')} over-documented · ${icon('later')} later${(model.inactive || []).length ? ` · ${icon('superseded')} superseded · ${icon('retired')} retired · ${icon('archived')} archived` : ''}. Structural nudges only; the skill and reviewers add the ones that need reading (N05, N07, N08, N12, N16, N17).</sub>`,
    '',
  ].join('\n');
}

export { slug };
