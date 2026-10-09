// Fantasy Fantasky Master, upside down (on request: "make the upside down
// layout identical to that of the normal view… change only the color
// scheme, keep the falling animation background, and change the emphases and
// orders to make the low scores the winners"; "call it Fantasy Fantasky
// Master… a dream world where low scores are good"). An Easter egg: nothing on
// the site mentions it. Turning the device over turns the whole app round
// (every tab) and puts it in fantasy mode (state.fantasy, html.fz): the views
// rank low scores first and give them the winners' emphasis (table.js,
// episodes.js, cast.js), the colours are a Lisa Frank dream (styles.css), the
// brand reads "Fantasy Fantasky Master", and the fall rushes past behind it
// all. Turning it back puts everything back.
//
// The tilt sensor (deviceorientation) says when the device is upside down:
// the way up, in the device's own frame, points to its bottom edge. The page
// is then turned however far it takes to read the right way up in the hand,
// from the way up on the screen (the device's frame turned by the screen's
// own angle): 180° on a phone that kept the page portrait (html.fz-turn), 90°
// either way on one that turned the page to landscape on the way over and
// stays there, as Android phones do (html.fz-side), and not at all on a
// tablet that turned the page itself. Turned, the body is a fixed, rotated
// box and main scrolls inside it (scroller() in main.js), as a transformed
// page can't scroll the window the right way round. Without the sensor
// (Safari before it's allowed), a screen turned to 180 is the sign.
//
// The page listens from the start on every device (on request: Android needs
// no tap, and some Android browsers offer the permission request too, which
// had held them back until one). iPhone and iPad Safari give the page the
// tilt only after a tap allows it (DeviceOrientationEvent.requestPermission):
// the secret tap is the small upside-down quote under the Standings boards
// (on request), which, where no readings have come yet, asks for motion
// (askTilt, from main.js), so whoever is curious stumbles on the prompt. Once allowed, a later visit asks again on its
// first tap, which Safari answers by itself if it remembers.
import { $, state, reducedMotion } from "./ui.js";

const ASK = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
// iPhones and iPads (iPadOS reports itself as a Mac with a touch screen): their motion readings' signs run the other way.
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const KEY = "fm-tilt";
const SETTLE = 250; // ms a pose must hold, so a phone swung past upside down doesn't flip the app

let on = false, turn = 0, pending = null, timer = 0, listening = false, allowed = !ASK;
let up = null; // the way up, in the device's own frame: [x to its right edge, y to its top], from the sensor
let oriented = false; // the orientation sensor works (else the accelerometer stands in)
const sideways = {}; // per landscape screen angle, which of the device's edges is up when it's read that way: +1 its right, −1 its left
let hooks = { redraw() {}, scrolled() {} }; // from main.js: redraw every page; after the page is turned or put back

/** How far the page is turned (0, 180, 90 or −90): main.js turns screen measurements round by it. */
export const turned = () => (on ? turn : 0);

const angle = () => screen.orientation?.angle ?? (typeof window.orientation === "number" ? (window.orientation + 360) % 360 : 0);

/** Into fantasy mode or out of it; `rot` is how far the page is turned, clockwise (0, 90, 180 or −90). */
function set(show, rot = 0) {
  if (show && !state.d) show = false;
  if (show === on && (!show || rot === turn)) return;
  const was = on, html = document.documentElement;
  on = show; if (show) turn = rot;
  // Start the turned page at the top (the window and the bar as they are at the top).
  if (show !== was || show) { scrollTo(0, 0); hooks.scrolled(); }
  html.style.setProperty("--rot", `${turn}deg`);
  html.classList.toggle("fz", show);
  html.classList.toggle("fz-turn", show && turn === 180);
  html.classList.toggle("fz-side", show && Math.abs(turn) === 90);
  state.fantasy = show;
  if (show !== was) hooks.redraw();
  else hooks.scrolled();
  if (show) fall(); else stopFall();
}

