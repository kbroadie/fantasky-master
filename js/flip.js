// Fantastikal Delusion: the same app where low scores win, a happy place for the bottom of the table. "Embrace Failure"
// under every tab switches it on, "Embrace Success" off: fantasy mode (state.fantasy, html.fz), the fall behind everything.
import { $, state, reducedMotion } from "./ui.js";
import { runner } from "./fall.js";
import { get, val, onSwitch } from "./switches.js";
import { fallFrames, watchPage } from "./tune.js";
import { slamFx } from "./slam-fx.js";

let on = false;
let hooks = { redraw() {} };

// anchor: what was tapped, kept where it is on the screen (the page re-renders around it); at: where the tap landed,
// which the transitions open from (else the anchor's middle)
export function toggleFantasy(anchor = "#dq", at = null) { set(!on, anchor, at); }

function set(show, anchor, tap) {
  if (show && !state.d) show = false;
  if (show === on) return;
  on = show;
  if (show) warm();
  const html = document.documentElement, at = $(anchor)?.getBoundingClientRect();
  let how = get("fzMove");
  if (how === "slam" && !slamReady()) how = "iris"; // it needs the Standings' rows on screen
  const swap = () => {
    html.classList.toggle("fz", show);
    state.fantasy = show;
    hooks.redraw();
    const y1 = $(anchor)?.getBoundingClientRect().top;
    if (at && y1 != null) scrollBy(0, y1 - at.top);
    if (how === "slam") slamScroll();
    if (show) { fall(); glints(); } else { stopFall(); clearInterval(glinter); }
  };
  if (how === "off" || reducedMotion || !document.startViewTransition) return swap();
  // The browser pictures the page before and after and animates between the two (styles.css, html[data-vt])
  html.dataset.vt = how;
  html.classList.toggle("vt-in", show);
  stage(tap ?? mid(at), show);
  const subject = how === "vertigo" ? (anchor === "#dq" ? "#dq .embrace" : anchor) : null;
  const name = () => { if (how === "turn") nameMovers(); if (subject) $(subject)?.style.setProperty("view-transition-name", "vt-subject"); };
  name();
  if (how === "ripple") for (const a of document.querySelectorAll("#vt-wave animate")) a.beginElement();
  const before = how === "slam" ? slamBefore() : null;
  let fx = null;
  const vt = document.startViewTransition(() => { swap(); name(); if (before) fx = slamAfter(before); });
  // Slam's effects keep the transition's time: the camera's animation is their clock
  vt.ready.then(() => fx?.start(document.getAnimations().find((a) => a.effect?.pseudoElement === "::view-transition"))).catch(() => {});
  vt.finished.finally(() => {
    fx?.stop();
    delete html.dataset.vt; html.classList.remove("vt-in");
    if (how === "turn") nameMovers(true);
    if (how === "slam") { slamNames("clear"); html.classList.remove("vt-open"); }
    if (subject) $(subject)?.style.removeProperty("view-transition-name");
  });
}

