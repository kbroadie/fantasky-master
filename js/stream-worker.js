// Fantasy Land's scene, drawn off the main thread on the canvases the page hands it: its background (the fall, fall.js;
// the stars and the aurora, night.js), its lake and Alex's stream (stream.js). One worker, so the lake can mirror the
// background. Messages: { to: "fall" | "night" | "water" | "view", type, ... }; it tells the page how the fall keeps up.
import { streamer } from "./stream.js";
import { runner } from "./fall.js";
import { night } from "./night.js";

// The background's canvases and which are drawn, and where the lake is on the screen (view), for the lake to mirror
const bg = { fall: null, fallOn: false, night: null, stars: null, aurora: null, view: null };
let s = null, fall = null;
onmessage = ({ data: m }) => {
  if (m.to === "fall") {
    if (m.type === "init") bg.fall = m.canvas;
    else if (m.type === "start") { fall?.stop(); fall = runner(bg.fall, m.w, m.h, m.reduced, m.opts, (r) => postMessage({ type: "frames", ...r })); fall.start(); bg.fallOn = true; }
    else { fall?.stop(); fall = null; bg.fallOn = false; }
  } else if (m.to === "night") {
    if (m.type === "init") { bg.stars = m.stars; bg.aurora = m.aurora; bg.night = night(m.stars, m.aurora); }
    else if (m.type === "start") bg.night?.start(m.arg);
    else bg.night?.stop();
  } else if (m.to === "view") bg.view = m.arg;
  else if (m.type === "init") s = streamer(m.jet, m.lake, bg);
  else s?.[m.type]?.(m.arg);
};
