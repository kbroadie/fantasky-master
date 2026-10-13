// Alex's stream in Fantasy Land's footer: water from his chest funnel while he's pressed (main.js), none otherwise; a
// solid jet that breaks up into droplets, splashing and ringing the lake where it lands, all of it mirrored in the lake.
// Its pressure rises while he's held and the arc rises and reaches with it, at its fullest the circle round the
// rainbow's centre, as the rainbow above. Each drop keeps the arc it left on, so a change runs out along the stream.
// Where it lands it pushes the ducks away from it and on, and they knock into each other and off Alex's rock, slowed by
// the water and paddling slowly home; their places are sent out (main.js moves them). When the water's gone and the
// ducks are still, it stops drawing until he's pressed again. Shared by stream-worker.js and main.js's fallback; no DOM.

const FPS = 30; // the footer's other motion is the compositor's; this is drawn, so at a pace a 60 or 120Hz screen divides
const RATE = 230; // drops a second
const UP = 2.2, DOWN = 1.5; // how fast the pressure rises while pressed, and falls when let go (a second)
const ON = 8, OFF = 5; // how fast the flow turns on when he's pressed, and off when he's let go (a second)
// What floats, on the lake's plane: across in px, and back from the near edge in units of 2.5 a px up the screen (it's
// seen from low down, so depth is foreshortened)
const Z = 2.5, NEAR = 18; // px up from the foot where the plane's depth 0 is
// The stream's push where it lands (px/s², at its middle, the drops' share of it, more as they come faster when he's
// pressed), and how far it reaches past a body's edge
const PUSH = 420, REACH = 14;
// The water's drag (a second), the pull home (overdamped, so they paddle slowly home and come to rest), and how much a
// knock gives back
const DRAG = 3, HOME = 0.4, BOUNCE = 0.45;
// Moving them costs the page a frame's style and paint, so their places go out at most 15 times a second (the page
// glides between them), only when one has moved enough to see, and not at all once they're still
const SEND = 1 / 15, SEE = 0.2;

