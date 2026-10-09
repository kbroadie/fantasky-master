// Wiring: loads the CSV, renders all three pages up front (so switching tabs
// is instant), and handles the tabs, swipers, sorting, series toggle and the
// countdown. Routes look like #/22/episodes/4 and #/22/cast/Nina.
import { loadText, parseCSV, buildSeries } from "./csv.js";
import { initEdit } from "./edit.js";
import { derive, currentSeriesKey } from "./league.js";
import { $, $$, esc, reducedMotion, state, fmtWhen, until, perEpisodeStats, footer } from "./ui.js";
import { standingsSlides, stWeek, weekTabs, rowMore, boardChart, boardHead, chartable, welcomeCard, QUOTE } from "./views/table.js";
import { epTabs, epSlides } from "./views/episodes.js";
import { castOrder, castTabs, castSlides } from "./views/cast.js";
import { mountPodiumFx } from "./podium-fx.js";
import { loadStats, allTimePerEpisode } from "./alltime.js";
import { initFlip, askTilt, turned, toggleFantasy, DESKTOP } from "./flip.js";

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
  // On a desktop the quote sits under every tab, so fantasy mode switches from anywhere (on request)
  if (!$("#dq").children.length) $("#dq").innerHTML = QUOTE;
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
  toTop();
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

// ── Turned over (fantasy mode, flip.js) ──────────────────────────────────────
// Upside down the whole page may be turned round (180°, or a quarter turn in
// a landscape page): the body is then a fixed, rotated box and main scrolls
// inside it, and anything measured on the screen is turned back into the
// page's own directions.

/** What scrolls the page: the window, or main while the page is turned. */
const scroller = () => (turned() ? $("main") : window);
/** Back to the top of the page (smoothly, unless reduced motion). */
function toTop(smooth = false) {
  const sc = scroller();
  if ((sc === window ? scrollY : sc.scrollTop) > 0) sc.scrollTo({ top: 0, behavior: smooth && !reducedMotion ? "smooth" : "auto" });
}
/** A movement on the screen (dx, dy) in the page's own directions. */
function local(dx, dy) {
  const t = turned();
  return t === 180 ? [-dx, -dy] : t === 90 ? [dy, -dx] : t === -90 ? [-dy, dx] : [dx, dy];
}
/** An element's top in the page (from the scroller's top), whichever way it's turned. */
function topIn(el) {
  let y = 0;
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
  return y;
}

