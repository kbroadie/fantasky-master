// Cast: a name strip (in standings order) above swipeable contestant slides.
import { esc, rich, ord, framed, state, icon, ICON_PATHS, TASK_NAME } from "../ui.js";
import { statsFor, badgesFor, factsFor } from "../alltime.js";
import { faceFor } from "../heroes.js";

/** Contestants by series total, best first. */
export const castOrder = (d) => [...d.contestants].sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key));

export const castTabs = (d) => castOrder(d).map((c, i) => `<button class="strip-tab" data-slide="${i}"><span>${esc(c.key)}</span></button>`).join("");

export { median };

export function castSlides(d) {
  // One scale for every contestant, so bars compare across slides, with the
  // series median of every contestant's episode scores as a reference line.
  const scores = d.contestants.flatMap((c) => c.eps.slice(0, d.weeksScored));
  const max = Math.max(1, ...scores);
  return castOrder(d).map((c) => `<section class="slide">${slide(d, c, max, median(scores))}</section>`).join("");
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * The Points per episode card: one bar per episode on one scale (max), each
 * exactly its score over the max (--f); the number sits above it and
 * the episode number below, outside the plot, so they never squeeze the bar.
 * `at(ep)` gives { v, won, color?, tag? } for a scored episode, or null for
 * one not yet scored (a bar may carry its own colour and a label under it,
 * above the episode number: a player's pick that week).
 * The series median is a dashed line, keyed in the head. A win's number is
 * gold; there are no crowns (removed on request).
 */
export function barsCard(d, at, max, med, color, title = "Points per episode", legend = null) { // title: text, or a head element (a player's switch)
  const f = (v) => (v / max).toFixed(4);
  let tagged = false;
  const bars = d.episodes.map((e) => {
    const x = at(e.ep);
    if (x?.tag) tagged = true;
    // Not scored yet (or after the week on show): no bar, but a pick already made shows its letters.
    if (!x || x.tbd) return `<div class="bar tbd${x?.dim ? " dim" : ""}"${x?.color ? ` style="--c:${x.color}"` : ""}><i></i>${x?.tag ? `<em>${esc(x.tag)}</em>` : ""}<small>${e.ep}</small></div>`;
    // A split bar (the Knappett card): the part from disasters is capped in olive above --k of it.
    return `<div class="bar${x.won ? " won" : ""}${x.dim ? " dim" : ""}${x.split != null ? " split" : ""}${x.bad ? " bad" : ""}" style="--f:${f(x.v)}${x.color ? `;--c:${x.color}` : ""}${x.split != null ? `;--k:${x.split.toFixed(4)}` : ""}"><i></i><b>${x.v}</b>${x.tag ? `<em>${esc(x.tag)}</em>` : ""}<small>${e.ep}</small></div>`;
  }).join("");
  const medText = med == null ? "" : Number.isInteger(med) ? med : med.toFixed(1);
  const medLine = med == null ? "" : `<div class="bar-med" style="--f:${f(med)}" aria-hidden="true"></div>`;
  return `
    <div class="card">
      <div class="card-head">${title.startsWith("<") ? title : `<span>${title}</span>`}<span class="legend">${legend ?? (med == null ? "" : `<i class="med-key"></i>median ${medText}`)}</span></div>
      <div class="bars${tagged ? " tagged" : ""}" style="--c:${color}">${medLine}${bars}</div>
    </div>`;
}

function slide(d, c, max, med) {
  const bars = barsCard(d, (ep) => ep > d.weeksScored ? null : { v: c.eps[ep - 1], won: d.winners[ep]?.winner === c.key }, max, med, c.color);

  return `
    <div class="ep-head cd-head${c.rank === 1 ? " fx-stage" : ""}">
      <div class="cd-img${c.rank === 1 ? " pod-col win" : ""}">${framed(c)}</div>
      <div class="kicker">${ord(c.rank)} of ${d.contestants.length} · Series ${state.key}</div>
      <h2 class="ep-title">${esc(c.full)}</h2>
      <div class="ep-sub"><b style="color:${c.color}">${c.total}</b> points · ${c.avg.toFixed(1)} an episode${c.wins ? ` · ${c.wins} win${c.wins > 1 ? "s" : ""}` : ""}</div>
    </div>
    ${records(d, c)}
    ${bars}
    ${heatStrip(d, c)}
    ${radar(d, c)}
    ${profile(c)}`;
}

// ── All-time records and fact file (alltime.js) ──────────────────────────────

const statsRow = (c) => statsFor(state.allTime, state.key, c.full);

/** Badges for stats where this contestant is in Taskmaster's all-time top 3.
 *  Finished series only: four episodes are too few to rank against a whole run. */
function records(d, c) {
  if (d.weeksScored < d.episodes.length) return "";
  const badges = badgesFor(state.allTime, statsRow(c));
  if (!badges.length) return "";
  return `
    <div class="card records">
      <div class="card-head"><span>All-time records</span><span class="legend">of ${badges[0].of} contestants</span></div>
      ${badges.map((b) => `<div class="rec"><b class="rec-label">${esc(b.label)}</b><span class="rec-rank${b.rank === 1 ? " top" : ""}">${b.tied ? "=" : ""}#${b.rank}</span><span class="rec-text">${esc(b.text)}</span></div>`).join("")}
    </div>`;
}

/** Who they are: a short bio and personal facts. Performance lives elsewhere.
 *  With a group photo, their face sits behind the card, offset to the right,
 *  and the bio narrows to the left of it. */
function profile(c) {
  const facts = factsFor(statsRow(c));
  if (!c.bio && !facts.length) return "";
  const f = faceFor(state.key, c.key);
  const bg = f ? `<span class="pf-bg" aria-hidden="true"><img src="${f.src}" alt="" loading="lazy" decoding="async" style="--ex:${f.ex};--ey:${f.ey};--size:${f.head};--ar:${f.ratio}"></span>` : "";
  return `
    <div class="card note profile${f ? " has-face" : ""}">
      ${bg}
      <div class="card-head"><span>Profile</span></div>
      ${c.bio ? `<p class="pf-bio"><span>${rich(c.bio)}</span></p>` : ""}
      ${facts.length ? `<dl>${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
    </div>`;
}

// ── Task heat strip ─────────────────────────────────────────────────────────
// Every task of the series as a square in the contestant's colour, stronger
// for a higher score (0 is an empty outline, a DQ a red cross, and a type
// with no task that episode just a dash): one row per task type, one
// column per episode (tasks of the same type in an episode share the slot),
// the type's average at the end. Tap a slot (the whole episode's column in a
// row, a far bigger target than a square) to read its tasks in the caption.

const HEAT_TYPES = ["P", "F", "T", "L"];

function heatStrip(d, c) {
  const i = d.idx[c.key], eps = d.episodes.map((e) => e.ep);
  const byType = Object.fromEntries(HEAT_TYPES.map((k) => [k, []]));
  for (const ep of eps.filter((e) => e <= d.weeksScored)) {
    for (const t of d.epTasks(ep)) if (byType[t.t]) byType[t.t].push({ ep, name: t.n, v: t.s[i], dq: !!t.dq?.[i] });
  }
  const types = HEAT_TYPES.filter((k) => byType[k].length);
  if (!types.length) return "";
  const head = `<span></span>${eps.map((e) => `<span class="hs-ep${e > d.weeksScored ? " tbd" : ""}">${e}</span>`).join("")}<span class="hs-ep">avg</span>`;
  const rows = types.map((k) => {
    const all = byType[k], avg = all.reduce((a, x) => a + x.v, 0) / all.length;
    const slots = eps.map((e) => {
      const here = all.filter((x) => x.ep === e);
      // No task of this type that episode: n/a, a dash rather than a square.
      if (!here.length) return e > d.weeksScored ? `<span class="hs-slot tbd"></span>` : `<span class="hs-slot na" title="No ${TASK_NAME[k].toLowerCase()} task"></span>`;
      const say = `Ep ${e} · ${TASK_NAME[k]} · ${here.map((x) => `${x.name}: ${x.dq ? "DQ" : x.v}`).join(" · ")}`;
      const cells = here.map((x) => `<i class="hs-cell${x.dq ? " dq" : ""}" style="--v:${x.v}"></i>`).join("");
      return `<button class="hs-slot" data-say="${esc(say)}" aria-label="${esc(say)}">${cells}</button>`;
    }).join("");
    return `<span class="hs-type">${icon(k)}${TASK_NAME[k]}</span>${slots}<span class="hs-avg">${avg.toFixed(1)}</span>`;
  }).join("");
  const key = [0, 1, 2, 3, 4, 5].map((v) => `<i class="hs-key" style="--v:${v}"></i>`).join("");
  const anyDq = types.some((k) => byType[k].some((x) => x.dq));
  return `
    <div class="card heat" style="--c:${c.color}">
      <div class="card-head"><span>Every task</span><span class="legend hs-legend">0${key}5${anyDq ? `<i class="hs-key dq"></i>DQ` : ""}</span></div>
      <div class="hs-grid">${head}${rows}</div>
      <p class="hs-cap"></p>
    </div>`;
}

// ── Performance radar ───────────────────────────────────────────────────────
// Points per episode from Prize, Filmed and Live tasks (team tasks aren't
// counted), as z-scores against every contestant in Taskmaster history
// (state.stats, from the all-time stats; the league's series if those are
// missing). The scale runs from −3σ at the centre to +3σ at the edge,
// with a hairline ring at every whole σ and ticks where they cross the axes;
// the middle ring (dashed) is the all-series average. With ten or so
// contestants no z-score can pass ±3, so nothing is clipped in practice.
// Only the selected contestant is drawn; each axis label carries its z-score.

const KINDS = [["P", "Prize"], ["F", "Filmed"], ["L", "Live"]];
/** A z-score to two decimals with a proper sign: "+2.48", "−1.70", "0.00". */
const zText = (v) => (Math.abs(v) < 0.005 ? "0.00" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`);
const Z = 3;
const SIGMAS = [-2, -1, 0, 1, 2];

function radar(d, c) {
  const n = KINDS.length, R = 80, cx = 170, cy = 136;
  const eps = Math.max(1, d.weeksScored), st = state.stats;
  const z = (k) => (st[k].sd ? (c.ty[k] / eps - st[k].mean) / st[k].sd : 0);
  const r = (k) => Math.min(1, Math.max(0, (z(k) + Z) / (2 * Z)));
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const at = (i, f) => [cx + Math.cos(ang(i)) * R * f, cy + Math.sin(ang(i)) * R * f];
  const f1 = (v) => v.toFixed(1);
  const pts = KINDS.map(([k], i) => at(i, r(k)));
  const ringAt = (s) => (s + Z) / (2 * Z);
  const rings = SIGMAS.map((s) => `<circle class="rd-ring${s === 0 ? " avg" : ""}" cx="${cx}" cy="${cy}" r="${f1(R * ringAt(s))}"/>`).join("");
  const spokes = KINDS.map((_, i) => { const [x, y] = at(i, 1); return `<line class="rd-axis" x1="${cx}" y1="${cy}" x2="${f1(x)}" y2="${f1(y)}"/>`; }).join("");
  const ticks = KINDS.map((_, i) => [...SIGMAS.map(ringAt), 1].map((f) => {
    const [x, y] = at(i, f), a = ang(i) + Math.PI / 2, dx = Math.cos(a) * 3, dy = Math.sin(a) * 3;
    return `<line class="rd-tick" x1="${f1(x - dx)}" y1="${f1(y - dy)}" x2="${f1(x + dx)}" y2="${f1(y + dy)}"/>`;
  }).join("")).join("");
  // One centred group per axis, set clear of the circle: the z-score as the
  // headline, with the icon and name as a quiet caption underneath. DM Mono
  // is monospaced, so the caption's width is known (11px × 0.66em per
  // character) and the icon + word can be centred as a unit.
  const labels = KINDS.map(([k, label], i) => {
    const top = i === 0, side = Math.sign(Math.round(Math.cos(ang(i)) * 100));
    const gx = top ? cx : cx + side * (R + 34), vy = top ? cy - R - 30 : cy + R * 0.5 + 6;
    const ico = 12, gap = 5, w = ico + gap + label.length * 11 * 0.66, left = gx - w / 2, ly = vy + 17;
    return `<text class="rd-z" x="${f1(gx)}" y="${f1(vy)}" text-anchor="middle">${zText(z(k))}<tspan class="rd-sigma" dx="1">σ</tspan></text>`
      + `<g class="rd-ico" transform="translate(${f1(left)} ${f1(ly - 10)}) scale(${ico / 16})"><path d="${ICON_PATHS[k]}"/></g>`
      + `<text class="rd-label" x="${f1(left + ico + gap)}" y="${f1(ly)}">${label}</text>`;
  }).join("");
  const id = `rd-${esc(c.key).replace(/\W/g, "")}`;
  const summary = KINDS.map(([k, label]) => `${label} ${zText(z(k))} standard deviations`).join(", ");
  return `
    <div class="card radar" style="--c:${c.color}">
      <div class="card-head"><span>Performance</span><span class="legend">${state.stats.n ? `z-score vs all ${state.stats.n} contestants` : "z-score vs all series"}</span></div>
      <svg viewBox="0 0 340 226" role="img" aria-label="${esc(c.key)}'s points per episode against every contestant in every series: ${summary}">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.color}" stop-opacity=".9"/><stop offset="1" stop-color="${c.color}" stop-opacity=".65"/></linearGradient></defs>
        <circle class="rd-face" cx="${cx}" cy="${cy}" r="${R}"/>
        ${rings}${spokes}${ticks}
        <polygon points="${pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ")}" fill="url(#${id})"/>
        ${pts.map(([x, y]) => `<circle class="rd-pt" cx="${f1(x)}" cy="${f1(y)}" r="2.5"/>`).join("")}
        ${labels}
      </svg>
    </div>`;
}
