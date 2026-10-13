// Wiring: data, render, tabs, swipers, bar, countdown. Routes: #/22/episodes/4, #/22/cast/Nina.
import { loadText, parseCSV, buildSeries } from "./csv.js";
import { initEdit } from "./edit.js";
import { derive, currentSeriesKey, airInstant } from "./league.js";
import { moonAt, moonPath, skyFor } from "./sky.js";
import { $, $$, esc, reducedMotion, state, fmtWhen, until, perEpisodeStats, footer } from "./ui.js";
import { standingsSlides, stWeek, weekTabs, rowMore, boardChart, boardHead, chartable, welcomeCard, EMBRACE } from "./views/table.js";
import { epTabs, epSlides } from "./views/episodes.js";
import { castOrder, castTabs, castSlides, castSlide, fill, at as sliderAt, changedSay, resettable, groupSay } from "./views/cast.js";
import { GROUPS, get, set, item, shown, hourOf, resetAll, changed, onSwitch, setAirPhase } from "./switches.js";
import { mountPodiumFx } from "./podium-fx.js";
import { PR, latestPR, revSay, reloadFresh } from "./version.js";
import { loadStats, allTimePerEpisode } from "./alltime.js";
import { initFlip, toggleFantasy, scene } from "./flip.js";
import { streamer } from "./stream.js";
import { drawSky, degPx, sunSky, cometSky } from "./halo.js";
import { drawStars } from "./stars.js";
import { night } from "./night.js";

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
  if (!$("#foot").children.length) { $("#foot").innerHTML = footer(); houseSeen.observe($("#foot")); }
  showDay();
  if (!$("#dq").children.length) $("#dq").innerHTML = EMBRACE;
  countdown();
}

// The view each page was last drawn in (state.fantasy): a switch draws the page on show at once and the others after
const drawn = {};
function renderStandings(d) {
  drawn.standings = !!state.fantasy;
  $("#st-tabs").innerHTML = weekTabs(d);
  $("#st-body").innerHTML = standingsSlides(d);
  for (const s of $("#st-body").children) { sizes.observe(s); syncOpen(s); }
  if (state.stView) syncBoards(true);
  queueLight();
  fitTitles();
}

function renderSlides(d) {
  renderEpisodes(d);
  renderCast(d);
}
function renderEpisodes(d) {
  drawn.episodes = !!state.fantasy;
  $("#ep-tabs").innerHTML = epTabs(d);
  $("#ep-body").innerHTML = epSlides(d);
  mountPodiumFx($("#ep-body"));
  for (const s of $("#ep-body").children) sizes.observe(s);
  fitTitles();
}
function renderCast(d) {
  drawn.cast = !!state.fantasy;
  $("#cast-tabs").innerHTML = castTabs(d);
  $("#cast-body").innerHTML = castSlides(d);
  mountPodiumFx($("#cast-body"));
  revision();
  for (const s of $("#cast-body").children) sizes.observe(s);
  fitTitles();
}

// Headlines on one line: a title wider than its box (less the sparkles in the dream) shrinks to fit (--fit on .ep-w;
// styles.css). Only the titles near the screen are measured, in the slides on show and either side of them: measuring
// one in a slide off screen lays out that whole slide (content-visibility), and all of them took ~280ms at a 4× throttled
// CPU. The rest are fitted as they come near (mark), and all again when the width changes. Reads, then writes
function fitTitles() {
  const near = [ST, EP, CAST].filter((sw) => $(sw.body).offsetParent).flatMap((sw) => { const k = $(sw.body).children, i = sw.get(); return [k[i - 1], k[i], k[i + 1]]; });
  const key = `${pageW} ${state.fantasy ? 1 : 0}`;
  const ts = near.filter(Boolean).flatMap((s) => [...s.querySelectorAll("h2.ep-title .ep-w")]).filter((t) => t.dataset.fit !== key);
  if (!ts.length) return;
  for (const t of ts) t.style.removeProperty("--fit");
  const fit = ts.map((t) => (t.scrollWidth > t.clientWidth ? (t.clientWidth - 1) / t.scrollWidth : 1));
  const set = (t, f) => t.style.setProperty("--fit", (Math.floor(f * 1000) / 1000).toString());
  ts.forEach((t, i) => { if (fit[i] < 1) set(t, fit[i]); t.dataset.fit = key; });
  // A smaller size isn't quite in proportion (the glyphs' spacing rounds), so any still over are taken down the rest
  const over = ts.filter((t, i) => fit[i] < 1 && t.scrollWidth > t.clientWidth).map((t) => [t, t.clientWidth, t.scrollWidth]);
  for (const [t, cw, sw] of over) set(t, +t.style.getPropertyValue("--fit") * (cw - 1) / sw);
}
// Titles refit when main's width changes
let pageW = 0;
new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w !== pageW) { pageW = w; fitTitles(); } peek(); }).observe($("main"));

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
  catchUp(page); // drawn in the other view: drawn now, before it shows
  state.page = page;
  const i = PAGES.indexOf(page);
  $(".tabs").style.setProperty("--i", i);
  $$(".tab").forEach((t, j) => t.setAttribute("aria-selected", j === i));
  $$(".page").forEach((p, j) => p.classList.toggle("active", j === i));
  toTop();
  if (page === "standings") { jump(ST, ST.get()); queueLight(); }
  if (page === "episodes") jump(EP, state.ep - 1);
  if (page === "cast") jump(CAST, state.cast);
  airMoon();
  writeHash();
}

const ST = { body: "#st-body", tabs: "#st-tabs", get: () => stWeek(state.d) - 1, set: (i) => { state.wk = i + 1; queueLight(); } };
const EP = { body: "#ep-body", tabs: "#ep-tabs", get: () => state.ep - 1, set: (i) => { state.ep = i + 1; } };
const CAST = { body: "#cast-body", tabs: "#cast-tabs", get: () => state.cast, set: (i) => { state.cast = i; } };

const idxOf = (body) => Math.round(body.scrollLeft / body.clientWidth);

