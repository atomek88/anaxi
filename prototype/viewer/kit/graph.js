/* proto-kit · graph — dependency-free SVG for flows, DAGs, architectures and sequence diagrams. THROWAWAY.
 *
 *   P.graph('arch', { title, direction:'LR'|'TB', nodes:[{id,label,sub?,kind?,rank?}], edges:[{from,to,label?,kind?:'async'|'data'}] })
 *   const g = Graph.render(el, 'arch', { focus:['api','db'], hop:['api','db'], badges:{db:'3 rows'}, tokens:[{from,to,label}] })
 *   g.pulse('api','db',{label:'cmd'})   // animated dot along an edge (static in ?capture=1)
 *
 *   P.graph('flow', { type:'sequence', actors:[{id,label,kind?}], messages:[{from,to,label,kind?:'sync'|'async'|'return'}] })
 *   Graph.sequence(el, 'flow', { upTo: 3 })   // messages after 3 dimmed, message 3 highlighted
 *
 *   Graph.stepView('arch', { side(ctx) })    // ready-made scenario render/after: step.hop / step.focus / step.payload / step.rows / step.badges
 *
 * Node kinds: source · transform · store · sink · service · queue · external · actor (colours in kit.css --pk-k-*).
 * Graphs registered with P.graph land in the manifest and are harvested as mermaid.
 */
