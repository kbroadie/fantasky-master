// Standings: a strip of weeks (Ep 1–10) over a swiper of weeks, like Episodes:
// each slide an "Episode 4 Standings" headline and the leaders, then both
// boards side by side as they stood after that week: each row is a place, the
// Show's player on the left and the League's on the right. A week not yet
// scored is "Episode 5 Picks": the boards as they stand now. Tapping a player
// opens their card under the row.
import { esc, listing, tier, ord, fmtDay, fmtWhen, smooth, niceStep, state } from "../ui.js";
import { pickChooser } from "../edit.js";
import { barsCard, median } from "./cast.js";
import { raceSvg } from "./episodes.js";
import { pickStatus } from "../league.js";

/** The week on show: state.wk, or the latest scored week. */
export const stWeek = (d) => Math.min(Math.max(1, state.wk || d.weeksScored), d.episodes.length);

/**
 * Each player as the table stood after week w: totals and ranks (from
 * league.js's per-week history).
 */
export function atWeek(d, w) {
  // Weeks not yet scored: the table as it stands now.
  if (w > d.weeksScored) return d.weeksScored ? atWeek(d, d.weeksScored) : d.players;
  return d.players.map((p) => {
    const h = p.history[w - 1];
    return { ...p, show: h.show, league: h.league, showRank: h.showRank, leagueRank: h.leagueRank };
  });
}

/** Both boards at week w, each highest first (then by rank and name). */
export function boards(d, w) {
  const rows = atWeek(d, w);
  const by = (k) => [...rows].sort((a, b) => b[k] - a[k] || a[`${k}Rank`] - b[`${k}Rank`] || a.name.localeCompare(b.name));
  return { show: by("show"), league: by("league") };
}

/** Everyone on the top score of a board (ties share the lead). */
function leaders(rows, key) {
  const top = Math.max(...rows.map((p) => p[key]));
  return rows.filter((p) => p[key] === top).map((p) => p.name);
}

/** "How scoring works", under the leaders line, opens both of these. */
// The league's words, unchanged, in their order: the title, the rule, the
// range. The crown and trophy are drawn in the same gold line style as the
// task icons (16px grid), not emoji.
const HOW_ICONS = {
  crown: "M3.5 11 2.5 5l3 3L8 3l2.5 5 3-3-1 6z M3.5 13.5h9",
  trophy: "M5 2.5h6v4a3 3 0 0 1-6 0z M5 3.75H3.25a1.9 1.9 0 0 0 2.1 3.1 M11 3.75h1.75a1.9 1.9 0 0 1-2.1 3.1 M8 9.5V12 M5.5 13.5h5 M6.5 12h3",
};
const TERMS = [
  { icon: "crown", name: "Show", rule: ["The player with the ", "most points", " at the end of the series wins, regardless of episode placements."], range: "0–25", unit: "pts per episode" },
  { icon: "trophy", name: "League", rule: ["The player with the ", "best episode placements", " throughout the series wins, regardless of points."], range: "1–5", unit: "pts per episode" },
];
const howCard = (t) => `<div class="card how-card ${t.name.toLowerCase()}">
    <div class="how-head">
      <span class="how-icon" aria-hidden="true"><svg class="how-ico" viewBox="0 0 16 16"><path d="${t.path || HOW_ICONS[t.icon]}"/></svg><i class="how-glint"></i></span>
      <h3 class="how-title"><span class="how-the">The</span><span class="how-name">${esc(t.name)}</span></h3>
    </div>
    <p class="how-rule">${esc(t.rule[0])}<strong>${esc(t.rule[1])}</strong>${esc(t.rule[2])}</p>
    ${t.tiers ? `<div class="how-range how-tiers">${t.tiers.map(([v, u]) => `<p><b>${v}</b><span>${u}</span></p>`).join("")}</div>`
      : `<p class="how-range"><b>${esc(t.range)}</b><span>${esc(t.unit)}</span></p>`}
  </div>`;

/** "Riley leads The Show   Jamie leads The League" ("wins" once the series is over). */
function leaderLine(d, rows, w) {
  const show = leaders(rows, "show"), league = leaders(rows, "league"), final = d.complete && w === d.episodes.length;
  const verb = (names) => (final ? (names.length > 1 ? "win" : "wins") : (names.length > 1 ? "lead" : "leads"));
  const who = (names) => `<b>${esc(listing(names))}</b>`;
  const S = `<span class="st-show">The Show</span>`, L = `<span class="st-league">The League</span>`;
  if (listing(show) === listing(league)) return `<span>${who(show)} ${verb(show)} ${S} and ${L}</span>`;
  return `<span>${who(show)} ${verb(show)} ${S}</span><span>${who(league)} ${verb(league)} ${L}</span>`;
}

