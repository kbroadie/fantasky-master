// The Knappett's table, upside down (on request: "make the Knappett its own
// table that replaces the standings table when a phone or tablet is held
// upside down"). An Easter egg (on request): nothing on the site mentions
// it. On the Standings, turning the device over shows #kflip, a layer over
// the page with the Knappett's table (knapTable in table.js); turning it
// back hides it.
//
// The tilt sensor (deviceorientation) says when the device is upside down:
// the way up, in the device's own frame, points to its bottom edge. The
// table is then turned however far it takes to read the right way up in the
// hand, from the way up on the screen (the device's frame turned by the
// screen's own angle): 180° on a phone that kept the page portrait (.turn),
// 90° either way on one that turned the page to landscape on the way over
// and stays there, as Android phones do (on request: "my Android doesn't
// rotate upside down, only to the side"; .side), and not at all on a tablet
// that turned the page itself. Without the sensor (Safari before it's
// allowed), a screen turned to 180 shows it as it is.
// iPhone and iPad Safari give the page the tilt only after a tap allows it
// (DeviceOrientationEvent.requestPermission). The secret tap is a last-place
// half on the Standings (on request): it runs the Knappett's fall in that
// cell for a moment (fallIn, from main.js) and, on Safari, asks for motion
// (askTilt), so whoever taps last place stumbles on the prompt. Once allowed,
// a later visit asks again on its first tap, which Safari answers by itself
// if it remembers.
import { $, state, reducedMotion } from "./ui.js";
import { knapTable, knapMore } from "./views/table.js";

const ASK = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
const KEY = "fm-tilt";
const SETTLE = 250; // ms a pose must hold, so a phone swung past upside down doesn't flash the table

let on = false, turn = 0, held = false, pending = null, timer = 0, listening = false, allowed = !ASK;
let up = null; // the way up, in the device's own frame: [x to its right edge, y to its top], from the sensor
let oriented = false; // the orientation sensor works (else the accelerometer stands in)
const sideways = {}; // per landscape screen angle, which of the device's edges is up when it's read that way: +1 its right, −1 its left
let open = null; // the player whose row is open
let how = false; // How scoring works, open

const angle = () => screen.orientation?.angle ?? (typeof window.orientation === "number" ? (window.orientation + 360) % 360 : 0);

