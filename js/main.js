// Wiring: loads the CSV, renders all three pages up front (so switching tabs
// is instant), and handles the tabs, swipers, sorting, series toggle and the
// countdown. Routes look like #/22/episodes/4 and #/22/cast/Nina.
import { loadText, parseCSV, buildSeries } from "./csv.js";
import { initEdit } from "./edit.js";
import { derive, currentSeriesKey } from "./league.js";
import { $, $$, esc, reducedMotion, state, fmtWhen, until, perEpisodeStats, footer } from "./ui.js";
import { standingsSlides, stWeek, weekTabs, rowMore, boardChart, boardHead, chartable, welcomeCard } from "./views/table.js";
import { epTabs, epSlides } from "./views/episodes.js";
import { castOrder, castTabs, castSlides } from "./views/cast.js";
import { mountPodiumFx } from "./podium-fx.js";
import { loadStats, allTimePerEpisode } from "./alltime.js";

const PAGES = ["standings", "episodes", "cast"];
let SERIES = {}, CURRENT = null;

// ── Routing ──────────────────────────────────────────────────────────────────

function readHash() {
  const [, key, page, arg] = location.hash.replace(/^#/, "").split("/");
  return { key: SERIES[key] ? key : CURRENT, page: PAGES.includes(page) ? page : "standings", arg: arg ? decodeURIComponent(arg) : null };
}
function writeHash() {
  const arg = state.page === "standings" ? stWeek(state.d) : state.page === "episodes" ? state.ep : state.page === "cast" ? castOrder(state.d)[state.cast]?.key : null;
  history.replaceState(null, "", `#/${state.key}/${state.page}${arg != null ? `/${encodeURIComponent(arg)}` : ""}`);
}
function applyArg(page, arg) {
  if (arg == null) return;
  if (page === "standings" && +arg >= 1 && +arg <= state.d.episodes.length) state.wk = +arg;
  if (page === "episodes" && +arg >= 1 && +arg <= state.d.episodes.length) state.ep = +arg;
  if (page === "cast") state.cast = Math.max(0, castOrder(state.d).findIndex((c) => c.key === arg));
}

// ── Rendering ────────────────────────────────────────────────────────────────

function loadSeries(key) {
  const d = state.d = derive(SERIES[key], new Date());
  state.key = key;
  state.ep = Math.max(1, d.weeksScored);
  state.wk = d.weeksScored;
  state.cast = 0;
  const btn = $("#series");
  $("#series-num").textContent = key;
  btn.classList.toggle("multi", Object.keys(SERIES).length > 1);
  btn.classList.toggle("past", key !== CURRENT);
  btn.setAttribute("aria-label", `Series ${key}. Tap to switch series`);
  renderStandings(d);
  renderSlides(d);
  if (!$("#foot").children.length) $("#foot").innerHTML = footer();
  countdown();
}

/** Standings: the week strip and one slide per week; an opened player stays opened. */
function renderStandings(d) {
  $("#st-tabs").innerHTML = weekTabs(d);
  $("#st-body").innerHTML = standingsSlides(d);
  for (const s of $("#st-body").children) { sizes.observe(s); syncOpen(s); }
  if (state.stView) syncBoards(true);
  queueLight();
}

function renderSlides(d) {
  $("#ep-tabs").innerHTML = epTabs(d);
  $("#ep-body").innerHTML = epSlides(d);
  mountPodiumFx($("#ep-body"));
  $("#cast-tabs").innerHTML = castTabs(d);
  $("#cast-body").innerHTML = castSlides(d);
  mountPodiumFx($("#cast-body"));
  for (const id of ["#ep-body", "#cast-body"]) for (const s of $(id).children) sizes.observe(s);
}

/**
 * Edit mode (edit.js): re-render from the data file's new text, in place: the
 * Standings, Episodes and Cast slides are rebuilt on the same slide (and the
 * opened player stays opened).
 */
function refresh(text) {
  // Edit mode may redraw while a box has focus: put focus back on its new copy.
  const fk = document.activeElement?.dataset?.fk;
  SERIES = buildSeries(parseCSV(text));
  const d = state.d = derive(SERIES[state.key], new Date());
  renderStandings(d);
  renderSlides(d);
  for (const sw of [ST, EP, CAST]) if ($(sw.body).offsetParent) jump(sw, sw.get());
  else mark(sw, sw.get(), false);
  if (fk) $(`[data-fk="${CSS.escape(fk)}"]`)?.focus({ preventScroll: true });
}

function show(page) {
  state.page = page;
  const i = PAGES.indexOf(page);
  $(".tabs").style.setProperty("--i", i);
  $$(".tab").forEach((t, j) => t.setAttribute("aria-selected", j === i));
  $$(".page").forEach((p, j) => p.classList.toggle("active", j === i));
  scrollTo(0, 0);
  if (page === "standings") { jump(ST, ST.get()); queueLight(); }
  if (page === "episodes") jump(EP, state.ep - 1);
  if (page === "cast") jump(CAST, state.cast);
  writeHash();
}

// ── Swipers: a tab strip over a row of scroll-snapped slides ─────────────────

const ST = { body: "#st-body", tabs: "#st-tabs", get: () => stWeek(state.d) - 1, set: (i) => { state.wk = i + 1; queueLight(); } };
const EP = { body: "#ep-body", tabs: "#ep-tabs", get: () => state.ep - 1, set: (i) => { state.ep = i + 1; } };
const CAST = { body: "#cast-body", tabs: "#cast-tabs", get: () => state.cast, set: (i) => { state.cast = i; } };

const idxOf = (body) => Math.round(body.scrollLeft / body.clientWidth);
/**
 * The row is as tall as the slide on screen, but never stops short of the
 * bottom of the screen, so you can swipe anywhere below a short slide.
 */
function fit(body) {
  const s = body.children[idxOf(body)];
  if (!s) return;
  const pad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
  // Leave room for the footer, so a short slide ends with it at the bottom of the screen.
  const toBottom = innerHeight - (body.getBoundingClientRect().top + scrollY) - pad - ($("#foot")?.offsetHeight || 0);
  body.style.height = `${Math.max(s.offsetHeight, toBottom)}px`;
}
const sizes = new ResizeObserver((entries) => {
  for (const b of new Set(entries.map((e) => e.target.parentElement))) if (b?.isConnected) fit(b);
});

function mark(sw, i, smooth = true) {
  const tabs = $(sw.tabs), t = tabs.children[i];
  [...tabs.children].forEach((b, j) => b.classList.toggle("on", j === i));
  if (t) tabs.scrollTo({ left: t.offsetLeft - (tabs.clientWidth - t.offsetWidth) / 2, behavior: smooth && !reducedMotion ? "smooth" : "auto" });
  edges();
}
function jump(sw, i) {
  const body = $(sw.body);
  body.scrollLeft = i * body.clientWidth;
  mark(sw, i, false);
  fit(body);
}

// ── Swiping on into the neighbouring tab ─────────────────────────────────────
// A sideways swipe where a page can't scroll any further switches to the
// neighbouring tab. There's no visual hint while you pull.

function edgeNav(el, can, onEdge) {
  let x0 = null, y0 = 0, prev = false, next = false;
  el.addEventListener("touchstart", (e) => {
    if (e.target.closest(".strip")) { x0 = null; return; } // a tab strip scrolls sideways itself
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    prev = can.prev(); next = can.next();
  }, { passive: true });
  el.addEventListener("touchcancel", () => { x0 = null; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (prev && dx > 0) onEdge(-1);
    if (next && dx < 0) onEdge(1);
  }, { passive: true });
}

function bindSwiper(sw, onEdge, ends) {
  const body = $(sw.body);
  let raf = 0, settle = 0;
  body.addEventListener("scroll", () => {
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      const i = idxOf(body);
      if (i !== sw.get()) { sw.set(i); mark(sw, i); writeHash(); }
    });
    clearTimeout(settle);
    settle = setTimeout(() => fit(body), 120);
  }, { passive: true });
  $(sw.tabs).addEventListener("click", (e) => {
    const b = e.target.closest("[data-slide]");
    if (b) body.scrollTo({ left: b.dataset.slide * body.clientWidth, behavior: reducedMotion ? "auto" : "smooth" });
  });
  edgeNav(body, {
    prev: () => ends.prev && body.scrollLeft <= 2,
    next: () => ends.next && body.scrollLeft >= body.scrollWidth - body.clientWidth - 2,
  }, onEdge);
}

