// The stars over London (on request: "Stars may be in the normal footer now"), the same in both footers: the real sky as
// the episode on show aired, at the time of day shown, facing south as the house's sky does (the sun rising at the left),
// seen as a camera would (a rectilinear lens, level, at the sky's angles, degPx in halo.js). The bright stars from a
// catalogue (their places for J2000, their magnitudes and colours), each dimmed and reddened toward the horizon by the air
// it shines through, and shown down to the faintest the sky lets through: none by day, the brightest first in twilight,
// and in London's light only to about magnitude 4 (less under a bright moon). Fantasy Land has no city: its sky is dark
// to magnitude 6.5, with the faint stars (a seeded field, crowding toward the Milky Way as real ones do) and the Milky
// Way itself, brightest toward Sagittarius, its Great Rift through Cygnus and Aquila, and the faint green airglow low
// down. Drawn by main.js each minute on a canvas in the house's sky (.stars-c). No DOM.

// Right ascension (hhmm.m), declination (°), magnitude, colour (B-V)
const CAT = `0008.4 29.09 2.06 -.11|0109.7 35.62 2.05 1.58|0203.9 42.33 2.1 1.37|0039.3 30.86 3.27 1.28|0009.2 59.15 2.27 .34|0040.5 56.54 2.24 1.17
0056.7 60.72 2.47 -.15|0125.8 60.24 2.68 .13|0154.4 63.67 3.37 -.15|2304.8 15.21 2.49 -.04|2303.8 28.08 2.42 1.67|0013.2 15.18 2.83 -.23|2144.2 9.88 2.39 1.53
2241.5 10.83 3.4 -.09|2243.0 30.22 2.94 .86|0207.2 23.46 2 1.15|0154.6 20.81 2.64 .13|0324.3 49.86 1.79 .48|0308.2 40.96 2.12 -.05|0354.1 31.88 2.85 .12
0357.9 40.01 2.89 -.18|0342.9 47.79 3.01 -.13|0304.8 53.51 2.93 .7|0435.9 16.51 .85 1.54|0526.3 28.61 1.65 -.13|0347.5 24.11 2.87 -.09|0537.6 21.14 3 -.19
0428.7 15.87 3.4 .18|0428.6 19.18 3.53 1.01|0419.8 15.63 3.65 .99|0349.2 24.05 3.62 -.08|0344.9 24.11 3.7 -.11|0345.8 24.37 3.87 -.07|0346.3 23.95 4.18 -.06
0345.2 24.47 4.3 -.11|0555.2 7.41 .5 1.85|0514.5 -8.2 .13 -.03|0525.1 6.35 1.64 -.22|0532.0 -.3 2.23 -.22|0536.2 -1.2 1.69 -.18|0540.8 -1.94 1.77 -.21
0547.8 -9.67 2.09 -.17|0535.1 9.93 3.39 -.16|0535.4 -5.91 2.77 -.21|0449.8 6.96 3.19 .45|0516.7 46 .08 .8|0559.5 44.95 1.9 .08|0559.7 37.21 2.62 -.08
0457.0 33.17 2.69 1.53|0502.0 43.82 3 .54|0506.5 41.23 3.17 -.18|0745.3 28.03 1.14 1|0734.6 31.89 1.58 .03|0637.7 16.4 1.92 0|0622.9 22.51 2.87 1.62
0643.9 25.13 2.98 1.38|0614.9 22.51 3.28 1.6|0720.1 21.98 3.53 .34|0744.4 24.4 3.57 .93|0645.3 12.9 3.36 .43|0739.3 5.22 .34 .42|0727.2 8.29 2.89 -.1
0645.1 -16.72 -1.46 0|0658.6 -28.97 1.5 -.21|0708.4 -26.39 1.83 .68|0622.7 -17.96 1.98 -.24|0724.1 -29.3 2.45 -.08|0620.3 -30.06 3.02 -.19|0703.0 -23.83 3.02 -.08
0532.7 -17.82 2.58 .21|0528.2 -20.76 2.84 .82|0505.5 -22.37 3.19 1.46|0512.9 -16.21 3.29 -.11|0507.9 -5.09 2.79 .13|0358.0 -13.51 2.95 1.59|0343.2 -9.76 3.54 .92
0043.6 -17.99 2.04 1.02|0302.3 4.09 2.54 1.64|0019.4 -8.82 3.56 1.22|0108.6 -10.18 3.45 1.16|0144.1 -15.94 3.5 .72|0124.0 -8.18 3.6 1.06|0243.3 3.24 3.47 .09
0151.5 -10.33 3.73 1.14|0131.5 15.35 3.62 .97|2131.6 -5.57 2.87 .83|2205.8 -.32 2.94 .98|2254.7 -15.82 3.27 .05|2228.8 -.02 3.65 .38|2252.6 -7.58 3.74 1.64
2047.7 -9.5 3.77 0|2257.6 -29.62 1.16 .09|2147.0 -16.13 2.85 .29|2021.0 -14.78 3.05 .79|2018.1 -12.54 3.57 .94|2140.1 -16.66 3.68 .32|2126.7 -22.41 3.74 1
1950.8 8.87 .77 .22|1946.3 10.61 2.72 1.52|1905.4 13.86 2.99 .01|2011.3 -.82 3.23 -.07|1925.5 3.11 3.36 .32|1906.2 -4.88 3.43 -.09|1955.3 6.41 3.71 .86
1824.2 -34.38 1.85 -.03|1855.3 -26.3 2.05 -.13|1902.6 -29.88 2.6 .08|1821.0 -29.83 2.7 1.38|1828.0 -25.42 2.81 1.04|1909.8 -21.02 2.89 .35|1805.8 -30.42 2.99 1
1845.7 -26.99 3.17 -.11|1906.9 -27.67 3.32 1.19|1629.4 -26.43 1.06 1.83|1733.6 -37.1 1.62 -.22|1737.3 -43 1.86 .4|1742.5 -39.03 2.39 -.17|1600.3 -22.62 2.29 -.12
1605.4 -19.81 2.56 -.07|1635.9 -28.22 2.82 -.25|1621.2 -25.59 2.89 .13|1558.9 -26.11 2.89 -.19|1650.2 -34.29 2.29 1.15|1651.9 -38.05 3 -.2|1730.8 -37.3 2.7 -.22
1734.9 12.56 2.07 .15|1710.4 -15.72 2.43 .06|1637.2 -10.57 2.56 .02|1614.3 -3.69 2.75 1.58|1743.5 4.57 2.76 1.16|1657.7 9.38 3.2 1.15|1618.3 -4.69 3.24 .97
1759.0 -9.77 3.3 .99|1722.0 -25 3.27 -.19|1544.3 6.43 2.63 1.17|1821.3 -2.9 3.23 .94|1549.6 -3.43 3.53 -.04|1546.2 15.42 3.65 .06|1550.8 4.48 3.71 .15
1630.2 21.49 2.78 .95|1641.3 31.6 2.81 .65|1714.6 14.39 3.1 1.44|1715.0 36.81 3.16 1.44|1746.5 27.72 3.42 .75|1642.9 38.92 3.53 .92|1715.0 24.84 3.14 .08
1534.7 26.71 2.23 -.02|1527.8 29.11 3.68 .28|1415.7 19.18 -.05 1.23|1445.0 27.07 2.37 .97|1354.7 18.4 2.68 .58|1432.1 38.31 3.03 .19|1515.5 33.31 3.47 .95
1501.9 40.39 3.5 .97|1431.8 30.37 3.58 1.3|1325.2 -11.16 .97 -.23|1241.7 -1.45 2.74 .36|1302.2 10.96 2.85 .94|1255.6 3.4 3.38 1.58|1334.7 -.6 3.37 .11
1150.7 1.76 3.6 .55|1517.0 -9.38 2.61 -.07|1450.9 -16.04 2.75 .15|1504.1 -25.28 3.29 1.7|1215.8 -17.54 2.59 -.11|1234.4 -23.4 2.65 .89|1229.9 -16.52 2.95 -.05
1210.1 -22.62 3.02 1.33|0927.6 -8.66 1.98 1.44|1318.9 -23.17 3 .92|0855.4 5.95 3.11 1|1049.6 -16.19 3.11 1.25|1406.4 -26.68 3.25 1.12|0846.8 6.42 3.38 .68
1320.6 -36.71 2.75 .04|1406.7 -36.37 2.06 1.01|1008.4 11.97 1.35 -.11|1149.1 14.57 2.14 .09|1020.0 19.84 2.08 1.15|1114.1 20.52 2.56 .12|0945.9 23.77 2.98 .81
1114.2 15.43 3.33 -.01|1016.7 23.42 3.44 .31|1007.3 16.76 3.48 -.03|0952.8 26.01 3.88 1.22|0816.5 9.19 3.52 1.48|1103.7 61.75 1.79 1.07|1101.8 56.38 2.37 -.02
1153.8 53.69 2.44 0|1215.4 57.03 3.31 .08|1254.0 55.96 1.77 -.02|1323.9 54.93 2.27 .02|1347.5 49.31 1.86 -.19|1109.7 44.5 3 1.14|1022.3 41.5 3.05 1.59
0859.2 48.04 3.14 .19|0932.9 51.68 3.17 .46|0830.3 60.72 3.36 .85|1017.1 42.91 3.45 .03|1118.5 33.09 3.48 1.4|0903.6 47.16 3.6 0|0231.8 89.26 1.98 .6
1450.7 74.16 2.08 1.47|1520.7 71.83 3.05 .05|1756.6 51.49 2.23 1.52|1730.4 52.3 2.79 .98|1624.0 61.51 2.73 .91|1912.6 67.66 3.07 1|1404.4 64.38 3.65 -.05
1524.9 58.97 3.29 1.16|1708.8 65.71 3.17 -.12|2118.6 62.59 2.45 .22|2339.3 77.63 3.21 1.03|2128.7 70.56 3.23 -.22|2210.9 58.2 3.35 1.57|2041.4 45.28 1.25 .09
2022.2 40.26 2.23 .67|2046.2 33.97 2.48 1.03|1945.0 45.13 2.87 -.03|1930.7 27.96 3.08 1.13|2112.9 30.23 3.21 .99|1836.9 38.78 .03 0|1850.1 33.36 3.52 0
1859.0 32.69 3.25 -.05|2037.5 14.6 3.63 -.06|2039.6 15.91 3.77 .44|2046.7 16.12 3.9 1.04|2033.2 11.3 4.03 -.13|1958.8 19.49 3.47 1.57|0209.5 34.99 3 .14
0153.1 29.58 3.41 .49|0921.1 34.39 3.13 1.55|0539.6 -34.07 2.65 -.12|0551.0 -35.77 3.12 1.16|0803.6 -40 2.21 -.26|0717.1 -37.1 2.7 1.62|0807.5 -24.3 2.78 .43
0749.3 -24.86 3.34 1.24|0628.8 -7.03 3.76 -.1`.split(/[|\n]/).map((r) => {
  const [ra, dec, m, bv] = r.trim().split(" ").map(Number);
  return { ra: (Math.floor(ra / 100) + (ra % 100) / 60) * 15, dec, m, bv };
});

