// Hidden settings, tweaked on Maurice Moss's cards (the Cast tab's Easter egg, cast.js), a card per effect, per device in
// localStorage. Every effect is at its lowest quality by default, and off but for the podium effects, Fantasy Land's sea
// and its transition: frame pacing comes first, and the cards turn them on and up. Everything applies live (fm-switch events). Each kind of setting has
// its control: an effect's on/off a switch in its card's head (main), a small fixed set segmented buttons (steps, choice),
// a strength a slider (range)

// Fantasy Land's transition is Slam where Chromium draws it, else Iris (Safari, and every iOS browser, all WebKit)
const CHROMIUM = !!navigator.userAgentData?.brands?.some((b) => b.brand === "Chromium");
export const CARDS = [
  // Fantasy Land's switch in its head (not a setting: it switches the view), and how the view changes (flip.js)
  { title: "Fantasy Land", fz: true,
    items: [{ key: "fzMove", type: "choice", label: "Transition", def: CHROMIUM ? "slam" : "iris", options: [["iris", "Iris"], ["ripple", "Ripple"], ["blur", "Blur"],
      ["lens", "Lens"], ["flare", "Flare"], ["swirl", "Swirl"], ["slow", "Slow"], ["flash", "Flash"], ["grade", "Grade"],
      ["zoom", "Zoom"], ["roll", "Roll"], ["tilt", "Tilt"], ["vertigo", "Vertigo"], ["dream", "Dream"], ["turn", "Turn"], ["slam", "Slam"], ["off", "Off"]] }] },
  { title: "Frame rate",
    items: [{ key: "fps", type: "toggle", def: false, main: true }] },
  // The effects step their quality to what this device keeps up with (tune.js)
  { title: "Auto-tune",
    items: [{ key: "autoTune", type: "toggle", def: false, main: true }] },
  { title: "Background effects", view: "fz",
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
  { title: "Decorations", view: "fz",
    items: [{ key: "fzDeco", type: "toggle", def: false, main: true, cls: "no-deco" }] },
  { title: "Card opacity", view: "fz",
    items: [{ key: "fzAlpha", type: "range", def: 0.84, min: 0.5, max: 1, step: 0.02, pct: true, css: "--fz-a" }] },
  { title: "Podium effects",
    items: [
      { key: "podium", type: "toggle", def: true, main: true, cls: "no-podium" },
      { key: "podRes", type: "steps", label: "Resolution", def: 0.25, options: [[0.25, "25%"], [0.5, "50%"], [0.75, "75%"], [1, "100%"]] },
      { key: "podLight", type: "range", label: "Light", def: 1, min: 0, max: 2, step: 0.25, unit: "×" },
      { key: "podGas", type: "range", label: "Gas", def: 1, min: 0, max: 2, step: 0.25, unit: "×" },
    ] },
  { title: "Scoring cards",
    items: [{ key: "howLight", type: "toggle", def: false, main: true, cls: "no-howlight" }] },
  // The cards that change the footer's scene, last. The footers: Fantasy Land's lake, Alex's stream moving (when he's
  // pressed) and pushing the ducks about; upright, the house's lights coming up on show days and its chimney's smoke. Off,
  // still (the stream drawn still, the house lit at once)
  { title: "Footer",
    items: [{ key: "fzSea", type: "toggle", def: true, main: true, cls: "no-sea" }] },
  // The house's scene at a chosen time, or by the device's clock (main.js); the normal view only, where it is. A time: a
  // slider through the day (any quarter hour, kept as its hour, "13.25") over the times of day as buttons
  { title: "Time of day", view: "up",
    items: [{ key: "houseTime", type: "time", label: "Time of day", def: "clock", min: 0, max: 23.75, step: 0.25, options: [["5.5", "Dawn"], ["7", "Sunrise"],
      ["10", "Morning"], ["13", "Midday"], ["16.5", "Afternoon"], ["19.5", "Sunset"], ["20.5", "Dusk"], ["23", "Night"], ["clock", "Clock"]] }] },
];
// A card for one view only (view: "fz", Fantasy Land; "up", the normal view) shows only there
export const cardsShown = (fantasy) => CARDS.filter((c) => !c.view || (c.view === "fz") === fantasy);
const ITEMS = Object.fromEntries(CARDS.flatMap((c) => c.items.map((it) => [it.key, it])));
const id = (k) => `fm-sw-${k}`;
export const item = (k) => ITEMS[k];
// A time's hour: the one chosen, or the clock's now
export const hourOf = (v) => {
  if (v !== "clock") return +v;
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
};
const clock = (h) => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
export const shown = (it, v) => (it.type === "time" ? clock(hourOf(v)) : it.pct ? `${Math.round(v * 100)}%` : `${+v.toFixed(2)}${it.unit}`);

// Read once; settings that no longer exist are forgotten
const values = {};
try { for (const k of Object.keys(localStorage)) if (k.startsWith("fm-sw-") && !ITEMS[k.slice(6)]) localStorage.removeItem(k); } catch { /* private mode */ }
for (const [k, it] of Object.entries(ITEMS)) {
  let v = null;
  try { v = localStorage.getItem(id(k)); } catch { /* private mode */ }
  const read = it.type === "toggle" ? v === "1" : it.type === "choice" || it.type === "time" ? v : +v;
  // A value no longer offered (an old slider's in-between step) is the default; a time is any hour of the day
  const ok = it.type === "time" ? read === "clock" || (read !== "" && +read >= 0 && +read < 24) : !it.options || it.options.some(([o]) => o === read);
  values[k] = v == null || !ok ? it.def : read;
}
export const get = (k) => values[k];
const tell = (k, v) => dispatchEvent(new CustomEvent("fm-switch", { detail: { key: k, value: v } }));

// Auto-tune (tune.js) chooses these where they're left as designed: auto holds what it chose (and its levels, _fall and
// _pod), pinned the ones set on the cards, which it leaves alone. Both per device. val() is what an effect uses
export const TUNABLE = ["fallRes", "fallFps", "podRes"];
const json = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const auto = json("fm-auto", {}), pinned = new Set(json("fm-pinned", []));
const keep = () => { try { localStorage.setItem("fm-auto", JSON.stringify(auto)); localStorage.setItem("fm-pinned", JSON.stringify([...pinned])); } catch { /* private mode */ } };
export const tuned = (k) => TUNABLE.includes(k) && values.autoTune && !pinned.has(k) && ITEMS[k].options.some(([o]) => o === auto[k]);
export const val = (k) => (tuned(k) ? auto[k] : values[k]);
export const autoGet = (k) => auto[k];
export const autoUsed = () => Object.keys(auto).length > 0 || pinned.size > 0; // something for Reset to start again
export function setAuto(k, v) {
  if (auto[k] === v || pinned.has(k)) return;
  auto[k] = v;
  keep();
  if (TUNABLE.includes(k) && values.autoTune) tell(k, val(k));
}
export function pin(k) { if (TUNABLE.includes(k) && !pinned.has(k)) { pinned.add(k); keep(); } }
export function set(k, v) {
  const it = ITEMS[k];
  values[k] = v;
  try {
    if (v === it.def) localStorage.removeItem(id(k));
    else localStorage.setItem(id(k), it.type === "toggle" ? (v ? "1" : "0") : String(v));
  } catch { /* private mode: lasts the visit */ }
  apply(it);
  tell(k, v);
  if (k === "autoTune") for (const t of TUNABLE) tell(t, val(t)); // the effects take up, or drop, what it chose
}
export const changed = () => Object.keys(ITEMS).filter((k) => get(k) !== ITEMS[k].def).length;
// Back to the design, and auto-tune starts again
export function resetAll() {
  for (const k of Object.keys(ITEMS)) if (get(k) !== ITEMS[k].def) set(k, ITEMS[k].def);
  for (const k of Object.keys(auto)) delete auto[k];
  pinned.clear();
  keep();
  for (const t of TUNABLE) tell(t, val(t));
}
export const onSwitch = (keys, fn) => addEventListener("fm-switch", ({ detail: d }) => { if (keys.includes(d.key)) fn(d); });

// What CSS can do on its own: a class while a toggle is off, or a custom property
function apply(it) {
  const html = document.documentElement;
  if (it.cls) html.classList.toggle(it.cls, !get(it.key));
  if (it.css) html.style.setProperty(it.css, get(it.key));
}
for (const it of Object.values(ITEMS)) if (it.cls || it.css) apply(it);
