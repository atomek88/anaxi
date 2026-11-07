// Reads Anaxi marks from ordinary markdown (FORMAT.md, tools/SPEC.md §3). No judgment, only marks.

// FORMAT.md §4: heading names → level. `sections` in anaxi.json adds to this.
export const SECTION_NAMES = {
  D0: ['summary', 'overview', 'tl;dr', 'tldr', 'context', 'background', 'problem', 'motivation', 'goals', 'non-goals',
    'success metrics', 'why'],
  D1: ['requirements', 'user stories', 'use cases', 'scope', 'out of scope', 'acceptance criteria', 'behavior',
    'behaviour', 'user experience', 'user flow', 'edge cases', 'dependencies'],
  D2: ['design', 'architecture', 'high-level design', 'approach', 'solution', 'alternatives considered', 'tech stack',
    'decisions', 'trade-offs', 'tradeoffs', 'risks', 'cross-cutting concerns', 'security', 'privacy', 'observability',
    'scalability', 'cost'],
  D3: ['api', 'apis', 'interfaces', 'contracts', 'data model', 'schema', 'events', 'messages', 'error handling',
    'failure modes', 'state machine', 'compatibility', 'versioning', 'limits'],
  D4: ['implementation', 'implementation plan', 'tasks', 'work breakdown', 'milestones', 'code', 'examples', 'testing',
    'test plan', 'rollout', 'migration plan', 'deployment'],
  canvas: ['canvas', 'sketch', 'sketches', 'ideas', 'brainstorm', 'notes', 'thoughts', 'visuals', 'mockups', 'appendix'],
  // replaced content kept for its reasoning (FORMAT.md §10): kept and labelled, never counted, like the canvas
  history: ['decision log', 'history', 'superseded', 'retired', 'previous design'],
  questions: ['open questions', 'questions', 'faq'],
};

export const KNOWN_FIELDS = new Set(['anaxi', 'depth', 'risk', 'target', 'about', 'uses', 'open', 'skip', 'caveats',
  'later', 'focus', 'profile', 'part-of', 'parts', 'built', 'code', 'superseded-by', 'supersedes', 'retired', 'archived-from']);

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const CHECK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const STOP = new Set(['the', 'our', 'proposed', 'detailed', 'a', 'an']);

/** GitHub-style heading anchor. */
export const slug = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