const RAD = Math.PI / 180, LAT = 51.5 * RAD, LON = -0.13;
// A seeded random (the faint field is the same every time)
const seeded = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// Galactic to equatorial (J2000): the north galactic pole and the galactic longitude of the north celestial pole
const AG = 192.85948 * RAD, DG = 27.12825 * RAD, LNCP = 122.93192 * RAD;
function fromGalactic(l, b) {
  l *= RAD; b *= RAD;
  const sd = Math.sin(DG) * Math.sin(b) + Math.cos(DG) * Math.cos(b) * Math.cos(LNCP - l);
  const ra = AG + Math.atan2(Math.cos(b) * Math.sin(LNCP - l), Math.cos(DG) * Math.sin(b) - Math.sin(DG) * Math.cos(b) * Math.cos(LNCP - l));
  return { ra: (((ra / RAD) % 360) + 360) % 360, dec: Math.asin(sd) / RAD };
}
// The faint stars, to magnitude 6.5: as many as the sky has (their numbers rising about threefold a magnitude), more of
// them toward the Milky Way's plane; and the Milky Way's own light, as patches along it
let FAINT = null, MW = null;
function faint() {
  const r = seeded(22), out = [], a = 10 ** (0.48 * 3.7), b = 10 ** (0.48 * 6.5);
  while (out.length < 8000) {
    const l = r() * 360, b0 = Math.asin(2 * r() - 1) / RAD; // even over the sphere
    if (r() > 0.35 + 0.65 * Math.exp(-Math.abs(b0) / 14)) continue;
    const m = Math.log10(a + r() * (b - a)) / 0.48, bv = -0.2 + 1.6 * r() ** 1.6;
    out.push({ ...fromGalactic(l, b0), m, bv });
  }
  return out;
}
function milkyWay() {
  const r = seeded(7), out = [], wrap = (l) => ((l + 540) % 360) - 180;
  // Its light at each longitude: brightest toward the centre (Sagittarius), the star clouds of Cygnus and Scutum, faint
  // toward the anticentre (Auriga, Taurus)
  const light = (l) => { const w = wrap(l); return 0.22 + 0.78 * Math.exp(-((w / 55) ** 2)) + 0.35 * Math.exp(-(((w - 75) / 18) ** 2)) + 0.25 * Math.exp(-(((w - 27) / 8) ** 2)); };
  for (let i = 0; i < 900; i++) {
    const l = r() * 360, b0 = (r() + r() + r() - 1.5) * 9 * (0.7 + 0.5 * Math.exp(-((wrap(l) / 40) ** 2))), s = 1.5 + r() * 4;
    out.push({ ...fromGalactic(l, b0), a: light(l) * (0.35 + 0.65 * r()), s, warm: Math.exp(-((wrap(l) / 50) ** 2)), dark: false });
  }
  // The Great Rift: dust along the plane from Cygnus to Sagittarius, a little north of it
  for (let l = 10; l <= 85; l += 1.5) out.push({ ...fromGalactic(l + r() * 1.5, 0.8 + (r() - 0.5) * 2.5), a: 0.6 + 0.4 * r(), s: 1.6 + r() * 2.2, dark: true });
  return out;
}

