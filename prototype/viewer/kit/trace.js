/* proto-kit · trace — step through code: source + current line + variables + call stack (+ optional call graph). THROWAWAY.
 * Optional: vendor/highlight.min.js (new.sh --with hljs) for syntax colour.
 *
 *   P.code("policy", { title, lang: "swift", file: "NudgePolicy.swift", source: `...` })     // registered → harvested
 *   P.scenario("trace", { title, steps: [
 *       { label: "budget check", line: 12, vars: { sent: 3, budget: 3 }, stack: ["decide", "nudgePolicy"], note, out: "hold" } ],
 *     ...Trace.view("policy", { graph: "calls" }) })    // graph: a P.graph whose node ids are function names (stack top is focused)
 * Lines are 1-based. Variables that changed since the previous step are highlighted. Steps may also set `lines: [a, b]` (a range).
 */
(function () {
  const P = window.P, esc = P.esc;
  document.head.insertAdjacentHTML("beforeend", `<style>
    .tr-wrap { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(260px, 1fr); gap: 18px; align-items: start; }
    .tr-src { background: #1d1c1a; color: #e9e6e0; border-radius: 12px; padding: 10px 0; font: 12.5px/1.6 ui-monospace, Menlo, monospace; overflow-x: auto; }
    .tr-src .ln { display: grid; grid-template-columns: 44px 1fr; padding-right: 14px; white-space: pre; }
    .tr-src .ln .n { color: #6f6b65; text-align: right; padding-right: 14px; user-select: none; }
    .tr-src .ln.cur { background: rgba(224,112,58,.28); box-shadow: inset 3px 0 0 var(--pk-accent); }
    .tr-src .ln.seen .n { color: #bfa58f; }
    .tr-file { font: 11px ui-monospace, Menlo, monospace; color: var(--pk-ink-3); margin-bottom: 6px; }
    .tr-side h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: var(--pk-ink-3); margin: 0 0 6px; }
    .tr-side > div + div { margin-top: 14px; }
    .tr-stack { list-style: none; margin: 0; padding: 0; font: 12.5px ui-monospace, Menlo, monospace; }
    .tr-stack li { padding: 4px 8px; border-left: 3px solid var(--pk-line); } .tr-stack li:last-child { border-color: var(--pk-accent); font-weight: 700; }
    .tr-out { font: 13px ui-monospace, Menlo, monospace; background: var(--pk-accent-soft); padding: 8px 10px; border-radius: 8px; }
    .hljs-keyword, .hljs-built_in { color: #f0a97f; } .hljs-string { color: #a8d5a2; } .hljs-number, .hljs-literal { color: #8fc1ff; }
    .hljs-comment { color: #7d7870; font-style: italic; } .hljs-title, .hljs-function { color: #e9d38f; } .hljs-type { color: #d6a8ff; }
    @media (max-width: 900px) { .tr-wrap { grid-template-columns: 1fr; } }
  </style>`);

  const highlight = (line, lang) => {
    if (window.hljs && lang && window.hljs.getLanguage(lang)) { try { return window.hljs.highlight(line, { language: lang, ignoreIllegals: true }).value; } catch {} }
    return esc(line);
  };

  function view(codeId, o = {}) {
    return {
      render(ctx) {
        const code = P.codes[codeId];
        if (!code) throw new Error(`Trace.view: unknown code ${codeId} — register it with P.code`);
        const st = ctx.step || {}, prevSt = ctx.n > 1 ? ctx.scenario.steps[ctx.n - 2] : {};
        const cur = new Set(st.lines ? range(st.lines) : st.line ? [st.line] : []);
        const seen = new Set(ctx.scenario.steps.slice(0, Math.max(0, ctx.n - 1)).flatMap((s) => (s.lines ? range(s.lines) : s.line ? [s.line] : [])));
        const lines = code.source.replace(/^\n/, "").split("\n");
        const vars = st.vars || {}, pv = prevSt.vars || {};
        const changed = Object.keys(vars).filter((k) => JSON.stringify(vars[k]) !== JSON.stringify(pv[k]));
        return `${o.above ? o.above(ctx) : ""}<div class="tr-wrap"><div>
            <div class="tr-file">${esc(code.file || code.title || codeId)}</div>
            <div class="tr-src">${lines.map((l, i) => `<div class="ln ${cur.has(i + 1) ? "cur" : seen.has(i + 1) ? "seen" : ""}"><span class="n">${i + 1}</span><span>${highlight(l, code.lang) || " "}</span></div>`).join("")}</div>
          </div><div class="tr-side">
            ${Object.keys(vars).length ? `<div><h3>Variables</h3>${Kit.table(Object.entries(vars).map(([k, v]) => ({ name: k, value: v })), { mark: (r) => (changed.includes(r.name) && ctx.n > 1 ? "changed" : "") })}</div>` : ""}
            ${st.stack ? `<div><h3>Call stack</h3><ol class="tr-stack">${st.stack.map((f) => `<li>${esc(f)}</li>`).join("")}</ol></div>` : ""}
            ${st.out !== undefined ? `<div><h3>Result</h3><div class="tr-out">${esc(typeof st.out === "object" ? JSON.stringify(st.out) : st.out)}</div></div>` : ""}
            ${o.graph ? `<div><h3>Call graph</h3><div class="tr-graph"></div></div>` : ""}
            ${o.side ? `<div>${o.side(ctx)}</div>` : ""}
          </div></div>${o.below ? o.below(ctx) : ""}`;
      },
      after(ctx) {
        if (!o.graph) return;
        const st = ctx.step || {}, top = st.stack && st.stack[st.stack.length - 1];
        const ids = new Set(P.graphs[o.graph].nodes.map((n) => n.id));
        window.Graph.render(ctx.el.querySelector(".tr-graph"), o.graph, { focus: (st.stack || []).filter((f) => ids.has(f)), ...(st.stack && st.stack.length > 1 && ids.has(top) && ids.has(st.stack[st.stack.length - 2]) && P.graphs[o.graph].edges.some((e) => e.from === st.stack[st.stack.length - 2] && e.to === top) ? { hop: [st.stack[st.stack.length - 2], top] } : {}) });
      },
    };
  }
  const range = ([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  window.Trace = { view };
})();
