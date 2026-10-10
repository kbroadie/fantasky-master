// Edit mode (tap all seven footer ducks). Changes are ops replayed onto the page's copy at once, and on Save onto a fresh copy from GitHub (Contents API), checked with checks.js first. The token lives only in this browser's localStorage: the ducks are the door, the token the lock.
import { $, esc, framed, icon, TASK_NAME, state } from "./ui.js";
import { parseRows, toCSV, parseCSV } from "./csv.js";
import { checkData } from "./checks.js";
import { apply } from "./ops.js";

const REPO = "kbroadie/fantasky-master", BRANCH = "main", PATH = "data/fantasky_master_data.csv";
const FILE_API = `https://api.github.com/repos/${REPO}/contents/${PATH}`;
const KEY = "fm-gh-key";

let base = "", ops = [], onData = () => {};
const drafts = {}; // tables being typed in (Episodes), by "series/ep"

const store = {
  get: () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } },
  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* private mode: key lasts the visit */ } },
};
let memKey = "";
const token = () => store.get() || memKey;

const replay = (text) => { const rows = parseRows(text); for (const op of ops) apply(rows, op); return toCSV(rows); };

function addOp(op) {
  const same = (o) => o.kind === op.kind && o.s === op.s && o.ep === op.ep && (op.kind !== "pick" || o.player === op.player);
  ops = ops.filter((o) => !same(o)).concat(op);
  onData(replay(base));
  status();
}

const gh = (url, opts = {}) => fetch(url, {
  ...opts, cache: "no-store",
  headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token()}`, "X-GitHub-Api-Version": "2022-11-28", ...opts.headers },
});

function b64encode(s) {
  const b = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(bin);
}
const b64decode = (s) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

async function getFile() {
  const res = await gh(`${FILE_API}?ref=${BRANCH}`);
  if (res.status === 401) throw new Error("GitHub didn't accept the key. It may have expired; tap Key to paste a new one.");
  if (res.status === 404) throw new Error(`The key can't see ${REPO}. Give it access to that repository.`);
  if (!res.ok) throw new Error(`GitHub said ${res.status}`);
  const j = await res.json();
  return { sha: j.sha, text: b64decode(j.content) };
}

function message() {
  const picks = ops.filter((o) => o.kind === "pick"), scores = ops.filter((o) => o.kind === "scores");
  const lines = [
    ...scores.map((o) => `Scores: Series ${o.s} Ep ${o.ep}${o.src ? ` (${o.src})` : ""}`),
    ...ops.filter((o) => o.kind === "title").map((o) => `Title: Series ${o.s} Ep ${o.ep}: ${o.title}`),
    ...[...new Set(picks.map((o) => `${o.s}/${o.ep}`))].map((k) => {
      const [s, ep] = k.split("/"), these = picks.filter((o) => `${o.s}/${o.ep}` === k);
      return `Picks: Series ${s} Ep ${ep} (${these.map((o) => `${o.player}: ${o.c || "none"}`).join(", ")})`;
    }),
  ];
  return `${lines.length > 1 ? `${lines.length} edits from edit mode` : lines[0]}\n\n${lines.join("\n")}\n\nSaved from the app's edit mode.`;
}

async function save() {
  if (!commitAll() || !ops.length) return; // a table still being typed in is applied first
  status("Saving…", "busy");
  try {
    for (let attempt = 0; ; attempt++) {
      const { sha, text } = await getFile();
      const out = replay(text);
      const { errors, warnings } = checkData(parseCSV(out));
      if (errors.length) throw new Error(`Not saved: ${errors.slice(0, 3).join(" · ")}`);
      if (warnings.length && attempt === 0 && !confirm(`${warnings.join("\n")}\n\nSave anyway?`)) { status(); return; }
      const res = await gh(FILE_API, { method: "PUT", body: JSON.stringify({ message: message(), content: b64encode(out), sha, branch: BRANCH }) });
      // Someone else saved in between: start again from their copy.
      if ((res.status === 409 || res.status === 422) && attempt < 2) continue;
      if (res.status === 403 || res.status === 404) throw new Error("The key can read but not save. Give it Contents: Read and write.");
      if (!res.ok) throw new Error(`GitHub said ${res.status}${res.status === 422 ? " (the file changed; try again)" : ""}`);
      base = out;
      ops = [];
      onData(base);
      status("Saved. Live for everyone in about a minute.", "ok");
      return;
    }
  } catch (e) {
    status(e.message, "bad");
  }
}

