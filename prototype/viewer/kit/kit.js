/* proto-kit core — copied into each prototype. THROWAWAY.
 *
 * The contract every prototype keeps (prototype-harvest depends on it):
 *   1. Every view is URL-addressable:  #/<state>  ·  #/<a>/<b> (screens stack)  ·  #/s/<scenario>/<step>  ·  ?variant=
 *   2. Everything worth keeping is declared through this API so it lands in the manifest:
 *        P.state · P.scenario · P.graph · P.chart · P.code · P.zoom · P.entity · P.route · P.edge · P.param/P.preset
 *        · P.decision · P.question
 *   3. ?capture=1  → review chrome hidden, animations off (deterministic screenshots)
 *      ?dump=manifest → body becomes the manifest JSON (render errors included)
 *
 * Plain script (no modules) so the page opens from file:// by double-click.
 */
(function () {
  const qs = new URLSearchParams(location.search);
  const CAPTURE = qs.has("capture");
  const DUMP = qs.get("dump");
  if (CAPTURE) document.documentElement.classList.add("pk-capture");

  const qid = (t) => { let h = 2166136261; for (const c of String(t)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return "q" + (h >>> 0).toString(36); };
  // the data a step shows (hop, payload, rows…) is evidence too — keep the JSON-safe parts in the manifest
  const STEP_FIELDS = ["hop", "focus", "payload", "payloadTitle", "rows", "rowsTitle", "entity", "badges", "msg", "line", "lines", "vars", "stack", "out", "anaxi"];
  const stepData = (st) => { const o = {}; for (const f of STEP_FIELDS) if (st[f] !== undefined && typeof st[f] !== "function") o[f] = st[f]; try { return JSON.parse(JSON.stringify(o)); } catch { return {}; } };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const $ = (s, el = document) => el.querySelector(s);

  /* ------------------------------------------------------------------ */
  const P = {
    CAPTURE, DUMP, esc,
    cfg: {}, model: {}, states: {}, order: [], scenarios: {}, scenarioOrder: [], graphs: {},
    entities: {}, routes: [], edges: [], decisions: [], questions: [], errors: [], actions: {},
    charts: {}, codes: {}, zooms: {}, paramDefs: {}, presets: {}, params: {}, _pending: [], _memo: new Map(),
    view: null, _log: [], _inspect: null, _anim: null,

    /** cfg: { title, question, lens, frame?, variants?: {A:'name'}, home?, capture?: {width,height}, model?: ()=>({}) } */
    init(cfg) {
      this.cfg = Object.assign({ lens: "concept", capture: { width: 1180, height: 560 } }, cfg);
      const vs = this.cfg.variants ? Object.keys(this.cfg.variants) : [];
      this.variant = vs.includes(qs.get("variant")) ? qs.get("variant") : vs[0] || null;
      this.model = cfg.model ? cfg.model() : {};
      for (const [k, v] of qs) if (k.startsWith("p.")) this.params[k.slice(2)] = isNaN(+v) || v === "" ? v : +v;
      document.documentElement.style.setProperty("--pk-canvas-max", `${this.cfg.capture.width - 80}px`);
      return this;
    },
    /** A view state. def: { title, group?, kind?, stub?, notes?, variants?:bool, render(ctx)=>html, after?(ctx) } */
    /** Re-declaring an id replaces it in place (e.g. a stub from shape.js fleshed out by the page). */
    state(id, def) { if (!this.states[id]) this.order.push(id); this.states[id] = { id, group: "Screens", kind: "screen", ...def }; return this; },
    /** A fixture: the same screen as `of`, rendered with a tweaked model — makes model-only views URL-addressable
     *  (e.g. "home with quiet today on", "Tomorrow tab"). def: { title, model:(m)=>m', ...overrides }. */
    fixture(id, of, def) {
      const base = this.states[of];
      if (!base) throw new Error(`P.fixture: unknown base state ${of}`);
      const { model, ...rest } = def;
      return this.state(id, { ...base, group: base.group, ...rest, of, fixture: model });
    },
    /** The model a state renders with: fixtures get a tweaked deep copy. */
    modelFor(st) { return st && st.fixture ? st.fixture(structuredClone(this.model)) : this.model; },
    /** A step-through. def: { title, desc, group?, init()=>model, steps:[{label, note?, apply?(m)=>m, ...any}], render(ctx), after?(ctx) } */
    scenario(id, def) { this.scenarios[id] = { id, group: "Scenarios", ...def }; this.scenarioOrder.push(id); return this; },
    /** A diagram. def: { title, direction?:'LR'|'TB', nodes:[{id,label,kind?,sub?,group?}], edges:[{from,to,label?,kind?}] } — harvested as mermaid. */
    graph(id, def) { this.graphs[id] = { id, direction: "LR", ...def }; return this; },
    /** A data shape. def: { desc?, fields:[[name,type,note?,key?]] | [{name,type,note,key}], example? } */
    entity(name, def) {
      const fields = (def.fields || []).map((f) => (Array.isArray(f) ? { name: f[0], type: f[1], note: f[2] || "", key: f[3] || "" } : f));
      this.entities[name] = { name, ...def, fields }; return this;
    },
    /** An endpoint / command / event. def: { method, path, summary, req?, res?, errors?:[], notes? } */
    route(def) { this.routes.push(def); return this; },
    edge(from, to, label = "", mode = "link") { this.edges.push({ from, to, label, mode }); return this; },
    /** opts.level: the Anaxi level the answer belongs to ("D2"…) — optional, carried into the evidence pack */
    decision(text, status = "made", opts = {}) { this.decisions.push({ text, status, level: opts.level || null, answers: opts.answers || null }); return this; },
    /** opts: { level: "D3", id, refines } — id is stable across pages (defaults to a text hash) so a later page can answer it;
     *  refines: the id of an earlier question this one sharpens (the digest shows only the sharper one) */
    question(text, opts = {}) { this.questions.push({ text, level: opts.level || null, id: opts.id || qid(text), refines: opts.refines || null }); return this; },
    /** Answer an open question (from this page or one inherited via shape.js): records a decision and closes the question. */
    answer(id, text, opts = {}) {
      const q = this.questions.find((x) => x.id === id);
      if (q) q.answered = true;
      return this.decision(text, opts.status || "made", { level: opts.level || (q && q.level) || null, answers: id });
    },
    /** In-place interaction: <button data-act="name:arg">. fn(model, arg) mutates model; page re-renders. */
    action(name, fn) { this.actions[name] = fn; return this; },
    log(msg) { this._log.unshift(msg); this._log = this._log.slice(0, 10); const el = $("#pk-log"); if (el) el.innerHTML = this._log.map((l) => `<div>${esc(l)}</div>`).join(""); },
    /** Put extra detail into the panel's Inspector (not captured — essential info belongs on the canvas). */
    inspect(html, title = "Inspector") { this._inspect = { html, title }; },

    /* ---------------- simulation inputs: parameters live in the URL (?p.rate=4) so every run is addressable ---------------- */
    /** def: { label, min, max, step, value (default), unit } — read with P.params[name] */
    param(name, def) {
      this.paramDefs[name] = { name, step: 1, ...def };
      if (!(name in this.params)) this.params[name] = def.value;
      return this;
    },
    /** A named parameter set — captured for every state/scenario marked presets:true. values: { name: value } */
    preset(id, values, label = id) { this.presets[id] = { id, label, values }; return this; },
    setParams(values) { Object.assign(this.params, values); this._memo.clear(); },
    /** Run a scenario to its last step (or step n) under the given params; returns the model. For checks, sweeps, Monte Carlo. */
    runScenario(id, params = this.params, n) {
      const saved = { ...this.params };
      this.setParams(params);
      try { return this.scenarioCtx(id, n ?? this.scenarios[id].steps.length).model; } finally { this.setParams(saved); }
    },
    paramDefaults() { return Object.fromEntries(Object.values(this.paramDefs).map((d) => [d.name, d.value])); },
    /** A sanity check on the model: fn(params) → true | false | { ok, detail }. Shown with Kit.checks(), harvested,
     *  and a failing check fails capture.mjs --check (a surprising result is the insight or a bug — find out which). */
    check(name, fn) { (this._checks ||= []).push({ name, fn }); return this; },
    runChecks(params = this.params) {
      return (this._checks || []).map(({ name, fn }) => {
        try { const r = fn(params); return typeof r === "object" && r ? { name, ok: !!r.ok, detail: r.detail || "" } : { name, ok: !!r, detail: "" }; }
        catch (e) { return { name, ok: false, detail: String(e.message || e) }; }
      });
    },
    paramKey() { return JSON.stringify(Object.keys(this.params).sort().map((k) => [k, this.params[k]])); },
    /** Track an async render (ELK layout, Vega chart) so capture/crawl wait for it. */
    async(promise, where = "async render") { const p = Promise.resolve(promise).catch((e) => this.fail(where, e)); this._pending.push(p); return p; },
    async idle() { while (this._pending.length) { const ps = this._pending.splice(0); await Promise.all(ps); } },

    /* ---------------- registries harvested as data ---------------- */
    /** A chart. def: { title, type:"vega-lite"|"sankey"|"tree"|"treemap", spec (Vega-Lite) | data } */
    chart(id, def) { this.charts[id] = { id, type: "vega-lite", ...def }; return this; },
    /** The exploration's outcome, handed to a prototype via shape.json (capture.mjs writes it; new.sh --from reads it).
     *  def: { approach, rejected:[{approach, why}], graphs:[ids], entities:[names], routes:true|[paths], states:[{id,title,group,kind,notes,items}] } */
    shape(def) { this._shape = def; return this; },
    /** Source for the code-trace view. def: { title, lang, file, source } */
    code(id, def) { this.codes[id] = { id, lang: "javascript", ...def }; return this; },
    /** Zoom level: a canvas state per graph (+ one per overlay) with breadcrumbs. Nodes with drill:"<graph>" open the deeper level.
     *  opts: { title, lede, parent:"<graph id>", group } */
    zoom(graphId, opts = {}) {
      const g = this.graphs[graphId];
      if (!g) throw new Error(`P.zoom: unknown graph ${graphId}`);
      this.zooms[graphId] = { graph: graphId, parent: opts.parent || null, title: opts.title || g.title || graphId };
      const overlays = Object.keys(g.overlays || {});
      for (const ov of [null, ...overlays]) {
        const id = ov ? `zoom-${graphId}~${ov}` : `zoom-${graphId}`;
        this.state(id, {
          title: `${this.zooms[graphId].title}${ov ? ` · ${g.overlays[ov].label || ov}` : ""}`, group: opts.group || "Zoom levels", kind: "zoom",
          zoom: graphId, overlay: ov,
          render: (ctx) => {
            const crumbs = []; for (let z = this.zooms[graphId]; z; z = this.zooms[z.parent]) crumbs.unshift(z);
            return `<div class="pk-crumbs-bar">${crumbs.map((z, i) => i === crumbs.length - 1 ? `<b>${esc(z.title)}</b>` : `<button data-pk-hash="#/zoom-${z.graph}">${esc(z.title)}</button> ›`).join(" ")}</div>
              <h1>${esc(this.zooms[graphId].title)}${ov ? ` <span class="pk-ov-tag">${esc(g.overlays[ov].label || ov)}</span>` : ""}</h1>
              ${opts.lede || g.lede ? `<p class="pk-lede">${esc(opts.lede || g.lede)}</p>` : ""}
              ${overlays.length ? `<div class="pk-tabs">${[null, ...overlays].map((o) => `<button class="${o === ov ? "on" : ""}" data-pk-hash="#/zoom-${graphId}${o ? "~" + o : ""}">${esc(o ? g.overlays[o].label || o : "Structure")}</button>`).join("")}</div>` : ""}
              ${ov && g.overlays[ov].legend ? `<p class="pk-lede" style="font-size:13px">${esc(g.overlays[ov].legend)}</p>` : ""}
              <div class="pk-zoom-host"></div>`;
          },
          after: (ctx) => window.Graph.render(ctx.el.querySelector(".pk-zoom-host"), graphId, { overlay: ov, drillLinks: true }),
        });
      }
      return this;
    },

    /* ---------------- routing ---------------- */
    parse(hash = location.hash) {
      const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
      if (parts[0] === "s" && this.scenarios[parts[1]]) {
        const sc = this.scenarios[parts[1]];
        return { type: "scenario", id: parts[1], n: Math.min(Math.max(+parts[2] || 0, 0), sc.steps.length) };
      }
      const path = parts.filter((p) => this.states[p]);
      if (!path.length) path.push(this.startId());
      return { type: "state", path, id: path[path.length - 1] };
    },
    startId() { return this.cfg.start && this.states[this.cfg.start] ? this.cfg.start : this.order[0]; },
    go(hash, anim = null) { this._anim = anim; if (location.hash === hash) this.render(); else location.hash = hash; },
    url(extra = {}) {
      const p = new URLSearchParams(location.search);
      if (this.variant) p.set("variant", this.variant);
      for (const [k, v] of Object.entries(this.params)) if (this.paramDefs[k] && v !== this.paramDefs[k].value) p.set(`p.${k}`, v); else p.delete(`p.${k}`);
      for (const [k, v] of Object.entries(extra)) p.set(k, v);
      return `?${p}`;
    },

    /* ---------------- scenario model: step n = fold of steps[0..n) — pure, so every step is addressable ---------------- */
    scenarioCtx(id, n) {
      const sc = this.scenarios[id], params = this.params;
      // memoized fold: long simulations replay from the nearest cached step, never from zero
      const key = (k) => `${id}|${k}|${this.paramKey()}`;
      let start = 0, model = null, prev = null;
      for (let k = n; k >= 0; k--) { const hit = this._memo.get(key(k)); if (hit) { start = k; model = hit.model; prev = hit.prev; break; } }
      if (!model) { model = sc.init ? sc.init(params) : {}; if (model && typeof model === "object" && model.__seed == null) model.__seed = (params.seed ?? this.cfg.seed ?? 1) >>> 0; prev = model; this._memo.set(key(0), { model, prev }); }
      for (let i = start; i < n; i++) {
        prev = model;
        model = sc.steps[i].apply ? sc.steps[i].apply(structuredClone(model), params, i) : model;
        this._memo.set(key(i + 1), { model, prev });
      }
      return { P: this, scenario: sc, n, step: n ? sc.steps[n - 1] : null, model, prev, params, total: sc.steps.length, esc, Kit };
    },

    /* ---------------- render ---------------- */
    render() {
      const route = this.parse();
      this._inspect = null;
      const stage = $("#pk-stage");
      try {
        if (route.type === "scenario") this.renderScenario(stage, route);
        else (this.view || CanvasView).render(this, stage, route);
      } catch (e) { this.fail(`render ${location.hash}`, e); stage.innerHTML = `<div class="pk-canvas"><div class="pk-errors">${esc(e.stack || e)}</div></div>`; }
      this._anim = null;
      this.renderPanel(route);
      const sw = $("#pk-sw-label");
      if (sw && this.variant) sw.innerHTML = `${esc(this.cfg.variantLabel || "VARIANT")} ${this.variant} · ${esc(this.cfg.variants[this.variant])}<small>← → to switch</small>`;
    },
    renderScenario(stage, route) {
      const ctx = this.scenarioCtx(route.id, route.n);
      const sc = ctx.scenario;
      stage.className = "pk-stage wide";
      stage.innerHTML = `<div class="pk-canvas">
        <div class="pk-tabs pk-nocap">${this.scenarioOrder.map((s) => `<button class="${s === sc.id ? "on" : ""}" data-pk-hash="#/s/${s}/0">${esc(this.scenarios[s].title)}</button>`).join("")}</div>
        <h1>${esc(sc.title)}</h1>
        <p class="pk-lede">${ctx.step ? `<b>Step ${ctx.n}/${ctx.total} · ${esc(ctx.step.label)}.</b> ${esc(ctx.step.note || "")}` : esc(sc.desc || "Start state — press Next.")}</p>
        <div id="pk-scn">${sc.render(ctx)}</div>
        <div class="pk-player pk-nocap">${this.playerButtons(route, ctx)}</div>
      </div>`;
      ctx.el = $("#pk-scn");
      sc.after && sc.after(ctx);
    },
    playerButtons(route, ctx) {
      const h = (n) => `#/s/${route.id}/${n}`;
      return `<button data-pk-hash="${h(0)}" ${ctx.n ? "" : "disabled"}>⟲ Reset</button>
        <button data-pk-hash="${h(ctx.n - 1)}" ${ctx.n ? "" : "disabled"}>‹ Back</button>
        <button class="primary" data-pk-hash="${h(ctx.n + 1)}" ${ctx.n < ctx.total ? "" : "disabled"}>Next ›</button>
        <button data-pk-play ${ctx.n < ctx.total ? "" : "disabled"}>${this._playing ? "❚❚ Pause" : "▶ Play"}</button>`;
    },

    /* ---------------- panel ---------------- */
    renderPanel(route) {
      const p = $("#pk-panel");
      if (!p || CAPTURE) return;
      const view = this.view || CanvasView;
      const inbound = this.inbound();
      let now, extra = "";
      if (route.type === "scenario") {
        const ctx = this.scenarioCtx(route.id, route.n);
        now = `<div style="font-size:16px;font-weight:700">${esc(ctx.scenario.title)}</div><div class="pk-crumbs">step ${route.n} / ${ctx.total} · ${esc(location.hash)}</div>`;
        extra = `<h2>Steps</h2><div class="pk-box">
          ${ctx.total > 40
            ? `<input type="range" class="pk-scrub" min="0" max="${ctx.total}" value="${route.n}" data-pk-scrub="${route.id}" style="width:100%"><div style="font-size:12px;color:var(--pk-ink-3)">${ctx.total} steps — drag to scrub · ← → step</div>`
            : `<ol class="pk-steps">${ctx.scenario.steps.map((s, i) => `<li class="${i < route.n - 1 ? "done" : i === route.n - 1 ? "cur" : ""}" data-pk-hash="#/s/${route.id}/${i + 1}">${esc(s.label)}</li>`).join("")}</ol>`}
          <div class="pk-player">${this.playerButtons(route, ctx)}</div></div>`;
      } else {
        const st = this.states[route.id];
        now = `<div style="font-size:16px;font-weight:700">${esc(st.title)}${st.stub ? '<span class="pk-tag">STUB</span>' : ""}</div>
          <div style="font-size:12px;color:var(--pk-ink-3)">${esc(st.group)} · ${esc(st.kind)}${this.variant && st.variants ? ` · variant <b>${this.variant}</b>` : ""}</div>
          ${st.notes ? `<div style="margin-top:6px;font-size:13px;color:var(--pk-ink-2)">${esc(st.notes)}</div>` : ""}
          <div class="pk-crumbs">${esc(route.path.join(" › "))}</div>`;
        extra = view.panel ? view.panel(this, route) : "";
      }
      const groups = {};
      for (const id of this.order) (groups[this.states[id].group] ||= []).push(["state", id]);
      for (const id of this.scenarioOrder) (groups[this.scenarios[id].group] ||= []).push(["scenario", id]);
      const cur = route.type === "scenario" ? `s:${route.id}` : route.id;
      const errs = this.errors.length ? `<h2>Errors (${this.errors.length})</h2><div class="pk-errors">${this.errors.map((e) => esc(`${e.where}: ${e.message}`)).join("\n")}</div>` : "";
      p.innerHTML = `
        <h1>${esc(this.cfg.title)}</h1>
        <div style="font-size:12px;color:var(--pk-ink-3)">lens: ${esc(this.cfg.lens)} · ${this.order.length} states · ${this.scenarioOrder.length} scenarios · throwaway prototype</div>
        ${this.cfg.question ? `<div class="pk-q"><b>Question:</b> ${esc(this.cfg.question)}</div>` : ""}
        ${errs}
        ${Object.keys(this.paramDefs).length ? `<h2>Parameters</h2><div class="pk-box pk-params">${Object.values(this.paramDefs).map((d) => `
          <label><span>${esc(d.label || d.name)}</span><b>${esc(this.params[d.name])}${esc(d.unit || "")}</b>
          <input type="range" min="${d.min}" max="${d.max}" step="${d.step}" value="${esc(this.params[d.name])}" data-pk-param="${esc(d.name)}"></label>`).join("")}
          ${Object.keys(this.presets).length ? `<div class="pk-tabs" style="margin:8px 0 0">${Object.values(this.presets).map((pr) => `<button data-pk-preset="${esc(pr.id)}" class="${Object.entries(pr.values).every(([k, v]) => String(this.params[k]) === String(v)) ? "on" : ""}">${esc(pr.label)}</button>`).join("")}</div>` : ""}</div>` : ""}
        <h2>Now on</h2><div class="pk-box">${now}</div>
        ${extra}
        ${this._inspect ? `<h2>${esc(this._inspect.title)}</h2><div class="pk-box">${this._inspect.html}</div>` : ""}
        <h2>Interaction log</h2><div class="pk-box pk-log" id="pk-log">${this._log.map((l) => `<div>${esc(l)}</div>`).join("")}</div>
        <h2>Map — reached from</h2>
        <div class="pk-map">${Object.entries(groups).map(([g, items]) => `<div class="g"><div>${esc(g)}</div>${items.map(([t, id]) => {
          if (t === "scenario") return `<button class="${cur === `s:${id}` ? "cur" : ""}" data-pk-hash="#/s/${id}/0">▶ ${esc(this.scenarios[id].title)}<span class="from">${this.scenarios[id].steps.length} steps</span></button>`;
          const s = this.states[id];
          const from = [...(inbound[id] || [])].join(", ") || (id === this.startId() ? "start" : "— unreachable");
          return `<button class="${cur === id ? "cur" : ""}" data-pk-hash="${view.hashFor ? view.hashFor(this, id) : `#/${id}`}">${esc(s.title)}${s.stub ? '<span class="pk-tag">STUB</span>' : ""}<span class="from">${esc(from)}</span></button>`;
        }).join("")}</div>`).join("")}</div>
        ${this.decisions.length || this.questions.length ? `<h2>Decisions & open questions</h2><div class="pk-box"><ul class="pk-list">
          ${this.decisions.map((d) => `<li class="${d.status === "made" ? "made" : "open"}">${d.status === "made" ? "" : "<b>assumed:</b> "}${esc(d.text)}</li>`).join("")}
          ${this.questions.map((q) => `<li class="open">${esc(q.text)}</li>`).join("")}</ul></div>` : ""}
        <h2>Harvest</h2><div class="pk-box" style="font-size:12.5px;color:var(--pk-ink-2)">
          <button data-pk-download style="color:var(--pk-accent);font-weight:600">⇩ Download manifest.json</button><br>
          Every view is a URL. <code>?capture=1</code> hides this panel · <code>?dump=manifest</code> prints the manifest.</div>
        <div style="height:70px"></div>`;
    },

    /* ---------------- manifest ---------------- */
    inbound() {
      const inbound = {};
      const add = (to, from) => (inbound[to] ||= new Set()).add(from);
      for (const id of this.order) for (const e of this.exitsOf(id, true)) if (e.to) add(e.to, id);
      for (const e of this.edges) add(e.to, e.from);
      return inbound;
    },
    exitsOf(id, allVariants = false) {
      const v = this.view || CanvasView;
      if (!v.exits) return [];
      const st = this.states[id];
      if (!allVariants || !st.variants || !this.cfg.variants) return v.exits(this, id);
      // variant screens: union of every variant's exits, each tagged with the variants it appears in
      const saved = this.variant, seen = new Map();
      for (const k of Object.keys(this.cfg.variants)) {
        this.variant = k;
        for (const e of v.exits(this, id)) {
          const key = `${e.to}|${e.mode}|${e.label}`;
          if (seen.has(key)) seen.get(key).variants.push(k); else seen.set(key, { ...e, variants: [k] });
        }
      }
      this.variant = saved;
      return [...seen.values()];
    },
    captures() {
      const view = this.view || CanvasView;
      const size = view.captureSize ? view.captureSize(this) : this.cfg.capture;
      const out = [];
      const vs = this.cfg.variants ? Object.keys(this.cfg.variants) : [null];
      // presets:true on a state/scenario → captured once per preset (default params otherwise)
      const presetsFor = (def) => (def.presets && Object.keys(this.presets).length ? Object.values(this.presets) : [null]);
      const defaults = Object.fromEntries(Object.values(this.paramDefs).map((d) => [d.name, d.value]));
      const pp = (pr) => (pr ? { ...defaults, ...pr.values } : (Object.keys(defaults).length ? defaults : null));
      for (const id of this.order) {
        const st = this.states[id];
        for (const v of st.variants ? vs : [this.variant]) for (const pr of presetsFor(st)) {
          out.push({ id: `${id}${v && st.variants ? `--${v}` : ""}${pr ? `@${pr.id}` : ""}`, kind: "state", state: id,
            title: st.title + (v && st.variants ? ` (${v})` : "") + (pr ? ` · ${pr.label}` : ""), group: st.group,
            hash: view.hashFor ? view.hashFor(this, id) : `#/${id}`, variant: v, params: pp(pr), preset: pr ? pr.id : null, ...size });
        }
      }
      for (const sid of this.scenarioOrder) {
        const sc = this.scenarios[sid];
        // long simulations: capture only the keyframes listed in sc.keyframes (default: every step up to 40, else 6 evenly spaced)
        const all = [...Array(sc.steps.length + 1).keys()];
        const frames = sc.keyframes || (all.length <= 41 ? all : [...new Set([0, ...[1, 2, 3, 4].map((k) => Math.round((sc.steps.length * k) / 5)), sc.steps.length])]);
        for (const pr of presetsFor(sc)) for (const n of frames) out.push({ id: `${sid}--${String(n).padStart(sc.steps.length > 99 ? 3 : 2, "0")}${pr ? `@${pr.id}` : ""}`, kind: "step", scenario: sid, step: n,
          title: `${sc.title} · ${n ? `${n}. ${sc.steps[n - 1].label}` : "start"}${pr ? ` · ${pr.label}` : ""}`, group: sc.group, hash: `#/s/${sid}/${n}`,
          variant: this.variant, params: pp(pr), preset: pr ? pr.id : null, ...(sc.capture || this.cfg.capture) });
      }
      return out;
    },
    manifest() {
      const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === "function" ? undefined : v)));
      return {
        schema: "proto-manifest/1", title: this.cfg.title, question: this.cfg.question || "", lens: this.cfg.lens, frame: this.cfg.frame || null,
        variants: this.cfg.variants || null,
        states: this.order.map((id) => { const s = this.states[id]; return { id, title: s.title, group: s.group, kind: s.kind, of: s.of || null, anaxi: s.anaxi || null, zoom: s.zoom || null, overlay: s.overlay || null, stub: !!s.stub, notes: s.notes || "", variants: !!s.variants, exits: this.exitsOf(id, true) }; }),
        scenarios: this.scenarioOrder.map((id) => { const s = this.scenarios[id]; return { id, title: s.title, desc: s.desc || "", group: s.group, anaxi: s.anaxi || null, presets: !!s.presets, steps: s.steps.map((st, i) => ({ n: i + 1, label: st.label, note: st.note || "", ...stepData(st) })) }; }),
        anaxi: this.cfg.anaxi || null,
        shape: this._shape ? strip({
          schema: "proto-shape/1", question: this.cfg.question || "", anaxi: this.cfg.anaxi || null, ...this._shape,
          graphs: Object.fromEntries((this._shape.graphs || []).map((id) => [id, this.graphs[id]])),
          entities: Object.fromEntries((this._shape.entities || []).map((n) => [n, this.entities[n]])),
          routes: this._shape.routes === true ? this.routes : this.routes.filter((r) => (this._shape.routes || []).includes(r.path)),
          decisions: this.decisions, questions: this.questions,
        }) : null,
        graphs: strip(this.graphs), charts: strip(this.charts), codes: strip(this.codes), zooms: this.zooms,
        params: strip(this.paramDefs), presets: this.presets,
        checks: [null, ...Object.keys(this.presets)].flatMap((pid) => {
          if (!(this._checks || []).length) return [];
          const ps = pid ? { ...this.paramDefaults(), ...this.presets[pid].values } : { ...this.paramDefaults(), ...this.params };
          return this.runChecks(ps).map((r) => ({ ...r, preset: pid }));
        }),
        entities: strip(this.entities), routes: strip(this.routes), edges: this.edges,
        decisions: this.decisions, questions: this.questions, captures: this.captures(), errors: this.errors,
      };
    },
    /** Render every capture target off-screen so the manifest reports broken views. */
    selfTest() {
      const box = document.createElement("div");
      box.style.cssText = "position:absolute;left:-99999px;top:0;width:1200px";
      box.id = "pk-stage";
      const real = $("#pk-stage"); if (real) real.id = "pk-stage-real";
      document.body.appendChild(box);
      const savedVariant = this.variant;
      for (const c of this.captures()) {
        try {
          if (c.variant) this.variant = c.variant;
          if (c.params) this.setParams(c.params);
          if (c.kind === "step") this.renderScenario(box, { id: c.scenario, n: c.step });
          else (this.view || CanvasView).render(this, box, this.parse(c.hash));
        } catch (e) { this.fail(`capture ${c.id}`, e); }
      }
      this.variant = savedVariant;
      box.remove(); if (real) real.id = "pk-stage";
    },
    fail(where, e) { this.errors.push({ where, message: String(e && e.message || e) }); console.error(where, e); },

    /* ---------------- boot ---------------- */
    start() {
      window.addEventListener("error", (e) => this.fail("window", e.error || e.message));
      if (DUMP) {
        const saved = { ...this.params };
        this.selfTest();
        this.idle().then(() => {
          this.setParams(saved);
          document.body.innerHTML = `<pre id="pk-manifest">${esc(JSON.stringify(this.manifest(), null, 1))}</pre>`;
        });
        return;
      }
      document.body.insertAdjacentHTML("afterbegin", `<div class="pk-root"><div class="pk-stage" id="pk-stage"></div><aside class="pk-panel" id="pk-panel"></aside></div>
        ${this.cfg.variants && !CAPTURE ? `<div class="pk-switcher"><button data-pk-cycle="-1" aria-label="previous">←</button><div class="lbl" id="pk-sw-label"></div><button data-pk-cycle="1" aria-label="next">→</button></div>` : ""}`);
      window.addEventListener("hashchange", () => this.render());
      document.addEventListener("click", (e) => this.onClick(e));
      document.addEventListener("keydown", (e) => this.onKey(e));
      document.addEventListener("input", (e) => {
        const t = e.target;
        if (t.dataset.pkParam) { this.setParams({ [t.dataset.pkParam]: +t.value }); history.replaceState(null, "", this.url() + location.hash); this.render(); }
        if (t.dataset.pkScrub) { this.stopPlay(); this.go(`#/s/${t.dataset.pkScrub}/${t.value}`); }
      });
      this.render();
      // capture.mjs asks for the rendered height so tall canvases aren't cropped
      if (qs.has("measure")) { document.body.setAttribute("data-pk-h", Math.ceil(document.documentElement.scrollHeight)); document.body.setAttribute("data-pk-w", Math.ceil(document.documentElement.scrollWidth)); }
    },
    onClick(e) {
      const t = e.target.closest("[data-pk-hash],[data-pk-cycle],[data-pk-play],[data-pk-download],[data-pk-preset],[data-act]");
      if (!t) return (this.view && this.view.onClick) ? this.view.onClick(this, e) : null;
      if (t.dataset.pkHash !== undefined) { if (t.disabled) return; this.stopPlay(); return this.go(t.dataset.pkHash); }
      if (t.dataset.pkCycle) return this.cycle(+t.dataset.pkCycle);
      if (t.hasAttribute("data-pk-play")) return this._playing ? this.stopPlay() : this.play();
      if (t.hasAttribute("data-pk-download")) return this.download();
      if (t.dataset.pkPreset) { this.setParams({ ...this.paramDefaults(), ...this.presets[t.dataset.pkPreset].values }); history.replaceState(null, "", this.url() + location.hash); this.log(`preset → ${t.dataset.pkPreset}`); return this.render(); }
      if (t.dataset.act) {
        const [name, ...rest] = t.dataset.act.split(":");
        const fn = this.actions[name];
        if (!fn) return this.fail("action", `no action "${name}"`);
        fn(this.model, rest.join(":"));
        this.log(`act · ${t.dataset.act}`);
        const sc = document.scrollingElement.scrollTop, inner = $("#pk-stage [data-pk-scroll]")?.scrollTop;
        this.render();
        document.scrollingElement.scrollTop = sc;
        const el = $("#pk-stage [data-pk-scroll]"); if (el && inner != null) el.scrollTop = inner;
      }
    },
    onKey(e) {
      if (e.target.closest("input, textarea, select, [contenteditable]")) return;
      const r = this.parse();
      const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      if (r.type === "scenario") { const n = r.n + dir, max = this.scenarios[r.id].steps.length; if (n >= 0 && n <= max) this.go(`#/s/${r.id}/${n}`); }
      else if (this.cfg.variants) this.cycle(dir);
    },
    cycle(dir) {
      const vs = Object.keys(this.cfg.variants);
      this.variant = vs[(vs.indexOf(this.variant) + dir + vs.length) % vs.length];
      history.replaceState(null, "", this.url() + location.hash);
      this.log(`variant → ${this.variant}`);
      this.render();
    },
    play() {
      this._playing = true;
      const tick = () => {
        const r = this.parse();
        if (!this._playing || r.type !== "scenario" || r.n >= this.scenarios[r.id].steps.length) return this.stopPlay();
        this.go(`#/s/${r.id}/${r.n + 1}`);
        this._timer = setTimeout(tick, this.cfg.playMs || 1700);
      };
      tick();
    },
    stopPlay() { this._playing = false; clearTimeout(this._timer); },
    download() {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(this.manifest(), null, 2)], { type: "application/json" }));
      a.download = "manifest.json"; a.click();
    },
  };

  /* Default view: each state renders into a wide canvas card. */
  const CanvasView = {
    render(P, stage, route) {
      const st = P.states[route.id];
      const ctx = { P, state: st, model: P.modelFor(st), variant: P.variant, esc, Kit, route };
      stage.className = "pk-stage wide";
      stage.innerHTML = `<div class="pk-canvas">${st.render(ctx)}</div>`;
      ctx.el = stage.firstElementChild;
      st.after && st.after(ctx);
    },
    exits(P, id) {
      // canvas states link with data-pk-hash="#/<id>" — extract them like screens extracts data-go
      const st = P.states[id], tmp = document.createElement("div");
      try { tmp.innerHTML = st.render({ P, state: st, model: P.modelFor(st), variant: P.variant, esc, Kit, route: { path: [id], id } }); } catch { return []; }
      return [...tmp.querySelectorAll("[data-pk-hash]")].map((el) => ({ to: (el.dataset.pkHash.match(/^#\/([^/]+)/) || [])[1] || "", mode: "link", label: el.dataset.label || el.textContent.trim().replace(/\s+/g, " ").slice(0, 40) }))
        .filter((e) => P.states[e.to]);
    },
  };

  /* ------------------------------------------------------------------ */
  /* Inspector / canvas helpers                                          */
  const Kit = {
    esc,
    /** Pretty JSON. opts.hl: array of keys to highlight (e.g. fields that changed). */
    json(obj, opts = {}) {
      const hl = new Set(opts.hl || []);
      const s = esc(JSON.stringify(obj, null, 2));
      return `<pre class="pk-json">${s
        .replace(/(&quot;)([^&]*?)(&quot;)(\s*:)/g, (m, a, k, c, d) => `<span class="k${hl.has(k) ? " hl" : ""}">"${k}"</span>${d}`)
        .replace(/: (&quot;.*?&quot;)/g, ': <span class="s">$1</span>')
        .replace(/: (-?\d+\.?\d*)/g, ': <span class="n">$1</span>')
        .replace(/: (true|false|null)/g, ': <span class="b">$1</span>')}</pre>`;
    },
    /** rows: array of objects. opts.cols, opts.mark(row, i) => "new" | "gone" | "changed" | "bad" | "warn" | "hl" | "", opts.cells(row, i) => [changed col names] */
    table(rows, opts = {}) {
      if (!rows.length) return `<div style="color:var(--pk-ink-3);font-size:13px">— no rows —</div>`;
      const cols = opts.cols || Object.keys(rows[0]);
      return `<table class="pk-table"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) =>
        `<tr class="${opts.mark ? opts.mark(r, i) : ""}">${cols.map((c) => `<td class="${opts.cells && (opts.cells(r, i) || []).includes(c) ? "chg" : ""}">${esc(r[c] && typeof r[c] === "object" ? JSON.stringify(r[c]) : r[c] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    },
    /** Before/after diff of two row sets by key: inserted rows "new", deleted "gone", updated "changed" with changed cells highlighted. */
    diff(before, after, { key, cols } = {}) {
      const k = (r) => (Array.isArray(key) ? key.map((x) => r[x]).join("|") : r[key]);
      const prev = new Map((before || []).map((r) => [k(r), r]));
      const next = new Map((after || []).map((r) => [k(r), r]));
      const rows = [], marks = [], cells = [];
      for (const r of after || []) {
        const p = prev.get(k(r));
        const ch = p ? Object.keys(r).filter((c) => JSON.stringify(r[c]) !== JSON.stringify(p[c])) : [];
        rows.push(r); marks.push(!p ? "new" : ch.length ? "changed" : ""); cells.push(ch);
      }
      for (const r of before || []) if (!next.has(k(r))) { rows.push(r); marks.push("gone"); cells.push([]); }
      return Kit.table(rows, { cols, mark: (r, i) => marks[i], cells: (r, i) => cells[i] });
    },
    /** A schema card for a registered entity (by name) or an inline def. */
    schema(nameOrDef) {
      const e = typeof nameOrDef === "string" ? window.P.entities[nameOrDef] : nameOrDef;
      if (!e) return `<div class="pk-errors">unknown entity ${esc(nameOrDef)}</div>`;
      return `<div class="pk-schema"><header>${esc(e.name)}<small>${esc(e.desc || "")}</small></header>${e.fields.map((f) =>
        `<div class="f"><span class="key">${f.key === "pk" ? "🔑" : f.key === "fk" ? "↗" : f.key === "idx" ? "#" : ""}</span><span>${esc(f.name)}</span><span class="ty">${esc(f.type)}</span>${f.note ? `<span class="note">${esc(f.note)}</span>` : ""}</div>`).join("")}</div>`;
    },
    schemas(names) { return `<div class="pk-schemas">${(names || Object.keys(window.P.entities)).map((n) => Kit.schema(n)).join("")}</div>`; },
    /** Route table for registered routes (or a given list). */
    /** opts.full (default true): also show req → res and errors — the data crossing the boundary. */
    routes(list, opts = {}) {
      const full = opts.full !== false;
      return `<div class="pk-routes">${(list || window.P.routes).map((r) => `<div class="r"><span class="pk-method ${esc(r.method)}">${esc(r.method)}</span><div><code>${esc(r.path)}</code><div class="d">${esc(r.summary || "")}</div>${
        full && (r.req || r.res) ? `<div class="io">${r.req ? `<span>in</span> <code>${esc(r.req)}</code>` : ""}${r.req && r.res ? " → " : ""}${r.res ? `<span>out</span> <code>${esc(r.res)}</code>` : ""}</div>` : ""}${
        full && r.errors && r.errors.length ? `<div class="io err">${r.errors.map((e) => `<code>${esc(e)}</code>`).join(" · ")}</div>` : ""}</div></div>`).join("")}</div>`;
    },
    /** Render the model's sanity checks (P.check) as a ✓/✗ list for the current parameters. */
    checks(title = "Sanity checks") {
      const rs = window.P.runChecks();
      if (!rs.length) return "";
      return `<div class="pk-checks"><h3>${esc(title)} · ${rs.filter((r) => r.ok).length}/${rs.length}</h3>${rs.map((r) => `<div class="${r.ok ? "ok" : "bad"}">${r.ok ? "✓" : "✗"} ${esc(r.name)}${r.detail ? ` <small>${esc(r.detail)}</small>` : ""}</div>`).join("")}</div>`;
    },
    /** Seeded random in [0,1) whose state lives in the model (m.__seed) — deterministic and safe to structuredClone. */
    rand(m) { let t = (m.__seed = (m.__seed + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; },
    stub(title, items = []) {
      return `<div style="margin-bottom:10px"><span class="pk-stub">◇ Stub · next round</span></div><div class="pk-stubnote"><b>${esc(title)}</b>${items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}</div>`;
    },
  };

  window.P = P;
  window.Kit = Kit;
  window.ProtoCanvasView = CanvasView;
})();
