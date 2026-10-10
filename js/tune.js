// Auto-tune: the heavy effects time their own frames. Switched on, it starts at the lowest quality and climbs a level at
// a time while this device keeps up with plenty to spare, and steps down when it can't, so it settles on the best the
// device holds steadily (frame pacing first), kept per device. A level that fails soon after it's reached is never
// tried again here, so a visit doesn't stutter for it; one that fails later (a hot phone) steps down but may be
// climbed again. Only what's left as designed is tuned (switches.js: val, setAuto); a choice on Moss's cards wins, and
// Defaults starts it again. The falling background gains resolution, then frame rate; the podium effects, resolution.
import { get, autoGet, setAuto, onSwitch } from "./switches.js";

const LEVELS = { // best first
  fall: [{ fallRes: 1, fallFps: 60 }, { fallRes: 0.75, fallFps: 60 }, { fallRes: 0.5, fallFps: 60 }, { fallRes: 0.5, fallFps: 30 }, { fallRes: 0.25, fallFps: 30 }, { fallRes: 0.25, fallFps: 20 }, { fallRes: 0.25, fallFps: 15 }],
  pod: [{ podRes: 1 }, { podRes: 0.75 }, { podRes: 0.5 }, { podRes: 0.25 }],
};
const BAD = 2, GOOD = 3, TRIAL = 10000; // seconds in a row that step it down, or up; how long a new level is on trial
const seen = { fall: { bad: 0, good: 0, quiet: 0, tried: 0 }, pod: { bad: 0, good: 0, quiet: 0, tried: 0 } };

// The page's frames, watched after the fall starts (below)
const page = { fps: 0, at: -1e9 };
let watching = 0, until = 0, from = 0, count = 0, fine = false;

const lowest = (fx) => LEVELS[fx].length - 1;
const level = (fx) => autoGet(`_${fx}`) ?? lowest(fx);
const best = (fx) => autoGet(`_${fx}Best`) ?? 0; // the best it may climb to: below one that failed on trial
function to(fx, l) {
  setAuto(`_${fx}`, l);
  for (const [k, v] of Object.entries(LEVELS[fx][l])) setAuto(k, v);
  seen[fx].quiet = performance.now() + 2500; // the effect restarts: judge it again once it has settled
  fine = false; // and watch the page again
}
// Switched on, it starts at the lowest
function begin() {
  if (get("autoTune")) for (const fx of Object.keys(LEVELS)) if (autoGet(`_${fx}`) == null) to(fx, lowest(fx));
}
begin();
onSwitch(["autoTune"], begin);
// Each second's frames: ok holds the level, two bad in a row step down, a run of great steps up
function judge(fx, ok, great) {
  const s = seen[fx], now = performance.now();
  // Not during a transition into or out of Fantasy Land: its frames are the transition's, not the effect's
  if (!get("autoTune") || now < s.quiet || document.documentElement.dataset.vt) return;
  const l = level(fx);
  if (!ok) {
    s.good = 0;
    if (++s.bad < BAD) return;
    s.bad = 0;
    if (s.tried && now - s.tried < TRIAL) { s.tried = 0; setAuto(`_${fx}Best`, l + 1); } // it failed on trial: not again on this device
    if (l < lowest(fx)) to(fx, l + 1);
    return;
  }
  s.bad = 0;
  s.good = great ? s.good + 1 : 0;
  if (s.good >= GOOD && l - 1 >= best(fx)) { s.good = 0; s.tried = now; to(fx, l - 1); }
}
// The fall, from its worker (or the page without one): frames drawn a second against its target, and drawing's ms.
// Its real cost is the GPU's (its picture sent and blended every frame), which a worker can't see, and on iOS a worker
// keeps time by a timer that ignores the screen; so the page's own frames count too, while they're watched
export function fallFrames({ fps, draw, target }) {
  const budget = 1000 / target, p = performance.now() - page.at < 1500 ? page.fps : null;
  judge("fall", fps >= 0.8 * target && draw <= 0.6 * budget && (p == null || p >= 48),
    fps >= 0.95 * target && draw <= 0.25 * budget && (p == null || p >= 57));
}
// The page's frames a second against 60 (a faster screen still asks no more of it; a phone saving power at 30 is better
// off with less), for 4s after the fall starts. Watching costs frames itself (a callback every frame makes the page
// draw every frame), so once a window has gone well it's done for the visit, unless a step down needs checking
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