let lit = 0, litTimer = 0;
function duck(dk) {
  if (state.edit || dk.classList.contains("lit")) return;
  dk.classList.add("lit");
  lit++;
  clearTimeout(litTimer);
  const all = () => document.querySelectorAll("#foot .dk.lit").forEach((x) => x.classList.remove("lit"));
  if (lit >= 7) { lit = 0; setTimeout(() => { all(); open(); }, 250); return; }
  // Leave it half done and they go out again.
  litTimer = setTimeout(() => { lit = 0; all(); }, 4000);
}

function open() {
  if (token()) return start();
  keyDialog();
}

function keyDialog() {
  let dlg = $("#ed-key");
  if (!dlg) {
    document.body.insertAdjacentHTML("beforeend", `
      <dialog id="ed-key" class="ed-dialog">
        <form method="dialog">
          <h2>Edit mode</h2>
          <p>Saving writes picks and scores into the league's data on GitHub. Paste a GitHub key that can edit it. It stays in this browser and is never part of the site.</p>
          <ol>
            <li>On GitHub, open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">a new fine-grained token</a>.</li>
            <li>Repository access: <b>Only select repositories</b>, then <b>fantasky-master</b>.</li>
            <li>Permissions: <b>Contents</b>, <b>Read and write</b>.</li>
            <li>Generate it, copy it and paste it here.</li>
          </ol>
          <input id="ed-key-in" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" aria-label="GitHub key">
          <p class="ed-msg" id="ed-key-msg"></p>
          <div class="ed-actions">
            <button type="button" class="ed-btn" data-ed="forget">Forget key</button>
            <span></span>
            <button type="button" class="ed-btn" value="cancel" data-ed="cancel">Cancel</button>
            <button type="submit" class="ed-btn gold" data-ed="use">Start editing</button>
          </div>
        </form>
      </dialog>`);
    dlg = $("#ed-key");
    dlg.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-ed]");
      if (!b) return;
      if (b.dataset.ed === "cancel") return dlg.close();
      if (b.dataset.ed === "forget") { store.set(""); memKey = ""; $("#ed-key-in").value = ""; $("#ed-key-msg").textContent = "Key forgotten on this device."; b.hidden = true; return; }
      if (b.dataset.ed === "use") {
        e.preventDefault();
        const v = $("#ed-key-in").value.trim(), msg = $("#ed-key-msg");
        if (!v) { msg.textContent = "Paste the key first."; return; }
        const prev = memKey;
        memKey = v;
        msg.textContent = "Checking…";
        try {
          if (store.get() !== v) store.set("");
          await getFile();
          store.set(v);
          dlg.close();
          start();
        } catch (err) { memKey = prev; msg.textContent = err.message; }
      }
    });
  }
  $("#ed-key-in").value = "";
  $("#ed-key-msg").textContent = "";
  dlg.querySelector('[data-ed="forget"]').hidden = !token();
  dlg.showModal();
}

