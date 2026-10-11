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
