// The fantasy fall: rainbow streaks and motes rushing up, with stick figures and emoji. Shared by fall-worker.js and flip.js's fallback; no DOM.

const DEPTHS = [
  { n: 46, v: 55, len: [3, 6], w: 1, a: 0.5 },
  { n: 26, v: 170, len: [12, 20], w: 1.3, a: 0.32 },
  { n: 12, v: 520, len: [42, 66], w: 1.8, a: 0.15 },
];
// No yellow, orange or green: faint over purple they go olive, which is only ever the stink's
const RAINBOW = ["255,92,205", "255,170,215", "90,210,255", "120,235,230", "175,130,255", "235,190,255"];
const DREAMS = ["🦄", "🌈", "💕", "🌸", "💖", "💜", "🦄", "💗"];
// Sprites drawn once and stamped: fonts, emoji and gradients per frame were most of the cost
const sprites = new Map();
function sprite(key, w, h, paint) {
  if (!sprites.has(key)) {
    const c = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
    paint(c.getContext("2d"));
    sprites.set(key, c);
  }
  return sprites.get(key);
}
const dreamImg = (e) => sprite(e, 56, 56, (g) => { g.font = "48px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(e, 28, 30); });
const streakImg = (col, a) => sprite(`${col}/${a}`, 1, 64, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, `rgba(${col},${a})`);
  gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 1, 64);
});
export function streaks(x, w, h, dense = 1, bright = 1, figs = 5, size = [26, 44], rainbow = false) {
  const r = (a, b) => a + Math.random() * (b - a), scale = (w * h) / (390 * 844) * dense;
  const hue = (gold) => (rainbow ? RAINBOW[Math.floor(Math.random() * RAINBOW.length)] : gold ? "232,176,64" : "240,232,220");
  const motes = DEPTHS.flatMap((d, k) => Array.from({ length: Math.max(dense > 1 ? 1 : 0, Math.round(d.n * scale)) }, () => ({ k, x: r(0, w), y: r(0, h), len: r(...d.len), col: hue(Math.random() < 0.2) })));
  const fig = (y) => ({ x: r(0.1, 0.9) * w, y, s: r(...size), vy: -r(25, 95), vx: r(-12, 12), rot: r(0, Math.PI * 2), spin: r(0.6, 2.2) * (Math.random() < 0.5 ? -1 : 1), ph: r(0, 9), col: hue(Math.random() < 0.25),
    dream: rainbow && Math.random() < 0.6 ? DREAMS[Math.floor(Math.random() * DREAMS.length)] : null });
  const figures = Array.from({ length: figs }, () => fig(r(0, h)));
  let t = 0;
  const person = (f) => {
    const k = f.s / 20, a = Math.min(1, 0.62 * bright) * (f.s / size[1]) ** 0.5, col = f.col;
    x.save();
    x.translate(f.x, f.y);
    x.rotate(f.rot);
    if (f.dream) { // a unicorn, rainbow, butterfly…
      x.globalAlpha = a * 0.55; // faint enough that text over it always reads
      const z = f.s * 56 / 48;
      x.drawImage(dreamImg(f.dream), -z / 2, -z / 2, z, z);
      x.restore();
      return;
    }
    x.scale(k, k);
    x.strokeStyle = `rgba(${col},${a.toFixed(3)})`;
    x.lineWidth = 1.8 / k;
    x.lineCap = x.lineJoin = "round";
    const limb = (ox, oy, ang, len) => { x.moveTo(ox, oy); x.lineTo(ox + Math.cos(ang) * len, oy + Math.sin(ang) * len); };
    const flap = Math.sin(t * 9 + f.ph), kick = Math.sin(t * 7 + f.ph);
    x.beginPath();
    x.arc(0, -7, 2.8, 0, Math.PI * 2);
    x.moveTo(0, -4.2); x.lineTo(0, 4);
    limb(0, -1.6, -2.85 + flap * 0.3, 6);
    limb(0, -1.6, -0.3 - flap * 0.3, 6);
    limb(0, 4, 2.2 + kick * 0.4, 7);
    limb(0, 4, 0.95 - kick * 0.4, 7);
    x.stroke();
    x.restore();
  };
  return (dt) => {
    t += dt;
    x.clearRect(0, 0, w, h);
    for (const m of motes) {
      const d = DEPTHS[m.k];
      m.y -= d.v * dt;
      if (m.y < -m.len) { m.y += h + m.len; m.x = r(0, w); }
      x.drawImage(streakImg(m.col, Math.min(1, d.a * bright).toFixed(3)), m.x, m.y, d.w, m.len);
    }
    for (const [i, f] of figures.entries()) {
      f.y += f.vy * dt; f.x += f.vx * dt; f.rot += f.spin * dt;
      if (f.y < -f.s) figures[i] = fig(h + f.s); // gone past: another comes up from below
      person(figures[i]);
    }
  };
}

// start() every frame (one still frame if reduced), stop(), hush(ms): every other frame for that long, keeping its speed
export function runner(canvas, w, h, reduced) {
  canvas.width = w; canvas.height = h;
  const draw = streaks(canvas.getContext("2d"), w, h, 1, 1.3, Math.max(4, Math.round(7 * (w * h) / (390 * 844))), [26, 44], true);
  const raf = globalThis.requestAnimationFrame ? (f) => requestAnimationFrame(f) : (f) => setTimeout(() => f(performance.now()), 16);
  const unraf = globalThis.cancelAnimationFrame ? (id) => cancelAnimationFrame(id) : (id) => clearTimeout(id);
  let id = 0, last = 0, odd = false, hushed = 0;
  const step = (now) => {
    odd = !odd;
    if (now >= hushed || odd || !last) {
      draw(last ? Math.min(0.05, (now - last) / 1000) : 0);
      last = now;
    }
    id = raf(step);
  };
  return {
    start() { if (reduced) draw(0); else if (!id) id = raf(step); },
    stop() { unraf(id); id = 0; last = 0; },
    hush(ms) { hushed = performance.now() + ms; },
  };
}
