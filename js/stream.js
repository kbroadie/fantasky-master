// Fantasy Land's lake and Alex's stream, on two canvases (main.js): the lake's, behind his rock, and the stream's, in
// front of it. Shared by stream-worker.js and main.js's fallback; no DOM.
// The lake: still water with a slow, faint swell, mirroring the rainbow about the horizon and his rock and the stream
// about the water under them, more at a grazing angle, far off, than near. Ripples spread from where the water lands
// across the whole lake, bending what's mirrored as they pass. Drawn by lake-gl.js where WebGL is there; else row by row
// here, each row shifted by the swell, with ripples only near where it lands.
// The stream (on request: "Refine the fluid physics of the water stream and how it breaks apart from gravity and air
// resistance", "Add realistic splashes when the water from the stream hits the lake"): water from his chest funnel while
// he's pressed, as from a hose. Each slice of water leaves the spout on its own ballistic path under gravity, slowed by
// the air (linear drag), aimed to land in front of his rock, toward us and the middle, further and higher as the pressure
// rises; each keeps the path it left on, so a change runs out along the stream. The jet thins as it speeds up falling
// (the same water through a narrower column) and holds together until the Rayleigh-Plateau instability pinches it into
// drops: ripples carried along it (a wavelength about nine times its radius) swell until the column breaks, a main drop
// a wavelength and a satellite between, sooner at a higher pressure, when the air also shakes it sideways and strips fine
// spray from it. Once free, each drop is slowed by the air the more the smaller it is, so the spray lags, falls short
// and steeper, and the stream fans out. Where water lands: a crown splash (a ring wall thrown up and out, its rim
// shedding droplets that arc and fall), then for the larger drops the Worthington jet (a column rising from the
// collapsing crater, its top pinching off a drop), foam that spreads and fades, and ripples across the lake. It's clear:
// it tints what's behind it a little, its edges and highlights in the light around it (the sky's lavender, the lake's
// blue underneath).
import { glLake } from "./lake-gl.js";

const FPS = 30, CALM = 15; // drawn while there's water in the air or ripples spreading; the lake alone, slower (it moves slowly)
const UP = 2.2, DOWN = 1.5; // how fast the pressure rises while pressed, and falls when let go (a second)
const ON = 8, OFF = 5; // how fast the flow turns on when he's pressed, and off when he's let go (a second)
const M = 4; // px of sky either side of the lake, so the waves never shift an edge in
const SKY = [214, 204, 255]; // the light from the dream's sky, lavender
const RIPPLE = 0.3, RIPPLES = 16, AGE = 5.6; // a ripple every 0.3s where it lands, as many at once, each spreading so long (the GPU's)
const G = 800; // gravity, px/s² (his picture's 124px are about 1.5m)
const KJ = 0.15; // the air's drag on the jet (1/s); a drop's is more, the smaller it is
const Q = 120; // slices of water a second, to resolve the ripples along the jet
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
const canvas2 = (w, h) => (globalThis.OffscreenCanvas ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }));
const rnd = (a, b) => a + Math.random() * (b - a);

