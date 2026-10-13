// Alex's stream in Fantasy Land's footer: water from his chest funnel, a solid jet that breaks up into droplets,
// splashing and ringing the lake where it lands, all of it mirrored in the lake. Its pressure rises while he's pressed
// (main.js) and the arc rises and reaches with it, at its fullest the circle round the rainbow's centre, as the rainbow
// above. Each drop keeps the arc it left on, so a change runs out along the stream. Shared by stream-worker.js and
// main.js's fallback; no DOM.

const FPS = 30; // the footer's other motion is the compositor's; this is drawn, so at a pace a 60 or 120Hz screen divides
const RATE = 230; // drops a second
const UP = 2.2, DOWN = 1.5; // how fast the pressure rises while pressed, and falls when let go (a second)

export function streamer(canvas) {
  const x = canvas.getContext("2d");
  let g = null, k = 1, p = 0, want = 0, drops = [], bits = [], rings = [], id = 0, last = 0, owed = 0, still = false;
  const ease = (t) => t * t * (3 - 2 * t);
  // The arc at a pressure (0 to 1) at s along it (0 at the spout, 1 at the water): from the resting curve (a parabola over
  // the ducks) toward the rainbow's circle, round its centre through the spout, down to the water on the far side
  function at(e, s) {
    const { sx, sy, wy, cx, cy } = g;
    const u = 1 - s, ax = sx - 60, ay = sy - 72, bx = sx - 120, by = wy;
    const rx = u * u * sx + 2 * u * s * ax + s * s * bx, ry = u * u * sy + 2 * u * s * ay + s * s * by;
    if (!e) return [rx, ry];
    const a = g.a0 + s * (g.a1 - g.a0), mx = cx + g.R * Math.cos(a), my = cy + g.R * Math.sin(a);
    return [rx + (mx - rx) * e, ry + (my - ry) * e];
  }
  const span = (e) => 1 + 1.1 * e; // seconds from the spout to the water
  const breakAt = (e) => 0.16 + 0.1 * e; // where the jet breaks up into drops
  function emit(t, n) {
    const e = ease(p);
    for (let i = 0; i < n; i++) {
      const gauss = (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
      drops.push({ t0: t - Math.random() / FPS, e, T: span(e) * (1 + (Math.random() - 0.5) * 0.12), off: gauss, r: 0.5 + Math.random() * 1.1 });
    }
  }
  function splash(px, t) {
    for (let i = 0; i < 2; i++) bits.push({ x: px, y: g.wy - 1, vx: (Math.random() - 0.5) * 50, vy: -(25 + Math.random() * 55), t0: t });
    if (Math.random() < 0.35) rings.push({ x: px, t0: t });
  }
  function draw(t) {
    const W = g.W, H = g.H;
    x.setTransform(k, 0, 0, k, 0, 0);
    x.clearRect(0, 0, W, H);
    const e = ease(p), sb = breakAt(e);
    const along = (s0, s1, w, col, dy = 0) => {
      x.lineWidth = w; x.strokeStyle = col; x.beginPath();
      for (let s = s0; s <= s1 + 1e-6; s += 0.01) { const [jx, jy] = at(e, Math.min(1, s)); s > s0 ? x.lineTo(jx, jy + dy) : x.moveTo(jx, jy + dy); }
      x.stroke();
    };
    x.lineCap = "round"; x.lineJoin = "round";
    // The solid jet from the spout: a glassy body, a pale core
    along(0, sb + 0.04, 4.6 + 2 * e, "rgba(150,215,255,.16)");
    along(0, sb + 0.04, 2.4 + e, "rgba(205,238,255,.7)");
    along(0, sb + 0.03, 0.9, "rgba(255,255,255,.9)", -0.4);
    // The drops, each a short streak along its way, by size in three strokes
    const sets = [[], [], []];
    drops = drops.filter((d) => {
      const s = (t - d.t0) / d.T;
      if (s >= 1) { splash(at(d.e, 1)[0], t); return false; }
      if (s < breakAt(d.e) * 0.85) return true;
      const [ax, ay] = at(d.e, s), [bx, by] = at(d.e, Math.min(1, s + 0.025));
      let tx = bx - ax, ty = by - ay; const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
      const o = d.off * (1.5 + (9 + 9 * d.e) * Math.max(0, s - breakAt(d.e)) ** 1.2), px = ax - ty * o, py = ay + tx * o, len = d.r * (0.4 + 1.1 * (1 - s));
      sets[d.r < 0.85 ? 0 : d.r < 1.25 ? 1 : 2].push(px, py, px - tx * len, py - ty * len);
      return true;
    });
    [[0.8, "rgba(210,240,255,.42)"], [1.25, "rgba(228,247,255,.6)"], [1.8, "rgba(246,252,255,.82)"]].forEach(([w, col], i) => {
      const v = sets[i]; if (!v.length) return;
      x.lineWidth = w; x.strokeStyle = col; x.beginPath();
      for (let j = 0; j < v.length; j += 4) { x.moveTo(v[j], v[j + 1]); x.lineTo(v[j + 2], v[j + 3]); }
      x.stroke();
    });
    // Splashes thrown up where it lands, falling back
    x.fillStyle = "rgba(200,250,255,.8)";
    x.beginPath();
    bits = bits.filter((b) => {
      const a = t - b.t0, bx = b.x + b.vx * a, by = b.y + b.vy * a + 0.5 * 320 * a * a;
      if (by > g.wy + 2) return false;
      x.moveTo(bx + 0.8, by); x.arc(bx, by, 0.8, 0, Math.PI * 2);
      return true;
    });
    x.fill();
    // All of it mirrored in the lake below the waterline, faint and fading with depth
    const wd = Math.round(g.wy * k), cw = canvas.width;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 0.3;
    x.setTransform(1, 0, 0, -1, 0, 2 * wd);
    x.drawImage(canvas, 0, 0, cw, wd, 0, 0, cw, wd);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = "destination-out";
    x.fillStyle = g.fade;
    x.fillRect(0, wd, cw, canvas.height - wd);
    x.globalCompositeOperation = "source-over";
    x.setTransform(k, 0, 0, k, 0, 0);
    // Rings spreading on the water, glowing
    rings = rings.filter((r) => {
      const a = (t - r.t0) / 0.9;
      if (a >= 1) return false;
      x.beginPath(); x.ellipse(r.x, g.wy, 2 + 16 * a, 0.6 + 3 * a, 0, 0, Math.PI * 2);
      x.lineWidth = 2.4; x.strokeStyle = `rgba(80,225,255,${(0.16 * (1 - a)).toFixed(3)})`; x.stroke();
      x.lineWidth = 0.8; x.strokeStyle = `rgba(150,245,255,${(0.6 * (1 - a)).toFixed(3)})`; x.stroke();
      return true;
    });
  }
  // Still: the stream drawn once along its arc, its drops where they'd be
  function stillFrame() {
    drops = []; bits = []; rings = [];
    const t = 10;
    for (let i = 0; i < 60; i++) { emit(t, 1); drops.at(-1).t0 = t - Math.random() * drops.at(-1).T * 0.98; }
    draw(t);
    bits = []; rings = [];
  }
  const raf = globalThis.requestAnimationFrame ? (f) => requestAnimationFrame(f) : (f) => setTimeout(() => f(performance.now()), 16);
  const unraf = globalThis.cancelAnimationFrame ?? clearTimeout;
  function step(now) {
    id = raf(step);
    if (last && now - last < 1000 / FPS - 3) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / FPS;
    last = now;
    p += (want - p) * Math.min(1, (want > p ? UP : DOWN) * dt);
    owed += RATE * (1 + 0.6 * p) * dt;
    const n = Math.floor(owed); owed -= n;
    const t = now / 1000;
    emit(t, n);
    draw(t);
  }
  return {
    // The canvas's size and the places in it (CSS px): the spout, the water, the rainbow's centre
    geom(m) {
      g = { ...m };
      g.R = Math.hypot(g.sx - g.cx, g.sy - g.cy);
      g.a0 = Math.atan2(g.sy - g.cy, g.sx - g.cx);
      g.a1 = Math.atan2(g.wy - g.cy, -Math.sqrt(Math.max(0, g.R ** 2 - (g.wy - g.cy) ** 2)));
      k = m.res;
      canvas.width = Math.round(g.W * k); canvas.height = Math.round(g.H * k);
      const wd = Math.round(g.wy * k);
      g.fade = x.createLinearGradient(0, wd, 0, wd + 40 * k);
      g.fade.addColorStop(0, "rgba(0,0,0,0)"); g.fade.addColorStop(1, "rgba(0,0,0,1)");
      still = m.still;
      if (still) stillFrame();
    },
    press(on) { want = on ? 1 : 0; if (still) { p = want; stillFrame(); } },
    start() { if (!still && !id && g) { last = 0; id = raf(step); } },
    stop() { unraf(id); id = 0; },
  };
}