// ── Countdown: one line, "Ep 5 airs in 5d 18h" ──────────────────────────────

let timer = 0;

function countdown() {
  clearInterval(timer);
  const el = $("#cd"), e = state.d.nextEp;
  if (!e) {
    el.innerHTML = `<span class="cd-pill"><span class="cd-what">Series ${state.key}</span> <b>complete</b></span>`;
    el.removeAttribute("aria-label");
    return;
  }
  el.innerHTML = `<span class="cd-pill"><span class="cd-what" id="cd-what"></span> <span class="cd-left" id="cd-left"></span></span>`;
  el.setAttribute("aria-label", `Episode ${e.ep} airs ${fmtWhen.format(e.air)}`);
  let last = "";
  const tick = () => {
    const ms = e.air - Date.now();
    const html = ms > 0 ? until(ms).map(([n, u]) => `<b>${n}</b><small>${u}</small>`).join(" ") : "";
    if (html === last) return;
    last = html;
    $("#cd-what").textContent = ms > 0 ? `Ep ${e.ep} airs in` : `Ep ${e.ep} is on air`;
    $("#cd-left").innerHTML = html;
    if (ms <= 0) clearInterval(timer);
  };
  tick();
  timer = setInterval(tick, 1000);
}

// ── Events ───────────────────────────────────────────────────────────────────

