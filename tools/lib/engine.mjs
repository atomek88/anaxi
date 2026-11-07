// Structural rules (tools/SPEC.md §4): targets, effective targets, open questions, structural nudges, the index.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { lv, LV, top, docFiles, itemSettings, factorNames, retiredFile, globRe } from './config.mjs';
import { parseFile, SECTION_NAMES, slug, sectionByName } from './parse.mjs';
import { questionSet, questionsFor } from './questions.mjs';
import { blocks } from './read.mjs';

const ICON = { blocked: '⛔', later: '⏸️', trim: '✂️', gap: '⬇️', open: '❓', enough: '🎯', none: '❓',
  superseded: '↪️', retired: '⏹️', archived: '🗄️' };
const ORDER = ['N09', 'N02', 'N18', 'N15', 'N19', 'N21', 'N23', 'N24', 'N25', 'N03', 'N05', 'N22', 'N01', 'N08', 'N07', 'N06', 'N14', 'N12', 'N10',
  'N11', 'N13', 'N16', 'N17', 'N20', 'N04'];

/**
 * Read and evaluate a project. `read(rel)` returns a file's text (default: from disk), so the same code can run
 * on another git revision for `--diff`.
 */
export function evaluate(cfg, { read, files } = {}) {
  const git = !read;
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
    for (const m of p.historyMentions) host.historyMentions.add(m);
    for (const c of p.children) { c.parent = host; host.children.push(c); }
  }
  // parts listed from the item's side (`parts: path#anchor (D3)`): detail kept in a file that carries no Anaxi marks,
  // even outside the design folder; the path is relative to the item's file, like a link
  for (const it of items) for (const ref of it.partRefs || []) {
    const where = `${it.file}:${it.line}`;
    const file = path.posix.normalize(path.posix.join(path.posix.dirname(it.file), ref.path));
    let lines;
    try { lines = read(file).split('\n'); } catch { errors.push(`${where}: part ${ref.raw}: no file ${file}`); continue; }
    let from = 0, end = lines.length, inF = false, h = 0;
    if (ref.anchor) {
      from = lines.findIndex((l, i) => { if (/^\s*(```|~~~)/.test(l)) inF = !inF; const m = !inF && l.match(/^(#+)\s+(.*)$/); return m && slug(m[2]) === ref.anchor && (h = m[1].length); });
      if (from < 0) { errors.push(`${where}: part ${ref.raw}: no heading #${ref.anchor} in ${file}`); continue; }
      inF = false;
      for (let i = from + 1; i < lines.length; i++) { if (/^\s*(```|~~~)/.test(lines[i])) inF = !inF; const m = !inF && lines[i].match(/^(#+)\s/); if (m && m[1].length <= h) { end = i; break; } }
    } else if (lines[0]?.trim() === '---') from = lines.findIndex((l, i) => i > 0 && l.trim() === '---') + 1;
    const title = (lines[from]?.match(/^#+\s+(.*)$/)?.[1] || path.posix.basename(file)).replace(/`/g, '');
    (it.parts ||= []).push({ file, line: from + 1, anchor: ref.anchor, title, listed: true });
    // every heading in it is a section at the level given (or named), so the part is read and measured as a whole
    inF = false; let sec = null;
    for (let i = from; i < end; i++) {
      if (/^\s*(```|~~~)/.test(lines[i])) { inF = !inF; continue; }
      const m = !inF && lines[i].match(/^(#+)\s+(.*)$/);
      if (m) { const t = m[2].replace(/`[^`]*`/g, '').trim(); sec = { heading: t, level: ref.level || sectionByName(t, names), by: ref.level ? 'part' : 'name', line: i + 1, words: 0, file }; it.sections.push(sec); }
      else if (sec) sec.words += lines[i].split(/\s+/).filter(Boolean).length;
    }
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
  // what's built (FORMAT.md §2): the code paths, relative to the item's file, and the roll-up over marked sub-items
  for (const it of items) {
    it.codePaths = (it.code || []).map((c) => path.posix.normalize(path.posix.join(path.posix.dirname(it.file), c)));
    const marked = it.children.filter((c) => c.built);
    if (marked.length) it.builtParts = { yes: marked.filter((c) => c.built === 'yes').length, partly: marked.filter((c) => c.built === 'partly').length, no: marked.filter((c) => c.built === 'no').length };
  }
  const model = { cfg, items: active, inactive, all: items, byId, retired, untagged, errors, warnings, questions: qs, clock: git ? gitClock(cfg) : null };
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
    if (it.depthN < it.claimedN && it.unmarked && !(it.parent?.levelWords || []).some((w) => w >= it.minWords)) {
      add('N05', 'warn', it, `claims ${it.depth}, but none of its text says which level it answers, so it shows nothing yet. Mark it: level headings (\`## Shape\`, a \`D2\` badge), lead-ins (\`**Why.**\`), or your template's heading names in anaxi.json "sections"`,
        { claimed: it.depth, shown: null, missing: it.levelWords.slice(0, it.claimedN + 1).map((_, i) => LV(i)), unmarked: true });
    } else if (it.depthN < it.claimedN) {
      const missing = it.levelWords.slice(0, it.claimedN + 1).map((w, i) => (w < it.minWords ? LV(i) : null)).filter(Boolean);
      const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)} have` : `${missing[0]} has`;
      const enough = it.effectiveN != null && it.shownN >= it.effectiveN;
      add('N05', 'warn', it, `claims ${it.depth}, but ${list} nothing written: it shows ${it.shownN < 0 ? 'no level yet' : LV(it.shownN)}. ${enough ? `Lower the claim to ${LV(it.shownN)}: that's all it needs` : `Write ${missing[0]}, or lower the claim`}`,
        { claimed: it.depth, shown: LV(it.shownN), missing, lower: enough });
    } else if (it.shownN > it.claimedN) {
      add('N22', 'info', it, `has content through ${LV(it.shownN)} but claims ${it.depth}: raise its depth if those questions are answered`);
    }
    if (it.built || it.codePaths.length) builtNudges(model, it, add);
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
 * deepestN, the deepest level with any. No levelled text at all counts as nothing written (`unmarked`): a claim is
 * never taken on trust. levelWords 0 turns the check off: null (nothing measured).
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
  it.unmarked = !any;
  it.levelWords = w;
  Object.assign(it, reach(w, min));
}
const reach = (w, min) => {
  let shownN = -1;
  while (shownN + 1 < w.length && w[shownN + 1] >= min) shownN++;
  return { shownN, deepestN: w.reduce((d, x, i) => (x >= min ? i : d), -1) };
};

/** N23–N25: a built item whose design changed after its code, one built ahead of its design, a code path that's gone. */
function builtNudges(model, it, add) {
  const root = model.cfg.root, done = it.built === 'yes' || it.built === 'partly';
  const missing = it.codePaths.filter((p) => (isGlob(p) ? !globMatches(root, p) : !fs.existsSync(path.join(root, p))));
  if (missing.length && done) add('N25', 'warn', it, `code: ${missing.join(', ')} ${missing.length > 1 ? "match" : "matches"} nothing: fix the path, or remove it`);
  if (done && it.targetN != null && it.depthN < it.targetN) add('N24', 'warn', it, `built ${it.built}, but designed only to ${at(it)} of ${LV(it.targetN)}: built ahead of its design. Write the missing levels from the code, or lower the target`);
  const code = it.codePaths.filter((p) => !missing.includes(p));
  if (!done || !code.length || !model.clock) return;
  const docT = model.clock([it.file, ...(it.parts || []).map((p) => p.file)]), codeT = model.clock(code.map((p) => (isGlob(p) ? `:(glob)${p}` : p)));
  const day = (t) => { const d = new Date(t * 1000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }; // local, as people write dates
  // `built: yes (2026-10-30)`: the code was checked against the design that day, so only later design changes count
  if (docT == null || codeT == null || docT <= codeT || (it.builtChecked && day(docT) <= it.builtChecked)) return;
  it.drift = { doc: new Date(docT * 1000).toISOString(), code: new Date(codeT * 1000).toISOString() };
  add('N23', 'warn', it, `built, but its design changed after the code (design ${day(docT)}${docT === model.clock.now ? ', not committed' : ''}, code ${day(codeT)}): check the code still matches, then write the day you checked (built: ${it.built} (${day(model.clock.now)})), or set built: partly`, { drift: it.drift });
}

const isGlob = (p) => /[*?]/.test(p);
/** Whether a `code:` glob matches any file (paths relative to the project root, may start with ../); stops at the first. */
function globMatches(root, glob) {
  const re = globRe(glob), base = glob.slice(0, glob.search(/[*?]/)).replace(/[^/]*$/, '').replace(/\/$/, '') || '.';
  const walk = (rel) => { let es; try { es = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return false; }
    return es.some((e) => e.name !== '.git' && e.name !== 'node_modules' && (e.isDirectory() ? walk(path.posix.join(rel, e.name)) : re.test(path.posix.join(rel, e.name)))); };
  return walk(base);
}

/**
 * The code map (@code-map): the items whose `code:` covers a file, as an exact path, a folder or a glob. `file` is
 * relative to the project root (it may start with ../ for code outside the design folder). Current items only.
 */
export function itemsForFile(model, file) {
  const f = path.posix.normalize(file);
  return model.items.filter((it) => (it.codePaths || []).some((p) => {
    const c = p.replace(/\/$/, '');
    return isGlob(c) ? globRe(c).test(f) : f === c || f.startsWith(`${c}/`);
  }));
}

const isBuilt = (it) => it.built === 'yes' || it.built === 'partly';

/** The hard gate (@hard-gate): the items that refuse an edit to `file` (relative to the project root): current
 *  items that map it in `code:`, aren't built (`built:` no or unmarked) and whose gate isn't ready. A file a built
 *  item also maps is shared code that keeps moving: nothing holds it, and `fileReport` notes the plans instead. A
 *  file that a ready item plans is open too: that item may build there, even while others planning it aren't ready. */
export function gateFor(model, file) {
  const items = itemsForFile(model, file);
  if (items.some((it) => isBuilt(it) || gate(model, it).ready)) return [];
  return items.filter((it) => !isBuilt(it))
    .map((it) => ({ it, g: gate(model, it) })).filter(({ g }) => !g.ready)
    .map(({ it, g }) => ({ id: it.id || it.title, title: it.title, file: it.file, depth: at(it), target: LV(it.targetN), why: g.why }));
}

/** What a file belongs to, for people and agents: each item with its depth, built state, drift and contract links
 *  (relative to `base`, the folder the reader works in; default the project root). */
export function fileReport(model, file, base = model.cfg.root) {
  const at = (p) => path.relative(base, path.resolve(model.cfg.root, p)).split(path.sep).join('/');
  const items = itemsForFile(model, file), shared = items.some(isBuilt);
  return items.map((it) => ({ id: it.id || it.title, title: it.title, file: it.file, depth: it.depth, shown: LV(it.depthN),
    target: LV(it.targetN), status: it.status, ...(it.built ? { built: it.built } : {}), ...(it.drift ? { drift: it.drift } : {}),
    ...(!isBuilt(it) && !gate(model, it).ready ? (shared ? { plans: true } : { blocks: true }) : {}),
    doc: at(it.file), ready: gate(model, it).ready, contract: (it.parts || []).map((p) => `${at(p.file)}${p.anchor ? `#${p.anchor}` : ''}`) }));
}

/** When paths last changed, from git: an uncommitted change is now, else the last commit's time. Null outside git. */
function gitClock(cfg) {
  const run = (args) => execFileSync('git', args, { cwd: cfg.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try { run(['rev-parse', '--git-dir']); } catch { return null; }
  const now = Math.floor(Date.now() / 1000), cache = new Map();
  const clock = (paths) => {
    const k = paths.join('\0');
    if (!cache.has(k)) {
      try { cache.set(k, run(['status', '--porcelain', '--', ...paths]).trim() ? now : Number(run(['log', '-1', '--format=%ct', '--', ...paths]).trim()) || null); }
      catch { cache.set(k, null); }
    }
    return cache.get(k);
  };
  clock.now = now;
  return clock;
}

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

/**
 * What each item is connected to, both ways (ROADMAP §4, @related): Map item → [{ key, kind, level?, blocked? }].
 * Kinds: uses / used-by (dependencies, with the level needed and whether it blocks), mentions / mentioned-by (an @id in
 * the committed text that isn't already a use, a parent or a child), changed-with (an @id in a decision log: the changes
 * went together; same both ways), supersedes / superseded-by, and inside / contains (sub-items).
 */
export function related(model) {
  const rel = new Map(model.all.map((it) => [it, []]));
  const link = (a, b, kind, back, extra = {}) => { if (!a || !b || a === b) return;
    if (!rel.get(a).some((r) => r.key === b.key && r.kind === kind)) rel.get(a).push({ key: b.key, kind, ...extra });
    if (back && !rel.get(b).some((r) => r.key === a.key && r.kind === back)) rel.get(b).push({ key: a.key, kind: back, ...extra }); };
  for (const it of model.all) {
    for (const u of it.uses) link(it, u.item, 'uses', 'used-by', { level: u.level || LV(u.item?.targetN), blocked: !!u.item && u.item.lifecycle === 'current' && (u.level ? lv(u.level) : u.item.targetN ?? -1) > u.item.depthN });
    for (const m of it.mentions) { const x = model.byId.get(m); if (x && !it.uses.some((u) => u.item === x) && !x.uses.some((u) => u.item === it) && x !== it.parent && x.parent !== it) link(it, x, 'mentions', 'mentioned-by'); }
    for (const m of it.historyMentions || []) link(it, model.byId.get(m), 'changed-with', 'changed-with');
    if (it.supersededBy) link(it, model.byId.get(it.supersededBy.id), 'superseded-by', 'supersedes');
    if (it.parent) link(it, it.parent, 'inside', 'contains');
  }
  return rel;
}

/** An item's role: `shared` when it lives in anaxi.json's `shared` folder, `foundation` when shared and using nothing
 *  current (a stack, a platform), else `feature`. */
export function roleOf(cfg, it) {
  const dir = cfg.shared ? `${path.posix.normalize(cfg.shared).replace(/\/$/, '')}/` : null;
  return !dir || !it.file.startsWith(dir) ? 'feature' : it.uses.some((u) => u.item && u.item.lifecycle === 'current') ? 'shared' : 'foundation';
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
/** "✓", "◐", "·", "2/3" (a host's marked sub-items), or "" when unmarked (FORMAT.md §2). */
export function builtText(it) {
  const own = { yes: '✓', partly: '◐', no: '·' }[it.built] || '';
  const p = it.builtParts, roll = p ? `${p.yes}/${p.yes + p.partly + p.no}` : '';
  return [own, roll].filter(Boolean).join(' ');
}
export const usesBuilt = (items) => items.some((it) => it.built || it.code?.length);

export function renderIndex(model, indexPath) {
  const { cfg, items } = model;
  const B = usesBuilt(model.all);
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
    return `| ${icon(it.status)} | ${it.parent ? '↳ ' : ''}${link(it)}${it.id ? ` \`${it.id}\`` : ''}${parts.length ? ` · parts: ${parts.join(', ')}` : ''} | ${it.depth ? at(it) : '—'} | ${targetText(it)} |${B ? ` ${builtText(it) || '—'} |` : ''} ${uses.join(', ') || '—'} | ${usedBy(it).join(', ') || '—'} | ${it.openList.length} |`;
  });
  const NI = { N02: '⛔', N15: '⛔', N03: '❓', N01: '⬇️', N05: '⚠️', N06: '✂️', N14: '❓', N10: '⏸️', N13: 'ℹ️', N23: '⚠️', N24: '⚠️', N25: '⚠️' };
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
    `| | Item | Depth | Target |${B ? ' Built |' : ''} Uses | Used by | Open |`,
    `|---|---|---|---|${B ? '---|' : ''}---|---|---|`,
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
    `<sub>${icon('enough')} enough · ${icon('gap')} go deeper · ${icon('blocked')} blocked · ${icon('open')} open · ${icon('trim')} over-documented · ${icon('later')} later${B ? ' · built ✓ yes, ◐ partly, · no, k/n of its parts' : ''}${(model.inactive || []).length ? ` · ${icon('superseded')} superseded · ${icon('retired')} retired · ${icon('archived')} archived` : ''}. Structural nudges only; the skill and reviewers add the ones that need reading (N05, N07, N08, N12, N16, N17).</sub>`,
    '',
  ].join('\n');
}

export { slug };
