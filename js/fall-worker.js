// Draws the fantasy fall off the main thread: start and stop.
import { runner } from "./fall.js";

let canvas = null, run = null;
onmessage = ({ data: m }) => {
  if (m.type === "init") canvas = m.canvas;
  else if (m.type === "start") { run?.stop(); run = runner(canvas, m.w, m.h, m.reduced, m.opts, (r) => postMessage({ type: "frames", ...r })); run.start(); }
  else if (m.type === "stop") { run?.stop(); run = null; }
};
