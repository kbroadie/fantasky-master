// Episodes: Ep strip over episode slides; cast in studio seat order everywhere on the tab.
import { esc, ord, listing, framed, named, fmtDay, fmtWhen, icon, smooth, niceStep, state } from "../ui.js";
import { statsFor } from "../alltime.js";
import { rankWithTies } from "../league.js";
import { edTitle, edStrip, edTable } from "../edit.js";

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
      ${state.edit ? edTitle(e) : `<h2 class="ep-title"><span class="ep-w"><span class="ep-t">${esc(e.title || `Episode ${e.ep}`)}</span></span></h2>`}
      <div class="ep-sub">${line}</div>
    </div>${state.edit ? edStrip(d, e) : ""}`;
  if (e.ep > d.weeksScored) {
    // Unscored: just the head (edit mode: an editable task table once aired)
    const line = `${e.ep <= d.weeksAired ? "Aired" : "Airs"} ${esc(fmtWhen.format(e.air))}`;
    return head(line) + (state.edit && e.ep <= d.weeksAired ? `<div class="ep-body">${edTable(d, e, seated(d))}</div>` : "");
  }

  const w = d.winners[e.ep], wk = d.weekly[e.ep], pts = (n) => d.EPS[n][e.ep];
  // Fantasy: won by last place (all, if tied)
  const scores = d.names.map(pts), low = Math.min(...scores), high = Math.max(...scores);
  const champs = state.fantasy ? d.names.filter((n) => pts(n) === low) : [w.winner];
  const called = state.fantasy ? champs.reduce((a, n) => a + wk.by[n].length, 0) : wk.hits.length;
  const line = state.fantasy
    ? `Won by ${champs.map((n) => named(d.cast[n])).join(" and ")} with <b>${low}</b> · ${called ? `${called} of ${wk.voters} called it` : "nobody called it"}`
    : `Won by ${named(d.cast[w.winner])} with <b>${w.top}</b>${w.tiebreak ? " after a tiebreak" : ""}`
      + ` · ${called ? `${called} of ${wk.voters} called it` : "nobody called it"}`;

  const order = seated(d);
  const col = order.map((n) => d.idx[n]);
  // Stink only for last by 5+ (all tied lasts); fantasy swaps gold and stink
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

// The race so far: each contestant's gap to the leader up to the episode on show; x axis 1–10.

function raceChart(d, cur) {
  const end = cur;
  const total = Object.fromEntries(d.names.map((n) => [n, [0]]));
  for (let e = 1; e <= end; e++) for (const n of d.names) total[n][e] = total[n][e - 1] + d.EPS[n][e];
  return `
    <div class="card race">
      <div class="card-head"><span>The race so far</span><span class="legend">points behind the leader</span></div>
      ${raceSvg({ names: d.names, cur, end, last: d.episodes.length, total: (n, e) => total[n][e], color: (n) => d.cast[n].color, label: (n) => n.slice(0, 3), unit: "points" })}
      <p class="rc-cap"></p>
    </div>`;
}

// Race SVG shared by Episodes and Standings. Labels ≥15px apart. `exact` (Standings): labels level with line ends, ties share a row, y scale fitted to the rows (warp: ≥15px a step or 4px a point; half below the last row).
export function raceSvg({ names, cur, end, last, total, color, label, unit, cls = () => "", exact = false, width = 340, minPlot = 0, measure = false }) {
  // Fantasy: run on totals turned negative; shown totals unchanged
  const shown = total;
  if (state.fantasy) total = (n, e) => -shown(n, e);
  const eps = Array.from({ length: end }, (_, i) => i + 1);
  const best = Object.fromEntries(eps.map((e) => [e, Math.max(...names.map((n) => total(n, e)))]));
  const gap = (n, e) => total(n, e) - best[e];
  const leaders = (e) => names.filter((n) => !gap(n, e));
  const sorted = (e) => [...names].sort((a, b) => total(b, e) - total(a, e));
  const rank = (e, name) => rankWithTies(sorted(e), (n) => total(n, e)).get(name);
  const deepest = Math.max(1, ...eps.flatMap((e) => names.map((n) => -gap(n, e))));
  const step = niceStep(deepest), yMin = exact ? -deepest : -Math.ceil(deepest / step) * step;
  const ends = sorted(end), rows = exact ? [...new Set(ends.map((m) => gap(m, end)))].map((g) => ends.filter((m) => gap(m, end) === g)) : ends.map((m) => [m]);
  // Plot fills the card; exact charts drawn at real width (text true size), inset 16px; min 148px tall
  const W = exact ? Math.round(width) : 340, L = exact ? 16 : 10, R = exact ? W - 16 : 330, T = 12;
  // Exact: ties wrap two names a line
  const WRAP = exact ? 2 : Infinity, rowLines = (r) => Math.max(1, Math.ceil(r.length / WRAP));
  const depths = rows.map((r) => -gap(r[0], end)), KP = 4;
  const steps = depths.slice(1).map((dd, i) => Math.max(15 * rowLines(rows[i]), KP * (dd - depths[i])));
  const tail = Math.max((deepest - depths.at(-1)) * KP / 2, 15 * (rowLines(rows.at(-1)) - 1));
  const span = steps.reduce((a, b) => a + b, 0) + tail, plotH = Math.max(148, minPlot, Math.ceil(span)), fit = plotH / (span || 1);
  if (exact && measure) return plotH;
  const knots = steps.reduce((a, st) => [...a, a.at(-1) + st], [0]);
  const warp = (dd) => {
    const i = depths.findIndex((k, j) => j + 1 < depths.length && dd <= depths[j + 1]);
    return fit * (i < 0 ? knots.at(-1) + (dd - depths.at(-1)) * KP / 2 : knots[i] + (dd - depths[i]) / (depths[i + 1] - depths[i]) * steps[i]);
  };
  const B = exact ? T + plotH : Math.max(160, T + 15 * (names.length - 1)), H = B + 24;
  // The axis tightens only when line ends leave too little room for labels
  const NAME = Math.max(...names.map((m) => label(m).length)) * 26 / 3, DIG = 7.4;
  const num = (m) => (gap(m, end) ? `−${-gap(m, end)}` : `${shown(m, end)}`);
  const numW = Math.max(...names.map((m) => num(m).length)) * DIG, per = Math.min(WRAP, Math.max(...rows.map((r) => r.length)));
  // Exact: fixed label column at the right, number then names; axis only to episodes scored
  const namesW = per * (NAME + 6) - 6;
  const LBL = 14 + per * (NAME + 6) + numW + 4;
  const nameX = (lx, i) => (exact ? R - namesW : lx + 14) + i * (NAME + 6);
  const numX = (lx) => (exact ? R - namesW - 8 : lx + 14 + per * (NAME + 6) + numW);
  const xEnd = exact ? R - namesW - 8 - numW - 12 : Math.min(R, L + (W - LBL - L) * (last - 1) / Math.max(1, end - 1));
  const span1 = exact ? end : last;
  const y = (v) => (exact ? T + warp(-v) : T + (v / yMin) * (B - T));
  // Exact: labelled gridlines at round values (1, 2, 5, 10…), ≥22px apart, in a left gutter
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
  // End labels ≥15 apart: push down, cap at the bottom, push up; hairline when moved
  const labelY = {}, slot = {}, line = {};
  if (exact) for (const r of rows) r.forEach((m, i) => { labelY[m] = y(gap(m, end)); slot[m] = i % WRAP; line[m] = Math.floor(i / WRAP); });
  else {
    ends.forEach((m, i) => { labelY[m] = Math.max(y(gap(m, end)), i ? labelY[ends[i - 1]] + 15 : -Infinity); slot[m] = 0; });
    labelY[ends.at(-1)] = Math.min(labelY[ends.at(-1)], B);
    for (let i = ends.length - 2; i >= 0; i--) labelY[ends[i]] = Math.min(labelY[ends[i]], labelY[ends[i + 1]] - 15);
  }
  // Leader drawn last (on top); one g[data-who] per name for tap-to-follow
  const lines = [...ends].reverse().map((name) => {
    const c = color(name), pts = eps.map((e) => [x(e), y(gap(name, e))]);
    const path = pts.length > 1 ? `<path class="rc-line" d="${smooth(pts)}"${exact ? ' pathLength="1"' : ""} style="stroke:${c}"/><path class="rc-tap" d="${smooth(pts)}"/>` : "";
    const [dx, dy] = pts[cur - 1], dots = `<circle class="rc-pt now" cx="${f1(dx)}" cy="${f1(dy)}" r="4.5" style="fill:${c}"/>`;
    const [lx, ly] = pts.at(-1), ty = labelY[name];
    const lead = Math.abs(ty - ly) > 3 ? `<path class="rc-lead" d="M${f1(lx + 6)},${f1(ly)}L${f1(lx + 12)},${f1(ty)}" style="stroke:${c}"/>` : "";
    // Each tied name draws the row's number, so it reads whichever is followed
    const text = `<text class="rc-name" x="${f1(nameX(lx, slot[name]))}" y="${f1(ty + 4 + (line[name] || 0) * 15)}" style="fill:${c}">${esc(label(name))}</text>`
      + `<text class="rc-name rc-total${exact && !gap(name, end) ? " top" : ""}" x="${f1(numX(lx))}" y="${f1(ty + 4)}" text-anchor="end">${num(name)}</text>`;
    const hits = pts.map(([a, b], i) => {
      const e = i + 1, gg = gap(name, e);
      const say = `Ep ${e} · ${name} · ${shown(name, e)} ${unit} · ${gg ? `${-gg} behind ${listing(leaders(e))}` : leaders(e).length > 1 ? "joint leader" : "leading"} (${ord(rank(e, name))})`;
      return `<circle class="rc-hit" cx="${f1(a)}" cy="${f1(b)}" r="12" data-say="${esc(say)}"><title>${esc(say)}</title></circle>`;
    }).join("");
    return `<g data-who="${esc(name)}"${exact ? ` data-behind="${-gap(name, cur)}"` : ""}${cls(name) ? ` class="${cls(name)}"` : ""}>${path}${dots}${lead}${text}${hits}</g>`;
  }).join("");
  const summary = ends.map((m) => `${m} ${gap(m, end) ? `${-gap(m, end)} behind` : `leads on ${shown(m, end)}`}`).join(", ");
  return `<svg viewBox="0 0 ${W} ${H}"${exact ? ` width="${W}" height="${H}"` : ""} role="img" aria-label="${esc(`${unit[0].toUpperCase()}${unit.slice(1)} behind the leader after episode ${end}: ${summary}`)}">${grid}${xAxis}${lines}</svg>`;
}
