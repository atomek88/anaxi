/* proto-kit · charts — data visuals over vendored libraries. THROWAWAY.
 * Needs (copied by new.sh --with): vega + vega-lite + vega-embed for Vega-Lite charts; d3 (+ d3-sankey) for sankey/tree/treemap.
 *
 *   P.chart("load", { title, spec: {Vega-Lite spec, no data needed} })    // registered → harvested as JSON spec
 *   Chart.render(el, "load", { data: rows })                               // async; capture waits for it
 *   Chart.timeline(el, items, opts) · Chart.matrix(el, rows, opts)          // Vega-Lite shortcuts: lanes over time, many-to-many heatmap
 *   Chart.sankey(el, { nodes, links }) · Chart.tree(el, root) · Chart.treemap(el, root)   // d3, synchronous
 *   Chart.view("load", (ctx) => rows)                                       // { render, after } for a P.scenario
 * Register the data shape you show with P.chart(id, { type, data }) so harvest keeps it, not only the picture.
 */
(function () {
  const P = window.P, esc = P.esc;
  document.head.insertAdjacentHTML("beforeend", `<style>
    .cx-host { min-height: 40px; } .cx-host.vega-embed { display: block; width: 100%; }  /* vega-embed defaults to inline-block → container width 0 */ .cx-host svg { max-width: 100%; height: auto; display: block; }
    html.pk-capture .cx-host svg { max-width: none; }
    .cx-sankey .node rect { stroke: #fff; } .cx-sankey text, .cx-tree text, .cx-treemap text { font: 12px -apple-system, system-ui, sans-serif; fill: #1c1b19; }
    .cx-tree path { fill: none; stroke: #c9c5be; stroke-width: 1.4; } .cx-tree circle { stroke-width: 2; fill: #fff; }
    .cx-treemap rect { stroke: #fff; stroke-width: 2; }
  </style>`);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const palette = () => ["--pk-k-transform", "--pk-accent", "--pk-k-source", "--pk-k-store", "--pk-k-sink", "--pk-k-queue", "--pk-k-external", "--pk-bad"].map(css);

  // one look for every Vega-Lite chart: system font, kit colours, quiet axes
  const vlConfig = () => ({
    font: "-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif",
    background: null, view: { stroke: null },
    axis: { labelColor: css("--pk-ink-2"), titleColor: css("--pk-ink-2"), domainColor: css("--pk-line"), gridColor: "#efedea", tickColor: css("--pk-line"), labelFontSize: 11.5, titleFontSize: 12, titleFontWeight: 600 },
    legend: { labelColor: css("--pk-ink-2"), titleColor: css("--pk-ink-2"), labelFontSize: 11.5 },
    title: { color: css("--pk-ink"), fontSize: 14, anchor: "start" },
    range: { category: palette() }, mark: { color: css("--pk-accent") },
  });

  function vega(el, spec, where) {
    if (!window.vegaEmbed) throw new Error(`${where}: Vega-Lite not loaded — scaffold with new.sh --with vega`);
    el.classList.add("cx-host");
    return P.async(window.vegaEmbed(el, { $schema: "https://vega.github.io/schema/vega-lite/v5.json", config: vlConfig(), ...spec }, { actions: false, renderer: "svg" }), where);
  }

  /** Render a registered Vega-Lite chart. opts.data → rows (overrides spec.data); opts.spec → shallow overrides. */
  function render(el, id, opts = {}) {
    const def = P.charts[id];
    if (!def) throw new Error(`Chart.render: unknown chart ${id}`);
    if (def.type === "sankey") return sankey(el, opts.data || def.data, opts);
    if (def.type === "tree") return tree(el, opts.data || def.data, opts);
    if (def.type === "treemap") return treemap(el, opts.data || def.data, opts);
    const spec = { ...(def.title ? { title: def.title } : {}), ...def.spec, ...(opts.spec || {}) };
    if (opts.data) spec.data = { values: opts.data };
    if (!spec.width) spec.width = opts.width || "container";
    return vega(el, spec, `chart ${id}`);
  }

  /** Lanes over time. items: [{ lane, start, end, label?, kind? }] (numbers or ISO dates).
   *  opts: { lanes:[order], events:[{ lane, at, label?, kind? }] (point markers), bands:[{ start, end, label?, color? }] (full-height shading),
   *          now, title, width, height, xTitle, legend } */
  function timeline(el, items, opts = {}) {
    const sample = items[0] || (opts.events || [])[0] || {};
    const time = typeof (sample.start ?? sample.at) === "string" ? "temporal" : "quantitative";
    const lanes = opts.lanes || [...new Set([...items, ...(opts.events || [])].map((d) => d.lane))];
    const y = { field: "lane", type: "nominal", title: null, sort: lanes, scale: { domain: lanes } };
    const layers = [];
    if (opts.bands && opts.bands.length) layers.push({ data: { values: opts.bands }, mark: { type: "rect", opacity: 0.16 }, encoding: { x: { field: "start", type: time }, x2: { field: "end" }, color: { value: css("--pk-ink-3") }, ...(opts.bands.some((b) => b.color) ? { fill: { field: "color", type: "nominal", scale: null } } : {}), tooltip: { field: "label" } } });
    if (items.length) layers.push(
      { data: { values: items }, mark: { type: "bar", cornerRadius: 4, height: { band: 0.62 } }, encoding: { x: { field: "start", type: time, title: opts.xTitle || null }, x2: { field: "end" }, y, color: { field: "kind", type: "nominal", legend: opts.legend === false ? null : { orient: "bottom", title: null } } } },
      { data: { values: items }, mark: { type: "text", align: "left", baseline: "middle", dx: 3, dy: -14, fontSize: 10.5, color: css("--pk-ink-2") }, encoding: { x: { field: "start", type: time }, y, text: { field: "label" } } });
    if (opts.events && opts.events.length) layers.push(
      { data: { values: opts.events }, mark: { type: "point", filled: true, size: 90, opacity: 1 }, encoding: { x: { field: "at", type: time, title: opts.xTitle || null }, y, shape: { field: "kind", type: "nominal", legend: opts.legend === false ? null : { orient: "bottom", title: null } }, color: { field: "kind", type: "nominal", legend: null } } },
      { data: { values: opts.events.filter((e) => e.label) }, mark: { type: "text", dy: -12, fontSize: 10, color: css("--pk-ink-2") }, encoding: { x: { field: "at", type: time }, y, text: { field: "label" } } });
    if (opts.now != null) layers.push({ data: { values: [{ now: opts.now }] }, mark: { type: "rule", color: css("--pk-ink"), strokeWidth: 2 }, encoding: { x: { field: "now", type: time } } });
    return vega(el, { title: opts.title, width: opts.width || "container", height: opts.height || { step: 34 }, layer: layers, resolve: { scale: { color: "independent" } } }, "timeline");
  }

  /** Many-to-many heatmap. rows: [{ x, y, value }]; opts: { x, y, value (field names), title, scheme } */
  function matrix(el, rows, opts = {}) {
    const x = opts.x || "x", y = opts.y || "y", v = opts.value || "value";
    return vega(el, {
      title: opts.title, data: { values: rows }, width: opts.width || { step: 34 }, height: opts.height || { step: 28 },
      layer: [
        { mark: { type: "rect", cornerRadius: 3 }, encoding: { x: { field: x, type: "nominal", title: null, axis: { orient: "top", labelAngle: -35 }, sort: null }, y: { field: y, type: "nominal", title: null, sort: null }, color: { field: v, type: typeof rows[0]?.[v] === "number" ? "quantitative" : "nominal", scale: { scheme: opts.scheme || "oranges" }, legend: null } } },
        { mark: { type: "text", fontSize: 11 }, encoding: { x: { field: x, type: "nominal", sort: null }, y: { field: y, type: "nominal", sort: null }, text: { field: v } } },
      ],
    }, "matrix");
  }

  const needD3 = (what) => { if (!window.d3) throw new Error(`${what}: d3 not loaded — scaffold with new.sh --with d3`); };
  /** Volume through a flow. data: { nodes:[{id,label?}], links:[{source,target,value}] } */
  function sankey(el, data, opts = {}) {
    needD3("sankey");
    if (!window.d3.sankey) throw new Error("sankey: d3-sankey not loaded — scaffold with new.sh --with d3");
    const W = opts.width || 900, H = opts.height || 420;
    const g = window.d3.sankey().nodeId((d) => d.id).nodeWidth(14).nodePadding(16).extent([[1, 8], [W - 140, H - 8]])({ nodes: data.nodes.map((d) => ({ ...d })), links: data.links.map((d) => ({ ...d })) });
    const col = palette();
    const svg = window.d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("class", "cx-sankey");
    svg.append("g").attr("fill", "none").selectAll("path").data(g.links).join("path").attr("d", window.d3.sankeyLinkHorizontal())
      .attr("stroke", (d, i) => col[d.source.index % col.length]).attr("stroke-opacity", 0.35).attr("stroke-width", (d) => Math.max(1, d.width));
    const node = svg.append("g").attr("class", "node").selectAll("g").data(g.nodes).join("g");
    node.append("rect").attr("x", (d) => d.x0).attr("y", (d) => d.y0).attr("height", (d) => Math.max(1, d.y1 - d.y0)).attr("width", (d) => d.x1 - d.x0).attr("fill", (d) => col[d.index % col.length]);
    node.append("text").attr("x", (d) => d.x1 + 6).attr("y", (d) => (d.y0 + d.y1) / 2).attr("dy", "0.35em").text((d) => `${d.label || d.id} · ${d.value}`);
    el.classList.add("cx-host"); el.replaceChildren(svg.node());
  }
  /** Hierarchy as a tidy tree. root: { name, children:[...] } */
  function tree(el, root, opts = {}) {
    needD3("tree");
    const h = window.d3.hierarchy(root), dx = 26, dy = opts.dy || 180;
    window.d3.tree().nodeSize([dx, dy])(h);
    let x0 = Infinity, x1 = -Infinity; h.each((d) => { x0 = Math.min(x0, d.x); x1 = Math.max(x1, d.x); });
    const W = (h.height + 1) * dy + 160, H = x1 - x0 + dx * 2;
    const svg = window.d3.create("svg").attr("viewBox", `${-20} ${x0 - dx} ${W} ${H}`).attr("width", W).attr("class", "cx-tree");
    svg.append("g").selectAll("path").data(h.links()).join("path").attr("d", window.d3.linkHorizontal().x((d) => d.y).y((d) => d.x));
    const n = svg.append("g").selectAll("g").data(h.descendants()).join("g").attr("transform", (d) => `translate(${d.y},${d.x})`);
    n.append("circle").attr("r", 4.5).attr("stroke", (d) => (d.data.focus ? css("--pk-accent") : css("--pk-k-transform")));
    n.append("text").attr("dy", "0.32em").attr("x", (d) => (d.children ? -9 : 9)).attr("text-anchor", (d) => (d.children ? "end" : "start")).text((d) => d.data.name);
    el.classList.add("cx-host"); el.replaceChildren(svg.node());
  }
  /** Hierarchy by size. root: { name, children:[...], value on leaves } */
  function treemap(el, root, opts = {}) {
    needD3("treemap");
    const W = opts.width || 900, H = opts.height || 460, col = palette();
    const h = window.d3.hierarchy(root).sum((d) => d.value || 0).sort((a, b) => b.value - a.value);
    window.d3.treemap().size([W, H]).paddingInner(2).paddingTop(18).round(true)(h);
    const svg = window.d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("class", "cx-treemap");
    const g = svg.selectAll("g").data(h.descendants()).join("g").attr("transform", (d) => `translate(${d.x0},${d.y0})`);
    g.append("rect").attr("width", (d) => d.x1 - d.x0).attr("height", (d) => d.y1 - d.y0).attr("fill", (d) => (d.depth === 0 ? "#f4f2ef" : col[(d.ancestors().reverse()[1]?.data.name.length || 0) % col.length])).attr("fill-opacity", (d) => (d.children ? 0.18 : 0.75));
    g.append("text").attr("x", 5).attr("y", 13).text((d) => ((d.x1 - d.x0) > 60 ? `${d.data.name}${d.children ? "" : ` · ${d.value}`}` : ""));
    el.classList.add("cx-host"); el.replaceChildren(svg.node());
  }

  /** { render, after } for a scenario: the chart with per-step data. data(ctx) → rows. o.above/o.below(ctx) wrap it. */
  function view(id, data, o = {}) {
    return {
      render: (ctx) => `${o.above ? o.above(ctx) : ""}<div class="cx-view"></div>${o.below ? o.below(ctx) : ""}`,
      after: (ctx) => render(ctx.el.querySelector(".cx-view"), id, { data: data ? data(ctx) : undefined }),
    };
  }

  window.Chart = { render, timeline, matrix, sankey, tree, treemap, view, vega };
})();