function toTop(smooth = false) {
  if (scrollY > 0) scrollTo({ top: 0, behavior: smooth && !reducedMotion ? "smooth" : "auto" });
}
function topIn(el) {
  let y = 0;
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
  return y;
}
// The view switched (flip.js): the page on show is drawn in it at once, inside the transition, which can't start until
// it's drawn (each page took ~130–210ms at a 4× throttled CPU, all three ~400–630ms); the others after, one at a time
// when the page is idle (later), or at once if shown first (show)
const SWIPER = { standings: ST, episodes: EP, cast: CAST };
function drawPage(page) {
  if (page === "standings") renderStandings(state.d);
  if (page === "episodes") renderEpisodes(state.d);
  if (page === "cast") { // the same contestant, in the other view's order
    const key = $("#cast-tabs .on")?.textContent;
    renderCast(state.d);
    const i = castOrder(state.d).findIndex((c) => c.key === key);
    if (i >= 0) state.cast = i;
  }
  const sw = SWIPER[page];
  if ($(sw.body).offsetParent) jump(sw, sw.get()); else mark(sw, sw.get(), false);
}
const stale = (page) => drawn[page] !== !!state.fantasy;
function catchUp(...pages) { for (const page of pages.length ? pages : PAGES) if (stale(page)) drawPage(page); }
const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 50));
function later() {
  const page = PAGES.find(stale);
  if (page) idle(() => { catchUp(page); later(); });
}
function redraw() {
  const waves = $(".fz-waves");
  footSeen.unobserve(waves);
  footSeen.observe(waves);
  drawPage(state.page);
  // The slides on show are laid out now, not at their placeholder size (content-visibility), so what was tapped can
  // be kept in place (flip.js) and the swiper fitted to their real height. They go back to auto only after a frame has
  // recorded that height: sooner, they fell back to the placeholder for a frame and the scroll was clamped to it
  const shown = $(SWIPER[state.page].body).children[SWIPER[state.page].get()];
  if (shown) {
    shown.style.contentVisibility = "visible";
    requestAnimationFrame(() => requestAnimationFrame(() => { shown.style.contentVisibility = ""; }));
    jump(SWIPER[state.page], SWIPER[state.page].get());
  }
  writeHash();
  celestial(); // each footer shows them as it does
}
const feet = () => [$("#dq"), $(".fz-foot"), $("#foot")];
// Includes top margins, so a short page ends exactly at the screen's edge
const feetH = () => feet().reduce((h, el) => h + (el?.offsetHeight ? el.offsetHeight + (parseFloat(getComputedStyle(el).marginTop) || 0) : 0), 0);
// Swiper height = its slide's, leaving room for the footer. Mid-swipe it takes the taller slide and the footer parts move between both places (measured once per pair). Moved by a scroll-driven `lift` animation where supported, else per-frame translate. Per-part translate: a custom property would restyle every SVG <use>.
const SDA = CSS.supports("animation-timeline: scroll()");
const PEEK_DIM = 0.5; // the sky's opacity while it peeks (peek-dim in styles.css)
const lifted = [$("#dq"), $("#foot"), $(".fz-waves")].filter(Boolean); // cached: a class lookup per frame was the main cost
let pair = null;
function lift(p, t) {
  if (!p) { for (const el of lifted) { el.style.translate = ""; el.style.animationName = ""; } document.body.classList.remove("lifting"); peek(); return; }
  if (!p.sda) for (const el of lifted) el.style.animationName = "";
  if (!document.body.classList.contains("lifting")) { document.body.classList.add("lifting"); peek(); }
  if (p.sda) {
    for (const el of lifted) {
      const st = el.style;
      st.setProperty("--la", `${p.a}px`); st.setProperty("--lb", `${p.b}px`);
      st.animationTimeline = p.tl; st.animationRange = `${p.r0}px ${p.r1}px`; st.animationName = "lift";
    }
    skyLift(p);
    return;
  }
  const v = `0 ${Math.round(p.a + (p.b - p.a) * t)}px`;
  if (p.v !== v) { p.v = v; for (const el of lifted) el.style.translate = v; }
  skyLift(p, t);
}
// The house's sky peeks up from the screen's bottom (on request): while Patatas's block is below the screen, the sky is held
// where a swipe holds it (as if the block began at the screen's edge), and rises with the footer once that comes up.
// Dimmed while it peeks (on request), brightening to the scene's own as Patatas's block comes up, by the time the house
// shows. Scroll-driven where supported, so it keeps pace with the scroll, else per frame. While a swipe lifts the footer,
// which then holds the sky, only the dimming runs, from where the page was laid out before it
let skyEl = null, skyK = "", sky = { r: 0, h: 1 }, praf = 0;
const pageTop = (el) => { let y = 0; for (; el; el = el.offsetParent) y += el.offsetTop; return y; }; // as laid out (no lift)
function peek() {
  praf = 0;
  if (!skyEl?.isConnected) { skyEl = $("#foot .house > .sky"); skyK = ""; }
  if (!skyEl) return;
  if (document.body.classList.contains("lifting")) { skyK = ""; return; } // skyLift has it
  const dq = pageTop($("#dq"));
  sky = { r: Math.round(dq - innerHeight), h: Math.max(1, pageTop($("#foot")) - dq) };
  const { r, h } = sky, st = skyEl.style, move = r > 0, dim = r + h > 0;
  if (SDA) {
    const k = `${r} ${h} ${move}`;
    if (k === skyK) return;
    skyK = k;
    st.animationName = "none"; getComputedStyle(skyEl).animationName; // restarted: Chrome keeps a running one's old range start
    st.animationTimeline = "";
    st.setProperty("--pk", `${-r}px`);
    st.animationRange = `0px ${Math.max(1, r)}px, ${r}px ${r + h}px`;
    st.animationName = `${move ? "peek" : "none"}, ${dim ? "peek-dim" : "none"}`;
  } else {
    const t = move && r > scrollY ? `translateY(${Math.round(scrollY - r)}px)` : "";
    const o = dim && scrollY < r + h ? `${Math.max(0, Math.min(1, (scrollY - r) / h)) * (1 - PEEK_DIM) + PEEK_DIM}` : "";
    if (st.transform !== t) st.transform = t;
    if (st.opacity !== o) st.opacity = o;
  }
}
const queuePeek = () => { if (!praf) praf = requestAnimationFrame(peek); };
// The sky's opacity with Patatas's block's top this far down the screen (as peek-dim gives it)
const skyOp = (dqY) => +(PEEK_DIM + (1 - PEEK_DIM) * Math.max(0, Math.min(1, (innerHeight - dqY) / sky.h))).toFixed(3);
// Mid-swipe the lifted footer holds the sky, and its opacity blends from the one page's to the other's with the swipe
// (a scored week's dimmed peek to an unscored one's footer, in full)
function skyLift(p, t) {
  if (!skyEl?.isConnected) return;
  const st = skyEl.style;
  if (p.sda) {
    st.animationName = "none"; getComputedStyle(skyEl).animationName; // restarted, as in peek
    st.setProperty("--oa", p.oa); st.setProperty("--ob", p.ob);
    st.animationTimeline = p.tl; st.animationRange = `${p.r0}px ${p.r1}px`; st.animationName = "peek-lift";
  } else {
    const o = `${+(p.oa + (p.ob - p.oa) * t).toFixed(3)}`;
    if (st.transform) st.transform = "";
    if (st.opacity !== o) st.opacity = o;
  }
}
// Room a slide's swiper leaves for it at the least: down to the screen's bottom, less the footer
const roomIn = (body) => innerHeight - topIn(body) - (parseFloat(getComputedStyle(document.body).paddingBottom) || 0) - feetH();
// The footer's parts glide when the page's height jumps (a row opening or closing, a card changing), in step with the
// rows: moved at once and drawn from where they were on the screen (FLIP). Added together, so a change mid-glide carries
// on from where they are. By transform, as a swipe's lift has their translate
const FOOT_EASE = "cubic-bezier(.22, 1, .36, 1)"; // --ease, the rows' glide
function footGlide(dy) {
  if (reducedMotion || Math.abs(dy) < 1 || document.documentElement.dataset.vt) return;
  for (const el of lifted) el.animate({ transform: [`translateY(${dy}px)`, "translateY(0)"] }, { duration: GLIDE_MS, easing: FOOT_EASE, composite: "add" });
}
function fit(body, glide = false) {
  const w = body.clientWidth, kids = body.children;
  if (!w || !kids.length) return;
  const f = body.scrollLeft / w, i = Math.min(Math.floor(f), kids.length - 1), t = f - i;
  if (!(t < 0.01 || t > 0.99 || i + 1 >= kids.length)) {
    if (pair?.body !== body || pair.i !== i) {
      const pad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
      const view = innerHeight, top = topIn(body);
      const room = view - top - pad - feetH();
      const ha = Math.max(kids[i].offsetHeight, room), hb = Math.max(kids[i + 1].offsetHeight, room), hi = Math.max(ha, hb);
      // Held just below the screen (in the dream, with the rainbow above it)
      const foot = $(".fz-foot"), rise = foot?.offsetWidth ? Math.max(0, (foot.offsetWidth * 1.5) / 2 - foot.offsetHeight + 4) : 0;
      // Scrolled past where a short slide's page can go, its footer is where the settled page will show it
      const y = scrollY, rest = document.documentElement.scrollHeight - body.offsetHeight;
      const below = y + view + rise;
      const at = (h) => Math.min(top + h + Math.max(0, y - Math.max(0, rest + h - view)), below);
      const a = Math.round(at(ha) - (top + hi)), b = Math.round(at(hb) - (top + hi));
      const same = pair && pair.a === a && pair.b === b && pair.tl === `--${body.id.slice(0, -5)}` && pair.r0 === i * w && pair.oa === skyOp(at(ha) - y) && pair.ob === skyOp(at(hb) - y);
      pair = { body, i, a, b, tl: `--${body.id.slice(0, -5)}`, r0: i * w, r1: (i + 1) * w, sda: SDA, oa: skyOp(at(ha) - y), ob: skyOp(at(hb) - y) };
      if (body.style.height !== `${hi}px`) body.style.height = `${hi}px`;
      if (!same || !pair.sda) lift(pair, t);
    } else if (!pair.sda) lift(pair, t);
    return;
  }
  const s = kids[Math.round(f)] || kids[i];
  const h = `${Math.max(s.offsetHeight, roomIn(body))}px`;
  if (body.style.height !== h) {
    const was = parseFloat(body.style.height), y = scrollY;
    body.style.height = h;
    // Where they were on the screen: the page's change less any scroll it took back (a shorter page scrolled to its end)
    if (glide && was) footGlide(was - parseFloat(h) + (scrollY - y));
  }
  if (pair || document.body.classList.contains("lifting")) { pair = null; lift(null); }
}
// A slide on show that changed size glides the footer (fit); not one just drawn, or come into view at its real size, nor
// while a height is animating (the board's race chart opening), as the footer follows that frame by frame
const shownAt = new WeakMap();
const sizes = new ResizeObserver((entries) => {
  pair = null;
  const glide = new Set();
  for (const e of entries) {
    const s = e.target, h = e.contentRect.height, was = shownAt.get(s);
    if (!s.classList.contains("here") || !h) { shownAt.delete(s); continue; }
    shownAt.set(s, h);
    if (was && !s.getAnimations({ subtree: true }).some((a) => a.transitionProperty === "grid-template-rows")) glide.add(s.parentElement);
  }
  for (const b of new Set(entries.map((e) => e.target.parentElement))) if (b?.isConnected) fit(b, glide.has(b));
});