export function streamer(jet, lake, bg = {}) {
  const x = jet.getContext("2d"), gpu = glLake(lake), y = gpu ? null : lake.getContext("2d");
  let g = null, k = 1, p = 0, want = 0, flow = 0, id = 0, last = 0, owed = 0, still = false, run = false, lastRing = 0;
  let slices = [], drops = [], crowns = [], beads = [], cols = [], foam = [], rings = [], rock = null, rockMir = null, bowS = null, glit = null, glint = null, jetMir = null, jetBand = null, skyBand = null, wet = false;
  let lastMain = -1, lastSat = -1, jit = 0;
  let DX = null, DY = null, RF = null, SH = null, GX = null, RX0 = null, RX1 = null, ROX = null, ROY = null;
  const ease = (t) => t * t * (3 - 2 * t);
  // Where it lands at a pressure (0 to 1): just in front of his rock's foot, and as it rises toward us and the middle
  const land = (e) => [g.sx - 70 + (g.cx - Math.min(0.2 * g.W, 110) - (g.sx - 70)) * e, g.wy + 6 + 10 * e];
  // The water's surface along the throw: further along it, nearer us, so lower on the screen
  const water = (px) => {
    const [x0, y0] = land(0), [x1, y1] = land(1), f = Math.max(-0.4, Math.min(1.4, (px - x0) / (x1 - x0 || 1)));
    return y0 + (y1 - y0) * f;
  };
  // A slice's path at a pressure: up from the spout and down under gravity, slowed by the air (drag k), rising h above the
  // spout and landing at land(e) after T seconds (solved once a pressure)
  const paths = new Map();
  function path(e) {
    const key = Math.round(e * 100);
    let q = paths.get(key);
    if (q) return q;
    e = key / 100;
    const [lx, ly] = land(e), D = ly - g.sy, h = 14 + 50 * e, kk = KJ;
    const w0 = Math.sqrt(2 * G * h) * (1 + 0.5 * kk * Math.sqrt((2 * h) / G));
    const z = (t) => ((w0 + G / kk) * (1 - Math.exp(-kk * t))) / kk - (G / kk) * t;
    let T = (w0 + Math.sqrt(w0 * w0 + 2 * G * D)) / G;
    for (let i = 0; i < 6; i++) T -= (z(T) + D) / ((w0 + G / kk) * Math.exp(-kk * T) - G / kk);
    q = { e, w0, vx: ((lx - g.sx) * kk) / (1 - Math.exp(-kk * T)), T, v0: Math.hypot(w0, ((lx - g.sx) * kk) / (1 - Math.exp(-kk * T))),
      tb: 0.62 * (1.1 - 0.25 * e), f: 18 + 8 * e }; // how long it holds together, and its ripples' frequency (a second)
    paths.set(key, q);
    return q;
  }
  // A slice's place and velocity at age a (screen px, y down)
  function along(q, a) {
    const E = Math.exp(-KJ * a);
    return [g.sx + (q.vx * (1 - E)) / KJ, g.sy - (((q.w0 + G / KJ) * (1 - E)) / KJ - (G / KJ) * a), q.vx * E, -((q.w0 + G / KJ) * E - G / KJ)];
  }
  // A free drop at time t: from where it broke free (x0, y0, its velocity), slowed by its own drag
  function dropAt(d, t) {
    const a = t - d.t0, E = Math.exp(-d.k * a);
    return [d.x0 + (d.vx * (1 - E)) / d.k, d.y0 + (G / d.k) * a + ((d.vy - G / d.k) * (1 - E)) / d.k, d.vx * E, G / d.k + (d.vy - G / d.k) * E];
  }
  const free = (t0, [px, py, vx, vy], r, spread) => {
    const s = Math.hypot(vx, vy) || 1, n = rnd(-1, 1) * spread;
    drops.push({ t0, x0: px, y0: py, vx: vx * rnd(0.97, 1.03) - (vy / s) * n, vy: vy * rnd(0.97, 1.03) + (vx / s) * n, r, k: KJ + 0.35 / r, dz: rnd(-3, 3), px, py });
  };
  // Water leaving the spout over (t0, t1]: slices, each at the pressure of its moment and the flow's width
  function emit(t0, t1) {
    owed += (t1 - t0) * Q * (flow > 0.01 ? 1 : 0);
    const n = Math.floor(owed);
    owed -= n;
    for (let i = n; i >= 1; i--) {
      const te = t1 - (i - 1) / Q, q = path(ease(p));
      jit = Math.max(-0.12, Math.min(0.12, jit * 0.97 + rnd(-0.02, 0.02))); // where it breaks wanders, a little sooner or later
      slices.push({ t0: te, q, w: (2.6 + 1.2 * q.e) * flow, tb: q.tb * (1 + jit), ph: te * q.f });
    }
  }
  // Each moment: the slices that have broken become drops (a main drop a wavelength, a satellite between), any that reach
  // the water whole land as a column; spray stripped from the jet; the free drops fly and land
  function sim(t) {
    const keep = [];
    for (const sl of slices) {
      const a = t - sl.t0;
      if (a >= sl.q.T && a < sl.tb) { const [px, py, vx, vy] = along(sl.q, sl.q.T); impact(px, py, sl.w / 2, Math.hypot(vx, vy), t); continue; }
      if (a < sl.tb) { keep.push(sl); continue; }
      const st = along(sl.q, sl.tb), m = Math.floor(sl.ph), h = Math.floor(sl.ph + 0.5);
      if (m !== lastMain) { lastMain = m; free(sl.t0 + sl.tb, st, Math.max(0.4, sl.w * 0.4 * rnd(0.85, 1.15)), 6); }
      else if (h !== lastSat) { lastSat = h; free(sl.t0 + sl.tb, st, Math.max(0.25, sl.w * 0.16), 10); }
    }
    slices = keep;
    // The air strips fine spray from a fast jet, more the higher the pressure, from its shaking last half
    const e = ease(p);
    if (flow > 0.01 && e > 0.2) {
      const n = Math.floor(rnd(0, 1) + (60 * e * flow) / FPS);
      for (let i = 0; i < n && slices.length > 4; i++) {
        const sl = slices[Math.floor(rnd(0, slices.length))], a = t - sl.t0;
        if (a > 0.4 * sl.tb) free(t, along(sl.q, a), rnd(0.18, 0.32), 25 + 25 * e);
      }
    }
    drops = drops.filter((d) => {
      const [px, py, vx, vy] = dropAt(d, t), wy = water(px) + d.dz;
      if (py >= wy && vy > 0) { const f = (wy - d.py) / (py - d.py || 1); impact(d.px + (px - d.px) * f, wy, d.r, Math.hypot(vx, vy), t); return false; }
      d.px = px; d.py = py;
      return py < g.H + 20;
    });
    // Droplets from the crowns' rims and the Worthington jets' tops: short ballistic flights, back onto their own patch of
    // water, where they leave a speck of foam
    beads = beads.filter((b) => {
      const a = t - b.t0, z = b.up * a - 0.5 * G * a * a;
      if (z < 0 && a > 0.02) { if (foam.length < 160) foam.push({ x: b.x + b.vx * a, y: b.y + b.vd * a, t0: t, life: rnd(0.25, 0.6), r: rnd(0.3, 0.6), vx: 0 }); return false; }
      return true;
    });
    crowns = crowns.filter((c) => t - c.t0 < c.life);
    cols = cols.filter((c) => t - c.t0 < c.life);
    foam = foam.filter((f) => t - f.t0 < f.life);
    if (drops.length > 400) drops = drops.slice(-400);
    if (beads.length > 300) beads = beads.slice(-300);
  }
  // Water landing (radius r, at speed v): a crown thrown up and out, its rim's droplets, for a larger drop a Worthington
  // jet, foam, and a ripple across the lake
  function impact(px, py, r, v, t) {
    const s = Math.min(1.6, v / 450);
    if (crowns.length < 60) crowns.push({ x: px, y: py, t0: t, r, s, life: 0.09 + 0.07 * r });
    const n = Math.round(2 + 3 * r * s);
    for (let i = 0; i < n && beads.length < 300; i++) {
      const th = rnd(0, 2 * Math.PI), vr = (35 + 55 * s) * rnd(0.6, 1.1) * Math.sqrt(r);
      beads.push({ x: px + Math.cos(th) * r * 1.6, y: py + Math.sin(th) * r * 0.45, t0: t + 0.03, vx: Math.cos(th) * vr, vd: Math.sin(th) * vr * 0.28, up: (45 + 70 * s) * rnd(0.6, 1.15) * Math.sqrt(r), r: rnd(0.22, 0.4) });
    }
    if (r > 0.7 && cols.length < 30) cols.push({ x: px, y: py, t0: t + 0.06 + 0.04 * r, r, h: r * (5 + 7 * s), life: 0.2 + 0.05 * r, shed: false });
    for (let i = 0; i < 2 && foam.length < 160; i++) foam.push({ x: px + rnd(-2, 2) * r, y: py + rnd(-0.4, 0.6) * r, t0: t, life: rnd(0.7, 1.6), r: rnd(0.35, 0.8) * Math.min(1.6, r + 0.3), vx: rnd(-6, 6) });
    if (t - lastRing > RIPPLE) { lastRing = t; rings.push({ x: px, y: py, t0: t }); }
  }
  // The light around the stream: the sky's lavender on its top, and below, toward the water, the lake's blue
  function lights() {
    g.hi = rgba(SKY, 0.85); g.edge = rgba(SKY, 0.3); g.mist = rgba(SKY, 0.5); g.foam = "rgba(232,236,255,.55)";
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
    // The jet: from the spout through the slices still whole, as a clear column with an outline in the light around it,
    // a bright streak along its top and the lake's blue underneath; thinning as it speeds up, and the ripples along it
    // swelling and pinching, and shaking sideways at a high pressure, toward where it breaks
    const pts = [];
    if (flow > 0.01) { const q = path(ease(p)); pts.push([g.sx, g.sy, (2.6 + 1.2 * q.e) * flow, 0, 0]); }
    for (let i = slices.length - 1; i >= 0; i--) {
      const sl = slices[i], a = t - sl.t0, [px, py, vx, vy] = along(sl.q, a), f = a / sl.tb, sp = Math.hypot(vx, vy) || 1;
      const A = 0.55 * Math.exp(6 * (f - 1)), wob = 1.6 * sl.q.e * f * f * Math.sin(2 * Math.PI * (sl.t0 * 3.7) + sl.t0 * 11);
      const w = sl.w * Math.sqrt(sl.q.v0 / sp) * (1 + A * Math.sin(2 * Math.PI * sl.ph));
      pts.push([px - (vy / sp) * wob, py + (vx / sp) * wob, Math.max(0.25, w), f]);
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
      line(T); x.lineWidth = 0.7; x.strokeStyle = g.hi; x.stroke(); // the sky's light on its top
    }
    // The drops: each a bead stretched a little along its way (as a camera's shutter sees it), clear and lit like the jet,
    // the larger with a body and a glint, the spray as bright specks
    const big = new Path2D(), small = new Path2D(), glints = new Path2D();
    for (const d of drops) {
      const [px, py, vx, vy] = dropAt(d, t), sp = Math.hypot(vx, vy) || 1, l = d.r + sp / 220;
      const P = d.r > 0.5 ? big : small;
      P.moveTo(px + (vx / sp) * l, py + (vy / sp) * l); P.ellipse(px, py, l, d.r, Math.atan2(vy, vx), 0, 2 * Math.PI);
      if (d.r > 0.5) { glints.moveTo(px + d.r * 0.4, py - d.r * 0.35); glints.arc(px, py - d.r * 0.35, d.r * 0.4, 0, 2 * Math.PI); }
    }
    x.fillStyle = g.body; x.fill(big); x.fillStyle = g.edge; x.fill(big);
    x.fillStyle = g.hi; x.fill(glints);
    x.fillStyle = g.mist; x.fill(small);
    // The splashes: foam on the water first, then each crown (its wall, a ring seen from above the water, rising and
    // spreading, then falling back), the Worthington jets, and the droplets in flight
    x.beginPath();
    for (const f of foam) {
      const a = (t - f.t0) / f.life, fx = f.x + f.vx * (t - f.t0), rr = f.r * (1 + 0.8 * a);
      x.moveTo(fx + rr, f.y); x.ellipse(fx, f.y, rr, rr * 0.4, 0, 0, 2 * Math.PI);
    }
    x.fillStyle = g.foam; x.globalAlpha = 0.7; x.fill(); x.globalAlpha = 1;
    for (const c of crowns) {
      const a = (t - c.t0) / c.life, R = c.r * (1.3 + 3.2 * Math.sqrt(a)), hc = c.r * (1.4 + 1.4 * c.s) * Math.sin(Math.PI * Math.min(1, a * 1.15)) ** 0.7, ry = R * 0.3;
      x.globalAlpha = 1 - a * a;
      // its wall: the near half, from the water up to its rim
      x.beginPath(); x.ellipse(c.x, c.y, R, ry, 0, 0, Math.PI); x.lineTo(c.x - R, c.y - hc); x.ellipse(c.x, c.y - hc, R, ry, 0, Math.PI, 0, true); x.closePath();
      x.fillStyle = g.body; x.fill();
      // its rim, catching the light
      x.beginPath(); x.ellipse(c.x, c.y - hc, R, ry, 0, Math.PI * 1.05, Math.PI * 1.95); x.lineWidth = Math.min(0.8, 0.3 + 0.25 * c.r); x.strokeStyle = g.hi; x.stroke(); // its far rim, lit
      x.beginPath(); x.ellipse(c.x, c.y - hc, R, ry, 0, 0, Math.PI); x.strokeStyle = g.edge; x.stroke();
    }
    x.globalAlpha = 1;
    for (const c of cols) {
      const a = (t - c.t0) / c.life;
      if (a < 0) continue;
      const hh = c.h * Math.sin(Math.PI * a), w = c.r * 0.7 * (1 - 0.3 * a);
      // its top pinches off as a drop as it peaks
      if (!c.shed && a > 0.45) { c.shed = true; if (beads.length < 300) beads.push({ x: c.x, y: c.y, t0: t - 0.02, vx: rnd(-8, 8), vd: rnd(-1, 1), up: Math.sqrt(2 * G * c.h) * 1.1, r: c.r * 0.45 }); }
      x.beginPath(); x.moveTo(c.x - w, c.y); x.lineTo(c.x - w * 0.6, c.y - hh); x.arc(c.x, c.y - hh, w * 0.6, Math.PI, 0); x.lineTo(c.x + w, c.y); x.closePath();
      x.fillStyle = g.body; x.fill(); x.lineWidth = 0.5; x.strokeStyle = g.hi; x.stroke();
    }
    x.beginPath();
    for (const b of beads) {
      const a = t - b.t0;
      if (a < 0) continue;
      const bx = b.x + b.vx * a, by = b.y + b.vd * a - (b.up * a - 0.5 * G * a * a);
      x.moveTo(bx + b.r, by); x.arc(bx, by, b.r, 0, 2 * Math.PI);
    }
    x.fillStyle = g.hi; x.fill();
    wet = slices.length > 0 || drops.length > 0 || crowns.length > 0 || beads.length > 0 || cols.length > 0 || foam.length > 0;
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
    gpu.draw({ uHasSky: sky ? 1 : 0, uDeg: g.deg ?? 8, uGl: glit ? [glit.x, glit.h, glit.b, glit.r] : [0, 0, 0, 1], uGlC: glit?.col ?? [1, 1, 1], uSize: [lake.width, lake.height], uBowSize: [g.W + 2 * M, g.LH + 4], uK: k, uLH: g.LH, uCx: g.cx, uF: F, uT: t % 1000, uWl: g.wy - g.ly, uM: M,
      uHasRock: rock ? 1 : 0, uHasJet: wet ? 1 : 0, uRock: [g.rock.x, g.rock.y - g.ly, g.rock.w, g.rock.h], uAxis: [g.sx, g.wy - g.ly, lx, lyy - g.ly],
      uJet: [g.band[0], g.band[1] - g.band[0], 0, 0], uRings: R, uN: rings.length });
  }
  // What's just above the lake, for it to mirror, from the horizon up as far as its reflection reaches down, across its
  // width, their light added together: the aurora (in the house's sky, its foot the horizon: g.sky, where it is from the
  // lake) and the fall (fixed to the screen: where the lake is on it, bg.view)
  function mirrorSky() {
    const c = skyBand.getContext("2d"), v = bg.view, a = bg.night?.on() && g.sky?.w && bg.aurora, f = v && bg.fallOn && bg.fall;
    if (!a && !f) return false;
    c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, skyBand.width, skyBand.height);
    c.globalCompositeOperation = "lighter";
    if (a) { const r = a.width / g.sky.w; c.drawImage(a, g.sky.x * r, (g.sky.h - g.LH - 4) * r, g.W * r, (g.LH + 4) * r, 0, 0, skyBand.width, skyBand.height); }
    if (f) { const r = f.width / v.vw; c.drawImage(f, v.left * r, (v.top - g.LH - 4) * r, g.W * r, (g.LH + 4) * r, 0, 0, skyBand.width, skyBand.height); }
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
    // The sky, mirrored about the horizon (its light added to the water's)
    y.globalCompositeOperation = "lighter";
    const bm = (bowS?.height ?? 0) - 2;
    if (bm > 0) for (let r = 0; r < Hd; r++) {
      y.globalAlpha = RF[r] * 0.85;
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
  // Still: the lake as it is at one moment, and the stream as it is after flowing a while at its fullest while he's
  // pressed (the same physics, run on ahead); nothing else moves
  function stillFrame() {
    slices = []; drops = []; crowns = []; beads = []; cols = []; foam = []; rings = [];
    flow = want; p = want; owed = 0;
    let t = 10;
    if (want) for (let i = 0; i < 150; i++) { emit(t, t + 1 / 60); t += 1 / 60; sim(t); }
    drawJet(t);
    drawLake(t);
    slices = []; drops = []; crowns = []; beads = []; cols = []; foam = []; rings = [];
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
    const t = now / 1000;
    emit(t - dt, t);
    sim(t);
    if (want || flow || wet) drawJet(t);
    drawLake(t);
  }
  const ready = () => g;
  return {
    // The canvases' sizes and the places in them (CSS px, the stream's canvas; the lake's begins ly down it): the spout,
    // the water, his rock
    geom(m) {
      g = { ...m };
      g.ly = g.H - g.LH;
      k = m.res;
      jet.width = Math.round(g.W * k); jet.height = Math.round(g.H * k);
      lake.width = Math.round(g.W * k); lake.height = Math.round(g.LH * k);
      lights();
      if (gpu) {
        // the stream that's mirrored: from as far above the water as its reflection reaches down, to where it lands
        const wl = g.wy - g.ly;
        g.band = [Math.floor(2 * wl - g.LH - 3), Math.ceil(land(1)[1] - g.ly + 3)];
        jetBand = canvas2(jet.width, Math.ceil((g.band[1] - g.band[0]) * k));
        skyBand = canvas2(lake.width, Math.ceil((g.LH + 4) * k));
        if (bowS) gpu.tex("tBow", bowS);
        if (rock) gpu.tex("tRock", rock);
      } else {
        [DX, DY, RF, SH, GX, RX0, RX1, ROX, ROY] = Array.from({ length: 9 }, () => new Float32Array(lake.height));
        glints(); rockStrip();
        jetMir = canvas2(lake.width, Math.ceil((g.LH - (g.wy - g.ly) + 6) * k));
      }
      wet = false;
      paths.clear();
      still = m.still;
      if (still) stillFrame();
    },
    // The sky above the horizon as the lake mirrors it (main.js: the house's sky, flipped, its foot first, with the sun or
    // moon; M px more each side), and where the glitter path of whichever is up falls (gl: across, its height above the
    // horizon, its strength, its size and colour)
    sky({ bmp, gl }) { bowS = bmp; glit = gl; if (gpu) gpu.tex("tBow", bmp); if (still && ready()) stillFrame(); },
    // His picture (an ImageBitmap in the worker), for his reflection
    rock(img) { rock = img; if (gpu) gpu.tex("tRock", img); else rockStrip(); if (still && ready()) stillFrame(); },
    press(on) { want = on ? 1 : 0; if (still) { if (ready()) stillFrame(); } else if (run && !id && ready()) { last = 0; id = raf(step); } },
    // Not landing all that was in the air when it stopped
    start() { run = true; if (!still && !id && ready()) { last = 0; slices = []; drops = []; crowns = []; beads = []; cols = []; foam = []; rings = []; wet = false; flow = want; id = raf(step); } },
    stop() { run = false; unraf(id); id = 0; },
  };
}