/** Split on `sep` outside (), [] and quotes. */
export function splitTop(s, sep = ',') {
  const out = [];
  let depth = 0, cur = '';
  for (const c of s) {
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth = Math.max(0, depth - 1);
    if (c === sep && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

export function parseDepth(s) {
  const m = String(s).trim().match(/^(D\d)\b\s*(?:(?:→|->)\s*(D\d)\b|(enough|🎯))?/u);
  return m ? { depth: m[1], arrow: m[2] || null, enough: !!m[3] } : null;
}

// a tag line writes lists bare (`a, b`) or in brackets (`[a, b]`), like front matter
const asList = (v) => (Array.isArray(v) ? v.map(String) : v == null ? [] : splitTop(String(v).trim().replace(/^\[([^]*)\]$/, '$1')));

function parseRefs(v) {
  const s = Array.isArray(v) ? v.join(', ') : String(v ?? '');
  const refs = [];
  const re = /\[([^\]]*)\]\(([^)\s]+)\)(?:\s*\((D\d)\))?|@([A-Za-z][\w-]*)(?:\s*\((D\d)\))?/g;
  for (const m of s.matchAll(re)) {
    if (m[2] !== undefined) {
      const [p, anchor] = m[2].split('#');
      const t = m[1].trim().match(/^@([A-Za-z][\w-]*)$/);
      refs.push({ id: t ? `@${t[1]}` : null, path: p || null, anchor: anchor || null, level: m[3] || null, raw: m[0] });
    } else refs.push({ id: `@${m[4]}`, path: null, anchor: null, level: m[5] || null, raw: m[0] });
  }
  return refs;
}

/** Turns raw key → value fields into an item's normalized fields. Problems go to `errs`. */
export function normalizeFields(raw, errs, where) {
  const f = { unknown: [] };
  for (const [k, v] of Object.entries(raw)) {
    const val = Array.isArray(v) ? v : String(v ?? '').trim();
    switch (k) {
      case 'anaxi': case 'id': f.id = String(val).replace(/^@?/, '@'); break;
      case 'depth': {
        const d = parseDepth(val);
        if (d) Object.assign(f, d); else errs.push(`${where}: can't read depth "${val}"`);
        break;
      }
      case 'risk': {
        const n = String(val).split(/[·.,/\s]+/).filter(Boolean).map(Number);
        if (n.some((x) => !(x >= 0 && x <= 2 && Number.isInteger(x)))) errs.push(`${where}: risk scores must be 0–2, got "${val}"`);
        else f.risk = n;
        break;
      }
      case 'target': {
        const m = String(val).match(/^(D\d)\s*(?:\((.*)\))?/);
        if (!m) errs.push(`${where}: can't read target "${val}"`);
        else f.target = { level: m[1], reason: m[2] || null };
        break;
      }
      case 'about': f.about = asList(val).map((x) => x.toLowerCase()); break;
      case 'uses': f.uses = parseRefs(val); break;
      case 'open': f.open = (Array.isArray(val) ? val : String(val).split(';')).map((x) => String(x).trim()).filter(Boolean); break;
      case 'skip':
        f.skip = asList(val).map((x) => {
          const m = x.match(/^(\S+)\s*(?:\((.*)\))?$/);
          if (!m?.[2]) errs.push(`${where}: skip ${x} needs a reason in parentheses`);
          return { id: m ? m[1] : x, reason: m?.[2] || null };
        });
        break;
      case 'caveats': f.caveats = Array.isArray(val) ? val.join('; ') : val; break;
      case 'later':
        f.later = (Array.isArray(val) ? val : String(val).split(';')).map((x) => String(x).trim()).filter(Boolean).map((text) => {
          const m = text.match(/when\s+(@[A-Za-z][\w-]*)\s+reaches\s+(D\d)/);
          return { text, trigger: m ? { id: m[1], level: m[2] } : null };
        });
        break;
      case 'focus':
        if (!['now', 'next', 'later'].includes(val)) errs.push(`${where}: focus must be now, next or later`);
        else f.focus = val;
        break;
      case 'profile': f.profile = val; break;
      case 'part-of': f.partOf = String(val).replace(/^@?/, '@'); break;
      case 'parts': // detail kept elsewhere, listed from the item's side: `path#anchor (D3)` or `[text](path#anchor) (D3)`
        f.partRefs = asList(val).map((x) => {
          const m = String(x).trim().match(/^(?:\[[^\]]*\]\(([^)]+)\)|(\S+))\s*(?:\((D\d)\))?$/);
          if (!m) { errs.push(`${where}: can't read part "${x}" (write path#anchor (D3))`); return null; }
          const [p, a] = (m[1] || m[2]).split('#');
          return { path: p, anchor: a || '', level: m[3] || null, raw: String(x).trim() };
        }).filter(Boolean);
        break;
      case 'built': { // no | partly | yes, optionally with the day the code was last checked against the design
        const m = String(val).trim().match(/^(no|partly|yes)\s*(?:\(?\s*(\d{4}-\d{2}-\d{2})\s*\)?)?$/i);
        if (!m) errs.push(`${where}: built must be no, partly or yes, optionally with a date: built: yes (2026-10-30)`);
        else { f.built = m[1].toLowerCase(); if (m[2]) f.builtChecked = m[2]; }
        break;
      }
      case 'code': f.code = asList(val).map((x) => x.trim()).filter(Boolean); break;
      case 'superseded-by': {
        const m = String(val).match(/^@?([A-Za-z][\w-]*)\s*(?:\((.*)\))?/);
        if (!m) errs.push(`${where}: superseded-by needs an @id, e.g. superseded-by: @new (why)`);
        else f.supersededBy = { id: `@${m[1]}`, reason: m[2] || null };
        break;
      }
      case 'supersedes': f.supersedes = asList(val).map((x) => x.replace(/\s*\(.*\)$/, '').replace(/^@?/, '@')); break;
      case 'retired': {
        const m = String(val).match(/^(\d{4}-\d{2}-\d{2})?\s*(?:\((.*)\))?\s*$/);
        if (!m || (!m[1] && !m[2])) errs.push(`${where}: retired needs a date and a reason, e.g. retired: 2026-11-02 (cut from the plan)`);
        else f.retired = { date: m[1] || null, reason: m[2] || null };
        break;
      }
      case 'archived-from': f.archivedFrom = String(val); break;
      default: f.unknown.push(k);
    }
  }
  return f;
}