$(".tabs").addEventListener("click", (e) => {
  const t = e.target.closest("[data-page]");
  if (t) show(t.dataset.page);
});

$("#series").addEventListener("click", () => {
  const keys = Object.keys(SERIES).sort((a, b) => a - b);
  loadSeries(keys[(keys.indexOf(state.key) + 1) % keys.length]);
  show(state.page);
});

$("#p-standings").addEventListener("click", (e) => {
  // The welcome card: ✕ hides it for good on this device; the Welcome button
  // beside How scoring works shows it again and scrolls up to it.
  if (e.target.closest(".wl-x")) {
    $("#welcome").hidden = true;
    try { localStorage.setItem("fm-welcome", "closed"); } catch {}
    fit($("#st-body"));
    return;
  }
  if (e.target.closest(".st-wl")) {
    $("#welcome").hidden = false;
    fit($("#st-body"));
    scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    return;
  }
  // "How scoring works": open both explanations; tap again to close. It stays
  // open as the week changes (state.how).
  const how = e.target.closest(".st-how");
  if (how) {
    state.how = !state.how;
    for (const h of $$("#st-body .st-hero")) {
      h.classList.toggle("explain", state.how);
      h.querySelector(".st-how")?.setAttribute("aria-expanded", state.how);
    }
    queueLight();
    return;
  }
  // A board's head (Show or League) swaps the rows for that board's race
  // chart, full width; the same head swaps back, the other switches boards.
  // It holds for every week (state.stView).
  const head = e.target.closest(".st-side[data-board]");
  if (head) {
    state.stView = state.stView === head.dataset.board ? null : head.dataset.board;
    // Like a row opening: only the board tapped on animates (.ease), and its
    // lines draw in; the other weeks just switch.
    for (const b of $$("#st-body .board.ease")) b.classList.remove("ease");
    const board = head.closest(".board");
    board.classList.add("ease");
    syncBoards(false, board);
    return;
  }
  // An opened half's card title flips it between Points per episode and The
  // race so far; the choice holds for every row opened after it.
  const swap = e.target.closest(".xp-swap");
  if (swap) {
    state.xpView = swap.dataset.xp;
    syncAll();
    return;
  }
  // A half of a row opens that player's picks under the row; tapping the
  // same half closes it, and the other half switches to their player. Only
  // the week on show opens; a row open in another week closes, without easing.
  const sd = e.target.closest(".pc .sd");
  if (sd) {
    const row = sd.closest(".pc"), side = sd.dataset.side, open = row.classList.contains("open") && row.dataset.open === side;
    state.open = open ? null : { side, name: sd.dataset.p, wk: +row.closest(".st-slide").dataset.week };
    for (const b of $$("#st-body .board.ease")) b.classList.remove("ease");
    row.closest(".board").classList.add("ease");
    syncAll();
  }
});

