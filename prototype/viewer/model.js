/* Anaxi viewer exploration · pure model (THROWAWAY, but the parts the real viewer keeps are marked KEEP).
 * Input: window.ANAXI = { model: anaxi-check status --json, files: { path: markdown } } (data.js, from data.mjs).
 * Everything here is a function of that input: no DOM, no clock, no randomness except the seeded generator. */
(function () {
  const LEVELS = ['D0', 'D1', 'D2', 'D3', 'D4'];
  const lvN = (l) => LEVELS.indexOf(l);
  // KEEP: the ladder's own names as paragraph lead-ins ("**Why.**", "**Shape.**") carry levels, like headings do.
  const LEADIN = { why: 'D0', context: 'D0', what: 'D1', behaviour: 'D1', behavior: 'D1', shape: 'D2', design: 'D2',
    contract: 'D3', contracts: 'D3', interface: 'D3', build: 'D4', steps: 'D4', plan: 'D4' };
  const LEADSPLIT = new RegExp(`(?=\\*\\*(?:${Object.keys(LEADIN).map((k) => k[0].toUpperCase() + k.slice(1)).join('|')})\\.\\*\\*)`);

  /** The project: current items, inactive items, files; plus lookup and graph helpers. */
  function project(data) {
    const { model, files } = data;
    const items = model.items.map((it) => ({ ...it, key: it.id || `${it.file}#${it.line}` }));
    const inactive = (model.inactive || []).map((it) => ({ ...it, key: it.id || `${it.file}#${it.line}` }));
    const all = [...items, ...inactive];
    const byKey = new Map(all.map((it) => [it.key, it]));
    const nudges = model.nudges || [];
    for (const it of all) {
      it.nudges = nudges.filter((n) => n.item === it.key);
      it.blockedBy = it.nudges.filter((n) => n.code === 'N02' && n.severity === 'block').map((n) => n.uses);
      it.usedBy = items.filter((o) => o.uses.some((u) => u.id === it.key)).map((o) => o.key);
      it.topic = it.about?.[0] || (it.file.split('/')[0].replace(/\.md$/, '') || 'project');
    }
    return { model, files, items, inactive, all, byKey, nudges, deleted: model.deleted || [] };
  }

  /** KEEP: the lines an item owns: a whole file after its front matter, or its heading down to the next heading of
   *  the same or a higher level. Parts are appended from their own files. */
  function region(P, it) {
    const lines = (P.files[it.file] || '').split('\n');
    let start = it.line - 1, end = lines.length, h = 0;
    if (it.declared === 'front-matter') {
      start = lines[0] === '---' ? lines.findIndex((l, i) => i > 0 && l.trim() === '---') + 1 : 0;
    } else {
      h = (lines[start].match(/^(#+)/) || ['', ''])[1].length;
      for (let i = start + 1; i < lines.length; i++) {
        const m = lines[i].match(/^(#+)\s/);
        if (m && m[1].length <= h && !inFence(lines, i)) { end = i; break; }
      }
    }
    const own = { file: it.file, from: start, lines: lines.slice(start, end) };
    const parts = (it.parts || []).map((p) => {
      const pl = (P.files[p.file] || '').split('\n');
      const s = p.line - 1, ph = (pl[s].match(/^(#+)/) || ['', '##'])[1].length;
      let e = pl.length;
      for (let i = s + 1; i < pl.length; i++) { const m = pl[i].match(/^(#+)\s/); if (m && m[1].length <= ph) { e = i; break; } }
      return { file: p.file, from: s, lines: pl.slice(s, e), part: p };
    });
    return [own, ...parts];
  }
  const inFence = (lines, i) => lines.slice(0, i).filter((l) => /^\s*(```|~~~)/.test(l)).length % 2 === 1;

  /** KEEP: split a region into blocks, each with a level (D0–D4, 'canvas', 'history', 'questions' or null). A heading's
   *  level comes from the checker's sections (by line); a lead-in paragraph sets its own; others inherit. */
  function blocks(P, it) {
    const out = [];
    for (const r of region(P, it)) {
      const secs = (it.sections || []).filter((s) => (s.file || it.file) === r.file);
      let level = null, inF = false, cur = null;
      const flush = () => {
        if (!cur) return;
        if (cur.kind === 'para') { // several levels in one paragraph: split at each lead-in ("**Why.** … **What.** …")
          const chunks = cur.text.join(' ').split(LEADSPLIT).filter((x) => x.trim());
          let lv = cur.level;
          for (const c of chunks) {
            const m = c.match(/^\*\*([A-Za-z]+)\.\*\*/);
            if (m && LEADIN[m[1].toLowerCase()]) lv = LEADIN[m[1].toLowerCase()];
            out.push({ ...cur, level: lv, text: [c.trim()] });
          }
          level = lv;
        } else out.push(cur);
        cur = null;
      };
      r.lines.forEach((line, k) => {
        const n = r.from + k + 1; // 1-based line number in the file
        if (/^\s*(```|~~~)/.test(line)) { if (!inF) { flush(); cur = { kind: 'code', level, text: [] , file: r.file, line: n }; inF = true; return; } inF = false; cur.text.push(line); flush(); return; }
        if (inF) { cur.text.push(line); return; }
        const hm = line.match(/^(#{1,6})\s+(.*)$/);
        if (hm) {
          flush();
          const sec = secs.find((s) => s.line === n);
          if (sec) level = sec.level;
          if (k === 0 && it.declared !== 'front-matter' && !r.part) { out.push({ kind: 'title', level: null, text: [line], file: r.file, line: n }); return; }
          out.push({ kind: 'heading', depth: hm[1].length, level, text: [hm[2]], file: r.file, line: n, part: r.part?.title });
          return;
        }
        if (/^>\s*(@|depth:|part-of:|open:|superseded-by:|supersedes:|retired:)/.test(line) || /^<!--\s*anaxi:/.test(line)) { flush(); out.push({ kind: 'mark', level: null, text: [line], file: r.file, line: n }); return; }
        if (!line.trim()) { flush(); return; }
        const lead = line.match(/^\*\*([A-Za-z]+)\.\*\*/);
        if (lead && LEADIN[lead[1].toLowerCase()]) { flush(); level = LEADIN[lead[1].toLowerCase()]; cur = { kind: 'para', level, text: [line], file: r.file, line: n, lead: true }; return; }
        const kind = /^\s*\|/.test(line) ? 'table' : /^\s*[-*+]\s|^\s*\d+\.\s/.test(line) ? 'list' : 'para';
        // KEEP: a wrapped list item (a plain line right after a list line) continues that item
        if (kind === 'para' && cur && cur.kind === 'list') { cur.text[cur.text.length - 1] += ` ${line.trim()}`; return; }
        if (cur && cur.kind === kind) cur.text.push(line);
        else { flush(); cur = { kind, level, text: [line], file: r.file, line: n }; }
      });
      flush();
    }
    return out;
  }

  /** KEEP: what shows at depth `at`: levels ≤ at; the canvas and history only when asked; unlevelled text always. */
  function visible(b, at, { canvas = false, history = false } = {}) {
    if (b.level === 'canvas') return canvas;
    if (b.level === 'history') return history;
    if (b.level == null || b.level === 'questions') return true;
    return lvN(b.level) <= at;
  }
  const words = (bs) => bs.reduce((s, b) => s + (b.kind === 'mark' || b.kind === 'title' ? 0 : b.text.join(' ').split(/\s+/).filter(Boolean).length), 0);

  /** Tiny markdown → HTML, enough for the example: headings, paragraphs, lists, checkboxes, tables, code, inline. */
  function inline(s, esc) {
    return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="vw-link" data-href="$2">$1</a>')
      .replace(/(^|[\s(])(@[A-Za-z][\w-]*)/g, '$1<a class="vw-at" data-at="$2">$2</a>');
  }
  function html(b, esc) {
    const t = b.text;
    if (b.kind === 'heading') return `<h${Math.min(b.depth + 1, 6)} class="vw-h">${inline(t[0].replace(/`(D\d|superseded)[^`]*`/g, ''), esc)}${b.level ? ` <span class="vw-lv lv-${b.level}">${b.level}</span>` : ''}${b.part ? ` <span class="vw-part">part · ${esc(b.file)}</span>` : ''}</h${Math.min(b.depth + 1, 6)}>`;
    if (b.kind === 'code') return `<pre class="vw-code">${esc(t.slice(1, -1).join('\n'))}</pre>`;
    if (b.kind === 'table') {
      const rows = t.filter((l) => !/^\s*\|[\s|:-]+\|\s*$/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      return `<table class="vw-table"><tr>${rows[0].map((c) => `<th>${inline(c, esc)}</th>`).join('')}</tr>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${inline(c, esc)}</td>`).join('')}</tr>`).join('')}</table>`;
    }
    if (b.kind === 'list') return `<ul class="vw-list">${t.map((l) => { const c = l.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/); return c ? `<li class="vw-check ${c[1] === ' ' ? 'open' : 'done'}">${c[1] === ' ' ? '☐' : '☑'} ${inline(c[2], esc)}</li>` : `<li>${inline(l.replace(/^\s*([-*+]|\d+\.)\s+/, ''), esc)}</li>`; }).join('')}</ul>`;
    return `<p>${inline(t.join(' '), esc)}</p>`;
  }

  /** KEEP: one layout for every map: columns by dependency rank (what you use is to the left), rows by topic. */
  function layout(items) {
    const byKey = new Map(items.map((it) => [it.key, it]));
    const rank = new Map();
    const r = (it, seen = new Set()) => {
      if (rank.has(it.key)) return rank.get(it.key);
      if (seen.has(it.key)) return 0;
      seen.add(it.key);
      const deps = it.uses.map((u) => byKey.get(u.id)).filter(Boolean);
      const v = deps.length ? 1 + Math.max(...deps.map((d) => r(d, seen))) : 0;
      rank.set(it.key, v); return v;
    };
    items.forEach((it) => r(it));
    const cols = new Map();
    for (const it of items) { const c = rank.get(it.key); if (!cols.has(c)) cols.set(c, []); cols.get(c).push(it); }
    const topics = [...new Set(items.map((it) => it.topic))].sort();
    for (const list of cols.values()) list.sort((a, b) => topics.indexOf(a.topic) - topics.indexOf(b.topic) || a.key.localeCompare(b.key));
    const pos = new Map();
    for (const [c, list] of cols) list.forEach((it, i) => pos.set(it.key, { col: c, row: i }));
    return { pos, ncols: Math.max(...rank.values(), 0) + 1, nrows: Math.max(...[...cols.values()].map((l) => l.length), 1), topics };
  }

  /** Seeded synthetic projects for the scale test (same generator for every candidate). */
  function synthetic(n, seed) {
    let s = seed >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const topics = ['api', 'ui', 'data', 'async', 'infra', 'integration', 'security', 'ml'].slice(0, Math.max(2, Math.ceil(n / 8)));
    const items = [];
    for (let i = 0; i < n; i++) {
      const target = 1 + Math.floor(rnd() * 4), depth = Math.max(0, Math.min(4, target - 2 + Math.floor(rnd() * 4)));
      const uses = [];
      for (let k = 0; k < Math.floor(rnd() * 3) && i > 0; k++) { const d = Math.floor(rnd() * i); if (!uses.some((u) => u.id === `@i${d}`)) uses.push({ id: `@i${d}` }); }
      items.push({ key: `@i${i}`, id: `@i${i}`, title: `Item ${i}`, topic: topics[Math.floor(rnd() * topics.length)], depth: `D${depth}`, target: `D${target}`, uses });
    }
    const byKey = new Map(items.map((it) => [it.key, it]));
    for (const it of items) {
      const short = it.uses.map((u) => byKey.get(u.id)).filter((d) => lvN(d.depth) < lvN(d.target));
      it.blockedBy = short.map((d) => d.key);
      it.status = short.length ? 'blocked' : lvN(it.depth) < lvN(it.target) ? 'gap' : lvN(it.depth) > lvN(it.target) ? 'trim' : 'enough';
    }
    return items;
  }

  /** The scale test: at a fixed canvas, how many items can be read, and how many are hidden behind others.
   *  Geometry only (bounding boxes of what each candidate would draw), not pixels: see the assumptions. */
  const CANVAS = { W: 1100, H: 620 };
  function metrics(items, kind) {
    const L = layout(items);
    const boxes = [];
    let label = 0;
    if (kind === '2d') {
      const cw = CANVAS.W / L.ncols, ch = CANVAS.H / L.nrows;
      label = Math.min(cw - 24, (ch - 8) * 4); // a card's usable text width
      for (const it of items) { const p = L.pos.get(it.key); boxes.push({ it, x: p.col * cw, y: p.row * ch, w: cw - 24, h: ch - 8, z: 0 }); }
    } else {
      // both 3D and city: a ground grid seen from above at an angle; columns rise by level
      const iso = kind === 'city';
      const cell = Math.min(CANVAS.W / (L.ncols + L.nrows) * (iso ? 1.6 : 1.4), 120);
      label = cell * 0.9;
      for (const it of items) {
        const p = L.pos.get(it.key);
        const hgt = (lvN(it.target) + 1) * cell * (iso ? 0.35 : 0.45);
        const x = (p.col - p.row) * cell * 0.7 + CANVAS.W / 2, y = (p.col + p.row) * cell * (iso ? 0.35 : 0.3) + 60;
        boxes.push({ it, x: x - cell * 0.35, y: y - hgt, w: cell * 0.7, h: hgt + cell * 0.2, z: p.col + p.row });
      }
    }
    if (kind !== '2d' && boxes.length) { // fit the scene to the canvas, as a camera would
      const x0 = Math.min(...boxes.map((b) => b.x)), x1 = Math.max(...boxes.map((b) => b.x + b.w));
      const y0 = Math.min(...boxes.map((b) => b.y)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
      const k = Math.min(1, (CANVAS.W - 40) / (x1 - x0), (CANVAS.H - 40) / (y1 - y0));
      for (const b of boxes) { b.x = 20 + (b.x - x0) * k; b.y = 20 + (b.y - y0) * k; b.w *= k; b.h *= k; }
      label *= k;
    }
    // occluded: more than half of a box covered by nearer boxes (higher z draws later)
    let occluded = 0, off = 0;
    for (const a of boxes) {
      if (a.x < 0 || a.x + a.w > CANVAS.W || a.y < 0 || a.y + a.h > CANVAS.H + 200) off++;
      if (kind === '2d') continue;
      let cover = 0;
      for (const b of boxes) if (b !== a && b.z > a.z) {
        const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        cover = Math.max(cover, (ix * iy) / (a.w * a.h));
      }
      if (cover > 0.5) occluded++;
    }
    const legible = label >= 90 ? items.length - occluded : 0; // a label needs ~90 px for "@recurring D2→D3"
    return { n: items.length, labelPx: Math.round(label), occluded, legible, legibleShare: items.length ? legible / items.length : 1, off };
  }

  /** Semantic zoom: the project level shows topics; each topic opens its own map. Measured on the largest topic. */
  function zoomed(items, kind) {
    const by = new Map();
    for (const it of items) { if (!by.has(it.topic)) by.set(it.topic, []); by.get(it.topic).push(it); }
    const largest = [...by.values()].sort((a, b) => b.length - a.length)[0] || [];
    const keys = new Set(largest.map((it) => it.key));
    const local = largest.map((it) => ({ ...it, uses: it.uses.filter((u) => keys.has(u.id)) }));
    const m = metrics(local, kind);
    return { ...m, topics: by.size, topicSize: largest.length };
  }

  window.VM = { zoomed, LEVELS, lvN, project, region, blocks, visible, words, html, inline, layout, synthetic, metrics, CANVAS };
})();