// Slam: the camera zooms in on last place's row, which lifts out of the table; the other rows slide down a place as the
// page scrolls to the top behind it; the row slams down as the new top row (last place leads the other view), and a shockwave
// flips every other row to its new state as the new colours radiate out from the impact. The rows are named one by one:
// old row i becomes new row i + 1, and the last old row the first new one. Timings in seconds
const SLAM = { loose: 0.3, lift: 0.6, drop: 0.15, wave: 0.7, flip: 0.14 }; // it shakes loose, then lifts by lift
const travel = (dy) => 0.5 + Math.min(0.4, Math.abs(dy) / 2500); // the longer the scroll, the longer it takes
const slamRows = () => [...document.querySelectorAll("#st-body .slide.here .rows > .pc")];
// The week's blocks (its hero, the board): pictured whole, above the screen too, so the page scrolls down in its old
// style, the same layout as after, and only the style changes, with the wave
const slamBlocks = () => [...(document.querySelector("#st-body .slide.here")?.children || [])];
function slamReady() {
  const rows = slamRows(), r = rows.at(-1)?.getBoundingClientRect();
  return state.page === "standings" && rows.length > 2 && r && r.bottom > 0 && r.top < innerHeight;
}
function slamNames(phase) {
  const rows = slamRows();
  rows.forEach((r, i) => {
    r.style.viewTransitionName = phase === "old" ? (i === rows.length - 1 ? "vt-slam" : `vt-row-${i}`)
      : phase === "new" ? (i === 0 ? "vt-slam" : `vt-row-${i - 1}`) : "";
  });
  slamBlocks().forEach((b, i) => { b.style.viewTransitionName = phase === "clear" ? "" : `vt-block-${i}`; });
  // The bar and strip are their own pictures, above the moving rows (a moving picture is drawn over everything else)
  for (const [sel, n] of [[".topbar", "vt-bar"], ["#st-tabs", "vt-strip"]]) $(sel).style.viewTransitionName = phase === "clear" ? "" : n;
}
// The page scrolls to the top, where the row will land; if the top row is still below the screen there, only as far as
// shows it
function slamScroll() {
  scrollTo(0, 0);
  // The bar comes back now, as scrolling up brings it, and with the strip at once (styles.css): sliding back after the
  // new picture was taken, they ended the transition a pixel off and jumped
  $(".topbar").classList.remove("hidden");
  document.body.classList.remove("bar-hidden");
  const r = slamRows()[0]?.getBoundingClientRect();
  if (r && r.bottom > innerHeight - 24) scrollBy(0, r.bottom - innerHeight + 24);
}
// The bar is pictured open (styles.css, .vt-open), though hidden above the screen, so it slides down whole in its old
// style as the page scrolls up (compact, its lower part was see-through), and with its glass near solid (.vt-glass:
// a picture has no blur behind it, so the rows showed through); the colour behind is the old view's too
function slamBefore() {
  document.documentElement.classList.add("vt-open", "vt-glass");
  slamNames("old");
  return { from: slamRows().at(-1).getBoundingClientRect(), y: scrollY, bg: getComputedStyle(document.documentElement).getPropertyValue("--bg") };
}
function slamAfter({ from: o, y, bg }) {
  document.documentElement.classList.remove("vt-glass"); // the new picture is the real bar, which the page ends on
  slamNames("new");
  const rows = slamRows(), n = rows[0].getBoundingClientRect(), dy = y - scrollY, move = travel(dy);
  const T = SLAM.lift + move + SLAM.drop, cx = n.left + n.width / 2, cy = n.top + n.height / 2;
  const R = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
  const at = (d) => (T + (d / R) * SLAM.wave).toFixed(3); // when the shockwave reaches a point d from the impact
  const E = "cubic-bezier(.33, 0, .67, 1)", end = T + SLAM.wave + 2 * SLAM.flip, pc = (t) => `${((t / end) * 100).toFixed(2)}%`;
  // Its shadow is a drop-shadow filter, which runs with the transform on the compositor (a box-shadow repainted every
  // frame). The row's motion ends by settling into the place the browser gives it (no last keyframe: the group's own transform),
  // not at a place measured here, which was a fraction of a pixel off, so it twitched as the page took over
  const ps = (t) => `${((t / (T + 0.12)) * 100).toFixed(2)}%`;
  // Shaking loose: small jolts, growing, before it lifts
  const shake = Array.from({ length: 7 }, (_, i) => {
    const k = (i + 1) / 8, j = (i % 2 ? -1 : 1) * (0.6 + 1.6 * k);
    return `${ps(SLAM.loose * k)} { transform: translate(${(o.left + j).toFixed(1)}px, ${(o.top - 0.6 * k * (i % 2)).toFixed(1)}px) rotate(${(j * 0.35).toFixed(2)}deg); animation-timing-function: linear; }`;
  });
  const L = SLAM.lift, M = L + move, ox = o.left + o.width / 2, oy = o.top + o.height / 2;
  const css = [`
html[data-vt="slam"]::view-transition { animation: vt-cam ${end}s linear both; transform-origin: ${ox}px ${oy}px; background: ${bg}; }
@keyframes vt-cam {
  0% { transform: none; animation-timing-function: ${E}; } ${pc(L)} { transform: scale(1.18); animation-timing-function: ${E}; }
  ${pc(M)}, ${pc(T)} { transform: none; } ${pc(T + 0.04)} { transform: translateY(8px); } ${pc(T + 0.09)} { transform: translateY(-5px); }
  ${pc(T + 0.14)} { transform: translateY(3px); } ${pc(T + 0.2)} { transform: translateY(-1px); } ${pc(T + 0.26)}, 100% { transform: none; } }
html[data-vt="slam"]::view-transition-group(vt-slam) { z-index: 3; animation: vt-slam ${T + 0.12}s linear backwards; }
@keyframes vt-slam {
  0% { transform: translate(${o.left}px, ${o.top}px); animation-timing-function: linear; }
  ${shake.join("\n  ")}
  ${ps(SLAM.loose)} { transform: translate(${o.left}px, ${o.top}px); animation-timing-function: ${E}; }
  ${ps(L)} { transform: translate(${o.left}px, ${o.top - 8}px) scale(1.06); filter: drop-shadow(0 14px 16px rgba(0, 0, 0, .55)); animation-timing-function: ${E}; }
  ${ps(M)} { transform: translate(${n.left}px, ${n.top - 64}px) scale(1.12); filter: drop-shadow(0 24px 20px rgba(0, 0, 0, .5)); animation-timing-function: cubic-bezier(.55, 0, 1, .45); }
  ${ps(T)} { transform: translate(${n.left}px, ${n.top}px) scale(1.02, .9); filter: drop-shadow(0 0 0 rgba(0, 0, 0, 0)); animation-timing-function: ${E}; } }
html[data-vt="slam"]::view-transition-old(vt-slam) { animation: vt-slam-out ${end}s linear both; }
html[data-vt="slam"]::view-transition-new(vt-slam) { animation: vt-slam-in ${end}s linear both; }
@keyframes vt-slam-out { ${pc(T - 0.02)} { opacity: 1; } ${pc(T + 0.06)}, 100% { opacity: 0; } }
@keyframes vt-slam-in { 0%, ${pc(T - 0.02)} { opacity: 0; } ${pc(T + 0.06)}, 100% { opacity: 1; } }
html[data-vt="slam"]::view-transition-old(root) { animation: vt-scroll ${move}s ${L}s ${E} both; }
@keyframes vt-scroll { to { transform: translateY(${dy}px); } }
html[data-vt="slam"]::view-transition-new(root) { animation: vt-radiate ${SLAM.wave}s ${T}s linear both; } /* one front at one speed, as the rows and blocks */
@keyframes vt-radiate { from { clip-path: circle(0 at ${cx}px ${cy}px); } to { clip-path: circle(${Math.ceil(R)}px at ${cx}px ${cy}px); } }`];
  // Each row slides down a place with the table, then flips when the shockwave reaches it
  rows.slice(1).forEach((r, i) => {
    const b = r.getBoundingClientRect(), d = at(Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy));
    css.push(`html[data-vt="slam"]::view-transition-group(vt-row-${i}) { z-index: 1; animation-delay: ${L}s; animation-duration: ${move}s; animation-timing-function: ${E}; animation-fill-mode: both; }
html[data-vt="slam"]::view-transition-old(vt-row-${i}) { animation: vt-flip-out ${SLAM.flip}s ${d}s cubic-bezier(.55, 0, 1, .45) both; }
html[data-vt="slam"]::view-transition-new(vt-row-${i}) { animation: vt-flip-in ${SLAM.flip}s ${(+d + SLAM.flip).toFixed(3)}s cubic-bezier(0, .55, .45, 1) both; }`);
  });
  // The blocks scroll with the table, and the wave restyles them as it spreads: a circle on each, from the impact, as fast
  // as on the rest of the page
  // The old picture loses the same circle (a hole cut in it), so where the new one is see-through the old doesn't show
  const hole = (b, x, y, r) => `path(evenodd, "M-2 -2H${Math.ceil(b.width) + 2}V${Math.ceil(b.height) + 2}H-2Z M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z")`;
  slamBlocks().forEach((el, i) => {
    const b = el.getBoundingClientRect(), x = cx - b.left, y = cy - b.top;
    const far = Math.hypot(Math.max(x, b.width - x), Math.max(y, b.height - y)), took = ((far / R) * SLAM.wave).toFixed(3);
    css.push(`html[data-vt="slam"]::view-transition-group(vt-block-${i}) { animation-delay: ${L}s; animation-duration: ${move}s; animation-timing-function: ${E}; animation-fill-mode: both; }
html[data-vt="slam"]::view-transition-old(vt-block-${i}) { animation: vt-hole-${i} ${took}s ${T}s linear both; mix-blend-mode: normal; }
html[data-vt="slam"]::view-transition-new(vt-block-${i}) { animation: vt-wave-${i} ${took}s ${T}s linear both; mix-blend-mode: normal; }
@keyframes vt-wave-${i} { from { clip-path: circle(0 at ${x}px ${y}px); } to { clip-path: circle(${Math.ceil(far)}px at ${x}px ${y}px); } }
@keyframes vt-hole-${i} { from { clip-path: ${hole(b, x, y, 0)}; } to { clip-path: ${hole(b, x, y, Math.ceil(far))}; } }`);
  });
  // The bar and strip come down with the page, and change colour as the wave reaches them
  for (const [sel, n] of [[".topbar", "vt-bar"], ["#st-tabs", "vt-strip"]]) {
    const b = $(sel).getBoundingClientRect(), d = at(Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy));
    css.push(`html[data-vt="slam"]::view-transition-group(${n}) { z-index: 2; animation-delay: ${L}s; animation-duration: ${move}s; animation-timing-function: ${E}; animation-fill-mode: both; }
html[data-vt="slam"]::view-transition-old(${n}), html[data-vt="slam"]::view-transition-new(${n}) { animation-delay: ${d}s; animation-duration: .2s; }`);
  }
  // Dust and smoke as it breaks loose, sparks and smoke where it lands, and a shine across it (slam-fx.js): a canvas
  // over everything, the new view's only, drawn live
  const fx = slamFx({ from: o, to: n, loose: SLAM.loose, lift: L, impact: T, end, fantasy: document.documentElement.classList.contains("fz") });
  fx.canvas.style.viewTransitionName = "vt-fx";
  document.body.append(fx.canvas);
  css.push(`html[data-vt="slam"]::view-transition-group(vt-fx) { z-index: 4; animation: none; }
html[data-vt="slam"]::view-transition-new(vt-fx) { animation: none; }`);
  stageCss.textContent += css.join("\n");
  return fx;
}