// ── Standings weeks ──────────────────────────────────────────────────────────
// A swiper of weeks, like Episodes (ST, bound below): swipe or tap the strip,
// and the neighbouring week slides in. An opened player (state.open) is opened
// in their week only; the other weeks stay closed.

/** Open a row on one side (its player's card), or close it (side null). */
function openRow(row, side) {
  if (side) {
    const name = row.querySelector(`.sd[data-side="${side}"]`)?.dataset.p;
    row.querySelector(".pc-more > div").innerHTML = rowMore(state.d, name, side, +row.closest(".st-slide").dataset.week);
    row.dataset.open = side;
    row.dataset.view = state.xpView;
    placeLine(row);
  } else delete row.dataset.open;
  row.classList.toggle("open", !!side);
  for (const b of row.querySelectorAll(".sd")) b.setAttribute("aria-expanded", b.dataset.side === side);
  // While anything is open, every other cell steps back.
  const board = row.closest(".card.board");
  board?.classList.toggle("focus", !!board.querySelector(".pc.open"));
}
/** Where the opened half's chevron sits (--cx, from the row's left): its line grows from there and keeps its notch there. */
function placeLine(row) {
  const chev = row.querySelector(`.sd[data-side="${row.dataset.open}"] .chev`);
  if (!chev) return;
  const c = chev.getBoundingClientRect();
  row.style.setProperty("--cx", `${(c.left + c.width / 2 - row.getBoundingClientRect().left).toFixed(1)}px`);
}
/** Bring a week's slide in line with state.open: that player's half open if it's this week, nothing else. */
function syncOpen(slide) {
  const o = state.open?.wk === +slide.dataset.week ? state.open : null;
  const want = o && [...slide.querySelectorAll(`.sd[data-side="${o.side}"]`)].find((b) => b.dataset.p === o.name)?.closest(".pc");
  for (const row of slide.querySelectorAll(".pc.open")) if (row !== want || row.dataset.open !== o.side) openRow(row, null);
  if (want && !(want.classList.contains("open") && want.dataset.open === o.side && want.dataset.view === state.xpView)) openRow(want, o.side);
}
/**
 * Apply state.stView to every week's board: its race chart in place of the
 * rows, or the rows. The chart is drawn at its real width, measured once (every
 * week's board is the same width); `force` redraws them all (a resize, or a
 * fresh render).
 */
function syncBoards(force = false, drawn = null) {
  let width = 0;
  for (const s of $$("#st-body .st-slide")) {
    const board = s.querySelector(".board"), w = +s.dataset.week;
    if (!board) continue;
    const k = chartable(state.d, w) ? state.stView : null, plot = board.querySelector(".st-chart-plot");
    if (!force && board.dataset.chart === (k || undefined) && (!k || plot.firstChild)) continue;
    if (k) board.dataset.chart = k; else delete board.dataset.chart;
    if (k && !width) width = plot.clientWidth;
    // Closing keeps the chart drawn while it folds away (like a row's card).
    if (k) {
      plot.classList.remove("show", "league");
      plot.classList.add(k);
      plot.innerHTML = boardChart(state.d, w, k, width);
      plot.classList.toggle("draw", board === drawn && !reducedMotion);
    }
    board.querySelector(".st-head").innerHTML = `<span class="st-rk" aria-hidden="true"></span>${["show", "league"].map((b) => boardHead(state.d, w, b, k)).join("")}`;
  }
}
/** Apply state.open: to its week, and to any week that still has a row open (closed at once). */
function syncAll() {
  for (const s of $$("#st-body .st-slide")) if (+s.dataset.week === state.open?.wk || s.querySelector(".pc.open")) syncOpen(s);
}