/**
 * The hero: "Episode 4 Standings" and who leads each board; for a week not yet
 * scored, just "Episode 5" and when it airs.
 */
export function standingsHero(d, w = stWeek(d)) {
  const how = `<button type="button" class="st-how" aria-expanded="${state.how}" aria-controls="st-explain-${w}">How scoring works<i class="st-how-chev" aria-hidden="true"></i></button>
    <div class="st-explain" id="st-explain-${w}"><div><div class="how-grid">${TERMS.map(howCard).join("")}</div><button type="button" class="st-wl" aria-controls="welcome">New here? <span>Read the welcome</span></button></div></div>`;
  // The kicker, like the episode head's: the series and that week's episode.
  const kicker = `<div class="kicker">Series ${esc(state.key)} · ${esc(fmtDay.format(d.episodes[w - 1].air))}</div>`;
  if (w > d.weeksScored) return `${kicker}<h2 class="ep-title">Episode ${w}</h2><div class="ep-sub">Airs ${esc(fmtWhen.format(d.episodes[w - 1].air))}</div>${how}`;
  return `${kicker}<h2 class="ep-title">Episode ${w} Standings</h2><p class="st-leaders">${leaderLine(d, atWeek(d, w), w)}</p>${how}`;
}

/**
 * The welcome card (on request: the host's welcome message, in the app): how
 * the league works and what's where. It sits at the top of the Standings, over
 * the weeks (#welcome), on a device's first visit (in place of How scoring
 * works opening by itself) until it's closed (its ✕, or Close at the end);
 * a quiet line under the How scoring works cards brings it back (on request,
 * somewhere subtler than the button it first had beside How scoring works). Static text, the host's words lightly
 * adapted for the page.
 */
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

/** Ep 1–10, like the episode strip; weeks not yet scored are faint. */
export const weekTabs = (d) => d.episodes.map(({ ep }) =>
  `<button class="strip-tab${ep > d.weeksScored ? " tbd" : ""}${ep === d.weeksScored + 1 ? " next" : ""}" data-slide="${ep - 1}"><span>Ep ${ep}</span></button>`).join("");

/**
 * One slide per week (in #st-body): that week's hero, then both boards. A week not
 * yet scored has no boards (on request: they only repeated the last scored week),
 * except in edit mode, where its opened halves take that week's picks.
 */
export function standingsSlides(d) {
  return d.episodes.map(({ ep: w }) => `
    <section class="slide st-slide" data-week="${w}">
      <div class="hero st-hero${state.how ? " explain" : ""}">${standingsHero(d, w)}</div>
      ${w > d.weeksScored && !state.edit ? "" : board(d, w)}
    </section>`).join("");
}

/**
 * The board: its head, then either the rows or, while a head is pressed
 * (state.stView), that board's race chart above them, pushing them down
 * (boardChart): a card inset like an opened row's (the player race card's
 * frame, head and gridlines). The chart is drawn at its measured width, so
 * main.js fills it in (syncBoards).
 */
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
/** Only a scored week has a race to draw (an unscored one has a board only in edit mode). */
export const chartable = (d, w) => w <= d.weeksScored;
/** A head: the board's crown or trophy and name; a button that swaps the rows for its race chart, and back. */
export function boardHead(d, w, b, k) {
  const icon = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${HOW_ICONS[b === "show" ? "crown" : "trophy"]}"/></svg>`;
  if (!chartable(d, w)) return `<span class="st-side ${b}">${icon}${BOARD[b]}</span>`;
  return `<button type="button" class="st-side ${b}${k === b ? " on" : ""}" data-board="${b}" aria-pressed="${k === b}" aria-label="${BOARD[b]}: ${k === b ? "show the standings" : "show the race so far"}">${icon}${BOARD[b]}</button>`;
}

