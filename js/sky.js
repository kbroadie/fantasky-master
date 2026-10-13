// The moon as seen from London at a given moment, for the house's sky (main.js): how much of it is lit, and which way its
// lit edge points on the screen. Low-precision positions of the sun and moon (good to a degree or so), enough to draw it.
const RAD = Math.PI / 180, LAT = 51.5 * RAD, LON = -0.13;
const sin = (d) => Math.sin(d * RAD), cos = (d) => Math.cos(d * RAD);

// Right ascension and declination (radians) from ecliptic longitude and latitude (degrees)
function equatorial(lam, beta, eps) {
  return {
    ra: Math.atan2(sin(lam) * cos(eps) - Math.tan(beta * RAD) * sin(eps), cos(lam)),
    dec: Math.asin(sin(beta) * cos(eps) + cos(beta) * sin(eps) * sin(lam)),
  };
}

export function moonAt(date) {
  const d = date.getTime() / 864e5 + 2440587.5 - 2451545; // days from J2000
  const eps = 23.439 - 3.6e-7 * d;
  // The sun
  const g = 357.529 + 0.98560028 * d, q = 280.459 + 0.98564736 * d;
  const sunLon = q + 1.915 * sin(g) + 0.02 * sin(2 * g);
  const sun = equatorial(sunLon, 0, eps);
  // The moon: its mean longitude, anomaly and argument of latitude, with the largest terms
  const L = 218.316 + 13.176396 * d, M = 134.963 + 13.064993 * d, F = 93.272 + 13.22935 * d;
  const D = L - sunLon, Ms = g;
  const moonLon = L + 6.289 * sin(M) + 1.274 * sin(2 * D - M) + 0.658 * sin(2 * D) + 0.214 * sin(2 * M) - 0.186 * sin(Ms);
  const moon = equatorial(moonLon, 5.128 * sin(F), eps);
  // How much is lit: from the sun-moon elongation; waxing while the moon is east of the sun
  const elong = Math.acos(Math.sin(sun.dec) * Math.sin(moon.dec) + Math.cos(sun.dec) * Math.cos(moon.dec) * Math.cos(sun.ra - moon.ra));
  const lit = (1 - Math.cos(elong)) / 2;
  const waxing = (((moonLon - sunLon) % 360) + 360) % 360 < 180;
  // Which way the lit edge points: its position angle (from north, through east), less the parallactic angle at London,
  // gives it from straight up; facing south, east is on the left
  const chi = Math.atan2(Math.cos(sun.dec) * Math.sin(sun.ra - moon.ra), Math.sin(sun.dec) * Math.cos(moon.dec) - Math.cos(sun.dec) * Math.sin(moon.dec) * Math.cos(sun.ra - moon.ra));
  const lst = (280.46061837 + 360.98564736629 * d + LON) * RAD;
  const H = lst - moon.ra;
  const par = Math.atan2(Math.sin(H), Math.tan(LAT) * Math.cos(moon.dec) - Math.sin(moon.dec) * Math.cos(H));
  const z = chi - par;
  // On the screen (y down), the lit edge's direction, in degrees clockwise from pointing right
  const edge = Math.atan2(-Math.cos(z), -Math.sin(z)) / RAD;
  return { lit, waxing, edge };
}

// The lit part as a path, its lit edge pointing right (x+), for a disc of radius r: the right half-disc, closed by the
// terminator, a half-ellipse bowing right for a crescent and left for a gibbous moon
export function moonPath(lit, r) {
  const rx = (Math.abs(1 - 2 * lit) * r).toFixed(2), sweep = lit < 0.5 ? 0 : 1;
  return `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${rx} ${r} 0 0 ${sweep} 0 ${-r}Z`;
}

// The sky and the scene's grade for the sun's height (degrees; below the horizon through twilight and night), from
// photographs of real skies: the sky in bands from overhead down to the horizon (deep blue overhead by day, paling through
// cyan to a hazy white-blue; at sunset blue over lavender over a rose horizon; in twilight the layers of blue hour), the
// glow on the horizon under the sun, the Belt of Venus (a pink band over Earth's blue-grey shadow, opposite the sun just
// after it sets and before it rises), and how much of the sky's light reaches the structures. Between the rows, it's
// interpolated
const GRADE = [
  // height, overhead, high, low, horizon, glow, glow's strength, ambient %, belt, belt's strength
  [-18, "#020308", "#03050d", "#050814", "#070a16", "#070a16", 0, 6, "#070a16", 0],
  [-12, "#04071a", "#070e2a", "#0c1534", "#111a38", "#232650", 0.35, 8, "#1c1c40", 0],
  [-6, "#0a1534", "#15254f", "#2a2d62", "#2c3362", "#8a4660", 0.7, 10, "#4a3c6c", 0.3],
  [-2, "#142553", "#283c7c", "#6a5894", "#5b4a7c", "#e2643c", 0.9, 12, "#b07894", 0.6],
  [0, "#21407a", "#48609e", "#b4849e", "#a46e88", "#ff8442", 1, 14, "#d898a8", 0.6],
  [4, "#2f579a", "#5578b2", "#c6a6b6", "#dc9e86", "#ffae6a", 0.85, 16, "#e6b4b0", 0.3],
  [10, "#3a6ab2", "#5888c8", "#92b0d8", "#b6c8e0", "#ffdcaa", 0.55, 20, "#e6b4b0", 0],
  [25, "#3a6ec4", "#5690d6", "#86b2e4", "#a6c6ec", "#f4f6ff", 0.4, 22, "#e6b4b0", 0],
  [45, "#2c62c4", "#4a88d8", "#80b0e8", "#a6c6ec", "#f4f6ff", 0.35, 22, "#e6b4b0", 0],
];
// The sun's own colour by its height: red at the horizon, white high up
const SUN = [[-1, "#ff5a2a"], [2, "#ff7a3a"], [6, "#ffb070"], [15, "#fff1d0"], [30, "#fffaf0"]];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
function lerp(table, e) {
  const i = table.findIndex((r) => r[0] >= e), j = i < 0 ? table.length - 1 : i;
  const [a, b] = j === 0 || i < 0 ? [table[j], table[j]] : [table[j - 1], table[j]];
  const f = b[0] === a[0] ? 0 : (e - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, j) => {
    const w = b[j + 1];
    return typeof v === "number" ? v + (w - v) * f : hex(rgb(v).map((x, k) => x + (rgb(w)[k] - x) * f));
  });
}
export function skyFor(e) {
  const h = Math.max(-18, Math.min(45, e)); // past the tables' ends, their ends
  const [top, high, low, horizon, glow, glowA, ambK, belt, beltA] = lerp(GRADE, h);
  return { top, high, low, horizon, glow, glowA, ambK, belt, beltA, sun: lerp(SUN, h)[0] };
}