// What depends on the tap: Iris's circle, and the centre Zoom and Vertigo move about. Written here, as a custom
// property on the root would restyle every duck and dolphin
const mid = (r) => (r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 });
let stageCss = null;
function stage({ x, y }, show) {
  const R = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)));
  stageCss ??= document.head.appendChild(document.createElement("style"));
  const small = `circle(0 at ${x}px ${y}px)`, big = `circle(${R}px at ${x}px ${y}px)`;
  stageCss.textContent = `@keyframes vt-iris { from { clip-path: ${show ? small : big}; } to { clip-path: ${show ? big : small}; } }
:is(html[data-vt="zoom"], html[data-vt="vertigo"])::view-transition-old(root), :is(html[data-vt="zoom"], html[data-vt="vertigo"])::view-transition-new(root) { transform-origin: ${x}px ${y}px; }`;
}
// Turn: each player's half on the week on show, and each Cast tab, glides from its old place to its new one
// (the order inverts). Only what's on screen under the bar and strip: a moving picture is drawn over everything, the bar
// too. Named only for the transition: names must be unique, and a named element is a stacking context
function nameMovers(clear = false) {
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const top = Math.max(0, ...[...document.querySelectorAll(".topbar, .strip")].map((e) => e.getBoundingClientRect())
    .filter((r) => r.height && r.bottom < innerHeight / 2).map((r) => r.bottom));
  // Every rect read before any name is written, so the reads don't each recalculate style
  const els = [...document.querySelectorAll("#st-body .slide.here .sd, #cast-tabs .strip-tab")];
  const seen = els.map((el) => { const r = el.getBoundingClientRect(); return el.dataset.p ? r.top >= top && r.bottom <= innerHeight : r.height > 0; });
  els.forEach((el, i) => {
    el.style.viewTransitionName = clear || !seen[i] ? "" : el.dataset.p ? `vt-${el.dataset.side}-${slug(el.dataset.p)}` : `vt-cast-${slug(el.textContent)}`;
  });
}

