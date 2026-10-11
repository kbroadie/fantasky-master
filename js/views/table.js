// Standings: week strip over a swiper of weeks; each slide a hero and the two boards (Show | League per place row).
import { esc, listing, tier, ord, fmtDay, fmtWhen, smooth, niceStep, state } from "../ui.js";
import { pickChooser } from "../edit.js";
import { barsCard, median } from "./cast.js";
import { raceSvg } from "./episodes.js";
import { pickStatus } from "../league.js";

export const stWeek = (d) => Math.min(Math.max(1, state.wk || d.weeksScored), d.episodes.length);

// Totals and ranks after week w
export function atWeek(d, w) {
  if (w > d.weeksScored) return d.weeksScored ? atWeek(d, d.weeksScored) : fantasyRanks(d.players);
  return fantasyRanks(d.players.map((p) => {
    const h = p.history[w - 1];
    return { ...p, show: h.show, league: h.league, showRank: h.showRank, leagueRank: h.leagueRank };
  }));
}
// Fantasy: ranks from the lowest (ties share)
function fantasyRanks(rows) {
  if (!state.fantasy) return rows;
  const rank = (p, k) => 1 + rows.filter((q) => q[k] < p[k]).length;
  return rows.map((p) => ({ ...p, showRank: rank(p, "show"), leagueRank: rank(p, "league") }));
}

export function boards(d, w) {
  const rows = atWeek(d, w), dir = state.fantasy ? -1 : 1;
  const by = (k) => [...rows].sort((a, b) => dir * (b[k] - a[k]) || a[`${k}Rank`] - b[`${k}Rank`] || a.name.localeCompare(b.name));
  return { show: by("show"), league: by("league") };
}

function leaders(rows, key) {
  const vals = rows.map((p) => p[key]), best = state.fantasy ? Math.min(...vals) : Math.max(...vals);
  return rows.filter((p) => p[key] === best).map((p) => p.name);
}

// How scoring works: the league's exact words (don't change). Icons in the task icons' line style.
const HOW_ICONS = {
  crown: "M3.5 11 2.5 5l3 3L8 3l2.5 5 3-3-1 6z M3.5 13.5h9",
  trophy: "M5 2.5h6v4a3 3 0 0 1-6 0z M5 3.75H3.25a1.9 1.9 0 0 0 2.1 3.1 M11 3.75h1.75a1.9 1.9 0 0 1-2.1 3.1 M8 9.5V12 M5.5 13.5h5 M6.5 12h3",
};
const TERMS = [
  { icon: "crown", name: "Show", rule: ["The player with the ", "most points", " at the end of the series wins, regardless of episode placements."], range: "0–25", unit: "pts per episode" },
  { icon: "trophy", name: "League", rule: ["The player with the ", "best episode placements", " throughout the series wins, regardless of points."], range: "1–5", unit: "pts per episode" },
];
const FANTASY_TERMS = [["most points", "fewest points"], ["best episode placements", "worst episode placements"]];
const terms = () => (state.fantasy ? TERMS.map((t, i) => ({ ...t, rule: [t.rule[0], FANTASY_TERMS[i][1], t.rule[2]] })) : TERMS);
const howCard = (t) => `<div class="card how-card ${t.name.toLowerCase()}">
    <div class="how-head">
      <span class="how-icon" aria-hidden="true"><svg class="how-ico" viewBox="0 0 16 16"><path d="${HOW_ICONS[t.icon]}"/></svg><i class="how-glint"></i></span>
      <h3 class="how-title"><span class="how-the">The</span><span class="how-name">${esc(t.name)}</span></h3>
    </div>
    <p class="how-rule">${esc(t.rule[0])}<strong>${esc(t.rule[1])}</strong>${esc(t.rule[2])}</p>
    <p class="how-range"><b>${esc(t.range)}</b><span>${esc(t.unit)}</span></p>
  </div>`;

function leaderLine(d, rows, w) {
  const show = leaders(rows, "show"), league = leaders(rows, "league"), final = d.complete && w === d.episodes.length;
  const verb = (names) => (final ? (names.length > 1 ? "win" : "wins") : (names.length > 1 ? "lead" : "leads"));
  const who = (names) => `<b>${esc(listing(names))}</b>`;
  const S = `<span class="st-show">The Show</span>`, L = `<span class="st-league">The League</span>`;
  if (listing(show) === listing(league)) return `<span>${who(show)} ${verb(show)} ${S} and ${L}</span>`;
  return `<span>${who(show)} ${verb(show)} ${S}</span><span>${who(league)} ${verb(league)} ${L}</span>`;
}

