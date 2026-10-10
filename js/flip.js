// Fantasy Fantasky Master: an Easter egg, never mentioned on the site. The quote under every tab switches it on
// and off: fantasy mode (state.fantasy, html.fz), low scores win, with the fall behind everything.
import { $, state, reducedMotion } from "./ui.js";
import { runner } from "./fall.js";
import { get, onSwitch } from "./switches.js";

let on = false;
let hooks = { redraw() {}, scrolled() {} };

export function toggleFantasy() { set(!on); }

function set(show) {
  if (show && !state.d) show = false;
  if (show === on) return;
  on = show;
  if (show) warm();
  scrollTo(0, 0);
  hooks.scrolled();
  document.documentElement.classList.toggle("fz", show);
  state.fantasy = show;
  hooks.redraw();
  if (show) { fall(); glints(); } else { stopFall(); clearInterval(glinter); }
}

// Pacifico ("Fantasy") is fetched once a finger is on the quote, before the tap lands
let warmed = false;
export function warm() {
  if (warmed) return;
  warmed = true;
  document.fonts?.load("1em Pacifico").catch(() => {});
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
const FALL = ["fall", "fallFps", "fallDensity", "fallFigures", "fallBright", "fallSpeed"];
function fall() {
  stopFall();
  const c = $("#fz-fall"), w = c.clientWidth, h = c.clientHeight;
  if (!w || !h || !get("fall")) return;
  const opts = { fps: get("fallFps"), density: get("fallDensity"), figures: get("fallFigures"), bright: get("fallBright"), speed: get("fallSpeed") };
  if (!worker && !run && moduleWorkers && "transferControlToOffscreen" in c) {
    try {
      worker = new Worker(new URL("./fall-worker.js", import.meta.url), { type: "module" });
      const off = c.transferControlToOffscreen();
      worker.postMessage({ type: "init", canvas: off }, [off]);
    } catch { worker = null; }
  }
  if (worker) worker.postMessage({ type: "start", w, h, reduced: reducedMotion, opts });
  else { run = runner(c, w, h, reducedMotion, opts); run.start(); }
}
// A Moss card's slider moves: start the fall again with it, once a frame at most
let refall = 0;
onSwitch(FALL, () => { if (on && !refall) refall = requestAnimationFrame(() => { refall = 0; fall(); }); });
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

export function initFlip(h) { hooks = { ...hooks, ...h }; }
