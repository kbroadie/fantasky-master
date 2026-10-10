// Hidden settings, tweaked on Maurice Moss's cards (the Cast tab's Easter egg, cast.js): toggles and sliders, a card per
// effect, per device in localStorage. Defaults are the site as designed; everything applies live (fm-switch events)
export const CARDS = [
  { title: "Frame rate",
    items: [{ key: "fps", type: "toggle", def: false, main: true }] },
  { title: "Falling background",
    items: [
      { key: "fall", type: "toggle", def: true, main: true, cls: "no-fall" },
      { key: "fallFps", type: "range", label: "Frame rate", def: 30, min: 10, max: 60, step: 5, unit: " fps" },
      { key: "fallDensity", type: "range", label: "Streaks", def: 1, min: 0, max: 3, step: 0.25, unit: "×" },
      { key: "fallFigures", type: "range", label: "Figures and emoji", def: 7, min: 0, max: 20, step: 1, unit: "" },
      { key: "fallBright", type: "range", label: "Brightness", def: 1, min: 0.25, max: 2, step: 0.25, unit: "×" },
      { key: "fallSpeed", type: "range", label: "Speed", def: 1, min: 0.25, max: 2, step: 0.25, unit: "×" },
    ] },
  { title: "Podium effects",
    items: [
      { key: "podium", type: "toggle", def: true, main: true, cls: "no-podium" },
      { key: "podRes", type: "range", label: "Resolution", def: 0.5, min: 0.25, max: 1, step: 0.25, unit: "×" },
      { key: "podLight", type: "range", label: "Light", def: 1, min: 0, max: 2, step: 0.25, unit: "×" },
      { key: "podGas", type: "range", label: "Gas", def: 1, min: 0, max: 2, step: 0.25, unit: "×" },
    ] },
  { title: "Rainbow decorations",
    items: [
      { key: "sparkles", type: "toggle", label: "Title sparkles", def: true, cls: "no-sparkles" },
      { key: "glint", type: "toggle", label: "Glint on Fantasy", def: true, cls: "no-glint" },
      { key: "tabBow", type: "toggle", label: "Sliding tab rainbow", def: true, cls: "no-tabbow" },
      { key: "dolphins", type: "toggle", label: "Leaping dolphins", def: true, cls: "no-dolphins" },
      { key: "stillScroll", type: "toggle", label: "Hold still while scrolling", def: true },
    ] },
  { title: "Rainbow cards",
    items: [{ key: "fzAlpha", type: "range", label: "Opacity", def: 0.84, min: 0.5, max: 1, step: 0.02, pct: true, css: "--fz-a" }] },
  { title: "Scoring cards",
    items: [{ key: "howLight", type: "toggle", def: true, main: true, cls: "no-howlight" }] },
];
const ITEMS = Object.fromEntries(CARDS.flatMap((c) => c.items.map((it) => [it.key, it])));
const id = (k) => `fm-sw-${k}`;
export const item = (k) => ITEMS[k];
export const shown = (it, v) => (it.pct ? `${Math.round(v * 100)}%` : `${+v.toFixed(2)}${it.unit}`);

// Read once: get() runs on every scroll (still() in main.js)
const values = {};
for (const [k, it] of Object.entries(ITEMS)) {
  let v = null;
  try { v = localStorage.getItem(id(k)); } catch { /* private mode */ }
  values[k] = v == null ? it.def : it.type === "toggle" ? v === "1" : +v;
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
export function resetAll() { for (const k of Object.keys(ITEMS)) if (get(k) !== ITEMS[k].def) set(k, ITEMS[k].def); }
export const onSwitch = (keys, fn) => addEventListener("fm-switch", ({ detail: d }) => { if (keys.includes(d.key)) fn(d); });

// What CSS can do on its own: a class while a toggle is off, or a custom property
function apply(it) {
  const html = document.documentElement;
  if (it.cls) html.classList.toggle(it.cls, !get(it.key));
  if (it.css) html.style.setProperty(it.css, get(it.key));
}
for (const it of Object.values(ITEMS)) if (it.cls || it.css) apply(it);
