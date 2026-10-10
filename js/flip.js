// Fantasy Fantasky Master: an Easter egg, never mentioned on the site. The quote under every tab switches it on
// and off: fantasy mode (state.fantasy, html.fz), low scores win, with the fall behind everything.
import { $, state, reducedMotion } from "./ui.js";
import { runner } from "./fall.js";
import { get, onSwitch } from "./switches.js";

let on = false;
let hooks = { redraw() {} };

// anchor: what was tapped, kept where it is on the screen (the page re-renders around it)
export function toggleFantasy(anchor = "#dq") { set(!on, anchor); }

function set(show, anchor) {
  if (show && !state.d) show = false;
  if (show === on) return;
  on = show;
  if (show) warm();
  const html = document.documentElement, at = $(anchor)?.getBoundingClientRect();
  const swap = () => {
    html.classList.toggle("fz", show);
    state.fantasy = show;
    hooks.redraw();
    const y1 = $(anchor)?.getBoundingClientRect().top;
    if (at && y1 != null) scrollBy(0, y1 - at.top);
    if (show) { fall(); glints(); } else { stopFall(); clearInterval(glinter); }
  };
  const how = get("fzMove");
  if (how === "off" || reducedMotion || !document.startViewTransition) return swap();
  // The browser pictures the page before and after and animates between the two (styles.css, html[data-vt])
  html.dataset.vt = how;
  html.classList.toggle("vt-in", show);
  if (how === "ripple") ripple(at, show);
  if (how === "turn") nameMovers();
  const vt = document.startViewTransition(() => { swap(); if (how === "turn") nameMovers(); });
  vt.finished.finally(() => { delete html.dataset.vt; html.classList.remove("vt-in"); if (how === "turn") nameMovers(true); });
}

// Ripple: Fantasy Land grows from what was tapped in a circle, and shrinks back into it. Its keyframes are written
// here, as a custom property on the root would restyle every duck and dolphin
let rippleCss = null;
function ripple(r, show) {
  const x = r ? r.left + r.width / 2 : innerWidth / 2, y = r ? r.top + r.height / 2 : innerHeight / 2;
  const R = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)));
  rippleCss ??= document.head.appendChild(document.createElement("style"));
  const small = `circle(0 at ${x}px ${y}px)`, big = `circle(${R}px at ${x}px ${y}px)`;
  rippleCss.textContent = `@keyframes vt-ripple { from { clip-path: ${show ? small : big}; } to { clip-path: ${show ? big : small}; } }`;
}
// Turn: each player's half on the week on show, and each Cast tab, glides from its old place to its new one
// (the order inverts). Only what's on screen under the bar and strip: a moving picture is drawn over everything, the bar
// too. Named only for the transition: names must be unique, and a named element is a stacking context
function nameMovers(clear = false) {
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const top = Math.max(0, ...[...document.querySelectorAll(".topbar, .strip")].map((e) => e.getBoundingClientRect())
    .filter((r) => r.height && r.bottom < innerHeight / 2).map((r) => r.bottom));
  for (const el of document.querySelectorAll("#st-body .slide.here .sd, #cast-tabs .strip-tab")) {
    const r = el.getBoundingClientRect(), seen = el.dataset.p ? r.top >= top && r.bottom <= innerHeight : r.height > 0;
    el.style.viewTransitionName = clear || !seen ? "" : el.dataset.p ? `vt-${el.dataset.side}-${slug(el.dataset.p)}` : `vt-cast-${slug(el.textContent)}`;
  }
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
const FALL = ["fall", "fallRes", "fallFps", "fallDensity", "fallFigures", "fallBright", "fallSpeed"];
function fall() {
  stopFall();
  const c = $("#fz-fall"), w = c.clientWidth, h = c.clientHeight;
  if (!w || !h || !get("fall")) return;
  const opts = { res: Math.min(2, devicePixelRatio || 1) * get("fallRes"), fps: get("fallFps"), density: get("fallDensity"), figures: get("fallFigures"), bright: get("fallBright"), speed: get("fallSpeed") };
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
