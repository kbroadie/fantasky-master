// Auto-tune: the heavy effects time their own frames, and where this device can't keep up, their quality steps down a
// level, which is kept per device; with plenty to spare for a while it steps back up, once a visit (a phone that was
// only hot gets its quality back). Only what's left as designed is tuned (switches.js: val, setAuto); a choice on
// Moss's cards wins, and Defaults starts it again. The falling background loses resolution, then frame rate; the
// podium effects, resolution.
import { get, autoGet, setAuto, onSwitch } from "./switches.js";

const LEVELS = {
  fall: [{ fallRes: 1, fallFps: 60 }, { fallRes: 0.75, fallFps: 60 }, { fallRes: 0.5, fallFps: 60 }, { fallRes: 0.5, fallFps: 45 }, { fallRes: 0.5, fallFps: 30 }, { fallRes: 0.25, fallFps: 30 }],
  pod: [{ podRes: 1 }, { podRes: 0.75 }, { podRes: 0.5 }, { podRes: 0.25 }],
};
const BAD = 2, GOOD = 12; // seconds in a row that step it down, or up
const seen = { fall: { bad: 0, good: 0, up: false, quiet: 0 }, pod: { bad: 0, good: 0, up: false, quiet: 0 } };

const level = (fx) => autoGet(`_${fx}`) ?? 0;
// Switched on, it starts from full quality (the settings themselves default to the lowest) and steps down from there
function begin() {
  if (!get("autoTune")) return;
  for (const fx of Object.keys(LEVELS)) if (autoGet(`_${fx}`) == null) { setAuto(`_${fx}`, 0); for (const [k, v] of Object.entries(LEVELS[fx][0])) setAuto(k, v); }
}
begin();
onSwitch(["autoTune"], begin);
function step(fx, by) {
  const now = level(fx), to = Math.max(0, Math.min(LEVELS[fx].length - 1, now + by));
  if (to === now) return;
  setAuto(`_${fx}`, to);
  for (const [k, v] of Object.entries(LEVELS[fx][to])) setAuto(k, v);
  seen[fx].quiet = performance.now() + 2500; // the effect restarts: judge it again once it has settled
  if (by > 0) fine = false; // and watch the page again
}
// Each second's frames: ok keeps the level, two bad in a row step down, a long run of great steps up
function judge(fx, ok, great) {
  const s = seen[fx];
  // Not during a transition into or out of Fantasy Land: its frames are the transition's, not the effect's
  if (!get("autoTune") || performance.now() < s.quiet || document.documentElement.dataset.vt) return;
  if (!ok) { s.good = 0; if (++s.bad >= BAD) { s.bad = 0; step(fx, 1); } return; }
  s.bad = 0;
  s.good = great ? s.good + 1 : 0;
  if (s.good >= GOOD && !s.up) { s.good = 0; s.up = true; step(fx, -1); }
}

// The fall, from its worker (or the page without one): frames drawn a second against its target, and drawing's ms.
// Its real cost is the GPU's (its picture sent and blended every frame), which a worker can't see, and on iOS a worker
// keeps time by a timer that ignores the screen; so the page's own frames count too, while they're watched
export function fallFrames({ fps, draw, target }) {
  const budget = 1000 / target, p = performance.now() - page.at < 1500 ? page.fps : null;
  judge("fall", fps >= 0.8 * target && draw <= 0.6 * budget && (p == null || p >= 48),
    fps >= 0.97 * target && draw <= 0.25 * budget && (p == null || p >= 57));
}
// The page's frames a second against 60 (a faster screen still asks no more of it; a phone saving power at 30 is better
// off with less), for 4s after the fall starts. Watching costs frames itself (a callback every frame makes the page
// draw every frame), so once a window has gone well it's done for the visit, unless a step down needs checking
const page = { fps: 0, at: -1e9 };
let watching = 0, until = 0, from = 0, count = 0, fine = false;
export function watchPage() {
  if (!get("autoTune") || document.hidden || fine) return;
  until = performance.now() + 4000;
  if (!watching) { from = count = 0; watching = requestAnimationFrame(tick); }
}
function tick(now) {
  watching = 0;
  if (now > until || document.hidden) { if (now > until && page.fps >= 57) fine = true; return; }
  if (document.documentElement.dataset.vt) from = 0; // a transition's frames aren't the fall's
  else if (!from) from = now;
  else if (++count && now - from >= 1000) { Object.assign(page, { fps: (count * 1000) / (now - from), at: performance.now() }); from = now; count = 0; }
  watching = requestAnimationFrame(tick);
}
// The podiums, on the page: frames a second and their ms a frame
export function podiumFrames({ fps, cost }) {
  judge("pod", fps >= 45 && cost <= 6, fps >= 55 && cost <= 2);
}
