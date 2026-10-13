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

// As on the show (Tony Three Pies): a lemon-yellow rubber duck (its body takes the fill); a feathered wing on its side,
// shaded from the body's own colour; its bill orange, open to a red mouth; a cartoon eye, white with a big black pupil,
// a glint and lashes
const DUCK_BODY = "M1.8 7.6Q3 9.4 6.5 9.4H11A3.6 3.6 0 1 1 15.6 6L19.2 5.7Q19.6 8.2 15.3 8.1A3.6 3.6 0 0 1 14.2 9.5Q16.6 10.2 16.6 12.2Q16.6 15 12 15H6Q2.6 15 2 11.9Q1.6 9.8 1.8 7.6Z";
const DUCK = `<symbol id="duck" viewBox="0 0 20 16"><path d="${DUCK_BODY}"/>
  <path d="M4.6 10.8Q8 9.7 10.9 11.3Q10 13.7 6.6 13.6Q4.6 12.9 4.6 10.8Z" fill="#000" opacity=".1"/>
  <path d="M5.6 11.6Q7.6 11 9.6 11.7M5.8 12.5Q7.6 12.1 9.3 12.6" fill="none" stroke="#000" stroke-width=".3" stroke-linecap="round" opacity=".12"/>
  <path d="M15.6 6L19.2 5.7Q19.6 8.2 15.3 8.1Q15.9 7 15.6 6Z" fill="#f2561a"/>
  <path d="M15.7 7.05Q17.4 7.3 19.1 6.9Q18.4 7.75 16.7 7.7Q15.9 7.6 15.7 7.05Z" fill="#b8180c"/>
  <ellipse cx="13.5" cy="4.6" rx="1.05" ry="1.15" fill="#fff"/><circle cx="13.7" cy="4.7" r=".68" fill="#16110b"/><circle cx="13.92" cy="4.43" r=".22" fill="#fff"/>
  <path d="M12.85 3.55l-.3-.5M13.35 3.4l-.05-.6M13.85 3.45l.25-.52" fill="none" stroke="#16110b" stroke-width=".26" stroke-linecap="round"/></symbol>`;

