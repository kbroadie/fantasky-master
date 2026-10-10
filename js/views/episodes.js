// Episodes: a scrollable Ep 1–10 strip above
// swipeable episode slides. Everywhere on the tab the cast sit in their studio
// seat order (1–5, from the all-time stats): the portraits, the task-table
// columns (each under its portrait).
import { esc, ord, listing, framed, named, fmtDay, fmtWhen, icon, smooth, niceStep, state } from "../ui.js";
import { statsFor } from "../alltime.js";
import { rankWithTies } from "../league.js";
import { edTitle, edStrip, edTable } from "../edit.js";

/** The cast in seat order; the CSV's order if the stats aren't loaded. */
function seated(d) {
  const seat = (n) => +(statsFor(state.allTime, state.key, d.cast[n].full)?.seat || 99);
  return [...d.names].sort((a, b) => seat(a) - seat(b) || d.names.indexOf(a) - d.names.indexOf(b));
}

export const epTabs = (d) => d.episodes.map((e) =>
  `<button class="strip-tab${e.ep > d.weeksScored ? " tbd" : ""}${e.ep === d.weeksScored + 1 ? " next" : ""}" data-slide="${e.ep - 1}"><span>Ep ${e.ep}</span></button>`).join("");

export const epSlides = (d) => d.episodes.map((e) => `<section class="slide">${slide(d, e)}</section>`).join("");

function slide(d, e) {
  const head = (line) => `
    <div class="ep-head">
      <div class="kicker">Episode ${e.ep} · ${esc(fmtDay.format(e.air))}</div>
      ${state.edit ? edTitle(e) : `<h2 class="ep-title"><span class="ep-t">${esc(e.title || `Episode ${e.ep}`)}</span></h2>`}
      <div class="ep-sub">${line}</div>
    </div>${state.edit ? edStrip(d, e) : ""}`;
  if (e.ep > d.weeksScored) {
    // Like a Standings week not yet scored (on request): just the head, with when
    // it airs (or aired); nothing below it. Edit mode: an aired episode's scores
    // are entered in an editable task table.
    const line = `${e.ep <= d.weeksAired ? "Aired" : "Airs"} ${esc(fmtWhen.format(e.air))}`;
    return head(line) + (state.edit && e.ep <= d.weeksAired ? `<div class="ep-body">${edTable(d, e, seated(d))}</div>` : "");
  }

  const w = d.winners[e.ep], wk = d.weekly[e.ep], pts = (n) => d.EPS[n][e.ep];
  // Fantasy mode (flip.js): low scores win, so the episode is won by last place (all of them, if tied).
  const scores = d.names.map(pts), low = Math.min(...scores), high = Math.max(...scores);
  const champs = state.fantasy ? d.names.filter((n) => pts(n) === low) : [w.winner];
  const called = state.fantasy ? champs.reduce((a, n) => a + wk.by[n].length, 0) : wk.hits.length;
  const line = state.fantasy
    ? `Won by ${champs.map((n) => named(d.cast[n])).join(" and ")} with <b>${low}</b> · ${called ? `${called} of ${wk.voters} called it` : "nobody called it"}`
    : `Won by ${named(d.cast[w.winner])} with <b>${w.top}</b>${w.tiebreak ? " after a tiebreak" : ""}`
      + ` · ${called ? `${called} of ${wk.voters} called it` : "nobody called it"}`;

  const order = seated(d);
  const col = order.map((n) => d.idx[n]);
  // Last place gets the stink only when they lost by 5 points or more: at
  // least 5 behind the next-lowest score (sharing last place counts, and
  // all of them get it). The winner gets the gold light. Both effects are
  // drawn by podium-fx.js.
  // In fantasy mode it's the other way round: last place gets the gold
  // light, and the top scorer the stink, when 5 or more clear of the next.
  const above = Math.min(...scores.filter((v) => v > low)), below = Math.max(...scores.filter((v) => v < high));
  const isLast = state.fantasy
    ? (n) => !champs.includes(n) && pts(n) === high && Number.isFinite(below) && high - below >= 5
    : (n) => n !== w.winner && pts(n) === low && Number.isFinite(above) && above - low >= 5;

  const pod = order.map((n) => {
    const backers = wk.by[n].length, win = champs.includes(n), last = isLast(n);
    return `
    <div class="pod-col${win ? " win" : last ? " last" : ""}"${last ? ` aria-label="${esc(n)}, last place"` : ""}>
      ${framed(d.cast[n])}
      <span class="pod-name" style="color:${d.cast[n].color}">${esc(n)}</span>
      <b class="pod-pts">${pts(n)}</b>
      <span class="pod-picks">${backers ? `${backers} pick${backers > 1 ? "s" : ""}` : "no picks"}</span>
    </div>`;
  }).join("");

  const tasks = d.epTasks(e.ep);
  const table = `
    <div class="card tt-wrap"><table class="tt">
      <thead><tr><th>Task</th>${order.map((n) => `<th style="color:${d.cast[n].color}">${esc(n.slice(0, 3))}</th>`).join("")}</tr></thead>
      <tbody>${tasks.map((t) => {
        const s = col.map((i) => t.s[i]), hi = Math.max(...s), lo = Math.min(...s);
        return `<tr><td><span class="tn">${icon(t.t)}<span class="tname" title="${esc(t.n)}">${esc(t.n)}</span></span></td>${s.map((v) =>
          `<td class="sc${hi > lo && v === (state.fantasy ? lo : hi) ? " best" : hi > lo && v === (state.fantasy ? hi : lo) ? " worst" : ""}">${v}</td>`).join("")}</tr>`;
      }).join("")}
      <tr class="tot"><td>Total</td>${order.map((n) => `<td class="${champs.includes(n) ? "best" : ""}">${pts(n)}</td>`).join("")}</tr></tbody>
    </table></div>`;

  return head(line) + `<div class="ep-body"><div class="pod">${pod}</div>${state.edit ? edTable(d, e, order) : table}${raceChart(d, e.ep)}</div>`;
}

