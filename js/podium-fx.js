// Episode podium effects: winner's gold light (rays, glow, pool, bounce, shadows, dust, glints) and last place's stink gas (heavy, sinks to the card's bottom and spreads like dry ice, collides with all four sides). One canvas at half resolution, between the portraits and the text: what's behind them is drawn first and their shapes cut out of it, then what's in front. Scrolling sloshes gas and stirs dust; only on-screen podiums run; reduced motion gets one still frame.

const DPR = Math.min(2, window.devicePixelRatio || 1) / 2;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function sprite(size, paint) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  paint(c.getContext("2d"), size);
  return c;
}

const glowSprite = (r, g, b) => sprite(64, (x, s) => {
  const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(0.18, `rgba(${r},${g},${b},.55)`);
  gr.addColorStop(0.5, `rgba(${r},${g},${b},.12)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, s, s);
});

// Gas puff: lit from above, dark beneath, so a pile reads as volume
const gasSprite = () => sprite(96, (x, s) => {
  const c = s / 2;
  for (let i = 0; i < 9; i++) {
    const a = rand(0, TAU), d = rand(0, s * 0.2), bx = c + Math.cos(a) * d, by = c + Math.sin(a) * d * 0.8, r = rand(s * 0.16, s * 0.3);
    const lit = clamp(1 - (by - (c - s * 0.25)) / (s * 0.5), 0, 1);
    const col = [Math.round(52 + 118 * lit), Math.round(62 + 128 * lit), Math.round(18 + 46 * lit)];
    const gr = x.createRadialGradient(bx, by - r * 0.25, 0, bx, by, r);
    gr.addColorStop(0, `rgba(${col},.9)`);
    gr.addColorStop(0.55, `rgba(${col},.45)`);
    gr.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, s, s);
  }
  x.globalCompositeOperation = "destination-in";
  const m = x.createRadialGradient(c, c, 0, c, c, c);
  m.addColorStop(0.45, "rgba(0,0,0,1)");
  m.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = m;
  x.fillRect(0, 0, s, s);
});

let SPR = null;
const sprites = () => (SPR ||= {
  dust: glowSprite(255, 214, 120),
  spark: glowSprite(255, 246, 214),
  gas: [gasSprite(), gasSprite(), gasSprite(), gasSprite()],
});

const scenes = new Set(), visible = new Set();
let raf = 0, then = 0, scrollDY = 0, lastY = scrollY;

class Scene {
  constructor(pod) {
    this.pod = pod;
    pod.__fx = this;
    pod.classList.add("has-fx");
    this.c = Object.assign(document.createElement("canvas"), { className: "fx", ariaHidden: "true" });
    pod.prepend(this.c);
    this.x = this.c.getContext("2d");
    this.cache = null;
    this.gas = [];
    this.dust = [];
    this.glints = [];
    this.t = rand(0, 100);
    this.energy = 0;
    this.spawnGas = 0;
    this.spawnDust = 0;
    this.layout();
    new ResizeObserver(() => this.layout()).observe(pod);
    for (const img of pod.querySelectorAll("img")) if (!img.complete) img.addEventListener("load", () => this.layout(), { once: true });
  }

  layout() {
    // Measured by offsets within the card, so it holds when the page is turned
    this.w = this.pod.clientWidth;
    this.h = this.pod.clientHeight;
    if (!this.w) return;
    this.cache = null;
    this.c.width = Math.round(this.w * DPR);
    this.c.height = Math.round(this.h * DPR);
    const rect = (el) => {
      let x = 0, y = 0;
      for (let n = el; n && n !== this.pod; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
      const w = el.offsetWidth, h = el.offsetHeight;
      return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
    };
    const cols = [...this.pod.querySelectorAll(".pod-col")];
    this.frames = cols.map((col) => ({ ...rect(col.querySelector(".fp")), img: col.querySelector(".fp"), win: col.classList.contains("win"), last: col.classList.contains("last") }));
    this.win = this.frames.find((f) => f.win) || null;
    this.losers = this.frames.filter((f) => f.last);
    this.floor = Math.max(...this.frames.map((f) => f.y + f.h)) + 2;
    this.bed = this.h;
    if (REDUCED) this.settle();
  }

  impulse(dy) {
    this.energy = Math.min(1.4, this.energy + Math.abs(dy) / 260);
    for (const p of this.gas) {
      p.y += dy * 0.4;
      p.vx += rand(-1, 1) * Math.abs(dy) * 1.2;
      p.vy += dy * 1.4;
    }
    for (const p of this.dust) {
      p.y += dy * 0.75;
      p.vx += rand(-1, 1) * Math.abs(dy) * 2.5;
      p.vy += dy * 1.2;
    }
  }

  // Off screen: drop gas and dust, so an episode starts afresh
  reset() {
    this.gas = []; this.dust = []; this.glints = [];
    this.spawnGas = this.spawnDust = 0;
    this.cache = null;
    this.x.setTransform(1, 0, 0, 1, 0, 0); this.x.clearRect(0, 0, this.c.width, this.c.height);
  }

  step(dt) {
    this.t += dt;
    this.energy *= Math.exp(-2.2 * dt);
    const { w, floor } = this;

    if (this.losers.length) {
      this.spawnGas += dt * 34;
      while (this.spawnGas >= 1 && this.gas.length < 180) {
        this.spawnGas--;
        const f = this.losers[Math.floor(Math.random() * this.losers.length)];
        this.gas.push({
          x: f.x + rand(0.1, 0.9) * f.w, y: f.y + rand(0.45, 1) * f.h,
          vx: rand(-10, 10), vy: rand(-6, 6), src: f.cx,
          age: 0, life: rand(5.5, 9), s0: rand(26, 44), seed: rand(0, 100),
          spr: Math.floor(Math.random() * 4), a: rand(0.14, 0.24),
        });
      }
      if (this.spawnGas > 1) this.spawnGas = 1;
    }
    const g = 30, drag = Math.exp(-1.2 * dt), { h, bed } = this;
    for (const p of this.gas) {
      p.age += dt;
      const r = p.s0 * (1 + (p.age / p.life) * 0.9) * 0.32;
      const low = clamp((p.y - (bed - 40)) / 36, 0, 1);
      p.vx += Math.sin(p.y * 0.045 + this.t * 0.7 + p.seed) * (14 - 8 * low) * dt;
      p.vy += (g * (1 - low * 0.7) + Math.cos(p.x * 0.05 + this.t * 0.5 + p.seed) * 8 * (1 - low)) * dt;
      if (low > 0) p.vx += Math.sign(p.x - p.src || p.seed - 50) * 22 * low * dt;
      p.vx *= drag; p.vy *= drag * (1 - low * 0.02);
      p.x += p.vx * dt; p.y += p.vy * dt;
      // Bottom lets a puff's soft underside press on the edge so the bank lies on it
      const rb = p.s0 * 0.06;
      if (p.y > bed - rb) { p.y = bed - rb; p.vx += Math.sign(p.x - p.src || p.seed - 50) * Math.abs(p.vy) * 0.5; p.vy = -Math.abs(p.vy) * 0.1; }
      if (p.y < r) { p.y = r; p.vy = Math.abs(p.vy) * 0.3; }
      if (p.x < r) { p.x = r; p.vx = Math.abs(p.vx) * 0.25; }
      if (p.x > w - r) { p.x = w - r; p.vx = -Math.abs(p.vx) * 0.25; }
      p.low = low;
    }
    this.gas = this.gas.filter((p) => p.age < p.life);

    if (this.win) {
      const f = this.win;
      this.spawnDust += dt * (9 + this.energy * 20);
      while (this.spawnDust >= 1 && this.dust.length < 70) {
        this.spawnDust--;
        const edge = Math.random();
        this.dust.push({
          x: f.x + (edge < 0.5 ? rand(-0.1, 1.1) * f.w : edge < 0.75 ? rand(-0.15, 0.05) * f.w : rand(0.95, 1.15) * f.w),
          y: f.y + rand(0.1, 1.05) * f.h,
          vx: rand(-4, 4), vy: rand(-18, -6), age: 0, life: rand(2.5, 5), r: rand(0.8, 2.2), tw: rand(3, 9), seed: rand(0, 100),
        });
      }
      if (this.spawnDust > 1) this.spawnDust = 1;
      for (const p of this.dust) {
        p.age += dt;
        p.vx += Math.sin(this.t * 1.3 + p.seed) * 6 * dt;
        p.vy += -3 * dt;
        p.vx *= Math.exp(-0.8 * dt); p.vy *= Math.exp(-0.4 * dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      this.dust = this.dust.filter((p) => p.age < p.life && p.y > -10);
      if (Math.random() < dt * (1.6 + this.energy * 4)) {
        const side = Math.floor(rand(0, 4)), u = Math.random();
        const gx = side < 2 ? f.x + u * f.w : f.x + (side === 2 ? 0.04 : 0.96) * f.w;
        const gy = side < 2 ? f.y + (side === 0 ? 0.03 : 0.97) * f.h : f.y + u * f.h;
        this.glints.push({ x: gx, y: gy, age: 0, life: rand(0.35, 0.7), r: rand(4, 8) });
      }
      for (const s of this.glints) s.age += dt;
      this.glints = this.glints.filter((s) => s.age < s.life);
    }
  }

  settle() {
    this.gas = []; this.dust = []; this.glints = [];
    for (let i = 0; i < 240; i++) this.step(1 / 40);
    this.draw();
  }

  // Static parts painted once while on screen, drawn per frame as one image at the light's strength
  statics() {
    if (this.cache) return this.cache;
    const f = this.win, floor = this.floor;
    const paint = (fn) => {
      const c = document.createElement("canvas");
      c.width = this.c.width; c.height = this.c.height;
      const x = c.getContext("2d");
      x.setTransform(DPR, 0, 0, DPR, 0, 0);
      fn(x);
      return c;
    };
    this.cache = {};
    // The portraits' shapes (their own alpha; a box until an image loads), cut out of what's behind them
    this.cache.mask = paint((x) => {
      for (const o of this.frames) if (o.img.complete && o.img.naturalWidth) x.drawImage(o.img, o.x, o.y, o.w, o.h); else x.fillRect(o.x, o.y, o.w, o.h);
    });
    if (f) {
      this.cache.glow = paint((x) => {
        x.globalCompositeOperation = "lighter";
        const R = f.h * 1.3;
        let gr = x.createRadialGradient(f.cx, f.cy, f.w * 0.35, f.cx, f.cy, R);
        gr.addColorStop(0, "rgba(255,222,140,.95)");
        gr.addColorStop(0.4, "rgba(255,176,64,.42)");
        gr.addColorStop(1, "rgba(255,140,40,0)");
        x.fillStyle = gr;
        x.fillRect(f.cx - R, f.cy - R, R * 2, R * 2);
        x.translate(f.cx, floor);
        x.scale(1, 0.16);
        gr = x.createRadialGradient(0, 0, 0, 0, 0, f.w * 1.5);
        gr.addColorStop(0, "rgba(255,200,100,.55)");
        gr.addColorStop(1, "rgba(255,160,60,0)");
        x.fillStyle = gr;
        x.fillRect(-f.w * 1.5, -f.w * 1.5, f.w * 3, f.w * 3);
      });
      this.cache.shade = paint((x) => {
        for (const o of this.frames) {
          if (o === f) continue;
          const dir = Math.sign(o.cx - f.cx), near = clamp(1.25 - Math.abs(o.cx - f.cx) / (f.w * 4), 0.15, 1);
          const len = o.w * (0.5 + near * 0.9), x0 = dir > 0 ? o.x + o.w * 0.15 : o.x + o.w * 0.85;
          const sg = x.createLinearGradient(x0, 0, x0 + dir * (o.w * 0.7 + len), 0);
          sg.addColorStop(0, `rgba(0,0,0,${0.55 * near})`);
          sg.addColorStop(1, "rgba(0,0,0,0)");
          x.fillStyle = sg;
          x.beginPath();
          x.moveTo(o.x + o.w * 0.1, floor - 3);
          x.lineTo(o.x + o.w * 0.9, floor - 3);
          x.lineTo(o.x + o.w * 0.9 + dir * len, floor + 9);
          x.lineTo(o.x + o.w * 0.1 + dir * len, floor + 9);
          x.closePath();
          x.fill();
        }
      });
      this.cache.bounce = paint((x) => {
        const gr = x.createRadialGradient(f.cx, f.cy, f.w * 0.3, f.cx, f.cy, f.w * 2.8);
        gr.addColorStop(0, `rgba(255,190,90,${0.22 * 1.5})`);
        gr.addColorStop(0.4, `rgba(255,160,60,${0.12 * 1.5})`);
        gr.addColorStop(1, "rgba(255,140,40,0)");
        x.fillStyle = gr;
        x.fillRect(0, 0, this.w, this.h);
      });
    }
    if (this.losers.length) this.cache.murk = paint((x) => {
      x.globalCompositeOperation = "lighter";
      for (const l of this.losers) {
        const gr = x.createRadialGradient(l.cx, l.cy, l.w * 0.2, l.cx, l.cy, l.h);
        gr.addColorStop(0, "rgba(118,128,62,.35)");
        gr.addColorStop(1, "rgba(90,100,45,0)");
        x.fillStyle = gr;
        x.fillRect(l.cx - l.h, l.cy - l.h, l.h * 2, l.h * 2);
      }
    });
    return this.cache;
  }

  draw() {
    if (!this.w) return;
    const x = this.x;
    x.setTransform(DPR, 0, 0, DPR, 0, 0); x.clearRect(0, 0, this.w, this.h);
    const t = this.t, f = this.win;
    const st = this.statics(), put = (x, img, a) => { x.globalAlpha = a; x.drawImage(img, 0, 0, this.w, this.h); };
    const I = 0.82 + 0.1 * Math.sin(t * 1.4) + 0.05 * Math.sin(t * 3.7 + 1.2) + this.energy * 0.35;

    // Behind the portraits
    if (f) {
      x.globalCompositeOperation = "lighter";
      for (let k = I; k > 0.001; k--) put(x, st.glow, Math.min(1, k));
      x.globalAlpha = 1;
      const R = f.h * 1.3;
      const rays = 18, spin = t * 0.07;
      for (let i = 0; i < rays; i++) {
        const a = spin + (i * TAU) / rays + Math.sin(t * 0.5 + i * 1.7) * 0.06;
        const len = R * (1.35 + 0.35 * Math.sin(t * 0.9 + i * 2.3));
        const half = 0.035 + 0.025 * Math.sin(t * 0.7 + i);
        const alpha = (0.13 + 0.09 * Math.sin(t * 1.1 + i * 2.1)) * I;
        const rg = x.createRadialGradient(f.cx, f.cy, 0, f.cx, f.cy, len);
        rg.addColorStop(0, `rgba(255,226,150,${alpha})`);
        rg.addColorStop(1, "rgba(255,200,100,0)");
        x.fillStyle = rg;
        x.beginPath();
        x.moveTo(f.cx, f.cy);
        x.arc(f.cx, f.cy, len, a - half, a + half);
        x.closePath();
        x.fill();
      }
      x.globalCompositeOperation = "source-over";
      put(x, st.shade, 1);
    }
    if (st.murk) {
      x.globalCompositeOperation = "lighter";
      put(x, st.murk, (0.3 + 0.05 * Math.sin(t * 1.1)) / 0.35);
      x.globalCompositeOperation = "source-over";
    }
    const puffs = sprites().gas, alive = [];
    for (const p of this.gas) {
      const life = p.age / p.life;
      const a = p.a * Math.min(1, p.age / 0.9) * (life > 0.65 ? (1 - life) / 0.35 : 1);
      if (a <= 0.005) continue;
      const s = p.s0 * (1 + life * 0.9), low = p.low || 0;
      const sw = s * (1 + 0.8 * low), sh = s * (1 - 0.45 * low);
      x.globalAlpha = Math.min(0.5, a * (1 + 0.9 * low));
      x.drawImage(puffs[p.spr], p.x - sw / 2, p.y - sh / 2, sw, sh);
      if (low > 0.5) alive.push([p, a * 0.28 * low, sw, sh]);
    }
    x.globalCompositeOperation = "destination-out";
    put(x, st.mask, 1);
    x.globalCompositeOperation = "source-over";

    // In front of them
    if (f) {
      // Bounce light; screened it never dimmed whites, so only a third of it falls on the portraits
      put(x, st.bounce, Math.min(1, I / 1.5));
      x.globalCompositeOperation = "destination-out";
      put(x, st.mask, 0.65);
      x.globalCompositeOperation = "source-over";
      // No rim light: it traced the box, and read as a greenish band over the gold
      const { dust, spark } = sprites();
      for (const p of this.dust) {
        const life = p.age / p.life, fade = Math.min(1, p.age * 3) * (1 - life);
        const a = fade * (0.55 + 0.45 * Math.sin(p.age * p.tw + p.seed)) * Math.min(1.3, I);
        if (a <= 0.02) continue;
        const s = p.r * 7;
        x.globalAlpha = a;
        x.drawImage(dust, p.x - s / 2, p.y - s / 2, s, s);
      }
      for (const s of this.glints) {
        const k = Math.sin((s.age / s.life) * Math.PI), r = s.r * (0.6 + k);
        x.globalAlpha = k;
        x.drawImage(spark, s.x - r * 1.5, s.y - r * 1.5, r * 3, r * 3);
        x.strokeStyle = "rgba(255,250,225,.9)";
        x.lineWidth = 0.8;
        x.beginPath();
        x.moveTo(s.x - r * 1.6, s.y); x.lineTo(s.x + r * 1.6, s.y);
        x.moveTo(s.x, s.y - r * 1.6); x.lineTo(s.x, s.y + r * 1.6);
        x.stroke();
      }
    }
    // The low bank's veil, round the foot of the portraits
    for (const [p, a, sw, sh] of alive) {
      x.globalAlpha = a;
      x.drawImage(puffs[p.spr], p.x - sw / 2, p.y - sh / 2, sw, sh);
    }
    x.globalAlpha = 1;
  }
}

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const s = e.target.__fx;
    if (!s) continue;
    if (e.isIntersecting) visible.add(s);
    else if (visible.delete(s) && !REDUCED) s.reset();
  }
  wake();
}, { rootMargin: "80px" });

function frame(now) {
  raf = 0;
  if (document.hidden || !visible.size) return;
  const dt = Math.min(0.05, (now - (then || now)) / 1000);
  then = now;
  const dy = clamp(scrollDY, -90, 90);
  scrollDY = 0;
  for (const s of visible) {
    if (!s.pod.isConnected) { visible.delete(s); continue; }
    if (dy) s.impulse(dy);
    s.step(dt);
    s.draw();
  }
  raf = requestAnimationFrame(frame);
}
function wake() {
  if (REDUCED || raf || document.hidden || !visible.size) return;
  then = 0;
  raf = requestAnimationFrame(frame);
}

if (!REDUCED) {
  addEventListener("scroll", () => { scrollDY += scrollY - lastY; lastY = scrollY; }, { passive: true });
  document.addEventListener("visibilitychange", wake);
}

export function mountPodiumFx(root) {
  for (const s of scenes) if (!s.pod.isConnected) { io.unobserve(s.pod); scenes.delete(s); visible.delete(s); }
  for (const pod of root.querySelectorAll(".pod, .fx-stage")) {
    if (pod.__fx || !pod.querySelector(".pod-col.win, .pod-col.last")) continue;
    const s = new Scene(pod);
    scenes.add(s);
    io.observe(pod);
  }
}
