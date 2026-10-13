// Fantasy Land's lake and Alex's stream, on two canvases (main.js): the lake's, behind his rock, and the stream's, in
// front of it. Shared by stream-worker.js and main.js's fallback; no DOM.
// The lake: still water with a slow, faint swell, mirroring the rainbow about the horizon and his rock and the stream
// about the water under them, more at a grazing angle, far off, than near. Ripples spread from where the water lands
// across the whole lake, bending what's mirrored as they pass. Drawn by lake-gl.js where WebGL is there; else row by row
// here, each row shifted by the swell, with ripples only near where it lands.
// The stream: water from his chest funnel while he's pressed, none otherwise, as from a hose: thrown up and pulled down
// by gravity, slowed across by the air, so it comes down more steeply than it rose, landing in front of his rock, toward
// us and the middle. A clear jet that holds together for as long as water does (about 0.7s), swelling and pinching
// before it breaks into drops, a little sooner or later each moment, that splash where they land. Its pressure rises
// while he's held and it rises and reaches with it. Each bit of water keeps the arc it left on, so a change runs out
// along the stream. It's clear: it tints what's behind it a little, its edges and highlights take the light around it
// (the rainbow's colours where it passes under it, the sky's lavender, the lake's blue underneath).
import { glLake } from "./lake-gl.js";

const FPS = 30, CALM = 15; // drawn while there's water in the air or ripples spreading; the lake alone, slower (it moves slowly)
const RATE = 230; // drops a second
const UP = 2.2, DOWN = 1.5; // how fast the pressure rises while pressed, and falls when let go (a second)
const ON = 8, OFF = 5; // how fast the flow turns on when he's pressed, and off when he's let go (a second)
const M = 4; // px of rainbow either side of the lake, so the waves never shift an edge in
// The rainbow, as styles.css draws it (--bow on .fz-foot, .fz-bow at 60%): its stops as fractions of its radius
// (three quarters of the footer's width, at its foot 4px up), each [stop, r, g, b, a]
const BOW = [[0.46, 255, 240, 255, 0], [0.58, 255, 240, 255, 0.07], [0.61, 170, 110, 255, 0], [0.63, 170, 110, 255, 0.5], [0.65, 110, 100, 255, 0.5],
  [0.67, 80, 150, 255, 0.55], [0.69, 90, 230, 150, 0.55], [0.71, 255, 230, 90, 0.6], [0.735, 255, 160, 70, 0.55], [0.76, 255, 70, 110, 0.5],
  [0.785, 255, 70, 110, 0], [0.84, 170, 110, 255, 0], [0.86, 170, 110, 255, 0.18], [0.88, 110, 100, 255, 0.18], [0.9, 80, 150, 255, 0.2],
  [0.92, 90, 230, 150, 0.22], [0.94, 255, 230, 90, 0.24], [0.96, 255, 160, 70, 0.22], [0.98, 255, 70, 110, 0.2], [1, 255, 70, 110, 0]];
const SKY = [214, 204, 255]; // the light from the dream's sky, lavender
const RIPPLE = 0.3, RIPPLES = 16, AGE = 5.6; // a ripple every 0.3s where it lands, as many at once, each spreading so long (the GPU's)
const HOLD = 0.72; // seconds a jet of water holds together before it breaks into drops
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
const canvas2 = (w, h) => (globalThis.OffscreenCanvas ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }));

