// Draws Fantasy Land's lake and Alex's stream off the main thread (stream.js), on the two canvases main.js hands it:
// their sizes and places, his picture for his reflection, his press, start and stop.
import { streamer } from "./stream.js";

let s = null;
onmessage = ({ data: m }) => {
  if (m.type === "init") s = streamer(m.jet, m.lake);
  else s?.[m.type]?.(m.arg);
};
