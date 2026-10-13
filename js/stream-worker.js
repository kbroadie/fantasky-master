// Draws Alex's stream off the main thread (stream.js): its size and places, his press, start and stop; sends back where
// what floats has been pushed.
import { streamer } from "./stream.js";

let s = null;
onmessage = ({ data: m }) => {
  if (m.type === "init") s = streamer(m.canvas, (msg) => postMessage(msg));
  else s?.[m.type]?.(m.arg);
};