function start() {
  if (state.edit) return;
  state.edit = true;
  document.body.classList.add("editing");
  if (!$("#ed-bar")) {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="ed-bar" id="ed-bar" role="region" aria-label="Edit mode">
        <span class="ed-status" id="ed-status" aria-live="polite"></span>
        <button type="button" class="ed-btn" data-ed="key">Key</button>

        <button type="button" class="ed-btn gold" data-ed="save">Save</button>
        <button type="button" class="ed-btn" data-ed="done">Done</button>
      </div>`);
    $("#ed-bar").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ed]")?.dataset.ed;
      if (b === "save") save();
      if (b === "key") keyDialog();
      if (b === "done") stop();
    });
  }
  status();
  onData(replay(base));
}

function stop() {
  const n = ops.length + dirtyCount();
  if (n && !confirm(`Discard ${n} unsaved change${n > 1 ? "s" : ""}?`)) return;
  ops = [];
  for (const k of Object.keys(drafts)) delete drafts[k];
  for (const k of Object.keys(notes)) delete notes[k];
  state.edit = false;
  document.body.classList.remove("editing");
  onData(base);
}

function status(text, kind = "") {
  const el = $("#ed-status");
  if (!el) return;
  const n = ops.length + dirtyCount();
  el.textContent = text || (n ? `${n} unsaved change${n > 1 ? "s" : ""}` : "Edit mode · all saved");
  el.className = `ed-status ${kind}`;
  $('#ed-bar [data-ed="save"]').disabled = !n || kind === "busy";
}

export function pickChooser(d, p, w) {
  const cur = p.weeks[w - 1]?.pick ?? null;
  const opts = d.names.map((n) => `<button type="button" class="pk${cur === n ? " on" : ""}" data-pick="${esc(n)}" aria-pressed="${cur === n}">${framed(d.cast[n])}<b style="color:${d.cast[n].color}">${esc(n)}</b></button>`).join("");
  return `<div class="pk-edit" data-player="${esc(p.name)}" data-week="${w}">
    <p class="pk-edit-h">Ep ${w} pick</p>
    <div class="pk-choose">${opts}<button type="button" class="pk pk-none${cur == null ? " on" : ""}" data-pick="" aria-pressed="${cur == null}"><span class="pk-blank">–</span><b>None</b></button></div>
  </div>`;
}

// Episodes are edited in place; typing goes to a draft applied on leaving the table, so the page never redraws under the keyboard.

const draftKey = (ep) => `${state.key}/${ep}`;
const notes = {}; // the wiki button's last message, by "series/ep"
const TYPE_ORDER = ["P", "F", "T", "L"];

function current(d, ep) {
  const e = d.episodes[ep - 1];
  return {
    tb: e.tb || "",
    tasks: d.epTasks(ep).map((t) => ({ t: t.t, name: t.n, scores: Object.fromEntries(d.names.map((n, i) => [n, t.dq?.[i] ? "DQ" : t.s[i]])) })),
  };
}
const blankTask = (d) => ({ t: "F", name: "", scores: Object.fromEntries(d.names.map((n) => [n, ""])) });
/** The draft, made on first use from the data (five blank tasks for an episode with no scores yet). */
function draftFor(d, ep) {
  const k = draftKey(ep);
  if (!drafts[k]) {
    drafts[k] = current(d, ep);
    if (!drafts[k].tasks.length) drafts[k].tasks = Array.from({ length: 5 }, () => blankTask(d));
  }
  return drafts[k];
}
const dirtyCount = () => Object.values(drafts).filter((x) => x.dirty).length;

export function edTitle(e) {
  return `<input class="ep-title ed-title" data-f="title" data-ep="${e.ep}" data-fk="t${e.ep}" value="${esc(e.title || "")}" placeholder="Episode ${e.ep}" aria-label="Episode ${e.ep} title" enterkeyhint="done" autocomplete="off">`;
}

export function edStrip(d, e) {
  const aired = e.ep <= Math.max(d.weeksAired, d.weeksScored), note = notes[draftKey(e.ep)];
  return `<div class="ed-strip" data-ep="${e.ep}">
    <button type="button" class="ed-btn" data-ed="wiki">${aired ? "Get scores from the wiki" : "Get title from the wiki"}</button>
    ${note ? `<p class="ed-note${note.bad ? " bad" : ""}">${esc(note.text)}</p>` : ""}
  </div>`;
}

export function edTable(d, e, order) {
  const dr = drafts[draftKey(e.ep)] || (e.ep <= d.weeksScored ? current(d, e.ep) : draftFor(d, e.ep));
  const num = (v) => (/^\d+$/.test(String(v).trim()) ? +v : 0);
  const rows = dr.tasks.map((t, i) => `<tr data-i="${i}">
      <td><span class="tn"><button type="button" class="ed-type" data-ed="type" aria-label="${TASK_NAME[t.t]} task: tap to change">${icon(t.t)}</button><input class="ed-tname" data-f="name" data-fk="n${e.ep}-${i}" value="${esc(t.name)}" placeholder="Task name" aria-label="Task ${i + 1} name" autocomplete="off"></span></td>
      ${order.map((n) => `<td class="sc"><input class="ed-sc" data-f="s" data-who="${esc(n)}" data-fk="c${e.ep}-${i}-${esc(n)}" value="${esc(t.scores[n] ?? "")}" maxlength="2" autocapitalize="characters" autocomplete="off" aria-label="${esc(n)}, task ${i + 1}"></td>`).join("")}
    </tr>`).join("");
  const tot = order.map((n) => `<td data-tot="${esc(n)}">${dr.tasks.reduce((a, t) => a + num(t.scores[n] ?? ""), 0)}</td>`).join("");
  const opt = (v, label) => `<option value="${esc(v)}"${dr.tb === v ? " selected" : ""}>${esc(label)}</option>`;
  return `
    <div class="card tt-wrap ed-tt" data-ep="${e.ep}" data-order="${esc(order.join("|"))}">
      <table class="tt">
        <thead><tr><th>Task</th>${order.map((n) => `<th style="color:${d.cast[n].color}">${esc(n.slice(0, 3))}</th>`).join("")}</tr></thead>
        <tbody>${rows}<tr class="tot"><td>Total</td>${tot}</tr></tbody>
      </table>
      <div class="ed-tfoot">
        <button type="button" class="ed-btn" data-ed="add">+ Task</button>
        <label class="ed-tb"><span>Tiebreak</span><select data-f="tb" data-fk="b${e.ep}">${opt("", "None")}${order.map((n) => opt(n, n)).join("")}</select></label>
      </div>
      <p class="ed-hint">Scores are whole numbers, or DQ for a disqualification. Clear a task's name and scores to remove it.</p>
    </div>`;
}

function readTable(card) {
  const d = state.d, ep = +card.dataset.ep, dr = draftFor(d, ep);
  card.querySelectorAll("tbody tr[data-i]").forEach((tr) => {
    const t = dr.tasks[+tr.dataset.i];
    t.name = tr.querySelector('[data-f="name"]').value;
    for (const inp of tr.querySelectorAll('[data-f="s"]')) t.scores[inp.dataset.who] = inp.value.trim().toUpperCase();
  });
  dr.tb = card.querySelector('[data-f="tb"]').value;
  dr.dirty = true;
  for (const td of card.querySelectorAll("[data-tot]")) {
    td.textContent = dr.tasks.reduce((a, t) => a + (/^\d+$/.test(t.scores[td.dataset.tot] ?? "") ? +t.scores[td.dataset.tot] : 0), 0);
  }
  status();
  return dr;
}

/**
 * Apply a table's draft as a change (the page redraws with it). Empty tasks
 * are dropped; if a task has no name or a score isn't 0–10 or DQ, the boxes
 * are marked and nothing is applied. Returns false then.
 */
function commit(ep) {
  const k = draftKey(ep), dr = drafts[k], d = state.d;
  if (!dr?.dirty) return true;
  const card = $(`#ep-body .ed-tt[data-ep="${ep}"]`);
  card?.querySelectorAll(".bad").forEach((x) => x.classList.remove("bad"));
  const filled = (t) => t.name.trim() || d.names.some((n) => String(t.scores[n] ?? "").trim());
const ok = (v) => /^(-1|\d{1,2}|DQ)$/i.test(String(v ?? "").trim()) && !(+v > 10) && !(+v < -1);
  let bad = 0;
  dr.tasks.forEach((t, i) => {
    if (!filled(t)) return;
    const tr = card?.querySelector(`tr[data-i="${i}"]`);
    if (!t.name.trim()) { tr?.querySelector('[data-f="name"]').classList.add("bad"); bad++; }
    for (const n of d.names) if (!ok(t.scores[n])) { tr?.querySelector(`[data-who="${CSS.escape(n)}"]`)?.classList.add("bad"); bad++; }
  });
  if (bad) { status("Fix the marked boxes: every task needs a name, and every score is -1–10 or DQ.", "bad"); return false; }
  const tasks = dr.tasks.filter(filled);
  delete drafts[k];
  if (!tasks.length && !d.epTasks(ep).length) { status(); return true; } // nothing entered
  addOp({
    kind: "scores", s: state.key, ep, cast: d.names, tb: dr.tb, src: dr.src || "",
    tasks: tasks.map((t) => ({ t: t.t, name: t.name.trim(), scores: d.names.map((n) => String(t.scores[n]).trim().toUpperCase()) })),
  });
  return true;
}
const commitAll = () => Object.keys(drafts).filter((k) => drafts[k].dirty && k.startsWith(`${state.key}/`)).every((k) => commit(+k.split("/")[1]));

function setTitle(ep, value) {
  const title = value.trim() || `Episode ${ep}`;
  if (title === (state.d.episodes[ep - 1].title || `Episode ${ep}`)) return;
  addOp({ kind: "title", s: state.key, ep, title });
}

async function fromWiki(ep) {
  const d = state.d, k = draftKey(ep), aired = ep <= Math.max(d.weeksAired, d.weeksScored);
  const say = (text, bad = false) => { notes[k] = text ? { text, bad } : null; const el = $(`#ep-body .ed-strip[data-ep="${ep}"]`); if (el) el.outerHTML = edStrip(d, d.episodes[ep - 1]); };
  say("Asking the wiki…");
  try {
    const wiki = await import("./wiki.js");
    if (!aired) {
      const title = await wiki.fetchTitle(state.key, ep);
      say(`Title from the wiki: ${title}`);
      return setTitle(ep, title);
    }
    const w = await wiki.fetchEpisode(state.key, ep, d.names.map((n) => ({ key: n, full: d.cast[n].full })));
    const now = current(d, ep);
    // Keep the names already in the data file, and its DQs (the wiki often shows a DQ as 0).
    drafts[k] = {
      src: "Taskmaster Wiki", tb: w.tiebreak, dirty: true,
      tasks: w.tasks.map((t, i) => {
        const had = now.tasks[i];
        return { t: t.t, name: had && had.t === t.t ? had.name : t.name,
          scores: Object.fromEntries(d.names.map((n, j) => [n, t.scores[j] === 0 && had?.scores[n] === "DQ" ? "DQ" : t.scores[j] ?? ""])) };
      }),
    };
    say(["Scores from the wiki. Check them and mark any DQs.", ...w.warnings].join(" "));
    const cur = d.episodes[ep - 1].title;
    if (!cur || /^Episode \d+$/.test(cur)) setTitle(ep, w.title);
    const card = $(`#ep-body .ed-tt[data-ep="${ep}"]`);
    if (card) card.outerHTML = edTable(d, d.episodes[ep - 1], card.dataset.order.split("|"));
    commit(ep);
  } catch (err) { say(err.message, true); }
}

// onChange(text): re-render the page from this text
export function initEdit(text, onChange) {
  base = text;
  onData = onChange;

  $("#foot").addEventListener("click", (e) => { const dk = e.target.closest(".dk"); if (dk) duck(dk); });

  $("#p-standings").addEventListener("click", (e) => {
    const b = e.target.closest(".pk-edit [data-pick]");
    if (!b || !state.edit) return;
    const box = b.closest(".pk-edit");
    addOp({ kind: "pick", s: state.key, ep: +box.dataset.week, player: box.dataset.player, c: b.dataset.pick || null });
  });

  const eps = $("#ep-body");
  eps.addEventListener("input", (e) => { const card = e.target.closest(".ed-tt"); if (card && state.edit) readTable(card); });
  // Leaving the table applies it (after focus has moved, so the page can put it back).
  eps.addEventListener("focusout", (e) => {
    const card = e.target.closest(".ed-tt");
    if (!card || !state.edit) return;
    setTimeout(() => { if (!card.isConnected || !card.contains(document.activeElement)) commit(+card.dataset.ep); });
  });
  eps.addEventListener("change", (e) => {
    if (!state.edit) return;
    if (e.target.matches(".ed-title")) setTitle(+e.target.dataset.ep, e.target.value);
    if (e.target.matches('.ed-tt [data-f="tb"]')) { readTable(e.target.closest(".ed-tt")); commit(+e.target.closest(".ed-tt").dataset.ep); }
  });
  eps.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches(".ed-title")) e.target.blur(); });
  eps.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ed]");
    if (!b || !state.edit) return;
    const ep = +b.closest("[data-ep]").dataset.ep, d = state.d;
    if (b.dataset.ed === "wiki") return fromWiki(ep);
    const card = b.closest(".ed-tt"), dr = readTable(card);
    if (b.dataset.ed === "type") {
      const t = dr.tasks[+b.closest("tr").dataset.i];
      t.t = TYPE_ORDER[(TYPE_ORDER.indexOf(t.t) + 1) % 4];
      b.innerHTML = icon(t.t);
      b.setAttribute("aria-label", `${TASK_NAME[t.t]} task: tap to change`);
      return;
    }
    if (b.dataset.ed === "add") {
      dr.tasks.push(blankTask(d));
      card.outerHTML = edTable(d, d.episodes[ep - 1], card.dataset.order.split("|"));
      $(`#ep-body [data-fk="n${ep}-${dr.tasks.length - 1}"]`)?.focus();
    }
  });
}
