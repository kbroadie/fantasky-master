// Hidden settings, tweaked on Maurice Moss's cards (the Cast tab's Easter egg, cast.js), a card per effect, per device in
// localStorage. Defaults are the site as designed; everything applies live (fm-switch events). Each kind of setting has
// its control: an effect's on/off a switch in its card's head (main), a small fixed set segmented buttons (steps, choice),
// a strength a slider (range)
export const CARDS = [
  // Fantasy Land's switch in its head (not a setting: it switches the view), and how the view changes (flip.js)
  { title: "Fantasy Land", fz: true,
    items: [{ key: "fzMove", type: "choice", label: "Transition", def: "iris", options: [["iris", "Iris"], ["ripple", "Ripple"], ["blur", "Blur"],
      ["lens", "Lens"], ["flare", "Flare"], ["swirl", "Swirl"], ["slow", "Slow"], ["flash", "Flash"], ["grade", "Grade"],
      ["zoom", "Zoom"], ["roll", "Roll"], ["tilt", "Tilt"], ["vertigo", "Vertigo"], ["dream", "Dream"], ["turn", "Turn"], ["slam", "Slam"], ["off", "Off"]] }] },
  { title: "Frame rate",
    items: [{ key: "fps", type: "toggle", def: false, main: true }] },
  { title: "Background effects", view: "fz",
    items: [
      { key: "fall", type: "toggle", def: true, main: true, cls: "no-fall" },
      { key: "fallRes", type: "steps", label: "Resolution", def: 1, options: [[0.25, "25%"], [0.5, "50%"], [0.75, "75%"], [1, "100%"]] },
      { key: "fallFps", type: "steps", label: "Frame rate", def: 60, options: [[15, "15"], [30, "30"], [45, "45"], [60, "60 fps"]] },
      { key: "fallDensity", type: "range", label: "Streaks", def: 1, min: 0, max: 3, step: 0.25, unit: "×" },
      { key: "fallFigures", type: "range", label: "Figures", def: 7, min: 0, max: 20, step: 1, unit: "" },
      { key: "fallBright", type: "range", label: "Brightness", def: 1, min: 0.25, max: 2, step: 0.25, unit: "×" },
      { key: "fallSpeed", type: "range", label: "Speed", def: 1, min: 0.25, max: 2, step: 0.25, unit: "×" },
    ] },
  { title: "Card opacity", view: "fz",
    items: [{ key: "fzAlpha", type: "range", def: 0.84, min: 0.5, max: 1, step: 0.02, pct: true, css: "--fz-a" }] },
  { title: "Podium effects",
    items: [
      { key: "podium", type: "toggle", def: true, main: true, cls: "no-podium" },
      { key: "podRes", type: "steps", label: "Resolution", def: 1, options: [[0.25, "25%"], [0.5, "50%"], [0.75, "75%"], [1, "100%"]] },
      { key: "podLight", type: "range", label: "Light", def: 1, min: 0, max: 2, step: 0.25, unit: "×" },
      { key: "podGas", type: "range", label: "Gas", def: 1, min: 0, max: 2, step: 0.25, unit: "×" },
    ] },
  { title: "Scoring cards",
    items: [{ key: "howLight", type: "toggle", def: true, main: true, cls: "no-howlight" }] },
];
// A card for one view only (view: "fz", Fantasy Land) shows only there
export const cardsShown = (fantasy) => CARDS.filter((c) => !c.view || (c.view === "fz") === fantasy);
const ITEMS = Object.fromEntries(CARDS.flatMap((c) => c.items.map((it) => [it.key, it])));
const id = (k) => `fm-sw-${k}`;
export const item = (k) => ITEMS[k];
export const shown = (it, v) => (it.pct ? `${Math.round(v * 100)}%` : `${+v.toFixed(2)}${it.unit}`);

// Read once; settings that no longer exist are forgotten
const values = {};
try { for (const k of Object.keys(localStorage)) if (k.startsWith("fm-sw-") && !ITEMS[k.slice(6)]) localStorage.removeItem(k); } catch { /* private mode */ }
for (const [k, it] of Object.entries(ITEMS)) {
  let v = null;
  try { v = localStorage.getItem(id(k)); } catch { /* private mode */ }
  const read = it.type === "toggle" ? v === "1" : it.type === "choice" ? v : +v;
  // A value no longer offered (an old slider's in-between step) is the default
  values[k] = v == null || (it.options && !it.options.some(([o]) => o === read)) ? it.def : read;
}
export const get = (k) => values[k];
export function set(k, v) {
  const it = ITEMS[k];
  values[k] = v;
  try {
    if (v === it.def) localStorage.removeItem(id(k));
    else localStorage.setItem(id(k), it.type === "toggle" ? (v ? "1" : "0") : String(v));
  } catch { /* private mode: lasts the visit */ }
  apply(it);
  dispatchEvent(new CustomEvent("fm-switch", { detail: { key: k, value: v } }));
}
export const changed = () => Object.keys(ITEMS).filter((k) => get(k) !== ITEMS[k].def).length;
export function resetAll() { for (const k of Object.keys(ITEMS)) if (get(k) !== ITEMS[k].def) set(k, ITEMS[k].def); }
export const onSwitch = (keys, fn) => addEventListener("fm-switch", ({ detail: d }) => { if (keys.includes(d.key)) fn(d); });

// What CSS can do on its own: a class while a toggle is off, or a custom property
function apply(it) {
  const html = document.documentElement;
  if (it.cls) html.classList.toggle(it.cls, !get(it.key));
  if (it.css) html.style.setProperty(it.css, get(it.key));
}
for (const it of Object.values(ITEMS)) if (it.cls || it.css) apply(it);
