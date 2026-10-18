// Hidden settings, tweaked on Maurice Moss's cards (the Cast tab's Easter egg, cast.js), a card per effect, per device in
// localStorage. Every effect is at its lowest quality by default, and off but for the podium effects, the stars, the
// footers and Fantasy Land's transition: frame pacing comes first, and the cards turn them on and up. Everything applies
// live (fm-switch events). Each kind of setting has its control: an effect's on/off a switch in its card's head (main), a
// small fixed set segmented buttons (steps, choice), a strength a slider (range), a value that can follow something (the
// clock, the airdate) a slider over buttons (dial)

import { SITE } from "./site.js";

// Fantasy Land's transition is Slam where Chromium draws it, else Iris (Safari, and every iOS browser, all WebKit): Slam is
// broken there, so it's kept on the card to look into, but chosen only for the visit (`brief`)
const CHROMIUM = !!navigator.userAgentData?.brands?.some((b) => b.brand === "Chromium");
// The cards in groups, each folding away (cast.js; which are open is kept per device), the same in both views
export const GROUPS = [
  { id: "fz", title: "Fantasy Land", cards: [
    // Fantasy Land's switch in its head (not a setting: it switches the view), and how the view changes (flip.js): a tap
    // on one plays it
    { title: "Fantasy Land", fz: true,
      items: [{ key: "fzMove", type: "choice", label: "Transition", def: CHROMIUM ? "slam" : "iris", brief: CHROMIUM ? [] : ["slam"], options: [["iris", "Iris"], ["ripple", "Ripple"], ["grade", "Grade"],
        ["vertigo", "Vertigo"], ["dream", "Dream"], ["turn", "Turn"], ["slam", "Slam"], ["off", "Off"]] }] },
    { title: "Background effects",
      items: [
        { key: "fall", type: "toggle", def: false, main: true, cls: "no-fall" },
        { key: "fallRes", type: "steps", label: "Resolution", def: 0.25, options: [[0.25, "25%"], [0.5, "50%"], [0.75, "75%"], [1, "100%"]] },
        // Rates a 60 or 120Hz screen divides evenly, so each frame is held as long as the last (45 came out uneven)
        { key: "fallFps", type: "steps", label: "Frame rate", def: 15, options: [[15, "15"], [20, "20"], [30, "30"], [60, "60 fps"]] },
        { key: "fallDensity", type: "range", label: "Streaks", def: 1, min: 0, max: 3, step: 0.25, unit: "×" },
        { key: "fallFigures", type: "range", label: "Figures", def: 7, min: 0, max: 20, step: 1, unit: "" },
        { key: "fallBright", type: "range", label: "Brightness", def: 1, min: 0.25, max: 2, step: 0.25, unit: "×" },
        { key: "fallSpeed", type: "range", label: "Speed", def: 1, min: 0.25, max: 2, step: 0.25, unit: "×" },
      ] },
    // The rest of its motion: the sparkles' twinkle, the glint on Fantasy and the sliding tab rainbow. Off, all there, still
    { title: "Decorations",
      items: [{ key: "fzDeco", type: "toggle", def: false, main: true, cls: "no-deco" }] },
    { title: "Card opacity",
      items: [{ key: "fzAlpha", type: "range", def: 0.84, min: 0.5, max: 1, step: 0.02, pct: true, css: "--fz-a" }] },
  ] },
  // The sky over both footers (main.js, halo.js, stars.js, night.js)
  { id: "sky", title: "Sky", cards: [
    // The scene at a chosen time, or by the device's clock: a slider through the day (any quarter hour, kept as its hour,
    // "13.25") over the times of day as buttons
    { title: "Time of day",
      items: [{ key: "houseTime", type: "dial", def: "clock", min: 0, max: 23.75, step: 0.25, options: [["5.5", "Dawn"], ["7", "Sunrise"],
        ["10", "Morning"], ["13", "Midday"], ["16.5", "Afternoon"], ["19.5", "Sunset"], ["20.5", "Dusk"], ["23", "Night"], ["clock", "Clock"]],
        now: () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; }, say: (h) => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}` }] },
    // The moon's phase (its age through the month: 0 new, 0.5 full), or the real one as the episode on show aired
    { title: "Moon phase",
      items: [{ key: "moonPhase", type: "dial", def: "air", min: 0, max: 0.99, step: 0.01, options: [["0", "New"], ["0.25", "First qtr"], ["0.5", "Full"],
        ["0.75", "Last qtr"], ["air", "Airdate"]], now: () => airPhase, say: phaseSay }] },
    { title: "Stars",
      items: [{ key: "stars", type: "toggle", def: true, main: true, cls: "no-stars" }] },
    // An aurora, at its lowest quality to begin with
    { title: "Aurora",
      items: [
        { key: "aurora", type: "toggle", def: false, main: true, cls: "no-aurora" },
        { key: "auroraRes", type: "steps", label: "Resolution", def: 0.25, options: [[0.25, "25%"], [0.5, "50%"], [0.75, "75%"], [1, "100%"]] },
        { key: "auroraFps", type: "steps", label: "Frame rate", def: 15, options: [[15, "15"], [20, "20"], [30, "30"], [60, "60 fps"]] },
        { key: "auroraBright", type: "range", label: "Brightness", def: 1, min: 0.25, max: 2, step: 0.25, unit: "×" },
        { key: "auroraSpeed", type: "range", label: "Speed", def: 1, min: 0.25, max: 3, step: 0.25, unit: "×" },
      ] },
  ] },
  { id: "fx", title: "Effects", cards: [
    // (with a podium of its own on the card, to see them on: the leader's light and last place's gas)
    { title: "Podium effects", preview: "podium",
      items: [
        { key: "podium", type: "toggle", def: true, main: true, cls: "no-podium" },
        { key: "podRes", type: "steps", label: "Resolution", def: 0.25, options: [[0.25, "25%"], [0.5, "50%"], [0.75, "75%"], [1, "100%"]] },
        { key: "podLight", type: "range", label: "Light", def: 1, min: 0, max: 2, step: 0.25, unit: "×" },
        { key: "podGas", type: "range", label: "Gas", def: 1, min: 0, max: 2, step: 0.25, unit: "×" },
      ] },
    // (the card itself one of them, its light drifting)
    { title: "Scoring cards", preview: "how",
      items: [{ key: "howLight", type: "toggle", def: false, main: true, cls: "no-howlight" }] },
    // The footers' motion: Fantasy Land's lake and Alex's stream (when he's pressed); the house's lights coming up on show
    // days and its chimney's smoke. Off, still (the stream drawn still, the house lit at once)
    { title: "Footer",
      items: [{ key: "fzSea", type: "toggle", def: true, main: true, cls: "no-sea" }] },
  ] },
];
export const CARDS = GROUPS.flatMap((g) => g.cards);
const ITEMS = Object.fromEntries(CARDS.flatMap((c) => c.items.map((it) => [it.key, it])));
const id = (k) => `fm-sw-${k}`;
export const item = (k) => ITEMS[k];
// A dial's value (the time of day, the moon's phase): the one chosen, or what it follows (the clock, the airdate's moon)
export const dialAt = (it, v = values[it.key]) => (v === it.def ? it.now() : +v);
export const hourOf = (v) => dialAt(ITEMS.houseTime, v);
// The airdate's moon (main.js), for the Moon phase card while it follows it
let airPhase = 0.5;
export const setAirPhase = (p) => { airPhase = p; };
function phaseSay(p) {
  const lit = (1 - Math.cos(2 * Math.PI * p)) / 2, near = (q) => Math.abs(p - q) < 0.02 || Math.abs(p - q - 1) < 0.02;
  return near(0) ? "New" : near(0.25) ? "First quarter" : near(0.5) ? "Full" : near(0.75) ? "Last quarter" : `${p < 0.5 ? "Waxing" : "Waning"} ${Math.round(lit * 100)}%`;
}
export const shown = (it, v) => (it.type === "dial" ? it.say(dialAt(it, v)) : it.pct ? `${Math.round(v * 100)}%` : `${+v.toFixed(2)}${it.unit}`);

// Read once; settings that no longer exist are forgotten
const values = {};
try {
  for (const k of Object.keys(localStorage)) if (k.startsWith("fm-sw-") && !ITEMS[k.slice(6)]) localStorage.removeItem(k);
  for (const k of ["fm-auto", "fm-pinned", "fm-fps-pos"]) localStorage.removeItem(k); // auto-tune and the frame rate graphs, gone
} catch { /* private mode */ }
// A value it can take: one still offered (not an old slider's in-between step), or a dial's anything in its range
const valid = (it, v) => (it.type === "dial" ? v === it.design || (typeof v === "string" && v !== "" && +v >= it.min && +v <= it.max)
  : it.type === "toggle" ? typeof v === "boolean" : it.type === "choice" ? typeof v === "string" && it.options.some(([o]) => o === v)
  : typeof v === "number" && (it.options ? it.options.some(([o]) => o === v) : v >= it.min && v <= it.max));
// The design's defaults, then the live site's where it has published its own (site.js)
for (const [k, it] of Object.entries(ITEMS)) { it.design = it.def; if (k in SITE && valid(it, SITE[k]) && !it.brief?.includes(SITE[k])) it.def = SITE[k]; }
for (const [k, it] of Object.entries(ITEMS)) {
  let v = null;
  try { v = localStorage.getItem(id(k)); } catch { /* private mode */ }
  const read = v == null ? null : it.type === "toggle" ? v === "1" : it.type === "choice" || it.type === "dial" ? v : +v;
  values[k] = read == null || !valid(it, read) || it.brief?.includes(read) ? it.def : read;
  if (v != null && values[k] === it.def) try { localStorage.removeItem(id(k)); } catch { /* private mode */ } // now the site's own
}
// What this device would publish as the live site's settings: everything it has that differs from the design
export const toPublish = () => Object.fromEntries(Object.entries(ITEMS).filter(([k, it]) => values[k] !== it.design).map(([k]) => [k, values[k]]));
export const sitePublished = () => Object.keys(SITE).length > 0;
export const get = (k) => values[k];
const tell = (k, v) => dispatchEvent(new CustomEvent("fm-switch", { detail: { key: k, value: v } }));

export function set(k, v) {
  const it = ITEMS[k];
  values[k] = v;
  try {
    if (v === it.def || it.brief?.includes(v)) localStorage.removeItem(id(k)); // (a brief choice lasts the visit)
    else localStorage.setItem(id(k), it.type === "toggle" ? (v ? "1" : "0") : String(v));
  } catch { /* private mode: lasts the visit */ }
  apply(it);
  tell(k, v);
}
export const changed = () => Object.keys(ITEMS).filter((k) => get(k) !== ITEMS[k].def).length;
export const changedIn = (g) => g.cards.flatMap((c) => c.items).filter((it) => get(it.key) !== it.def).length;
// Back to the design
export function resetAll() {
  for (const k of Object.keys(ITEMS)) if (get(k) !== ITEMS[k].def) set(k, ITEMS[k].def);
}
export const onSwitch = (keys, fn) => addEventListener("fm-switch", ({ detail: d }) => { if (keys.includes(d.key)) fn(d); });

// What CSS can do on its own: a class while a toggle is off, or a custom property
function apply(it) {
  const html = document.documentElement;
  if (it.cls) html.classList.toggle(it.cls, !get(it.key));
  if (it.css) html.style.setProperty(it.css, get(it.key));
}
for (const it of Object.values(ITEMS)) if (it.cls || it.css) apply(it);