// The Taskmaster house behind them (normal view), from a photo of its front, in its own colours with no outlines: the bungalow's Dutch gable facing the drive
// (the arched door with its fanlight and sidelights, a round porthole each side with a lifebuoy under it, steps), the
// chimney behind its shoulder and the lower tiled wing running right to a narrow curved end; the garage with its
// up-and-over door, the tall conifer behind, the clear geodesic dome on the drive, the caravan beyond it, and the
// ducks on the drive in front. Solid shapes, drawn back to front, so nearer things hide what's behind
// them and the sun and moon pass behind them; at 80%, standing well above the ducks (the drive between them), so there's
// sky above. The sky
// follows the device's clock (main.js: the sun and moon's places, the sky's colours and the scene's grade, from the sun's
// height, twilight included; the sky and the drive are boxes behind the drawing, the screen's width), and so does the
// light: the shapes shaded from the side it's on, eaves and everything on the drive casting shadows away from it; its lights (.lt, --i
// their order) are on at night and come up on show days (styles.css), the door's spilling onto the drive, and the chimney
// smokes. By night the door's light lies across the drive (.pool), each duck's shadow cast away from it (.lamp-sh, its mask)
const glass = (el, i) => el.replace("/>", ` style="--i:${i}"/>`);
// The ducks' shadows: each one's outline, as plain paths (not <use> copies, which the minute's custom
// properties on .house would restyle), and a soft contact shadow under each; the ducks stand 25 apart from x 120
const seven = (f) => Array.from({ length: 7 }, (_, i) => f(i)).join("");
// The scene in depth: one vanishing point at eye height above the drive (VP, the buildings' units), each structure's
// front at its depth (Z: in front of the gable's wall < 0 < behind it), so nearer things stand lower on the drive (dy,
// the same size: only their places follow the perspective). It's seen from a distance, so a structure's own depth
// recedes almost in parallel (back: up by RISE a unit, and drifting toward the middle by DRIFT a unit of its distance from
// it), which shows only a little of the faces that can be seen from here: the garage's flat roof and right side, the
// caravan's end, the hedge's top
const VP = { x: 195, y: 40 }, FAR = 120, RISE = 0.11, DRIFT = 0.0008;
const sc = (z) => FAR / (FAR + z);
const Z = { tree: 22, van: 18, wing: 10, end: 10, chimney: 6, garage: 2, gable: -4, hedge: -6, dome: -10 };
const DY = Object.fromEntries(Object.entries(Z).map(([k, z]) => [k, +((96 - VP.y) * (sc(z) - 1)).toFixed(2)]));
DY.dome = +(DY.dome - 3).toFixed(2); // its drawing already stands 3 nearer
// A point t further back than a structure's front (in its own frame), and the transform that takes its front there
const back = (t) => ([x, y]) => [x + (VP.x - x) * DRIFT * t, y - RISE * t];
const poly = (ps) => `M${ps.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
const toward = (t) => `matrix(${(1 - DRIFT * t).toFixed(4)} 0 0 1 ${(VP.x * DRIFT * t).toFixed(2)} ${(-RISE * t).toFixed(2)})`;
const at = (k, inner) => `<g data-dy="${DY[k]}" transform="translate(0 ${DY[k]})">${inner}</g>`;
// The solid shapes (each structure's front face), back to front, cast as shadows on the drive (main.js)
const MASS = {
  tree: "M133 96L126 75L131 74L120 59L126 58L114 43L119 42L109 29L113 28L104 16L107 15L100 4L93 15L96 16L87 28L91 29L81 42L86 43L74 58L80 59L69 74L74 75L67 96",
  hedge: "M0 96V80q2-6 7-6q3-5 8-3q5-1 7 4q3 2 3 7V96",
  garage: "M22 96V64H80V96",
  chimney: "M185 58V24h11v34Z",
  wing: "M196 96V42h68v54Z",
  end: "M263.5 96V37h7V96",
  gable: "M102 96V60C102 52 112 50 116 44C120 38 122 34 122 30C122 22 134 16 150 16C166 16 178 22 178 30C178 34 180 38 184 44C188 50 198 52 198 60V96",
  van: "M330 94V79q0-7 7-7h33q8 0 10 8l2 14Z",
};
const BASE = { van: 98.5, dome: 99 }; // the caravan stands on its wheels; the dome's frame is drawn on its floor
const DOME = "M276 99a24 24 0 0 1 48 0a24 3 0 0 1-48 0Z";
// A solid shape in its material's colour (with any panels of its own); on the round ones (the conifer, the hedge) the
// light and shade across it (#h-shade); its ambient occlusion where it meets the ground (#h-ao); and a highlight along
// the edges facing the light, in its own colour made lighter (only the edges facing the light: #h-rim-mask), kept inside
// the shape by clipping to it so it never reads as an outline
const solid = (k, m, inner = "", round = false) =>
  `<path class="o ${m}" d="${MASS[k]}"/>${inner}${round ? `<path class="sd" d="${MASS[k]}"/>` : ""}<path class="ao" d="${MASS[k]}"/><path class="rim ${m}" d="${MASS[k]}" clip-path="url(#c-${k})"/>`;
// Depth by sweeping a rounded shape back toward VP (copies along the way, in its own colour, lit as the face that
// shows: the hedge's top, the caravan's end), for the caravan and the hedge; the garage, a box, has its faces drawn exactly
const sweep = (k, t, m, n, f = "top") => Array.from({ length: n }, (_, i) => `<path class="m ${m} ${f}" d="${MASS[k]}" transform="${toward((t * (n - i)) / n)}"/>`).join("");
const gb = back(40);
const GARAGE_3D = `<path class="m felt top" d="${poly([[20, 64], [82, 64], gb([82, 64]), gb([20, 64])])}"/><path class="m white rs" d="${poly([[80, 67], [80, 96], gb([80, 96]), gb([80, 67])])}"/><path class="m brown rs" d="${poly([[82, 64], [82, 67], gb([82, 67]), gb([82, 64])])}"/>`;
// Shadows: cast (main.js shears each from its own feet, and the deep ones from their backs too) and, blurred with them,
// the structures' own shapes, hidden behind them, so a shadow keeps its strength up to their feet
const castOf = (k, href, t = 0, n = 0) => [0, ...Array.from({ length: n }, (_, i) => (t * (i + 1)) / n)]
  .map((d) => `<use href="${href}" data-dy="${DY[k]}" data-b="${((BASE[k] ?? 96) - RISE * d).toFixed(2)}"${d ? ` data-back="${toward(d)}"` : ""}/>`).join("");
const behind = (k, href) => `<use href="${href}" transform="translate(0 ${DY[k]})"/>`;
const contact = (k, href) => { const b = BASE[k] ?? 96; return `<use href="${href}" transform="translate(0 ${DY[k]}) matrix(1 0 0 -.07 0 ${(b * 1.07).toFixed(2)})"/>`; };
const KEYS = ["tree", "hedge", "garage", "chimney", "wing", "end", "gable"];
// The dome's frame is seen a little from above, like its floor: its rings' near halves bow down, and its struts meet
// them and the floor's near edge (all in the dome's own frame, then moved onto the drive)
// Recesses: an inner shadow round their edges (#h-inset)
const inset = (el) => el.replace(/class="[^"]*"/, 'class="inset"');
const HOUSE = `<div class="house" aria-hidden="true"><div class="sky"></div><div class="ground"></div><svg viewBox="0 0 390 136">
  <defs><radialGradient id="h-win" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#fff1b8"/><stop offset="1" stop-color="#ecc040"/></radialGradient>
    <radialGradient id="h-halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ecc040" stop-opacity=".22"/><stop offset="1" stop-color="#ecc040" stop-opacity="0"/></radialGradient>
    <radialGradient id="h-moonhalo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#dfe6ff" stop-opacity=".16"/><stop offset="1" stop-color="#dfe6ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="h-glow" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#fff1b8" stop-opacity=".75"/><stop offset="1" stop-color="#ecc040" stop-opacity="0"/></radialGradient>
    <linearGradient id="h-moonlit" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a39478"/><stop offset=".5" stop-color="#e6d9bb"/><stop offset="1" stop-color="#fff7e2"/></linearGradient>
    <radialGradient id="h-earth" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#b7ab92" stop-opacity=".16"/><stop offset="1" stop-color="#b7ab92" stop-opacity=".07"/></radialGradient>
    <filter id="h-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".35"/></filter>
    <clipPath id="h-above"><rect y="-400" width="390" height="469"/></clipPath>
    <linearGradient id="h-shade" x1="0" y1="0" x2="1" y2="0"><stop class="l0" offset="0"/><stop class="l1" offset=".45"/><stop class="l2" offset="1"/></linearGradient>
    <linearGradient id="h-rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="h-rim-mask" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#h-rim)"/></mask>
    <linearGradient id="h-ao" gradientUnits="userSpaceOnUse" x1="0" y1="80" x2="0" y2="96"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient>
    <linearGradient id="h-aox" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <radialGradient id="h-inset" cx=".5" cy=".42" r=".62"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
    ${Object.keys(MASS).map((k) => `<clipPath id="c-${k}"><path d="${MASS[k]}"/></clipPath>`).join("")}
    <linearGradient id="h-eave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <radialGradient id="h-spill" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ecc040" stop-opacity=".3"/><stop offset="1" stop-color="#ecc040" stop-opacity="0"/></radialGradient>
    <radialGradient id="h-pool" gradientUnits="userSpaceOnUse" cx="150" cy="${96 + DY.gable}" r="1" gradientTransform="translate(150 ${96 + DY.gable}) scale(190 70) translate(-150 ${-(96 + DY.gable)})"><stop offset="0" stop-color="#ffd27a" stop-opacity=".34"/><stop offset=".5" stop-color="#ecb040" stop-opacity=".13"/><stop offset="1" stop-color="#ecb040" stop-opacity="0"/></radialGradient>
    <linearGradient id="h-pool-fade" gradientUnits="userSpaceOnUse" x1="0" y1="93" x2="0" y2="98"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>
    <mask id="h-pool-mask" maskUnits="userSpaceOnUse" x="-100" y="80" width="600" height="160"><rect x="-100" y="80" width="600" height="160" fill="url(#h-pool-fade)"/><g class="lamp-sh" transform="matrix(1.25 0 0 1.25 -48.75 -1.5)">${seven(() => `<path d="${DUCK_BODY}"/>`)}</g></mask>
    <filter id="h-blur" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="1.1"/></filter>
    <filter id="h-dblur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation=".7"/></filter>
    ${KEYS.map((k) => `<path id="m-${k}" d="${MASS[k]}"/>`).join("")}<g id="m-van"><path d="${MASS.van}"/><circle cx="343" cy="95" r="3.5"/></g><path id="m-dome" d="${DOME}"/></defs>
  <g clip-path="url(#h-above)">
    <g class="moon"><circle r="16" fill="url(#h-moonhalo)"/><circle class="disc" r="9"/><path class="lit" d=""/></g>
    <g class="sun"><circle class="disc" r="9"/></g>
  </g>
  <g class="b" transform="matrix(.8 0 0 .8 39 1.2)">
  <g class="cast">${KEYS.map((k) => castOf(k, `#m-${k}`, k === "garage" ? 40 : 0, k === "garage" ? 4 : 0)).join("")}${castOf("van", "#m-van", 8, 3)}${castOf("dome", "#m-dome").replace("<use ", '<use class="see" ')}${KEYS.map((k) => behind(k, `#m-${k}`)).join("")}${behind("van", "#m-van")}</g>
  <g class="contact">${KEYS.map((k) => contact(k, `#m-${k}`)).join("")}${contact("van", "#m-van")}${at("dome", `<ellipse cx="300" cy="99.8" rx="25.5" ry="3.4"/>`)}${KEYS.map((k) => behind(k, `#m-${k}`)).join("")}${behind("van", "#m-van")}</g>
  <rect class="pool" x="-100" y="80" width="600" height="160" fill="url(#h-pool)" mask="url(#h-pool-mask)"/>
  <g class="ln">
    ${at("tree", solid("tree", "tree", "", true))}
    ${at("van", `${sweep("van", 8, "cream", 8, "ls")}${solid("van", "cream", `<path class="m sage" d="M330 86H380.9L382 94H330Z"/><path class="m tan" d="M361 78h9v8h-9Z"/><path class="m teal" d="M361 86h9v8h-9Z"/>`)}<rect class="m glass" x="337" y="76" width="13" height="6" rx="1.5"/>`)}
    ${at("chimney", `${solid("chimney", "brick")}<path class="m brick" d="M183.5 24h14v-2.5h-14Z"/><path class="d" d="M187 21.5v-3h2.5v3M191.5 21.5v-4h2.5v4"/>`)}
    ${at("wing", `${solid("wing", "brick", `<path class="m roof slope" d="M196 42H264V64H196Z"/>`)}<rect class="sh" x="196" y="64" width="68" height="8"/><rect class="aox" x="198" y="42" width="7" height="54"/><path class="d" d="M196 42H264M198 64H266"/><path class="d" d="M200 48H264M199 53H264.5M198.5 58.5H265.5M204 64V96"/>`)}
    ${at("end", solid("end", "brick"))}
    ${at("garage", `${GARAGE_3D}${solid("garage", "white")}<path class="m red" d="M28 72H74V96H28Z"/><rect class="sh" x="22" y="67" width="58" height="6"/><path class="m brown" d="M20 64H82V67H20Z"/><path class="d" d="M28 96V72H74V96M28 77H74M28 82H74M28 87H74M28 92H74"/>`)}
    ${at("gable", `${solid("gable", "brick")}
    <path class="m white" d="M137 92V70a13 13 0 0 1 26 0V92Z"/>${[`<path class="m glass" d="M139 70a11 11 0 0 1 22 0Z"/>`, `<path class="m glass" d="M138.5 71h3v20.5h-3Z"/>`, `<path class="m glass" d="M158.5 71h3v20.5h-3Z"/>`, `<path class="m wood" d="M143 92V71h14v21Z"/>`].map((el) => el + inset(el)).join("")}
    ${[124, 176].map((x) => `<circle class="m ring" cx="${x}" cy="72" r="8"/><circle class="m glass" cx="${x}" cy="72" r="5.5"/><circle class="inset" cx="${x}" cy="72" r="5.5"/>`).join("")}
    <path class="m brick" d="M134 92h32v2.5h-32ZM131 94.5h38v1.5h-38Z"/>`)}
    ${at("hedge", `${sweep("hedge", 3, "hedge", 6)}${solid("hedge", "hedge", "", true)}`)}
  </g>
  <g class="lt">
    ${at("gable", `${glass(`<ellipse cx="150" cy="101" rx="42" ry="8" fill="url(#h-spill)"/>`, 0)}
    ${glass(`<ellipse cx="160" cy="66" rx="130" ry="44" fill="url(#h-halo)"/>`, 5)}
    ${glass(`<path d="M137 70a13 13 0 0 1 26 0ZM137 70h5v22h-5ZM158 70h5v22h-5Z" fill="url(#h-win)"/>`, 0)}
    ${glass(`<circle cx="124" cy="72" r="5.5" fill="url(#h-win)"/>`, 1)}
    ${glass(`<circle cx="176" cy="72" r="5.5" fill="url(#h-win)"/>`, 2)}`)}
    ${at("dome", glass(`<path d="M276 99a24 24 0 0 1 48 0Z" fill="url(#h-glow)"/>`, 3))}
    ${at("van", glass(`<rect x="337" y="76" width="13" height="6" rx="1.5" fill="url(#h-win)"/>`, 4))}
  </g>
  <g class="ln">
    ${at("gable", `<path class="d" d="M105.5 62C105.5 55 114.5 53 119 46.5C123.5 39.5 125.5 35 125.5 30.5C125.5 24 136.5 19.5 150 19.5C163.5 19.5 174.5 24 174.5 30.5C174.5 35 176.5 39.5 181 46.5C185.5 53 194.5 55 194.5 62"/>
    <ellipse class="d red" cx="150" cy="28" rx="2.5" ry="2"/><rect class="d red" x="107" y="58" width="5" height="6" rx="1"/>
    <path class="frame" d="M137 70h26"/>
    <path class="d frame" d="M145.5 70a4.5 4.5 0 0 1 9 0M146.1 67.75L138.74 63.5M147.75 66.1L143.5 58.74M150 65.5V57M152.25 66.1L156.5 58.74M153.9 67.75L161.26 63.5"/>
    <path class="d" d="M148 56.6h4l-.6 3h-2.8ZM145 73h4v8h-4ZM151 73h4v8h-4ZM145 83h4v7h-4ZM151 83h4v7h-4ZM134 92h32M131 94.5h38"/>
    <circle class="d" cx="124" cy="72" r="8"/><circle class="d" cx="176" cy="72" r="8"/>
    <circle class="buoy" cx="124" cy="86" r="4.5"/><circle class="buoy" cx="176" cy="86" r="4.5"/><circle class="m brick" cx="124" cy="86" r="2.2"/><circle class="m brick" cx="176" cy="86" r="2.2"/>
    <path class="d frame" d="M125.56 84.44l1.62-1.62M122.44 84.44l-1.62-1.62M125.56 87.56l1.62 1.62M122.44 87.56l-1.62 1.62M177.56 84.44l1.62-1.62M174.44 84.44l-1.62-1.62M177.56 87.56l1.62 1.62M174.44 87.56l-1.62 1.62"/>`)}
    ${at("dome", `<ellipse class="m floor top" cx="300" cy="99" rx="23.6" ry="2.8"/><path class="m pane" d="${DOME}"/><ellipse class="d" cx="300" cy="99" rx="24" ry="3"/><path class="strut" d="M276 99a24 24 0 0 1 48 0"/>
    <path class="d strut" transform="translate(0 3)" d="M279.2 84Q300 89.2 320.8 84M288.4 75Q300 77.9 311.6 75M276 96L286 85.9L294 98.9L300 86.6L306 98.9L314 85.9L324 96M286 85.9L293 76.2L300 86.6L307 76.2L314 85.9M293 76.2L300 72L307 76.2"/>`)}
    ${at("van", `<rect class="d frame" style="--m: #6a4a38" x="337" y="76" width="13" height="6" rx="1.5"/><path class="d" d="M361 94V78h9v16"/><circle class="m flower" cx="365.5" cy="81.5" r="1.6"/>
    <path class="m red" d="M352.6 89h1.2v8h-1.2ZM349.5 85.5h7.4v3.5h-7.4Z"/><circle class="o tyre" cx="343" cy="95" r="3.5"/>
    <path class="d" d="M330 86H382M368 87h1.5M382 92l7 2M348 72v-2h6v2M344 95a1 1 0 1 1-2 0a1 1 0 1 1 2 0"/>`)}
  </g></g>
  <g class="dcast">${seven(() => `<path d="${DUCK_BODY}"/>`)}</g>
  <g class="feet">${seven((i) => `<ellipse cx="${120 + 25 * i}" cy="98.3" rx="7.5" ry="1.3"/>`)}</g></svg>
  <svg class="smoke" viewBox="0 0 20 24"><path d="M7 23c-4-5 3-8-1-13s3-7 0-10"/><path d="M13 23c-4-5 3-8-1-13"/></svg>
