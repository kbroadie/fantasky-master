// The sky's optics and a comet, the same in both footers (on request: "Make accurate sun halos and don't force rainbows.
// Celestial features should be the same in both footers"): drawn by main.js each minute on a canvas behind the house's
// drawing (.sky-c), which Fantasy Land keeps, its light added to the sky under it. No DOM.
// Round the sun, and fainter round the moon, the halos of ice crystals in high cloud: the 22° halo (nothing inside it, a
// soft red inner edge, gold, then white and blue-white fading outward), the much fainter 46° halo, the sundogs either
// side (red toward the sun, a white tail away; further out the higher it is, strongest low, gone above 58°) and, while
// the sun's under 32°, the circumzenithal arc round the zenith 46° above it, a pure spectrum, red toward the sun. A real
// rainbow circles the point opposite the sun, behind the viewer, so there's none. And a comet now and then (ten nights
// in twenty-five, brightest in the middle), riding the sky as a star does, slow, its tails away from the sun: a broad
// curved dust tail and a straight faint blue ion tail, a greenish coma round a bright nucleus.

// px a degree: as a phone's camera sees the sky, a little wider on a wide screen
export const degPx = (w, h) => Math.min(h, 1.6 * w) / 75;

// Where the sun is at an hour, up or down, and the comet, in the sky's own terms: across (0 left to 1 right) and its
// height in degrees. The sun rises at the left at 6:00, crosses and sets at the right at 20:00, and passes under the
// horizon back to the left by night; the comet is up from 18:00 to 6:00, across a lower arc
export function sunSky(h) {
  const d = (h - 6) / 14;
  if (d >= 0 && d <= 1) return { x: d, elev: 55 * Math.sin(Math.PI * d) };
  const n = ((h - 20 + 24) % 24) / 10;
  return { x: 1 - n, elev: -40 * Math.sin(Math.PI * n) };
}
export function cometSky(date, h) {
  const day = Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 864e5) - (h < 12 ? 1 : 0); // the night it belongs to
  const c = ((day % 25) + 25) % 25, t = ((h - 18 + 24) % 24) / 12;
  if (c >= 10 || t > 1) return null;
  return { x: 0.12 + 0.76 * t, elev: 12 + 26 * Math.sin(Math.PI * t), b: Math.sin(Math.PI * (c + 0.5) / 10) };
}

// o: the canvas's size (w, h, CSS px, its foot the horizon) and pixels a CSS px (k); deg, px a degree; and what's up, each
// with its place on the canvas, its height in degrees and how much it shows: sun { x, y, elev, show }, moon { x, y,
// elev, show } (show: its halo's strength, by its light), comet { x, y, tx, ty (its tail's way), show }
export function drawSky(canvas, o) {
  const g = canvas.getContext("2d");
  canvas.width = Math.round(o.w * o.k); canvas.height = Math.round(o.h * o.k);
  g.setTransform(o.k, 0, 0, o.k, 0, 0);
  g.clearRect(0, 0, o.w, o.h);
  g.globalCompositeOperation = "lighter";
  if (o.sun?.show > 0.01) halos(g, o, o.sun, o.sun.show, false);
  if (o.moon?.show > 0.01) halos(g, o, o.moon, o.moon.show, true);
  if (o.comet?.show > 0.01) comet(g, o.comet, o.deg);
}

