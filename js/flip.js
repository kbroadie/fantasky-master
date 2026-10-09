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
// half on the Standings (on request): it lets off a plume of the stink gas
// (plume in podium-fx.js, main.js) and, on Safari, asks for motion
// (askTilt), so whoever taps last place stumbles on the prompt. Once allowed,
// a later visit asks again on its first tap, which Safari answers by itself
// if it remembers.
import { $, state } from "./ui.js";
import { knapTable } from "./views/table.js";

const ASK = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
const KEY = "fm-tilt";
const SETTLE = 250; // ms a pose must hold, so a phone swung past upside down doesn't flash the table

let on = false, turn = 0, held = false, pending = null, timer = 0, listening = false, allowed = !ASK;
let up = null; // the way up, in the device's own frame: [x to its right edge, y to its top], from the sensor
let open = null; // the player whose row is open

const angle = () => screen.orientation?.angle ?? (typeof window.orientation === "number" ? (window.orientation + 360) % 360 : 0);

/** Show or hide the table; `rot` is how far it's turned, clockwise (0, 90, 180 or −90). */
function set(show, rot = 0) {
  if (show && (state.page !== "standings" || !state.d)) show = false;
  if (show === on && (!show || rot === turn)) return;
  const was = on;
  on = show; if (show) turn = rot;
  const el = $("#kflip");
  if (show && !was) { open = null; el.firstElementChild.innerHTML = knapTable(state.d); }
  el.style.setProperty("--rot", `${turn}deg`);
  el.classList.toggle("turn", turn === 180);
  el.classList.toggle("side", Math.abs(turn) === 90);
  el.classList.toggle("on", show);
  el.setAttribute("aria-hidden", !show);
  document.body.classList.toggle("kflipped", show);
  if (show && !was) el.scrollTop = 0;
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
  const b = beta * Math.PI / 180, g = gamma * Math.PI / 180;
  up = [-Math.cos(b) * Math.sin(g), Math.sin(b)];
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
  const a = angle() * Math.PI / 180;
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
}

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
    const row = e.target.closest(".kt-row");
    if (!row) { held = true; settle(); set(false); return; }
    open = open === row.dataset.kp ? null : row.dataset.kp;
    for (const r of $("#kflip").querySelectorAll(".kt-row")) {
      const me = r.dataset.kp === open;
      r.parentElement.classList.toggle("open", me);
      r.setAttribute("aria-expanded", me);
    }
  });
}

/** The page changed (a tab, the series, the week, an edit): close the table, or redraw it. */
export function flipSync() {
  if (!on) return;
  if (state.page !== "standings") set(false);
  else $("#kflip").firstElementChild.innerHTML = knapTable(state.d, undefined, open);
}