(function () {
  const P = window.P, esc = P.esc;
  const NS = "http://www.w3.org/2000/svg";
  const css = `
  .gx-svg { display:block; max-width:100%; height:auto; overflow:visible; font-family:-apple-system,system-ui,sans-serif; }
  .gx-node rect, .gx-node path.body { fill:#fff; stroke-width:1.6; }
  .gx-node .lbl { font-size:14px; font-weight:600; fill:#1c1b19; }
  .gx-node .sub { font-size:11.5px; fill:#9a968f; }
  .gx-edge path { fill:none; stroke:#bdb9b2; stroke-width:1.6; }
  .gx-edge.async path { stroke-dasharray:6 5; } .gx-edge.data path { stroke:#8a5cc8; }
  .gx-edge text { font-size:11px; fill:#5d5a55; }
  .gx-edge .lblbg { fill:#fff; }
  .gx-edge.on path { stroke:var(--pk-accent); stroke-width:2.6; }
  .gx-node.on rect, .gx-node.on path.body { stroke:var(--pk-accent) !important; stroke-width:2.6; fill:var(--pk-accent-soft); }
  .gx-dim { opacity:.32; }
  .gx-badge rect { fill:var(--pk-ink); } .gx-badge text { fill:#fff; font-size:10.5px; font-weight:700; }
  .gx-token circle { fill:var(--pk-accent); stroke:#fff; stroke-width:2; }
  .gx-token text { font-size:11px; font-weight:700; fill:var(--pk-accent); }
  .gx-seq .life { stroke:#d8d4ce; stroke-dasharray:4 4; }
  .gx-seq .msg path { stroke:#8d8983; stroke-width:1.5; fill:none; } .gx-seq .msg.return path { stroke-dasharray:5 4; }
  .gx-seq .msg text { font-size:12px; fill:#3b3935; } .gx-seq .msg .n { font-size:10px; fill:#9a968f; font-weight:700; }
  .gx-seq .msg.on path { stroke:var(--pk-accent); stroke-width:2.6; } .gx-seq .msg.on text { fill:var(--pk-accent); font-weight:700; }
  .gx-seq .msg.later { opacity:.25; }
  .gx-group rect { fill:rgba(244,242,239,.55); stroke-width:1.4; stroke-dasharray:0; }
  .gx-group .lbl { font-size:13px; font-weight:700; fill:#5d5a55; } .gx-group .sub { font-size:11px; fill:#9a968f; }
  .gx-bound rect { fill:none; stroke-width:1.8; stroke-dasharray:7 5; } .gx-bound text { font-size:11.5px; font-weight:700; letter-spacing:.4px; }
  .gx-node.drill:hover rect { stroke-width:2.6; } .gx-node .drillmark { font-size:13px; fill:var(--pk-accent); font-weight:700; }
  .gx-edge.ov text { fill:var(--pk-ink); font-weight:700; }
  .gx-wrap { display:flex; flex-direction:column; gap:18px; }
  .gx-host { overflow-x:auto; }
  .gx-side { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:14px 22px; align-items:start; }
  .gx-side > div { min-width:0; overflow-x:auto; }
  .gx-side h3 { font-size:11px; text-transform:uppercase; letter-spacing:.6px; color:var(--pk-ink-3); margin:0 0 6px; }
`;
  document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);

  const color = (k) => `var(--pk-k-${k || "transform"})`;
  const textW = (s, px) => String(s || "").length * px;
  const get = (g) => (typeof g === "string" ? P.graphs[g] : g);

  /* ---------------- layered layout ---------------- */
  const STORE_R = 7;
  function layout(def) {
    const nodes = def.nodes.map((n, i) => {
      const w = Math.min(320, Math.max(96, textW(n.label, 7.9) + 34, textW(n.sub, 6.4) + 30) + (n.kind === "queue" ? 26 : 0));
      const h = (n.sub ? 54 : 40) + (n.kind === "store" ? STORE_R + 3 : 0);
      return { ...n, i, w, h };
    });
    const LR = def.direction !== "TB", LRdim = LR;
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const edges = def.edges.filter((e) => byId[e.from] && byId[e.to]);
    // break cycles: DFS in declaration order, edges into the current stack are back edges (drawn, but ignored for layering)
    const state = {}, back = new Set(), out = (id) => edges.filter((e) => e.from === id);
    const dfs = (id) => { state[id] = 1; for (const e of out(id)) { if (state[e.to] === 1) back.add(e); else if (!state[e.to]) dfs(e.to); } state[id] = 2; };
    nodes.forEach((n) => { if (!state[n.id] && !edges.some((e) => e.to === n.id)) dfs(n.id); });
    nodes.forEach((n) => { if (!state[n.id]) dfs(n.id); });
    const dag = edges.filter((e) => !back.has(e));
    // longest-path layering on the DAG; rank pins win
    const layer = {};
    const lay = (id, seen = new Set()) => {
      if (layer[id] != null) return layer[id];
      if (byId[id].rank != null) return (layer[id] = byId[id].rank);
      const preds = dag.filter((e) => e.to === id).map((e) => e.from);
      return (layer[id] = preds.length ? Math.max(...preds.map((p) => lay(p))) + 1 : 0);
    };
    nodes.forEach((n) => (n.layer = lay(n.id)));
    // long edges get an invisible waypoint per column they cross, so ordering gives them their own lane
    const seg = []; // edges used for ordering: long edges replaced by chains through waypoints
    dag.forEach((e, k) => {
      const a = byId[e.from], b = byId[e.to];
      if (b.layer - a.layer <= 1) { seg.push(e); return; }
      e._via = [];
      let prev = e.from;
      for (let l = a.layer + 1; l < b.layer; l++) {
        const d = { id: `__via${k}_${l}`, dummy: true, layer: l, i: nodes.length, w: LRdim ? 8 : 8, h: 8 };
        nodes.push(d); byId[d.id] = d; e._via.push(d.id);
        seg.push({ from: prev, to: d.id }); prev = d.id;
      }
      seg.push({ from: prev, to: e.to });
    });
    const L = Math.max(0, ...nodes.map((n) => n.layer)) + 1;
    const cols = Array.from({ length: L }, (_, l) => nodes.filter((n) => n.layer === l));
    cols.forEach((c) => c.forEach((n, i) => (n.o = i)));
    for (let sweep = 0; sweep < 6; sweep++) {
      const fwd = sweep % 2 === 0;
      for (const c of fwd ? cols.slice(1) : cols.slice(0, -1).reverse()) {
        for (const n of c) {
          const nb = seg.filter((e) => (fwd ? e.to === n.id : e.from === n.id)).map((e) => byId[fwd ? e.from : e.to].o);
          n.bc = nb.length ? nb.reduce((a, b) => a + b, 0) / nb.length : n.o;
        }
        c.sort((a, b) => a.bc - b.bc || a.i - b.i);
        c.forEach((n, i) => (n.o = i));
      }
    }
    const gapCross = 30;
    // gap after each column = room for the widest label on edges leaving it (min 84 / 64)
    const gaps = cols.map((c, l) => {
      const labels = edges.filter((e) => byId[e.from].layer === l && byId[e.to].layer > l).map((e) => (LR ? textW(e.label, 6.6) + 44 : 34));
      return Math.max(def.gap || (LR ? 84 : 64), ...labels);
    });
    const colMain = cols.map((c) => Math.max(0, ...c.map((n) => (LR ? n.w : n.h))));
    const colCross = cols.map((c) => c.reduce((s, n) => s + (LR ? n.h : n.w), 0) + gapCross * Math.max(0, c.length - 1));
    const cross = Math.max(...colCross);
    let main = 0;
    cols.forEach((c, l) => {
      let at = (cross - colCross[l]) / 2;
      c.forEach((n) => {
        if (LR) { n.x = main + (colMain[l] - n.w) / 2; n.y = at; at += n.h + gapCross; }
        else { n.y = main; n.x = at; at += n.w + gapCross; }
      });
      main += colMain[l] + (l < L - 1 ? gaps[l] : 0);
    });
    // ports: spread edge endpoints over a node's side when it has several edges on that side (no hairballs)
    const fwdE = edges.filter((e) => byId[e.to].layer > byId[e.from].layer);
    for (const n of nodes) {
      const first = (e) => byId[e._via ? e._via[0] : e.to].o, last = (e) => byId[e._via ? e._via[e._via.length - 1] : e.from].o;
      const outs = fwdE.filter((e) => e.from === n.id).sort((a, b) => first(a) - first(b));
      const ins = fwdE.filter((e) => e.to === n.id).sort((a, b) => last(a) - last(b));
      const span = (k, size) => (i) => (k < 2 ? 0 : (i - (k - 1) / 2) * Math.min(12, (size * 0.7) / (k - 1)));
      const so = span(outs.length, LR ? n.h : n.w), si = span(ins.length, LR ? n.h : n.w);
      outs.forEach((e, i) => (e._p0 = so(i)));
      ins.forEach((e, i) => (e._p1 = si(i)));
      outs.forEach((e) => (e._fan = outs.length)); ins.forEach((e) => (e._fanIn = ins.length));
    }
    const hasBack = back.size > 0 || edges.some((e) => byId[e.to].layer <= byId[e.from].layer);
    const width = (LR ? main : cross) + 40, height = (LR ? cross : main) + 30 + (hasBack ? 70 : 0);
    return { nodes: nodes.filter((n) => !n.dummy), all: nodes, byId, edges, LR, width, height };
  }

  const bez = (p0, c1, c2, p1, t) => {
    const u = 1 - t;
    return { x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x, y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y };
  };
  function edgeGeom(L, e) {
    const a = L.byId[e.from], b = L.byId[e.to];
    const back = b.layer <= a.layer;
    let p0, p1, c1, c2;
    if (L.LR) {
      if (back) { // route below everything so loops never cut through rows
        const floor = Math.max(...L.nodes.map((n) => n.y + n.h)) + 46;
        p0 = { x: a.x + a.w / 2, y: a.y + a.h }; p1 = { x: b.x + b.w / 2, y: b.y + b.h };
        c1 = { x: p0.x, y: floor }; c2 = { x: p1.x, y: floor };
      } else { p0 = { x: a.x + a.w, y: a.y + a.h / 2 + (e._p0 || 0) }; p1 = { x: b.x, y: b.y + b.h / 2 + (e._p1 || 0) }; if (e._via) return chain(L, e, p0, p1); const d = (p1.x - p0.x) / 2; c1 = { x: p0.x + d, y: p0.y }; c2 = { x: p1.x - d, y: p1.y }; }
    } else {
      if (back) { const wall = Math.max(...L.nodes.map((n) => n.x + n.w)) + 50; p0 = { x: a.x + a.w, y: a.y + a.h / 2 }; p1 = { x: b.x + b.w, y: b.y + b.h / 2 }; c1 = { x: wall, y: p0.y }; c2 = { x: wall, y: p1.y }; }
      else { p0 = { x: a.x + a.w / 2 + (e._p0 || 0), y: a.y + a.h }; p1 = { x: b.x + b.w / 2 + (e._p1 || 0), y: b.y }; if (e._via) return chain(L, e, p0, p1); const d = (p1.y - p0.y) / 2; c1 = { x: p0.x, y: p0.y + d }; c2 = { x: p1.x, y: p1.y - d }; }
    }
    return { d: `M${p0.x},${p0.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p1.x},${p1.y}`, at: (t) => bez(p0, c1, c2, p1, t), back };
  }

  // smooth path through an edge's waypoints: one cubic per hop, tangents along the main axis
  function chain(L, e, p0, p1) {
    const pts = [p0, ...e._via.map((id) => { const d = L.byId[id]; return { x: d.x + d.w / 2, y: d.y + d.h / 2 }; }), p1];
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1];
      const c1 = L.LR ? { x: (A.x + B.x) / 2, y: A.y } : { x: A.x, y: (A.y + B.y) / 2 };
      const c2 = L.LR ? { x: (A.x + B.x) / 2, y: B.y } : { x: B.x, y: (A.y + B.y) / 2 };
      segs.push([A, c1, c2, B]);
    }
    const d = `M${p0.x},${p0.y} ` + segs.map(([, c1, c2, B]) => `C${c1.x},${c1.y} ${c2.x},${c2.y} ${B.x},${B.y}`).join(" ");
    const at = (t) => { const k = Math.min(segs.length - 1, Math.floor(t * segs.length)), u = t * segs.length - k; return bez(...segs[k], u); };
    return { d, at, back: false };
  }

  function shape(n) {
    const c = color(n.kind), x = n.x, y = n.y, w = n.w, h = n.h;
    if (n.kind === "store") {
      const r = STORE_R;
      return `<path class="body" style="stroke:${c}" d="M${x},${y + r} a${w / 2},${r} 0 0 0 ${w},0 a${w / 2},${r} 0 0 0 ${-w},0 v${h - 2 * r} a${w / 2},${r} 0 0 0 ${w},0 v${-(h - 2 * r)}"/>`;
    }
    const rx = n.kind === "actor" ? h / 2 : n.kind === "source" || n.kind === "sink" ? 18 : 9;
    const dash = n.kind === "external" ? 'stroke-dasharray="5 4"' : "";
    let extra = "";
    if (n.kind === "queue") extra = `<path d="M${x + w - 12},${y + 4} v${h - 8} M${x + w - 18},${y + 4} v${h - 8}" style="stroke:${c};stroke-width:1.4"/>`;
    if (n.kind === "service") extra = `<rect x="${x}" y="${y}" width="5" height="${h}" rx="2" style="fill:${c};stroke:none"/>`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ${dash} style="stroke:${c}"/>${extra}`;
  }
  const clip = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));

  /* ---------------- geometry: ELK when loaded (vendor/elk.bundled.js), built-in layered layout otherwise ----------------
   * Both produce { nodes:[{...def, x,y,w,h, compound}], edges:[{...def, d, at(t), lbl:{x,y}}], width, height } in absolute coords. */
  const nodeSize = (n) => ({ w: Math.min(320, Math.max(96, textW(n.label, 7.9) + 34, textW(n.sub, 6.4) + 30) + (n.kind === "queue" ? 26 : 0)), h: (n.sub ? 54 : 40) + (n.kind === "store" ? STORE_R + 3 : 0) });
  function basicGeo(def) {
    if (def.nodes.some((n) => n.parent)) throw new Error(`graph ${def.id}: nested nodes (parent:) need ELK — load kit/vendor/elk.bundled.js`);
    const L = layout(def);
    const edges = L.edges.map((e) => {
      const G = edgeGeom(L, e), lt = e.labelAt ?? (e._fan > 2 ? 0.74 : e._fanIn > 2 ? 0.28 : 0.5), m = G.at(lt);
      return { ...e, d: G.d, at: G.at, lbl: e.label ? { x: m.x, y: m.y } : null };
    });
    return { nodes: L.nodes.map((n) => ({ ...n, compound: false })), edges, width: L.width, height: L.height, byId: L.byId };
  }
  // polyline with rounded corners + arc-length parametrisation for tokens
  function polyline(pts, r = 8) {
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const d1 = Math.hypot(b.x - a.x, b.y - a.y), d2 = Math.hypot(c.x - b.x, c.y - b.y), k = Math.min(r, d1 / 2, d2 / 2);
      const p1 = { x: b.x - ((b.x - a.x) / d1) * k, y: b.y - ((b.y - a.y) / d1) * k }, p2 = { x: b.x + ((c.x - b.x) / d2) * k, y: b.y + ((c.y - b.y) / d2) * k };
      d += ` L${p1.x},${p1.y} Q${b.x},${b.y} ${p2.x},${p2.y}`;
    }
    d += ` L${pts[pts.length - 1].x},${pts[pts.length - 1].y}`;
    const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y)), total = segs.reduce((a, b) => a + b, 0) || 1;
    const at = (t) => { let left = t * total; for (let i = 0; i < segs.length; i++) { if (left <= segs[i] || i === segs.length - 1) { const u = segs[i] ? Math.min(1, left / segs[i]) : 0; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * u, y: pts[i].y + (pts[i + 1].y - pts[i].y) * u }; } left -= segs[i]; } return pts[pts.length - 1]; };
    return { d, at };
  }
  let elk;
  async function elkGeo(def) {
    elk ||= new window.ELK();
    const LR = def.direction !== "TB";
    const kids = {};
    def.nodes.forEach((n) => (kids[n.parent || "__root"] ||= []).push(n));
    const mk = (n) => kids[n.id]
      ? { id: n.id, layoutOptions: { "elk.padding": "[top=44,left=20,bottom=20,right=20]" }, children: kids[n.id].map(mk) }
      : { id: n.id, width: nodeSize(n).w, height: nodeSize(n).h, ...(n.rank != null ? { layoutOptions: { "elk.partitioning.partition": String(n.rank) } } : {}) };
    const graph = {
      id: "__root",
      layoutOptions: {
        "elk.algorithm": "layered", "elk.direction": LR ? "RIGHT" : "DOWN", "elk.edgeRouting": "ORTHOGONAL",
        "elk.hierarchyHandling": "INCLUDE_CHILDREN", "elk.layered.spacing.nodeNodeBetweenLayers": String(def.gap || 64),
        "elk.spacing.nodeNode": "30", "elk.spacing.edgeNode": "20", "elk.spacing.edgeEdge": "14", "elk.spacing.edgeLabel": "6",
        "elk.layered.spacing.edgeNodeBetweenLayers": "20", "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES", "elk.layered.edgeLabels.sideSelection": "SMART_UP",
        ...(def.nodes.some((n) => n.rank != null) ? { "elk.partitioning.activate": "true" } : {}), ...(def.elk || {}),
      },
      children: (kids.__root || []).map(mk),
      edges: def.edges.map((e, i) => ({ id: `e${i}`, sources: [e.from], targets: [e.to], labels: e.label ? [{ text: e.label, width: textW(e.label, 6.4) + 12, height: 17 }] : [] })),
    };
    const out = await elk.layout(graph);
    const abs = { __root: { x: 0, y: 0 } }, nodes = [], byDef = Object.fromEntries(def.nodes.map((n) => [n.id, n]));
    const walk = (n, ox, oy, depth) => {
      for (const c of n.children || []) {
        const x = ox + c.x, y = oy + c.y;
        abs[c.id] = { x, y };
        nodes.push({ ...byDef[c.id], x, y, w: c.width, h: c.height, compound: !!(c.children && c.children.length), depth });
        walk(c, x, y, depth + 1);
      }
    };
    walk(out, 0, 0, 0);
    const edges = [];
    const collect = (n) => {
      for (const e of n.edges || []) {
        const o = abs[e.container || n.id] || { x: 0, y: 0 }, sec = e.sections && e.sections[0];
        if (!sec) continue;
        const pts = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint].map((p) => ({ x: p.x + o.x, y: p.y + o.y }));
        const P2 = polyline(pts), lab = e.labels && e.labels[0];
        const src = def.edges[+e.id.slice(1)];
        edges.push({ ...src, d: P2.d, at: P2.at, lbl: lab && lab.x != null ? { x: lab.x + o.x + lab.width / 2, y: lab.y + o.y + lab.height / 2 } : null });
      }
      for (const c of n.children || []) collect(c);
    };
    collect(out);
    nodes.sort((a, b) => a.depth - b.depth); // containers first, so children draw on top
    return { nodes, edges, width: out.width + 40, height: out.height + 30, byId: Object.fromEntries(nodes.map((n) => [n.id, n])) };
  }

  let uid = 0;
  /* ---------------- render: validates synchronously, lays out (async with ELK), draws ---------------- */
  function render(el, g, opts = {}) {
    const def = get(g);
    if (!def) throw new Error(`Graph.render: unknown graph ${g}`);
    const ids = new Set(def.nodes.map((n) => n.id)), keys = new Set(def.edges.map((e) => `${e.from}>${e.to}`));
    const need = (pair, what) => { if (pair && !keys.has(pair.join(">"))) throw new Error(`Graph.render(${def.id}): ${what} ${pair.join("→")} is not an edge`); };
    need(opts.hop, "hop");
    (opts.tokens || []).forEach((t) => need([t.from, t.to], "token"));
    (opts.focus || []).forEach((id) => { if (!ids.has(id)) throw new Error(`Graph.render(${def.id}): focus "${id}" is not a node`); });
    if (opts.overlay && !(def.overlays || {})[opts.overlay]) throw new Error(`Graph.render(${def.id}): unknown overlay "${opts.overlay}"`);
    let geo = null, resolve;
    const ready = new Promise((r) => (resolve = r));
    const api = { ready, pulse: (...a) => ready.then(() => api._pulse(...a)) };
    const go = (G) => { geo = G; draw(el, def, geo, opts, api); resolve(api); return api; };
    if (window.ELK && def.layout !== "basic") {
      el.innerHTML = `<div style="height:${Math.min(600, 60 + def.nodes.length * 26)}px"></div>`;
      P.async(elkGeo(def).then(go), `graph ${def.id}`);
    } else go(basicGeo(def));
    return api;
  }

  function draw(el, def, geo, opts, api) {
    const ov = opts.overlay ? def.overlays[opts.overlay] : null;
    const focus = new Set(opts.focus || []);
    const hop = opts.hop ? opts.hop.join(">") : null;
    if (opts.hop) opts.hop.forEach((id) => focus.add(id));
    const dimming = focus.size > 0;
    const id = `gx${++uid}`, pad = 20, top = 24;
    let s = `<svg class="gx-svg" xmlns="${NS}" viewBox="${-pad} ${-top} ${geo.width + pad} ${geo.height + top}" width="${geo.width + pad}">`;
    s += `<defs><marker id="${id}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:#bdb9b2"/></marker>
      <marker id="${id}-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--pk-accent)"/></marker></defs>`;
    // overlay boundaries (trust zones, teams, deploy units): dashed hulls around member nodes
    for (const b of (ov && ov.boundaries) || []) {
      const ms = b.nodes.map((n) => geo.byId[n]).filter(Boolean);
      if (!ms.length) continue;
      const x0 = Math.min(...ms.map((n) => n.x)) - 14, y0 = Math.min(...ms.map((n) => n.y)) - 28, x1 = Math.max(...ms.map((n) => n.x + n.w)) + 14, y1 = Math.max(...ms.map((n) => n.y + n.h)) + 14;
      s += `<g class="gx-bound"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="14" style="stroke:${b.color || "var(--pk-bad)"}"/><text x="${x0 + 12}" y="${y0 + 17}" style="fill:${b.color || "var(--pk-bad)"}">${esc(b.label)}</text></g>`;
    }
    // containers (nested nodes) under everything else
    for (const n of geo.nodes.filter((n) => n.compound)) {
      const dim = dimming && !focus.has(n.id) && !n_hasFocusedChild(n, geo, focus);
      s += `<g class="gx-group ${dim ? "gx-dim" : ""}" data-node="${esc(n.id)}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="14" style="stroke:${color(n.kind)}"/>
        <text x="${n.x + 14}" y="${n.y + 22}" class="lbl">${esc(n.label)}</text>${n.sub ? `<text x="${n.x + 14}" y="${n.y + 36}" class="sub">${esc(n.sub)}</text>` : ""}</g>`;
    }
    let labels = "";
    const edgeOv = (e) => (ov && ov.edges && ov.edges[`${e.from}>${e.to}`]) || null;
    for (const e of geo.edges) {
      const k = `${e.from}>${e.to}`, eo = edgeOv(e);
      const on = hop === k || (opts.edges || []).some((x) => x.join(">") === k);
      const dim = (dimming && !on && !(focus.has(e.from) && focus.has(e.to))) || (ov && ov.dimOthers && !eo);
      const style = eo ? `style="${eo.color ? `stroke:${eo.color};` : ""}${eo.width ? `stroke-width:${eo.width};` : ""}"` : "";
      s += `<g class="gx-edge ${e.kind || ""} ${on ? "on" : ""} ${dim ? "gx-dim" : ""}"><path d="${e.d}" ${style} marker-end="url(#${id}-${on ? "on" : "a"})"/></g>`;
      const text = eo && eo.label != null ? eo.label : e.label;
      if (text && e.lbl) { const tw = textW(text, 6.4) + 10; labels += `<g class="gx-edge ${on ? "on" : ""} ${dim ? "gx-dim" : ""} ${eo && eo.label != null ? "ov" : ""}"><rect class="lblbg" x="${e.lbl.x - tw / 2}" y="${e.lbl.y - 9}" width="${tw}" height="17" rx="4"/><text x="${e.lbl.x}" y="${e.lbl.y + 4}" text-anchor="middle">${esc(text)}</text></g>`; }
    }
    s += labels;
    for (const n of geo.nodes.filter((n) => !n.compound)) {
      const no = (ov && ov.nodes && ov.nodes[n.id]) || null;
      const on = focus.has(n.id), dim = (dimming && !on) || (ov && ov.dimOthers && !no);
      const off = n.kind === "store" ? STORE_R + 3 : 0, maxc = Math.floor((n.w - 24) / 7.9);
      const drill = n.drill && opts.drillLinks ? ` data-pk-hash="#/zoom-${esc(n.drill)}" style="cursor:pointer"` : "";
      s += `<g class="gx-node ${on ? "on" : ""} ${dim ? "gx-dim" : ""} ${drill ? "drill" : ""}" data-node="${esc(n.id)}"${drill}>${shape(n)}
        ${no && no.tint ? `<rect x="${n.x + 2}" y="${n.y + 2}" width="${n.w - 4}" height="${n.h - 4}" rx="8" style="fill:${no.tint};stroke:none;opacity:.55"/>` : ""}
        <text class="lbl" x="${n.x + n.w / 2 - (n.kind === "queue" ? 12 : 0)}" y="${n.y + off + (n.sub ? 22 : (n.h - off) / 2 + 4.5)}" text-anchor="middle">${esc(clip(n.label, maxc))}</text>
        ${n.sub ? `<text class="sub" x="${n.x + n.w / 2}" y="${n.y + off + 39}" text-anchor="middle">${esc(clip(no && no.sub != null ? no.sub : n.sub, Math.floor((n.w - 20) / 6.4)))}</text>` : ""}
        ${n.drill ? `<text class="drillmark" x="${n.x + n.w - 14}" y="${n.y + n.h - 7}" text-anchor="middle">⊕</text>` : ""}</g>`;
      const b = (no && no.badge) || (opts.badges || {})[n.id];
      if (b) { const bw = textW(b, 6.3) + 14; s += `<g class="gx-badge"><rect x="${n.x + n.w - bw}" y="${n.y - 21}" width="${bw}" height="18" rx="9" ${no && no.badgeColor ? `style="fill:${no.badgeColor}"` : ""}/><text x="${n.x + n.w - bw / 2}" y="${n.y - 8}" text-anchor="middle">${esc(b)}</text></g>`; }
    }
    s += `<g class="gx-tokens"></g></svg>`;
    el.innerHTML = s;
    const svg = el.querySelector("svg"), layer = svg.querySelector(".gx-tokens");
    const geoOf = (from, to) => geo.edges.find((e) => e.from === from && e.to === to);
    const token = (from, to, t, label) => {
      const E = geoOf(from, to); if (!E) return null;
      const p = E.at(t), g = document.createElementNS(NS, "g"); g.setAttribute("class", "gx-token");
      g.innerHTML = `<circle cx="${p.x}" cy="${p.y}" r="7"/>${label ? `<text x="${p.x + 11}" y="${p.y - 10}">${esc(label)}</text>` : ""}`;
      layer.appendChild(g); return { g, E };
    };
    // static tokens sit at 82% — beside the arrowhead, clear of the mid-edge label
    (opts.tokens || []).forEach((t) => token(t.from, t.to, t.at ?? 0.82, t.label));
    api.svg = svg; api.geo = geo;
    api._pulse = (from, to, { label = "", ms = 900 } = {}) => {
      const tk = token(from, to, P.CAPTURE ? 0.82 : 0, label);
      if (!tk || P.CAPTURE) return Promise.resolve();
      return new Promise((res) => {
        const t0 = performance.now();
        const f = (now) => {
          const r = Math.min(1, (now - t0) / ms), e = r < .5 ? 2 * r * r : 1 - (-2 * r + 2) ** 2 / 2, p = tk.E.at(e * 0.82);
          tk.g.querySelector("circle").setAttribute("cx", p.x); tk.g.querySelector("circle").setAttribute("cy", p.y);
          const tx = tk.g.querySelector("text"); if (tx) { tx.setAttribute("x", p.x + 11); tx.setAttribute("y", p.y - 10); }
          if (r < 1 && svg.isConnected) requestAnimationFrame(f); else res();
        };
        requestAnimationFrame(f);
      });
    };
    if (opts.hop && opts.animate !== false) api._pulse(opts.hop[0], opts.hop[1], { label: opts.hopLabel || "" });
  }
  const n_hasFocusedChild = (n, geo, focus) => geo.nodes.some((c) => c.parent === n.id && (focus.has(c.id) || (c.compound && n_hasFocusedChild(c, geo, focus))));

  /* ---------------- sequence diagram ---------------- */
  function sequence(el, g, opts = {}) {
    const def = get(g);
    const colW = def.colW || 170, rowH = 44, top = 56;
    const actors = def.actors, xi = Object.fromEntries(actors.map((a, i) => [a.id, 20 + i * colW + colW / 2]));
    const H = top + def.messages.length * rowH + 30, W = actors.length * colW + 40;
    const upTo = opts.upTo ?? def.messages.length;
    const sid = `sq${++uid}`;
    let s = `<svg class="gx-svg gx-seq" xmlns="${NS}" viewBox="0 0 ${W} ${H}" width="${W}">
      <defs><marker id="${sid}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:#8d8983"/></marker>
      <marker id="${sid}-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--pk-accent)"/></marker></defs>`;
    actors.forEach((a) => {
      const x = xi[a.id], w = Math.min(colW - 16, textW(a.label, 7.4) + 26);
      s += `<line class="life" x1="${x}" y1="${top - 10}" x2="${x}" y2="${H - 10}"/>
        <g class="gx-node"><rect x="${x - w / 2}" y="6" width="${w}" height="34" rx="${a.kind === "actor" ? 17 : 8}" style="stroke:${color(a.kind || "service")}"/><text class="lbl" x="${x}" y="27" text-anchor="middle">${esc(a.label)}</text></g>`;
    });
    def.messages.forEach((m, i) => {
      const y = top + i * rowH + 22, x1 = xi[m.from], x2 = xi[m.to], n = i + 1;
      const on = n === upTo && opts.highlight !== false, later = n > upTo;
      const d = x1 === x2 ? `M${x1},${y - 8} h44 v16 h-40` : `M${x1},${y} L${x2 + (x2 > x1 ? -2 : 2)},${y}`;
      const tx = x1 === x2 ? x1 + 50 : (x1 + x2) / 2;
      s += `<g class="msg ${m.kind || "sync"} ${on ? "on" : ""} ${later ? "later" : ""}"><path d="${d}" marker-end="url(#${sid}-${on ? "on" : "a"})"/>
        <text x="${tx}" y="${y - 7}" text-anchor="${x1 === x2 ? "start" : "middle"}">${esc(m.label)}</text><text class="n" x="${Math.min(x1, x2) - 14}" y="${y + 4}" text-anchor="end">${n}</text></g>`;
    });
    el.innerHTML = s + "</svg>";
    return { svg: el.querySelector("svg") };
  }

  /* ---------------- ready-made scenario view over a registered graph ---------------- */
  // step fields used by stepView may be functions of ctx (e.g. focus: (ctx) => [...], rows: (ctx) => ctx.model.fact)
  const FIELDS = ["focus", "hop", "hopLabel", "tokens", "badges", "payload", "payloadTitle", "hl", "rows", "rowsTitle", "entity", "msg"];
  const resolve = (ctx) => { const st = { ...(ctx.step || {}) }; for (const f of FIELDS) if (typeof st[f] === "function") st[f] = st[f](ctx); return st; };
  function stepView(graphId, o = {}) {
    return {
      render(ctx) {
        const st = resolve(ctx);
        const side = [
          st.payload !== undefined ? `<div><h3>${esc(st.payloadTitle || "Payload on this hop")}</h3>${Kit.json(st.payload, { hl: st.hl })}</div>` : "",
          st.rows ? `<div><h3>${esc(st.rowsTitle || "Rows")}</h3>${Kit.table(st.rows, { mark: st.mark })}</div>` : "",
          st.entity ? `<div><h3>Shape</h3>${Kit.schema(st.entity)}</div>` : "",
          o.side ? `<div style="grid-column:1/-1">${o.side(ctx)}</div>` : "",
        ].join("");
        return `${o.above ? o.above(ctx) : ""}<div class="gx-wrap"><div class="gx-host"></div>${side ? `<div class="gx-side">${side}</div>` : ""}</div>${o.below ? o.below(ctx) : ""}`;
      },
      after(ctx) {
        const st = resolve(ctx);
        const def = get(graphId);
        if (def.type === "sequence") return sequence(ctx.el.querySelector(".gx-host"), graphId, { upTo: st.msg ?? ctx.n });
        render(ctx.el.querySelector(".gx-host"), graphId, { focus: st.focus, hop: st.hop, hopLabel: st.hopLabel, tokens: st.tokens,
          badges: { ...(o.badges ? o.badges(ctx) : {}), ...(st.badges || {}) } });
      },
    };
  }

  window.Graph = { render, sequence, stepView, layout };
})();