// Pacifico ("Fantastikal") is fetched once a finger is on Embrace Failure, before the tap lands
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
  const opts = { res: Math.min(2, devicePixelRatio || 1) * val("fallRes"), fps: val("fallFps"), density: get("fallDensity"), figures: get("fallFigures"), bright: get("fallBright"), speed: get("fallSpeed") };
  if (!worker && !run && moduleWorkers && "transferControlToOffscreen" in c) {
    try {
      worker = new Worker(new URL("./fall-worker.js", import.meta.url), { type: "module" });
      const off = c.transferControlToOffscreen();
      worker.postMessage({ type: "init", canvas: off }, [off]);
      worker.onmessage = ({ data }) => { if (data.type === "frames") fallFrames(data); }; // how it kept up, for auto-tune
    } catch { worker = null; }
  }
  if (worker) worker.postMessage({ type: "start", w, h, reduced: reducedMotion, opts });
  else { run = runner(c, w, h, reducedMotion, opts, fallFrames); run.start(); }
  if (!reducedMotion) watchPage();
}
// A Moss card's slider moves: start the fall again with it, once a frame at most
let refall = 0;
onSwitch(FALL, () => { if (on && !refall) refall = requestAnimationFrame(() => { refall = 0; fall(); }); });
// The glint is a short animation started each time: a running one repainted every frame
let glinter = 0;
function glints() {
  clearInterval(glinter);
  if (reducedMotion || !get("fzDeco")) return; // a decoration, off unless Moss's cards turn it on
  const word = $(".fz-word");
  word.onanimationend = () => word.classList.remove("glint");
  glinter = setInterval(() => { if (!document.hidden) word.classList.add("glint"); }, 4000);
}
function stopFall() { worker?.postMessage({ type: "stop" }); run?.stop(); }
onSwitch(["fzDeco"], () => { if (on) glints(); });
// Not in a hidden tab: a worker without requestAnimationFrame draws on a timer that never pauses
document.addEventListener("visibilitychange", () => { if (document.hidden) stopFall(); else if (on) fall(); });

export function initFlip(h) { hooks = { ...hooks, ...h }; }