/** `@id · key: value · key: value` (tag lines and comments). */
export function parseFieldString(s) {
  const raw = {};
  let last = null;
  for (const part of s.split(/\s+[·|]\s+/)) {
    const p = part.trim();
    const m = p.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (m) { last = m[1].toLowerCase(); raw[last] = m[2]; }
    else if (/^@[A-Za-z][\w-]*$/.test(p) && !raw.anaxi) raw.anaxi = p;
    else if (last) raw[last] += ` · ${p}`;
  }
  return raw;
}

/** Just enough YAML for front matter: `key: value`, quoted strings, `[a, b]`, and `- item` lists. */
export function parseFrontMatter(lines) {
  const out = {};
  let key = null;
  const unq = (s) => s.trim().replace(/^(["'])(.*)\1$/, '$2');
  for (const line of lines) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key) { (out[key] = Array.isArray(out[key]) ? out[key] : []).push(unq(item[1].replace(/\s+#.*$/, ''))); continue; }
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!m) continue;
    key = m[1].toLowerCase();
    const q = m[2].trim().match(/^(["'])(.*?)\1/);
    const v = q ? q[0] : m[2].replace(/(^|\s)#.*$/, '').trim(); // drop YAML comments
    if (v.startsWith('[') && v.endsWith(']')) out[key] = splitTop(v.slice(1, -1)).map(unq);
    else out[key] = v === '' ? [] : unq(v);
  }
  return out;
}

export function sectionByName(text, names) {
  const norm = text.toLowerCase().replace(/[`*_:]/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').filter((w) => !STOP.has(w)).join(' ');
  let best = null, bestLen = 0;
  for (const [level, list] of Object.entries(names)) {
    for (const n of list) {
      if ((norm === n || norm.startsWith(`${n} `)) && n.length > bestLen) { best = level; bestLen = n.length; }
    }
  }
  return best;
}

/** Explicit section mark in a heading: "D2 Shape", a bare `D4` badge, 🎨, or a `superseded`/`retired` badge. */
function sectionByMark(text) {
  if (text.includes('🎨')) return 'canvas';
  if (/`(superseded|retired)\b[^`]*`/.test(text)) return 'history';
  const m = text.match(/^(D\d)\b/) || text.match(/`(D\d)`/);
  return m ? m[1] : null;
}

/** A level comment on its own line (`<!-- D3 -->`, `<!-- canvas -->`) at line j or after blanks: an invisible heading badge. */
function commentMark(lines, j) {
  while (j < lines.length && lines[j].trim() === '') j++;
  const m = lines[j]?.trim().match(/^<!--\s*(D\d|canvas)\s*-->$/i);
  return m ? (/^canvas$/i.test(m[1]) ? 'canvas' : m[1].toUpperCase()) : null;
}

/** A heading's title: badges (`@id`, a depth, superseded/retired) removed, other inline code kept as its text. */
const titleOf = (htext) => htext.replace(/`([^`]*)`/g, (_, c) => (/^@[A-Za-z][\w-]*$/.test(c.trim()) || parseDepth(c.trim()) || /^(superseded|retired)\b/.test(c.trim()) ? '' : c))
  .replace(/🎨/g, '').replace(/\s+/g, ' ').trim();

/**
 * Parse one file. Returns { items, untagged, errors, warnings }.
 * `names` is the heading-name table (SECTION_NAMES plus `sections` from anaxi.json).
 */
export function parseFile(text, file, names = SECTION_NAMES) {
  const lines = text.split(/\r?\n/);
  const items = [], untagged = [], errors = [], warnings = [];
  let start = 0;
  let fileItem = null;

  const newItem = (o) => ({ id: null, title: '', file, line: 1, declared: '', hlevel: 0, anchor: '', parent: null,
    children: [], depth: null, arrow: null, enough: false, risk: null, target: null, about: [], uses: [], open: [],
    skip: [], caveats: null, later: [], focus: null, profile: null, checklist: [], sections: [], mentions: new Set(), historyMentions: new Set(),
    supersededBy: null, supersedes: [], retired: null, archivedFrom: null, unknown: [], ...o });

  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (end > 0) {
      const fm = parseFrontMatter(lines.slice(1, end));
      start = end + 1;
      if (fm.anaxi !== undefined || fm.depth !== undefined || fm['part-of'] !== undefined) {
        const known = Object.fromEntries(Object.entries(fm).filter(([k]) => KNOWN_FIELDS.has(k)));
        const f = normalizeFields(known, errors, `${file}:1`);
        if (!f.depth && !f.partOf) errors.push(`${file}:1: front matter has no depth`);
        delete f.unknown; // other front-matter keys belong to the team's template
        fileItem = newItem({ ...f, declared: 'front-matter' });
        items.push(fileItem);
      }
    }
  }

  // stack of open items: { item, hlevel, sections: [{ hlevel, level }] }
  const stack = fileItem ? [{ item: fileItem, hlevel: 0, sections: [] }] : [];
  let inFence = false, canvasMark = false, outside = null, titleSet = false, inComment = false;
  const top = () => stack[stack.length - 1];

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line)) { inFence = !inFence; continue; }
    if (inFence) { if (outside) outside.words += line.split(/\s+/).filter(Boolean).length; continue; }
    const h = line.match(HEADING);
    if (h) {
      const hlevel = h[1].length, htext = h[2];
      canvasMark = false;
      while (stack.length && top().hlevel >= hlevel) stack.pop();
      if (fileItem && !titleSet && hlevel === 1) { fileItem.title = titleOf(htext); titleSet = true; }

      // declarations under the heading: a `>` tag line with depth:, or a <!-- anaxi: --> comment
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      let raw = null, declared = '', consumed = i, sectionNote = null;
      if (lines[j]?.startsWith('>')) {
        let k = j;
        const parts = [];
        while (k < lines.length && lines[k].startsWith('>')) parts.push(lines[k++].replace(/^>\s?/, '').trim());
        const joined = parts.filter(Boolean).join(' · ');
        // a tag line declares an item (depth: or part-of:), or adds fields to a heading that's already one by its badge
        const badged = /`@[A-Za-z][\w-]*`|`D\d[^`]*`/.test(htext);
        if (/(^|\s)(depth|part-of):/.test(joined) || (badged && /(^|\s)(built|code|uses|risk|about|caveats|later|focus):/.test(joined))) { raw = parseFieldString(joined); declared = 'tag'; consumed = k - 1; }
        else if (stack.length && /(^|\s)(superseded-by|retired):/.test(joined)) sectionNote = { text: joined, end: k - 1 };
      } else if (/^<!--\s*anaxi:/.test(lines[j]?.trim() || '')) {
        let k = j, s = '';
        while (k < lines.length) { s += ` ${lines[k]}`; if (lines[k].includes('-->')) break; k++; }
        raw = parseFieldString(s.replace(/.*<!--\s*anaxi:/, '').replace(/-->.*/, '').trim());
        declared = 'comment'; consumed = k;
      }

      // heading badges
      const badge = {};
      for (const m of htext.matchAll(/`([^`]+)`/g)) {
        const c = m[1].trim();
        if (/^@[A-Za-z][\w-]*$/.test(c)) badge.anaxi = c;
        else if (parseDepth(c)) badge.depth = c;
      }
      const bd = badge.depth && parseDepth(badge.depth);
      const inItem = stack.length > 0;
      const badgeItem = badge.anaxi || (bd && (bd.arrow || bd.enough || !inItem));
      const title = titleOf(htext);

      if (raw || badgeItem) {
        const where = `${file}:${i + 1}`;
        const merged = { ...(badgeItem ? badge : {}), ...(raw || {}) };
        if (raw && badgeItem && badge.depth && raw.depth && parseDepth(raw.depth)?.depth !== bd.depth) {
          warnings.push(`${where}: heading badge says ${badge.depth}, the tag says ${raw.depth}`);
        }
        const f = normalizeFields(merged, errors, where);
        if (!f.depth && !f.partOf) errors.push(`${where}: "${title}" is declared but has no depth`);
        const item = newItem({ ...f, title, line: i + 1, hlevel, anchor: slug(htext),
          declared: raw ? declared : 'badge', parent: inItem && !f.partOf ? top().item : null });
        if (item.parent) item.parent.children.push(item);
        items.push(item);
        stack.push({ item, hlevel, sections: [] });
        if (f.partOf) { // a part's own heading is its first section; a `D3` badge on it is that section's level
          delete item.depth; delete item.arrow; item.enough = false;
          const mark = sectionByMark(htext) || commentMark(lines, consumed + 1), level = mark || sectionByName(title, names);
          top().sections.push({ hlevel, level });
          item.sections.push({ heading: title, level, by: mark ? 'mark' : level ? 'name' : 'none', line: i + 1, words: 0 });
        }
        outside = null;
        i = consumed;
        continue;
      }

      if (!inItem) {
        outside = { heading: title, file, line: i + 1, words: 0 };
        untagged.push(outside);
        continue;
      }
      // a section inside the current item
      const t = top();
      while (t.sections.length && t.sections[t.sections.length - 1].hlevel >= hlevel) t.sections.pop();
      let level = sectionNote ? 'history' : sectionByMark(htext) || commentMark(lines, i + 1), by = 'mark';
      if (!level) { level = sectionByName(title, names); by = 'name'; }
      if (!level) { level = t.sections[t.sections.length - 1]?.level || null; by = level ? 'above' : 'none'; }
      t.sections.push({ hlevel, level });
      const sec = { heading: title, level, by, line: i + 1, words: 0 };
      if (sectionNote) { sec.note = sectionNote.text; i = sectionNote.end; }
      t.item.sections.push(sec);
      continue;
    }

    if (!stack.length) {
      if (outside) outside.words += line.split(/\s+/).filter(Boolean).length;
      continue;
    }
    const t = top();
    if (/^\s*<!--\s*canvas\s*-->/.test(line)) { canvasMark = true; continue; }
    // words of real content in the current section (HTML comments are notes, not answers)
    let bare = line;
    if (inComment) { const e = bare.indexOf('-->'); if (e < 0) bare = ''; else { bare = bare.slice(e + 3); inComment = false; } }
    bare = bare.replace(/<!--.*?-->/g, '');
    if (bare.includes('<!--')) { bare = bare.slice(0, bare.indexOf('<!--')); inComment = true; }
    const sec = t.item.sections.at(-1);
    if (sec) sec.words += bare.split(/\s+/).filter(Boolean).length;
    const secLevel = t.sections[t.sections.length - 1]?.level;
    // a mention in a decision log records that changes went together (`changed-with`); the canvas isn't committed
    if (!canvasMark && secLevel === 'history') for (const m of line.matchAll(/(?<![\w@./`-])@([A-Za-z][\w-]*)/g)) t.item.historyMentions.add(`@${m[1]}`);
    const inCanvas = canvasMark || ['canvas', 'history'].includes(secLevel);
    if (inCanvas) continue;
    const c = line.match(CHECK);
    if (c) {
      let body = c[2].trim(), level = null, answer = null;
      const lm = body.match(/^(D\d)\s*[·:\-–]\s*(.*)$/);
      if (lm) { level = lm[1]; body = lm[2]; }
      const am = body.match(/^(.*?)\s+(?:→|->)\s+(.*)$/);
      if (am) { body = am[1]; answer = am[2]; }
      t.item.checklist.push({ text: body, level, checked: c[1] !== ' ', answer, line: i + 1 });
    }
    for (const m of line.matchAll(/(?<![\w@./`-])@([A-Za-z][\w-]*)/g)) t.item.mentions.add(`@${m[1]}`);
  }

  if (fileItem && !fileItem.title) fileItem.title = file.split('/').pop().replace(/\.md$/, '');
  for (const it of items) for (const k of it.unknown) warnings.push(`${it.file}:${it.line}: unknown field "${k}" (kept, ignored)`);
  return { items, untagged, errors, warnings };
}
