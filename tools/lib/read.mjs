// Reading an item at a depth (ROADMAP step 3–4): the lines it owns, split into blocks that each carry a level, and
// the bounded context an agent needs before building. Used by `anaxi-check context`, anaxi-watch and anaxi-mcp.
import fs from 'node:fs';
import path from 'node:path';
import { LEVELS, lv, top } from './config.mjs';

// The ladder's own names as paragraph lead-ins ("**Why.**", "**Shape.**") carry levels, like headings do.
// Project level names (anaxi.json `levels`) are added by leadIns().
const LEADIN = { why: 'D0', context: 'D0', what: 'D1', behaviour: 'D1', behavior: 'D1', shape: 'D2', design: 'D2',
  contract: 'D3', contracts: 'D3', interface: 'D3', build: 'D4', steps: 'D4', plan: 'D4' };

function leadIns(cfg) {
  const map = { ...LEADIN };
  for (const [k, v] of Object.entries(cfg?.levels || {})) if (v?.name) map[v.name.toLowerCase()] = k;
  for (const [w, l] of Object.entries(map)) if (lv(l) < 0) map[w] = LEVELS[top()];
  const words = Object.keys(map).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // not inside inline code: a doc that writes about `**Why.**` isn't levelled by it
  return { map, split: new RegExp(`(?<!\`)(?=\\*\\*(?:${words.join('|')})\\.\\*\\*)`, 'i') };
}