// ── The race so far ─────────────────────────────────────────────────────────
// How far each contestant is behind the leader after every episode up to the
// one on show (on request: the lines end there), with a dot at each line's end (the
// leader runs flat along 0 at the top; the x axis always runs 1 to 10, so the
// race builds rightwards week by week): a smooth line in their colour (a monotone cubic Bézier, so it
// never overshoots a point, e.g. above the leader's 0 or past a real low),
// labelled at the
// end with the first three letters of their name, like the task table's
// columns, and their gap (the leader's total). Tap a line to bring it
// forward and fade the rest; tap a point to read it in the caption.

function raceChart(d, cur) {
  const end = cur; // the lines end at the episode on show
  const total = Object.fromEntries(d.names.map((n) => [n, [0]]));
  for (let e = 1; e <= end; e++) for (const n of d.names) total[n][e] = total[n][e - 1] + d.EPS[n][e];
  return `
    <div class="card race">
      <div class="card-head"><span>The race so far</span><span class="legend">points behind the leader</span></div>
      ${raceSvg({ names: d.names, cur, end, last: d.episodes.length, total: (n, e) => total[n][e], color: (n) => d.cast[n].color, label: (n) => n.slice(0, 3), unit: "points" })}
      <p class="rc-cap"></p>
    </div>`;
}

/**
 * The race chart's SVG, shared by Episodes (five contestants) and Standings
 * (every player, on each board): each line is one name's gap to the leader
 * after every episode up to `end`, with a dot at `cur` and an end label
 * (`label`, then the gap; the leader's total). Labels stay 15 apart, so the
 * plot grows taller with more names. `cls(n)` adds a class to a name's group.
 * `exact` (Standings): every label sits level with its line's end, with no
 * hairlines: names tied at the end share a row, side by side, and the y scale
 * is fitted to the rows (warp): each step between neighbouring rows gets 15px,
 * or 4px a point if that's more, and any dip below the last row half that, so
 * close finishes stay apart and a deep slump doesn't make the chart a canyon.
 */
