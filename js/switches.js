// Hidden switches, toggled in the duck menu (Switches): per device, in localStorage
export const SWITCHES = [
  { key: "upright", name: "Rainbow view right side up", note: "No turning: tap the quote (under every tab) to switch the rainbow view on and off. The phone's tilt is ignored." },
  { key: "flip", name: "Flipped layout", note: "Upside down, turn the content rather than the page, so the phone does the scrolling. An experiment." },
  { key: "fps", name: "Frame rate", note: "A corner box: frames a second and the longest frame, over the last second. It times the main thread; scrolling the phone does itself can stay smooth when it drops." },
  { key: "tilt", name: "Tilt diagnostic", note: "A box of the motion sensors' readings (also ?tilt in the address)." },
];
const id = (k) => `fm-sw-${k}`;
export function isOn(k) {
  try { return localStorage.getItem(id(k)) === "1"; } catch { return false; }
}
export function setSwitch(k, on) {
  try { on ? localStorage.setItem(id(k), "1") : localStorage.removeItem(id(k)); } catch { /* private mode: lasts the visit */ }
  dispatchEvent(new CustomEvent("fm-switch", { detail: { key: k, on } }));
}

// The fps switch. The loop keeps the main thread drawing every frame, so it costs a little itself
let meter = null;
function frameRate(show) {
  if (!show) { if (meter) { cancelAnimationFrame(meter.raf); meter.el.remove(); meter = null; } return; }
  if (meter) return;
  meter = { el: Object.assign(document.createElement("div"), { className: "fps-meter", ariaHidden: "true" }), raf: 0 };
  document.body.append(meter.el);
  const frames = []; // [time, gap]
  let last = 0, shown = 0;
  const tick = (now) => {
    if (last) frames.push([now, now - last]);
    last = now;
    while (frames.length && now - frames[0][0] > 1000) frames.shift();
    if (now - shown > 250 && frames.length) {
      shown = now;
      const worst = Math.max(...frames.map((f) => f[1]));
      meter.el.textContent = `${frames.length} fps · ${Math.round(worst)} ms`;
      meter.el.classList.toggle("slow", worst > 50);
    }
    meter.raf = requestAnimationFrame(tick);
  };
  meter.raf = requestAnimationFrame(tick);
}
frameRate(isOn("fps"));
addEventListener("fm-switch", ({ detail: d }) => { if (d.key === "fps") frameRate(d.on); });
