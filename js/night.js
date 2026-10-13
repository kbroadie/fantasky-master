// Fantasy Land's night sky, behind everything (two of Moss's background effects): a field of stars (the comet is the
// house's sky's, halo.js), and an aurora, its curtains folding slowly, green low and pink-red high with a violet fringe along
// their feet, hanging low enough over the lake to be mirrored in it. Each on its own fixed canvas, under the fall. Shared
// by stream-worker.js (which also hands them to the lake to mirror) and flip.js's fallback; no DOM.

const VS = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";
const FS = `precision highp float;
uniform vec2 uRes, uView;
uniform float uT, uB;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main() {
  vec2 q = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * uView; // CSS px from the top left
  float W = max(uView.x, 1.0), H = uView.y;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i), x = q.x / W * (1.4 + 0.5 * fi) + fi * 3.7; // across, in curtain widths
    float foot = H * (0.8 + 0.06 * fi) + H * 0.18 * (fbm(vec2(x * 0.9 + uT * 0.02 * (1.0 + 0.3 * fi), fi * 7.0)) - 0.5); // where it hangs to, folding
    float d = q.y - foot;
    float ray = 0.3 + 0.7 * smoothstep(0.3, 0.85, fbm(vec2(x * 16.0 + uT * 0.1, fi * 5.0 + uT * 0.025))); // its rays, drifting along it
    float I = exp(min(d, 0.0) / (H * (0.17 + 0.07 * fi))) * smoothstep(16.0, 0.0, d) * ray * (0.55 + 0.45 * sin(x * 2.3 + uT * 0.22 + fi * 2.0));
    float hgt = clamp(-d / (H * 0.32), 0.0, 1.0);
    vec3 c = mix(vec3(0.2, 1.0, 0.52), vec3(0.9, 0.28, 0.62), smoothstep(0.35, 1.0, hgt)); // oxygen's green low, red high
    c = mix(c, vec3(0.55, 0.35, 1.0), smoothstep(-3.0, 12.0, d) * 0.7); // nitrogen's violet along the foot
    col += c * I * (0.5 - 0.1 * fi);
  }
  gl_FragColor = vec4(col * uB * 0.95, 0.0); // light added to the page's sky
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
  const u = (n) => gl.getUniformLocation(pr, n), uRes = u("uRes"), uView = u("uView"), uT = u("uT"), uB = u("uB");
  return (w, h, t, b) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, canvas.width, canvas.height); gl.uniform2f(uView, w, h); gl.uniform1f(uT, t); gl.uniform1f(uB, b);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

// The stars, drawn once (most faint and small, a few bright with a soft glow, white, blue-white or warm)
function starField(w, h, k) {
  const c = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(Math.round(w * k), Math.round(h * k)) : Object.assign(document.createElement("canvas"), { width: Math.round(w * k), height: Math.round(h * k) });
  const x = c.getContext("2d"), tints = ["255,255,255", "205,222,255", "255,236,214", "232,226,255"];
  x.scale(k, k);
  for (let i = 0, n = Math.round((w * h) / 1500); i < n; i++) {
    const sx = Math.random() * w, sy = Math.random() * h, big = Math.random() < 0.06, r = big ? 0.9 + Math.random() * 0.7 : 0.35 + Math.random() * 0.45;
    const a = big ? 0.9 : 0.25 + Math.random() * 0.5, col = tints[Math.floor(Math.random() * tints.length)];
    if (big) { const gr = x.createRadialGradient(sx, sy, 0, sx, sy, r * 4); gr.addColorStop(0, `rgba(${col},${a * 0.35})`); gr.addColorStop(1, `rgba(${col},0)`); x.fillStyle = gr; x.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8); }
    x.fillStyle = `rgba(${col},${a})`;
    x.beginPath(); x.arc(sx, sy, r, 0, Math.PI * 2); x.fill();
  }
  return c;
}
// start(o): o.w and o.h (the screen, CSS px), o.dpr (the stars' pixels per CSS px), o.res (the aurora's), o.fps, o.reduced
// (one still frame), and which are on: o.stars and o.aurora (o.bright, o.speed); stop(). on() says
// which are drawn now, for the lake to mirror
export function night(starsC, auroraC) {
  const sx = starsC.getContext("2d");
  const glDraw = aurora(auroraC);
  const raf = globalThis.requestAnimationFrame ? (f) => requestAnimationFrame(f) : (f) => setTimeout(() => f(performance.now()), 16);
  const unraf = globalThis.cancelAnimationFrame ?? clearTimeout;
  let o = null, id = 0, last = 0, t = 0;
  // The field is still: drawn once
  function stars() {
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, starsC.width, starsC.height);
    sx.drawImage(starField(o.w, o.h, o.dpr), 0, 0);
  }
  function step(now) {
    id = raf(step);
    if (last && now - last < 1000 / o.fps - 3) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now; t += dt * o.speed;
    if (o.aurora && glDraw) glDraw(o.w, o.h, 40 + t, o.bright);
  }
  return {
    start(opts) {
      this.stop();
      o = opts;
      starsC.width = o.stars ? Math.round(o.w * o.dpr) : 1; starsC.height = o.stars ? Math.round(o.h * o.dpr) : 1;
      auroraC.width = o.aurora ? Math.max(1, Math.round(o.w * o.res)) : 1; auroraC.height = o.aurora ? Math.max(1, Math.round(o.h * o.res)) : 1;
      if (o.stars) stars();
      if (o.aurora && glDraw) glDraw(o.w, o.h, 40 + t, o.bright);
      // Still: as it is; moving only if the aurora's on
      if (!o.reduced && o.aurora) { last = 0; id = raf(step); }
    },
    stop() { unraf(id); id = 0; o = null; },
    on: () => ({ stars: !!o?.stars, aurora: !!(o?.aurora && glDraw) }),
  };
}