// Sideways (a quarter turn, html.fz-side), Chrome's own touch scrolling picks
// the scroller by the swipe's direction on the screen rather than in the
// turned page, so nothing scrolls (measured; upside down, at 180°, the axes
// only flip and it works). There the page scrolls itself (touch-action: none
// in the CSS): a drag moves main, or the sideways scroller under the finger,
// a flick carries on, and a swiper settles on the next slide or back, as
// scroll snapping would. edgeNav still sees the touches.
const sideTurned = () => Math.abs(turned()) === 90;
const sideScroller = (el) => [".swiper", ".strip.scroll", ".tt-wrap"].map((q) => el.closest?.(q)).find((s) => s && s.scrollWidth > s.clientWidth + 1);
// Tuned to feel like the browser's own (on request: "doesn't work as effortlessly"):
// a 6px start, a slight lean to sideways swipes, a light flick enough to
// change slide, the settle matched to the flick's speed, a long coast, and a
// tap that stops the page moving doesn't also open what's under it.
let drag = null, coast = 0, settleRaf = 0, settling = null, eatClick = false;
document.addEventListener("touchstart", (e) => {
  const moving = !!(coast || settleRaf);
  cancelAnimationFrame(coast); cancelAnimationFrame(settleRaf);
  coast = settleRaf = 0;
  if (!sideTurned() || e.touches.length > 1) { drag = null; return; }
  const t = e.touches[0];
  drag = { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, axis: null, el: null, target: e.target, moves: [], moving };
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!drag) return;
  const t = e.touches[0];
  if (!drag.axis) {
    const [tx, ty] = local(t.clientX - drag.x0, t.clientY - drag.y0);
    if (Math.hypot(tx, ty) < 6) return;
    const across = sideScroller(drag.target);
    drag.axis = across && Math.abs(tx) > Math.abs(ty) * 0.85 ? "x" : "y";
    drag.el = drag.axis === "y" ? $("main") : across;
    if (drag.el?.classList.contains("swiper")) {
      // Carrying on from a slide still settling: count from where it was going.
      drag.from = settling?.el === drag.el ? Math.round(settling.to / drag.el.clientWidth) : idxOf(drag.el);
      if (settling?.el === drag.el) settling = null;
      drag.el.style.scrollSnapType = "none";
    }
  }
  const [dx, dy] = local(t.clientX - drag.x, t.clientY - drag.y), d = drag.axis === "x" ? dx : dy;
  drag.x = t.clientX; drag.y = t.clientY;
  if (!drag.el) return;
  if (drag.axis === "x") drag.el.scrollLeft -= d; else drag.el.scrollTop -= d;
  drag.moves.push([e.timeStamp, d]);
}, { passive: true });
/** Slide a swiper to `to` (px), easing out at about the speed it was flicked (px/ms). */
function settle(el, to, speed = 0) {
  const from = el.scrollLeft, dist = Math.abs(to - from), t0 = performance.now();
  const ms = reducedMotion || dist < 1 ? 0 : Math.max(140, Math.min(320, (3 * dist) / Math.max(Math.abs(speed), 0.9)));
  settling = { el, to };
  const frame = (now) => {
    const k = ms ? Math.min(1, (now - t0) / ms) : 1;
    el.scrollLeft = from + (to - from) * (1 - (1 - k) ** 3);
    if (k < 1) settleRaf = requestAnimationFrame(frame);
    else { settleRaf = 0; settling = null; el.style.scrollSnapType = ""; }
  };
  settleRaf = requestAnimationFrame(frame);
}
function dragEnd(e) {
  const g = drag;
  drag = null;
  if (!g) return;
  if (!g.el) {
    if (g.moving && !g.axis) eatClick = true; // a tap to stop the page, not to open what's under it
    if (settling) settle(settling.el, settling.to); // a slide that was settling carries on
    return;
  }
  if (settling && settling.el !== g.el) settle(settling.el, settling.to);
  // The speed over the last 100ms (px/ms, positive forwards), timed from the
  // move before them, so even one late move counts; capped
  const k = g.moves.findIndex(([at]) => e.timeStamp - at < 100), span = k < 0 ? [] : g.moves.slice(Math.max(0, k - 1));
  const raw = span.length > 1 ? -span.slice(1).reduce((a, [, d]) => a + d, 0) / Math.max(16, e.timeStamp - span[0][0]) : 0;
  const v = Math.max(-8, Math.min(8, raw));
  const el = g.el, x = g.axis === "x", get = () => (x ? el.scrollLeft : el.scrollTop), put = (n) => { if (x) el.scrollLeft = n; else el.scrollTop = n; };
  if (el.classList.contains("swiper")) {
    const w = el.clientWidth, moved = el.scrollLeft / w - g.from, n = el.children.length;
    // A flick goes on to the next slide its way, however short; a slow drag past halfway does too.
    const step = Math.abs(v) > 0.2 ? Math.sign(v) : moved > 0.5 ? 1 : moved < -0.5 ? -1 : 0;
    settle(el, Math.max(0, Math.min(n - 1, g.from + step)) * w, v);
    return;
  }
  // Anything else coasts on, slowing down
  let speed = reducedMotion ? 0 : v, last = performance.now();
  const frame = (now) => {
    const dt = now - last;
    last = now;
    const before = get();
    put(before + speed * dt);
    speed *= 0.975 ** (dt / 16);
    if (Math.abs(speed) > 0.02 && get() !== before) coast = requestAnimationFrame(frame);
    else coast = 0;
  };
  if (speed) coast = requestAnimationFrame(frame);
}
document.addEventListener("click", (e) => { if (eatClick) { eatClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener("touchend", dragEnd, { passive: true });
document.addEventListener("touchcancel", dragEnd, { passive: true });
/** Every page drawn again (fantasy mode on or off), on the same week, episode and contestant. */
function redraw() {
  const key = $("#cast-tabs .on")?.textContent;
  renderStandings(state.d);
  renderSlides(state.d);
  const i = castOrder(state.d).findIndex((c) => c.key === key);
  if (i >= 0) state.cast = i;
  for (const sw of [ST, EP, CAST]) if ($(sw.body).offsetParent) jump(sw, sw.get()); else mark(sw, sw.get(), false);
  writeHash();
}
/**
 * The row is as tall as the slide on screen, but never stops short of the
 * bottom of the screen, so you can swipe anywhere below a short slide.
 */
function fit(body) {
  const s = body.children[idxOf(body)];
  if (!s) return;
  const pad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
  // Leave room for the footer, so a short slide ends with it at the bottom of the screen.
  const view = turned() ? $("main").clientHeight : innerHeight;
  const toBottom = view - topIn(body) - pad - ($("#foot")?.offsetHeight || 0) - ($(".fz-foot")?.offsetHeight || 0) - ($("#dq")?.offsetHeight || 0); // the ducks, or upside down the dolphins, and a desktop's quote
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
    [x0, y0] = [e.touches[0].clientX, e.touches[0].clientY];
    prev = can.prev(); next = can.next();
  }, { passive: true });
  el.addEventListener("touchcancel", () => { x0 = null; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const [dx, dy] = local(e.changedTouches[0].clientX - x0, e.changedTouches[0].clientY - y0);
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
  // The device's time zone after the countdown, as at the episode's air time
  // (on request): "PDT", "BST", or "GMT-7" where a locale has no short name.
  const tz = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(e.air).find((p) => p.type === "timeZoneName")?.value || "";
  el.innerHTML = `<span class="cd-pill"><span class="cd-what" id="cd-what"></span> <span class="cd-left" id="cd-left"></span><span class="cd-tz" id="cd-tz">${esc(tz)}</span></span>`;
  el.setAttribute("aria-label", `Episode ${e.ep} airs ${fmtWhen.format(e.air)}`);
  let last = "";
  const tick = () => {
    const ms = e.air - Date.now();
    const html = ms > 0 ? until(ms).map(([n, u]) => `<b>${n}</b><small>${u}</small>`).join(" ") : "";
    if (html === last) return;
    last = html;
    $("#cd-what").textContent = ms > 0 ? `Ep ${e.ep} airs in` : `Ep ${e.ep} is on air`;
    $("#cd-left").innerHTML = html;
    $("#cd-tz").hidden = ms <= 0;
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

// A desktop's quote under every tab switches fantasy mode (on request)
$("#dq").addEventListener("click", (e) => { if (e.target.closest(".st-quote")) toggleFantasy(); });
$("#p-standings").addEventListener("click", (e) => {
  // The welcome card: ✕ (or Close at its end) hides it for good on this
  // device, back at the top of the page; "Read the welcome" under the How
  // scoring works cards shows it again and scrolls up to it.
  if (e.target.closest(".wl-x")) {
    $("#welcome").hidden = true;
    try { localStorage.setItem("fm-welcome", "closed"); } catch {}
    fit($("#st-body"));
    toTop();
    return;
  }
  if (e.target.closest(".st-wl")) {
    $("#welcome").hidden = false;
    fit($("#st-body"));
    toTop(true);
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
  // The upside-down quote under the board: on an iPhone, the tap that asks
  // for the tilt, so the upside-down dream can be stumbled on.
  // On a desktop (a mouse, no tilt), clicking it switches fantasy mode on and off (on request).
  if (e.target.closest(".st-quote")) { if (DESKTOP.matches) toggleFantasy(); else askTilt(); return; }
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
    glideEnd?.(); // settle a row still gliding, so this one starts from where things are
    const row = sd.closest(".pc"), side = sd.dataset.side, open = row.classList.contains("open") && row.dataset.open === side;
    state.open = open ? null : { side, name: sd.dataset.p, wk: +row.closest(".st-slide").dataset.week };
    for (const b of $$("#st-body .board.ease")) b.classList.remove("ease");
    const board = row.closest(".board");
    board.classList.add("ease");
    if (open) slideShut(board, row, syncAll);
    else glide(board, syncAll);
  }
});

// Rows opening and closing (on request, "smoother"): the layout changes at
// once and only transforms move, so the GPU slides the rows and nothing is
// repainted (animating the card's height repainted every row below it, and
// its grained background, on every frame). Opening, the rows below start
// where they were, over the new card, and glide down to their places,
// uncovering it (FLIP: First, Last, Invert, Play); closing, they glide up
// over the card and only then does it fold away. Moving rows are lifted
// over the opened card (.board.glide) only while they move, so no row is a
// layer of its own for longer than that.
const GLIDE_MS = 300;
let glideEnd = null;
/** Run `change` (rows opening or closing), then slide the board's rows from where they were to where they are. */
function glide(board, change) {
  glideEnd?.();
  const rows = [...board.querySelectorAll(".rows > .pc")], before = rows.map((r) => r.offsetTop), height = board.offsetHeight;
  change();
  if (reducedMotion) return;
  const moved = rows.filter((r, i) => {
    const dy = before[i] - r.offsetTop;
    if (Math.abs(dy) < 1) return false;
    r.style.transform = `translateY(${dy}px)`;
    return true;
  });
  // The board's bottom edge follows its last row (a clip, eased the same
  // way), so it never shows a band the rows haven't reached yet; with no rows
  // below (the last row opening), it sweeps down over the new card.
  const grow = board.offsetHeight - height;
  if (!moved.length && grow <= 0) return;
  if (grow > 0) board.style.clipPath = `inset(0 0 ${grow}px 0 round 12px)`;
  board.offsetHeight; // the rows' starting places, before the transition starts
  board.classList.add("glide");
  for (const r of moved) r.style.transform = "";
  if (grow > 0) board.style.clipPath = "inset(0 0 0 0 round 12px)";
  const t = setTimeout(() => glideEnd?.(), GLIDE_MS + 40);
  glideEnd = () => { clearTimeout(t); board.classList.remove("glide"); board.style.clipPath = ""; glideEnd = null; };
}
/** Close an opened row: the rows below glide up over its card (or, for the last row, the board's bottom edge sweeps up over it), then `finish` folds it away. */
function slideShut(board, row, finish) {
  glideEnd?.();
  const below = [];
  for (let r = row.nextElementSibling; r; r = r.nextElementSibling) below.push(r);
  if (reducedMotion) { glide(board, finish); return; }
  const h = row.querySelector(".pc-more").offsetHeight;
  // The row reads as closed at once (its line folds back into the chevron,
  // the other cells come forward); only its height waits for the rows.
  delete row.dataset.open;
  for (const b of row.querySelectorAll(".sd")) b.setAttribute("aria-expanded", "false");
  board.classList.remove("focus");
  board.style.clipPath = "inset(0 0 0 0 round 12px)";
  board.offsetHeight;
  board.classList.add("glide");
  for (const r of below) r.style.transform = `translateY(${-h}px)`;
  board.style.clipPath = `inset(0 0 ${h + 1}px 0 round 12px)`; // the bottom edge comes up with the last row (and its 1px border)
  const t = setTimeout(() => glideEnd?.(), GLIDE_MS);
  glideEnd = () => {
    clearTimeout(t);
    board.classList.remove("glide"); // no transition while the rows go back to no transform
    finish();
    for (const r of below) r.style.transform = "";
    board.style.clipPath = "";
    glideEnd = null;
  };
}

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
  // Measured on the screen, then turned into the row's own direction if the page is turned (fantasy mode).
  const c = chev.getBoundingClientRect(), r = row.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2, t = turned();
  const x = t === 180 ? r.right - cx : t === 90 ? cy - r.top : t === -90 ? r.bottom - cy : cx - r.left;
  row.style.setProperty("--cx", `${x.toFixed(1)}px`);
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
// The same whichever scrolls the page: the window, or main while it's turned
// over (on request: the bar compacts and hides upside down as it does upright).
function barScroll() {
  if (!hraf) hraf = requestAnimationFrame(() => {
    hraf = 0;
    const sc = scroller(), top = sc === window ? scrollY : sc.scrollTop;
    const max = sc === window ? document.documentElement.scrollHeight - innerHeight : sc.scrollHeight - sc.clientHeight;
    const y = Math.max(0, Math.min(top, max)), dy = y - lastY;
    lastY = y;
    const on = bar.classList.contains("compact");
    bar.classList.toggle("compact", on ? y > 4 : y > 16);
    if (y < 120) { down = up = 0; return setHidden(false); }
    if (dy > 0) { down += dy; up = 0; if (down > 12) setHidden(true); }
    else if (dy < 0) { up -= dy; down = 0; if (up > 8) setHidden(false); }
  });
}
addEventListener("scroll", barScroll, { passive: true });
$("main").addEventListener("scroll", barScroll, { passive: true });
bar.addEventListener("focusin", () => setHidden(false)); // never hide what the keyboard is on
// The dolphins' footer (fantasy mode) animates only while it's on screen:
// its leaps cost even off screen.
new IntersectionObserver(([e]) => e.target.classList.toggle("run", e.isIntersecting)).observe($(".fz-foot"));
/** The page was put back at the top (turned over or back): the bar open and shown. */
function barAtTop() { lastY = 0; down = up = 0; bar.classList.remove("compact"); setHidden(false); }

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
  if (reducedMotion || state.page !== "standings" || turned()) return;
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
  initFlip({ redraw, scrolled: barAtTop });
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