function mark(sw, i, smooth = true) {
  const tabs = $(sw.tabs), t = tabs.children[i];
  [...tabs.children].forEach((b, j) => b.classList.toggle("on", j === i));
  [...$(sw.body).children].forEach((s, j) => s.classList.toggle("here", j === i)); // only the slide on show twinkles
  airMoon();
  if (t) tabs.scrollTo({ left: t.offsetLeft - (tabs.clientWidth - t.offsetWidth) / 2, behavior: smooth && !reducedMotion ? "smooth" : "auto" });
  edges();
  fitTitles(); // the titles that have come near
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
    if (e.target.closest(".strip, .sw-range")) { x0 = null; return; }
    [x0, y0] = [e.touches[0].clientX, e.touches[0].clientY];
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
      fit(body);
    });
    clearTimeout(settle);
    settle = setTimeout(() => fit(body), 120);
  }, { passive: true });
  $(sw.tabs).addEventListener("click", (e) => {
    const b = e.target.closest("[data-slide]");
    if (b) body.scrollTo({ left: b.dataset.slide * body.clientWidth, behavior: reducedMotion ? "auto" : "smooth" });
  });
  const can = {
    prev: () => ends.prev && body.scrollLeft <= 2,
    next: () => ends.next && body.scrollLeft >= body.scrollWidth - body.clientWidth - 2,
  };
  edgeNav(body, can, onEdge);
  EDGES.set(body, { can, onEdge });
}
const EDGES = new Map();

