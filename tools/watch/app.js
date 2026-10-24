// anaxi watch · the reader (served by tools/anaxi-watch.mjs). Read-only, no dependencies.
// Routes: #/ overview · #/topic/<t> · #/item/<key>?at=2&canvas=1&history=1 · #/map[?topic=<t>]
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
  const all = () => [...M.items, ...M.inactive];
  const byKey = (k) => all().find((it) => it.key === k);
  const name = (it) => it.id || it.title;
  const topicOf = (it) => it.about?.[0] || it.file.split('/').slice(0, -1).join('/') || 'project';
  const life = (it) => it.lifecycle && it.lifecycle !== 'current';
  const go = (h) => `data-go="${esc(h)}"`;
  const itemHash = (it, q = '') => `#/item/${encodeURIComponent(it.key)}${q}`;
  const link = (it) => (it ? `<button ${go(itemHash(it))}>${esc(name(it))}</button>` : '');
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
  const shell = (crumbs, nav, main, rail) => `<div class="vw"><nav class="vw-nav">${nav}</nav><div class="main"><div class="crumb">${crumbs}</div>${main}</div><aside class="vw-rail">${rail}</aside></div>`;
  const crumbs = (list) => list.map((c) => (c.hash ? `<button ${go(c.hash)}>${esc(c.label)}</button>` : esc(c.label))).join(' › ');
  const topics = () => [...new Set(M.items.map(topicOf))].sort();
  const nav = (active) => `<h4>Topics</h4>${topics().map((t) => `<button class="o ${t === active ? 'on' : ''}" ${go(`#/topic/${encodeURIComponent(t)}`)}>${esc(t)} · ${M.items.filter((i) => topicOf(i) === t).length}</button>`).join('')}
    ${M.inactive.length || M.deleted.length ? `<h4>History</h4>${M.inactive.map((it) => `<button class="o dim" ${go(itemHash(it))}>${ICON[it.status]} ${esc(name(it))}</button>`).join('')}${M.deleted.map((d) => `<span class="o dim" title="${esc(d.why || '')}">✕ ${esc(d.id)}</span>`).join('')}` : ''}`;
  const row = (it) => { const bb = blockedBy(it), ub = usedBy(it);
    return `<div class="row"><span>${ICON[it.status]}</span><span>${link(it)} <span class="t">${esc(it.title)}</span></span><span>${esc(it.depth || '—')} → ${esc(it.target || '—')}</span><span>${bb.length ? `blocked by ${bb.map(link).join(', ')}` : esc(WORD[it.status])}${ub.length ? ` · used by ${ub.map(link).join(', ')}` : ''}</span></div>`; };
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
    const groups = ORDER.map((s) => [s, M.items.filter((it) => it.status === s)]).filter(([, l]) => l.length);
    const first = reading()[0];
    const main = `<h1>${esc(M.root)}</h1>
      <div class="badges"><span class="b">${esc(M.settings.profile)} profile</span><span class="b">stage: ${esc(M.settings.stage)}</span><span class="b">${M.items.length} items · ${M.items.filter((i) => i.status === 'enough').length} enough · ${M.items.filter((i) => i.status === 'blocked').length} blocked</span>${M.inactive.length + M.deleted.length ? `<span class="b">${M.inactive.length + M.deleted.length} in history</span>` : ''}</div>
      ${M.errors.length ? `<p class="err">${M.errors.length} error(s): ${M.errors.slice(0, 3).map(esc).join(' · ')}</p>` : ''}
      ${groups.map(([s, l]) => `<div class="group">${ICON[s]} ${WORD[s]} · ${l.length}</div>${l.map(row).join('')}`).join('')}
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

  function itemPage(it, q) {
    const opts = { canvas: q.get('canvas') === '1', history: q.get('history') === '1' };
    const tgt = lvN(it.target), at = q.has('at') ? Math.min(+q.get('at'), M.levels.length - 1) : Math.max(lvN(it.depth), 0);
    const shown = it.blocks.filter((b) => visible(b, at, opts)), hidden = it.blocks.filter((b) => b.kind !== 'mark' && b.kind !== 'title' && !visible(b, at, opts));
    const qs = (o) => { const p = new URLSearchParams({ at, ...(opts.canvas ? { canvas: 1 } : {}), ...(opts.history ? { history: 1 } : {}), ...o }); for (const [k, v] of [...p]) if (v === '0' && k !== 'at') p.delete(k); return `?${p}`; };
    const body = shown.map((b) => (b.level === 'canvas' ? `<div class="canvas">${html(b)}</div>` : b.level === 'history' ? `<div class="history">${html(b)}</div>` : html(b))).join('');
    const succ = it.successor && byKey(it.successor);
    const banner = life(it) ? `<div class="banner">${ICON[it.status]} <b>${it.supersededBy ? `Superseded by ${esc(it.supersededBy.id)}` : 'Retired'}</b>${it.supersededBy?.reason ? `: ${esc(it.supersededBy.reason)}` : it.retired?.reason ? `: ${esc(it.retired.reason)}` : ''}. ${succ ? `Read ${link(succ)} instead; this page explains what came before.` : "Kept for its reasoning; it doesn't count."}${it.lifecycle === 'archived' ? ' (archived)' : ''}</div>` : '';
    const depthCtl = `<span class="depth">${M.levels.map((l, i) => `<button ${go(itemHash(it, qs({ at: i })))} class="${i === at ? 'on' : ''} ${tgt >= 0 && i > tgt ? 'past' : ''}" title="${esc(l.name || '')}${tgt >= 0 && i > tgt ? ' · beyond the target' : ''}">${esc(l.id)}</button>`).join('')}</span>
      ${it.blocks.some((b) => b.level === 'canvas') ? `<button class="toggle" ${go(itemHash(it, qs({ canvas: opts.canvas ? 0 : 1 })))}>${opts.canvas ? 'hide' : 'show'} canvas</button>` : ''}
      ${it.blocks.some((b) => b.level === 'history') ? `<button class="toggle" ${go(itemHash(it, qs({ history: opts.history ? 0 : 1 })))}>${opts.history ? 'hide' : 'show'} decision log</button>` : ''}`;
    const order = reading(), i = order.findIndex((x) => x.key === it.key);
    const pager = i < 0 ? '' : `<div class="pager"><span>${i > 0 ? `← <button ${go(itemHash(order[i - 1], `?at=${at}`))}>${esc(name(order[i - 1]))}</button>` : ''}</span><span class="mid">${i + 1} of ${order.length} · reading at ${esc(M.levels[at].id)}</span><span>${i < order.length - 1 ? `<button ${go(itemHash(order[i + 1], `?at=${at}`))}>${esc(name(order[i + 1]))}</button> →` : ''}</span></div>`;
    const lvTitle = (l) => { const d = M.levels.find((x) => x.id === l); return d?.name ? `${l} ${d.name}` : l; };
    const main = `${banner}<h1>${esc(it.title)}</h1>
      <div class="badges">${it.id ? `<span class="b">${esc(it.id)}</span>` : ''}<span class="b st-${it.status}">${ICON[it.status]} ${esc(WORD[it.status])}</span><span class="b">depth ${esc(it.depth || '—')} · target ${esc(it.target || '—')}${it.effective && it.effective !== it.target ? ` (now ${esc(it.effective)})` : ''}</span>${it.risk ? `<span class="b">risk ${it.risk.join('·')}</span>` : ''}<span class="b">${esc(it.file)}:${it.line}</span></div>
      ${depthCtl}${body}
      ${hidden.length ? `<div class="hidden-note">${hidden.length} block${hidden.length > 1 ? 's' : ''} hidden (${[...new Set(hidden.map((b) => b.level))].map(esc).join(', ')}): ${words(hidden)} words. ${at < M.levels.length - 1 ? `<button ${go(itemHash(it, qs({ at: at + 1 })))}>Read to ${esc(lvTitle(M.levels[at + 1].id))}</button>` : ''}</div>` : ''}
      ${it.caveats ? `<p><b>Caveats.</b> ${inline(it.caveats, it.file)}</p>` : ''}${it.later.length ? `<p><b>Later.</b> ${it.later.map((l) => inline(l, it.file)).join(' · ')}</p>` : ''}${pager}`;
    const nud = M.nudges.filter((n) => n.item === it.key && n.code !== 'N04');
    const bb = blockedBy(it), ub = usedBy(it);
    const outline = it.blocks.filter((b) => b.kind === 'heading' || b.lead).map((b) => {
      const label = b.kind === 'heading' ? b.text[0].replace(/`[^`]*`/g, '') : (b.text[0].match(/^\*\*([^*.]+)/) || [])[1] || '';
      return `<span class="o ${visible(b, at, opts) ? '' : 'dim'}">${b.level ? `<span class="lv">${esc(b.level)}</span> ` : ''}${esc(label)}</span>`;
    }).join('');
    const rail = `<h4>Ready to build?</h4><div class="n">${it.gate.ready ? '🎯 yes: at its target, nothing open' : `no: ${it.gate.why.map(esc).join(' · ')}`}</div>
      ${bb.length ? `<div class="n">⛔ blocked by ${bb.map(link).join(', ')}</div>` : ''}
      <h4>Nudges</h4>${nud.length ? nud.map((n) => `<div class="n"><b>${esc(n.code)}</b> ${esc(n.message)}</div>`).join('') : `<div class="n">${life(it) ? 'not counted: history' : 'none: designed enough'}</div>`}
      <h4>Uses</h4>${it.uses.length ? it.uses.map((u) => `<div class="n">${u.key && byKey(u.key) ? link(byKey(u.key)) : esc(u.raw)} <span class="t">${esc(u.actual || '')}${u.required ? ` of ${esc(u.required)}` : ''}</span></div>`).join('') : '<div class="n">nothing</div>'}
      <h4>Used by</h4>${ub.length ? ub.map((x) => `<div class="n">${link(x)}</div>`).join('') : '<div class="n">nobody</div>'}
      ${it.parts.length ? `<h4>Parts, shown inline</h4>${it.parts.map((p) => `<div class="n">${esc(p.title)} · ${esc(p.file)}</div>`).join('')}` : ''}
      ${(it.supersedes || []).length ? `<h4>Replaced</h4>${it.supersedes.map((s) => { const o = all().find((x) => x.id === s); return `<div class="n">${o ? link(o) : `${esc(s)} (deleted)`}</div>`; }).join('')}` : ''}
      <h4>On this page</h4>${outline || '<span class="o dim">no levelled sections</span>'}`;
    return shell(crumbs([{ label: M.root, hash: '#/' }, { label: topicOf(it), hash: `#/topic/${encodeURIComponent(topicOf(it))}` }, { label: name(it) }]), nav(topicOf(it)), main, rail);
  }

  // ---------- the map: 2D depth bars; by topic above SMALL items ----------
  function bars(it) {
    const d = lvN(it.depth), t = lvN(it.target);
    return `<span class="bar">${M.levels.map((l, i) => { const f = i <= d, over = f && t >= 0 && i > t, need = t >= 0 && i <= t;
      return `<i style="background:${over ? 'var(--trim)' : f ? COLOR[it.status === 'blocked' ? 'gap' : it.status] : 'transparent'};${need || f ? '' : 'opacity:.35'};${need && !f ? 'border-style:dashed' : ''}"></i>`; }).join('')}</span>`;
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
    for (const it of items) { const { x, y } = pos.get(it.key), d = lvN(it.depth), tg = lvN(it.target), bb = blockedBy(it);
      s += `<g ${go(itemHash(it))} style="cursor:pointer"><rect x="${x}" y="${y}" width="${cw - 30}" height="58" rx="9" fill="var(--bg)" stroke="${COLOR[it.status]}" stroke-width="1.6"/>
        <text x="${x + 9}" y="${y + 18}" font-weight="600" fill="var(--ink)">${ICON[it.status]} ${esc(name(it)).slice(0, 28)}</text><text x="${x + 9}" y="${y + 32}" fill="var(--ink3)" font-size="11">${esc(WORD[it.status])}${bb.length ? ` by ${esc(bb.map(name).join(', ')).slice(0, 30)}` : ''}</text>`;
      M.levels.forEach((l, i) => { const f = i <= d, over = f && tg >= 0 && i > tg, need = tg >= 0 && i <= tg;
        s += `<rect x="${x + 9 + i * 22}" y="${y + 40}" width="19" height="9" rx="2" fill="${over ? 'var(--trim)' : f ? COLOR[it.status === 'blocked' ? 'gap' : it.status] : 'none'}" stroke="${need || f ? 'var(--ink3)' : 'var(--line)'}" ${need && !f ? 'stroke-dasharray="2 2"' : ''}/>`; });
      s += '</g>'; }
    if (hist.length) {
      const hy = rows * ch + 50;
      s += `<text x="16" y="${hy + 4}" fill="var(--ink3)">history</text>`;
      hist.forEach((it, i) => { const x = 80 + i * 240, sc = it.successor && byKey(it.successor);
        s += `<g ${go(itemHash(it))} style="cursor:pointer"><rect x="${x}" y="${hy - 16}" width="210" height="40" rx="8" fill="none" stroke="var(--hist)" stroke-dasharray="4 3"/><text x="${x + 8}" y="${hy + 1}" fill="var(--hist)">${ICON[it.status]} ${esc(name(it))}</text><text x="${x + 8}" y="${hy + 16}" fill="var(--ink3)" font-size="11">${sc ? `→ ${esc(name(sc))}` : 'retired'}</text></g>`;
        if (sc && pos.has(sc.key)) { const b = pos.get(sc.key); s += `<path d="M${x + 105} ${hy - 16} L ${b.x + 40} ${b.y + 58}" stroke="var(--hist)" stroke-dasharray="4 3" fill="none"/>`; } });
    }
    return `<div class="map"><div class="crumb">${crumbs([{ label: M.root, hash: '#/' }, { label: 'map', hash: t ? '#/map' : '' }, ...(t ? [{ label: t }] : [])])}</div><h1>Map${t ? ` · ${esc(t)}` : ''}</h1>
      <p class="legend">What an item uses is to its left. Bars: filled to the depth, dashed to the target, purple past it. Red lines block. Click an item to read it.</p>${s}</svg></div>`;
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
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-go]'); if (t) { e.preventDefault(); const h = t.getAttribute('data-go'); if (h) { if (location.hash === h) render(); else location.hash = h; } } });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  const live = document.querySelector('.live');
  try {
    const es = new EventSource('/events');
    es.addEventListener('change', () => { const y = window.scrollY; load().then(() => window.scrollTo(0, y)); });
    es.onerror = () => { live.classList.add('off'); live.textContent = '○ offline'; };
    es.onopen = () => { live.classList.remove('off'); live.textContent = '● live'; };
  } catch { live.classList.add('off'); }
  load();
})();
