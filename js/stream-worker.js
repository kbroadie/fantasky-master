// The scene, drawn off the main thread on the canvases the page hands it: Fantasy Land's background (the fall, fall.js),
// the house's sky's aurora (night.js, in both views), Fantasy Land's lake and Alex's stream (stream.js). One worker, so
// the lake can mirror the fall and the aurora. Messages: { to: "fall" | "night" | "water" | "view", type, ... }.
import { streamer } from "./stream.js";
import { runner } from "./fall.js";
import { night } from "./night.js";

// What the lake mirrors: the fall's canvas (fixed to the screen, so where the lake is on it: view) and the aurora's
const bg = { fall: null, fallOn: false, night: null, aurora: null, view: null };
let s = null, fall = null;
onmessage = ({ data: m }) => {
  if (m.to === "fall") {
    if (m.type === "init") bg.fall = m.canvas;
    else if (m.type === "start") { fall?.stop(); fall = runner(bg.fall, m.w, m.h, m.reduced, m.opts); fall.start(); bg.fallOn = true; }
    else { fall?.stop(); fall = null; bg.fallOn = false; }
  } else if (m.to === "night") {
    if (m.type === "init") { bg.aurora = m.aurora; bg.night = night(m.aurora); }
    else bg.night?.[m.type]?.(m.arg);
  } else if (m.to === "view") bg.view = m.arg;
  else if (m.type === "init") s = streamer(m.jet, m.lake, bg);
  else s?.[m.type]?.(m.arg);
};