/** After the pose has held for a moment. */
function want(show, rot) {
  if (pending && pending.show === show && pending.rot === rot) return;
  clearTimeout(timer);
  pending = { show, rot };
  timer = setTimeout(() => { pending = null; set(show, rot); }, SETTLE);
}
function settle() { clearTimeout(timer); pending = null; }

// The word "Fantasy" is in Pacifico, used nowhere else: it's fetched once the
// sensor first reads, so it's in before the device is turned over.
let warmed = false;
function warm() {
  if (warmed) return;
  warmed = true;
  document.fonts?.load("1em Pacifico").catch(() => {});
}

function onTilt(e) {
  const { beta, gamma } = e;
  probe.o++; probe.beta = beta; probe.gamma = gamma; probe.show();
  if (beta == null || gamma == null) return;
  oriented = true;
  const b = beta * Math.PI / 180, g = gamma * Math.PI / 180;
  up = [-Math.cos(b) * Math.sin(g), Math.sin(b)];
  judge();
}

/**
 * Phones without a gyroscope may give no orientation at all, but every phone
 * has an accelerometer: at rest it reads the way up (accelerationIncludingGravity,
 * pointing up, in the device's frame), so it stands in until an orientation
 * reading arrives. Not on Safari, whose signs run the other way (and which
 * gives the orientation once allowed).
 */
function onMotion(e) {
  const a = e.accelerationIncludingGravity;
  probe.m++; probe.acc = a; probe.show();
  if (oriented) return;
  if (!a || a.x == null || a.y == null) return;
  const n = Math.hypot(a.x, a.y, a.z || 0);
  if (n < 6 || n > 14) return; // being shaken, not held
  up = [a.x / n, a.y / n];
  judge();
}

/**
 * Upside down: the way up points to the device's bottom edge (more than 35°
 * past level, and more down than sideways), so not flat on its face or on
 * its side. Back up only once clearly so (less than 15°, or sideways).
 */
function judge() {
  warm();
  if (!up) return;
  const [ux, uy] = up;
  // Held sideways in a landscape page, the edge that's up is the page's top:
  // remember which, rather than trust which way the screen's angle counts.
  const a = angle();
  if ((a === 90 || a === 270) && Math.abs(ux) > 0.8) sideways[a] = Math.sign(ux);
  const down = uy < -0.57 && -uy > Math.abs(ux) * 1.4;
  const back = uy > -0.26 || Math.abs(ux) > -uy;
  probe.pose = down ? "upside down" : back ? "upright" : "in between";
  if (down) { const rot = turnFor(ux, uy); if (!on || rot !== turn) want(true, rot); else settle(); }
  else if (back) { if (on) want(false, turn); else settle(); }
  else settle();
}

/**
 * How far to turn the page, clockwise, so its top is up: the way up on the
 * screen is the device's own turned by the screen's angle (90 when the page
 * was turned to landscape with the device's top to the left).
 */
function turnFor(ux, uy) {
  // In landscape, the device's edge that was up when it was read sideways is
  // the page's top; upside down, its top is then to the right (+1: turn the
  // page clockwise) or the left.
  const deg = angle();
  if (sideways[deg]) return sideways[deg] > 0 ? 90 : -90;
  const a = deg * Math.PI / 180;
  const sx = ux * Math.cos(a) - uy * Math.sin(a), sy = ux * Math.sin(a) + uy * Math.cos(a);
  if (Math.abs(sy) >= Math.abs(sx)) return sy >= 0 ? 0 : 180;
  return sx > 0 ? 90 : -90;
}

/** The page turned: with the sensor, judge again; without it, a page turned to 180 is the sign. */
function onTurn() {
  if (up) { settle(); if (on) set(true, turnFor(...up)); judge(); return; }
  if (angle() === 180) set(true, 0);
  else if (on) set(false);
}

function listen() {
  if (listening) return;
  listening = true;
  addEventListener("deviceorientation", onTilt);
  if (!IOS) addEventListener("devicemotion", onMotion);
}