const BV = [[-0.3, [165, 190, 255]], [0, [214, 224, 255]], [0.3, [248, 246, 255]], [0.6, [255, 240, 222]], [1, [255, 216, 172]], [1.5, [255, 190, 132]], [2, [255, 168, 108]]];
function tint(bv) {
  const i = Math.max(1, Math.min(BV.length - 1, BV.findIndex(([v]) => v > bv))), [v0, c0] = BV[i - 1], [v1, c1] = BV[i];
  const f = Math.max(0, Math.min(1, (bv - v0) / (v1 - v0)));
  return c0.map((c, j) => Math.round(c + (c1[j] - c) * f));
}

// o: the canvas's size (w, h CSS px, its foot the horizon, its middle due south) and pixels a CSS px (k); deg, px a degree;
// when (a Date); lim, the faintest magnitude that shows (none below 0); mw, the Milky Way's strength (0 in a city);
// ext, the air's extinction (magnitudes an airmass)
export function drawStars(canvas, o) {
  const g = canvas.getContext("2d"), W = Math.round(o.w * o.k), H = Math.round(o.h * o.k);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; } else g.clearRect(0, 0, W, H);
  if (o.lim <= 0 && !o.mw) return;
  g.setTransform(o.k, 0, 0, o.k, 0, 0);
  g.globalCompositeOperation = "lighter";
  // The sidereal time at London, and each star's place: its height and bearing, through a level camera facing south
  const d = o.when.getTime() / 864e5 + 2440587.5 - 2451545;
  const lst = (280.46061837 + 360.98564736629 * d + LON) * RAD, F = o.deg / RAD, cx = o.w / 2, sL = Math.sin(LAT), cL = Math.cos(LAT);
  const place = (s) => {
    const H0 = lst - s.ra * RAD, dec = s.dec * RAD, cd = Math.cos(dec), sd = Math.sin(dec);
    const up = sL * sd + cL * cd * Math.cos(H0); // sin(height)
    if (up < 0) return null;
    const west = cd * Math.sin(H0), south = cL * sd * -1 + sL * cd * Math.cos(H0); // toward the west, and the south
    if (south < 0.15) return null;
    const x = cx + (F * west) / south, y = o.h - (F * up) / south;
    if (x < -20 || x > o.w + 20 || y < -20) return null;
    return { x, y, up, sc: F / south };
  };
  const airmass = (up) => 1 / (up + 0.025 * Math.exp(-11 * up));
  // The Milky Way first, under the stars: soft patches of light, dimmed low down, its rift taken out of it
  if (o.mw > 0) {
    MW ??= milkyWay();
    for (const pass of [false, true]) {
      g.globalCompositeOperation = pass ? "destination-out" : "lighter";
      for (const p of MW) {
        if (p.dark !== pass) continue;
        const q = place(p);
        if (!q) continue;
        const r = p.s * o.deg * (q.sc / F), x = Math.exp(-0.35 * (airmass(q.up) - 1)), a = (pass ? 0.5 : 0.05) * p.a * o.mw * (pass ? 1 : x);
        const c = pass ? [0, 0, 0] : [214 + 30 * p.warm, 218 + 14 * p.warm, 255 - 40 * p.warm].map(Math.round), gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
        gr.addColorStop(0, `rgba(${c},${a.toFixed(3)})`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.fillRect(q.x - r, q.y - r, 2 * r, 2 * r);
      }
    }
    g.globalCompositeOperation = "lighter";
    // Airglow: oxygen's faint green, a band about 10° up, seen only far from cities
    const ag = g.createLinearGradient(0, o.h, 0, o.h - 25 * o.deg);
    ag.addColorStop(0, "rgba(90,130,90,0)"); ag.addColorStop(0.25, `rgba(90,140,95,${(0.07 * o.mw).toFixed(3)})`); ag.addColorStop(0.45, `rgba(80,120,90,${(0.04 * o.mw).toFixed(3)})`); ag.addColorStop(1, "rgba(80,120,90,0)");
    g.fillStyle = ag; g.fillRect(0, o.h - 25 * o.deg, o.w, 25 * o.deg);
  }
  if (o.lim <= 0) return;
  const stars = o.lim > 3.7 ? CAT.concat(FAINT ??= faint()) : CAT;
  for (const s of stars) {
    if (s.m > o.lim + 0.5) continue;
    const q = place(s);
    if (!q) continue;
    const X = airmass(q.up), m = s.m + o.ext * (X - 1);
    if (m > o.lim) continue;
    // Its light over the faintest that shows: a point, larger and brighter the brighter it is, and a soft glow round the
    // brightest, as a camera sees them
    const I = 10 ** (-0.4 * (m - o.lim)), c = tint(s.bv + 0.12 * (X - 1)), a = Math.min(1, 0.42 * I ** 0.5), r = Math.min(1.7, 0.6 + 0.24 * Math.log10(I));
    if (I > 25) {
      const R = 2.5 + 1.6 * Math.log10(I), gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, R);
      gr.addColorStop(0, `rgba(${c},${Math.min(0.4, 0.07 * Math.log10(I)).toFixed(3)})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(q.x - R, q.y - R, 2 * R, 2 * R);
    }
    g.fillStyle = `rgba(${c},${a.toFixed(3)})`;
    g.beginPath(); g.arc(q.x, q.y, r, 0, 2 * Math.PI); g.fill();
  }
}
