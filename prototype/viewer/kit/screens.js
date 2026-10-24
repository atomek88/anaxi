/* proto-kit · screens lens — device frame + stack navigation over the kit core. THROWAWAY.
 *
 * Link convention (exits are auto-extracted from these, so the map is never hand-maintained):
 *   <button ${UI.go('profile')}>            push   — slides in; Back pops
 *   <button ${UI.go('quickadd','sheet')}>   sheet  — slides up over current; one sheet layer max
 *   <button ${UI.go('home','root')}>        root   — replaces the stack (auth → home, sign out)
 *   <button ${UI.go('', 'back')}>           back   — pops
 * State kinds: 'screen' | 'sheet' | 'action' (iOS action sheet). Sheets set `over` (base screen for captures),
 * default cfg.home. Hash = the stack: #/home/profile/nagginess.
 */
(function () {
  const P = window.P, esc = P.esc;
  const isOverlay = (id) => P.states[id] && P.states[id].kind !== "screen";
  const ctxFor = (id, route) => ({ P, state: P.states[id], model: P.modelFor(P.states[id]), variant: P.variant, esc, Kit, UI, route });

  const FRAMES = {
    iphone: { w: 390, h: 844, chrome: () => `<div class="sx-island"></div><div class="sx-status"><span>${esc(P.cfg.clock || "9:41")}</span><span class="icons">▂▄▆ ᯤ ▭</span></div><div class="sx-homebar"></div>` },
    android: { w: 412, h: 915, chrome: () => `<div class="sx-punch"></div><div class="sx-status"><span>${esc(P.cfg.clock || "9:41")}</span><span class="icons">▂▄▆ ▮</span></div><div class="sx-homebar"></div>` },
    browser: { w: 1280, h: 800, chrome: (route) => `<div class="sx-chrome"><span class="dots"><i></i><i></i><i></i></span><span class="url">${esc((P.cfg.host || "app.example.com") + "/" + route.path.join("/"))}</span></div>` },
    desktop: { w: 1440, h: 900, chrome: (route) => `<div class="sx-chrome"><span class="dots"><i></i><i></i><i></i></span><span class="url">${esc(route.path.join(" › "))}</span></div>` },
  };
  const frame = () => FRAMES[P.cfg.frame || "iphone"];

  const ScreensView = {
    render(P, stage, route) {
      const path = route.path;
      const top = path[path.length - 1];
      let baseIdx = path.length - 1;
      while (baseIdx > 0 && isOverlay(path[baseIdx])) baseIdx--;
      const base = path[baseIdx];
      const bst = P.states[base];
      const anim = P._anim;
      const bctx = ctxFor(base, route);
      const cls = typeof bst.cls === "function" ? bst.cls(bctx) : bst.cls || "";
      const baseAnim = top === base ? { push: "a-push", back: "a-back", root: "a-root" }[anim] || "" : "";
      let html = `<div class="sx-screen ${cls} ${baseAnim}" data-pk-scroll>${bst.render(bctx)}</div>`;
      if (top !== base) {
        const st = P.states[top], fresh = anim === "sheet" || anim === "push" ? "a" : "";
        const sctx = ctxFor(top, route);
        html += `<div class="sx-scrim ${fresh}" data-go="" data-mode="back" data-label="dismiss"></div>`;
        html += st.kind === "action"
          ? `<div class="sx-action ${fresh}">${st.render(sctx)}</div>`
          : `<div class="sx-sheet ${st.half ? "half" : ""} ${fresh}">${st.render(sctx)}</div>`;
      }
      stage.className = "pk-stage";
      stage.innerHTML = `<div class="sx-frame ${esc(P.cfg.frame || "iphone")}">${frame().chrome(route)}<div class="sx-viewport">${html}</div></div>`;
      if (bst.after) bst.after({ ...bctx, el: stage });
      if (top !== base && P.states[top].after) P.states[top].after({ ...ctxFor(top, route), el: stage });
    },

    /** data-go="id" data-mode="push|sheet|root|back" */
    onClick(P, e) {
      const t = e.target.closest("[data-go]");
      if (!t) return;
      const mode = t.dataset.mode || "push", to = t.dataset.go;
      let path = P.parse().path.slice();
      if (mode === "back") { path.pop(); if (!path.length) path = [P.cfg.home || P.order[0]]; }
      else if (mode === "root") path = [to];
      else {
        if (path.length && isOverlay(path[path.length - 1])) path.pop(); // sheets never stack; a push from a sheet closes it first
        path.push(to);
      }
      P.log(`${mode === "back" ? "← back" : `${mode} → ${to}`}  (${t.dataset.label || t.textContent.trim().replace(/\s+/g, " ").slice(0, 30)})`);
      P.go("#/" + path.map(encodeURIComponent).join("/"), mode);
    },

    exits(P, id) {
      const tmp = document.createElement("div");
      try { tmp.innerHTML = P.states[id].render(ctxFor(id, { path: [id], id })); } catch (e) { return []; }
      const seen = new Set();
      return [...tmp.querySelectorAll("[data-go]")].map((el) => ({ to: el.dataset.go, mode: el.dataset.mode || "push", label: el.dataset.label || el.textContent.trim().replace(/\s+/g, " ").slice(0, 40) }))
        .filter((e) => { const k = e.to + e.mode + e.label; if (seen.has(k)) return false; seen.add(k); return true; });
    },
    hashFor(P, id) { return isOverlay(id) ? `#/${P.states[id].over || P.cfg.home || P.order[0]}/${id}` : `#/${id}`; },
    captureSize() { const f = frame(); return { width: Math.min(f.w, 1440) + 110, height: f.h + 110, scale: P.cfg.frame === "browser" || P.cfg.frame === "desktop" ? 1 : 2 }; },

    panel(P, route) {
      const exits = this.exits(P, route.id);
      const sym = { push: "→ push", sheet: "↑ sheet", root: "⟲ root", back: "← back" };
      return `<h2>Exits from here (${exits.length})</h2><div class="pk-box">${exits.length ? exits.map((e) =>
        `<button class="pk-exit" data-go="${esc(e.to)}" data-mode="${esc(e.mode)}" data-label="${esc(e.label)}"><span class="l">${esc(e.label)}</span><span class="m">${sym[e.mode] || e.mode} ${esc(e.to)}</span></button>`).join("")
        : '<span style="font-size:12px;color:var(--pk-ink-3)">none — in-place only</span>'}</div>`;
    },
  };

  /* ---------- authoring helpers ---------- */
  const UI = {
    go: (id, mode = "push", label = "") => `data-go="${esc(id)}" data-mode="${mode}"${label ? ` data-label="${esc(label)}"` : ""}`,
    nav: (title, { back = "Back", right = "" } = {}) => `<div class="navbar"><button class="navbtn" ${UI.go("", "back", "Back")}>‹ ${esc(back)}</button><div class="title">${esc(title)}</div><div class="navbtn right">${right}</div></div>`,
    sheetHead: (title, right = "") => `<span class="sx-grabber"></span><div class="navbar"><button class="navbtn" ${UI.go("", "back", "Cancel")}>Cancel</button><div class="title">${esc(title)}</div><div class="navbtn right">${right}</div></div>`,
    /** opts: { to, mode, val, sub, toggle:bool, act:'name:arg', danger } */
    row(ic, label, o = {}) {
      const attrs = o.to ? UI.go(o.to, o.mode || "push", label) : o.act ? `data-act="${esc(o.act)}"` : "";
      const tail = o.toggle !== undefined ? `<span class="toggle ${o.toggle ? "on" : ""}"></span>`
        : `${o.val ? `<span class="val">${esc(o.val)}</span>` : ""}${o.to && !o.danger ? '<span class="chev"></span>' : ""}`;
      return `<button class="row ${ic ? "" : "noicon"} ${o.danger ? "danger" : ""}" ${attrs}>${ic ? `<span class="ic">${ic}</span>` : ""}<span class="label">${esc(label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</span>${tail}</button>`;
    },
    list: (rows, head = "") => `${head ? `<div class="caps listhead">${esc(head)}</div>` : ""}<div class="list">${rows.join("")}</div>`,
    stub: (title, items) => `<div class="pad" style="margin:8px 0 14px">${Kit.stub(title, items)}</div>`,
    /** A lock screen (system surface). time/date shown large; body = notifications html. Use as a state's render. */
    lockscreen: (body, { time = P.cfg.clock || "9:41", date = "Monday 12 October" } = {}) =>
      `<div class="sx-lock"><div class="date">${esc(date)}</div><div class="time">${esc(time)}</div><div class="stack">${body}</div></div>`,
    /** One notification. o: { app, title, body, time, icon, actions:[{label, go, mode, act}], expanded } — actions render when expanded */
    notification: (o) => `<div class="sx-notif ${o.expanded ? "open" : ""}">
      <div class="hd"><span class="ic">${o.icon || "☀"}</span><span class="app">${esc(o.app || "APP")}</span><span class="t">${esc(o.time || "now")}</span></div>
      <div class="ti">${esc(o.title || "")}</div><div class="bd">${esc(o.body || "")}</div></div>
      ${o.expanded && o.actions ? `<div class="sx-notif-actions">${o.actions.map((a) => `<button ${a.act ? `data-act="${esc(a.act)}"` : UI.go(a.go || "", a.mode || "push", a.label)}>${esc(a.label)}</button>`).join("")}</div>` : ""}`,
  };

  P.view = ScreensView;
  window.UI = UI;
})();
