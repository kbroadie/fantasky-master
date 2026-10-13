// Fantasy Land's lake on the GPU (stream.js draws it with this where WebGL is there, in the stream's worker): for each
// pixel, the water's surface there, a slow swell and a finer chop plus every ripple spreading from where the stream
// lands, each a ring on the lake's plane seen in perspective; its slope shifts what's mirrored there (the rainbow about
// the horizon, the background effects above it, Alex's rock about its foot, the stream about the water under it) and
// catches the sky's light on the crests. Waves too fine to see at their distance are left out, so the far water is a smooth mirror. Its light is added
// to the lake's colour under it (styles.css); what it mirrors of his rock and the stream covers it.

const VS = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";
const FS = `precision highp float;
uniform vec2 uSize, uBowSize;
uniform float uK, uLH, uCx, uF, uT, uWl, uM, uHasRock, uHasJet, uHasSky;
uniform vec4 uRock, uAxis, uJet;
uniform sampler2D tBow, tRock, tJet, tSky;
uniform vec4 uRings[16];
uniform int uN;
// a wave's slope, left out where it's too fine to see at its distance
float seen(float k, float Z) { return clamp((uLH * 6.2832 / k / (Z * Z) - 2.0) / 4.0, 0.0, 1.0); }
vec2 wave(vec2 d, float k, float a, float w, vec2 P, float Z) { return d * (a * k * cos(k * dot(d, P) - w * uT) * seen(k, Z)); }
void main() {
  vec2 q = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y) / uK; // CSS px from the lake's top left (the horizon)
  float Z = uLH / (q.y + 0.8), s = clamp(1.0 / Z, 0.0, 1.0); // its distance (1 at the foot)
  vec2 P = vec2((q.x - uCx) * Z / uF, Z); // its place on the water
  vec2 g = wave(normalize(vec2(0.3, 1.0)), 9.0, 0.005, 1.1, P, Z)
         + wave(normalize(vec2(-0.55, 1.0)), 15.0, 0.0026, 1.5, P, Z)
         + wave(normalize(vec2(1.0, 0.3)), 25.0, 0.0012, 2.2, P, Z);
  for (int i = 0; i < 16; i++) {
    if (i >= uN) break;
    vec4 r = uRings[i]; // where it began, its age, its strength
    vec2 v = P - r.xy;
    float d = length(v) + 1e-4, rho = 0.6 * r.z, sig = 0.04 + 0.07 * rho, kap = 6.2832 / (0.1 + 0.05 * rho);
    float x = d - rho, env = exp(-x * x / (sig * sig));
    float A = r.w * 0.0055 * exp(-r.z / 3.5) * inversesqrt(1.0 + rho / 0.5); // as marked as the swell's waves
    g += v / d * (A * env * (-kap * sin(x * kap) - 2.0 * x / (sig * sig) * cos(x * kap))) * seen(kap, Z);
  }
  vec2 off = g * vec2(30.0, 40.0);
  float rf = mix(0.85, 0.35, s); // it mirrors more at a grazing angle
  vec3 add = texture2D(tBow, (q + vec2(uM, 0.0) + off) / uBowSize).rgb * rf * 0.6;
  if (uHasSky > 0.5) add += texture2D(tSky, vec2((q.x + off.x) * uK / uSize.x, (uLH + 4.0 - q.y - off.y) / (uLH + 4.0))).rgb * rf * 0.85; // the background effects above it
  vec4 near = vec4(0.0);
  float ax = clamp((uAxis.x - q.x) / max(1.0, uAxis.x - uAxis.z), 0.0, 1.0), axis = mix(uAxis.y, uAxis.w, ax);
  if (uHasJet > 0.5 && q.y > axis) {
    vec2 j = vec2(q.x, 2.0 * axis - q.y) + off;
    near = texture2D(tJet, vec2(j.x * uK / uSize.x, (j.y - uJet.x) / uJet.y)) * 0.8;
  }
  if (uHasRock > 0.5 && q.y > uWl) {
    vec2 uv = (vec2(q.x, 2.0 * uWl - q.y) + off - uRock.xy) / uRock.zw;
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) near += texture2D(tRock, uv) * 0.62 * (1.0 - near.a);
  }
  near *= rf;
  float up = -g.y, lit = max(0.0, up) * 2.4 + pow(max(0.0, up * 16.0 - 0.6), 3.0) * 0.2; // crests catch the sky
  float dark = clamp(g.y * 3.0, 0.0, 0.45); // and the backs of the waves are darker
  gl_FragColor = vec4(add + near.rgb + vec3(0.84, 0.8, 1.0) * lit * rf * 0.3, near.a + dark * (1.0 - near.a));
}`;

export function glLake(canvas) {
  let gl = null;
  try { gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }); } catch {}
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
  const loc = {};
  const u = (n) => (loc[n] ??= gl.getUniformLocation(pr, n));
  const tex = {};
  ["tBow", "tRock", "tJet", "tSky"].forEach((n, i) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.uniform1i(u(n), i);
    tex[n] = [t, i];
  });
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  return {
    // A picture for one of its textures: the rainbow's strip, his rock, the stream above the water
    tex(n, src) { const [t, i] = tex[n]; gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); },
    draw(v) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      for (const [n, x] of Object.entries(v)) {
        if (n === "uRings") gl.uniform4fv(u("uRings"), x);
        else if (n === "uN") gl.uniform1i(u(n), x);
        else if (typeof x === "number") gl.uniform1f(u(n), x);
        else (x.length === 2 ? gl.uniform2fv : gl.uniform4fv).call(gl, u(n), x);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