// ── The fall ────────────────────────────────────────────────────────────────
// Behind the page, faint streaks and motes in rainbow colours rush upwards,
// so it seems to be falling (on request): three depths, the near ones faster,
// longer and fainter, like motion blur, with stick figures and dreamy emoji
// tumbling among them. Drawn on one canvas at 1× (the streaks are soft
// anyway), only while Fantasy mode shows: it was three tiled
// layers moving by transform, kept as GPU layers ~50 MB at 3× even while
// hidden, and iOS Safari stopped drawing parts of the page (on request:
// "it doesn't fully load on Safari mobile now"). One still frame under
// reduced motion.
const DEPTHS = [
  { n: 46, v: 55, len: [3, 6], w: 1, a: 0.5 },
  { n: 26, v: 170, len: [12, 20], w: 1.3, a: 0.32 },
  { n: 12, v: 520, len: [42, 66], w: 1.8, a: 0.15 },
];
/**
 * The streaks for a canvas w × h (CSS px): returns draw(dt), which moves them
 * on by dt seconds and paints them. `dense` multiplies how many there are for
 * the area, and `bright` how strongly they show. With them fall stick figures
 * (on request), `figs` of them: fellow fallers tumbling slowly past (most
 * falling a little slower than the view, so they drift up), arms flailing
 * over their heads and legs kicking, drawn as faint hairline figures, some
 * gold, `size` px tall.
 */
// Fantasy mode's fall is a rainbow (on request: "magical fantasy Lisa Frank garden rainbows unicorns"):
// streaks in every colour, and unicorns, rainbows, butterflies, flowers and
// hearts tumbling with the stick figures.
const RAINBOW = ["255,92,205", "255,160,60", "255,232,90", "120,240,150", "90,210,255", "175,130,255"];
const DREAMS = ["🦄", "🌈", "🦋", "🌸", "💖", "⭐", "🦄", "🌷"];
function streaks(x, w, h, dense = 1, bright = 1, figs = 5, size = [26, 44], rainbow = false) {
  const r = (a, b) => a + Math.random() * (b - a), scale = (w * h) / (390 * 844) * dense;
  const hue = (gold) => (rainbow ? RAINBOW[Math.floor(Math.random() * RAINBOW.length)] : gold ? "232,176,64" : "240,232,220");
  const motes = DEPTHS.flatMap((d, k) => Array.from({ length: Math.max(dense > 1 ? 1 : 0, Math.round(d.n * scale)) }, () => ({ k, x: r(0, w), y: r(0, h), len: r(...d.len), col: hue(Math.random() < 0.2) })));
  const fig = (y) => ({ x: r(0.1, 0.9) * w, y, s: r(...size), vy: -r(25, 95), vx: r(-12, 12), rot: r(0, Math.PI * 2), spin: r(0.6, 2.2) * (Math.random() < 0.5 ? -1 : 1), ph: r(0, 9), col: hue(Math.random() < 0.25),
    dream: rainbow && Math.random() < 0.6 ? DREAMS[Math.floor(Math.random() * DREAMS.length)] : null });
  const figures = Array.from({ length: figs }, () => fig(r(0, h)));
  let t = 0;
  /** A stick figure, 20 units tall around its middle: head, body, arms flailing overhead, legs kicking. */
  const person = (f) => {
    const k = f.s / 20, a = Math.min(1, 0.62 * bright) * (f.s / size[1]) ** 0.5, col = f.col;
    x.save();
    x.translate(f.x, f.y);
    x.rotate(f.rot);
    if (f.dream) { // a unicorn, rainbow, butterfly…
      x.globalAlpha = Math.min(1, a * 1.3);
      x.font = `${Math.round(f.s)}px system-ui, sans-serif`;
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(f.dream, 0, 0);
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
    limb(0, -1.6, -2.85 + flap * 0.3, 6); // arms up and out, flailing
    limb(0, -1.6, -0.3 - flap * 0.3, 6);
    limb(0, 4, 2.2 + kick * 0.4, 7); // legs apart, kicking
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
      // Bright at the head, trailing off below it (it's moving up).
      const g = x.createLinearGradient(0, m.y, 0, m.y + m.len), col = m.col;
      g.addColorStop(0, `rgba(${col},${Math.min(1, d.a * bright)})`);
      g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g;
      x.fillRect(m.x, m.y, d.w, m.len);
    }
    for (const [i, f] of figures.entries()) {
      f.y += f.vy * dt; f.x += f.vx * dt; f.rot += f.spin * dt;
      if (f.y < -f.s) figures[i] = fig(h + f.s); // gone past: another comes up from below
      person(figures[i]);
    }
  };
}
let fallRaf = 0;
function fall() {
  stopFall();
  const c = $("#fz-fall"), w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  c.width = w; c.height = h;
  const draw = streaks(c.getContext("2d"), w, h, 1, 1.3, Math.max(4, Math.round(7 * (w * h) / (390 * 844))), [26, 44], true);
  if (reducedMotion) { draw(0); return; }
  let last = 0;
  const step = (now) => {
    draw(last ? Math.min(0.05, (now - last) / 1000) : 0);
    last = now;
    fallRaf = requestAnimationFrame(step);
  };
  fallRaf = requestAnimationFrame(step);
}

