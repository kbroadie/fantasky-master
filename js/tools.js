// Diagnostics, switched on Moss's cards (switches.js): the frame rate graphs and the benchmark button, in the site's own
// colours (read from its tokens, so the rainbow view's too). The graphs' loop keeps the main thread drawing every
// frame, so it costs a little itself; they redraw 4 times a second
import { get, onSwitch } from "./switches.js";

const token = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let meter = null;
function frameRate(show) {
  if (!show) { if (meter) { cancelAnimationFrame(meter.raf); meter.el.remove(); meter = null; } return; }
  if (meter) return;
  const W = 168, H = 104, dpr = Math.min(2, devicePixelRatio || 1);
  const el = Object.assign(document.createElement("canvas"), { className: "fps-meter", width: W * dpr, height: H * dpr, ariaHidden: "true" });
  document.body.append(el);
  const g = el.getContext("2d");
  g.scale(dpr, dpr);
  meter = { el, raf: 0 };
  const recent = [], gaps = [], rates = [];
  let last = 0, drawn = 0;
  const draw = () => {
    const ok = token("--gold2"), meh = token("--bronze"), bad = token("--warn"), dim = token("--t3"), rule = token("--b-dim");
    const col = (ms) => (ms > 34 ? bad : ms > 18 ? meh : ok);
    const row = (y, label, value, colour) => {
      g.font = "500 11px 'DM Mono', monospace"; g.textBaseline = "top";
      g.fillStyle = dim; g.textAlign = "left"; g.fillText(label, 10, y);
      g.fillStyle = colour; g.textAlign = "right"; g.fillText(value, W - 10, y);
    };
    const guide = (y) => { g.strokeStyle = rule; g.lineWidth = 1; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(10, y); g.lineTo(W - 10, y); g.stroke(); g.setLineDash([]); };
    g.clearRect(0, 0, W, H);
    // Frames a second: a line over the last 10s, against 60
    const fps = rates.at(-1) ?? 0, top = 22, h1 = 20, max1 = Math.max(60, ...rates), y1 = (v) => top + h1 - (v / max1) * h1;
    row(6, "FPS", String(fps), fps >= 55 ? ok : fps >= 30 ? meh : bad);
    guide(y1(60));
    g.strokeStyle = ok; g.lineWidth = 1.5; g.lineJoin = "round"; g.beginPath();
    rates.forEach((v, k) => { const x = W - 10 - (rates.length - 1 - k) * ((W - 20) / 39); k ? g.lineTo(x, y1(v)) : g.moveTo(x, y1(v)); });
    g.stroke();
    // Frame time: a bar a frame over the last 148, against 17ms (60 fps) and 33ms (30 fps), up to 66ms
    const worst = Math.max(0, ...recent.map((f) => f[1])), base = H - 8, h2 = 28, y2 = (ms) => base - (Math.min(ms, 66) / 66) * h2;
    row(52, "FRAME", `${Math.round(worst)} ms`, col(worst));
    guide(y2(16.7)); guide(y2(33.3));
    gaps.forEach((ms, k) => { g.fillStyle = col(ms); g.fillRect(W - 10 - (gaps.length - k), y2(ms), 1, base - y2(ms)); });
  };
  const tick = (now) => {
    if (last) { const gap = now - last; recent.push([now, gap]); gaps.push(gap); if (gaps.length > W - 20) gaps.shift(); }
    last = now;
    while (recent.length && now - recent[0][0] > 1000) recent.shift();
    if (now - drawn >= 250) { drawn = now; rates.push(recent.length); if (rates.length > 40) rates.shift(); draw(); }
    meter.raf = requestAnimationFrame(tick);
  };
  meter.raf = requestAnimationFrame(tick);
}

let bench = null;
function benchButton(show) {
  if (!show) { bench?.remove(); bench = null; return; }
  if (bench) return;
  bench = Object.assign(document.createElement("button"), { type: "button", className: "ed-btn gold bench-btn", textContent: "Benchmark" });
  bench.addEventListener("click", (e) => { e.stopPropagation(); import("./bench.js").then((b) => b.run(bench)); });
  document.body.append(bench);
}

frameRate(get("fps"));
benchButton(get("bench"));
onSwitch(["fps"], (d) => frameRate(d.value));
onSwitch(["bench"], (d) => benchButton(d.value));