const fence = (l) => /^\s*(```|~~~)/.test(l);
const MARK = /^>\s*(@|depth:|part-of:|open:|superseded-by:|supersedes:|retired:)|^<!--\s*anaxi:/;

/** The lines an item owns: a whole file after its front matter, or its heading down to the next heading of the same
 *  or a higher level (outside code fences). Then each part's heading and what's under it. */
export function regions(model, it, read) {
  read ||= (rel) => fs.readFileSync(path.join(model.cfg.root, rel), 'utf8');
  const cut = (file, line, whole) => {
    const lines = read(file).split('\n');
    let start = line - 1, end = lines.length;
    if (whole) start = lines[0]?.trim() === '---' ? lines.findIndex((l, i) => i > 0 && l.trim() === '---') + 1 : 0;
    else {
      const h = (lines[start]?.match(/^(#+)\s/) || ['', '#'])[1].length;
      let inF = false;
      for (let i = start + 1; i < lines.length; i++) {
        if (fence(lines[i])) inF = !inF;
        const m = !inF && lines[i].match(/^(#+)\s/);
        if (m && m[1].length <= h) { end = i; break; }
      }
    }
    return { file, from: start, lines: lines.slice(start, end) };
  };
  return [cut(it.file, it.line, it.declared === 'front-matter'),
    ...(it.parts || []).map((p) => ({ ...cut(p.file, p.line, !p.anchor), part: p.title }))];
}

/**
 * An item's content as blocks: { kind: title|heading|para|list|table|code|mark, level, text, file, line, depth?, lead? }.
 * A heading's level is the checker's section level (by line); a lead-in paragraph sets its own level (a paragraph with
 * several lead-ins is split at each); other blocks inherit the level above them. Levels: D0…Dn, canvas, history,
 * questions, or null (before any level: always shown).
 */
export function blocks(model, it, read) {
  const { map, split } = leadIns(model.cfg);
  const out = [];
  for (const r of regions(model, it, read)) {
    const secs = (it.sections || []).filter((s) => (s.file || it.file) === r.file);
    let level = null, cur = null, inF = false;
    const flush = () => {
      if (!cur) return;
      if (cur.kind === 'para') {
        for (const c of cur.text.join(' ').split(split).filter((x) => x.trim())) {
          const m = c.match(/^\*\*([^*.]+)\.\*\*/);
          const l = m && map[m[1].toLowerCase()];
          if (l) level = l;
          out.push({ ...cur, level, text: [c.trim()], lead: !!l });
        }
      } else out.push(cur);
      cur = null;
    };
    r.lines.forEach((line, k) => {
      const n = r.from + k + 1;
      if (fence(line)) {
        if (!inF) { flush(); cur = { kind: 'code', level, text: [line], file: r.file, line: n }; inF = true; }
        else { cur.text.push(line); inF = false; flush(); }
        return;
      }
      if (inF) { cur.text.push(line); return; }
      const hm = line.match(/^(#{1,6})\s+(.*)$/);
      if (hm) {
        flush();
        const sec = secs.find((s) => s.line === n);
        if (sec) level = sec.level;
        const title = k === 0 && !r.part && it.declared !== 'front-matter';
        out.push({ kind: title ? 'title' : 'heading', depth: hm[1].length, level: title ? null : level, text: [hm[2]], file: r.file, line: n, ...(r.part ? { part: r.part } : {}) });
        return;
      }
      const last = out[out.length - 1];
      if (MARK.test(line) || (!cur && /^>/.test(line) && last?.kind === 'mark' && last.line + last.text.length === n)) { // a tag, or its wrapped next line
        flush();
        if (last?.kind === 'mark' && last.line + last.text.length === n) last.text.push(line); else out.push({ kind: 'mark', level: null, text: [line], file: r.file, line: n });
        return;
      }
      if (!line.trim()) { flush(); return; }
      const kind = /^\s*\|/.test(line) ? 'table' : /^\s*([-*+]|\d+\.)\s/.test(line) ? 'list' : 'para';
      if (kind === 'para' && cur?.kind === 'list') { cur.text[cur.text.length - 1] += ` ${line.trim()}`; return; } // a wrapped list item
      if (cur && cur.kind === kind) cur.text.push(line);
      else { flush(); cur = { kind, level, text: [line], file: r.file, line: n }; }
    });
    flush();
  }
  return out;
}

/** What shows at depth `at` (a number): levels ≤ at; the canvas and history only when asked; unlevelled always. */
export function visible(b, at, { canvas = false, history = false } = {}) {
  if (b.kind === 'mark') return false;
  if (b.level === 'canvas') return canvas;
  if (b.level === 'history') return history;
  if (b.level == null || b.level === 'questions' || lv(b.level) < 0) return true;
  return lv(b.level) <= at;
}

export const words = (bs) => bs.reduce((s, b) => s + (b.kind === 'mark' ? 0 : b.text.join(' ').split(/\s+/).filter(Boolean).length), 0);
const asMarkdown = (bs) => bs.map((b) => (b.kind === 'heading' ? `${'#'.repeat(b.depth)} ${b.text[0]}` : b.text.join('\n'))).join('\n\n');

/**
 * The bounded context for building or reviewing an item: the item at depth `at` (default: its target), plus each
 * item it uses, transitively and once each, at the level asked for (`uses: @x (D3)`) or the used item's target.
 * A superseded or retired item is replaced by its successor unless `history` is asked for.
 */
export function context(model, start, { at, history = false, read } = {}) {
  let it = start, note = null;
  if (!history && it.lifecycle && it.lifecycle !== 'current') {
    note = `${it.id || it.title} is ${it.lifecycle}${it.successor ? `; showing its successor ${it.successor.id || it.successor.title}` : ' and has no successor'}`;
    if (it.successor) it = it.successor;
  }
  const level = at != null ? (typeof at === 'string' ? lv(at) : at) : it.targetN ?? it.claimedN ?? top();
  const take = (x, l) => {
    const bs = blocks(model, x, read).filter((b) => b.kind !== 'title' && visible(b, l, { history }));
    return { id: x.id, title: x.title, file: x.file, line: x.line, depth: x.depth, shown: LEVELS[x.depthN] ?? null, target: LEVELS[x.targetN] ?? null,
      status: x.status, at: LEVELS[Math.min(l, top())], words: words(bs), markdown: asMarkdown(bs) };
  };
  const main = take(it, level);
  const seen = new Set([it]), uses = [];
  const walk = (x) => {
    for (const u of x.uses || []) {
      const d = u.item && (u.item.lifecycle && u.item.lifecycle !== 'current' && !history && u.item.successor ? u.item.successor : u.item);
      if (!d || seen.has(d)) continue;
      seen.add(d);
      uses.push({ ...take(d, u.level ? lv(u.level) : d.targetN ?? d.claimedN ?? 0), via: x.id || x.title, ...(d !== u.item ? { replaces: u.item.id } : {}) });
      walk(d);
    }
  };
  walk(it);
  return { format: 'anaxi/1', note, item: main, uses, gate: null };
}
