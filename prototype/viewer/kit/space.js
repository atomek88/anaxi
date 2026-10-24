/* proto-kit · space — spatial scenes: 2D canvas, and 3D (three.js) only when depth carries meaning. THROWAWAY.
 * 3D needs vendor/three.min.js (new.sh --with three). Scenes are drawn from the model each render — no free-running
 * animation loop — so every step is deterministic and capturable.
 *
 *   Space.canvas(el, { width, height, draw(g, ctx) })                       // g: CanvasRenderingContext2D (already scaled for crispness)
 *   Space.three(el, { width, height, camera: { pos:[x,y,z], look:[x,y,z], fov }, build(THREE, scene, ctx) })
 *   Space.view({ kind: "canvas" | "three", ...same opts })                  // { render, after } for a P.scenario / P.state
 * Helpers for 2D: Space.grid(g, w, h, step) · Space.dot(g, x, y, r, color) · Space.label(g, text, x, y)
 */
(function () {
  const P = window.P;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function canvas(el, o) {
    const W = o.width || 800, H = o.height || 480, dpr = window.devicePixelRatio || 1;
    const c = document.createElement("canvas");
    c.width = W * dpr; c.height = H * dpr; c.style.width = `${W}px`; c.style.height = `${H}px`; c.style.maxWidth = "100%"; c.style.borderRadius = "12px"; c.style.background = o.background || "#fbfaf8";
    const g = c.getContext("2d"); g.scale(dpr, dpr);
    el.replaceChildren(c);
    o.draw(g, o.ctx || {}, { W, H });
    return c;
  }

  function three(el, o) {
    const THREE = window.THREE;
    if (!THREE) throw new Error("Space.three: three.js not loaded — scaffold with new.sh --with three");
    const W = o.width || 800, H = o.height || 480;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1); renderer.setSize(W, H);
    renderer.domElement.style.maxWidth = "100%"; renderer.domElement.style.borderRadius = "12px";
    const scene = new THREE.Scene(); scene.background = new THREE.Color(o.background || "#fbfaf8");
    const cam = o.camera || {};
    const camera = new THREE.PerspectiveCamera(cam.fov || 45, W / H, 0.1, 5000);
    camera.position.set(...(cam.pos || [8, 8, 12])); camera.lookAt(new THREE.Vector3(...(cam.look || [0, 0, 0])));
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(5, 10, 7); scene.add(sun);
    o.build(THREE, scene, o.ctx || {}, { camera, renderer });
    renderer.render(scene, camera);   // one deterministic frame per render
    el.replaceChildren(renderer.domElement);
    return { renderer, scene, camera };
  }

  function view(o) {
    return {
      render: (ctx) => `${o.above ? o.above(ctx) : ""}<div class="sp-host"></div>${o.below ? o.below(ctx) : ""}`,
      after: (ctx) => (o.kind === "three" ? three : canvas)(ctx.el.querySelector(".sp-host"), { ...o, ctx }),
    };
  }

  // 2D helpers
  const grid = (g, w, h, step = 40) => { g.strokeStyle = "#ece9e4"; g.lineWidth = 1; for (let x = 0; x <= w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } };
  const dot = (g, x, y, r = 6, color = css("--pk-accent")) => { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const label = (g, text, x, y, color = css("--pk-ink-2")) => { g.fillStyle = color; g.font = "12px -apple-system, system-ui, sans-serif"; g.fillText(text, x, y); };

  window.Space = { canvas, three, view, grid, dot, label };
})();