export function raceSvg({ names, cur, end, last, total, color, label, unit, cls = () => "", exact = false, width = 340, minPlot = 0, measure = false }) {
  // Fantasy mode (flip.js): the leader is the lowest, so the race is run on
  // the totals turned negative; the totals shown stay as they are.
  const shown = total;
  if (state.fantasy) total = (n, e) => -shown(n, e);
  const eps = Array.from({ length: end }, (_, i) => i + 1);
  // The gap to the leader after each episode: 0 for the leader, negative below.
  const best = Object.fromEntries(eps.map((e) => [e, Math.max(...names.map((n) => total(n, e)))]));
  const gap = (n, e) => total(n, e) - best[e];
  const leaders = (e) => names.filter((n) => !gap(n, e));
  const sorted = (e) => [...names].sort((a, b) => total(b, e) - total(a, e));
  const rank = (e, name) => rankWithTies(sorted(e), (n) => total(n, e)).get(name);
  const deepest = Math.max(1, ...eps.flatMap((e) => names.map((n) => -gap(n, e))));
  const step = niceStep(deepest), yMin = exact ? -deepest : -Math.ceil(deepest / step) * step;
  // The end labels' rows: one per name, or (exact) one per gap at the end.
  const ends = sorted(end), rows = exact ? [...new Set(ends.map((m) => gap(m, end)))].map((g) => ends.filter((m) => gap(m, end) === g)) : ends.map((m) => [m]);
  // The plot fills the card, and is tall enough for every row 15 apart: by
  // count (pushed apart where they crowd), or (exact) by the warp, a scale
  // fitted to the rows: piecewise linear between them, 15px a step at least
  // (4px a point beyond that), and half that below the last row; stretched to
  // 148px if it comes out shorter.
  // Exact charts are drawn at their real width (`width`, measured), so text
  // is true size, inset 16px like the player race card's plot.
  const W = exact ? Math.round(width) : 340, L = exact ? 16 : 10, R = exact ? W - 16 : 330, T = 12;
  // (Exact) a row of tied names wraps after every two (on request), so it
  // can take more than one line, and the next row keeps clear of them all.
  const WRAP = exact ? 2 : Infinity, rowLines = (r) => Math.max(1, Math.ceil(r.length / WRAP));
  const depths = rows.map((r) => -gap(r[0], end)), KP = 4;
  const steps = depths.slice(1).map((dd, i) => Math.max(15 * rowLines(rows[i]), KP * (dd - depths[i])));
  const tail = Math.max((deepest - depths.at(-1)) * KP / 2, 15 * (rowLines(rows.at(-1)) - 1));
  // The plot is at least 148px, and at least `minPlot` (so a board's two
  // charts can be made the same height); `measure` returns just its height.
  const span = steps.reduce((a, b) => a + b, 0) + tail, plotH = Math.max(148, minPlot, Math.ceil(span)), fit = plotH / (span || 1);
  if (exact && measure) return plotH;
  const knots = steps.reduce((a, st) => [...a, a.at(-1) + st], [0]);
  const warp = (dd) => {
    const i = depths.findIndex((k, j) => j + 1 < depths.length && dd <= depths[j + 1]);
    return fit * (i < 0 ? knots.at(-1) + (dd - depths.at(-1)) * KP / 2 : knots[i] + (dd - depths[i]) / (depths[i + 1] - depths[i]) * steps[i]);
  };
  const B = exact ? T + plotH : Math.max(160, T + 15 * (names.length - 1)), H = B + 24;
  // The x axis always runs 1 to 10: the race starts at the left edge and
  // builds to the right week by week; episodes still to come are faint.
  // Labels: the short name just right of the line's end, then the
  // number right-aligned in a column (NAME is the widest name, DIG a digit's).
  // The plot fills the card (to R); only when the lines' ends would leave too
  // little room for the labels (late episodes) does the axis tighten just
  // enough to keep them to the right.
  const NAME = Math.max(...names.map((m) => label(m).length)) * 26 / 3, DIG = 7.4; // 26 for three letters
  const num = (m) => (gap(m, end) ? `−${-gap(m, end)}` : `${shown(m, end)}`);
  const numW = Math.max(...names.map((m) => num(m).length)) * DIG, per = Math.min(WRAP, Math.max(...rows.map((r) => r.length)));
  // Exact charts keep the labels in a fixed column at the right, the same
  // place every week: the number right-aligned, then the names (so a long
  // tie never pushes a number away from its line), and the lines run the
  // full width to meet them, the axis covering only the episodes scored.
  const namesW = per * (NAME + 6) - 6;
  const LBL = 14 + per * (NAME + 6) + numW + 4;
  const nameX = (lx, i) => (exact ? R - namesW : lx + 14) + i * (NAME + 6);
  const numX = (lx) => (exact ? R - namesW - 8 : lx + 14 + per * (NAME + 6) + numW);
  const xEnd = exact ? R - namesW - 8 - numW - 12 : Math.min(R, L + (W - LBL - L) * (last - 1) / Math.max(1, end - 1));
  const span1 = exact ? end : last;
  const y = (v) => (exact ? T + warp(-v) : T + (v / yMin) * (B - T));
  // Exact (fitted) charts label their gridlines (on request, "rethink the
  // horizontal grid lines": unlabelled, their uneven spacing on the fitted
  // scale said nothing). Round values of 1, 2, 5, 10, 20… points, about six
  // candidates, kept only where 22px clear of the top and of the last one
  // kept. Their values sit in a gutter at the left, right-aligned beside their
  // lines like an axis, so the race's lines start after it and never cross
  // them; the gridlines stop at the line ends, clear of the names.
  const kept = [];
  if (exact) {
    const gs = [1, 2, 5, 10, 20, 50, 100].find((v) => v >= deepest / 6) || 100;
    for (let v = -gs, last = T; v >= -deepest; v -= gs) if (y(v) - last >= 22) { kept.push(v); last = y(v); }
  }
  const gutter = kept.length ? Math.max(...kept.map((v) => `−${-v}`.length)) * DIG + 8 : 0, X0 = L + gutter;
  const x = (e) => (span1 > 1 ? X0 + ((e - 1) / (span1 - 1)) * (xEnd - X0) : xEnd);
  const f1 = (v) => v.toFixed(1);
  const ticks = Array.from({ length: Math.floor(-yMin / step + 1e-9) + 1 }, (_, i) => -i * step);
  let grid;
  if (exact) grid = kept.map((v) => `<line class="rc-grid" x1="${f1(X0)}" x2="${f1(xEnd)}" y1="${f1(y(v))}" y2="${f1(y(v))}"/><text class="rc-tick" x="${f1(X0 - 6)}" y="${f1(y(v) + 4)}" text-anchor="end">−${-v}</text>`).join("");
  else grid = ticks.filter((v) => v).map((v) => `<line class="rc-grid" x1="${L}" x2="${R}" y1="${f1(y(v))}" y2="${f1(y(v))}"/>`).join("");
  const xAxis = Array.from({ length: span1 }, (_, i) => i + 1).map((e) => `<text class="rc-axis${e === cur ? " now" : e > end ? " later" : ""}" x="${f1(x(e))}" y="${H - 6}" text-anchor="middle">${e}</text>`).join("");
  // End labels at each line's end, kept at least 15 apart: push down where
  // they crowd, cap the lowest at the plot's bottom (clear of the episode
  // numbers), then push up only the ones that still crowd. A hairline joins a moved label to its line.
  const labelY = {}, slot = {}, line = {};
  if (exact) for (const r of rows) r.forEach((m, i) => { labelY[m] = y(gap(m, end)); slot[m] = i % WRAP; line[m] = Math.floor(i / WRAP); });
  else {
    ends.forEach((m, i) => { labelY[m] = Math.max(y(gap(m, end)), i ? labelY[ends[i - 1]] + 15 : -Infinity); slot[m] = 0; });
    labelY[ends.at(-1)] = Math.min(labelY[ends.at(-1)], B);
    for (let i = ends.length - 2; i >= 0; i--) labelY[ends[i]] = Math.min(labelY[ends[i]], labelY[ends[i + 1]] - 15);
  }
  // Leader drawn last, so its line sits on top. Each name is one group
  // (data-who) so a tap can bring it forward and fade the rest.
  const lines = [...ends].reverse().map((name) => {
    const c = color(name), pts = eps.map((e) => [x(e), y(gap(name, e))]);
    const path = pts.length > 1 ? `<path class="rc-line" d="${smooth(pts)}"${exact ? ' pathLength="1"' : ""} style="stroke:${c}"/><path class="rc-tap" d="${smooth(pts)}"/>` : "";
    // One point on each line: the episode on show.
    const [dx, dy] = pts[cur - 1], dots = `<circle class="rc-pt now" cx="${f1(dx)}" cy="${f1(dy)}" r="4.5" style="fill:${c}"/>`;
    const [lx, ly] = pts.at(-1), ty = labelY[name];
    const lead = Math.abs(ty - ly) > 3 ? `<path class="rc-lead" d="M${f1(lx + 6)},${f1(ly)}L${f1(lx + 12)},${f1(ty)}" style="stroke:${c}"/>` : "";
    // Tied names (exact) sit side by side, two to a line; each draws the
    // row's number, in the same place on its first line, so it stays readable
    // whichever one is followed.
    const text = `<text class="rc-name" x="${f1(nameX(lx, slot[name]))}" y="${f1(ty + 4 + (line[name] || 0) * 15)}" style="fill:${c}">${esc(label(name))}</text>`
      + `<text class="rc-name rc-total${exact && !gap(name, end) ? " top" : ""}" x="${f1(numX(lx))}" y="${f1(ty + 4)}" text-anchor="end">${num(name)}</text>`;
    const hits = pts.map(([a, b], i) => {
      const e = i + 1, gg = gap(name, e);
      const say = `Ep ${e} · ${name} · ${shown(name, e)} ${unit} · ${gg ? `${-gg} behind ${listing(leaders(e))}` : leaders(e).length > 1 ? "joint leader" : "leading"} (${ord(rank(e, name))})`;
      return `<circle class="rc-hit" cx="${f1(a)}" cy="${f1(b)}" r="12" data-say="${esc(say)}"><title>${esc(say)}</title></circle>`;
    }).join("");
    // (Exact) how far behind they are at the week on show, for the legend.
    return `<g data-who="${esc(name)}"${exact ? ` data-behind="${-gap(name, cur)}"` : ""}${cls(name) ? ` class="${cls(name)}"` : ""}>${path}${dots}${lead}${text}${hits}</g>`;
  }).join("");
  const summary = ends.map((m) => `${m} ${gap(m, end) ? `${-gap(m, end)} behind` : `leads on ${shown(m, end)}`}`).join(", ");
  return `<svg viewBox="0 0 ${W} ${H}"${exact ? ` width="${W}" height="${H}"` : ""} role="img" aria-label="${esc(`${unit[0].toUpperCase()}${unit.slice(1)} behind the leader after episode ${end}: ${summary}`)}">${grid}${xAxis}${lines}</svg>`;
}
