// Hidden switches, toggled in the duck menu (Switches): per device, in localStorage
export const SWITCHES = [
  { key: "flip", name: "Flipped layout", note: "Upside down, turn the content rather than the page, so the phone does the scrolling. An experiment." },
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
