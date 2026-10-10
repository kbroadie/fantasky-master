// The benchmark (the frame rate panel's button): scripted interactions at three speeds, every frame timed.
// Scrolling is driven from script, so it measures what scrolling costs to draw, not the phone's own scrolling
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise(requestAnimationFrame);
const SPEEDS = ["slow", "medium", "fast"];
let running = null;

const mode = () => (document.documentElement.classList.contains("fz") ? "rainbow" : "normal");
const doc = document.scrollingElement;
const room = () => doc.scrollHeight - doc.clientHeight;
const toReaderTop = () => { doc.scrollTop = 0; };
const scrollOn = (d) => { doc.scrollTop += d; };

async function scrollAt(pxs) {
  toReaderTop();
  await sleep(200);
  const span = Math.min(1600, room());
  for (const dir of [1, -1]) {
    let done = 0, last = performance.now();
    while (done < span && !running.stop) {
      const t = await frame(), d = Math.min(span - done, (pxs * (t - last)) / 1000);
      last = t; done += d; scrollOn(dir * d);
    }
  }
}
async function swipe(sel, ms) {
  const body = $(sel), w = body.clientWidth, i = Math.round(body.scrollLeft / w), j = i > 0 ? i - 1 : i + 1;
  body.style.scrollSnapType = "none";
  for (const [a, b] of [[i, j], [j, i], [i, j], [j, i]]) {
    const t0 = performance.now();
    for (let k = 0; k < 1 && !running.stop;) {
      const t = await frame();
      k = Math.min(1, (t - t0) / ms);
      body.scrollLeft = (a + (b - a) * (1 - (1 - k) ** 3)) * w;
    }
    await sleep(120);
  }
  body.style.scrollSnapType = "";
}
// Tap something on, then off again, a few times, `gap` ms apart
async function toggles(pick, gap, times = 3) {
  toReaderTop();
  await sleep(150);
  for (let k = 0; k < times && !running.stop; k++) {
    const el = pick(k);
    if (!el) break;
    el.click(); await sleep(gap);
    pick(k)?.click(); await sleep(gap);
  }
}
const here = (q) => $$(`#st-body .slide.here ${q}`);
const tab = (page) => $(`.tab[data-page="${page}"]`)?.click();

const scrollPx = { slow: 400, medium: 1200, fast: 3000 }, swipeMs = { slow: 600, medium: 300, fast: 150 }, gapMs = { slow: 900, medium: 450, fast: 200 };
const TESTS = [
  ["standings", "scroll", (s) => scrollAt(scrollPx[s])],
  ["standings", "swipe weeks", (s) => swipe("#st-body", swipeMs[s])],
  ["standings", "open rows", (s) => toggles((k) => here(".pc .sd.l")[k * 2], gapMs[s])],
  ["standings", "race charts", (s) => toggles((k) => here(`.st-side[data-board="${k % 2 ? "league" : "show"}"]`)[0], gapMs[s])],
  ["standings", "how scoring works", (s) => toggles(() => here(".st-how")[0], gapMs[s], 2)],
  ["episodes", "scroll", (s) => scrollAt(scrollPx[s])],
  ["episodes", "swipe", (s) => swipe("#ep-body", swipeMs[s])],
  ["cast", "scroll", (s) => scrollAt(scrollPx[s])],
  ["cast", "swipe", (s) => swipe("#cast-body", swipeMs[s])],
  ["tabs", "switch", async (s) => { for (const p of ["episodes", "cast", "standings", "cast", "episodes", "standings"]) { if (running.stop) break; tab(p); await sleep(gapMs[s]); } }],
];

async function measure(fn) {
  const gaps = [];
  let last = 0, on = true;
  const loop = (t) => { if (last) gaps.push(t - last); last = t; if (on) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const t0 = performance.now();
  await fn();
  await frame();
  on = false;
  const ms = performance.now() - t0, slow = gaps.filter((g) => g > 25).length;
  return { fps: Math.round((gaps.length * 1000) / ms), slow: gaps.length ? Math.round((100 * slow) / gaps.length) : 0, worst: Math.round(Math.max(0, ...gaps)) };
}

export async function run(button) {
  if (running) { running.stop = true; return; }
  running = { stop: false };
  const startPage = $(".tab[aria-selected=true]")?.dataset.page || "standings", startHash = location.hash, out = [];
  const total = TESTS.length * SPEEDS.length;
  let page = null, n = 0;
  for (const [pg, name, fn] of TESTS) {
    if (pg !== page && pg !== "tabs") { tab(pg); page = pg; await sleep(700); }
    for (const s of SPEEDS) {
      if (running.stop) break;
      button.textContent = `Stop · ${++n}/${total}`;
      out.push({ test: `${pg} · ${name}`, speed: s, ...(await measure(() => fn(s))) });
      await sleep(250);
    }
  }
  tab(startPage);
  await sleep(300);
  if (location.hash !== startHash) location.hash = startHash;
  button.textContent = "Benchmark";
  const stopped = running.stop;
  running = null;
  report(out, stopped);
}

function report(rows, stopped) {
  const head = [`Fantasky Master benchmark${stopped ? " (stopped early)" : ""}`, `${new Date().toLocaleString()} · ${mode()}`,
    `${innerWidth}×${innerHeight} @${devicePixelRatio}x · ${navigator.userAgent.replace(/^Mozilla\/5\.0 /, "")}`];
  const text = [...head, "", "test · speed: fps, slow frames (>25ms), worst frame",
    ...rows.map((r) => `${r.test} · ${r.speed}: ${r.fps} fps, ${r.slow}% slow, worst ${r.worst} ms`)].join("\n");
  const cls = (r) => (r.slow > 15 || r.worst > 100 ? "bad" : r.slow > 5 || r.worst > 50 ? "meh" : "ok");
  let dlg = $("#bench-dlg");
  dlg?.remove();
  document.body.insertAdjacentHTML("beforeend", `
    <dialog id="bench-dlg" class="ed-dialog bench-dlg">
      <form method="dialog">
        <h2>Benchmark</h2>
        <p>${head.slice(0, 2).join("<br>")}</p>
        <table class="bench-t">
          <thead><tr><th>Test</th><th>fps</th><th>slow</th><th>worst</th></tr></thead>
          <tbody>${rows.map((r) => `<tr class="${cls(r)}"><td>${r.test}<small>${r.speed}</small></td><td>${r.fps}</td><td>${r.slow}%</td><td>${r.worst} ms</td></tr>`).join("")}</tbody>
        </table>
        <p class="ed-msg" id="bench-msg"></p>
        <div class="ed-actions"><span></span><button type="button" class="ed-btn" id="bench-copy">Copy</button><button class="ed-btn gold" value="done">Done</button></div>
      </form>
    </dialog>`);
  dlg = $("#bench-dlg");
  $("#bench-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(text); $("#bench-msg").textContent = "Copied."; } catch { $("#bench-msg").textContent = "Couldn't copy here."; }
  });
  dlg.showModal();
}
