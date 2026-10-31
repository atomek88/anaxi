// anaxi watch · the reader (served by tools/anaxi-watch.mjs). Read-only, no dependencies.
// Routes: #/ overview · #/topic/<t> · #/item/<key>?at=2 · #/map[?topic=<t>]
(() => {
  const app = document.getElementById('app');
  let M = null; // the model from /api/model
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ICON = { blocked: '⛔', later: '⏸️', trim: '✂️', gap: '⬇️', open: '❓', enough: '🎯', none: '❓', superseded: '↪️', retired: '⏹️', archived: '🗄️' };
  const WORD = { blocked: 'blocked', later: 'later', trim: 'over-designed', gap: 'go deeper', open: 'open questions', enough: 'enough', none: 'no target', superseded: 'superseded', retired: 'retired', archived: 'archived' };
  const COLOR = { blocked: 'var(--bad)', gap: 'var(--gap)', open: 'var(--gap)', trim: 'var(--trim)', enough: 'var(--ok)', later: 'var(--later)', none: 'var(--ink3)', superseded: 'var(--hist)', retired: 'var(--ink3)', archived: 'var(--hist)' };
  const ORDER = ['blocked', 'gap', 'open', 'trim', 'later', 'none', 'enough'];
  const SMALL = 12; // up to this many items, the map shows items; above it, topics first

  const lvN = (l) => (M.levels.findIndex((x) => x.id === l));
  // depth as the text shows it: levels count up to the first one with nothing written (N05)
  const unbacked = (it) => it.shown !== it.depth && it.depth;
  const depthWord = (it) => (unbacked(it) ? `${it.shown || 'nothing'} (claims ${it.depth})` : it.depth || '—');
  const written = (it, i) => (it.levelWords ? it.levelWords[i] >= it.minWords : i <= lvN(it.depth));
  /** One level's cell in a depth bar: counted, written past a gap, claimed but empty, or still needed. */
  function cell(it, i) {
    const d = lvN(it.shown ?? it.depth), c = lvN(it.depth), t = lvN(it.target), w = written(it, i), need = t >= 0 && i <= t;
    const fill = w && t >= 0 && i > t ? 'var(--trim)' : i <= d ? COLOR[it.status === 'blocked' ? 'gap' : it.status] : w ? 'var(--ink3)' : 'none';
    return { fill, opacity: i <= d || !w ? 1 : 0.45, stroke: !w && i <= c ? 'var(--bad)' : need || i <= d ? 'var(--ink3)' : 'var(--line)', dash: need && i > d && !w,
      title: `${M.levels[i].id}: ${i <= d ? 'written' : w ? (i > c ? 'written, past the claimed depth' : 'written, but not counted: a level below it is empty') : i <= c ? 'claimed, nothing written' : need ? 'needed' : 'not needed'}` };
  }
  const ROLE = { shared: '🔗 shared', foundation: '🧱 foundation' };
  // what's built (FORMAT.md §2): ✓ yes, ◐ partly, · no, k/n of its marked parts; red when the design moved on since
  const BUILT = { yes: '✓ built', partly: '◐ partly built', no: '· not built' };
  const builtWord = (it) => [BUILT[it.built], it.builtParts ? `${it.builtParts.yes}/${it.builtParts.yes + it.builtParts.partly + it.builtParts.no} parts built` : ''].filter(Boolean).join(' · ');
  const builtTag = (it) => (builtWord(it) ? `<span class="role ${it.drift ? 'drift' : ''}" title="${esc(it.drift ? `the design changed after the code (design ${it.drift.doc.slice(0, 10)}, code ${it.drift.code.slice(0, 10)})` : (it.code || []).join(', ') || 'no code: paths')}">${it.built === 'yes' ? '✓' : it.built === 'partly' ? '◐' : it.built === 'no' ? '·' : ''}${it.builtParts ? ` ${it.builtParts.yes}/${it.builtParts.yes + it.builtParts.partly + it.builtParts.no}` : ''}${it.drift ? ' ⚠' : ''}</span>` : '');
  const roleTag = (it) => (ROLE[it.role] ? `<span class="role" title="${it.role === 'foundation' ? 'shared, and builds on nothing: what features stand on' : 'shared: other items build on it'}">${ROLE[it.role]}</span>` : '');
  const all = () => [...M.items, ...M.inactive];
  const byKey = (k) => all().find((it) => it.key === k);
  const name = (it) => it.id || it.title;
  const topicOf = (it) => it.about?.[0] || it.file.split('/').slice(0, -1).join('/') || 'project';
  const life = (it) => it.lifecycle && it.lifecycle !== 'current';
  const go = (h) => `data-go="${esc(h)}"`;
  const itemHash = (it, q = '') => `#/item/${encodeURIComponent(it.key)}${q}`;
  const link = (it) => (it ? `<button ${go(itemHash(it))} data-peek="${esc(it.key)}">${esc(name(it))}</button>` : '');
  const usedBy = (it) => M.items.filter((o) => o.uses.some((u) => u.key === it.key));
  const blockedBy = (it) => M.nudges.filter((n) => n.item === it.key && n.code === 'N02' && n.severity === 'block')
    .map((n) => it.uses.map((u) => byKey(u.key)).find((d) => d && n.message.includes(name(d)))).filter(Boolean);

  // ---------- markdown (enough for design docs: headings, paragraphs, lists, checkboxes, tables, code, links) ----------
  function resolve(href, fromFile) {
    if (/^[a-z]+:/i.test(href)) return { url: href };
    const [p, anchor] = href.split('#');
    const parts = (p ? `${fromFile.split('/').slice(0, -1).join('/')}/${p}` : fromFile).split('/');
    const out = [];
    for (const x of parts) { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); }
    const file = out.join('/');
    const inFile = all().filter((it) => it.file === file);
    const it = (anchor && inFile.find((x) => slug(x.title) === anchor)) || inFile.find((x) => x.declared === 'front-matter') || inFile.find((x) => !x.parent);
    return it ? { it } : { file };
  }
  const slug = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
  function inline(s, file) {
    return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
        const r = resolve(href.replace(/&amp;/g, '&'), file);
        return r.it ? `<button ${go(itemHash(r.it))}>${text}</button>` : r.url ? `<a href="${r.url}" target="_blank" rel="noopener">${text}</a>` : `<span title="${esc(r.file)}">${text}</span>`;
      })
      .replace(/(^|[\s(])(@[A-Za-z][\w-]*)/g, (m, pre, id) => { const it = all().find((x) => x.id === id); return it ? `${pre}${link(it)}` : m; });
  }
  function html(b) {
    const t = b.text;
    if (b.kind === 'heading') {
      const h = Math.min(b.depth + 1, 5);
      return `<h${h}>${inline(t[0].replace(/`(D\d[^`]*|superseded|retired)`/g, '').replace(/🎨/g, ''), b.file)}${b.level ? `<span class="lv">${esc(b.level)}</span>` : ''}${b.part ? `<span class="partof">part · ${esc(b.file)}</span>` : ''}</h${h}>`;
    }
    if (b.kind === 'code') return `<pre class="md">${esc(t.slice(1, -1).join('\n'))}</pre>`;
    if (b.kind === 'table') {
      const rows = t.filter((l) => !/^\s*\|[\s|:-]+\|\s*$/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      return `<table class="md"><tr>${rows[0].map((c) => `<th>${inline(c, b.file)}</th>`).join('')}</tr>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${inline(c, b.file)}</td>`).join('')}</tr>`).join('')}</table>`;
    }
    if (b.kind === 'list') return `<ul class="md">${t.map((l) => { const c = l.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/); return c ? `<li class="check ${c[1] === ' ' ? 'open' : 'done'}">${c[1] === ' ' ? '☐' : '☑'} ${inline(c[2], b.file)}</li>` : `<li>${inline(l.replace(/^\s*([-*+]|\d+\.)\s+/, ''), b.file)}</li>`; }).join('')}</ul>`;
    return `<p>${b.lead && b.level ? `<span class="lv lvtag">${esc(b.level)}</span>` : ''}${inline(t.join(' '), b.file)}</p>`;
  }
  const visible = (b, at, o) => b.kind !== 'mark' && b.kind !== 'title' && (b.level === 'canvas' ? o.canvas : b.level === 'history' ? o.history : b.level == null || lvN(b.level) < 0 || lvN(b.level) <= at);
  const words = (bs) => bs.reduce((s, b) => s + b.text.join(' ').split(/\s+/).filter(Boolean).length, 0);

  // ---------- shared pieces ----------
  const shell = (crumbs, nav, main, rail, kind = '') => `<div class="vw ${kind}"><nav class="vw-nav">${nav}</nav><div class="main"><div class="crumb">${crumbs}</div>${main}</div><aside class="vw-rail">${rail}</aside></div>`;
  const crumbs = (list) => list.map((c) => (c.hash ? `<button ${go(c.hash)}>${esc(c.label)}</button>` : esc(c.label))).join(' › ');
  const topics = () => [...new Set(M.items.map(topicOf))].sort();
  const nav = (active) => `<h4>Topics</h4>${topics().map((t) => `<button class="o ${t === active ? 'on' : ''}" ${go(`#/topic/${encodeURIComponent(t)}`)}>${esc(t)} · ${M.items.filter((i) => topicOf(i) === t).length}</button>`).join('')}
    ${M.inactive.length || M.deleted.length ? `<h4>History</h4>${M.inactive.map((it) => `<button class="o dim" ${go(itemHash(it))}>${ICON[it.status]} ${esc(name(it))}</button>`).join('')}${M.deleted.map((d) => `<span class="o dim" title="${esc(d.why || '')}">✕ ${esc(d.id)}</span>`).join('')}` : ''}`;
  const row = (it) => { const bb = blockedBy(it), ub = usedBy(it);
    return `<div class="row"><span>${ICON[it.status]}</span><span>${link(it)} <span class="t">${esc(it.title)}</span> ${roleTag(it)}${builtTag(it)}</span><span>${esc(unbacked(it) ? `${it.shown || '—'} (${it.depth}?)` : it.depth || '—')} → ${esc(it.target || '—')}</span><span>${bb.length ? `blocked by ${bb.map(link).join(', ')}` : esc(WORD[it.status])}${ub.length ? ` · used by ${ub.map(link).join(', ')}` : ''}</span></div>`; };
  // reading order: what an item uses comes first, so "next" reads the design bottom-up
  function rankOf() {
    const rank = new Map(), r = (it, seen = new Set()) => {
      if (rank.has(it.key)) return rank.get(it.key);
      if (seen.has(it.key)) return 0;
      seen.add(it.key);
      const deps = it.uses.map((u) => M.items.find((x) => x.key === u.key)).filter(Boolean);
      const v = deps.length ? 1 + Math.max(...deps.map((d) => r(d, seen))) : 0;
      rank.set(it.key, v); return v;
    };
    M.items.forEach((it) => r(it));
    return rank;
  }
  const reading = () => { const rk = rankOf(); return [...M.items].sort((a, b) => rk.get(a.key) - rk.get(b.key) || topicOf(a).localeCompare(topicOf(b)) || a.key.localeCompare(b.key)); };

  // ---------- pages ----------
  function overview() {
    const feats = M.items.filter((it) => !ROLE[it.role]), base = M.items.filter((it) => ROLE[it.role]).sort((a, b) => usedBy(b).length - usedBy(a).length);
    const groups = ORDER.map((s) => [s, feats.filter((it) => it.status === s)]).filter(([, l]) => l.length);
    const first = reading()[0];
    const main = `<h1>${esc(M.root)}</h1>
      <div class="badges"><span class="b">${esc(M.settings.profile)} profile</span><span class="b">stage: ${esc(M.settings.stage)}</span><span class="b">${M.items.length} items · ${M.items.filter((i) => i.status === 'enough').length} enough · ${M.items.filter((i) => i.status === 'blocked').length} blocked</span>${M.inactive.length + M.deleted.length ? `<span class="b">${M.inactive.length + M.deleted.length} in history</span>` : ''}</div>
      ${M.errors.length ? `<p class="err">${M.errors.length} error(s): ${M.errors.slice(0, 3).map(esc).join(' · ')}</p>` : ''}
      ${groups.map(([s, l]) => `<div class="group">${ICON[s]} ${WORD[s]} · ${l.length}</div>${l.map(row).join('')}`).join('')}
      ${base.length ? `<div class="group">🧱 shared: what the features build on · ${base.length}</div>${base.map(row).join('')}` : ''}
      ${M.inactive.length || M.deleted.length ? `<div class="group">↪️ superseded, retired, deleted</div>` : ''}
      ${M.inactive.filter((it) => !it.parent || !life(byKey(it.parent) || {})).map((it) => `<div class="row"><span>${ICON[it.status]}</span><span>${link(it)}</span><span>${esc(it.depth || '')}</span><span>${it.supersededBy ? `superseded by ${esc(it.supersededBy.id)}` : `retired ${esc(it.retired?.date || '')}`}${it.successor ? ` → ${link(byKey(it.successor))}` : ''}</span></div>`).join('')}
      ${M.deleted.map((d) => `<div class="row"><span>✕</span><span>${esc(d.id)}</span><span>${esc(d.date || '')}</span><span>deleted: ${esc(d.why || '')}${d.commit && d.commit !== '—' ? ` (git ${esc(d.commit)})` : ''}</span></div>`).join('')}`;
    const rail = `${first ? `<h4>Read the whole design</h4><p>One page per item, in <code>uses:</code> order: start at ${link(first)} and follow "next".</p>` : ''}
      <h4>Needs attention</h4>${M.nudges.filter((n) => n.severity === 'block' || n.severity === 'warn').slice(0, 8).map((n) => `<div class="n"><b>${esc(n.code)}</b> ${link(byKey(n.item))} ${esc(n.message.slice(0, 90))}</div>`).join('') || '<div class="n">nothing</div>'}`;
    return shell(crumbs([{ label: M.root }]), nav(), main, rail);
  }

  function topicPage(t) {
    const mine = M.items.filter((it) => topicOf(it) === t);
    const outside = [...new Set(mine.flatMap((it) => it.uses.map((u) => u.key)).filter((k) => k && byKey(k) && topicOf(byKey(k)) !== t))].map(byKey);
    const main = `<h1>${esc(t)}</h1><p>${mine.length} item${mine.length === 1 ? '' : 's'}, and what they depend on outside this topic. <button ${go(`#/map?topic=${encodeURIComponent(t)}`)}>Map of this topic</button></p>
      ${ORDER.flatMap((s) => mine.filter((it) => it.status === s)).map(row).join('')}
      <div class="group">depends on, outside ${esc(t)}</div>${outside.length ? outside.map(row).join('') : '<p class="t">nothing</p>'}`;
    return shell(crumbs([{ label: M.root, hash: '#/' }, { label: t }]), nav(t), main, '');
  }

  // ---------- the item page: a file tree with its connections (left), the doc with levels folded inline (middle),
  // and a minimap of its levels and neighbours (right). Hovering anything with data-peek previews it in place.
  const TREE_MAX = 25; // above this many files the tree shows only this item's connected files, until asked
  let treeAll = false;
  let showGate = (() => { try { return localStorage.getItem('anaxi.gate') === '1'; } catch { return false; } })(); // off by default
  const open = new Set(); // "key|level" levels unfolded past the reading depth, kept across live reloads
  const REL = { uses: 'uses', 'used-by': 'used by', mentions: 'mentions', 'mentioned-by': 'mentioned by', supersedes: 'replaces',
    'superseded-by': 'replaced by', 'changed-with': 'changed with', inside: 'inside', contains: 'contains' };
  const RELCOLOR = { uses: 'var(--ink2)', 'used-by': 'var(--accent)', mentions: 'var(--ink3)', 'mentioned-by': 'var(--ink3)',
    supersedes: 'var(--hist)', 'superseded-by': 'var(--hist)', 'changed-with': 'var(--hist)', inside: 'var(--ink3)', contains: 'var(--ink3)', part: 'var(--trim)' };
  const lvName = (l) => { const d = M.levels.find((x) => x.id === l); return d?.name || (l === 'canvas' ? 'canvas' : l === 'history' ? 'decision log' : ''); };
  const relOf = (it) => (it.related || []).map((r) => ({ ...r, item: byKey(r.key) })).filter((r) => r.item);
  const miniBar = (it, w = 9, h = 5, gap = 1.5, x0 = 0, y0 = 0) => M.levels.map((l, i) => { const c = cell(it, i);
    return `<rect x="${x0 + i * (w + gap)}" y="${y0}" width="${w}" height="${h}" rx="1" fill="${c.fill}" fill-opacity="${c.opacity}" stroke="${c.stroke}" stroke-width=".8"/>`; }).join('');

  /** Contiguous blocks at one level form a run; a run deeper than the reading depth folds into one line. */
  function runs(it) {
    const out = [];
    for (const b of it.blocks) {
      if (b.kind === 'mark' || b.kind === 'title') continue;
      const k = b.level === 'canvas' || b.level === 'history' || lvN(b.level) >= 0 ? b.level : null;
      const last = out[out.length - 1];
      if (last && last.level === k) last.blocks.push(b); else out.push({ level: k, blocks: [b] });
    }
    return out;
  }
  const runLabel = (r) => { const h = r.blocks.find((b) => b.kind === 'heading'), l = r.blocks.find((b) => b.lead);
    const t = h ? h.text[0].replace(/`[^`]*`/g, '').trim() : l ? (l.text[0].match(/^\*\*([^*.]+)/) || [])[1] : '';
    return t && t.toLowerCase() !== lvName(r.level).toLowerCase() ? t : ''; };
  const isOpen = (it, level, at) => (level == null ? true : level === 'canvas' || level === 'history' ? open.has(`${it.key}|${level}`) : lvN(level) <= at || open.has(`${it.key}|${level}`));

  function docBody(it, at) {
    let seen = new Set();
    const rs = runs(it), upto = Math.max(lvN(it.depth), lvN(it.target));
    for (let i = 0; i <= upto; i++) { // a level the claim or the target needs, with nothing written: say so where it would be
      const l = M.levels[i].id; if (written(it, i) || !it.levelWords) continue;
      const k = rs.findIndex((r) => lvN(r.level) > i);
      rs.splice(k < 0 ? rs.length : k, 0, { level: l, blocks: [], empty: true, claimed: i <= lvN(it.depth) });
    }
    return rs.map((r) => {
      if (r.empty) return `<div class="fold gapline"${seen.has(r.level) ? '' : ` id="lv-${esc(r.level)}"`}><span class="lv">${esc(r.level)}</span> <b>${esc(lvName(r.level))}</b> · nothing written yet${r.claimed ? ` <span class="t">— the claim of ${esc(it.depth)} counts only up to ${esc(it.shown || 'nothing')}</span>` : ' <span class="t">— needed for the target</span>'}</div>`;
      const first = !seen.has(r.level); seen.add(r.level);
      const anchor = first && r.level ? ` id="lv-${esc(r.level)}"` : '';
      const lvTag = r.level ? `<span class="lv">${esc(r.level)}</span>` : '';
      const part = r.blocks.find((b) => b.part)?.part, partTag = part ? `<span class="partof">part · ${esc(r.blocks.find((b) => b.part).file)}</span>` : '';
      const cls = r.level === 'canvas' ? 'canvas' : r.level === 'history' ? 'history' : '';
      if (!isOpen(it, r.level, at)) {
        return `<button class="fold"${anchor} data-fold="${esc(r.level)}" title="Show this ${esc(r.level)} part here">▸ ${lvTag} <b>${esc(lvName(r.level))}</b>${runLabel(r) ? ` · ${esc(runLabel(r))}` : ''} <span class="t">· ${words(r.blocks)} words</span>${partTag}</button>`;
      }
      const deeper = r.level && (r.level === 'canvas' || r.level === 'history' || lvN(r.level) > at);
      const head = deeper ? `<button class="fold on" data-fold="${esc(r.level)}" title="Fold it again">▾ ${lvTag} <b>${esc(lvName(r.level))}</b></button>` : '';
      return `<section class="run ${cls} ${deeper ? 'unfolded' : ''}"${anchor} data-run="${esc(r.level || '')}">${head}${r.blocks.map(html).join('')}</section>`;
    }).join('');
  }

  /** Left: every doc file, folders as rows; lines from this item's file to each file it's connected to. */
  function fileTree(it) {
    const files = [...new Set([...(M.files || []), ...all().map((x) => x.file)])].sort();
    const relFiles = new Set([it.file, ...relOf(it).map((r) => r.item.file), ...(it.parts || []).map((p) => p.file)]);
    const compact = files.length > TREE_MAX && !treeAll;
    const dirOf = (f) => (f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '');
    const rows = [];
    let dir = null;
    for (const f of files) { const d = dirOf(f);
      if (d !== dir) { dir = d; const hid = compact ? files.filter((x) => dirOf(x) === d && !relFiles.has(x)).length : 0; if (d || hid) rows.push({ dir: d || '.', hid }); }
      if (!compact || relFiles.has(f)) rows.push({ file: f, name: f.slice(f.lastIndexOf('/') + 1) }); }
    const mainOf = (f) => (all().some((x) => x.file === f) ? null : all().find((x) => (x.parts || []).some((p) => p.file === f))) || all().filter((x) => x.file === f).sort((a, b) => (a.declared === 'front-matter' ? -1 : 0) - (b.declared === 'front-matter' ? -1 : 0) || (a.parent ? 1 : 0) - (b.parent ? 1 : 0))[0];
    const rel = new Map();
    const note = (f, kind, extra = {}) => { if (f === it.file && kind !== 'part') return; if (!rel.has(f)) rel.set(f, { kinds: new Set(), blocked: false }); const r = rel.get(f); r.kinds.add(kind); if (extra.blocked) r.blocked = true; };
    for (const r of relOf(it)) note(r.item.file, r.kind, r);
    for (const p of it.parts || []) note(p.file, 'part');
    const RH = 22, G = 30;
    const y = (i) => i * RH + RH / 2;
    const me = rows.findIndex((r) => r.file === it.file);
    let svg = '';
    rows.forEach((r, i) => { if (!r.file || !rel.has(r.file) || r.file === it.file) return;
      const x = rel.get(r.file), k = [...x.kinds][0], dy = Math.abs(i - me), bend = Math.max(3, G - 4 - Math.min(G - 8, dy * 3));
      const color = x.blocked ? 'var(--bad)' : RELCOLOR[k];
      svg += `<path d="M${G} ${y(me)} C ${bend} ${y(me)}, ${bend} ${y(i)}, ${G} ${y(i)}" fill="none" stroke="${color}" stroke-width="${x.blocked ? 2 : 1.3}" ${k.startsWith('mention') || k === 'inside' || k === 'contains' ? 'stroke-dasharray="3 3"' : ''}/><circle cx="${G}" cy="${y(i)}" r="2.5" fill="${color}"/>`; });
    if (me >= 0 && rel.size) svg += `<circle cx="${G}" cy="${y(me)}" r="3.5" fill="var(--accent)"/>`;
    const list = rows.map((r) => {
      if (r.dir) return `<div class="tr dir" style="height:${RH}px">${esc(r.dir)}/${r.hid ? `<button class="t" data-tree="all">+${r.hid} unrelated</button>` : ''}</div>`;
      const m = mainOf(r.file), x = rel.get(r.file), here = r.file === it.file;
      const kinds = x ? [...x.kinds].map((k) => (k === 'part' ? 'part' : REL[k] || k)).join(', ') : m && m.file !== r.file ? `part of ${name(m)}` : '';
      return `<div class="tr file ${here ? 'here' : ''} ${x ? 'rel' : ''} ${m && life(m) ? 'dim' : ''}" style="height:${RH}px" ${m ? `${go(itemHash(m))} data-peek="${esc(m.key)}"` : ''} title="${esc(r.file)}${kinds ? ` · ${esc(kinds)}` : ''}">${m ? ICON[m.status] : '·'} ${esc(r.name)}${kinds ? `<span class="t"> ${esc(kinds)}</span>` : ''}</div>`;
    }).join('');
    return `<h4>Files ${files.length > TREE_MAX ? `<button class="t" data-tree="${treeAll ? 'related' : 'all'}">${treeAll ? 'only connected' : `all ${files.length}`}</button>` : ''}</h4><div class="tree"><svg class="tree-lines" width="${G + 2}" height="${rows.length * RH}">${svg}</svg><div class="tree-rows" style="margin-left:${G + 4}px">${list}</div></div>
      <div class="tree-key"><span style="color:var(--ink2)">─ uses</span> <span style="color:var(--accent)">─ used by</span> <span style="color:var(--ink3)">┄ mentions</span> <span style="color:var(--bad)">─ blocks</span></div>`;
  }

  /** Right: this item's levels as a stack, what it uses on the left, what uses it on the right, the rest below. */
  function minimap(it, at) {
    const W = 272, L = M.levels.length, sx = 101, sw = 70, rh = 26, top = 26;
    const stackH = L * rh, cy = top + stackH / 2;
    const rels = relOf(it), left = rels.filter((r) => r.kind === 'uses'), right = rels.filter((r) => r.kind === 'used-by'),
      below = rels.filter((r) => r.kind !== 'uses' && r.kind !== 'used-by');
    const nh = 34, ngap = 8, MAX = 6;
    const col = (list) => { const shown = list.slice(0, list.length > MAX ? MAX - 1 : MAX), more = list.length - shown.length;
      const h = shown.length * (nh + ngap) - ngap, y0 = Math.max(top, cy - h / 2); return { shown, more, y0 }; };
    const lc = col(left), rc = col(right);
    const sideH = Math.max(lc.y0 + lc.shown.length * (nh + ngap) + (lc.more ? 16 : 0), rc.y0 + rc.shown.length * (nh + ngap) + (rc.more ? 16 : 0));
    const by = Math.max(top + stackH, sideH) + 28, bcols = 3, bw = (W - 8) / bcols;
    const H = by + (below.length ? Math.ceil(below.length / bcols) * (nh + ngap) + 16 : 0) + 4;
    let s = `<svg class="mini" viewBox="0 0 ${W} ${H}" width="100%" style="font:10.5px system-ui">`;
    s += `<text x="${sx + sw / 2}" y="14" text-anchor="middle" font-weight="700" fill="var(--ink)">${esc(name(it)).slice(0, 18)}${ROLE[it.role] ? ` ${ROLE[it.role].split(' ')[0]}` : ''}<title>${esc(ROLE[it.role] || 'feature')}</title></text>`;
    // the stack: one row per level, click to unfold that level in place
    M.levels.forEach((l, i) => { const c = cell(it, i), y = top + i * rh, on = isOpen(it, l.id, at);
      s += `<g data-jump="${esc(l.id)}" style="cursor:pointer"><title>${esc(c.title)}${it.blocks.some((b) => b.level === l.id) ? ' · click to read it here' : ''}</title>
        <rect x="${sx}" y="${y}" width="${sw}" height="${rh - 4}" rx="4" fill="${c.fill === 'none' ? 'var(--bg)' : c.fill}" fill-opacity="${c.fill === 'none' ? 1 : Math.min(c.opacity, 0.85)}" stroke="${on ? 'var(--accent)' : c.stroke}" stroke-width="${on ? 2 : 1}" ${c.dash ? 'stroke-dasharray="3 2"' : ''}/>
        <text x="${sx + 7}" y="${y + 15}" fill="${c.fill === 'none' || c.opacity < 1 ? 'var(--ink2)' : '#fff'}" font-weight="600">${esc(l.id)}</text>
        <text x="${sx + 25}" y="${y + 15}" fill="${c.fill === 'none' || c.opacity < 1 ? 'var(--ink3)' : '#fff'}">${esc((l.name || '').slice(0, 8))}</text></g>`;
      const part = (it.parts || []).length && it.blocks.find((b) => b.part && b.level === l.id);
      if (part) s += `<text x="${sx + sw + 1}" y="${y + 15}" font-size="9" fill="var(--trim)"><title>part: ${esc(part.file)}</title>📎</text>`; });
    if (lvN(it.target) >= 0) { const ty = top + (lvN(it.target) + 1) * rh - 3; s += `<line x1="${sx - 3}" x2="${sx + sw + 3}" y1="${ty}" y2="${ty}" stroke="var(--ink)" stroke-dasharray="2 2"><title>needs ${esc(it.target)}: everything above this line</title></line>`; }
    const node = (r, x, y, w) => { const o = r.item;
      return `<g ${go(itemHash(o))} data-peek="${esc(o.key)}" data-rel="${esc(REL[r.kind] || r.kind)}" style="cursor:pointer"><rect x="${x}" y="${y}" width="${w}" height="${nh}" rx="6" fill="var(--bg)" stroke="${r.blocked ? 'var(--bad)' : COLOR[o.status]}" stroke-width="1.3" ${life(o) ? 'stroke-dasharray="3 2"' : ''}/>
        ${ROLE[o.role] ? `<rect x="${x + 1}" y="${y + nh - 4}" width="${w - 2}" height="3" rx="1" fill="var(--ink3)"><title>${esc(ROLE[o.role])}</title></rect>` : ''}<text x="${x + 5}" y="${y + 13}" fill="var(--ink)" font-weight="600">${esc(name(o)).slice(0, Math.floor(w / 6.2))}</text>${miniBar(o, 7, 5, 1.5, x + 5, y + 21)}${r.level && (r.kind === 'uses' || r.kind === 'used-by') ? `<text x="${x + 5 + L * 8.5 + 3}" y="${y + 27}" font-size="9" fill="${r.blocked ? 'var(--bad)' : 'var(--ink3)'}">${r.kind === 'uses' ? `${esc(o.shown || o.depth || '—')} of ${esc(r.level)}` : `needs ${esc(r.level)}`}</text>` : ''}</g>`; };
    const edge = (x1, y1, x2, y2, r) => `<path d="M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" fill="none" stroke="${r.blocked ? 'var(--bad)' : RELCOLOR[r.kind]}" stroke-width="${r.blocked ? 2 : 1.2}" ${r.kind.startsWith('mention') || r.kind === 'changed-with' || r.kind === 'inside' || r.kind === 'contains' ? 'stroke-dasharray="3 3"' : ''}><title>${esc(REL[r.kind] || r.kind)}${r.level ? ` · needs ${esc(r.level)}` : ''}${r.blocked ? ' · not deep enough yet' : ''}</title></path>`;
    // an edge from a used item meets the stack at the level that's needed of it, so you can see how deep it must go
    const lvY = (l) => (lvN(l) >= 0 ? top + lvN(l) * rh + (rh - 4) / 2 : cy);
    lc.shown.forEach((r, k) => { const y = lc.y0 + k * (nh + ngap); s += edge(93, y + nh / 2, sx, cy, r) + node(r, 1, y, 92); });
    rc.shown.forEach((r, k) => { const y = rc.y0 + k * (nh + ngap); s += edge(sx + sw, lvY(r.level), W - 93, y + nh / 2, r) + node(r, W - 93, y, 92); });
    if (lc.more) s += `<text x="4" y="${lc.y0 + lc.shown.length * (nh + ngap) + 10}" fill="var(--ink3)">+${lc.more} more uses</text>`;
    if (rc.more) s += `<text x="${W - 93}" y="${rc.y0 + rc.shown.length * (nh + ngap) + 10}" fill="var(--ink3)">+${rc.more} more</text>`;
    if (left.length) s += `<text x="2" y="${top - 8}" fill="var(--ink3)" font-size="9">USES</text>`;
    if (right.length) s += `<text x="${W - 2}" y="${top - 8}" fill="var(--ink3)" font-size="9" text-anchor="end">USED BY</text>`;
    if (below.length) {
      s += `<text x="2" y="${by - 8}" fill="var(--ink3)" font-size="9">RELATED</text>`;
      below.forEach((r, k) => { const x = 2 + (k % bcols) * bw, y = by + Math.floor(k / bcols) * (nh + ngap);
        s += edge(sx + sw / 2, top + stackH - 4, x + (bw - 6) / 2, y, r) + node(r, x, y, bw - 6) + `<text x="${x + 4}" y="${y + nh + 7}" fill="var(--ink3)" font-size="8.5">${esc(REL[r.kind] || r.kind)}</text>`; });
    }
    if (!rels.length) s += `<text x="${W / 2}" y="${top + stackH + 18}" text-anchor="middle" fill="var(--ink3)">not connected to anything yet</text>`;
    return `${s}</svg>`;
  }

  function itemPage(it, q) {
    const at = q.has('at') ? Math.min(+q.get('at'), M.levels.length - 1) : Math.max(lvN(it.depth), 0);
    const tgt = lvN(it.target);
    const succ = it.successor && byKey(it.successor);
    const banner = life(it) ? `<div class="banner">${ICON[it.status]} <b>${it.supersededBy ? `Superseded by ${esc(it.supersededBy.id)}` : 'Retired'}</b>${it.supersededBy?.reason ? `: ${esc(it.supersededBy.reason)}` : it.retired?.reason ? `: ${esc(it.retired.reason)}` : ''}. ${succ ? `Read ${link(succ)} instead; this page explains what came before.` : "Kept for its reasoning; it doesn't count."}${it.lifecycle === 'archived' ? ' (archived)' : ''}</div>` : '';
    const depthCtl = `<span class="depth" title="How deep to read: keys 0–${M.levels.length - 1}, or [ and ]">${M.levels.map((l, i) => `<button ${go(itemHash(it, `?at=${i}`))} class="${i === at ? 'on' : ''} ${tgt >= 0 && i > tgt ? 'past' : ''} ${it.levelWords && !written(it, i) ? 'empty' : ''}" title="${esc(l.name || '')}${tgt >= 0 && i > tgt ? ' · beyond the target' : ''}${it.levelWords && !written(it, i) ? ' · nothing written' : ''}">${esc(l.id)}</button>`).join('')}</span>`;
    const rels = relOf(it);
    const chips = Object.keys(REL).map((k) => { const l = rels.filter((r) => r.kind === k); return l.length ? `<span class="chips"><span class="t">${esc(REL[k])}</span> ${l.map((r) => `<button class="chip ${r.blocked ? 'bad' : ''}" ${go(itemHash(r.item))} data-peek="${esc(r.item.key)}" data-rel="${esc(REL[k])}">${ICON[r.item.status]} ${esc(name(r.item))}${r.level && k === 'uses' ? ` <span class="t">${esc(r.level)}</span>` : ''}</button>`).join('')}</span>` : ''; }).join('');
    const partChips = (it.parts || []).length ? `<span class="chips"><span class="t">parts</span> ${it.parts.map((p) => { const b = it.blocks.find((x) => x.file === p.file && x.level && lvN(x.level) >= 0); return `<button class="chip" ${b ? `data-jump="${esc(b.level)}"` : ''} title="${esc(p.file)}: shown inline${b ? ` at ${esc(b.level)}` : ''}">📎 ${esc(p.file.split('/').pop())}${b ? ` <span class="t">${esc(b.level)}</span>` : ''}</button>`; }).join('')}</span>` : '';
    const order = reading(), i = order.findIndex((x) => x.key === it.key);
    const pager = i < 0 ? '' : `<div class="pager"><span>${i > 0 ? `← <button ${go(itemHash(order[i - 1], `?at=${at}`))} data-peek="${esc(order[i - 1].key)}">${esc(name(order[i - 1]))}</button>` : ''}</span><span class="mid">${i + 1} of ${order.length} · reading at ${esc(M.levels[at].id)}</span><span>${i < order.length - 1 ? `<button ${go(itemHash(order[i + 1], `?at=${at}`))} data-peek="${esc(order[i + 1].key)}">${esc(name(order[i + 1]))}</button> →` : ''}</span></div>`;
    const main = `${banner}<h1>${esc(it.title)}</h1>
      <div class="badges">${it.id ? `<span class="b">${esc(it.id)}</span>` : ''}<span class="b st-${it.status}">${ICON[it.status]} ${esc(WORD[it.status])}</span>${ROLE[it.role] ? `<span class="b">${ROLE[it.role]} · used by ${usedBy(it).length}</span>` : ''}${builtWord(it) ? `<span class="b ${it.drift ? 'st-blocked' : it.built === 'yes' ? 'st-enough' : 'st-gap'}" title="${esc((it.code || []).join(', '))}">${esc(builtWord(it))}${it.drift ? ' · design changed since' : ''}</span>` : ''}<span class="b${unbacked(it) ? ' st-gap' : ''}">${unbacked(it) ? `claims ${esc(it.depth)} · shows ${esc(it.shown || 'nothing')}` : `depth ${esc(it.depth || '—')}`} · needs ${esc(it.target || '—')}${it.effective && it.effective !== it.target ? ` (now ${esc(it.effective)})` : ''}</span>${it.risk ? `<span class="b">risk ${it.risk.join('·')}</span>` : ''}<span class="b">${esc(it.file)}:${it.line}</span></div>
      ${chips || partChips ? `<div class="related">${chips}${partChips}</div>` : ''}
      <div class="readbar">${depthCtl}<span class="t">▸ lines unfold one level in place · hover a name to preview it</span></div>
      ${docBody(it, at)}
      ${it.caveats ? `<p><b>Caveats.</b> ${inline(it.caveats, it.file)}</p>` : ''}${it.later.length ? `<p><b>Later.</b> ${it.later.map((l) => inline(l, it.file)).join(' · ')}</p>` : ''}${pager}`;
    const nud = M.nudges.filter((n) => n.item === it.key && n.code !== 'N04');
    const left = `${fileTree(it)}<h4 class="sep">Connections <button class="t" ${go(`#/map?topic=${encodeURIComponent(topicOf(it))}`)}>full map →</button></h4>${minimap(it, at)}`;
    const rail = `<h4>Ready to build? <button class="t" data-gate title="Show or hide the build gate on every item page">${showGate ? 'hide' : 'show'}</button></h4>${showGate ? `<div class="n">${it.gate.ready ? '🎯 yes: at its target, nothing open' : `no: ${it.gate.why.map(esc).join(' · ')}`}</div>` : ''}
      <h4>Nudges</h4>${nud.length ? nud.map((n) => `<div class="n"><b>${esc(n.code)}</b> ${esc(n.message)}</div>`).join('') : `<div class="n">${life(it) ? 'not counted: history' : 'none: designed enough'}</div>`}`;
    return shell(crumbs([{ label: M.root, hash: '#/' }, { label: topicOf(it), hash: `#/topic/${encodeURIComponent(topicOf(it))}` }, { label: name(it) }]), left, main, rail, 'item');
  }

  // ---------- peek: a small preview of any item under the pointer, without leaving the page ----------
  const peek = document.createElement('div');
  peek.className = 'peek'; peek.hidden = true; document.body.appendChild(peek);
  let peekTimer = null;
  function showPeek(el) {
    const it = byKey(el.getAttribute('data-peek')); if (!it) return;
    const why = it.blocks.filter((b) => b.kind === 'para' && (b.level === 'D0' || b.level === 'D1')).slice(0, 2).map((b) => b.text.join(' ')).join(' ');
    const short = why.split(/\s+/).slice(0, 48).join(' ') + (why.split(/\s+/).length > 48 ? '…' : '');
    const rel = el.getAttribute('data-rel'), cur = location.hash.startsWith('#/item/') && byKey(decodeURIComponent(location.hash.slice(7).split('?')[0]));
    const r = cur && relOf(cur).find((x) => x.key === it.key);
    peek.innerHTML = `<div class="pk-h">${ICON[it.status]} <b>${esc(name(it))}</b> <span class="t">${esc(it.title)}</span></div>
      <div class="pk-m"><svg width="${M.levels.length * 15}" height="9">${miniBar(it, 13, 8, 2)}</svg> ${esc(depthWord(it))} · needs ${esc(it.target || '—')} · ${esc(WORD[it.status])}</div>
      ${r || rel ? `<div class="pk-r">${esc(cur ? name(cur) : '')} ${esc(rel || REL[r.kind])} it${r?.level && r.kind === 'uses' ? `, needs ${esc(r.level)}` : ''}${r?.blocked ? ' · <b style="color:var(--bad)">not deep enough yet</b>' : ''}</div>` : ''}
      <div class="pk-b">${short ? inline(short, it.file) : '<i>no why or what written yet</i>'}</div><div class="pk-f">${esc(it.file)} · click to open</div>`;
    peek.hidden = false;
    const b = el.getBoundingClientRect(), pw = 320, ph = peek.offsetHeight;
    const x = b.right + 10 + pw < innerWidth ? b.right + 10 : Math.max(8, b.left - pw - 10);
    peek.style.left = `${x}px`; peek.style.top = `${Math.max(8, Math.min(innerHeight - ph - 8, b.top - 6))}px`;
  }
  document.addEventListener('mouseover', (e) => { const t = e.target.closest?.('[data-peek]'); clearTimeout(peekTimer);
    if (t) peekTimer = setTimeout(() => showPeek(t), 160); else peek.hidden = true; });
  document.addEventListener('scroll', () => { peek.hidden = true; }, true);

  // ---------- the map: 2D depth bars; by topic above SMALL items ----------
  function bars(it) {
    return `<span class="bar">${M.levels.map((l, i) => { const c = cell(it, i);
      return `<i title="${esc(c.title)}" style="background:${c.fill === 'none' ? 'transparent' : c.fill};opacity:${c.opacity};border-color:${c.stroke};${c.dash ? 'border-style:dashed' : ''}"></i>`; }).join('')}</span>`;
  }
  function mapPage(q) {
    const t = q.get('topic');
    if (!t && M.items.length > SMALL) {
      return `<div class="map"><h1>Map · by topic</h1><p class="legend">${M.items.length} items: too many to label on one screen, so the project level shows topics. Open one to see its items.</p><div class="topics">${topics().map((tp) => {
        const mine = M.items.filter((it) => topicOf(it) === tp), worst = ORDER.find((s) => mine.some((it) => it.status === s));
        return `<div class="topic" style="border-color:${COLOR[worst]}"><h3><button ${go(`#/map?topic=${encodeURIComponent(tp)}`)}>${ICON[worst]} ${esc(tp)}</button></h3><div class="c">${mine.length} items · ${ORDER.filter((s) => mine.some((it) => it.status === s)).map((s) => `${mine.filter((it) => it.status === s).length} ${WORD[s]}`).join(' · ')}</div></div>`;
      }).join('')}</div></div>`;
    }
    const items = t ? M.items.filter((it) => topicOf(it) === t) : M.items;
    const keys = new Set(items.map((it) => it.key)), rk = rankOf();
    const cols = new Map();
    for (const it of items) { const c = rk.get(it.key); if (!cols.has(c)) cols.set(c, []); cols.get(c).push(it); }
    const colIdx = [...cols.keys()].sort((a, b) => a - b), W = 1180, cw = Math.max(210, Math.min(300, W / colIdx.length)), ch = 76;
    const pos = new Map();
    colIdx.forEach((c, ci) => cols.get(c).sort((a, b) => topicOf(a).localeCompare(topicOf(b)) || a.key.localeCompare(b.key)).forEach((it, r) => pos.set(it.key, { x: 16 + ci * cw, y: 16 + r * ch })));
    const rows = Math.max(...[...cols.values()].map((l) => l.length), 1), hist = M.inactive.filter((it) => !t || topicOf(it) === t);
    const H = rows * ch + 30 + (hist.length ? 80 : 0), width = Math.max(W, colIdx.length * cw + 30);
    let s = `<svg viewBox="0 0 ${width} ${H}" width="${width}" style="font:12px system-ui">`;
    for (const it of items) for (const u of it.uses) { const d = u.key && keys.has(u.key) && byKey(u.key); if (!d) continue;
      const a = pos.get(it.key), b = pos.get(d.key), bad = blockedBy(it).some((x) => x.key === d.key);
      s += `<path d="M${a.x} ${a.y + 28} C ${a.x - 40} ${a.y + 28}, ${b.x + cw - 10} ${b.y + 28}, ${b.x + cw - 30} ${b.y + 28}" fill="none" stroke="${bad ? 'var(--bad)' : 'var(--line)'}" stroke-width="${bad ? 2.5 : 1.4}"/>`; }
    for (const it of items) { const { x, y } = pos.get(it.key), bb = blockedBy(it);
      s += `<g ${go(itemHash(it))} style="cursor:pointer"><rect x="${x}" y="${y}" width="${cw - 30}" height="58" rx="9" fill="var(--bg)" stroke="${COLOR[it.status]}" stroke-width="1.6"/>
        <text x="${x + 9}" y="${y + 18}" font-weight="600" fill="var(--ink)">${ICON[it.status]} ${esc(name(it)).slice(0, 28)}</text><text x="${x + 9}" y="${y + 32}" fill="var(--ink3)" font-size="11">${esc(WORD[it.status])}${bb.length ? ` by ${esc(bb.map(name).join(', ')).slice(0, 30)}` : ''}</text>`;
      M.levels.forEach((l, i) => { const c = cell(it, i);
        s += `<rect x="${x + 9 + i * 22}" y="${y + 40}" width="19" height="9" rx="2" fill="${c.fill}" fill-opacity="${c.opacity}" stroke="${c.stroke}" ${c.dash ? 'stroke-dasharray="2 2"' : ''}><title>${esc(c.title)}</title></rect>`; });
      if (unbacked(it)) s += `<text x="${x + 9 + M.levels.length * 22 + 4}" y="${y + 48}" fill="var(--gap)" font-size="11">claims ${esc(it.depth)}</text>`;
      s += '</g>'; }
    if (hist.length) {
      const hy = rows * ch + 50;
      s += `<text x="16" y="${hy + 4}" fill="var(--ink3)">history</text>`;
      hist.forEach((it, i) => { const x = 80 + i * 240, sc = it.successor && byKey(it.successor);
        s += `<g ${go(itemHash(it))} style="cursor:pointer"><rect x="${x}" y="${hy - 16}" width="210" height="40" rx="8" fill="none" stroke="var(--hist)" stroke-dasharray="4 3"/><text x="${x + 8}" y="${hy + 1}" fill="var(--hist)">${ICON[it.status]} ${esc(name(it))}</text><text x="${x + 8}" y="${hy + 16}" fill="var(--ink3)" font-size="11">${sc ? `→ ${esc(name(sc))}` : 'retired'}</text></g>`;
        if (sc && pos.has(sc.key)) { const b = pos.get(sc.key); s += `<path d="M${x + 105} ${hy - 16} L ${b.x + 40} ${b.y + 58}" stroke="var(--hist)" stroke-dasharray="4 3" fill="none"/>`; } });
    }
    return `<div class="map"><div class="crumb">${crumbs([{ label: M.root, hash: '#/' }, { label: 'map', hash: t ? '#/map' : '' }, ...(t ? [{ label: t }] : [])])}</div><h1>Map${t ? ` · ${esc(t)}` : ''}</h1>
      <p class="legend">What an item uses is to its left. Bars: filled to the depth the text shows, dashed to the target, purple past it; grey where a level is written past an empty one, red outline where a claimed level is empty. Red lines block. Click an item to read it.</p>${s}</svg></div>`;
  }

  // ---------- routing and live reload ----------
  function render() {
    if (!M) return;
    const [route, qstr = ''] = location.hash.replace(/^#/, '').split('?');
    const q = new URLSearchParams(qstr), parts = route.split('/').filter(Boolean).map(decodeURIComponent);
    document.querySelector('.proj').textContent = `${M.root} · ${M.settings.profile} · ${M.settings.stage}`;
    let out;
    if (parts[0] === 'item') { const it = byKey(parts.slice(1).join('/')); out = it ? itemPage(it, q) : `<p class="err">No item ${esc(parts[1])}. It may have been renamed: <button ${go('#/')}>overview</button></p>`; document.title = it ? `${name(it)} · Anaxi` : 'Anaxi'; }
    else if (parts[0] === 'topic') { out = topicPage(parts[1]); document.title = `${parts[1]} · Anaxi`; }
    else if (parts[0] === 'map') { out = mapPage(q); document.title = 'Map · Anaxi'; }
    else { out = overview(); document.title = `${M.root} · Anaxi`; }
    app.innerHTML = out;
  }
  async function load() {
    try { const r = await fetch('/api/model', { cache: 'no-store' }); const j = await r.json(); if (j.error) throw new Error(j.error); M = j; render(); }
    catch (e) { app.innerHTML = `<p class="err">Can't read the design: ${esc(e.message)}</p>`; }
  }
  const current = () => { const m = location.hash.match(/^#\/item\/([^?]*)/); return m && byKey(decodeURIComponent(m[1])); };
  const rerender = (then) => { const y = window.scrollY; render(); window.scrollTo(0, y); then?.(); };
  document.addEventListener('click', (e) => {
    const tr = e.target.closest('[data-tree]');
    if (tr) { treeAll = tr.getAttribute('data-tree') === 'all'; rerender(); return; }
    if (e.target.closest('[data-gate]')) { showGate = !showGate; try { localStorage.setItem('anaxi.gate', showGate ? '1' : '0'); } catch {} rerender(); return; }
    const f = e.target.closest('[data-fold]'), j = e.target.closest('[data-jump]'), it = current();
    if (f && it) { const k = `${it.key}|${f.getAttribute('data-fold')}`; if (open.has(k)) open.delete(k); else open.add(k); rerender(); return; }
    if (j && it) { // unfold that level (and nothing else changes), then bring it into view
      const l = j.getAttribute('data-jump'), at = new URLSearchParams(location.hash.split('?')[1] || '').get('at') ?? Math.max(lvN(it.depth), 0);
      for (let i = +at + 1; i <= lvN(l); i++) open.add(`${it.key}|${M.levels[i].id}`); // levels are cumulative: open the ones before it too
      rerender(() => document.getElementById(`lv-${l}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })); return;
    }
  });
  document.addEventListener('keydown', (e) => { // 0–4 set the reading depth, [ and ] step it, on an item page
    const it = current(); if (!it || e.metaKey || e.ctrlKey || e.altKey || /input|textarea/i.test(e.target.tagName)) return;
    const at = +(new URLSearchParams(location.hash.split('?')[1] || '').get('at') ?? Math.max(lvN(it.depth), 0)), n = M.levels.length - 1;
    const to = /^\d$/.test(e.key) ? Math.min(+e.key, n) : e.key === ']' ? Math.min(at + 1, n) : e.key === '[' ? Math.max(at - 1, 0) : null;
    if (to != null && to !== at) { location.hash = itemHash(it, `?at=${to}`); }
  });
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-go]'); if (t) { e.preventDefault(); const h = t.getAttribute('data-go'); if (h) { if (location.hash === h) render(); else location.hash = h; } } });
  let lastItem = null;
  window.addEventListener('hashchange', () => { peek.hidden = true; const it = current(); const same = it && lastItem === it.key; lastItem = it?.key || null; if (same) rerender(); else { render(); window.scrollTo(0, 0); } });
  const live = document.querySelector('.live');
  try {
    const es = new EventSource('/events');
    es.addEventListener('change', () => { const y = window.scrollY; load().then(() => window.scrollTo(0, y)); });
    es.onerror = () => { live.classList.add('off'); live.textContent = '○ offline'; };
    es.onopen = () => { live.classList.remove('off'); live.textContent = '● live'; };
  } catch { live.classList.add('off'); }
  load();
})();
