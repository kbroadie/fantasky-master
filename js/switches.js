// Hidden switches, toggled on Maurice Moss's cards (the Cast tab's Easter egg, cast.js): per device, in localStorage
export const SWITCHES = [
  { key: "fps", name: "Frame rate", note: "Live graphs in the corner: frames a second over the last 10 seconds, and how long each frame took. Under them, a Benchmark button runs every interaction at three speeds and gives a table of results to copy." },
];
const id = (k) => `fm-sw-${k}`;
export function isOn(k) {
  try { return localStorage.getItem(id(k)) === "1"; } catch { return false; }
}
export function setSwitch(k, on) {
  try { on ? localStorage.setItem(id(k), "1") : localStorage.removeItem(id(k)); } catch { /* private mode: lasts the visit */ }
  dispatchEvent(new CustomEvent("fm-switch", { detail: { key: k, on } }));
}

// The fps switch: live graphs of frames a second (the last 10s) and frame time (the last 160 frames).
// The loop keeps the main thread drawing every frame, so it costs a little itself; the graphs redraw 4 times a second
let meter = null;
function frameRate(show) {
  if (!show) { if (meter) { cancelAnimationFrame(meter.raf); meter.el.remove(); meter = null; } return; }
  if (meter) return;
  const W = 160, H = 84, dpr = Math.min(2, devicePixelRatio || 1);
  const el = Object.assign(document.createElement("div"), { className: "fps-meter" });
  el.innerHTML = `<canvas width="${W * dpr}" height="${H * dpr}" aria-hidden="true"></canvas><button type="button" class="fps-bench">Benchmark</button>`;
  document.body.append(el);
  el.lastChild.addEventListener("click", (e) => { e.stopPropagation(); import("./bench.js").then((b) => b.run(el.lastChild)); });
  const g = el.firstChild.getContext("2d");
  g.scale(dpr, dpr);
  meter = { el, raf: 0 };
  const recent = [], gaps = [], rates = []; // recent: frame times in the last second
  let last = 0, drawn = 0;
  const col = (ms) => (ms > 34 ? "#ff8a7a" : ms > 18 ? "#ffd27a" : "#8f8");
  const draw = (now) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(0,0,0,.82)";
    g.beginPath(); g.roundRect(0, 0, W, H, 6); g.fill();
    g.font = "500 11px 'DM Mono', monospace"; g.textBaseline = "top";
    // Frames a second: a line over the last 10s, against 60
    const top = 16, h1 = 22, max1 = Math.max(60, ...rates);
    const y1 = (v) => top + h1 - (v / max1) * h1;
    g.strokeStyle = "rgba(255,255,255,.25)"; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(6, y1(60)); g.lineTo(W - 6, y1(60)); g.stroke(); g.setLineDash([]);
    g.strokeStyle = "#8f8"; g.lineWidth = 1.5; g.beginPath();
    rates.forEach((v, k) => { const x = W - 6 - (rates.length - 1 - k) * ((W - 12) / 39); k ? g.lineTo(x, y1(v)) : g.moveTo(x, y1(v)); });
    g.stroke();
    g.fillStyle = "#8f8"; g.fillText(`${rates.at(-1) ?? 0} fps`, 6, 3);
    // Frame time: a bar a frame over the last 160, against 17ms (60 fps) and 33ms (30 fps), up to 66ms
    const base = H - 6, h2 = 30, y2 = (ms) => base - Math.min(ms, 66) / 66 * h2;
    g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 1; g.setLineDash([2, 2]);
    for (const ms of [16.7, 33.3]) { g.beginPath(); g.moveTo(6, y2(ms)); g.lineTo(W - 6, y2(ms)); g.stroke(); }
    g.setLineDash([]);
    gaps.forEach((ms, k) => { const x = W - 6 - (gaps.length - k); g.fillStyle = col(ms); g.fillRect(x, y2(ms), 1, base - y2(ms)); });
    const worst = Math.max(0, ...recent.map((f) => f[1]));
    g.fillStyle = col(worst); g.textAlign = "right"; g.fillText(`${Math.round(worst)} ms`, W - 6, top + h1 + 3); g.textAlign = "left";
  };
  const tick = (now) => {
    if (last) { const gap = now - last; recent.push([now, gap]); gaps.push(gap); if (gaps.length > W - 12) gaps.shift(); }
    last = now;
    while (recent.length && now - recent[0][0] > 1000) recent.shift();
    if (now - drawn >= 250) {
      drawn = now;
      rates.push(recent.length); if (rates.length > 40) rates.shift();
      draw(now);
    }
    meter.raf = requestAnimationFrame(tick);
  };
  meter.raf = requestAnimationFrame(tick);
}
frameRate(isOn("fps"));
addEventListener("fm-switch", ({ detail: d }) => { if (d.key === "fps") frameRate(d.on); });