// The footer's areas (Patatas, the house and its ducks, the lake) swipe the page's slides too (on request): a sideways
// drag there moves the swiper on show with the finger (touch-action: pan-y leaves up and down to the page), and lets go
// to the nearer slide, or on to the next on a flick; past an end, to the neighbouring tab, as on the slides. Snapping is
// off while the finger moves it, as each scroll would snap, and back once it settles. A drag isn't a tap
let dragged = 0, settling = null;
function footSwipe(area) {
  let id = null, x0 = 0, y0 = 0, s0 = 0, body = null, on = false, trail = [];
  area.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || id != null) return;
    body = $(`#p-${state.page} .swiper`);
    if (!body?.clientWidth) return;
    [id, x0, y0, s0, on, trail] = [e.pointerId, e.clientX, e.clientY, body.scrollLeft, false, []];
  });
  area.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    if (!on) {
      if (Math.abs(e.clientX - x0) < 8 || Math.abs(e.clientX - x0) < Math.abs(e.clientY - y0)) return;
      on = true;
      x0 = e.clientX;
      settling?.abort(); // a last drag's slide still settling: this one takes over
      body.style.scrollSnapType = "none";
      for (const b of $$("#dq .embrace.down")) b.classList.remove("down"); // not pressing Patatas
    }
    body.scrollLeft = s0 - (e.clientX - x0);
    trail.push([e.timeStamp, e.clientX]);
    while (trail.length > 2 && e.timeStamp - trail[0][0] > 100) trail.shift();
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    if (!on) return;
    dragged = performance.now();
    const w = body.clientWidth, n = body.children.length, dx = e.clientX - x0, f = body.scrollLeft / w;
    const [t0, xa] = trail[0] || [e.timeStamp, e.clientX], v = (e.clientX - xa) / Math.max(1, e.timeStamp - t0); // px a ms
    // On to the next slide on a flick or a quarter of the way, else back to the nearer
    const go = Math.abs(v) > 0.2 ? v : Math.abs(dx) > w / 4 ? dx : 0;
    const i = Math.max(0, Math.min(n - 1, go < 0 ? Math.ceil(f) : go > 0 ? Math.floor(f) : Math.round(f)));
    // Snapping back on once it's there (the drag's own scrolls end too, before it's moved off)
    const b = body, ac = new AbortController(), restore = (force) => {
      if (force !== true && Math.abs(b.scrollLeft - i * w) > 1) return;
      ac.abort();
      b.style.scrollSnapType = "";
    };
    settling = ac;
    b.scrollTo({ left: i * w, behavior: reducedMotion ? "auto" : "smooth" });
    b.addEventListener("scrollend", restore, { signal: ac.signal });
    b.addEventListener("scroll", restore, { signal: ac.signal, passive: true }); // where there's no scrollend
    const t = setTimeout(() => restore(true), 1200);
    ac.signal.addEventListener("abort", () => clearTimeout(t));
    // Past an end: the neighbouring tab
    const edge = EDGES.get(b);
    if (edge && Math.abs(dx) >= 60) {
      if (dx > 0 && s0 <= 2 && edge.can.prev()) edge.onEdge(-1);
      if (dx < 0 && s0 >= b.scrollWidth - w - 2 && edge.can.next()) edge.onEdge(1);
    }
  };
  area.addEventListener("pointerup", end);
  area.addEventListener("pointercancel", end);
  area.addEventListener("click", (e) => { if (performance.now() - dragged < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
}
for (const el of [$("#dq"), $("#foot"), $(".fz-foot")]) if (el) footSwipe(el);

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

// Where a tap landed: the transitions open from it (Iris's circle, Vertigo's centre); none from a keyboard
const tapAt = (e) => (e.detail ? { x: e.clientX, y: e.clientY } : null);
$("#dq").addEventListener("click", (e) => { if (e.target.closest(".embrace")) toggleFantasy("#dq", tapAt(e)); });
// Patatas pressed: held while the finger is down and a moment after, so a quick tap shows it (iOS shows :active only
// with a touch listener), then he springs back
$("#dq").addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".embrace");
  if (!b) return;
  clearTimeout(b.up);
  b.classList.add("down");
  const ac = new AbortController(), up = () => { ac.abort(); b.up = setTimeout(() => b.classList.remove("down"), 160); };
  addEventListener("pointerup", up, { signal: ac.signal });
  addEventListener("pointercancel", up, { signal: ac.signal });
});
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
  // The footer goes up with them, as far as the page will shorten (and no further than a page scrolled to its end lets it)
  const body = row.closest(".st-slide").parentElement, now = body.offsetHeight;
  const less = now - Math.max(row.closest(".st-slide").offsetHeight - h, roomIn(body));
  const end = document.documentElement.scrollHeight - innerHeight, up = less - Math.max(0, scrollY - (end - less));
  const foot = up < 1 ? [] : lifted.map((el) => el.animate({ transform: ["translateY(0)", `translateY(${-up}px)`] }, { duration: GLIDE_MS, easing: FOOT_EASE, fill: "forwards", composite: "add" }));
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
    fit(body); // the page shortens now, where the footer is already
    for (const a of foot) a.cancel();
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
  const c = chev.getBoundingClientRect(), r = row.getBoundingClientRect();
  row.style.setProperty("--cx", `${(c.left + c.width / 2 - r.left).toFixed(1)}px`);
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
// The Moss Easter egg (cast.js): his portrait swaps him and his cards. Each control sets its setting at once, and the
// Defaults card and each group's head count what differs from the design
const counted = (slide) => {
  const n = changed();
  slide.querySelector(".sw-count").textContent = changedSay(n);
  slide.querySelector(".sw-reset").disabled = !resettable();
  for (const g of GROUPS) { const el = slide.querySelector(`.sw-group[data-g="${g.id}"] .sw-g-sum`); if (el) el.textContent = groupSay(g); }
};
let reloading = false;
$("#cast-body").addEventListener("click", (e) => {
  const slide = e.target.closest(".slide");
  const head = e.target.closest(".sw-g-head");
  if (head) { // a group folds away, or opens; kept per device
    const sec = head.parentElement, open = !sec.classList.contains("open");
    sec.classList.toggle("open", open);
    head.setAttribute("aria-expanded", open);
    sec.querySelector(".sw-grid").hidden = !open;
    try { if (open) localStorage.setItem(`fm-grp-${sec.dataset.g}`, "1"); else localStorage.removeItem(`fm-grp-${sec.dataset.g}`); } catch { /* private mode */ }
    if (open) revision();
    return;
  }
  const opt = e.target.closest(".sw-seg [data-v]");
  if (opt) {
    const it = item(opt.dataset.sw);
    set(it.key, it.type === "steps" ? +opt.dataset.v : opt.dataset.v);
    for (const b of opt.parentElement.children) b.setAttribute("aria-checked", b === opt);
    if (it.type === "dial") dialCard(opt.closest(".sw-card"), it);
    counted(slide);
    // A transition is played by a tap on it: the view switches with it, from the button
    if (it.key === "fzMove") toggleFantasy(`.sw-seg [data-sw="fzMove"][data-v="${opt.dataset.v}"]`, tapAt(e));
    return;
  }
  const val = e.target.closest(".sw-val[data-reset]");
  if (val) { // a slider's value: back to the design
    const it = item(val.dataset.reset), r = slide.querySelector(`.sw-range[data-sw="${it.key}"]`);
    set(it.key, it.def);
    if (it.type === "dial") dialCard(val.closest(".sw-card"), it);
    else {
      r.value = it.def;
      r.style.setProperty("--v", fill(it));
      val.textContent = shown(it, it.def);
      val.classList.remove("on");
    }
    return counted(slide);
  }
  const sw = e.target.closest(".sw-toggle");
  if (sw?.hasAttribute("data-fz")) return toggleFantasy(".sw-toggle[data-fz]", tapAt(e)); // Moss's page previews it, with its cards
  if (sw) {
    const k = sw.dataset.sw;
    set(k, !get(k));
    sw.setAttribute("aria-checked", get(k));
    if (item(k).main) sw.closest(".sw-card").classList.toggle("off", !get(k));
    return counted(slide);
  }
  // Reload, its words kept as they are (on request)
  if (e.target.closest(".sw-reload")) {
    if (!reloading) { reloading = true; reloadFresh(); }
    return;
  }
  const img = e.target.closest(".cd-img[data-moss]"), reset = e.target.closest(".sw-reset");
  if (!img && !reset) return;
  if (img) state.moss = !state.moss; else resetAll();
  const c = state.d.contestants.find((o) => o.key === slide.querySelector("[data-moss]").dataset.moss);
  slide.innerHTML = castSlide(state.d, c);
  mountPodiumFx($("#cast-body"));
  revision();
  fitTitles();
});
// Moss's Revision card: is this page the latest merged? Asked only once his cards are on show
function revision() {
  if (!$("#cast-body .sw-rev")) return;
  latestPR().then((n) => {
    for (const el of $$("#cast-body .sw-rev")) { el.textContent = revSay(n); el.classList.toggle("on", n > PR); }
    for (const b of $$("#cast-body .sw-reload")) b.classList.toggle("gold", n > PR); // gold when there's a newer one to get
  });
}
// A dial's card (Time of day, Moon phase) shows its setting three ways: the slider's place, its value in the head (gold
// once chosen) and its button, if it's one of them
function dialCard(card, it) {
  const v = get(it.key), r = card.querySelector(".sw-range"), val = card.querySelector(".sw-val");
  r.value = sliderAt(it);
  r.style.setProperty("--v", fill(it));
  val.textContent = shown(it, v);
  val.classList.toggle("on", v !== it.def);
  for (const b of card.querySelectorAll(".sw-seg [data-v]")) b.setAttribute("aria-checked", b.dataset.v === v);
}
// A Moss card's slider: the setting follows as it moves
$("#cast-body").addEventListener("input", (e) => {
  const r = e.target.closest(".sw-range");
  if (!r) return;
  const it = item(r.dataset.sw), v = +r.value, val = r.closest(".sw-slide, .sw-card").querySelector(".sw-val");
  if (it.type === "dial") {
    set(it.key, String(v));
    dialCard(r.closest(".sw-card"), it);
    return counted(r.closest(".slide"));
  }
  set(it.key, v);
  r.style.setProperty("--v", fill(it));
  val.textContent = shown(it, v);
  val.classList.toggle("on", v !== it.def);
  counted(r.closest(".slide"));
});

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