function halos(g, o, b, A, pale) {
  const { deg } = o, cx = b.x, cy = b.y;
  const tint = (c) => (pale ? c.map((v) => Math.round(v + (230 - v) * 0.75)) : c); // the moon's: nearly colourless to the eye
  const ring = (prof) => {
    const R = prof.at(-1)[0] * deg, gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    for (const [d, r, gg, bb, a] of prof) gr.addColorStop(d * deg / R, `rgba(${r},${gg},${bb},${(a * A).toFixed(3)})`);
    g.fillStyle = gr; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  };
  // The aureole: light scattered close round it, soft
  ring([[0, 255, 245, 225, 0.12], [3, 255, 240, 220, 0.05], [10, 255, 240, 220, 0.015], [20, 255, 240, 220, 0]]);
  // The 22° halo
  ring([[0, 0, 0, 0, 0], [21.3, 255, 60, 40, 0], [21.7, ...tint([255, 70, 45]), 0.22], [22.0, ...tint([255, 150, 70]), 0.3], [22.4, ...tint([255, 225, 150]), 0.3],
    [23.0, 250, 248, 240, 0.22], [24.2, 225, 232, 255, 0.11], [26, 215, 225, 255, 0.045], [29, 210, 220, 255, 0.012], [33, 210, 220, 255, 0]]); // falling off within a few degrees
  // The 46° halo
  ring([[0, 0, 0, 0, 0], [45.2, 255, 70, 50, 0], [45.8, ...tint([255, 110, 60]), 0.06], [46.4, ...tint([255, 210, 140]), 0.07], [47.5, 245, 245, 245, 0.05],
    [50, 220, 228, 255, 0.025], [55, 220, 228, 255, 0]]);
  // The sundogs (moondogs by night)
  const e = Math.max(0, b.elev), sd = e < 58 ? 0.7 * (1 - e / 58) ** 0.7 : 0, dd = (22 / Math.cos((e * Math.PI) / 180) ** 0.95) * deg;
  if (sd > 0.01) for (const side of [-1, 1]) for (const [off, c, a, rr0] of [[-0.6, [255, 70, 45], 0.5, 1.1], [0, [255, 170, 80], 0.6, 1.3], [0.7, [255, 238, 190], 0.55, 1.5], [1.6, [250, 250, 255], 0.3, 1.9], [3.5, [240, 244, 255], 0.14, 2.6], [6.5, [235, 240, 255], 0.06, 3.4]]) {
    const x = cx + side * (dd + off * deg), rr = rr0 * deg, cc = off < 1 ? tint(c) : c, gr = g.createRadialGradient(x, cy, 0, x, cy, rr);
    gr.addColorStop(0, `rgba(${cc[0]},${cc[1]},${cc[2]},${(a * sd * A).toFixed(3)})`); gr.addColorStop(1, `rgba(${cc[0]},${cc[1]},${cc[2]},0)`);
    g.save(); g.translate(x, cy); g.scale(1, 1.25); g.translate(-x, -cy); g.fillStyle = gr; g.fillRect(x - rr, cy - rr, 2 * rr, 2 * rr); g.restore();
  }
  // The circumzenithal arc, the sun's only (the moon's is too faint to see), while it's under 32°: round the zenith
  // (straight up from the middle), 46° above the sun, red at its foot, toward the sun, fading at its ends
  if (!pale && e > 0 && e < 32) {
    const zx = o.w / 2, zy = cy - (90 - e) * deg, rr = (90 - e - 46) * deg, s2 = Math.sin(Math.PI * Math.min(1, e / 32)) * 0.75 * A;
    const gr = g.createRadialGradient(zx, zy, Math.max(0, rr - 2.2 * deg), zx, zy, rr + 0.4 * deg);
    [[0, 120, 90, 255, 0], [0.25, 110, 100, 255, 0.5], [0.45, 70, 170, 255, 0.6], [0.6, 80, 230, 150, 0.6], [0.75, 255, 225, 80, 0.65], [0.88, 255, 120, 50, 0.6], [0.97, 255, 50, 40, 0.5], [1, 255, 50, 40, 0]]
      .forEach(([s, r, gg, bb, a]) => gr.addColorStop(s, `rgba(${r},${gg},${bb},${(a * s2).toFixed(3)})`));
    const az = Math.atan2(cy - zy, cx - zx);
    g.save(); g.strokeStyle = gr; g.lineWidth = 2.6 * deg;
    for (let i = 0; i < 24; i++) { const a0 = az - 0.55 + i * 0.046; g.globalAlpha = Math.sin(Math.PI * (i + 0.5) / 24); g.beginPath(); g.arc(zx, zy, rr - 0.9 * deg, a0, a0 + 0.047); g.stroke(); }
    g.restore();
  }
}

function comet(g, c, deg) {
  const { x: hx, y: hy, tx: dx, ty: dy, show: A } = c, nx = -dy, ny = dx, s = deg / 8.3;
  for (let i = 0; i < 70; i++) { // the dust tail: broad, curving behind its path, fading
    const f = i / 70, L = 170 * s * f, curve = 26 * s * f * f, w = (2 + 22 * f) * s, x = hx + dx * L + nx * curve, y = hy + dy * L + ny * curve;
    const gr = g.createRadialGradient(x, y, 0, x, y, w);
    gr.addColorStop(0, `rgba(255,244,220,${(0.06 * A * (1 - f) ** 1.3).toFixed(3)})`); gr.addColorStop(1, "rgba(255,244,220,0)");
    g.fillStyle = gr; g.fillRect(x - w, y - w, 2 * w, 2 * w);
  }
  for (let i = 0; i < 60; i++) { // the ion tail: straight away from the sun, narrow, blue
    const f = i / 60, L = 230 * s * f, w = (1.5 + 4 * f) * s, x = hx + dx * L - nx * 4 * s * f, y = hy + dy * L - ny * 4 * s * f;
    const gr = g.createRadialGradient(x, y, 0, x, y, w);
    gr.addColorStop(0, `rgba(140,180,255,${(0.05 * A * (1 - f)).toFixed(3)})`); gr.addColorStop(1, "rgba(140,180,255,0)");
    g.fillStyle = gr; g.fillRect(x - w, y - w, 2 * w, 2 * w);
  }
  const R = 14 * s, co = g.createRadialGradient(hx, hy, 0, hx, hy, R); // the coma and its nucleus
  co.addColorStop(0, `rgba(240,255,245,${(0.95 * A).toFixed(3)})`); co.addColorStop(0.12, `rgba(190,255,215,${(0.55 * A).toFixed(3)})`);
  co.addColorStop(0.45, `rgba(120,230,170,${(0.14 * A).toFixed(3)})`); co.addColorStop(1, "rgba(120,230,170,0)");
  g.fillStyle = co; g.fillRect(hx - R, hy - R, 2 * R, 2 * R);
}