</div>`;

export function footer() {
  const ducks = Array.from({ length: 7 }, () => `<span class="dk"><svg class="duck"><use href="#duck"/></svg></span>`).join("");
  // The ducks' shading in the house's light (main.js turns it): pale lemon on the side facing it, deepening to a dark
  // mustard away from it
  return `<svg width="0" height="0" aria-hidden="true" style="position:absolute">${DUCK}<defs><filter id="dq-light" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/></filter><linearGradient id="dk-shade" x1=".3" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#fff69a"/><stop offset=".45" stop-color="#f6e24d"/><stop offset="1" stop-color="#b39304"/></linearGradient></defs></svg>${HOUSE}
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

// Fantasy Land's dinghy: the inflatable from the still of Alex Horne on a pond with a stone gorilla, Alex in it as a
// mermaid (pink towel, funnels, sleeping bag), drawn as the house is: solid shapes in their own colours with no
// outlines, a few dark detail lines, each round form shaded across from the light (upper left here) and lit along the
// edges that face it, darkening where it meets what's under it. In px, 140 × 92, the water at y 78. His funnels point
// out and spray from their spouts (styles.css, .fz-boat): the left over the gorilla into the sea, the right away
const BOAT = {
  far: "M12 56.5Q11 54 15 53.6L125 55Q130 55.2 130 58Z",
  inside: "M10 58.6L130 60.6V63L9 61Z",
  gorilla: "M13 64C12.4 52 13.6 42 17.6 35.6C19.8 31 24 29 28.4 29.8H43.6C48 29 52.2 31 54.4 35.6C58.4 42 59.6 52 59 64Z",
  head: "M28.2 36C26.8 30 27.6 21.4 32.4 17.2Q36 15 39.6 17.2C44.4 21.4 45.2 30 43.8 36Z",
  brow: "M29 24.6Q36 20.4 43 24.6L42.4 26.6Q36 23.4 29.6 26.6Z",
  muzzle: "M30.2 30.6C30.2 27.4 32.8 26.2 36 26.2S41.8 27.4 41.8 30.6C41.8 33.8 39.2 35.2 36 35.2S30.2 33.8 30.2 30.6Z",
  lap: "M87 56C88 52.6 112 52.6 114 56L115 63H86Z",
  hood: "M92.2 39C91 31 91.6 23 95.8 19.6C98.2 15.2 102.2 10.8 107 7.4C106 11.6 106.4 15.4 107.8 19.8C110.2 23 110.8 29.4 110.4 34.8C113 38.8 115.6 44.2 116.2 52.6C113 50.6 109.8 47.6 107.2 44.6L105 38.6Z",
  torso: "M89.6 59C88.8 50.6 89.6 43 92.8 39.6C95.8 37.6 104.2 37.6 107.2 39.6C110.4 43 111.2 50.6 110.4 59Z",
  armL: "M90.6 41.2C87.4 44 86.4 52 87 60.6H90.6C90.2 52.6 90.6 46.6 92.4 42.4Z",
  armR: "M109.4 41.2C112.6 44 113.6 52 113 60.6H109.4C109.8 52.6 109.4 46.6 107.6 42.4Z",
  neck: "M97.2 33h5.6v5.4h-5.6Z",
  brim: "M94.6 31C94 24.6 96 20.2 100 19.8C104 20.2 106 24.6 105.4 31C104.6 27.2 102.8 25 100 24.8C97.2 25 95.4 27.2 94.6 31Z",
  face: "M95.4 28.6C95.4 24.6 97.4 22.6 100 22.6S104.6 24.6 104.6 28.6C104.6 33.4 102.6 36 100 36S95.4 33.4 95.4 28.6Z",
  beard: "M95.6 29.4C95.8 34 97.6 36.4 100 36.5C102.4 36.4 104.2 34 104.4 29.4C103.2 31.2 101.6 31.6 100 31.6S96.8 31.2 95.6 29.4Z",
  funL: "M96.6 40.6C97.8 43 97.8 49.4 96.6 51.6L86.6 47.2L85.2 46.8L85.8 44.2Z",
  mouthL: "M96.6 40.6C95.4 42.6 95.4 49.6 96.6 51.6C97.8 49.6 97.8 42.6 96.6 40.6Z",
  funR: "M103.4 40.6C102.2 43 102.2 49.4 103.4 51.6L113.4 47.2L114.8 46.8L114.2 44.2Z",
  mouthR: "M103.4 40.6C102.2 42.6 102.2 49.6 103.4 51.6C104.6 49.6 104.6 42.6 103.4 40.6Z",
  spoutL: "M86.6 44.8L82.1 40.2L83.3 39.6 87.9 44Z",
  spoutR: "M113.4 44.8L117.9 40.2L116.7 39.6 112.1 44Z",
  strap: "M99 38.4h2v14h-2ZM90.8 51.4C96 53 104 53 109.2 51.4L109.4 53.8C104 55.6 96 55.6 90.6 53.8Z",
  tail: "M88.6 57.6C82.6 58 77.6 61.4 76.4 67L75.6 84H87.6L88 70C88.4 65.4 91.6 62.6 96 61.6Z",
  hull: "M8 59C2.2 59 .4 63.8 1.8 68.2C3.6 73.4 9 77 18 78.8L127 80.6C134 80.6 138.4 75.6 138.4 69.8C138.4 64.2 134.2 61 128.2 61Z",
};
// Their own colours: the dinghy's grey-white rubber, the gorilla's stone, Alex's skin, beard, pink towel, orange funnels,
// green harness and blue sleeping bag
const BT_C = { far: "#d6d9e2", inside: "#9ca2b2", gorilla: "#726d66", head: "#726d66", brow: "#5c5852", muzzle: "#8f897f", brim: "#f39cc2", mouthL: "#b8441a", mouthR: "#b8441a", lap: "#2f62d6", hood: "#f4a2c6",
  torso: "#e9b294", armL: "#e4ab8c", armR: "#e4ab8c", neck: "#dca184", face: "#ecb698", beard: "#8c7564", funL: "#f2662e", funR: "#f2662e",
  spoutL: "#e65a24", spoutR: "#e65a24", strap: "#2e7a62", tail: "#2f62d6", hull: "#eef0f5" };