// The bar is always compact and always shown (styles.css): nothing to do as the page scrolls
// The lake's foam and stream run only on screen; the latest entry decides (batched entries come oldest first).
// Watches the waves, not the footer: mid-swipe only they rise into view (lift)
const footSeen = new IntersectionObserver((es) => {
  const e = es.at(-1);
  e.target.parentElement.classList.toggle("run", e.isIntersecting);
  $("#foot").classList.toggle("run", e.isIntersecting);
});
footSeen.observe($(".fz-waves"));
// The lake and Alex's stream (stream.js): drawn in the scene's worker (flip.js) on canvases it's handed, where it can
// be, else here, still; only while the footer's on screen and the page is showing. Pressing him pumps it up: its
// pressure rises while he's held, for a moment at least on a tap, and falls when he's let go or the press turns into a
// scroll or swipe
let water = null, waterWorker = false;
function waterSend(type, arg) {
  if (!water) {
    const c = $(".mr-water"), l = $(".lake-c"), w = scene();
    if (w) {
      const jet = c.transferControlToOffscreen(), lake = l.transferControlToOffscreen();
      w.postMessage({ to: "water", type: "init", jet, lake }, [jet, lake]);
      water = (t, a) => w.postMessage({ to: "water", type: t, arg: a });
      waterWorker = true;
    } else { const s = streamer(c, l); water = (t, a) => s[t](a); }
  }
  water(type, arg);
}
// Where the lake is on the screen, for it to mirror the fall above it (fixed to the screen): told as the page scrolls,
// once a frame at most, while it's on screen and the fall's on
let viewing = 0;
function lakeView() {
  viewing = 0;
  const w = waterWorker && scene();
  if (!w || !waterSeen || !state.fantasy || !get("fall")) return;
  const r = $(".fz-lake").getBoundingClientRect();
  w.postMessage({ to: "view", arg: { top: r.top, left: r.left, vw: document.documentElement.clientWidth, vh: innerHeight } });
}
const lakeViewSoon = () => { if (!viewing && state.fantasy && waterSeen) viewing = requestAnimationFrame(lakeView); };
addEventListener("scroll", lakeViewSoon, { passive: true });
onSwitch(["fall"], lakeViewSoon);
// His picture, for his reflection: handed over once it's loaded (a bitmap to the worker)
let rockSent = false;
function sendRock() {
  if (rockSent) return;
  rockSent = true;
  const img = $(".fz-mer img");
  img.decode().then(() => (waterWorker ? createImageBitmap(img) : img)).then((b) => water("rock", b)).catch(() => { rockSent = false; });
}
// Their places (CSS px, in the stream's canvas, the lake's starting LH from its foot): the spout (56.6px, 29px into his
// 124px picture), the water (his rock's foot), the rainbow's centre (the bow's foot, 4px up, styles.css) and his rock
function waterOn() {
  const a = $(".fz-alex").getBoundingClientRect(), m = $(".fz-mer").getBoundingClientRect(), u = m.width / 124;
  if (!a.width || !state.fantasy || document.hidden) return;
  if (!water) waterSend("stop"); // set up first: here, without a worker, it's drawn still (moving, it took the main thread)
  const sk = $("#foot .house .aurora-c").getBoundingClientRect();
  waterSend("geom", { sky: { x: a.left - sk.left, w: sk.width, h: sk.height }, W: a.width, H: a.height, LH: $(".fz-lake").getBoundingClientRect().height, sx: m.left - a.left + 56.6 * u, sy: m.top - a.top + 29 * u, wy: m.bottom - a.top, cx: a.width / 2, cy: a.height - 4,
    rock: { x: m.left - a.left, y: m.top - a.top, w: m.width, h: m.height }, deg: degPx(innerWidth, innerHeight), res: Math.min(2, devicePixelRatio || 1), still: reducedMotion || !get("fzSea") || !waterWorker });
  sendRock();
  waterSend("start");
  lakeViewSoon();
  if (skyMsg) water("sky", skyMsg); else celestial();
}
const waterOff = () => water?.("stop");
let waterSeen = false;
new IntersectionObserver((es) => { waterSeen = es.at(-1).isIntersecting; waterSeen ? waterOn() : waterOff(); }).observe($(".fz-waves"));
document.addEventListener("visibilitychange", () => (document.hidden ? waterOff() : waterSeen && waterOn()));
addEventListener("resize", () => { if (waterSeen) waterOn(); else celestial(); });
onSwitch(["fzSea"], () => { if (waterSeen) { waterOff(); waterOn(); } });
const mer = $(".fz-mer");
let merAt = null, merT = 0, merOff = 0;
const merUp = () => { merAt = null; clearTimeout(merOff); merOff = setTimeout(() => water?.("press", false), Math.max(0, 450 - (performance.now() - merT))); };
mer.addEventListener("pointerdown", (e) => { merAt = [e.pointerId, e.clientX, e.clientY]; merT = performance.now(); clearTimeout(merOff); water?.("press", true); });
mer.addEventListener("pointermove", (e) => { if (merAt?.[0] === e.pointerId && Math.hypot(e.clientX - merAt[1], e.clientY - merAt[2]) > 10) merUp(); });
for (const t of ["pointerup", "pointercancel", "pointerleave"]) mer.addEventListener(t, (e) => { if (merAt?.[0] === e.pointerId) merUp(); });
mer.addEventListener("contextmenu", (e) => e.preventDefault()); // a long press is his, not the image menu's
// The house (ui.js) lights up on show days: the day, on this device, that any episode airs. Checked each minute, so it
// comes on at midnight. Its lights come up the first time it's seen (.up), and its chimney smokes while it's on screen
function showDay() {
  const now = new Date(), today = now.toDateString();
  $("#foot").classList.toggle("show-day", Object.values(SERIES).some((s) => s.episodes.some((e) => airInstant(e.date).toDateString() === today)));
  // And the time of day: its sky, and the sun or the moon rising from the horizon at the left, high over the house through
  // the middle of its time, and setting at the right
  const house = $("#foot .house");
  if (!house) return;
  // (or at the time chosen on Moss's Time of day card)
  const pick = get("houseTime"), h = hourOf(pick), sun = (h - 6) / 14, moon = (h + 4) % 24 / 10;
  // (the Time of day card, while it follows the clock, moves with it)
  const tc = pick === "clock" && $("#cast-body .sw-range[data-sw=houseTime]")?.closest(".sw-card");
  if (tc) dialCard(tc, item("houseTime"));
  const at = {};
  for (const [k, t] of [["sun", sun], ["moon", moon]]) {
    const el = house.querySelector(`.${k}`), x = 20 + 350 * Math.max(0, Math.min(1, t));
    at[k] = [x, arcY(x)];
    el.style.display = t >= 0 && t <= 1 ? "" : "none";
    el.setAttribute("transform", `translate(${at[k][0].toFixed(1)} ${at[k][1].toFixed(1)})`);
  }
  // The sun's height (degrees): up to 55° at midday, and below the horizon by night, through twilight to -40° at 1:00
  const day = sun >= 0 && sun <= 1;
  light = { t: day ? sun : moon, sun: day, at, height: day ? 55 * Math.sin(Math.PI * sun) : -40 * Math.sin(Math.PI * moon) };
  airMoon();
  shade();
  celestial();
}
// The sky's optics and the comet (halo.js), the same in both footers: drawn behind the house each minute, their light
// added; in the normal view each as the time of day lets it show (the sun's halos while it's up, the moon's by its light
// once it's dark, the comet after nautical twilight), in Fantasy Land's dark sky always. And for its lake, the sky just
// above the horizon, mirrored, with the sun or the moon in it, and where their glitter path falls
let skyC = null, skyBand = null, skyMsg = null; // the lake's sky, kept to hand over again as the lake comes back into view
function celestial() {
  const house = $("#foot .house");
  if (!house || !light) return;
  skyC ??= house.querySelector(".sky-c");
  const hr = house.getBoundingClientRect(), u = hr.width / 390, W = $("#foot").clientWidth, left = (W - hr.width) / 2;
  const deg = degPx(innerWidth, innerHeight), fz = state.fantasy;
  // Only as tall as what's drawn reaches: the 46° halo (and the arc 46° above a low sun) round whichever is up, or the comet
  const upY = (69 - (light.sun ? light.at.sun : light.at.moon)[1]) * u, cs = cometSky(new Date(), hourOf(get("houseTime")));
  const Hc = Math.ceil(Math.max(upY + 50 * deg, cs ? (cs.elev + 6) * deg : 0));
  skyC.style.height = `${Hc}px`;
  const place = ([x, y]) => ({ x: left + x * u, y: Hc - (69 - y) * u }), dark = (from) => (fz ? 1 : Math.max(0, Math.min(1, (-light.height - from) / 6)));
  const sunUp = light.sun, bright = moonLit ** 3; // a quarter moon gives about a tenth of a full one's light
  const sun = sunUp ? { ...place(light.at.sun), elev: light.height, show: 1 } : null;
  const moon = !sunUp ? { ...place(light.at.moon), elev: 55 * Math.sin(Math.PI * light.t), show: 0.45 * Math.sqrt(bright) * dark(4) } : null;
  const h = hourOf(get("houseTime"));
  let comet = null;
  if (cs) {
    const sp = sunUp ? place(light.at.sun) : { x: sunSky(h).x * W, y: Hc - sunSky(h).elev * deg }, x = cs.x * W, y = Hc - cs.elev * deg;
    const n = Math.hypot(x - sp.x, y - sp.y) || 1;
    comet = { x, y, tx: (x - sp.x) / n, ty: (y - sp.y) / n, show: 0.9 * cs.b * dark(6) };
  }
  drawSky(skyC, { w: W, h: Hc, k: 1, deg, sun, moon, comet }); // soft light: a pixel a CSS px is plenty
  stars(fz, deg);
  auroraShow(fz ? 1 : dark(6));
  // Fantasy Land's lake mirrors it: the sky's foot, flipped, with the disc of whichever is up
  skyMsg = null;
  if (!fz || !water || !waterSeen) return;
  const lake = $(".fz-lake"), lr = lake.getBoundingClientRect(), LH = lr.height, M = 4, k = Math.min(2, devicePixelRatio || 1);
  if (!LH) return;
  const lx = lr.left - skyC.getBoundingClientRect().left;
  skyBand ??= document.createElement("canvas");
  skyBand.width = Math.round((lr.width + 2 * M) * k); skyBand.height = Math.round((LH + 4) * k);
  const b = skyBand.getContext("2d");
  b.setTransform(k, 0, 0, -k, (M - lx) * k, Hc * k);
  b.drawImage(skyC, 0, 0, skyC.width, skyC.height, 0, 0, W, Hc);
  // (and the stars, their foot the horizon too)
  if (get("stars") && starsC?.width > 1) b.drawImage(starsC, 0, 0, starsC.width, starsC.height, 0, Hc - starsC.clientHeight, W, starsC.clientHeight);
  const up = sun ?? moon, d = place(sunUp ? light.at.sun : light.at.moon), r = 9 * u;
  if (sunUp) { b.fillStyle = "rgb(255,250,236)"; b.beginPath(); b.arc(d.x, d.y, r, 0, Math.PI * 2); b.fill(); }
  else {
    const lit = house.querySelector(".moon .lit"), rot = +(lit.getAttribute("transform") || "").replace(/[^-\d.]/g, "") || 0;
    b.save(); b.translate(d.x, d.y); b.scale(u, u);
    b.fillStyle = "rgba(150,160,190,.18)"; b.beginPath(); b.arc(0, 0, 9, 0, Math.PI * 2); b.fill();
    b.rotate((rot * Math.PI) / 180); b.fillStyle = "rgb(236,236,228)"; b.fill(new Path2D(lit.getAttribute("d") || "")); b.restore();
  }
  const low = sunUp && light.height < 12;
  const gl = { x: d.x - lx, h: Hc - d.y, b: sunUp ? 2.2 : 1.4 * Math.sqrt(bright), r: 1.6, col: sunUp ? (low ? [1, 0.75, 0.5] : [1, 0.96, 0.88]) : [0.85, 0.88, 1] };
  createImageBitmap(skyBand).then((bmp) => { skyMsg = { bmp, gl: up ? gl : null }; water?.("sky", skyMsg); }).catch(() => {});
}
// The stars (stars.js): the sky as the episode on show aired, that night, at the time of day shown; as faint as the sky
// lets them show: none by day, the brightest first in twilight, in London's light only to about magnitude 4, less under a
// bright moon; in Fantasy Land, which has no city, to 6.5, with the Milky Way (the moon washing it out as it fills).
// Drawn again only when something changes (the sky turns a little each minute)
let starsC = null, starKey = "";
const CITY = [[-1, 0], [-3, 0.8], [-6, 2], [-9, 3], [-12, 3.6], [-15, 4]];
function stars(fz, deg) {
  starsC ??= $("#foot .house .stars-c");
  if (!starsC) return;
  if (!get("stars")) { if (starKey) { starsC.width = starsC.height = 1; starKey = ""; } return; }
  const w = starsC.clientWidth, h = starsC.clientHeight;
  if (!w || !h) return;
  const e = light.height, night = !light.sun, i = CITY.findIndex(([x]) => x < e);
  const city = e >= -1 ? 0 : i < 0 ? 4 : CITY[i - 1][1] + ((CITY[i][1] - CITY[i - 1][1]) * (e - CITY[i - 1][0])) / (CITY[i][0] - CITY[i - 1][0]);
  const lim = fz ? 6.5 - (night ? 0.8 * moonLit : 0) : Math.max(0, city - (night ? 0.7 * moonLit : 0)), mw = fz ? 1 - (night ? 0.75 * moonLit : 0) : 0;
  // That night: the airdate's 10pm London, moved to the hour shown (the small hours are the next morning's)
  const hr = hourOf(get("houseTime")), off = hr - 22 < -10 ? hr + 2 : hr - 22, when = new Date((moonFor ?? Date.now()) + off * 3.6e6);
  const k = Math.min(1, Math.sqrt(3e6 / (w * h))); // a pixel a CSS px: points of light look the same, and twice that cost Fantasy Land's scroll a third more
  const key = [w, h, k, Math.round(+when / 6e4), lim.toFixed(2), mw.toFixed(2)].join();
  if (key === starKey) return;
  starKey = key;
  drawStars(starsC, { w, h, k, deg, when, lim, mw, ext: fz ? 0.16 : 0.28 });
}
onSwitch(["stars"], () => celestial());
// The aurora (night.js): in the sky with the stars, drawn in the scene's worker (else here, once, still), while it's on
// and the sky lets it show (in the normal view once it's dark; in Fantasy Land always) and the page is showing
let aur = null, aurShow = 0;
function aurora() {
  const c = $("#foot .house .aurora-c");
  if (!c) return;
  const on = get("aurora") && aurShow > 0 && !document.hidden;
  if (!aur) {
    if (!on) return;
    const w = scene();
    if (w) { const off = c.transferControlToOffscreen(); w.postMessage({ to: "night", type: "init", aurora: off }, [off]); aur = (t, a) => w.postMessage({ to: "night", type: t, arg: a }); }
    else { const n = night(c); aur = (t, a) => n[t](a); }
  }
  if (!on) return aur("stop");
  aur("start", { w: c.clientWidth, h: c.clientHeight, deg: degPx(innerWidth, innerHeight), res: Math.min(2, devicePixelRatio || 1) * get("auroraRes"), fps: get("auroraFps"),
    reduced: reducedMotion || !scene(), bright: get("auroraBright"), speed: get("auroraSpeed"), show: aurShow });
}
// How much shows, each minute: started or stopped as it crosses nothing, else only told
function auroraShow(v) {
  const was = aurShow;
  aurShow = +v.toFixed(2);
  if ((was > 0) !== (aurShow > 0)) aurora();
  else if (aur && was !== aurShow && get("aurora")) aur("show", aurShow);
}
let reAur = 0;
const auroraSoon = () => { if (!reAur) reAur = requestAnimationFrame(() => { reAur = 0; aurora(); }); };
onSwitch(["aurora", "auroraRes", "auroraFps", "auroraBright", "auroraSpeed"], auroraSoon);
addEventListener("resize", auroraSoon);
document.addEventListener("visibilitychange", auroraSoon);
// The sun's and moon's path across the sky (the drawing's units: the house's tops at y 15 to 53, the footer's top at 0),
// through the clear sky: rising at the left over the garage and the conifer's shoulder, under Patatas's name plate
// (above the footer at y -12 to -31), over the conifer's tip, high in the sky under his bubble (its foot at y -41) and
// down past the caravan; a curve through these points (Catmull-Rom), so it's never long behind the house or under him
const ARC = [[0, 104], [20, 80], [38, 58], [60, 34], [85, 16], [105, 4], [119, -3], [132, -8], [150, -20], [175, -26], [215, -28],
  [260, -27], [300, -22], [330, -8], [348, 18], [362, 48], [370, 80], [390, 104]];
