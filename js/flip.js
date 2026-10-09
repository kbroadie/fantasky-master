// The Knappett's table, upside down (on request: "make the Knappett its own
// table that replaces the standings table when a phone or tablet is held
// upside down"). An Easter egg (on request): nothing on the site mentions
// it. On the Standings, turning the device over shows #kflip, a layer over
// the page with the Knappett's table (knapTable in table.js); turning it
// back hides it.
//
// Two ways to know the device is upside down:
// - The browser turned the page itself (iPads, some Android tablets): the
//   screen's angle is 180, and the table shows as it is.
// - Phones don't turn pages upside down, so the tilt sensor says so instead
//   (deviceorientation: beta near −90 is the top pointing down, screen to
//   you). The page is still the right way up for the device, so the table is
//   drawn turned round (.turn) to read the right way up in the hand.
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

let on = false, turn = false, held = false, pending = null, timer = 0, listening = false, allowed = !ASK;

const angle = () => screen.orientation?.angle ?? (typeof window.orientation === "number" ? (window.orientation + 360) % 360 : 0);

/** Show or hide the table; `rot` turns it round (the sensor said so, the page didn't turn). */
function set(show, rot = false) {
  if (show && (state.page !== "standings" || !state.d)) show = false;
  if (show === on && rot === turn) return;
  on = show; turn = rot;
  const el = $("#kflip");
  if (show) el.firstElementChild.innerHTML = knapTable(state.d);
  el.classList.toggle("turn", rot);
  el.classList.toggle("on", show);
  el.setAttribute("aria-hidden", !show);
  document.body.classList.toggle("kflipped", show);
  if (show) el.scrollTop = 0;
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
  const a = angle();
  if (a === 180) return; // the browser turned the page: onTurn has it
  // Upside down: the top pointing down (beta past −35°), not flat on its
  // face (−165°), not on its side. Back up only once clearly so (hysteresis).
  const down = a === 0 && beta < -35 && beta > -165 && Math.abs(gamma) < 55;
  const up = a !== 0 || beta > -15 || beta < -172 || Math.abs(gamma) > 65;
  if (held && up) held = false; // a tap closed it: open again only after it's been turned back
  if (down && !held) { if (!on) want(true, true); else settle(); }
  else if (up) { if (on && turn) want(false, false); else settle(); }
  else settle();
}

function onTurn() {
  if (angle() === 180) { if (!held) set(true, false); }
  else { held = false; if (on && !turn) set(false); }
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
  // A tap on the table closes it until the device is turned back (in case the sensor misjudges how it's held).
  $("#kflip").addEventListener("click", () => { held = true; settle(); set(false); });
}

/** The page changed (a tab, the series, the week, an edit): close the table, or redraw it. */
export function flipSync() {
  if (!on) return;
  if (state.page !== "standings") set(false);
  else $("#kflip").firstElementChild.innerHTML = knapTable(state.d);
}
