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
import { runner } from "./fall.js";

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

/** A desktop: a mouse that hovers, where the quote under the boards is the way in (on request). */
export const DESKTOP = matchMedia("(hover: hover) and (pointer: fine)");
/** Fantasy mode on or off, unturned: the desktop's quote under the boards (main.js). */
export function toggleFantasy() { set(!on, 0); }

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
  if (show) { fall(); glints(); } else { stopFall(); clearInterval(glinter); }
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
  if (!oriented) { oriented = true; askHint(); }
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
// The fall itself is drawn by fall.js: off the main thread, by a worker that
// owns the canvas (fall-worker.js; on request: "optimize rainbow view
// performance"), so the page's scrolling and animations never wait on it, or
// here where a browser can't (no OffscreenCanvas or module workers).
let worker = null, run = null;
const moduleWorkers = (() => {
  let ok = false;
  try {
    const url = URL.createObjectURL(new Blob([""], { type: "text/javascript" }));
    new Worker(url, { get type() { ok = true; return "module"; } }).terminate();
    URL.revokeObjectURL(url);
  } catch {}
  return ok;
})();
function fall() {
  stopFall();
  const c = $("#fz-fall"), w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  if (!worker && !run && moduleWorkers && "transferControlToOffscreen" in c) {
    try {
      worker = new Worker(new URL("./fall-worker.js", import.meta.url), { type: "module" });
      const off = c.transferControlToOffscreen();
      worker.postMessage({ type: "init", canvas: off }, [off]);
    } catch { worker = null; }
  }
  if (worker) worker.postMessage({ type: "start", w, h, reduced: reducedMotion });
  else { run = runner(c, w, h, reducedMotion); run.start(); }
}
// A glint sweeps across "Fantasy" every 4s, as a short animation started each
// time (.glint, .9s): one that ran all the time, holding still between sweeps,
// still repainted the word and its glow every frame, most of the dream's work.
let glinter = 0;
function glints() {
  clearInterval(glinter);
  if (reducedMotion) return;
  const word = $(".fz-word");
  word.onanimationend = () => word.classList.remove("glint");
  glinter = setInterval(() => { if (!document.hidden) word.classList.add("glint"); }, 4000);
}
function stopFall() { worker?.postMessage({ type: "stop" }); run?.stop(); }
/** For the next ms, draw the fall at half rate, so an animation of the page's own runs smoothly (main.js). */
export function hush(ms) { worker?.postMessage({ type: "hush", ms }); run?.hush(ms); }

/**
 * Where the browser has the permission request and no readings have come yet
 * (iPhone and iPad Safari), ask for the tilt; call it in a tap (Safari asks
 * only then). Nothing once readings come, or elsewhere.
 */
let asking = false;
/**
 * While the tilt still needs allowing (Safari, before a tap allows it and
 * before any reading), the quote under the boards is underlined (on
 * request), so it looks like something to tap: html.tilt-ask.
 */
function askHint() { document.documentElement.classList.toggle("tilt-ask", ASK && !allowed && !oriented); }
export async function askTilt() {
  if (allowed || asking || oriented || probe.m) return;
  asking = true;
  try {
    if (await DeviceOrientationEvent.requestPermission() === "granted") {
      allowed = true;
      askHint();
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
  askHint();
  // Allowed on an earlier visit: ask again on the first tap if nothing has come (Safari answers by itself if it remembers).
  if (ASK && before) addEventListener("click", askTilt, { once: true, capture: true });
  screen.orientation?.addEventListener("change", onTurn);
  addEventListener("orientationchange", onTurn);
}