export function streamer(jet, lake, bg = {}) {
  const x = jet.getContext("2d"), gpu = glLake(lake), y = gpu ? null : lake.getContext("2d");
  let g = null, k = 1, p = 0, want = 0, flow = 0, id = 0, last = 0, owed = 0, still = false, run = false, lastRing = 0;
  let nodes = [], drops = [], bits = [], rings = [], rock = null, rockMir = null, bowS = null, glint = null, jetMir = null, jetBand = null, skyBand = null, wet = false;
  let DX = null, DY = null, RF = null, SH = null, GX = null, RX0 = null, RX1 = null, ROX = null, ROY = null;
  const ease = (t) => t * t * (3 - 2 * t);
  // Where it lands at a pressure (0 to 1): just in front of his rock's foot, and as it rises toward us and the middle
  const land = (e) => [g.sx - 70 + (g.cx - Math.min(0.2 * g.W, 110) - (g.sx - 70)) * e, g.wy + 6 + 10 * e];
  // The arc at a pressure at s (0 leaving the spout, 1 at the water, in time): up from the hose and down under gravity (a
  // parabola in time, rising h above the spout), slowed across by the air (so it falls more steeply than it rose)
  function at(e, s) {
    const [lx, ly] = land(e), h = 14 + 50 * e, D = ly - g.sy, a = 2 * h + 2 * Math.sqrt(h * h + h * D), DRAG = 1.4;
    return [g.sx + ((lx - g.sx) * (1 - Math.exp(-DRAG * s))) / (1 - Math.exp(-DRAG)), g.sy - a * s + (a + D) * s * s];
  }
  const span = (e) => 0.75 + 0.85 * e; // seconds from the spout to the water
  // Where it breaks into drops: when it's held together HOLD seconds, a little sooner or later each moment
  const breakAt = (e) => Math.max(0.42, Math.min(0.88, HOLD / span(e) + (Math.random() - 0.5) * 0.1));
  // Water leaving the spout: a node of the jet each frame (its width as the flow was), and drops, hidden in the jet until
  // it breaks
  const drop = (t0, e, b) => ({ t0, e, b, T: span(e) * (1 + (Math.random() - 0.5) * 0.04), off: (Math.random() + Math.random() + Math.random() - 1.5) * 1.15, r: 0.55 + Math.random() * 0.8, hide: Math.random() < 0.72 });
  function emit(t, n) {
    const e = ease(p), b = breakAt(e);
    if (flow > 0.01) nodes.push({ t0: t, e, w: flow, T: span(e), b });
    for (let i = 0; i < n; i++) drops.push(drop(t - Math.random() / FPS, e, b + (Math.random() - 0.5) * 0.04));
  }
  function splash([px, py], t) {
    if (Math.random() < 0.45) bits.push({ x: px + (Math.random() - 0.5) * 3, y: py - 1, vx: (Math.random() - 0.5) * 40, vy: -(18 + Math.random() * 42), t0: t, r: 0.3 + Math.random() * 0.4 });
    if (t - lastRing > RIPPLE) { lastRing = t; rings.push({ x: px, y: py, t0: t }); }
  }
  // The light around the stream: under the rainbow its colours, lightened, else the sky's; and below, toward the water,
  // the lake's blue (a gradient over the stream's canvas, round the rainbow's centre)
  function lights() {
    const { cx, cy } = g, R0 = g.R0;
    const hi = x.createRadialGradient(cx, cy, 0, cx, cy, R0), edge = x.createRadialGradient(cx, cy, 0, cx, cy, R0);
    // the bow's colour at a radius, its light spread a little either side (it lights what's near it)
    const at = (s0) => { let w = 0, c = [0, 0, 0]; for (const [s, r, gg, b, a] of BOW) { const f = a * Math.exp(-(((s - s0) / 0.06) ** 2)); w += f; c = c.map((v, i) => v + [r, gg, b][i] * f); } return [w ? c.map((v) => v / w) : SKY, Math.min(1, w * 0.9)]; };
    for (let s = 0; s <= 1.0001; s += 0.02) {
      const [col, a] = at(s), c = mix(SKY, mix(col, [255, 255, 255], 0.3), a);
      hi.addColorStop(Math.min(1, s), rgba(c, 0.85)); edge.addColorStop(Math.min(1, s), rgba(c, 0.3));
    }
    g.hi = hi; g.edge = edge;
    const body = x.createLinearGradient(0, 0, 0, g.wy);
    body.addColorStop(0, "rgba(196,182,255,.24)"); body.addColorStop(0.6, "rgba(160,150,235,.22)"); body.addColorStop(1, "rgba(100,150,205,.28)");
    g.body = body;
    const under = x.createLinearGradient(0, 0, 0, g.wy);
    under.addColorStop(0, "rgba(120,100,200,.3)"); under.addColorStop(1, "rgba(70,150,190,.45)");
    g.under = under;
  }
  function drawJet(t) {
    const W = g.W, H = g.H;
    x.setTransform(k, 0, 0, k, 0, 0);
    x.clearRect(0, 0, W, H);
    // The jet: from the spout (while it flows) through its nodes to where it breaks, as a clear column with an outline
    // in the light around it, a bright streak along its top and the lake's blue underneath; swelling and pinching
    // toward the break
    nodes = nodes.filter((n) => (t - n.t0) / n.T < n.b + 0.02);
    const pts = [];
    if (flow > 0.01) pts.push([g.sx, g.sy, (2.8 + 1.2 * ease(p)) * flow, 0]);
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i], s0 = (t - n.t0) / n.T, s = Math.min(s0, n.b), f = s / n.b;
      const [px, py] = at(n.e, s), w = (3 + 1.2 * n.e) * n.w * (1 - 0.25 * f) * (1 + 0.3 * f ** 3 * Math.sin(s * 90 - t * 30));
      pts.push([px, py, Math.max(0.3, w), f]);
      if (s0 >= n.b) break; // broken from here on
    }
    if (pts.length > 1) {
      const L = [], R = [], T = [], C = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], [px, py, w] = pts[i];
        let tx = b[0] - a[0], ty = b[1] - a[1]; const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
        let nx = -ty, ny = tx; if (ny > 0) { nx = -nx; ny = -ny; } // the side facing up, toward the sky
        L.push(px + nx * w / 2, py + ny * w / 2); R.push(px - nx * w / 2, py - ny * w / 2);
        T.push(px + nx * w * 0.16, py + ny * w * 0.16); C.push(px + nx * w * 0.05, py + ny * w * 0.05);
      }
      const line = (v) => { x.beginPath(); x.moveTo(v[0], v[1]); for (let j = 2; j < v.length; j += 2) x.lineTo(v[j], v[j + 1]); };
      x.lineCap = "round"; x.lineJoin = "round";
      x.beginPath(); x.moveTo(L[0], L[1]);
      for (let j = 2; j < L.length; j += 2) x.lineTo(L[j], L[j + 1]);
      for (let j = R.length - 2; j >= 0; j -= 2) x.lineTo(R[j], R[j + 1]);
      x.closePath(); x.fillStyle = g.body; x.fill();
      line(R); x.lineWidth = 0.5; x.strokeStyle = g.under; x.stroke(); // the lake's blue caught underneath
      line(C); x.lineWidth = 1.6; x.strokeStyle = g.edge; x.stroke(); // light through it
      line(T); x.lineWidth = 0.7; x.strokeStyle = g.hi; x.stroke(); // the sky's and rainbow's light on its top
    }
    // The drops, once it's broken: each a short bead along its way, lit like the jet
    x.beginPath();
    drops = drops.filter((d) => {
      const s = (t - d.t0) / d.T, sb = d.b;
      if (s >= 1) { splash(at(d.e, 1), t); return false; }
      if (s < sb - 0.01) return true;
      const [ax, ay] = at(d.e, s), [bx, by] = at(d.e, Math.min(1, s + 0.02));
      let tx = bx - ax, ty = by - ay; const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
      if (d.hide) return true; // the jet's water is in fewer, bigger drops than it's made of
      const o = d.off * (0.15 + 6 * (s - sb)), px = ax - ty * o, py = ay + tx * o, rr = d.r * 0.9;
      x.moveTo(px + tx * rr * 1.6, py + ty * rr * 1.6); x.ellipse(px, py, rr * 1.6, rr, Math.atan2(ty, tx), 0, Math.PI * 2);
      return true;
    });
    x.fillStyle = g.hi; x.fill();
    // Splashes thrown up where it lands, falling back
    x.beginPath();
    bits = bits.filter((b) => {
      const a = t - b.t0, bx = b.x + b.vx * a, by = b.y + b.vy * a + 0.5 * 320 * a * a;
      if (by > b.y + 2) return false;
      x.moveTo(bx + b.r, by); x.arc(bx, by, b.r, 0, Math.PI * 2);
      return true;
    });
    x.fillStyle = g.edge; x.fill();
    wet = nodes.length > 0 || drops.length > 0 || bits.length > 0;
  }
  // The lake on the GPU (lake-gl.js): the stream just above the water handed over while there's any, and the ripples as
  // where each began on the lake's plane (its perspective: a point's distance is LH over its height below the horizon,
  // and across, its offset over F at that distance), its age and strength
  function drawLake(t) {
    if (!gpu) return lake2D(t);
    if (!lake.width || !lake.height) return;
    rings = rings.filter((r) => t - r.t0 < AGE).slice(-RIPPLES);
    const R = new Float32Array(RIPPLES * 4), F = g.LH / 0.4;
    rings.forEach((r, i) => { const Z = g.LH / (r.y - g.ly + 0.8); R.set([((r.x - g.cx) * Z) / F, Z, t - r.t0, 1], i * 4); });
    if (wet) {
      const c = jetBand.getContext("2d");
      c.clearRect(0, 0, jetBand.width, jetBand.height);
      c.drawImage(jet, 0, (g.ly + g.band[0]) * k, jetBand.width, jetBand.height, 0, 0, jetBand.width, jetBand.height);
      gpu.tex("tJet", jetBand);
    }
    const [lx, lyy] = land(ease(p)), sky = mirrorSky();
    gpu.draw({ uHasSky: sky ? 1 : 0, uSize: [lake.width, lake.height], uBowSize: [g.W + 2 * M, g.LH + 4], uK: k, uLH: g.LH, uCx: g.cx, uF: F, uT: t % 1000, uWl: g.wy - g.ly, uM: M,
      uHasRock: rock ? 1 : 0, uHasJet: wet ? 1 : 0, uRock: [g.rock.x, g.rock.y - g.ly, g.rock.w, g.rock.h], uAxis: [g.sx, g.wy - g.ly, lx, lyy - g.ly],
      uJet: [g.band[0], g.band[1] - g.band[0], 0, 0], uRings: R, uN: rings.length });
  }
  // The background effects just above the lake on the screen (they're fixed to it), for the lake to mirror: from the
  // horizon up as far as its reflection reaches down, across the lake's width, their light added together
  function mirrorSky() {
    const v = bg.view, on = bg.night?.on(), srcs = [on?.stars && bg.stars, on?.aurora && bg.aurora, bg.fallOn && bg.fall].filter(Boolean);
    if (!v || !srcs.length) return false;
    const c = skyBand.getContext("2d"), top = v.top - g.LH - 4;
    c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, skyBand.width, skyBand.height);
    c.globalCompositeOperation = "lighter";
    for (const src of srcs) { const r = src.width / v.vw; c.drawImage(src, v.left * r, top * r, g.W * r, (g.LH + 4) * r, 0, 0, skyBand.width, skyBand.height); }
    gpu.tex("tSky", skyBand);
    return true;
  }
  // The lake without the GPU, from the horizon (0) down: the waves for each row of pixels, then what it mirrors, then its
  // glints and ripples (only near where it lands)
  function lake2D(t) {
    const Wd = lake.width, Hd = lake.height, LH = g.LH, wl = g.wy - g.ly;
    if (!Wd || !Hd) return;
    for (let r = 0; r < Hd; r++) {
      const yy = (r + 0.5) / k, s = Math.min(1, (yy + 0.8) / LH), d = 1 / s;
      const p1 = d * 2.1 + t * 1.1, p2 = d * 3.7 - t * 0.8 + 1.7, p3 = d * 5.3 + t * 1.7, p4 = d * 11.3 - t * 2.3;
      DX[r] = 1.4 * s ** 1.2 * (Math.sin(p1) + 0.5 * Math.sin(p2) + 0.25 * Math.sin(p4 * 1.3)) * k;
      DY[r] = s * (1.5 * Math.cos(p1) + 1.2 * Math.cos(p3) + 1.1 * Math.cos(p4)) * k; // the swell, and a finer chop that bands it
      RF[r] = 0.85 - 0.5 * s; // mirrors more at a grazing angle
      SH[r] = Math.max(0, Math.sin(d * 4.4 + t * 1.3 + 0.5 * Math.sin(d * 1.7 - t))) ** 4 * (0.1 + 0.25 * (1 - s));
      GX[r] = ((r * 37.3 + t * (6 + 9 * s)) % (glint.width - Wd - 1) + glint.width - Wd - 1) % (glint.width - Wd - 1);
    }
    // Where a ripple crosses a row, what's mirrored inside it is shifted (the strongest ripple on each row)
    RX1.fill(0);
    rings = rings.filter((g2) => (t - g2.t0) / 1.2 < 1);
    for (const g2 of rings) {
      const a = (t - g2.t0) / 1.2, rx = 2 + 20 * a, ry = rx * 0.22, amp = 1.3 * (1 - a) * k, ry0 = g2.y - g.ly;
      for (let r = Math.max(0, Math.floor((ry0 - ry) * k)); r <= Math.min(Hd - 1, Math.ceil((ry0 + ry) * k)); r++) {
        const v = (r / k - ry0) / ry, c = rx * Math.sqrt(Math.max(0, 1 - v * v)) * k;
        if (c < 1 || (RX1[r] && Math.abs(ROX[r]) + Math.abs(ROY[r]) > amp)) continue;
        RX0[r] = g2.x * k - c; RX1[r] = g2.x * k + c; ROX[r] = amp * Math.sin(v * 3); ROY[r] = (v > 0 ? 0.5 : -0.5) * amp;
      }
    }
    y.setTransform(1, 0, 0, 1, 0, 0);
    y.globalAlpha = 1; y.globalCompositeOperation = "source-over";
    y.clearRect(0, 0, Wd, Hd);
    // The rainbow, mirrored about the horizon (its light added to the water's)
    y.globalCompositeOperation = "lighter";
    const bm = bowS.height - 2;
    for (let r = 0; r < Hd; r++) {
      y.globalAlpha = RF[r] * 0.6;
      strip(bowS, M * k - DX[r], Math.max(0, Math.min(bm, r + DY[r])), Wd, 0, r, bm);
    }
    // Glints of the sky on the swell, scattered, more toward the horizon
    for (let r = 0; r < Hd; r++) {
      if (SH[r] < 0.01) continue;
      y.globalAlpha = SH[r];
      y.drawImage(glint, GX[r], r % glint.height, Wd, 1, 0, r, Wd, 1);
    }
    // His rock and the stream, mirrored about the waterline, darker for the water
    y.globalCompositeOperation = "source-over";
    const r0 = Math.ceil(wl * k);
    if (rockMir) {
      const { x: rx, w: rw } = g.rock, rh = rockMir.height - 2;
      for (let r = r0; r < Hd; r++) {
        y.globalAlpha = RF[r] * 0.62;
        y.drawImage(rockMir, 0, Math.max(0, Math.min(rh, r - r0 + DY[r])), rockMir.width, 1, rx * k + DX[r], r, rw * k, 1);
      }
    }
    if (wet) {
      // (the stream just above the water, flipped, copied once: rows read from the canvas it's drawn on cost a copy each)
      const jc = jetMir.getContext("2d"), jm = jetMir.height - 2;
      jc.setTransform(1, 0, 0, 1, 0, 0); jc.clearRect(0, 0, Wd, jetMir.height);
      const band = Math.min(jetMir.height, g.wy * k);
      jc.setTransform(1, 0, 0, -1, 0, g.wy * k); jc.drawImage(jet, 0, g.wy * k - band, Wd, band, 0, g.wy * k - band, Wd, band);
      for (let r = r0; r < Hd; r++) {
        y.globalAlpha = RF[r] * 0.8;
        strip(jetMir, 0, Math.max(0, Math.min(jm, r - r0 + DY[r])), Wd, DX[r], r, jm);
      }
    }
    // Ripples where it lands, each a crest catching the sky and a trough behind it
    y.globalAlpha = 1;
    y.setTransform(k, 0, 0, k, 0, 0);
    for (const g2 of rings) {
      const a = (t - g2.t0) / 1.2, rx = 2 + 20 * a, ry = rx * 0.22, ry0 = g2.y - g.ly;
      y.lineWidth = 0.7;
      y.beginPath(); y.ellipse(g2.x, ry0, rx, ry, 0, Math.PI, Math.PI * 2); y.strokeStyle = rgba(SKY, 0.22 * (1 - a)); y.stroke();
      y.beginPath(); y.ellipse(g2.x, ry0 + 0.6, rx, ry, 0, 0, Math.PI); y.strokeStyle = `rgba(4,6,20,${(0.28 * (1 - a)).toFixed(3)})`; y.stroke();
      if (a > 0.25) { const ri = rx * 0.6; y.beginPath(); y.ellipse(g2.x, ry0, ri, ri * 0.22, 0, Math.PI, Math.PI * 2); y.strokeStyle = rgba(SKY, 0.18 * (1 - a)); y.stroke(); }
    }
    y.setTransform(1, 0, 0, 1, 0, 0);
  }
  // One row of something mirrored: from src's row sy (sw device px from sx) to the lake's row r at dx; the part inside a
  // ripple shifted further, in up to three pieces
  function strip(src, sx, sy, sw, dx, r, maxY) {
    const a = Math.max(dx, RX0[r]), b = Math.min(dx + sw, RX1[r]);
    if (!RX1[r] || b <= a) { y.drawImage(src, sx, sy, sw, 1, dx, r, sw, 1); return; }
    if (a > dx) y.drawImage(src, sx, sy, a - dx, 1, dx, r, a - dx, 1);
    y.drawImage(src, sx + (a - dx) - ROX[r], Math.max(0, Math.min(maxY, sy + ROY[r])), b - a, 1, a, r, b - a, 1);
    if (b < dx + sw) y.drawImage(src, sx + (b - dx), sy, dx + sw - b, 1, b, r, dx + sw - b, 1);
  }
  // The rainbow above the horizon, as it's mirrored: row r of it is the bow r px up from the horizon (device px, and M px
  // more each side)
  function bowStrip() {
    const Wd = lake.width, Hd = lake.height, w = Wd + 2 * M * k;
    bowS = canvas2(w, Hd + 4 * k);
    const c = bowS.getContext("2d"), { cx, cy, R0, ly } = g;
    c.setTransform(k, 0, 0, -k, M * k, ly * k); // jet coords → the strip, flipped about the horizon
    const gr = c.createRadialGradient(cx, cy, 0, cx, cy, R0);
    for (const [s, r, gg, b, a] of BOW) gr.addColorStop(s, rgba([r, gg, b], a));
    c.fillStyle = gr; c.fillRect(-M, ly - LHpad(), g.W + 2 * M, LHpad());
    // and faded toward its feet, as its mask does (transparent 4% of its height up, 35% at 26%, whole at 72%)
    const fade = c.createLinearGradient(0, cy, 0, cy - R0);
    fade.addColorStop(0.04, "rgba(0,0,0,0)"); fade.addColorStop(0.26, "rgba(0,0,0,.35)"); fade.addColorStop(0.72, "#000");
    c.globalCompositeOperation = "destination-in"; c.fillStyle = fade; c.fillRect(-M, ly - LHpad(), g.W + 2 * M, LHpad());
  }
  const LHpad = () => g.LH + 4;
  // The glints: short, soft flecks of the sky's light, sparse, on a strip wider than the lake to slide them across it
  function glints() {
    const Wd = lake.width, w = Wd + 400 * k, h = 32;
    glint = canvas2(w, h);
    const c = glint.getContext("2d");
    for (let i = 0; i < (w * h) / (260 * k); i++) {
      const gx = Math.random() * w, gy = Math.floor(Math.random() * h), l = (0.6 + Math.random() * 1.6) * k;
      const gr = c.createLinearGradient(gx - l, 0, gx + l, 0);
      gr.addColorStop(0, rgba(SKY, 0)); gr.addColorStop(0.5, rgba(SKY, 0.5 + Math.random() * 0.5)); gr.addColorStop(1, rgba(SKY, 0));
      c.fillStyle = gr; c.fillRect(gx - l, gy, 2 * l, 1);
    }
  }
  // His rock, upside down, for its reflection: row 0 its foot
  function rockStrip() {
    if (!rock || !g) return;
    const { w, h } = g.rock;
    rockMir = canvas2(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    const c = rockMir.getContext("2d");
    c.setTransform(1, 0, 0, -1, 0, rockMir.height);
    c.drawImage(rock, 0, 0, rockMir.width, rockMir.height);
  }
  // Still: the lake as it is at one moment, and the stream at its fullest while he's pressed; nothing else moves
  function stillFrame() {
    const t = 10;
    nodes = []; drops = []; bits = []; rings = [];
    flow = want; p = want;
    if (want) {
      const e = ease(p), T = span(e), sb = HOLD / T;
      for (let i = 60; i >= 0; i--) nodes.push({ t0: t - (i / 60) * T * sb, e, w: 1, T, b: sb }); // oldest first, as they're made
      for (let i = 0; i < 220; i++) { const d = drop(t, e, sb); d.t0 = t - (sb + Math.random() * (1 - sb)) * d.T; drops.push(d); }
    }
    drawJet(t);
    drawLake(t);
    nodes = []; drops = []; bits = []; rings = [];
  }
  const raf = globalThis.requestAnimationFrame ? (f) => requestAnimationFrame(f) : (f) => setTimeout(() => f(performance.now()), 16);
  const unraf = globalThis.cancelAnimationFrame ?? clearTimeout;
  function step(now) {
    id = raf(step);
    const water = want || flow || wet || (gpu && rings.length);
    if (last && now - last < 1000 / (water ? FPS : CALM) - 3) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / FPS;
    last = now;
    p += (want - p) * Math.min(1, (want > p ? UP : DOWN) * dt);
    flow = want ? Math.min(1, flow + ON * dt) : Math.max(0, flow - OFF * dt);
    if (!want && !flow && !wet) p = 0;
    owed += RATE * (1 + 0.6 * p) * flow * dt;
    const n = Math.floor(owed); owed -= n;
    const t = now / 1000;
    emit(t, n);
    if (want || flow || wet) drawJet(t);
    drawLake(t);
  }
  const ready = () => g && bowS;
  return {
    // The canvases' sizes and the places in them (CSS px, the stream's canvas; the lake's begins ly down it): the spout,
    // the water, the rainbow's centre and radius, his rock
    geom(m) {
      g = { ...m };
      g.R0 = 0.75 * g.W;
      g.ly = g.H - g.LH;
      k = m.res;
      jet.width = Math.round(g.W * k); jet.height = Math.round(g.H * k);
      lake.width = Math.round(g.W * k); lake.height = Math.round(g.LH * k);
      lights(); bowStrip();
      if (gpu) {
        // the stream that's mirrored: from as far above the water as its reflection reaches down, to where it lands
        const wl = g.wy - g.ly;
        g.band = [Math.floor(2 * wl - g.LH - 3), Math.ceil(land(1)[1] - g.ly + 3)];
        jetBand = canvas2(jet.width, Math.ceil((g.band[1] - g.band[0]) * k));
        skyBand = canvas2(lake.width, Math.ceil((g.LH + 4) * k));
        gpu.tex("tBow", bowS);
        if (rock) gpu.tex("tRock", rock);
      } else {
        [DX, DY, RF, SH, GX, RX0, RX1, ROX, ROY] = Array.from({ length: 9 }, () => new Float32Array(lake.height));
        glints(); rockStrip();
        jetMir = canvas2(lake.width, Math.ceil((g.LH - (g.wy - g.ly) + 6) * k));
      }
      wet = false;
      still = m.still;
      if (still) stillFrame();
    },
    // His picture (an ImageBitmap in the worker), for his reflection
    rock(img) { rock = img; if (gpu) gpu.tex("tRock", img); else rockStrip(); if (still && ready()) stillFrame(); },
    press(on) { want = on ? 1 : 0; if (still) { if (ready()) stillFrame(); } else if (run && !id && ready()) { last = 0; id = raf(step); } },
    // Not landing all that was in the air when it stopped
    start() { run = true; if (!still && !id && ready()) { last = 0; nodes = []; drops = []; bits = []; rings = []; wet = false; flow = want; id = raf(step); } },
    stop() { run = false; unraf(id); id = 0; },
  };
}