function stopFall() { cancelAnimationFrame(fallRaf); fallRaf = 0; }

/**
 * Where the browser has the permission request and no readings have come yet
 * (iPhone and iPad Safari), ask for the tilt; call it in a tap (Safari asks
 * only then). Nothing once readings come, or elsewhere.
 */
let asking = false;
export async function askTilt() {
  if (allowed || asking || oriented || probe.m) return;
  asking = true;
  try {
    if (await DeviceOrientationEvent.requestPermission() === "granted") {
      allowed = true;
      try { localStorage.setItem(KEY, "1"); } catch {}
      listen();
    }
  } catch { /* refused, or not in a tap: the next tap on the quote asks again */ }
  asking = false;
}

/**
 * A diagnostic, only with ?tilt in the address (on request, to find why a
 * phone didn't flip): a small box of what the page is getting from
 * the sensors and what it makes of it. Nothing otherwise.
 */
const probe = { o: 0, m: 0, pose: "–", el: null, at: 0,
  show() {
    if (!this.el) return;
    const now = performance.now();
    if (now - this.at < 100) return;
    this.at = now;
    const f = (v) => (v == null ? "null" : (+v).toFixed(1));
    const a = this.acc;
    this.el.textContent = [
      `orientation events: ${this.o}  β ${f(this.beta)}  γ ${f(this.gamma)}`,
      `motion events: ${this.m}  ${a ? `x ${f(a.x)}  y ${f(a.y)}  z ${f(a.z)}` : ""}`,
      `screen angle: ${angle()}  ${screen.orientation?.type || ""}  page: ${state.page}`,
      `way up: ${up ? up.map((v) => v.toFixed(2)).join(", ") : "–"}  (${oriented ? "orientation" : "motion"})`,
      `pose: ${this.pose}  fantasy: ${on ? `on, turned ${turn}°` : "off"}`,
      `secure: ${isSecureContext}  permission API: ${ASK}  allowed: ${allowed}`,
    ].join("\n");
  },
};

export function initFlip(h) {
  hooks = { ...hooks, ...h };
  if (new URLSearchParams(location.search).has("tilt")) {
    probe.el = Object.assign(document.createElement("pre"), { className: "tilt-probe" });
    document.body.append(probe.el);
    probe.show();
    setInterval(() => { probe.at = 0; probe.show(); }, 500);
  }
  let before = false;
  try { before = localStorage.getItem(KEY) === "1"; } catch {}
  listen();
  // Allowed on an earlier visit: ask again on the first tap if nothing has come (Safari answers by itself if it remembers).
  if (ASK && before) addEventListener("click", askTilt, { once: true, capture: true });
  screen.orientation?.addEventListener("change", onTurn);
  addEventListener("orientationchange", onTurn);
}