/**
 * Each player's colour in the race charts (on request: "more colorful"): the
 * same in both boards and every week, so a player can be followed from one to
 * the other. The hues are spaced evenly round the colour wheel (24° apart for
 * 15 players), dealt out in alphabetical order by a stride of about 0.38 of
 * the way round (so names next to each other land far apart), and hues next
 * to each other on the wheel alternate light and dark. OKLCH keeps every hue
 * equally vivid on the dark card.
 */
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

/**
 * A board's race (on request: the Episodes tab's "The race so far", for every
 * player), shown in place of the rows while its head is pressed: each
 * player's gap to that board's leader after every scored week, with a dot at
 * the week on show. Each end label sits level with its line (exact: no
 * hairlines; tied players share a row, and the chart is as tall as that
 * takes): the shortest prefix that tells every player apart, then the gap.
 * Each player has their own colour (playerColor), as each contestant has on
 * Episodes; tap a line to follow it.
 */
export function boardChart(d, w, k, width) {
  const names = d.players.map((q) => q.name), by = Object.fromEntries(d.players.map((q) => [q.name, q]));
  let n = 3;
  while (n < 8 && new Set(names.map((m) => m.slice(0, n).toUpperCase())).size < names.length) n++;
  // The lines end at the week on show (on request).
  const opts = (b) => ({ names, cur: w, end: w, last: d.episodes.length, total: (m, e) => by[m].history[e - 1][b],
    color: playerColor(d), label: (m) => m.slice(0, n), unit: `${BOARD[b]} points`, exact: true, width });
  // The Show's and League's charts are the same height each week (the taller's).
  const minPlot = Math.max(...["show", "league"].map((b) => raceSvg({ ...opts(b), measure: true })));
  const svg = raceSvg({ ...opts(k), minPlot });
  // The legend reads like the player race card's: "4 behind the leader" for
  // the player being followed (main.js), "points behind the leader" until then.
  return `<div class="card-head"><span><b class="${k}">${BOARD[k]}</b> race so far</span><span class="legend st-behind">points behind the leader</span></div>${svg}<p class="rc-cap"></p>`;
}

/**
 * One row per place: the place number in a fixed column at the left (it never
 * moves or changes), then the Show's player at that place and
 * the League's, each as name then points. Each half is a button that opens that player's
 * card (rowMore), keyed by player (data-p).
 *
 * Each half is also a gap meter (on request): a wash in the board's colour
 * behind it, filled in proportion to the player's points against the
 * board's leader (--m).
 */
