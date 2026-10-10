// Slam's effects (flip.js): dust and smoke as the row breaks loose, sparks and smoke where it lands, and a shine across it.
// One canvas over the page, named in the transition so it's drawn above its pictures; a new view's picture follows its
// element, so it's drawn live. Its clock is the transition's own (the camera's animation), so it keeps time with it.
// Soft shapes are drawn once and stamped.

const rand = (a, b) => a + Math.random() * (b - a);
const sprites = new Map();
function sprite(key, size, stops) {
  if (!sprites.has(key)) {
    const c = Object.assign(document.createElement("canvas"), { width: size, height: size }), g = c.getContext("2d");
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [at, col] of stops) gr.addColorStop(at, col);
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    sprites.set(key, c);
  }
  return sprites.get(key);
}
const glow = (col) => sprite(`g${col}`, 32, [[0, "#fff"], [0.18, col], [0.5, col.replace(/[\d.]+\)$/, "0.25)")], [1, col.replace(/[\d.]+\)$/, "0)")]]);
const puff = (col) => sprite(`p${col}`, 96, [[0, col.replace(/[\d.]+\)$/, "0.55)")], [0.45, col.replace(/[\d.]+\)$/, "0.28)")], [1, col.replace(/[\d.]+\)$/, "0)")]]);

