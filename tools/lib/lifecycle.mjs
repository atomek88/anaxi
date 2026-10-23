// Moving items between lifecycle states (FORMAT.md §10): supersede, retire, archive, restore, delete.
// Edits only the marks, moves only whole files, and rewrites the links that pointed at a moved file.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { docFiles, retiredFile } from './config.mjs';

const P = path.posix;
const name = (it) => it.id || `"${it.title}"`;
const clean = (s) => String(s || '').replace(/["\n]/g, "'").trim();
const today = () => new Date().toISOString().slice(0, 10);

/** Run one transition. Returns { log }. Throws with a message the CLI prints. */
export function transition(model, cmd, o) {
  const { cfg } = model;
  const it = o.item;
  const log = [];
  const edits = []; // { it, key, value } (value null removes the field)
  const moves = []; // { from, to }
  let removeFile = null, retiredRow = null;

  if (!it.id && cmd !== 'restore') throw new Error(`${cmd} needs an item with an @id; give "${it.title}" one first`);

  if (cmd === 'supersede') {
    const by = o.by;
    if (!by) throw new Error('supersede needs --by @new');
    if (by === it) throw new Error('an item can\'t supersede itself');
    if (by.lifecycle !== 'current') throw new Error(`${name(by)} is ${by.lifecycle}; supersede with a current item`);
    if (it.lifecycle === 'retired' || (it.retired && !it.supersededBy)) edits.push({ it, key: 'retired', value: null });
    edits.push({ it, key: 'superseded-by', value: `${by.id}${o.why ? ` (${clean(o.why)})` : ''}` });
    if (it.supersededBy && it.supersededBy.id !== by.id) {
      const prev = model.byId.get(it.supersededBy.id);
      if (prev) edits.push({ it: prev, key: 'supersedes', value: listWithout(prev.supersedes, it.id) });
    }
    if (!by.supersedes.includes(it.id)) edits.push({ it: by, key: 'supersedes', value: [...by.supersedes, it.id] });
    log.push(`${name(it)} superseded by ${name(by)}${o.why ? ` (${clean(o.why)})` : ''}`);
    if (it.allOpen.length) log.push(`  ${name(it)} still has ${it.allOpen.length} open question(s): move them to ${name(by)}, or close them (N20)`);
    const users = model.items.filter((x) => x !== by && x.uses.some((u) => u.item === it));
    if (users.length) log.push(`  used by ${users.map(name).join(', ')}: point them at ${name(by)} (N18)`);
  } else if (cmd === 'retire') {
    if (!o.why) throw new Error('retire needs --why "…": the reason is what makes the old doc useful later');
    if (it.lifecycle !== 'current') throw new Error(`${name(it)} is already ${it.lifecycle}; restore it first to change that`);
    edits.push({ it, key: 'retired', value: `${o.date || today()} (${clean(o.why)})` });
    log.push(`${name(it)} retired ${o.date || today()} (${clean(o.why)})`);
    const users = model.items.filter((x) => x.uses.some((u) => u.item === it));
    if (users.length) log.push(`  used by ${users.map(name).join(', ')}: they need another dependency, or to be retired too (N18)`);
  } else if (cmd === 'archive') {
    if (it.declared !== 'front-matter') throw new Error(`only a whole-file item (front matter) can be archived; ${name(it)} is a section of ${it.file}. Supersede or retire it in place, or move it under a "Decision log" heading`);
    if (it.lifecycle === 'archived') throw new Error(`${name(it)} is already in the archive`);
    if (it.lifecycle === 'current') {
      if (!o.why) throw new Error(`${name(it)} is current. Supersede or retire it first, or pass --why "…" to retire it now`);
      edits.push({ it, key: 'retired', value: `${o.date || today()} (${clean(o.why)})` });
    }
    const to = P.join(cfg.archive, P.basename(it.file));
    if (fs.existsSync(path.join(cfg.root, to))) throw new Error(`${to} already exists; rename one of them first`);
    edits.push({ it, key: 'archived-from', value: it.file });
    moves.push({ from: it.file, to });
    log.push(`${name(it)} archived: ${it.file} → ${to}`);
  } else if (cmd === 'restore') {
    if (it.lifecycle === 'current') throw new Error(`${name(it)} is already current`);
    if (it.supersededBy) {
      edits.push({ it, key: 'superseded-by', value: null });
      const by = model.byId.get(it.supersededBy.id);
      if (by?.supersedes.includes(it.id)) edits.push({ it: by, key: 'supersedes', value: listWithout(by.supersedes, it.id) });
    }
    if (it.retired) edits.push({ it, key: 'retired', value: null });
    if (it.lifecycle === 'archived') {
      const back = it.archivedFrom;
      if (!back) throw new Error(`${name(it)} has no archived-from: move ${it.file} back by hand, then run restore again`);
      if (fs.existsSync(path.join(cfg.root, back))) throw new Error(`${back} exists again; move it away first`);
      edits.push({ it, key: 'archived-from', value: null });
      moves.push({ from: it.file, to: back });
    }
    log.push(`${name(it)} is current again${moves.length ? `: ${it.file} → ${moves[0].to}` : ''}`);
  } else if (cmd === 'delete') {
    if (it.lifecycle !== 'archived') throw new Error(`only archived items can be deleted; run: anaxi-check archive ${name(it)} first`);
    const abs = path.join(cfg.root, it.file);
    let commit = '—';
    try {
      execFileSync('git', ['-C', cfg.root, 'ls-files', '--error-unmatch', it.file], { stdio: 'ignore' });
      if (execFileSync('git', ['-C', cfg.root, 'status', '--porcelain', '--', it.file], { encoding: 'utf8' }).trim()) throw new Error('changed');
      commit = execFileSync('git', ['-C', cfg.root, 'log', '-1', '--format=%h', '--', it.file], { encoding: 'utf8' }).trim() || '—';
    } catch {
      if (!o.force) throw new Error(`${it.file} isn't committed as it is, so deleting it would lose it. Commit it first (or pass --force)`);
    }
    const refs = model.all.filter((x) => x !== it && x.lifecycle === 'current'
      && (x.uses.some((u) => u.item === it) || x.mentions.has(it.id)));
    if (refs.length) log.push(`  still mentioned by ${refs.map(name).join(', ')}: those references will show as deleted`);
    const linkers = docFiles(cfg).filter((f) => f !== it.file && [...fs.readFileSync(path.join(cfg.root, f), 'utf8')
      .matchAll(/\]\(([^)\s#]+)/g)].some((m) => !/^[a-z]+:/i.test(m[1]) && P.normalize(P.join(P.dirname(f), m[1])) === it.file));
    if (linkers.length) log.push(`  linked from ${linkers.join(', ')}: those links will break; point them at ${it.supersededBy?.id || 'the successor'} or ${retiredFile(cfg)}`);
    removeFile = abs;
    retiredRow = `| ${it.id} | ${it.retired?.date || today()} | ${clean(it.supersededBy?.reason || it.retired?.reason || '')} | ${it.supersededBy?.id || '—'} | ${commit} |`;
    log.push(`${name(it)} deleted: ${it.file} (git ${commit}); its id is kept in ${retiredFile(cfg)}`);
  } else throw new Error(`unknown lifecycle command ${cmd}`);

  if (o.dryRun) return { log: ['(dry run: nothing written)', ...log] };

  // marks first, bottom-up within a file so line numbers stay right; then moves; then deletes
  edits.sort((a, b) => a.it.file.localeCompare(b.it.file) || b.it.line - a.it.line);
  for (const e of edits) setField(cfg, e.it, e.key, e.value);
  for (const m of moves) {
    fs.mkdirSync(path.dirname(path.join(cfg.root, m.to)), { recursive: true });
    fs.renameSync(path.join(cfg.root, m.from), path.join(cfg.root, m.to));
    const n = rewriteLinks(cfg, m.from, m.to);
    if (n) log.push(`  links updated in ${n} file${n > 1 ? 's' : ''}`);
  }
  if (removeFile) {
    fs.rmSync(removeFile);
    const rf = path.join(cfg.root, retiredFile(cfg));
    if (!fs.existsSync(rf)) {
      fs.mkdirSync(path.dirname(rf), { recursive: true });
      fs.writeFileSync(rf, '# Retired ids\n\nDeleted items. Their text is in git history at the commit shown; their ids are not reused.\n\n| Id | Retired | Why | Successor | Last commit |\n|---|---|---|---|---|\n');
    }
    fs.appendFileSync(rf, `${retiredRow}\n`);
  }
  return { log };
}

const listWithout = (list, id) => { const l = list.filter((x) => x !== id); return l.length ? l : null; };

function fmValue(key, value) {
  if (Array.isArray(value)) return `[${value.map((v) => `"${v}"`).join(', ')}]`;
  return `"${value}"`;
}
const tagValue = (value) => (Array.isArray(value) ? value.join(', ') : value);

/** In one tag-line or comment line, replace or drop the `key: …` segment, keeping the rest as written. */
function editSegments(line, key, value) {
  const m = line.match(/^(>\s?|.*?<!--\s*anaxi:\s*|)(.*?)(\s*-->.*)?$/);
  const [, pre, body, post = ''] = m;
  const segs = body.split(/\s+[·|]\s+/);
  const i = segs.findIndex((x) => x.trim().startsWith(`${key}:`));
  if (value == null) segs.splice(i, 1); else segs[i] = `${key}: ${tagValue(value)}`;
  return `${pre}${segs.join(' · ')}${post}`;
}

/** Set (or remove, with null) one field in an item's mark, in whichever form it was declared. */
export function setField(cfg, it, key, value) {
  const abs = path.join(cfg.root, it.file);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const keyRe = new RegExp(`^${key}:`);

  if (it.declared === 'front-matter') {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    const at = lines.slice(1, end).findIndex((l) => keyRe.test(l));
    if (value == null) { if (at >= 0) lines.splice(at + 1, 1); }
    else if (at >= 0) lines[at + 1] = `${key}: ${fmValue(key, value)}`;
    else lines.splice(end, 0, `${key}: ${fmValue(key, value)}`);
  } else {
    const h = it.line - 1; // the heading
    let j = h + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (it.declared === 'tag' || it.declared === 'comment') {
      let endLine = j;
      if (it.declared === 'tag') while (endLine + 1 < lines.length && lines[endLine + 1].startsWith('>')) endLine++;
      else while (endLine < lines.length - 1 && !lines[endLine].includes('-->')) endLine++;
      let k = j;
      while (k <= endLine && !new RegExp(`(^|[\\s>:])${key}:`).test(lines[k])) k++;
      if (k <= endLine) lines[k] = editSegments(lines[k], key, value);
      else if (value != null) {
        lines[endLine] = it.declared === 'tag' ? `${lines[endLine].replace(/\s+$/, '')} · ${key}: ${tagValue(value)}`
          : lines[endLine].replace(/\s*-->/, ` · ${key}: ${tagValue(value)} -->`);
      }
    } else if (value != null) { // a heading badge: add a tag line carrying the same depth
      const d = `${it.depth}${it.arrow ? ` → ${it.arrow}` : ''}${it.enough ? ' 🎯' : ''}`;
      lines.splice(h + 1, 0, '', `> depth: ${d} · ${key}: ${tagValue(value)}`);
    }
  }
  fs.writeFileSync(abs, lines.join('\n'));
}

/** After moving `from` → `to` (project-relative), fix markdown links to it, and the moved file's own links. */
export function rewriteLinks(cfg, from, to) {
  const files = new Set(docFiles(cfg));
  files.add(to);
  let changed = 0;
  for (const f of files) {
    const abs = path.join(cfg.root, f);
    if (!fs.existsSync(abs)) continue;
    const was = f === to ? from : f; // where this file's relative links were written from
    const text = fs.readFileSync(abs, 'utf8');
    const out = text.replace(/(\]\()([^)\s#]+)(#[^)\s]*)?\)/g, (m, open, p, hash = '') => {
      if (/^[a-z]+:/i.test(p) || p.startsWith('/')) return m;
      const target = P.normalize(P.join(P.dirname(was), p));
      const now = target === from ? to : target;
      if (f !== to && target !== from) return m;
      const rel = P.relative(P.dirname(f), now) || P.basename(now);
      return `${open}${rel}${hash})`;
    });
    if (out !== text) { fs.writeFileSync(abs, out); changed++; }
  }
  return changed;
}