export function standingsRows(d, w = stWeek(d)) {
  const { show, league } = boards(d, w);
  const top = { show: Math.max(0, ...show.map((p) => p.show)), league: Math.max(0, ...league.map((p) => p.league)) };
  // Last place on each board (not when the board is level): a tap lets off the stink (main.js, flip.js). Unmarked.
  const low = { show: Math.min(...show.map((p) => p.show)), league: Math.min(...league.map((p) => p.league)) };
  const half = (p, side) => {
    const k = side === "show" ? "show" : "league", rank = p[`${k}Rank`];
    const num = `<span class="pc-num${rank === 1 ? " t1" : ""}">${p[k]}</span>`;
    const name = `<span class="pc-name"><span class="nm">${esc(p.name)}</span><svg class="chev" viewBox="0 0 10 6" aria-hidden="true"><path d="M1.25 1.25 5 4.75l3.75-3.5"/></svg></span>`;
    const say = `${p.name}, ${ord(rank)} in the ${side === "show" ? "Show" : "League"} with ${p[k]} points`;
    return `<button class="sd ${side === "show" ? "l" : "r"}" type="button" data-side="${side}" data-p="${esc(p.name)}"${p[k] === low[k] && low[k] < top[k] ? " data-kn" : ""} style="--m:${top[k] ? (p[k] / top[k]).toFixed(3) : 0}" aria-expanded="false" aria-label="${esc(say)}">${name + num}</button>`;
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

/**
 * The pick-every-contestant rule (league.js pickStatus), as it stood after
 * the week on show: "Must pick" once every poll left is needed to fit in the
 * contestants a player hasn't picked, "Can't fit all" once they can't all
 * fit, "Never picked" once the series is over. Only scored weeks count, so
 * picks made ahead can still change. Shown in red at the top of an opened
 * row (on request; it was first under the name in the row itself).
 */
const MUST = { must: "Must pick", cannot: "Can't fit all", never: "Never picked" };
function mustLine(d, p, w) {
  const known = Math.min(w, d.weeksScored);
  const st = known && pickStatus(d.names, p.weeks.filter((x) => x.ep <= known).map((x) => x.pick), known);
  return st ? `<p class="xp-must">${MUST[st.kind]}: ${esc(listing(st.needed))}</p>` : "";
}

/** What an opened half shows: the player's points or race card (their pick chooser in edit mode), under any pick-rule warning. */
export function rowMore(d, name, side, w = stWeek(d)) {
  const p = atWeek(d, w).find((x) => x.name === name);
  if (!p) return "";
  const must = mustLine(d, p, w);
  if (state.edit) return must + pickChooser(d, p, w);
  const k = side === "show" ? "show" : "league";
  return `<div class="xp${must ? " warned" : ""}">${must}${state.xpView === "race" ? raceCard(d, p, w, k) : pointsCard(d, p, w, k)}</div>`;
}

/**
 * An opened half: the Cast tab's Points per episode card, for the player's
 * picks on the opened board ("Show points per episode" or "League points per
 * episode"). Each bar is the points their pick earned that episode on that
 * board (Show: the pick's score, on the Cast tab's scale; League: 5 to 1 by
 * the pick's place, out of 5), in the pick's colour, a gold number for a pick
 * that won, the pick's first three letters under it above the episode
 * number, and the median of every player's weekly points on that board.
 * Every week is shown, and every week but the one on show is faded (dim):
 * scored ones with their bars, later ones with just the picks already made.
 * The median is of every scored week.
 */
function pointsCard(d, p, w, k) {
  const upTo = Math.min(w, d.weeksScored);
  const max = k === "show" ? Math.max(1, ...d.contestants.flatMap((c) => c.eps.slice(0, d.weeksScored))) : 5;
  const all = d.players.flatMap((q) => q.weeks.filter((x) => x.scored && x.pick).map((x) => x[k]));
  const at = (ep) => {
    const x = p.weeks[ep - 1];
    if (!x) return null;
    const dim = ep !== w, color = x.pick ? d.cast[x.pick].color : "var(--t4)", tag = x.pick ? x.pick.slice(0, 3) : null;
    if (!x.scored) return { tbd: true, dim, color: x.pick && color, tag };
    return { v: x.pick ? x[k] : 0, won: !!x.won, dim, color, tag: tag || "–" };
  };
  return barsCard(d, at, max, median(all), `var(--${k}-hi)`, swapTitle(k, "points per episode", "race"));
}

const BOARD = { show: "Show", league: "League", knap: "Knappett" };
/** The swap icon, as on the series chip. */
const SWAP = `<svg class="swap" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 4h8M7 1.5 9.5 4 7 6.5M10.5 8h-8M5 5.5 2.5 8 5 10.5"/></svg>`;
/**
 * An opened half's card title is also its switch (on request): tapping it
 * flips the card between Points per episode and The race so far, with the
 * series chip's swap icon to say so. The choice holds for every row opened
 * after it (state.xpView), so players can be compared in the same view.
 * The board's name is in its colour (Show red, League blue).
 */
const swapTitle = (k, rest, to) => `<button class="xp-swap" type="button" data-xp="${to}" aria-label="${BOARD[k]} ${rest}: show the ${to === "race" ? "race so far" : "points per episode"} instead"><span><b class="${k}">${BOARD[k]}</b> ${rest}</span>${SWAP}</button>`;

/**
 * An opened half's other card: the Episodes tab's "The race so far", for
 * that board: every player's gap to the board's leader, only the opened
 * player's line highlighted (journey), and how far behind the leader they
 * are that week in the legend ("4 behind the leader"; just "4 behind" for
 * the Knappett, whose longer name leaves no room).
 */
function raceCard(d, p, w, k) {
  const upTo = Math.min(w, d.weeksScored), pts = (q) => q.history[upTo - 1][k];
  const behind = upTo ? Math.max(...d.players.map(pts)) - pts(p) : null;
  return `<div class="card jr-card">
      <div class="card-head">${swapTitle(k, "race so far", "bars")}<span class="legend">${behind == null ? "" : `${behind} `}behind${k === "knap" ? "" : " the leader"}</span></div>
      ${journey(d, p, k, w)}
    </div>`;
}



/**
 * An opened half: the race chart from the Episodes tab ("The race so far"),
 * for the players on the opened board, across the full width of the row.
 * Each player's gap to the board's leader in points after every episode: the
 * leader runs flat along the top, everyone else below, over the race chart's
 * gridlines (tidy steps from niceStep, none at 0), smoothed the same way
 * (`smooth`, monotone). Only the opened player is highlighted: their line in
 * the board's colour; every other player is a very thin, faint line. No line
 * labels. The x axis runs episode 1 to 10 edge to edge (this week in gold,
 * episodes not yet scored faint). The plot is stretched to the row (SVG with
 * preserveAspectRatio none and non-scaling strokes); the gridlines and axis
 * are HTML so they never stretch. The lines end at the week on show (on
 * request), with a dot on the opened player's line there.
 */
function journey(d, p, side, w) {
  const k = side, upTo = Math.min(w, d.weeksScored), end = upTo, last = d.episodes.length; // the lines end at the week on show (k: show, league or knap)
  const eps = Array.from({ length: end }, (_, i) => i + 1);
  const total = (q, e) => q.history[e - 1][k];
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
      + `<i class="jr-dot me" style="--x:${f(x(upTo))}%;--y:${f(y(gap(p, upTo)))}%"></i>` // the week on show
    // Episode 1, with no lines yet, keeps dots (as the race chart does).
    : end ? others.map((q) => `<i class="jr-dot" style="--x:0%;--y:${f(y(gap(q, 1)))}%"></i>`).join("") + `<i class="jr-dot me" style="--x:0%;--y:${f(y(gap(p, 1)))}%"></i>` : "";
  const g = upTo ? gap(p, upTo) : 0;
  const axis = d.episodes.map(({ ep }) => `<span class="${ep === upTo ? "now" : ep > end ? "later" : ""}" style="--x:${f(x(ep))}%">${ep}</span>`).join("");
  const board = BOARD[k], rank = upTo && 1 + d.players.filter((q) => total(q, upTo) > total(p, upTo)).length;
  const say = upTo ? `${p.name}: ${g ? `${-g} ${board} points behind the leader` : `leads the ${board} on ${total(p, upTo)}`} after episode ${upTo}, ${ord(rank)}` : `${p.name}: no episodes scored yet`;
  return `<div class="jr ${k}" role="img" aria-label="${esc(say)}">
    <div class="jr-plot">${grid}${lines}<div class="jr-ax" aria-hidden="true">${axis}</div></div>
  </div>`;
}

// ── The Knappett ─────────────────────────────────────────────────────────────

/**
 * Whoever has the most Knappett points (league.js, §6.12): they lead The
 * Knappett (on request: doing badly, ironically celebrated, after Jessica
 * Knappett's literal fall in Series 7). Nobody when everyone is level.
 */
function knappetts(rows) {
  const top = Math.max(...rows.map((p) => p.knap));
  return rows.every((p) => p.knap === top) ? [] : leaders(rows, "knap");
}
/** A line falling, in the task icons' style. */
const FALL = "M2 3.5 6.5 8l3-3 4.5 4.5 M10.5 9.5H14V6 M2.5 13.5h11";
/**
 * How the Knappett scores (on request), behind a How scoring works button
 * in the table's hero, like the Standings': one card in the Show and League
 * cards' pattern, olive, its points for each thing in the footer. Only in
 * the upside-down table, so the egg stays hidden.
 */
const KNAP_TERM = {
  path: FALL, name: "Knappett",
  rule: ["The player whose picks finish ", "furthest behind each episode's winner", " wins, with extra points for disqualifications and minus scores. Skipping a poll counts as the winner's whole score behind. Named for Jessica Knappett's fall in Series 7."],
  tiers: [["1", "per pt behind"], ["3", "per DQ"], ["3", "per minus score"]],
};

/**
 * The Knappett's own table (on request), shown when a phone or tablet is held
 * upside down on the Standings (flip.js), in place of the boards. An Easter
 * egg (on request): nothing else on the site mentions the Knappett. Like the
 * Standings (on request): the episode strip (weekTabs) over a swiper of
 * weeks, one slide each (knapWeek); flip.js binds them. `how` opens How
 * scoring works on every slide.
 */
export function knapTable(d, how = false) {
  return `<div class="strip scroll kt-strip">${weekTabs(d)}</div>
    <div class="swiper kt-swiper">${d.episodes.map(({ ep }) => `<section class="slide kt-slide" data-week="${ep}">${knapWeek(d, ep, how)}</section>`).join("")}</div>
    <p class="kt-back">Turn it back over for the standings</p>`;
}

/**
 * One week of the Knappett: everyone's Knappett points after that week, most
 * first, with that week's points beside them. Set like the Standings: the
 * hero's kicker and title, then one card of rows, a place column at the left
 * and a gap meter behind each row. Each row opens (on request) to that
 * player's cards (knapMore, drawn by flip.js as it opens). A week not yet
 * scored is just its hero and when it airs, as on the Standings.
 */
function knapWeek(d, wk, how) {
  const scored = wk <= d.weeksScored, final = d.complete && wk === d.episodes.length;
  const kicker = `<div class="kicker">Series ${esc(state.key)} · ${scored ? `After episode ${wk}` : `Episode ${wk}`}</div>`;
  const explain = `<button type="button" class="st-how kt-how" aria-expanded="${how}" aria-controls="kt-explain-${wk}">How scoring works<i class="st-how-chev" aria-hidden="true"></i></button>
    <div class="st-explain" id="kt-explain-${wk}"><div>${howCard(KNAP_TERM)}</div></div>`;
  const hero = (inner) => `<div class="hero kt-hero${how ? " explain" : ""}">${kicker}<h2 class="ep-title">The Knappett</h2>${inner}${explain}</div>`;
  if (!scored) return hero(`<div class="ep-sub">Airs ${esc(fmtWhen.format(d.episodes[wk - 1].air))}</div>`);
  const rows = d.players.map((p) => ({ p, name: p.name, knap: p.history[wk - 1].knap, week: p.weeks[wk - 1].knap.total }))
    .sort((a, b) => b.knap - a.knap || a.name.localeCompare(b.name));
  const kn = knappetts(rows), top = Math.max(1, rows[0].knap);
  const lead = kn.length ? `<p class="st-leaders"><span><b>${esc(listing(kn))}</b> ${final ? (kn.length > 1 ? "win" : "wins") : (kn.length > 1 ? "lead" : "leads")} <span class="st-knap">The Knappett</span></span></p>` : "";
  const body = rows.map((r, i) => `
      <div class="kt-item">
        <button type="button" class="kt-row" data-kp="${esc(r.name)}" aria-expanded="false" style="--m:${(r.knap / top).toFixed(3)}"><b class="kt-rk${tier(i + 1)}">${i + 1}</b><span class="kt-name"><span>${esc(r.name)}</span><svg class="kt-chev" viewBox="0 0 10 6" aria-hidden="true"><path d="M1.25 1.25 5 4.75l3.75-3.5"/></svg></span><span class="kt-wk">+${r.week}</span><span class="kt-pts${i === 0 && kn.length ? " lead" : ""}">${r.knap}</span></button>
        <div class="kt-more"><div></div></div>
      </div>`).join("");
  return `${hero(lead)}
    <div class="card kt-board" style="--n:${rows.length}">
      <div class="kt-head"><span></span><span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${FALL}"/></svg>Player</span><span>Ep ${wk}</span><span>Total</span></div>
      ${body}
    </div>`;
}

/**
 * An opened Knappett row (on request: "the same as the Show and League"):
 * the opened halves' cards, for the Knappett. Points per episode (each bar
 * that week's Knappett points, in the pick's colour, with the pick's letters
 * and the median of everyone's weeks) or, through the title's switch, the
 * race so far (each player's gap to the Knappett's leader). The switch is
 * the Standings' own (state.xpView).
 */
export function knapMore(d, p, w = stWeek(d)) {
  const wk = Math.min(w, d.weeksScored);
  if (!wk) return "";
  return `<div class="xp">${state.xpView === "race" ? raceCard(d, p, wk, "knap") : knapBars(d, p, wk)}</div>`;
}
function knapBars(d, p, w) {
  const all = d.players.flatMap((q) => q.weeks.filter((x) => x.scored).map((x) => x.knap.total));
  const at = (ep) => {
    const x = p.weeks[ep - 1];
    if (!x) return null;
    const dim = ep !== w, color = x.pick ? d.cast[x.pick].color : "var(--t4)", tag = x.pick ? x.pick.slice(0, 3) : null;
    if (!x.scored) return { tbd: true, dim, color: x.pick && color, tag };
    return { v: x.knap.total, dim, color, tag: tag || "–" };
  };
  return barsCard(d, at, Math.max(1, ...all), median(all), "var(--t3)", swapTitle("knap", "points per episode", "race"));
}
