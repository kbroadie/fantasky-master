// Wiring: data, render, tabs, swipers, bar, countdown. Routes: #/22/episodes/4, #/22/cast/Nina.
import { loadText, parseCSV, buildSeries } from "./csv.js";
import { initEdit } from "./edit.js";
import { derive, currentSeriesKey } from "./league.js";
import { $, $$, esc, reducedMotion, state, fmtWhen, until, perEpisodeStats, footer } from "./ui.js";
import { standingsSlides, stWeek, weekTabs, rowMore, boardChart, boardHead, chartable, welcomeCard, QUOTE } from "./views/table.js";
import { epTabs, epSlides } from "./views/episodes.js";
import { castOrder, castTabs, castSlides } from "./views/cast.js";
import { mountPodiumFx } from "./podium-fx.js";
import { loadStats, allTimePerEpisode } from "./alltime.js";
import { initFlip, quoteTap, turned, flipped, toggleFantasy, DESKTOP } from "./flip.js";

const PAGES = ["standings", "episodes", "cast"];
let SERIES = {}, CURRENT = null;

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
  if (!$("#dq").children.length) $("#dq").innerHTML = QUOTE;
  countdown();
}

function renderStandings(d) {
  $("#st-tabs").innerHTML = weekTabs(d);
  $("#st-body").innerHTML = standingsSlides(d);
  for (const s of $("#st-body").children) { sizes.observe(s); syncOpen(s); }
  if (state.stView) syncBoards(true);
  queueLight();
  fitTitles();
}

function renderSlides(d) {
  $("#ep-tabs").innerHTML = epTabs(d);
  $("#ep-body").innerHTML = epSlides(d);
  mountPodiumFx($("#ep-body"));
  $("#cast-tabs").innerHTML = castTabs(d);
  $("#cast-body").innerHTML = castSlides(d);
  mountPodiumFx($("#cast-body"));
  for (const id of ["#ep-body", "#cast-body"]) for (const s of $(id).children) sizes.observe(s);
  fitTitles();
}

// Fantasy titles: sparkles flank .ep-w, which is sized to its widest line so they hug the words.
function fitTitles() {
  const ts = state.fantasy ? $$(".ep-title .ep-w") : [];
  if (!ts.length) return;
  for (const t of ts) t.style.width = "";
  // offsetWidth, not screen rects: right however the page is turned
  const ws = ts.map((t) => (t.firstElementChild.getClientRects().length > 1 ? t.firstElementChild.offsetWidth + 1 : 0));
  ts.forEach((t, i) => { if (ws[i]) t.style.width = `${ws[i]}px`; });
}
// Turning sideways and back changes the width with no window resize
let pageW = 0;
new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w !== pageW) { pageW = w; fitTitles(); } }).observe($("main"));