function arcY(x) {
  const i = Math.max(1, Math.min(ARC.length - 3, ARC.findIndex(([px]) => px > x) - 1));
  const [p0, p1, p2, p3] = [ARC[i - 1], ARC[i], ARC[i + 1], ARC[i + 2]], u = (x - p1[0]) / (p2[0] - p1[0]);
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0])) * (p2[0] - p1[0]), m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0])) * (p2[0] - p1[0]);
  return (2 * u ** 3 - 3 * u ** 2 + 1) * p1[1] + (u ** 3 - 2 * u ** 2 + u) * m1 + (-2 * u ** 3 + 3 * u ** 2) * p2[1] + (u ** 3 - u ** 2) * m2;
}
// Light and shade from whichever is up: the buildings lit on its side, and shadows cast forward across the drive, away from
// it, long and to the side when it's low and short when it's high (sx, sy: how far across and down the shadow of each unit
// of height reaches); by the moon, as strong as it's full
let light = null, moonLit = 0.5;
// The sky's bands blend in a perceptual space, as light does, where supported: no grey between the blues and a sunset's rose
const OKLAB = CSS.supports("background-image", "linear-gradient(in oklab, red, blue)") ? "in oklab " : "";
function shade() {
  const house = $("#foot .house");
  if (!house || !light) return;
  const { t, sun } = light, deg = Math.PI / 180;
  const e = (sun ? 55 : 45) * Math.sin(Math.PI * t) * deg, az = (t - 0.5) * 160 * deg;
  const reach = Math.min(2.5, 1 / Math.tan(Math.max(e, 0.01))), low = Math.min(1, e / (8 * deg));
  const sx = Math.max(-1.6, Math.min(1.6, -Math.sin(az) * reach)), sy = 0.45 * Math.cos(az) * reach;
  const k = sun ? low : moonLit * low, sky = skyFor(light.height);
  const props = {
    "--sha": (0.55 * k).toFixed(3),
    "--sho": (sun ? 0.06 + 0.1 * low : 0.08 * moonLit).toFixed(3),
    // The edges facing the light catch it most when it's low and raking
    "--rim": (sun ? low * (0.5 + 0.35 * (1 - Math.min(1, e / (40 * deg)))) : 0.35 * moonLit).toFixed(3),
    // How brightly the structures' own colours show: full daylight, falling through twilight to what the moon gives
    // (by night the moon's light, a full moon's lighting the scene to near a third of daylight)
    "--illum": `${Math.max(7 + 23 * moonLit, light.height >= 0 ? 45 + 50 * Math.min(1, light.height / 20) : 45 + 3 * light.height).toFixed(1)}%`,
    "--lit": sun ? sky.sun : "#c4d0ff",
    "--sun": sky.sun,
    "--amb": sky.horizon,
    "--ambk": `${sky.ambK.toFixed(1)}%`,
  };
  // Each face of a structure by which way it faces (styles.css, --face): the sky's light on all of them, and the sun's
  // (or moon's) as it falls on each. It's behind the house, over the far side, so the fronts facing us have only the
  // sky's; the tops catch it by its height, the sides by which side it's on, the wing's roof slope a little of both
  const lx = Math.sin(az) * Math.cos(e), ly = Math.sin(e), lz = Math.cos(az) * Math.cos(e);
  // (and the sky's a little brighter on the sun's side, so a face turned away from it is a little darker)
  const face = (a, n) => (a + 0.08 * k * Math.max(-1, Math.min(1, n)) + (1 - a) * k * Math.max(0, Math.min(1, n))).toFixed(3);
  Object.assign(props, { "--fF": face(0.66, -lz), "--fT": face(0.8, ly / 0.82), "--fR": face(0.66, lx), "--fL": face(0.66, -lx), "--fS": face(0.72, 0.71 * (ly - lz)) });
  for (const p in props) house.style.setProperty(p, props[p]);
  // The sky: overhead to the horizon, a glow on the horizon under the sun (wide near sunrise and sunset, where it lingers
  // after sunset; none around the sun itself), and by night a faint one around the moon; the drive in its gravel (styles.css), lit the same way. In
  // the drawing's units from its middle
  const u = (n) => `calc(${n.toFixed(1)} * var(--u))`, x = (n) => `calc(50% + ${(n - 195).toFixed(1)} * var(--u))`;
  const y = (n) => `calc(100% - ${(78 - n).toFixed(1)} * var(--u))`; // the sky box ends at y 78 and rises behind the page
  const [gx] = light.at.sun, gy = 69, hi = Math.max(0, Math.min(1, light.height / 25));
  const glow = (c, a) => `color-mix(in srgb, ${c} ${(a * 100).toFixed(0)}%, transparent)`;
  const moonGlow = sun ? [] : [`radial-gradient(${u(60)} ${u(60)} at ${x(light.at.moon[0])} ${y(light.at.moon[1])}, ${glow("#c8d2ff", 0.18 * moonLit)}, transparent)`];
  // Opposite the sun in twilight, the Belt of Venus over Earth's shadow; by full night, London's faint glow on the horizon
  const belt = sky.beltA ? [`radial-gradient(${u(230)} ${u(44)} at ${x(390 - gx)} ${y(gy)}, ${glow(`color-mix(in srgb, ${sky.top} 55%, ${sky.horizon})`, sky.beltA)} 22%, ${glow(sky.belt, sky.beltA)} 48%, transparent)`] : [];
  const city = light.height < -8 ? [`linear-gradient(to top, ${glow("#3a2c2a", 0.5 * Math.min(1, (-8 - light.height) / 8))}, transparent ${u(36)})`] : [];
  house.querySelector(".sky").style.background = [...moonGlow,
    `radial-gradient(${u(220 - 100 * hi)} ${u(60 + 20 * hi)} at ${x(gx)} ${y(gy)}, ${glow(sky.glow, sky.glowA)}, transparent)`,
    ...belt, ...city,
    `linear-gradient(${OKLAB}to top, ${sky.horizon}, ${sky.low} ${u(30)}, ${sky.high} ${u(120)}, ${sky.top})`].join(",");
  house.querySelector(".ground").style.background = [
    `radial-gradient(${u(200)} ${u(30)} at ${x(gx)} 0, ${glow(sky.glow, sky.glowA * 0.3)}, transparent)`,
    "linear-gradient(var(--mc), color-mix(in srgb, var(--mc) 55%, var(--bg)))"].join(",");
  // The ducks in the same light: dimmer and cooler in twilight and by night
  const dim = Math.max(0.7, Math.min(1, 1 + light.height / 40)), ducks = $("#foot .ducks");
  const f = dim < 1 ? `brightness(${dim.toFixed(2)}) saturate(${dim.toFixed(2)})` : "";
  if (ducks && ducks.style.filter !== f) ducks.style.filter = f;
  // Patatas and his speech bubble in the same light (#dq-light, a colour matrix): their colours times the light's, warm
  // from a low sun, cool and greyer from the moon, dimmer in twilight and by night (brighter under a fuller moon); by day,
  // as they are
  const dq = $("#dq"), cm = $("#dq-light fecolormatrix") ?? $("#dq-light feColorMatrix");
  if (dq && cm) {
    const hgt = light.height, night = Math.max(0, Math.min(1, -hgt / 10)); // 0 by day and at sunset, 1 by full night
    const lum = hgt >= 12 ? 1 : hgt >= 0 ? 0.9 + 0.1 * (hgt / 12) : 0.9 - night * (0.9 - (0.6 + 0.2 * moonLit));
    const tint = hgt >= 0 ? 0.4 * Math.max(0, 1 - hgt / 15) : 0.4 + 0.05 * night, sat = 1 - 0.25 * night;
    const c = (sun || night < 0.5 ? sky.sun : "#c4d0ff").match(/\w\w/g).map((v) => parseInt(v, 16) / 255);
    const row = (i) => [0.2126, 0.7152, 0.0722].map((w, j) => (w * (1 - sat) + (i === j ? sat : 0)) * lum * (1 - tint + tint * c[i]));
    const plain = lum > 0.995 && tint < 0.01;
    if (!plain) cm.setAttribute("values", [0, 1, 2].map((i) => [...row(i), 0, 0].map((v) => +v.toFixed(3)).join(" ")).join(" ") + " 0 0 0 1 0");
    dq.classList.toggle("lit", !plain);
    // His bubble's shape and colours by the sky: a cloud by day, a glowing pill while the sun is low, a soft cloud in
    // twilight, a thought bubble by night (styles.css)
    dq.dataset.sky = hgt >= 15 ? "day" : hgt >= -2 ? "golden" : hgt >= -12 ? "twilight" : "night";
    for (const [k, v] of [["--s-top", sky.top], ["--s-hor", sky.horizon], ["--s-glow", sky.glow]]) dq.style.setProperty(k, v);
  }
  // The shaded shapes' gradient, and their edge highlights', run from the side facing the light to the other
  let vx = Math.sin(az) * Math.cos(e), vy = -Math.sin(e);
  const n = Math.hypot(vx, vy) || 1;
  vx /= n;
  vy /= n;
  for (const g of house.querySelectorAll("#h-shade, #h-rim"))
    for (const [a, v] of [["x1", 0.5 + 0.5 * vx], ["y1", 0.5 + 0.5 * vy], ["x2", 0.5 - 0.5 * vx], ["y2", 0.5 - 0.5 * vy]]) g.setAttribute(a, v.toFixed(3));
  // The ducks' the same way, but always darker underneath, where they sit
  const dn = Math.hypot(vx, vy - 0.8), dx = vx / dn, dy = (vy - 0.8) / dn, dg = $("#dk-shade");
  if (dg) for (const [a, v] of [["x1", 0.5 + 0.5 * dx], ["y1", 0.5 + 0.5 * dy], ["x2", 0.5 - 0.5 * dx], ["y2", 0.5 - 0.5 * dy]]) dg.setAttribute(a, v.toFixed(3));
  // Each point h above the ground (at y = b) falls h·sx across and h·sy down: the caravan stands nearer, on its wheels
  const cast = (b) => `matrix(1 0 ${(-sx).toFixed(3)} ${(-sy).toFixed(3)} ${(b * sx).toFixed(2)} ${(b * (1 + sy)).toFixed(2)})`;
  // Each structure's from its own feet, where its depth puts them (dy); a deep one's back casts from where its back
  // stands (b, and the transform that takes its front there)
  for (const el of house.querySelectorAll(".cast use[data-b]")) {
    const { dy, b, back = "" } = el.dataset;
    el.setAttribute("transform", `translate(0 ${dy}) ${cast(+b)} ${back}`);
  }
  // The ducks' own: each one's silhouette (14 high, its feet at y 98.1) cast the same way; the soft contact shadows under
  // their feet stay put
  house.querySelectorAll(".dcast path").forEach((el, i) => el.setAttribute("transform", `${cast(98.1)} translate(${111.25 + 25 * i} 85) scale(.875)`));
  // The lights on at night (styles.css), from dusk to dawn: the door's light across the drive, and each duck's shadow cast
  // away from it, radiating from the door's foot (x 159, y 79.5), longer the further the duck stands from it (its points
  // h high fall h·k times the duck's distance on: the door's light about 26 high); cut out of the light (.lamp-sh, a mask)
  const lamps = light.height < -3;
  $("#foot").classList.toggle("lamps", lamps);
  if (lamps) house.querySelectorAll(".lamp-sh path").forEach((el, i) => {
    const k = 1 / 19, lx = (120 + 25 * i - 159) * k, ly = (98.1 - 79.5) * k;
    el.setAttribute("transform", `matrix(1 0 ${(-lx).toFixed(3)} ${(-ly).toFixed(3)} ${(98.1 * lx).toFixed(2)} ${(98.1 * (1 + ly)).toFixed(2)}) translate(${111.25 + 25 * i} 85) scale(.875)`);
  });
  // And the house's shadow on them: from points up each duck's height (in the buildings' units: its feet at y 121.1,
  // 17.5 high), back along the light to the structure that would cast it; each duck darkens by the share of it in shade
  // (each structure in its own frame, before its depth's dy)
  const solids = $$(".b .ln .o", house).map((el) => [el, +(el.closest("[data-dy]")?.dataset.dy ?? 0)]), pt = house.querySelector("svg").createSVGPoint();
  const shaded = (gx, gy, up) => sy > 0 && solids.some(([el, dy]) => {
    const h = up + (gy - dy - 96) / sy; // the height of the point on it whose shadow passes through this one
    pt.x = gx - sx * (h - up);
    pt.y = 96 - h;
    return el.isPointInFill?.(pt);
  });
  $$("#foot .dk").forEach((dk, i) => {
    const gx = (81 + 25 * i) / 0.8, gy = 121.1; // its feet at y 98.1, in the buildings' units
    let n = 0;
    for (let up = 1; up < 18; up += 3) if (shaded(gx, gy, up)) n++;
    // The sky still lights them in shade; darkened, yellow turns olive, so their shade is warmed a little toward amber
    const d = (n / 6) * k, f = n ? `brightness(${(1 - 0.35 * d).toFixed(2)}) saturate(${(1 + 0.15 * d).toFixed(2)}) hue-rotate(${(-4 * d).toFixed(1)}deg)` : "";
    if (dk.style.filter !== f) dk.style.filter = f;
  });
}
// The moon is the real one over London as the episode on show aired (10pm London; sky.js): its phase, and its lit edge
// turned as it stood. The week on the Standings, the episode on Episodes, and on Cast the latest to have aired. Or the
// phase chosen on Moss's Moon phase card, its lit edge toward the sun below the horizon (west of it, at the right, while
// it waxes; east while it wanes)
let moonFor = null, airM = null, moonKey = "";
function airMoon() {
  const eps = state.d?.episodes, el = $("#foot .house .lit");
  if (!eps?.length || !el) return;
  const i = state.page === "standings" ? stWeek(state.d) - 1 : state.page === "episodes" ? state.ep - 1 : Math.max(0, eps.filter((e) => e.air <= Date.now()).length - 1);
  const air = eps[Math.min(Math.max(i, 0), eps.length - 1)].air;
  if (+air !== moonFor) {
    moonFor = +air;
    airM = moonAt(air);
    const turn = Math.acos(1 - 2 * airM.lit) / (2 * Math.PI);
    setAirPhase(airM.waxing ? turn : 1 - turn);
    const mc = get("moonPhase") === "air" && $("#cast-body .sw-range[data-sw=moonPhase]")?.closest(".sw-card");
    if (mc) dialCard(mc, item("moonPhase"));
  }
  const pick = get("moonPhase");
  let { lit, edge } = airM;
  if (pick !== "air" && light) {
    const p = +pick, h = hourOf(get("houseTime")), em = 55 * Math.sin(Math.PI * Math.max(0, Math.min(1, light.t)));
    lit = (1 - Math.cos(2 * Math.PI * p)) / 2;
    // The sun's angle from it (its elongation), below the horizon; across, the rest of that angle, west while it waxes
    const th = 360 * Math.min(p, 1 - p), es = sunSky(h).elev, dy = em - Math.min(es, 0), dx = Math.sqrt(Math.max(0, th * th - dy * dy));
    edge = (Math.atan2(dy, (p < 0.5 ? 1 : -1) * Math.max(dx, 0.001)) * 180) / Math.PI;
  }
  const key = `${lit.toFixed(3)} ${edge.toFixed(1)}`;
  if (key === moonKey) return;
  moonKey = key;
  el.setAttribute("d", moonPath(lit, 9));
  el.setAttribute("transform", `rotate(${edge.toFixed(1)})`);
  moonLit = lit;
  shade();
  celestial();
}
setInterval(showDay, 60000);
onSwitch(["houseTime"], showDay);
onSwitch(["moonPhase"], airMoon);
const houseSeen = new IntersectionObserver((es) => {
  const e = es.at(-1);
  if (e.isIntersecting) e.target.classList.add("up");
  e.target.classList.toggle("go", e.isIntersecting);
});
// Sideways strips fade at the edge where more tabs are hidden
function edges() {
  for (const s of $$(".strip.scroll")) {
    if (!s.offsetParent) continue;
    s.classList.toggle("more-l", s.scrollLeft > 2);
    s.classList.toggle("more-r", s.scrollLeft + s.clientWidth < s.scrollWidth - 2);
  }
}
document.addEventListener("scroll", (e) => { if (e.target.classList?.contains("strip")) edges(); still(); }, { capture: true, passive: true });
// Fantasy: the decorative animations hold still while anything scrolls, so the scroll has the frames (not the footer's)
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
  if (reducedMotion || !get("howLight") || state.page !== "standings") return; // the scoring cards' light, off by default
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
if (!SDA) addEventListener("scroll", queuePeek, { passive: true });

addEventListener("resize", () => { peek(); for (const sw of [ST, EP, CAST]) if ($(sw.body).offsetParent) jump(sw, sw.get()); queueLight(); edges(); for (const r of $$("#st-body .pc.open")) placeLine(r); if (state.stView) syncBoards(true); });

addEventListener("hashchange", () => {
  const h = readHash();
  if (h.key !== state.key) loadSeries(h.key);
  else catchUp(); // the cast's order and index are the view's
  applyArg(h.page, h.arg);
  show(h.page);
});

// First render waits for the fonts (≤1.2s), so it isn't laid out twice
const FACES = ["16px Bungee", "700 16px Nunito", "800 16px Nunito", "16px Inter", "600 16px Inter", "700 16px Inter", "800 16px Inter", "16px 'DM Mono'", "500 16px 'DM Mono'", "16px Chewy", "700 16px Cinzel"];
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
  initFlip({ redraw, later });
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