/** Show or hide the table; `rot` is how far it's turned, clockwise (0, 90, 180 or −90). */
function set(show, rot = 0) {
  if (show && (state.page !== "standings" || !state.d)) show = false;
  if (show === on && (!show || rot === turn)) return;
  const was = on;
  on = show; if (show) turn = rot;
  const el = $("#kflip");
  if (show && !was) { open = null; how = false; $(".kflip-in").innerHTML = knapTable(state.d); }
  el.style.setProperty("--rot", `${turn}deg`);
  el.classList.toggle("turn", turn === 180);
  el.classList.toggle("side", Math.abs(turn) === 90);
  el.classList.toggle("on", show);
  el.setAttribute("aria-hidden", !show);
  document.body.classList.toggle("kflipped", show);
  if (show && !was) $(".kflip-scroll").scrollTop = 0;
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

function onTilt(e) {
  const { beta, gamma } = e;
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
  if (oriented) return;
  const a = e.accelerationIncludingGravity;
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
  if (!up) return;
  const [ux, uy] = up;
  // Held sideways in a landscape page, the edge that's up is the page's top:
  // remember which, rather than trust which way the screen's angle counts.
  const a = angle();
  if ((a === 90 || a === 270) && Math.abs(ux) > 0.8) sideways[a] = Math.sign(ux);
  const down = uy < -0.57 && -uy > Math.abs(ux) * 1.4;
  const back = uy > -0.26 || Math.abs(ux) > -uy;
  if (held && back) held = false; // a tap closed it: open again only after it's been turned back
  if (down && !held) { const rot = turnFor(ux, uy); if (!on || rot !== turn) want(true, rot); else settle(); }
  else if (back) { if (on) want(false, turn); else settle(); }
  else settle();
}

/**
 * How far to turn the table, clockwise, so its top is up: the way up on the
 * screen is the device's own turned by the screen's angle (90 when the page
 * was turned to landscape with the device's top to the left).
 */
function turnFor(ux, uy) {
  // In landscape, the device's edge that was up when it was read sideways is
  // the page's top; upside down, its top is then to the right (+1: turn the
  // table clockwise) or the left.
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
  if (angle() === 180) { if (!held) set(true, 0); }
  else { held = false; if (on) set(false); }
}

function listen() {
  if (listening) return;
  listening = true;
  addEventListener("deviceorientation", onTilt);
  if (!ASK) addEventListener("devicemotion", onMotion);
}

// ── The fall ────────────────────────────────────────────────────────────────
// Behind the table, faint streaks and motes rush upwards, so it seems to be
// falling (on request): three depths, the near ones faster, longer and
// fainter, like motion blur; some gold. Drawn on one canvas at 1× (the
// streaks are soft anyway), only while the table shows: it was three tiled
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
 * the area, and `bright` how strongly they show.
 */
function streaks(x, w, h, dense = 1, bright = 1) {
  const r = (a, b) => a + Math.random() * (b - a), scale = (w * h) / (390 * 844) * dense;
  const motes = DEPTHS.flatMap((d, k) => Array.from({ length: Math.max(dense > 1 ? 1 : 0, Math.round(d.n * scale)) }, () => ({ k, x: r(0, w), y: r(0, h), len: r(...d.len), gold: Math.random() < 0.2 })));
  return (dt) => {
    x.clearRect(0, 0, w, h);
    for (const m of motes) {
      const d = DEPTHS[m.k];
      m.y -= d.v * dt;
      if (m.y < -m.len) { m.y += h + m.len; m.x = r(0, w); }
      // Bright at the head, trailing off below it (it's moving up).
      const g = x.createLinearGradient(0, m.y, 0, m.y + m.len), col = m.gold ? "232,176,64" : "240,232,220";
      g.addColorStop(0, `rgba(${col},${Math.min(1, d.a * bright)})`);
      g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g;
      x.fillRect(m.x, m.y, d.w, m.len);
    }
  };
}
let fallRaf = 0;
function fall() {
  stopFall();
  const c = $(".kf-fall canvas"), w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  c.width = w; c.height = h;
  const draw = streaks(c.getContext("2d"), w, h);
  if (reducedMotion) { draw(0); return; }
  let last = 0;
  const step = (now) => {
    draw(last ? Math.min(0.05, (now - last) / 1000) : 0);
    last = now;
    fallRaf = requestAnimationFrame(step);
  };
  fallRaf = requestAnimationFrame(step);
}

/**
 * The secret tap's tease (on request: in place of a plume of the stink gas):
 * the Knappett's fall, for a moment, in the tapped last-place cell. The same
 * streaks rush up through it, denser and brighter for its size, fading in
 * and out over about two seconds, on a canvas the cell's exact size over it,
 * removed when it's done. Nothing under reduced motion.
 */
const CELL_MS = 2200;
export function fallIn(el) {
  if (reducedMotion) return;
  const b = el.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  const c = Object.assign(document.createElement("canvas"), { className: "cell-fall", width: Math.round(b.width * dpr), height: Math.round(b.height * dpr) });
  c.setAttribute("aria-hidden", "true");
  Object.assign(c.style, { left: `${b.left + scrollX}px`, top: `${b.top + scrollY}px`, width: `${b.width}px`, height: `${b.height}px` });
  document.body.append(c);
  const x = c.getContext("2d");
  x.scale(dpr, dpr);
  const draw = streaks(x, b.width, b.height, 9, 1.8);
  let start = 0, last = 0;
  const step = (now) => {
    start ||= now;
    const t = now - start;
    if (t > CELL_MS) { c.remove(); return; }
    draw(last ? Math.min(0.05, (now - last) / 1000) : 0);
    last = now;
    c.style.opacity = Math.min(1, t / 200, (CELL_MS - t) / 700).toFixed(3);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function stopFall() { cancelAnimationFrame(fallRaf); fallRaf = 0; }

/** On Safari, ask for the tilt; call it in a tap (Safari asks only then). Nothing elsewhere, or once allowed. */
let asking = false;
export async function askTilt() {
  if (allowed || asking) return;
  asking = true;
  try {
    if (await DeviceOrientationEvent.requestPermission() === "granted") {
      allowed = true;
      try { localStorage.setItem(KEY, "1"); } catch {}
      listen();
    }
  } catch { /* refused, or not in a tap: the next last-place tap asks again */ }
  asking = false;
}

export function initFlip() {
  let before = false;
  try { before = localStorage.getItem(KEY) === "1"; } catch {}
  if (!ASK) listen();
  // Allowed on an earlier visit: ask again on the first tap (Safari answers by itself if it remembers).
  else if (before) addEventListener("click", askTilt, { once: true, capture: true });
  screen.orientation?.addEventListener("change", onTurn);
  addEventListener("orientationchange", onTurn);
  // A tap on a row opens that player's weeks (one at a time); a tap anywhere
  // else closes the table until the device is turned back (in case the
  // sensor misjudges how it's held).
  $("#kflip").addEventListener("click", (e) => {
    // How scoring works opens and closes the Knappett's card.
    const hw = e.target.closest(".kt-how");
    if (hw) {
      how = !how;
      hw.setAttribute("aria-expanded", how);
      hw.closest(".kt-hero").classList.toggle("explain", how);
      return;
    }
    if (e.target.closest("#kt-explain")) return; // reading the card
    // An opened row's card title switches it between points and the race, as on the Standings.
    const swap = e.target.closest(".xp-swap");
    if (swap) {
      state.xpView = swap.dataset.xp;
      const item = swap.closest(".kt-item");
      item.querySelector(".kt-more > div").innerHTML = knapMore(state.d, state.d.byName[open]);
      return;
    }
    if (e.target.closest(".kt-more")) return; // reading a card
    const row = e.target.closest(".kt-row");
    if (!row) { held = true; settle(); set(false); return; }
    open = open === row.dataset.kp ? null : row.dataset.kp;
    for (const r of $("#kflip").querySelectorAll(".kt-row")) {
      const me = r.dataset.kp === open;
      // The opened row's card is drawn as it opens; a closing one keeps its card until it has folded away.
      if (me) r.nextElementSibling.firstElementChild.innerHTML = knapMore(state.d, state.d.byName[open]);
      r.parentElement.classList.toggle("open", me);
      r.setAttribute("aria-expanded", me);
    }
  });
}

/** The page changed (a tab, the series, the week, an edit): close the table, or redraw it. */
export function flipSync() {
  if (!on) return;
  if (state.page !== "standings") set(false);
  else $(".kflip-in").innerHTML = knapTable(state.d, undefined, open, how);
}