// Edit mode: re-render from the new CSV text, keeping slide and open player.
function refresh(text) {
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
  document.body.dataset.page = page;
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

const ST = { body: "#st-body", tabs: "#st-tabs", get: () => stWeek(state.d) - 1, set: (i) => { state.wk = i + 1; queueLight(); } };
const EP = { body: "#ep-body", tabs: "#ep-tabs", get: () => state.ep - 1, set: (i) => { state.ep = i + 1; } };
const CAST = { body: "#cast-body", tabs: "#cast-tabs", get: () => state.cast, set: (i) => { state.cast = i; } };

const idxOf = (body) => Math.round(body.scrollLeft / body.clientWidth);

// Turned (fantasy): body is a fixed rotated box, main scrolls, screen measures are turned back.

// Flipped: main is turned but the window scrolls, so the reader's top is the document's bottom
const scroller = () => (turned() && !flipped() ? $("main") : window);
const maxY = () => document.documentElement.scrollHeight - innerHeight;
const readY = () => { const sc = scroller(); return sc !== window ? sc.scrollTop : flipped() ? maxY() - scrollY : scrollY; };
function toTop(smooth = false) {
  const sc = scroller(), behavior = smooth && !reducedMotion ? "smooth" : "auto";
  if (readY() > 0) sc.scrollTo({ top: flipped() ? maxY() : 0, behavior });
}
// Flipped: content changing height moves the reader's top, so the place is kept from there
let flipY = 0;
addEventListener("scroll", () => { if (flipped()) flipY = readY(); }, { passive: true });
new ResizeObserver(() => { if (flipped()) scrollTo(0, maxY() - flipY); }).observe($("main"));
// Flipped: sticky can't stick inside the turned main, so the strips ride in the (turned) bar
function placeStrips() {
  let moved = false;
  for (const [s, page] of [["#st-tabs", "#p-standings"], ["#ep-tabs", "#p-episodes"], ["#cast-tabs", "#p-cast"]].map(([a, b]) => [$(a), $(b)])) {
    if (flipped() && s.parentElement !== bar) { s.style.removeProperty("--p"); bar.append(s); moved = true; }
    else if (!flipped() && s.parentElement === bar) { page.prepend(s); moved = true; }
  }
  if (moved && state.d) for (const sw of [ST, EP, CAST]) mark(sw, sw.get(), false); // a move loses the strip's scroll
}
function turnedOver() {
  placeStrips();
  if (flipped()) { flipY = 0; scrollTo(0, maxY()); }
  barAtTop();
}
function local(dx, dy) {
  const t = turned();
  return t === 180 ? [-dx, -dy] : t === 90 ? [dy, -dx] : t === -90 ? [-dy, dx] : [dx, dy];
}
function topIn(el) {
  let y = 0;
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
  return y;
}

// Turned, the page scrolls itself (touch-action: none): sideways Chrome picks the wrong scroller, upside down it flings the wrong way.
const selfScroll = () => turned() !== 0;
const sideScroller = (el) => [".swiper", ".strip.scroll", ".tt-wrap"].map((q) => el.closest?.(q)).find((s) => s && s.scrollWidth > s.clientWidth + 1);
// Tuned to feel native: 6px start, sideways lean, light flicks change slide, eatClick stops tap-through.
let drag = null, coast = 0, coastV = 0, settleRaf = 0, settling = null, eatClick = false;
document.addEventListener("touchstart", (e) => {
  // Only visibly moving: a coast's slow tail (seconds of under a pixel a frame) swallowed taps on rows
  const moving = (coast && Math.abs(coastV) > 0.25) || (settleRaf && settling && Math.abs(settling.el.scrollLeft - settling.to) > 10);
  eatClick = false;
  cancelAnimationFrame(coast); cancelAnimationFrame(settleRaf);
  coast = settleRaf = 0;
  if (!selfScroll() || e.touches.length > 1) { drag = null; return; }
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
    if (drag.axis === "y" && flipped()) { drag = null; return; } // the phone scrolls the page itself
    drag.el = drag.axis === "y" ? $("main") : across;
    if (drag.el?.classList.contains("swiper")) {
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
    if (g.moving && !g.axis) eatClick = true;
    if (settling) settle(settling.el, settling.to);
    return;
  }
  if (settling && settling.el !== g.el) settle(settling.el, settling.to);
  // Speed over the last 100ms, timed from the move before them, so one late move counts
  const k = g.moves.findIndex(([at]) => e.timeStamp - at < 100), span = k < 0 ? [] : g.moves.slice(Math.max(0, k - 1));
  const raw = span.length > 1 ? -span.slice(1).reduce((a, [, d]) => a + d, 0) / Math.max(16, e.timeStamp - span[0][0]) : 0;
  const v = Math.max(-8, Math.min(8, raw));
  const el = g.el, x = g.axis === "x", get = () => (x ? el.scrollLeft : el.scrollTop), put = (n) => { if (x) el.scrollLeft = n; else el.scrollTop = n; };
  if (el.classList.contains("swiper")) {
    const w = el.clientWidth, moved = el.scrollLeft / w - g.from, n = el.children.length;
    const step = Math.abs(v) > 0.2 ? Math.sign(v) : moved > 0.5 ? 1 : moved < -0.5 ? -1 : 0;
    settle(el, Math.max(0, Math.min(n - 1, g.from + step)) * w, v);
    return;
  }
  let speed = reducedMotion ? 0 : v, last = performance.now();
  const frame = (now) => {
    const dt = now - last;
    last = now;
    const before = get();
    put(before + speed * dt);
    speed *= 0.998 ** dt; // iOS's own deceleration
    coastV = speed;
    if (Math.abs(speed) > 0.02 && get() !== before) coast = requestAnimationFrame(frame);
    else coast = 0;
  };
  if (speed) coast = requestAnimationFrame(frame);
}
document.addEventListener("click", (e) => { if (eatClick) { eatClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener("touchend", dragEnd, { passive: true });
document.addEventListener("touchcancel", dragEnd, { passive: true });
function redraw() {
  const key = $("#cast-tabs .on")?.textContent;
  const waves = $(".fz-waves");
  footSeen.unobserve(waves);
  footSeen.observe(waves);
  renderStandings(state.d);
  renderSlides(state.d);
  const i = castOrder(state.d).findIndex((c) => c.key === key);
  if (i >= 0) state.cast = i;
  for (const sw of [ST, EP, CAST]) if ($(sw.body).offsetParent) jump(sw, sw.get()); else mark(sw, sw.get(), false);
  writeHash();
}
const feet = () => [$("#dq"), $(".fz-foot"), $("#foot")];
// Includes top margins, so a short page ends exactly at the screen's edge
const feetH = () => feet().reduce((h, el) => h + (el?.offsetHeight ? el.offsetHeight + (parseFloat(getComputedStyle(el).marginTop) || 0) : 0), 0);
// Swiper height = its slide's, leaving room for the footer. Mid-swipe it takes the taller slide and the footer parts move between both places (measured once per pair). Moved by a scroll-driven `lift` animation where supported, else per-frame translate. Per-part translate: a custom property would restyle every SVG <use>.
const SDA = CSS.supports("animation-timeline: scroll()");
const lifted = [$("#dq"), $("#foot"), $(".fz-bow"), $(".fz-waves")].filter(Boolean); // cached: a class lookup per frame was the main cost
let pair = null;
function lift(p, t) {
  if (!p) { for (const el of lifted) { el.style.translate = ""; el.style.animationName = ""; } document.body.classList.remove("lifting"); return; }
  if (!p.sda) for (const el of lifted) el.style.animationName = "";
  document.body.classList.add("lifting");
  if (p.sda) {
    for (const el of lifted) {
      const st = el.style;
      st.setProperty("--la", `${p.a}px`); st.setProperty("--lb", `${p.b}px`);
      st.animationTimeline = p.tl; st.animationRange = `${p.r0}px ${p.r1}px`; st.animationName = "lift";
    }
    return;
  }
  const v = `0 ${Math.round(p.a + (p.b - p.a) * t)}px`;
  if (p.v !== v) { p.v = v; for (const el of lifted) el.style.translate = v; }
}
function fit(body) {
  const w = body.clientWidth, kids = body.children;
  if (!w || !kids.length) return;
  const f = body.scrollLeft / w, i = Math.min(Math.floor(f), kids.length - 1), t = f - i;
  if (!(t < 0.01 || t > 0.99 || i + 1 >= kids.length || flipped())) { // flipped: no footer lift yet
    if (pair?.body !== body || pair.i !== i) {
      const pad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
      const view = scroller() !== window ? $("main").clientHeight : innerHeight, top = topIn(body);
      const room = view - top - pad - feetH();
      const ha = Math.max(kids[i].offsetHeight, room), hb = Math.max(kids[i + 1].offsetHeight, room), hi = Math.max(ha, hb);
      // Held just below the screen (upside down, with the rainbow above it)
      const foot = $(".fz-foot"), rise = foot?.offsetWidth ? Math.max(0, (foot.offsetWidth * 1.5) / 2 - foot.offsetHeight + 4) : 0;
      // Scrolled past where a short slide's page can go, its footer is where the settled page will show it
      const sc = scroller(), y = readY();
      const rest = (sc === window ? document.documentElement.scrollHeight : sc.scrollHeight) - body.offsetHeight;
      const below = y + view + rise;
      const at = (h) => Math.min(top + h + Math.max(0, y - Math.max(0, rest + h - view)), below);
      const a = Math.round(at(ha) - (top + hi)), b = Math.round(at(hb) - (top + hi));
      const same = pair && pair.a === a && pair.b === b && pair.tl === `--${body.id.slice(0, -5)}` && pair.r0 === i * w;
      // Turned: Chrome's compositor doesn't follow the swiper timeline, so move per frame
      pair = { body, i, a, b, tl: `--${body.id.slice(0, -5)}`, r0: i * w, r1: (i + 1) * w, sda: SDA && !turned() };
      if (body.style.height !== `${hi}px`) body.style.height = `${hi}px`;
      if (!same || !pair.sda) lift(pair, t);
    } else if (!pair.sda) lift(pair, t);
    return;
  }
  const s = kids[Math.round(f)] || kids[i];
  const pad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
  const view = scroller() !== window ? $("main").clientHeight : innerHeight;
  const room = view - topIn(body) - pad - feetH();
  const h = `${Math.max(s.offsetHeight, room)}px`;
  if (body.style.height !== h) body.style.height = h;
  if (pair || document.body.classList.contains("lifting")) { pair = null; lift(null); }
}
const sizes = new ResizeObserver((entries) => {
  pair = null;
  for (const b of new Set(entries.map((e) => e.target.parentElement))) if (b?.isConnected) fit(b);
});

function mark(sw, i, smooth = true) {
  const tabs = $(sw.tabs), t = tabs.children[i];
  [...tabs.children].forEach((b, j) => b.classList.toggle("on", j === i));
  [...$(sw.body).children].forEach((s, j) => s.classList.toggle("here", j === i)); // only the slide on show twinkles
  if (t) tabs.scrollTo({ left: t.offsetLeft - (tabs.clientWidth - t.offsetWidth) / 2, behavior: smooth && !reducedMotion ? "smooth" : "auto" });
  edges();
}
function jump(sw, i) {
  const body = $(sw.body);
  body.scrollLeft = i * body.clientWidth;
  mark(sw, i, false);
  fit(body);
}

// A sideways swipe at a page's edge switches to the neighbouring tab.

function edgeNav(el, can, onEdge) {
  let x0 = null, y0 = 0, prev = false, next = false;
  el.addEventListener("touchstart", (e) => {
    if (e.target.closest(".strip")) { x0 = null; return; }
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
      fit(body);
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

let timer = 0;

function countdown() {
  clearInterval(timer);
  const el = $("#cd"), e = state.d.nextEp;
  if (!e) {
    el.innerHTML = `<span class="cd-pill"><span class="cd-what">Series ${state.key}</span> <b>complete</b></span>`;
    el.removeAttribute("aria-label");
    return;
  }
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

$(".tabs").addEventListener("click", (e) => {
  const t = e.target.closest("[data-page]");
  if (t) show(t.dataset.page);
});

$("#series").addEventListener("click", () => {
  const keys = Object.keys(SERIES).sort((a, b) => a - b);
  loadSeries(keys[(keys.indexOf(state.key) + 1) % keys.length]);
  show(state.page);
});

$("#dq").addEventListener("click", (e) => { if (e.target.closest(".st-quote")) toggleFantasy(); });
$("#p-standings").addEventListener("click", (e) => {
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
  const head = e.target.closest(".st-side[data-board]");
  if (head) {
    state.stView = state.stView === head.dataset.board ? null : head.dataset.board;
    // Only the board tapped on animates (.ease)
    for (const b of $$("#st-body .board.ease")) b.classList.remove("ease");
    const board = head.closest(".board");
    board.classList.add("ease");
    syncBoards(false, board);
    return;
  }
  // Phones: asks for the tilt (iOS). Desktop: toggles fantasy mode.
  if (e.target.closest(".st-quote")) { if (DESKTOP.matches) toggleFantasy(); else quoteTap(); return; }
  const swap = e.target.closest(".xp-swap");
  if (swap) {
    state.xpView = swap.dataset.xp;
    syncAll();
    return;
  }
  const sd = e.target.closest(".pc .sd");
  if (sd) {
    glideEnd?.();
    const row = sd.closest(".pc"), side = sd.dataset.side, open = row.classList.contains("open") && row.dataset.open === side;
    state.open = open ? null : { side, name: sd.dataset.p, wk: +row.closest(".st-slide").dataset.week };
    for (const b of $$("#st-body .board.ease")) b.classList.remove("ease");
    const board = row.closest(".board");
    board.classList.add("ease");
    if (open) slideShut(board, row, syncAll);
    else glide(board, syncAll);
  }
});

// Rows open/close by FLIP transforms only: layout changes at once, rows below glide; animating height repainted every row.
const GLIDE_MS = 300;
let glideEnd = null;
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
  // The board's bottom edge follows its last row by a clip
  const grow = board.offsetHeight - height;
  if (!moved.length && grow <= 0) return;
  if (grow > 0) board.style.clipPath = `inset(0 0 ${grow}px 0 round 12px)`;
  board.offsetHeight;
  board.classList.add("glide");
  for (const r of moved) r.style.transform = "";
  if (grow > 0) board.style.clipPath = "inset(0 0 0 0 round 12px)";
  const t = setTimeout(() => glideEnd?.(), GLIDE_MS + 40);
  glideEnd = () => { clearTimeout(t); board.classList.remove("glide"); board.style.clipPath = ""; glideEnd = null; };
}
function slideShut(board, row, finish) {
  glideEnd?.();
  const below = [];
  for (let r = row.nextElementSibling; r; r = r.nextElementSibling) below.push(r);
  if (reducedMotion) { glide(board, finish); return; }
  const h = row.querySelector(".pc-more").offsetHeight;
  // Reads as closed at once; only the height waits for the glide
  delete row.dataset.open;
  for (const b of row.querySelectorAll(".sd")) b.setAttribute("aria-expanded", "false");
  board.classList.remove("focus");
  board.style.clipPath = "inset(0 0 0 0 round 12px)";
  board.offsetHeight;
  board.classList.add("glide");
  for (const r of below) r.style.transform = `translateY(${-h}px)`;
  board.style.clipPath = `inset(0 0 ${h + 1}px 0 round 12px)`;
  const t = setTimeout(() => glideEnd?.(), GLIDE_MS);
  glideEnd = () => {
    clearTimeout(t);
    board.classList.remove("glide");
    finish();
    for (const r of below) r.style.transform = "";
    board.style.clipPath = "";
    glideEnd = null;
  };
}

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
  const board = row.closest(".card.board");
  board?.classList.toggle("focus", !!board.querySelector(".pc.open"));
}
// --cx: the chevron's centre, where the row's line grows from
function placeLine(row) {
  const chev = row.querySelector(`.sd[data-side="${row.dataset.open}"] .chev`);
  if (!chev) return;
  const c = chev.getBoundingClientRect(), r = row.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2, t = turned();
  const x = t === 180 ? r.right - cx : t === 90 ? cy - r.top : t === -90 ? r.bottom - cy : cx - r.left;
  row.style.setProperty("--cx", `${x.toFixed(1)}px`);
}
function syncOpen(slide) {
  const o = state.open?.wk === +slide.dataset.week ? state.open : null;
  const want = o && [...slide.querySelectorAll(`.sd[data-side="${o.side}"]`)].find((b) => b.dataset.p === o.name)?.closest(".pc");
  for (const row of slide.querySelectorAll(".pc.open")) if (row !== want || row.dataset.open !== o.side) openRow(row, null);
  if (want && !(want.classList.contains("open") && want.dataset.open === o.side && want.dataset.view === state.xpView)) openRow(want, o.side);
}
// state.stView on every week; charts drawn at one measured width; `force` redraws all
function syncBoards(force = false, drawn = null) {
  let width = 0;
  for (const s of $$("#st-body .st-slide")) {
    const board = s.querySelector(".board"), w = +s.dataset.week;
    if (!board) continue;
    const k = chartable(state.d, w) ? state.stView : null, plot = board.querySelector(".st-chart-plot");
    if (!force && board.dataset.chart === (k || undefined) && (!k || plot.firstChild)) continue;
    if (k) board.dataset.chart = k; else delete board.dataset.chart;
    if (k && !width) width = plot.clientWidth;
    if (k) {
      plot.classList.remove("show", "league");
      plot.classList.add(k);
      plot.innerHTML = boardChart(state.d, w, k, width);
      plot.classList.toggle("draw", board === drawn && !reducedMotion);
    }
    board.querySelector(".st-head").innerHTML = `<span class="st-rk" aria-hidden="true"></span>${["show", "league"].map((b) => boardHead(state.d, w, b, k)).join("")}`;
  }
}
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

// Race charts: tap a line, name or point to follow; again or empty space shows all.
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
  svg.append(who);
  card.classList.add("focus");
  if (hit) { hit.classList.add("on"); cap.textContent = hit.dataset.say; }
  else cap.textContent = "";
  setBehind(card, who);
}
function setBehind(card, who) {
  const leg = card.querySelector(".st-behind");
  if (leg) leg.textContent = who ? `${who.dataset.behind} behind the leader` : "points behind the leader";
}
$("#ep-body").addEventListener("click", raceTap);
$("#st-body").addEventListener("click", raceTap);

$("#ep-body").addEventListener("click", (e) => e.target.closest(".tname")?.classList.toggle("full"));

// Bar: compacts over the first 50px (CSS scroll-driven; --p fallback), hides on scroll down past 120px (12px down, 8px up), ignores overscroll bounce.
const bar = $(".topbar");
const linked = CSS.supports("animation-timeline: scroll()");
let hraf = 0, lastY = scrollY, down = 0, up = 0;
function setHidden(on) {
  bar.classList.toggle("hidden", on);
  document.body.classList.toggle("bar-hidden", on);
}
let barPNow = "";
function barP(y) {
  // --p where CSS doesn't follow the scroll (no SDA, or turned); written only on change
  const p = linked && !turned() ? "0" : String(Math.min(1, y / 50));
  if (p === barPNow) return;
  barPNow = p;
  for (const el of [bar, ...$$(".page > .strip")]) el.style.setProperty("--p", p);
}
function barScroll() {
  if (!hraf) hraf = requestAnimationFrame(() => {
    hraf = 0;
    const sc = scroller(), top = readY();
    const max = sc === window ? maxY() : sc.scrollHeight - sc.clientHeight;
    const y = Math.max(0, Math.min(top, max)), dy = y - lastY;
    lastY = y;
    barP(y);
    if (y < 120) { down = up = 0; return setHidden(false); }
    if (dy > 0) { down += dy; up = 0; if (down > 12) setHidden(true); }
    else if (dy < 0) { up -= dy; down = 0; if (up > 8) setHidden(false); }
  });
}
addEventListener("scroll", barScroll, { passive: true });
$("main").addEventListener("scroll", barScroll, { passive: true });
bar.addEventListener("focusin", () => setHidden(false));
// Dolphins animate only on screen; the latest entry decides (batched entries come oldest first).
// Watches the waves, not the footer: mid-swipe only they rise into view (lift)
const footSeen = new IntersectionObserver((es) => { const e = es.at(-1); e.target.parentElement.classList.toggle("run", e.isIntersecting); });
footSeen.observe($(".fz-waves"));
function barAtTop() { lastY = 0; down = up = 0; barP(0); setHidden(false); }

// Sideways strips fade at the edge where more tabs are hidden
function edges() {
  for (const s of $$(".strip.scroll")) {
    if (!s.offsetParent) continue;
    s.classList.toggle("more-l", s.scrollLeft > 2);
    s.classList.toggle("more-r", s.scrollLeft + s.clientWidth < s.scrollWidth - 2);
  }
}
document.addEventListener("scroll", (e) => { if (e.target.classList?.contains("strip")) edges(); still(); }, { capture: true, passive: true });
// Fantasy: the decorative animations hold still while anything scrolls, so the scroll has the frames
let stillT = 0;
function still() {
  if (!state.fantasy) return;
  if (!stillT) document.documentElement.classList.add("scrolling");
  clearTimeout(stillT);
  stillT = setTimeout(() => { stillT = 0; document.documentElement.classList.remove("scrolling"); }, 200);
}

let lraf = 0;
function cardLight() {
  lraf = 0;
  if (reducedMotion || state.page !== "standings" || turned()) return;
  const cards = $(ST.body).children[ST.get()]?.querySelectorAll(".st-hero.explain .how-card") || [];
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

// First render waits for the fonts (≤1.2s), so it isn't laid out twice
const FACES = ["16px Bungee", "700 16px Nunito", "800 16px Nunito", "16px Inter", "600 16px Inter", "700 16px Inter", "800 16px Inter", "16px 'DM Mono'", "500 16px 'DM Mono'"];
const fontsIn = Promise.race([
  Promise.all(FACES.map((f) => document.fonts.load(f).catch(() => {}))),
  new Promise((r) => setTimeout(r, 1200)),
]);

// Tab bar right from the first frame, before data and fonts
{
  const i = Math.max(0, PAGES.indexOf(location.hash.split("/")[2]));
  $(".tabs").style.setProperty("--i", i);
  $$(".tab").forEach((t, j) => t.setAttribute("aria-selected", j === i));
}

try {
  const [text, allTime] = await Promise.all([loadText(), loadStats(), fontsIn]);
  SERIES = buildSeries(parseCSV(text));
  CURRENT = currentSeriesKey(SERIES, new Date());
  state.allTime = allTime;
  state.stats = allTime.length ? allTimePerEpisode(allTime) : { ...perEpisodeStats(SERIES), n: 0 };
  let welcome = true;
  try { welcome = !localStorage.getItem("fm-welcome"); } catch {}
  $("#welcome").innerHTML = welcomeCard();
  $("#welcome").hidden = !welcome;
  initFlip({ redraw: () => { redraw(); turnedOver(); }, scrolled: turnedOver });
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