const ROUND = new Set(["gorilla", "head", "muzzle", "lap", "hood", "torso", "armL", "armR", "face", "funL", "funR", "tail", "hull"]);
const lighter = (h) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.6 + 255 * 0.4).toString(16).padStart(2, "0")).join("");
const btSolid = (k) => `<path d="${BOAT[k]}" fill="${BT_C[k]}"/>${ROUND.has(k) ? `<path d="${BOAT[k]}" fill="url(#bt-shade)"/>` : ""}<path d="${BOAT[k]}" fill="none" stroke="${lighter(BT_C[k])}" stroke-width="2" mask="url(#bt-rim-mask)" clip-path="url(#bt-c-${k})"/>`;
const drops = (x) => `<g transform="translate(${x} 40.6)${x > 100 ? " scale(-1 1)" : ""}">${Array.from({ length: 6 }, () => '<g class="bt-dx"><circle class="bt-dy" r="1"/></g>').join("")}</g>`;
const JET = "M0 0Q-49.25-83.7-98.5 37.4";
export const DINGHY = `<svg class="bt" viewBox="0 0 140 92" width="140" height="92" aria-hidden="true">
  <defs>
    <linearGradient id="bt-shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
    <linearGradient id="bt-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="bt-rim-mask" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#bt-rim)"/></mask>
    <linearGradient id="bt-ao" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>
    <linearGradient id="bt-jet" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="-98.5" y2="0"><stop offset="0" stop-color="#effcff"/><stop offset="1" stop-color="#8fe3ff" stop-opacity=".25"/></linearGradient>
    ${Object.keys(BOAT).map((k) => `<clipPath id="bt-c-${k}"><path d="${BOAT[k]}"/></clipPath>`).join("")}
  </defs>
  ${[82.5, 117.5].map((x) => `<g class="bt-jet" transform="translate(${x} 40.6)${x > 100 ? " scale(-1 1)" : ""}"><path d="${JET}" stroke-width="3.2" opacity=".25"/><path d="${JET}" stroke-width="1.1"/></g>`).join("")}
  ${btSolid("far")}<path d="${BOAT.inside}" fill="${BT_C.inside}"/>
  ${btSolid("gorilla")}<path d="${BOAT.gorilla}" fill="url(#bt-ao)"/>
  <path class="bt-d" d="M22.6 40.4C19.4 48 19 56 21 63.6M49.4 40.4C52.6 48 53 56 51 63.6M28.6 41Q32.4 44.6 36 42.4Q39.6 44.6 43.4 41M36 42.6V48.4M30.4 49.6Q36 52.4 41.6 49.6"/>
  ${btSolid("head")}<path d="${BOAT.head}" fill="url(#bt-ao)"/>${btSolid("brow")}${btSolid("muzzle")}
  <path class="bt-d" d="M33 33.4Q36 34.6 39 33.4M36 15.4V18.4"/>
  <circle cx="33.3" cy="27.2" r=".8" fill="#24201d"/><circle cx="38.7" cy="27.2" r=".8" fill="#24201d"/>
  <ellipse cx="34.7" cy="30.2" rx=".8" ry=".55" fill="#3a3530"/><ellipse cx="37.3" cy="30.2" rx=".8" ry=".55" fill="#3a3530"/>
  ${btSolid("lap")}${btSolid("hood")}${btSolid("armL")}${btSolid("armR")}${btSolid("torso")}<path d="${BOAT.torso}" fill="url(#bt-ao)"/>${btSolid("neck")}${btSolid("face")}${btSolid("beard")}${btSolid("brim")}
  <path class="bt-d" d="M96.9 27L99.1 27.2M100.9 27.2L103.1 27M100 28.6L99.6 30.6L100.6 30.8M98.9 32.6Q100 33 101.1 32.6"/>
  <circle cx="98.1" cy="28.2" r=".55" fill="#2a1d18"/><circle cx="101.9" cy="28.2" r=".55" fill="#2a1d18"/>
  ${btSolid("strap")}${btSolid("funL")}${btSolid("funR")}${btSolid("mouthL")}${btSolid("mouthR")}${btSolid("spoutL")}${btSolid("spoutR")}
  <path d="M95.2 42.6L87.2 45.2M104.8 42.6L112.8 45.2" stroke="#ffb48a" stroke-width=".7" stroke-linecap="round" opacity=".8"/>
  ${btSolid("hull")}<path d="${BOAT.hull}" fill="url(#bt-ao)"/>
  <path class="bt-d" d="M3.6 70.4C40 73 100 74.4 137.4 73.4M5.6 73.2C40 75.6 100 77 136.2 76"/>
  <path d="M6 57.4L62 59.4" stroke="#c4c9d3" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="8.4" cy="57.5" rx="5" ry="1.5" fill="#b8bdc8"/>
  <path d="M22 63.4Q34 67 46 63.8Q58 67.4 70 64.2Q82 67.8 94 64.6Q106 68 118 65" fill="none" stroke="#fff" stroke-width=".8"/>
  ${[22, 46, 70, 94, 118].map((x, i) => `<rect x="${x - 1.5}" y="${62.4 + i * 0.4}" width="3" height="2.2" rx=".6" fill="#8a909c"/>`).join("")}
  ${btSolid("tail")}<path class="bt-d" d="M80 64.6Q84 66.4 88.6 64.2M77.4 70.2Q81.6 71.6 87.8 70M76.8 76Q81.4 77.2 87.6 76"/>
  ${drops(82.5)}${drops(117.5)}
</svg>`;
