// Draws Alex's stream off the main thread (stream.js): its size and places, his press, start and stop.
import { streamer } from "./stream.js";

let s = null;
onmessage = ({ data: m }) => {
  if (m.type === "init") s = streamer(m.canvas);
  else s?.[m.type]?.(m.arg);
};
