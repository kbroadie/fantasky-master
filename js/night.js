// The aurora (on request: "Make the Aurora physically accurate for the new fantasy land", "position the Aurora relative to
// the atmospheric effects instead of the background"): in the house's sky with its stars and halos, its foot the horizon,
// facing south through the same level camera (degPx), drawn in the scene's worker (stream-worker.js), which also hands
// it to the lake to mirror. Fantasy Land is where London was, under a great storm's aurora, as London saw in May 2024: the
// oval pushed south past it, so its curtains hang in the southern sky.
// Each curtain is a thin sheet of light along a line of the Earth's magnetic field, which at London dips 66° into the
// ground toward the north: so a sheet leans, rising toward the south, and its rays (the field lines) converge on the
// magnetic zenith, 66° up in the south. A sheet's footprint (where its field lines are 100 km up) runs east to west and
// folds, drifting. For each pixel the ray from the eye (the Earth's curvature in its height) meets each sheet once:
// there the light is the sheet's emission at that height, times the path through it (a sheet seen edge-on, at a fold,
// is brightest). The emissions by height, as photographed: a sharp lower edge near 100 km, sometimes a pink-violet
// fringe of nitrogen under it; oxygen's green (557.7 nm) from there, fading over tens of km, in rays that drift along the
// curtain; above 200 km oxygen's deep red (630 nm), smooth, unrayed (it glows for nearly two minutes, so the rays blur
// out of it); and far to the south a stable red arc, all red, high and faint. Dimmed and reddened low down by the air.
// No DOM.

const VS = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";
const FS = `precision highp float;
uniform vec2 uRes, uView;
uniform float uT, uB, uDeg;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
const float R = 6371.0, TI = 2.246; // the Earth's radius (km); tan of the field's dip at London (66°)
// A sheet's footprint at x (km east): its base line south of us (Y, km), folding as it drifts
float foot(float x, float Y, float A, float sc, float id) { return Y + A * (fbm(vec2(x / sc + uT * 0.012 * (1.0 + 0.3 * id), id * 7.3)) - 0.5); }
void main() {
  vec2 q = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * uView; // CSS px from the top left; the foot is the horizon
  float F = uDeg * 57.29578;
  vec3 d = normalize(vec3((q.x - 0.5 * uView.x) / F, (uView.y - q.y) / F, 1.0)); // right (west), up, forward (south)
  float U = d.y, E = -d.x, N = -d.z; // east, north and up
  if (U <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec3 col = vec3(0.0);
  // The ray's height at s km: s·U, plus the Earth curving away beneath it; its footprint northward: where it is, plus
  // its height up the field line (which rises southward)
  float a = N + U / TI, b = (1.0 - U * U) / (2.0 * R * TI);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float Y = i == 0 ? -170.0 : i == 1 ? -280.0 : i == 2 ? -420.0 : i == 3 ? -640.0 : -1050.0;
    float A = i == 4 ? 30.0 : 130.0 + 60.0 * fi, sc = i == 4 ? 900.0 : 110.0 + 50.0 * fi;
    // Where the ray meets the sheet: solve, then again at the fold there
    float s = 0.0, Yc = Y;
    for (int k = 0; k < 3; k++) {
      float c = -100.0 / TI - Yc, disc = a * a - 4.0 * b * c;
      if (disc < 0.0) { s = -1.0; break; }
      s = 2.0 * c / (-a + sqrt(disc)); // the nearer root, without cancelling (b is tiny)
      Yc = foot(s * E, Y, A, sc, fi);
    }
    if (s <= 0.0) continue;
    float x = s * E, h = s * U + s * s * (1.0 - U * U) / (2.0 * R);
    if (h < 80.0 || h > 700.0) continue;
    // The path through it: its thickness over how fast the ray crosses it (a fold seen edge-on is brightest)
    float slope = (foot(x + 2.0, Y, A, sc, fi) - foot(x - 2.0, Y, A, sc, fi)) / 4.0;
    float path = 1.0 / max(0.06, abs(a + 2.0 * b * s - slope * E));
    vec3 c;
    if (i == 4) { // the stable red arc: all oxygen red, high, smooth
      c = vec3(1.0, 0.1, 0.16) * 0.2 * exp(-pow((h - 420.0) / 140.0, 2.0));
    } else {
      // How strong the curtain is along its length, patchy, and its rays: field-aligned, so they depend only on where
      // along the curtain they stand, drifting along it
      float str = smoothstep(0.2, 0.7, fbm(vec2(x / 230.0 + uT * 0.008, fi * 3.1)));
      float ray = 0.12 + 0.88 * smoothstep(0.35, 0.8, fbm(vec2(x / 7.0 + uT * (0.35 + 0.1 * fi), fi * 5.0 + uT * 0.05)));
      float hb = 100.0 + 14.0 * fbm(vec2(x / 140.0 - uT * 0.01, fi + 20.0)); // its lower edge
      float edge = smoothstep(hb - 3.0, hb + 2.0, h);
      float green = edge * exp(-max(0.0, h - hb - 4.0) / 38.0) * ray;
      float red = 0.2 * smoothstep(150.0, 230.0, h) * exp(-max(0.0, h - 260.0) / 130.0) * (0.55 + 0.45 * str);
      float fringe = smoothstep(hb - 9.0, hb - 2.0, h) * (1.0 - smoothstep(hb - 1.0, hb + 5.0, h)) * ray;
      c = (vec3(0.22, 1.0, 0.46) * 1.6 * green + vec3(1.0, 0.36, 0.72) * 0.55 * fringe + vec3(0.48, 0.32, 1.0) * 0.4 * fringe) * str + vec3(1.0, 0.1, 0.18) * red;
      c *= 0.9 - 0.12 * fi; // the further ones a little fainter (their storm's edge)
    }
    col += c * min(path, 9.0) * 0.9;
  }
  // The air it shines through, low down: dimmer, and redder
  float X = 1.0 / (U + 0.025 * exp(-11.0 * U));
  col *= exp(-vec3(0.36, 0.22, 0.14) * (X - 1.0) * 0.6);
  col = 1.0 - exp(-col * uB * 1.4); // a camera's soft shoulder
  gl_FragColor = vec4(col, 0.0); // light added to the sky under it
}`;

