// Shared helpers and state.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** Escaped text that keeps the CSV's <strong> markup. */
export const rich = (s) => esc(s).replace(/&lt;(\/?)strong&gt;/g, "<$1strong>");
export const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export const listing = (a) => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`;
export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Task-type icons: one monoline set, 16px grid, 1.5 stroke. Never emoji.
export const ICON_PATHS = {
  P: "M2.5 7.5h11v6.5h-11z M1.75 5h12.5v2.5H1.75z M8 5v9 M8 5C6.8 2.2 4 2.6 4.8 4.4 M8 5c1.2-2.8 4-2.4 3.2-.6",
  F: "M2 7h12v7H2z M2 7l11.4-3.1-.6-2.1L1.4 4.9z M5.2 4.3l1.5 1.8 M8.6 3.4l1.5 1.8",
  T: "M5.5 7.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5z M1.75 13.75c0-2.3 1.7-4 3.75-4s3.75 1.7 3.75 4 M11 7.25a1.9 1.9 0 1 0 0-3.8 M12.25 9.9c1.2.4 2 1.9 2 3.85",
  L: "M9.25 1.5 3.5 9h4.25l-1 5.5L12.5 7H8.25z",
};
export const TASK_NAME = { P: "Prize", F: "Filmed", T: "Team", L: "Live" };
export const icon = (k) => ICON_PATHS[k] ? `<svg class="ico" viewBox="0 0 16 16" role="img" aria-label="${TASK_NAME[k]} task"><path d="${ICON_PATHS[k]}"/></svg>` : "";
export const tier = (rank) => rank <= 3 ? ` t${rank}` : "";
// Dates and deadlines are shown in the device's own time zone and locale.
export const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
export const fmtWhen = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
/** Time left as its two largest units: "5d 19h", "19h 25m", "25m 10s". */
export function until(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
  return d ? [[d, "d"], [h, "h"]] : h ? [[h, "h"], [m, "m"]] : [[m, "m"], [s % 60, "s"]];
}
export const untilText = (ms) => until(ms).map(([n, u]) => n + u).join(" ");

export const framed = (c) => `<img class="fp" src="${c.img}" alt="${esc(c.key)}" width="225" height="266" loading="lazy" decoding="async" style="--c:${c.color}">`;
export const named = (c) => `<b class="cn" style="color:${c.color}">${esc(c.key)}</b>`;

export const state = { key: null, d: null, page: "standings", how: false, wk: 0, ep: 1, cast: 0, stats: null, allTime: [], edit: false, xpView: "bars", stView: null };

// Per-episode mean and SD by task kind over the league's series (radar fallback)
export function perEpisodeStats(series) {
  const vals = { P: [], F: [], L: [] };
  for (const raw of Object.values(series)) {
    const scored = raw.tasks.reduce((m, t) => Math.max(m, t.ep), 0);
    if (!scored) continue;
    raw.cast.forEach((_, i) => {
      for (const k of Object.keys(vals)) vals[k].push(raw.tasks.filter((t) => t.t === k).reduce((a, t) => a + t.s[i], 0) / scored);
    });
  }
  return Object.fromEntries(Object.entries(vals).map(([k, v]) => {
    const mean = v.reduce((a, x) => a + x, 0) / (v.length || 1);
    const sd = Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / (v.length || 1));
    return [k, { mean, sd }];
  }));
}

// Footer: seven ducks (one <symbol>); tapping all seven opens edit mode

const DUCK = `<symbol id="duck" viewBox="0 0 20 16"><path d="M1.8 7.6Q3 9.4 6.5 9.4H11A3.6 3.6 0 1 1 15.6 6L19.2 5.7Q19.6 8.2 15.3 8.1A3.6 3.6 0 0 1 14.2 9.5Q16.6 10.2 16.6 12.2Q16.6 15 12 15H6Q2.6 15 2 11.9Q1.6 9.8 1.8 7.6Z M13.6 4.4A.75 .75 0 1 0 13.61 4.4Z" fill-rule="evenodd"/></symbol>`;

// The Taskmaster house behind them (normal view): the bungalow's front, a curved Dutch gable at each end (the arched door
// with its fanlight between round windows; the clock over tall windows) and the tiled roof and chimney between, the
// conifer behind, the caravan beside it and a pond for the ducks, in gold lines over solid shapes, so the sun and moon
// pass behind them; the buildings at 80%, standing on the same ground, so there's sky above them. The sky follows the device's clock (main.js: the sun and moon's places, the time of day); its
// lights (.lt, --i their order) come up on show days (styles.css), and the chimney smokes
const glass = (el, i) => el.replace("/>", ` style="--i:${i}"/>`);
const SOLID = "M64 94V50q0-6 6-8q6-2 6-10q0-16 24-18q24 2 24 18q0 8 6 10q6 2 6 8V94ZM136 94V62l14-20h37V27h11v15h38l14 20V94ZM250 94V54q0-6 5-8q5-2 5-9q0-14 14-16q14 2 14 16q0 7 5 9q5 2 5 8V94ZM206 42q-4-14 8-22q4-14 16-10q12-4 16 8q12 6 6 20ZM306 92V74q0-8 8-8h40q10 0 12 10l2 16ZM20 94q-4-18 8-26q6-12 20-6q12 8 8 32Z";
const STARS = [[30, 12], [58, 30], [150, 10], [176, 26], [300, 12], [334, 30], [362, 16], [128, 30], [16, 40], [372, 44]];
const HOUSE = `<div class="house" aria-hidden="true"><svg viewBox="0 0 390 136">
  <defs><radialGradient id="h-win" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#fff1b8"/><stop offset="1" stop-color="#ecc040"/></radialGradient>
    <radialGradient id="h-halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ecc040" stop-opacity=".22"/><stop offset="1" stop-color="#ecc040" stop-opacity="0"/></radialGradient>
    <linearGradient id="h-sky" x1="0" y1="1" x2="0" y2="0"><stop class="s0" offset="0"/><stop class="s1" offset="1"/></linearGradient>
    <clipPath id="h-above"><rect width="390" height="95"/></clipPath></defs>
  <rect class="sky" x="0" y="0" width="390" height="96" fill="url(#h-sky)"/>
  <g class="stars">${STARS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9"/>`).join("")}</g>
  <g clip-path="url(#h-above)">
    <g class="moon"><circle r="16" fill="url(#h-halo)"/><path d="M-2-8a9 9 0 1 0 6 16a7 7 0 1 1-6-16z"/></g>
    <g class="sun"><circle r="16" fill="url(#h-halo)"/><circle r="6"/><path d="M0-10v-3M0 10v3M-10 0h-3M10 0h3M7-7l2-2M-7 7l-2 2M7 7l2 2M-7-7l-2-2"/></g>
  </g>
  <g transform="matrix(.8 0 0 .8 39 18.8)">
  <path class="solid" d="${SOLID}"/>
  <g class="lt">
    ${glass(`<ellipse cx="180" cy="66" rx="130" ry="44" fill="url(#h-halo)"/>`, 7)}
    ${glass(`<path d="M93 94V57q0-9 7-9t7 9V94z" fill="url(#h-win)"/>`, 0)}
    ${glass(`<circle cx="79" cy="63" r="4.5" fill="url(#h-win)"/>`, 1)}
    ${glass(`<circle cx="121" cy="63" r="4.5" fill="url(#h-win)"/>`, 2)}
    ${glass(`<rect x="262" y="55" width="6" height="30" rx="1" fill="url(#h-win)"/>`, 3)}
    ${glass(`<rect x="280" y="55" width="6" height="30" rx="1" fill="url(#h-win)"/>`, 4)}
    ${glass(`<circle cx="274" cy="40" r="5.5" fill="url(#h-win)"/>`, 5)}
    ${glass(`<rect x="317" y="72" width="16" height="8" rx="2" fill="url(#h-win)"/>`, 6)}
  </g>
  <g class="ln">
    <path d="M206 42q-4-14 8-22q4-14 16-10q12-4 16 8q12 6 6 20" opacity=".55"/>
    <path d="M20 94q-4-18 8-26q6-12 20-6q12 8 8 32" opacity=".55"/>
    <path d="M64 94V50q0-6 6-8q6-2 6-10q0-16 24-18q24 2 24 18q0 8 6 10q6 2 6 8V94"/>
    <path d="M93 94V57q0-9 7-9t7 9V94M93 59h14M100 59v-10M100 59l-5-6M100 59l5-6"/>
    <circle cx="79" cy="63" r="4.5"/><circle cx="79" cy="63" r="7" opacity=".5"/>
    <circle cx="121" cy="63" r="4.5"/><circle cx="121" cy="63" r="7" opacity=".5"/>
    <path d="M88 94h24M90 91h20" opacity=".7"/>
    <path d="M136 62h114M150 42h86M136 62l14-20M250 62l-14-20"/>
    <path d="M187 42V27h11v15M185 27h15"/>
    <path d="M142 64V94M244 64V94M136 94H250M160 80l76 8" opacity=".6"/>
    <path d="M250 94V54q0-6 5-8q5-2 5-9q0-14 14-16q14 2 14 16q0 7 5 9q5 2 5 8V94"/>
    <circle cx="274" cy="40" r="5.5"/><path d="M274 40v-3.5M274 40l2.5 1.5"/>
    <rect x="262" y="55" width="6" height="30" rx="1"/><rect x="280" y="55" width="6" height="30" rx="1"/>
    <path d="M306 92V74q0-8 8-8h40q10 0 12 10l2 16zM368 90h8"/>
    <rect x="317" y="72" width="16" height="8" rx="2"/>
    <path d="M344 92V73h11v19"/>
    <circle cx="322" cy="94" r="4"/>
  </g></g>
  <g class="ln">
    <path d="M14 96H376" opacity=".35"/>
    <path d="M100 100Q195 92 290 100Q195 112 100 100Z" opacity=".8"/>
    <path d="M140 106q12 2 24 0M214 106q14 2 28 0" opacity=".45"/>
  </g></svg>
  <svg class="smoke" viewBox="0 0 20 24"><path d="M7 23c-4-5 3-8-1-13s3-7 0-10"/><path d="M13 23c-4-5 3-8-1-13"/></svg>
</div>`;

export function footer() {
  const ducks = Array.from({ length: 7 }, () => `<span class="dk"><svg class="duck"><use href="#duck"/></svg></span>`).join("");
  return `<svg width="0" height="0" aria-hidden="true" style="position:absolute">${DUCK}</svg>${HOUSE}
    <div class="ducks" aria-hidden="true">${ducks}</div>`;
}

/** A tidy axis step (1, 2, 2.5 or 5 × 10ⁿ) giving at most five gridlines (the race charts). */
export function niceStep(max) {
  const raw = max / 4, p = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw);
}

/** A monotone cubic Bézier path through points sorted by x (Fritsch–Carlson). */
export function smooth(pts) {
  const n = pts.length, f1 = (v) => v.toFixed(1);
  if (n < 2) return `M${pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join("L")}`;
  // Two points: a gentle S, level at both ends
  if (n === 2) {
    const [[x0, y0], [x1, y1]] = pts, h = (x1 - x0) / 2;
    return `M${f1(x0)},${f1(y0)}C${f1(x0 + h)},${f1(y0)} ${f1(x1 - h)},${f1(y1)} ${f1(x1)},${f1(y1)}`;
  }
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = dx[i] / 3;
    d += `C${f1(x0 + h)},${f1(y0 + t[i] * h)} ${f1(x1 - h)},${f1(y1 - t[i + 1] * h)} ${f1(x1)},${f1(y1)}`;
  }
  return d;
}