bindSwiper(ST, (dir) => {
  if (dir > 0) show("episodes");
}, { prev: false, next: true });
bindSwiper(EP, (dir) => {
  if (dir < 0) show("standings");
  else { state.cast = 0; show("cast"); }
}, { prev: true, next: true });
bindSwiper(CAST, (dir) => {
  if (dir < 0) { state.ep = state.d.episodes.length; show("episodes"); }
}, { prev: true, next: false });

// Task heat strip (Cast): tap an episode's slot in a row to read its tasks;
// tap it again to deselect it.
const heatTap = (e) => {
  const slot = e.target.closest("button.hs-slot");
  if (!slot) return;
  const card = slot.closest(".heat"), was = slot.classList.contains("on");
  for (const x of card.querySelectorAll(".hs-slot.on")) x.classList.remove("on");
  slot.classList.toggle("on", !was);
  slot.setAttribute("aria-pressed", !was);
  card.querySelector(".hs-cap").textContent = was ? "" : slot.dataset.say;
};
$("#cast-body").addEventListener("click", heatTap);

// The race charts (Episodes, and both boards' under each Standings week): tap
// a line, name or point to follow that contestant or player (their line comes
// forward, the rest fade); a point also reads out that week in the caption.
// Tap them again, or empty chart, to see everyone.
function raceTap(e) {
  const card = e.target.closest(".race");
  if (!card) return;
  const who = e.target.closest("g[data-who]"), hit = e.target.closest(".rc-hit");
  const cap = card.querySelector(".rc-cap"), svg = card.querySelector("svg");
  for (const x of card.querySelectorAll(".rc-hit.on")) x.classList.remove("on");
  const same = who && who.classList.contains("on") && !hit;
  for (const g of card.querySelectorAll("g[data-who].on")) g.classList.remove("on");
  if (!who || same) {
    card.classList.remove("focus");
    cap.textContent = "";
    setBehind(card, null);
    return;
  }
  who.classList.add("on");
  svg.append(who); // draw it on top
  card.classList.add("focus");
  if (hit) { hit.classList.add("on"); cap.textContent = hit.dataset.say; }
  else cap.textContent = "";
  setBehind(card, who);
}
/** A board race's legend, like the player race card's: the followed player's gap ("4 behind the leader"). */
function setBehind(card, who) {
  const leg = card.querySelector(".st-behind");
  if (leg) leg.textContent = who ? `${who.dataset.behind} behind the leader` : "points behind the leader";
}
$("#ep-body").addEventListener("click", raceTap);
$("#st-body").addEventListener("click", raceTap);

// Long task names are clamped to two lines; tap one to read it in full.
$("#ep-body").addEventListener("click", (e) => e.target.closest(".tname")?.classList.toggle("full"));

// The top bar compacts once you scroll, and hides while you scroll down
// (past its first screenful), coming back on any scroll up, like Safari's
// address bar; the sticky sub-tab strip stays, sliding up to the top. It's
// fixed over a spacer, so none of this moves the page (see .topbar in the
// CSS). The compact thresholds differ so it can't flicker at the boundary;
// hiding needs a deliberate 12px down, showing just 8px up, and the
// overscroll bounce at either end is ignored.
const bar = $(".topbar");
let hraf = 0, lastY = scrollY, down = 0, up = 0;
function setHidden(on) {
  bar.classList.toggle("hidden", on);
  document.body.classList.toggle("bar-hidden", on);
}
addEventListener("scroll", () => {
  if (!hraf) hraf = requestAnimationFrame(() => {
    hraf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = Math.max(0, Math.min(scrollY, max)), dy = y - lastY;
    lastY = y;
    const on = bar.classList.contains("compact");
    bar.classList.toggle("compact", on ? y > 4 : y > 16);
    if (y < 120) { down = up = 0; return setHidden(false); }
    if (dy > 0) { down += dy; up = 0; if (down > 12) setHidden(true); }
    else if (dy < 0) { up -= dy; down = 0; if (up > 8) setHidden(false); }
  });
}, { passive: true });
bar.addEventListener("focusin", () => setHidden(false)); // never hide what the keyboard is on

