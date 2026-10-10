// Draws Fantasy mode's fall off the main thread (on request: "optimize rainbow
// view performance"): flip.js hands it the canvas (transferControlToOffscreen)
// and tells it to start, stop and hush, so the page's own scrolling and
// animations never wait on the fall.
import { runner } from "./fall.js";

let canvas = null, run = null;
onmessage = ({ data: m }) => {
  if (m.type === "init") canvas = m.canvas;
  else if (m.type === "start") { run?.stop(); run = runner(canvas, m.w, m.h, m.reduced); run.start(); }
  else if (m.type === "stop") { run?.stop(); run = null; }
  else if (m.type === "hush") run?.hush(m.ms);
};
