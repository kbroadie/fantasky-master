// Fantasy Fantasky Master: an Easter egg, never mentioned on the site. Upside down, the app turns to read right in the hand (fz-turn 180°, fz-side ±90° when the page went landscape, none if the browser turned it) and goes into fantasy mode (low scores win). Turned, body is a fixed rotated box and main scrolls. Listens from load; iOS needs a tap to allow the tilt (the quote under the boards).
import { $, state, reducedMotion } from "./ui.js";
import { runner } from "./fall.js";

const ASK = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
// iOS motion signs run the other way (iPadOS reports as Mac + touch)
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const KEY = "fm-tilt";
const SETTLE = 250;

let on = false, turn = 0, pending = null, timer = 0, listening = false, allowed = !ASK;
let up = null;
let oriented = false;
const sideways = {}; // per landscape angle: which device edge is up (+1 right, −1 left)
let hooks = { redraw() {}, scrolled() {} };

export const DESKTOP = matchMedia("(hover: hover) and (pointer: fine)");
export function toggleFantasy() { set(!on, 0); }

export const turned = () => (on ? turn : 0);

const angle = () => screen.orientation?.angle ?? (typeof window.orientation === "number" ? (window.orientation + 360) % 360 : 0);

function set(show, rot = 0) {
  if (show && !state.d) show = false;
  if (show === on && (!show || rot === turn)) return;
  const was = on, html = document.documentElement;
  on = show; if (show) turn = rot;
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

function want(show, rot) {
  if (pending && pending.show === show && pending.rot === rot) return;
  clearTimeout(timer);
  pending = { show, rot };
  timer = setTimeout(() => { pending = null; set(show, rot); }, SETTLE);
}
function settle() { clearTimeout(timer); pending = null; }

// Pacifico ("Fantasy") is fetched on the first reading, before the turn
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

// No gyroscope: the accelerometer stands in (not on iOS)
function onMotion(e) {
  const a = e.accelerationIncludingGravity;
  probe.m++; probe.acc = a; probe.show();
  if (oriented) return;
  if (!a || a.x == null || a.y == null) return;
  const n = Math.hypot(a.x, a.y, a.z || 0);
  if (n < 6 || n > 14) return;
  up = [a.x / n, a.y / n];
  judge();
}

// Upside down: >35° towards the bottom edge, held. Back: <15° or sideways. Flat (|up| < 0.5): keep as is.
function judge() {
  warm();
  if (!up) return;
  const [ux, uy] = up;
  if (Math.hypot(ux, uy) < 0.5) { probe.pose = "flat"; settle(); return; }
  // Sideways: remember which edge is up rather than trust the screen angle's sign
  const a = angle();
  if ((a === 90 || a === 270) && Math.abs(ux) > 0.8) sideways[a] = Math.sign(ux);
  const down = uy < -0.57 && -uy > Math.abs(ux) * 1.4;
  const back = uy > -0.26 || Math.abs(ux) > -uy;
  probe.pose = down ? "upside down" : back ? "upright" : "in between";
  if (down) { const rot = turnFor(ux, uy); if (!on || rot !== turn) want(true, rot); else settle(); }
  else if (back) { if (on) want(false, turn); else settle(); }
  else settle();
}

function turnFor(ux, uy) {
  const deg = angle();
  if (sideways[deg]) return sideways[deg] > 0 ? 90 : -90;
  const a = deg * Math.PI / 180;
  const sx = ux * Math.cos(a) - uy * Math.sin(a), sy = ux * Math.sin(a) + uy * Math.cos(a);
  if (Math.abs(sy) >= Math.abs(sx)) return sy >= 0 ? 0 : 180;
  return sx > 0 ? 90 : -90;
}

// Without the sensor, a page turned to 180 is the sign
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

// The fall: drawn by fall.js in a worker that owns the canvas, or here without OffscreenCanvas. Nothing heavy in the page until it shows (iOS dropped page tiles).
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
// The glint is a short animation started each time: a running one repainted every frame
let glinter = 0;
function glints() {
  clearInterval(glinter);
  if (reducedMotion) return;
  const word = $(".fz-word");
  word.onanimationend = () => word.classList.remove("glint");
  glinter = setInterval(() => { if (!document.hidden) word.classList.add("glint"); }, 4000);
}
function stopFall() { worker?.postMessage({ type: "stop" }); run?.stop(); }
// Not in a hidden tab: a worker without requestAnimationFrame draws on a timer that never pauses
document.addEventListener("visibilitychange", () => { if (document.hidden) stopFall(); else if (on) fall(); });

// iOS only, before any reading: ask for the tilt (must be in a tap)
let asking = false, refused = false;
function askHint() { document.documentElement.classList.toggle("tilt-ask", ASK && !allowed && !oriented); }
async function askTilt() {
  if (allowed || asking || oriented || probe.m) return;
  asking = true;
  try {
    if (await DeviceOrientationEvent.requestPermission() === "granted") {
      allowed = true;
      askHint();
      try { localStorage.setItem(KEY, "1"); } catch {}
      listen();
    } else refused = true;
  } catch { }
  asking = false;
}
// The quote under the boards on a phone. Safari remembers a refusal and never asks again, so once
// refused the quote switches the dream on and off itself, unturned, as on a desktop
export async function quoteTap() {
  if (!refused) await askTilt();
  if (!refused) return;
  document.documentElement.classList.add("tilt-off");
  toggleFantasy();
}

// ?tilt: a diagnostic box of the sensor readings
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
  // Allowed before: ask again on the first tap
  if (ASK && before) addEventListener("click", askTilt, { once: true, capture: true });
  screen.orientation?.addEventListener("change", onTurn);
  addEventListener("orientationchange", onTurn);
}