export function standingsHero(d, w = stWeek(d)) {
  const how = `<button type="button" class="st-how" aria-expanded="${state.how}" aria-controls="st-explain-${w}">How scoring works<i class="st-how-chev" aria-hidden="true"></i></button>
    <div class="st-explain" id="st-explain-${w}"><div><div class="how-grid">${terms().map(howCard).join("")}</div><button type="button" class="st-wl" aria-controls="welcome">New here? <span>Read the welcome</span></button></div></div>`;
  const kicker = `<div class="kicker">Series ${esc(state.key)} · ${esc(fmtDay.format(d.episodes[w - 1].air))}</div>`;
  if (w > d.weeksScored) return `${kicker}<h2 class="ep-title"><span class="ep-w"><span class="ep-t">Episode ${w}</span></span></h2><div class="ep-sub">Airs ${esc(fmtWhen.format(d.episodes[w - 1].air))}</div>${how}`;
  return `${kicker}<h2 class="ep-title"><span class="ep-w"><span class="ep-t">Episode ${w} Standings</span></span></h2><p class="st-leaders">${leaderLine(d, atWeek(d, w), w)}</p>${how}`;
}

// Welcome card: the host's words, lightly adapted; keep their jokes.
const TAB_ICONS = {
  Standings: '<rect x="2" y="14" width="7" height="11" rx="1" opacity=".7"/><rect x="10.5" y="8" width="7" height="17" rx="1"/><rect x="19" y="18" width="7" height="7" rx="1" opacity=".5"/><path d="M12 6l2-3 2 3 2-2-.5 4h-7L10 4Z"/>',
  Episodes: '<rect x="4" y="10" width="20" height="14" rx="2" opacity=".35"/><rect x="4" y="5.5" width="20" height="5" rx="1.5"/><path d="M12 14.5v7l6-3.5Z"/>',
  Cast: '<path d="M5 20v-8l4 4 5-8 5 8 4-4v8Z"/><rect x="5" y="21" width="18" height="3" rx="1"/>',
  "Series switcher": '<path d="M4 9.5h17M16 4.5l5 5-5 5M24 18.5H7M12 13.5l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};
const WL_TABS = [
  ["Standings", [
    "Both leaderboards side by side: <b>Show</b> and <b>League</b>. Tap <b>How scoring works</b> for a refresher.",
    "Tap the <b>Show</b> or <b>League</b> header to open its race chart: every player's gap to the leader, week by week. Tap a line to follow one player.",
    "Tap <b>Ep 1</b>, <b>Ep 2</b>… or swipe to see the standings after any episode.",
    "Tap any name to see their points and pick for every episode.",
  ]],
  ["Episodes", [
    "Task-by-task breakdown for every episode, and the race so far.",
    "Weekly cast winners beam in glory, while those who finish 5 or more points behind 4th place are acknowledged differently.",
  ]],
  ["Cast", [
    "Episode and task scores for every cast member.",
    "Radar charts showing how each cast member's prize, filmed and live task performances compare to every past contestant.",
    "Short bios because cast members are human beings who deserve to be recognized as such regardless of what Greg says.",
  ]],
  ["Series switcher", [
    "Tap the gold series number at the top to study the Series 21 results. Regardless of the numbers, Joel is the real MVP.",
  ]],
];
export function welcomeCard() {
  const tabs = WL_TABS.map(([name, lines]) => `
      <div class="wl-tab"><h4><svg viewBox="0 0 28 28" aria-hidden="true">${TAB_ICONS[name]}</svg>${name}</h4>
        <ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul></div>`).join("");
  return `
    <section class="card welcome" aria-labelledby="wl-title">
      <div class="card-head"><span>Welcome to Fantasky Master</span><button type="button" class="wl-x" aria-label="Close the welcome"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg></button></div>
      <div class="wl-body">
        <h3 class="wl-title" id="wl-title">How it works</h3>
        <ol class="wl-steps">
          <li><span class="wl-n">1</span><div><b>WhatsApp polls.</b> Vote in the 10 episode polls in our group chat. You can update your picks as often as you want before that episode's <a href="https://www.youtube.com/@Taskmaster" target="_blank" rel="noopener">YouTube livestream</a> starts. You'll hear in the group when the scores are updated.</div></li>
          <li><span class="wl-n">2</span><div><b>Two leaderboards.</b>
            <ul class="wl-boards">
              <li><b class="wl-show">The Show:</b> the player with the most points at the end of the series wins, regardless of episode placements. 0–25 pts per episode.</li>
              <li><b class="wl-league">The League:</b> the player with the best episode placements throughout the series wins, regardless of points. 1–5 pts per episode.</li>
            </ul></div></li>
          <li><span class="wl-n">3</span><div><b>Mandatory pick rule.</b> You must pick all 5 contestants at least once across the 10 episodes. The app shows a red <b class="wl-warn">“Must pick: …”</b> warning when you open your row if you're running out of free weeks!</div></li>
        </ol>
        <h4 class="wl-sub">App highlights</h4>
        <div class="wl-tabs">${tabs}</div>
        <button type="button" class="wl-x wl-done">Close</button>
      </div>
    </section>`;
}

export const weekTabs = (d) => d.episodes.map(({ ep }) =>
  `<button class="strip-tab${ep > d.weeksScored ? " tbd" : ""}${ep === d.weeksScored + 1 ? " next" : ""}" data-slide="${ep - 1}"><span>Ep ${ep}</span></button>`).join("");

// Unscored weeks have no boards except in edit mode (picks entered ahead)
export function standingsSlides(d) {
  return d.episodes.map(({ ep: w }) => `
    <section class="slide st-slide" data-week="${w}">
      <div class="hero st-hero${state.how ? " explain" : ""}">${standingsHero(d, w)}</div>
      ${w > d.weeksScored && !state.edit ? "" : board(d, w)}
    </section>`).join("");
}

// The way into the low-scores-win mode and back (flip.js), under every tab; the label follows the mode (styles.css)
export const EMBRACE = `<button class="embrace" type="button"><span class="em-fail">Embrace Failure</span><span class="em-win">Embrace Success</span></button>`;

// Board: head, optional race chart (state.stView; drawn at measured width by syncBoards), rows
function board(d, w) {
  const k = chartable(d, w) ? state.stView : null;
  return `<div class="card board"${k ? ` data-chart="${k}"` : ""}>
        <div class="st-head">
          <span class="st-rk" aria-hidden="true"></span>
          ${["show", "league"].map((b) => boardHead(d, w, b, k)).join("")}
        </div>
        <div class="st-chart"><div class="st-chart-in"><div class="card race st-race st-chart-plot${k ? ` ${k}` : ""}"></div></div></div>
        <div class="rows">${standingsRows(d, w)}</div>
      </div>`;
}
export const chartable = (d, w) => w <= d.weeksScored;
export function boardHead(d, w, b, k) {
  const icon = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${HOW_ICONS[b === "show" ? "crown" : "trophy"]}"/></svg>`;
  if (!chartable(d, w)) return `<span class="st-side ${b}">${icon}${BOARD[b]}</span>`;
  return `<button type="button" class="st-side ${b}${k === b ? " on" : ""}" data-board="${b}" aria-pressed="${k === b}" aria-label="${BOARD[b]}: ${k === b ? "show the standings" : "show the race so far"}">${icon}${BOARD[b]}</button>`;
}

// Per-player colours: OKLCH hues 24° apart, dealt alphabetically by a ~0.38 stride, alternating light and dark; same on both boards
const playerColor = (d) => {
  const order = d.players.map((q) => q.name).sort((a, b) => a.localeCompare(b)), n = order.length;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let k = Math.round(n * 0.382);
  while (gcd(k, n) !== 1) k++;
  return (m) => {
    const slot = (order.indexOf(m) * k) % n;
    return `oklch(${slot % 2 ? 0.7 : 0.84} 0.15 ${(20 + slot * 360 / n).toFixed(1)})`;
  };
};

// Board race: gap to the leader per week up to w; end labels level with lines (exact), shortest unique prefixes
export function boardChart(d, w, k, width) {
  const names = d.players.map((q) => q.name), by = Object.fromEntries(d.players.map((q) => [q.name, q]));
  let n = 3;
  while (n < 8 && new Set(names.map((m) => m.slice(0, n).toUpperCase())).size < names.length) n++;
  const opts = (b) => ({ names, cur: w, end: w, last: d.episodes.length, total: (m, e) => by[m].history[e - 1][b],
    color: playerColor(d), label: (m) => m.slice(0, n), unit: `${BOARD[b]} points`, exact: true, width });
  // Both boards' charts the same height (the taller's)
  const minPlot = Math.max(...["show", "league"].map((b) => raceSvg({ ...opts(b), measure: true })));
  const svg = raceSvg({ ...opts(k), minPlot });
  return `<div class="card-head"><span><b class="${k}">${BOARD[k]}</b> race so far</span><span class="legend st-behind">points behind the leader</span></div>${svg}<p class="rc-cap"></p>`;
}

// Place rows: fixed place column, then Show and League halves (buttons, data-p); --m is the gap meter
export function standingsRows(d, w = stWeek(d)) {
  const { show, league } = boards(d, w);
  const top = { show: Math.max(0, ...show.map((p) => p.show)), league: Math.max(0, ...league.map((p) => p.league)) };
  const low = { show: Math.min(...show.map((p) => p.show)), league: Math.min(...league.map((p) => p.league)) };
  const meter = (p, k) => (state.fantasy ? (top[k] > low[k] ? (top[k] - p[k]) / (top[k] - low[k]) : 1) : top[k] ? p[k] / top[k] : 0);
  const half = (p, side) => {
    const k = side === "show" ? "show" : "league", rank = p[`${k}Rank`];
    const num = `<span class="pc-num${rank === 1 ? " t1" : ""}">${p[k]}</span>`;
    const name = `<span class="pc-name"><span class="nm">${esc(p.name)}</span><svg class="chev" viewBox="0 0 10 6" aria-hidden="true"><path d="M1.25 1.25 5 4.75l3.75-3.5"/></svg></span>`;
    const say = `${p.name}, ${ord(rank)} in the ${side === "show" ? "Show" : "League"} with ${p[k]} points`;
    return `<button class="sd ${side === "show" ? "l" : "r"}" type="button" data-side="${side}" data-p="${esc(p.name)}" style="--m:${meter(p, k).toFixed(3)}" aria-expanded="false" aria-label="${esc(say)}">${name + num}</button>`;
  };
  return show.map((l, i) => {
    const r = league[i];
    return `
    <div class="pc${l.showRank === 1 || r.leagueRank === 1 ? " lead" : ""}">
      <div class="pc-head"><span class="pc-rank"><b class="${tier(i + 1)}">${i + 1}</b></span>${half(l, "show")}${half(r, "league")}</div>
      <div class="pc-more"><div></div></div>
    </div>`;
  }).join("");
}

// Pick rule (pickStatus) after week w, scored weeks only; red line atop an opened row
const MUST = { must: "Must pick", cannot: "Can't fit all", never: "Never picked" };
function mustLine(d, p, w) {
  const known = Math.min(w, d.weeksScored);
  const st = known && pickStatus(d.names, p.weeks.filter((x) => x.ep <= known).map((x) => x.pick), known);
  return st ? `<p class="xp-must">${MUST[st.kind]}: ${esc(listing(st.needed))}</p>` : "";
}

export function rowMore(d, name, side, w = stWeek(d)) {
  const p = atWeek(d, w).find((x) => x.name === name);
  if (!p) return "";
  const must = mustLine(d, p, w);
  if (state.edit) return must + pickChooser(d, p, w);
  const k = side === "show" ? "show" : "league";
  return `<div class="xp${must ? " warned" : ""}">${must}${state.xpView === "race" ? raceCard(d, p, w, k) : pointsCard(d, p, w, k)}</div>`;
}

// Opened half's bars: Cast's Points per episode for the player's picks on that board; other weeks dimmed
function pointsCard(d, p, w, k) {
  const upTo = Math.min(w, d.weeksScored);
  const max = k === "show" ? Math.max(1, ...d.contestants.flatMap((c) => c.eps.slice(0, d.weeksScored))) : 5;
  const all = d.players.flatMap((q) => q.weeks.filter((x) => x.scored && x.pick).map((x) => x[k]));
  const at = (ep) => {
    const x = p.weeks[ep - 1];
    if (!x) return null;
    const dim = ep !== w, color = x.pick ? d.cast[x.pick].color : "var(--t4)", tag = x.pick ? x.pick.slice(0, 3) : null;
    if (!x.scored) return { tbd: true, dim, color: x.pick && color, tag };
    return { v: x.pick ? x[k] : 0, won: state.fantasy ? !!x.pick && lastIn(d, ep, x.pick) : !!x.won, dim, color, tag: tag || "–" };
  };
  return barsCard(d, at, max, median(all), `var(--${k}-hi)`, swapTitle(k, "points per episode", "race"));
}

const BOARD = { show: "Show", league: "League" };
export const lastIn = (d, ep, c) => d.EPS[c][ep] === Math.min(...d.names.map((n) => d.EPS[n][ep]));
const SWAP = `<svg class="swap" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 4h8M7 1.5 9.5 4 7 6.5M10.5 8h-8M5 5.5 2.5 8 5 10.5"/></svg>`;
// Card title flips bars ↔ race (state.xpView)
const swapTitle = (k, rest, to) => `<button class="xp-swap" type="button" data-xp="${to}" aria-label="${BOARD[k]} ${rest}: show the ${to === "race" ? "race so far" : "points per episode"} instead"><span><b class="${k}">${BOARD[k]}</b> ${rest}</span>${SWAP}</button>`;

function raceCard(d, p, w, k) {
  const upTo = Math.min(w, d.weeksScored), sgn = state.fantasy ? -1 : 1, pts = (q) => sgn * q.history[upTo - 1][k];
  const behind = upTo ? Math.max(...d.players.map(pts)) - pts(p) : null;
  return `<div class="card jr-card">
      <div class="card-head">${swapTitle(k, "race so far", "bars")}<span class="legend">${behind == null ? "" : `${behind} `}behind the leader</span></div>
      ${journey(d, p, k, w)}
    </div>`;
}

// Opened half's race: every player's gap to the leader, only this player highlighted; SVG stretched, gridlines and axis in HTML
function journey(d, p, side, w) {
  const k = side, upTo = Math.min(w, d.weeksScored), end = upTo, last = d.episodes.length;
  const eps = Array.from({ length: end }, (_, i) => i + 1);
  // Fantasy: run on the totals turned negative
  const shown = (q, e) => q.history[e - 1][k], total = state.fantasy ? (q, e) => -shown(q, e) : shown;
  const best = (e) => Math.max(...d.players.map((q) => total(q, e)));
  const gap = (q, e) => total(q, e) - best(e);
  const deepest = Math.max(1, ...eps.flatMap((e) => d.players.map((q) => -gap(q, e))));
  const step = niceStep(deepest), yMin = -Math.ceil(deepest / step) * step;
  const x = (e) => ((e - 1) / Math.max(1, last - 1)) * 100, y = (v) => (v / yMin) * 100, f = (v) => v.toFixed(2);
  const grid = Array.from({ length: Math.round(-yMin / step) }, (_, i) => `<i class="jr-grid" style="--y:${f(y(-(i + 1) * step))}%"></i>`).join("");
  const pts = (q) => eps.map((e) => [x(e), y(gap(q, e))]);
  const others = d.players.filter((q) => q.name !== p.name);
  const svg = (cls, paths) => `<svg class="jr-lines ${cls}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
  const lines = end > 1 ? svg("jr-others", others.map((q) => `<path d="${smooth(pts(q))}"/>`).join("")) + svg("jr-me", `<path d="${smooth(pts(p))}"/>`)
      + `<i class="jr-dot me" style="--x:${f(x(upTo))}%;--y:${f(y(gap(p, upTo)))}%"></i>`
    : end ? others.map((q) => `<i class="jr-dot" style="--x:0%;--y:${f(y(gap(q, 1)))}%"></i>`).join("") + `<i class="jr-dot me" style="--x:0%;--y:${f(y(gap(p, 1)))}%"></i>` : "";
  const g = upTo ? gap(p, upTo) : 0;
  const axis = d.episodes.map(({ ep }) => `<span class="${ep === upTo ? "now" : ep > end ? "later" : ""}" style="--x:${f(x(ep))}%">${ep}</span>`).join("");
  const board = BOARD[k], rank = upTo && 1 + d.players.filter((q) => total(q, upTo) > total(p, upTo)).length;
  const say = upTo ? `${p.name}: ${g ? `${-g} ${board} points behind the leader` : `leads the ${board} on ${shown(p, upTo)}`} after episode ${upTo}, ${ord(rank)}` : `${p.name}: no episodes scored yet`;
  return `<div class="jr ${k}" role="img" aria-label="${esc(say)}">
    <div class="jr-plot">${grid}${lines}<div class="jr-ax" aria-hidden="true">${axis}</div></div>
  </div>`;
}