export function streamer(canvas, send = () => {}) {
  const x = canvas.getContext("2d");
  let g = null, k = 1, p = 0, want = 0, flow = 0, t1 = 0, drops = [], bits = [], rings = [], id = 0, last = 0, owed = 0, still = false, run = false;
  let bodies = [], hits = [], sent = null, since = 0;
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
    hits.push(px);
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
    // The solid jet from the spout while it flows (reaching out as it starts, thinning as it stops): a glassy body, a
    // pale core
    const reach = Math.min(sb + 0.04, (t - t1) / span(e));
    if (flow > 0.02 && reach > 0) {
      along(0, reach, (4.6 + 2 * e) * flow, "rgba(150,215,255,.16)");
      along(0, reach, (2.4 + e) * flow, "rgba(205,238,255,.7)");
      along(0, Math.max(0, reach - 0.01), 0.9 * flow, "rgba(255,255,255,.9)", -0.4);
    }
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
  // The floating things for a moment: pushed where the stream lands, slowed by the water, pulled home, knocked about
  function float(dt) {
    if (!bodies.length) return;
    const zw = (g.H - g.wy - NEAR) * Z;
    for (const b of bodies) b.px = b.pz = 0;
    for (const px of hits) for (const b of bodies) {
      const dx = b.x - px, dz = b.z - zw, d = Math.hypot(dx, dz), reach = REACH + b.r;
      if (d >= reach) continue;
      const f = (PUSH * (1 + 1.5 * ease(p)) * (1 - d / reach)) / b.m / RATE, nx = d ? dx / d : 0, nz = d ? dz / d : 0;
      // Out from where it lands, and on with the water past it; pressed, the water's rush carries all it hits on with it
      // (at rest only past it, or what sits on Alex's side is dragged through and pushed back for ever)
      const on = 0.8 * Math.max(Math.min(1, 0.5 - dx / 8), Math.min(1, 3 * ease(p)), 0);
      let ux = nx * 0.6 - on, uz = nz * 0.6; const n = Math.hypot(ux, uz) || 1; ux /= n; uz /= n;
      b.px += ux * f; b.pz += uz * f;
    }
    hits = [];
    // The push smoothed a little, as the water's flow, so a steady stream holds them still
    const slow = Math.exp(-DRAG * dt), sm = Math.min(1, dt / 0.1);
    for (const b of bodies) {
      b.fx += (b.px / dt - b.fx) * sm; b.fz += (b.pz / dt - b.fz) * sm;
      b.vx = (b.vx + (b.fx - HOME * (b.x - b.hx)) * dt) * slow; b.vz = (b.vz + (b.fz - HOME * (b.z - b.hz)) * dt) * slow;
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * BOUNCE; } else if (b.x > g.W - b.r) { b.x = g.W - b.r; b.vx = -Math.abs(b.vx) * BOUNCE; }
      if (b.z < 0) { b.z = 0; b.vz = Math.abs(b.vz) * BOUNCE; } else if (b.z > 70) { b.z = 70; b.vz = -Math.abs(b.vz) * BOUNCE; }
      const rk = g.rock; // Alex's rock, its foot in the water a little back from where it meets it
      if (rk) { const dx = b.x - rk.x, dz = b.z - rk.z, d = Math.hypot(dx, dz), m = rk.r + b.r; if (d < m && d) { b.x = rk.x + (dx / d) * m; b.z = rk.z + (dz / d) * m; const vn = (b.vx * dx + b.vz * dz) / d; if (vn < 0) { b.vx -= (1 + BOUNCE) * vn * dx / d; b.vz -= (1 + BOUNCE) * vn * dz / d; } } }
    }
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.r + b.r;
      if (d >= m || !d) continue;
      const nx = dx / d, nz = dz / d, over = m - d, wa = b.m / (a.m + b.m), wb = a.m / (a.m + b.m);
      a.x -= nx * over * wa; a.z -= nz * over * wa; b.x += nx * over * wb; b.z += nz * over * wb;
      const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (vn < 0) { const jn = (-(1 + BOUNCE) * vn) / (1 / a.m + 1 / b.m); a.vx -= (jn / a.m) * nx; a.vz -= (jn / a.m) * nz; b.vx += (jn / b.m) * nx; b.vz += (jn / b.m) * nz; }
    }
    report(dt);
  }
  // Their places off home (px across, px down the screen) and a tilt as they're pushed, to a tenth of a px
  function report(dt) {
    since += dt;
    if (sent && since < SEND - 1e-3) return;
    const out = new Float32Array(bodies.length * 3), r10 = (v) => Math.round(v * 10) / 10;
    let moved = !sent;
    bodies.forEach((b, i) => {
      out[i * 3] = r10(b.x - b.hx); out[i * 3 + 1] = r10(-(b.z - b.hz) / Z); out[i * 3 + 2] = Math.round(Math.max(-14, Math.min(14, b.vx * 0.35)) * 2) / 2;
      if (sent) for (let c = 0; c < 3; c++) if (Math.abs(out[i * 3 + c] - sent[i * 3 + c]) >= (c === 2 ? 0.5 : SEE)) moved = true;
    });
    if (moved) { sent = out; since = 0; send({ type: "bodies", a: out }); }
  }
  // Still: the stream drawn once at its fullest while he's pressed, its drops where they'd be; nothing otherwise
  function stillFrame() {
    const t = 10;
    drops = []; bits = []; rings = [];
    flow = want; p = want; t1 = 0;
    if (want) for (let i = 0; i < 60; i++) { emit(t, 1); drops.at(-1).t0 = t - Math.random() * drops.at(-1).T * 0.98; }
    if (g) draw(t);
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
    const t = now / 1000;
    if (want && flow < 0.02) t1 = t; // the water leaves the spout now
    flow = want ? Math.min(1, flow + ON * dt) : Math.max(0, flow - OFF * dt);
    owed += RATE * (1 + 0.6 * p) * flow * dt;
    const n = Math.floor(owed); owed -= n;
    emit(t, n);
    draw(t);
    float(dt);
    // Nothing flowing, in the air or moving: stop until he's pressed
    if (!want && !flow && !drops.length && !bits.length && !rings.length && bodies.every((b) => Math.hypot(b.vx, b.vz) < 0.3 && Math.hypot(b.fx, b.fz) < 0.3)) {
      p = 0; report(1); unraf(id); id = 0;
    }
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
      // What floats: at home where it's placed, keeping how far it's been pushed off
      const old = bodies;
      bodies = (m.bodies ?? []).map((b, i) => {
        const hz = (b.b - NEAR) * Z, o = old.length === m.bodies.length ? old[i] : null;
        return { hx: b.x, hz, x: b.x + (o ? o.x - o.hx : 0), z: hz + (o ? o.z - o.hz : 0), vx: o?.vx ?? 0, vz: o?.vz ?? 0, fx: o?.fx ?? 0, fz: o?.fz ?? 0, r: b.r, m: b.m };
      });
      if (g.rock) g.rock.z = (g.H - g.wy - NEAR) * Z + 30;
      sent = null;
      still = m.still;
      hits = [];
      if (still) { stillFrame(); report(0); }
    },
    press(on) { want = on ? 1 : 0; if (still) stillFrame(); else if (run && !id && g) { last = 0; id = raf(step); } },
    // Not landing all that was in the air when it stopped
    start() { run = true; if (!still && !id && g) { last = 0; drops = []; bits = []; rings = []; id = raf(step); } },
    stop() { run = false; unraf(id); id = 0; },
  };
}