function aurora(canvas) {
  let gl = null;
  // (its picture kept between frames: the lake reads it to mirror it, at its own time)
  try { gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true }); } catch {}
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const ap = gl.getAttribLocation(pr, "p");
  gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
  const u = (n) => gl.getUniformLocation(pr, n), uRes = u("uRes"), uView = u("uView"), uT = u("uT"), uB = u("uB"), uDeg = u("uDeg");
  return (o, t) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, canvas.width, canvas.height); gl.uniform2f(uView, o.w, o.h); gl.uniform1f(uT, t); gl.uniform1f(uB, o.bright * o.show); gl.uniform1f(uDeg, o.deg);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

// start(o): o.w and o.h (its canvas, CSS px: the footer's width, from the horizon up), o.deg (px a degree), o.res (its
// pixels per CSS px), o.fps, o.reduced (one still frame), o.bright, o.speed, and o.show (how much the sky lets it show:
// all in Fantasy Land, by the dark in the normal view); stop(). on() says whether it's drawn, for the lake to mirror
export function night(canvas) {
  const draw = aurora(canvas);
  const raf = globalThis.requestAnimationFrame ? (f) => requestAnimationFrame(f) : (f) => setTimeout(() => f(performance.now()), 16);
  const unraf = globalThis.cancelAnimationFrame ?? clearTimeout;
  let o = null, id = 0, last = 0, t = 0;
  function step(now) {
    id = raf(step);
    if (last && now - last < 1000 / o.fps - 3) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now; t += dt * o.speed;
    draw(o, 40 + t);
  }
  return {
    start(opts) {
      this.stop();
      o = opts;
      canvas.width = Math.max(1, Math.round(o.w * o.res)); canvas.height = Math.max(1, Math.round(o.h * o.res));
      if (!draw) return;
      draw(o, 40 + t);
      if (!o.reduced) { last = 0; id = raf(step); }
    },
    // How much shows, as the sky darkens or lightens (each minute): kept without starting again
    show(s) { if (o) { o.show = s; if (!id && draw) draw(o, 40 + t); } },
    stop() { unraf(id); id = 0; o = null; },
    on: () => !!(o && draw && o.show > 0),
  };
}