// from, to: the row's rect before and where it lands; times in seconds: loose (shaking), lift (lifted), impact, end;
// fantasy: the view it lands in, whose colours it throws
export function slamFx({ from: o, to: n, loose, lift, impact, end, fantasy }) {
  const dpr = 1, W = innerWidth, H = innerHeight; // soft light and smoke: a quarter of a 2× screen's pixels does
  const canvas = Object.assign(document.createElement("canvas"), { className: "vt-fx", width: Math.round(W * dpr), height: Math.round(H * dpr) });
  canvas.setAttribute("aria-hidden", "true");
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  const DREAM = ["rgba(255, 92, 205, 1)", "rgba(90, 224, 255, 1)", "rgba(255, 227, 106, 1)", "rgba(190, 140, 255, 1)"], GOLD = ["rgba(232, 176, 64, 1)", "rgba(255, 215, 122, 1)", "rgba(255, 244, 214, 1)"];
  // The dust is the view it leaves; the sparks and smoke where it lands, the view it lands in
  const sparks = fantasy ? DREAM : GOLD, dust = fantasy ? GOLD : DREAM;
  const smoke = fantasy ? "rgba(255, 196, 240, 1)" : "rgba(214, 204, 192, 1)", haze = fantasy ? "rgba(214, 204, 192, 1)" : "rgba(255, 196, 240, 1)";
  const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
  const bits = [];
  // Breaking loose: dust falls from under the shaking row, and a little smoke
  for (let k = 0; k < 16; k++) bits.push({ kind: "dust", t0: rand(0.02, lift * 0.9), life: rand(0.45, 0.8), x: rand(o.left + 8, o.right - 8), y: o.bottom - 2, vx: rand(-20, 20), vy: rand(10, 60), g: 420, r: rand(1, 2.2), col: pick(dust) });
  for (let k = 0; k < 6; k++) bits.push({ kind: "smoke", t0: rand(0, loose), life: rand(0.6, 0.9), x: rand(o.left, o.right), y: o.bottom, vx: rand(-25, 25), vy: rand(-18, -4), r0: rand(8, 12), r1: rand(26, 40), a: 0.22, col: haze });
  // The landing: sparks off the edges, smoke rolling out along the board
  for (let k = 0; k < 48; k++) {
    const side = Math.random() < 0.7 ? 0 : Math.random() < 0.5 ? -1 : 1; // the bottom edge, or an end
    const x = side ? (side < 0 ? n.left : n.right) : rand(n.left, n.right), y = side ? rand(n.top, n.bottom) : n.bottom;
    const out = side || Math.sign(x - (n.left + n.right) / 2) || 1;
    bits.push({ kind: "spark", t0: impact + rand(0, 0.05), life: rand(0.45, 0.85), x, y, vx: out * rand(60, 360), vy: -rand(80, 460), g: 900, r: rand(1.2, 2.6), col: pick(sparks) });
  }
  for (let k = 0; k < 14; k++) {
    const x = rand(n.left, n.right), out = Math.sign(x - (n.left + n.right) / 2) || 1;
    bits.push({ kind: "smoke", t0: impact + rand(0, 0.08), life: rand(0.8, 1.05), x, y: n.bottom - 6, vx: out * rand(40, 170), vy: -rand(8, 40), r0: rand(10, 16), r1: rand(46, 72), a: 0.32, col: smoke });
  }
  // The shine: two bands of light sweep across the landed row
  const shine = [impact + 0.1, impact + 0.28];

  // Nothing showing and nothing left on the canvas: nothing to draw, so the canvas isn't sent again
  let shown = true;
  const showing = (t) => bits.some((b) => t >= b.t0 && t <= b.t0 + b.life) || shine.some((t0) => t >= t0 && t <= t0 + 0.5);
  const draw = (t) => {
    const now = showing(t);
    if (!now && !shown) return;
    shown = now;
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    for (const b of bits) {
      const s = t - b.t0;
      if (s < 0 || s > b.life) continue;
      const k = s / b.life, x = b.x + b.vx * s, y = b.y + b.vy * s + ((b.g || 0) * s * s) / 2;
      if (b.kind === "smoke") {
        const r = b.r0 + (b.r1 - b.r0) * (1 - (1 - k) ** 2);
        g.globalAlpha = b.a * (1 - k) ** 1.5;
        g.drawImage(puff(b.col), x - r, y - r, 2 * r, 2 * r);
      }
    }
    g.globalCompositeOperation = "lighter";
    for (const b of bits) {
      const s = t - b.t0;
      if (b.kind === "smoke" || s < 0 || s > b.life) continue;
      const k = s / b.life, x = b.x + b.vx * s, y = b.y + b.vy * s + (b.g * s * s) / 2;
      g.globalAlpha = (1 - k) ** 1.2;
      if (b.kind === "spark") { // a short streak along its path, with a glow at its head
        const vy = b.vy + b.g * s;
        g.strokeStyle = b.col; g.lineWidth = b.r; g.lineCap = "round";
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - b.vx * 0.025, y - vy * 0.025); g.stroke();
      }
      const z = b.r * 5;
      g.drawImage(glow(b.col), x - z, y - z, 2 * z, 2 * z);
    }
    for (const [i, t0] of shine.entries()) {
      const k = (t - t0) / 0.5;
      if (k < 0 || k > 1) continue;
      const w = n.width, cx = n.left - 0.3 * w + k * 1.6 * w, band = 0.18 * w;
      g.save();
      g.beginPath(); g.rect(n.left, n.top, n.width, n.height); g.clip();
      const gr = g.createLinearGradient(cx - band, n.top, cx + band, n.bottom);
      const peak = (i ? 0.28 : 0.5) * Math.sin(Math.PI * k);
      gr.addColorStop(0, "rgba(255, 255, 255, 0)");
      gr.addColorStop(0.5, fantasy ? `rgba(255, 236, 250, ${peak})` : `rgba(255, 240, 205, ${peak})`);
      gr.addColorStop(1, "rgba(255, 255, 255, 0)");
      g.globalAlpha = 1; g.fillStyle = gr;
      g.fillRect(n.left, n.top, n.width, n.height);
      g.restore();
    }
    g.globalAlpha = 1;
  };

  let raf = 0, clock = null;
  const frame = () => {
    const t = clock?.currentTime;
    if (t == null || t / 1000 >= end) return stop();
    draw(t / 1000);
    raf = requestAnimationFrame(frame);
  };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; g.clearRect(0, 0, W, H); };
  return {
    canvas,
    start(anim) { clock = anim; if (!raf) raf = requestAnimationFrame(frame); },
    stop() { stop(); canvas.remove(); },
  };
}