// A strip that scrolls sideways (Standings' weeks, Episodes) fades at the edge
// where more tabs are hidden (.more-l / .more-r), so it reads as scrollable.
function edges() {
  for (const s of $$(".strip.scroll")) {
    if (!s.offsetParent) continue;
    s.classList.toggle("more-l", s.scrollLeft > 2);
    s.classList.toggle("more-r", s.scrollLeft + s.clientWidth < s.scrollWidth - 2);
  }
}
document.addEventListener("scroll", (e) => { if (e.target.classList?.contains("strip")) edges(); }, { capture: true, passive: true });

// The scoring cards' light: its pool of colour shifts as the card moves up
// the screen (--lx), updated once a frame while scrolling.
let lraf = 0;
function cardLight() {
  lraf = 0;
  if (reducedMotion || state.page !== "standings") return;
  const cards = $(ST.body).children[ST.get()]?.querySelectorAll(".st-hero.explain .how-card") || []; // only the week on show
  if (!cards.length) return;
  const mid = innerHeight / 2;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    c.style.setProperty("--lx", Math.max(-1, Math.min(1, (r.top + r.height / 2 - mid) / mid)).toFixed(3));
  }
}
const queueLight = () => { if (!lraf) lraf = requestAnimationFrame(cardLight); };
addEventListener("scroll", queueLight, { passive: true });

addEventListener("resize", () => { for (const sw of [ST, EP, CAST]) if ($(sw.body).offsetParent) jump(sw, sw.get()); queueLight(); edges(); for (const r of $$("#st-body .pc.open")) placeLine(r); if (state.stView) syncBoards(true); });

addEventListener("hashchange", () => {
  const h = readHash();
  if (h.key !== state.key) loadSeries(h.key);
  applyArg(h.page, h.arg);
  show(h.page);
});

// ── Boot ─────────────────────────────────────────────────────────────────────

// The web fonts load alongside the data, so the page is first drawn in them
// rather than drawn in fallbacks and laid out again when they swap in. A slow
// font gives up after 1.2s from here and swaps in later.
const FACES = ["16px Bungee", "700 16px Nunito", "800 16px Nunito", "16px Inter", "600 16px Inter", "700 16px Inter", "800 16px Inter", "16px 'DM Mono'", "500 16px 'DM Mono'"];
const fontsIn = Promise.race([
  Promise.all(FACES.map((f) => document.fonts.load(f).catch(() => {}))),
  new Promise((r) => setTimeout(r, 1200)),
]);

// The tab bar is right from the first frame, before the data and fonts arrive:
// the selected tab's dark text over the gold panel (it had been grey there
// until loading finished), on the page the address asks for.
{
  const i = Math.max(0, PAGES.indexOf(location.hash.split("/")[2]));
  $(".tabs").style.setProperty("--i", i);
  $$(".tab").forEach((t, j) => t.setAttribute("aria-selected", j === i));
}

try {
  const [text, allTime] = await Promise.all([loadText(), loadStats(), fontsIn]);
  SERIES = buildSeries(parseCSV(text));
  CURRENT = currentSeriesKey(SERIES, new Date());
  // The radar compares against every contestant in Taskmaster history when
  // the all-time stats are available, otherwise against the league's series.
  state.allTime = allTime;
  state.stats = allTime.length ? allTimePerEpisode(allTime) : { ...perEpisodeStats(SERIES), n: 0 };
  // The welcome card shows at the top of the Standings until its ✕ is tapped
  // (remembered per device; on request, in place of How scoring works opening
  // by itself on a first visit). The Welcome button brings it back.
  let welcome = true;
  try { welcome = !localStorage.getItem("fm-welcome"); } catch {}
  $("#welcome").innerHTML = welcomeCard();
  $("#welcome").hidden = !welcome;
  const h = readHash();
  loadSeries(h.key);
  applyArg(h.page, h.arg);
  show(h.page);
  initEdit(text, refresh);
} catch (err) {
  console.error(err);
  $("#p-standings").innerHTML = `<p class="err">Couldn't load the league data. ${esc(err.message)}</p>`;
}
document.body.classList.remove("loading");
