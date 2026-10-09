// Reads an episode's scores from the Taskmaster Wiki (taskmaster.fandom.com),
// through its public MediaWiki API, which allows reads from any page
// (origin=*). Used by edit mode to fill in the scores grid for checking.
//
// The series page lists its episodes ("Episode 5: … {{:You're nice.}}"), and
// each episode page has a scores table (class "tmtable"): a row per task with
// its link ("[[Task page|4]]", "T" for the tiebreak), the description (which
// starts '''Prize:''', '''Team:''' or '''Live:''' for those tasks) and one cell
// per contestant. A task split into parts ("do either the buggy, bounce or
// beans task") has a parent row spanning a sub-row per part.

const API = "https://taskmaster.fandom.com/api.php";

async function wikitext(page) {
  const url = `${API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&redirects=1&format=json&formatversion=2&origin=*`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`The wiki didn't answer (${res.status})`);
  const j = await res.json();
  if (j.error) throw new Error(j.error.code === "missingtitle" ? `The wiki has no page called "${page}"` : j.error.info);
  return j.parse.wikitext;
}

/** The episode's page title, from the series page's list. */
export function episodePage(seriesText, ep) {
  const m = seriesText.match(new RegExp(`Episode ${ep}:[^\\n]*\\n\\{\\{:([^}]+)\\}\\}`));
  return m ? m[1].trim() : null;
}

/** An episode's title, from the series page's list (listed before it airs). */
export async function fetchTitle(seriesKey, ep) {
  const page = episodePage(await wikitext(`Series ${seriesKey}`), ep);
  if (!page) throw new Error(`The wiki doesn't have a title for episode ${ep} yet`);
  return titleCase(page);
}

/** Every episode title the series page lists so far, by episode number (one request). */
export async function fetchTitles(seriesKey) {
  const text = await wikitext(`Series ${seriesKey}`), out = {};
  for (let ep = 1; ep <= 10; ep++) { const page = episodePage(text, ep); if (page) out[ep] = titleCase(page); }
  return out;
}

/** "This is food glue." → "This Is Food Glue", like the data file's titles. */
const SMALL = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "vs"]);
export function titleCase(t) {
  const words = t.trim().replace(/\.$/, "").split(/\s+/);
  return words.map((w, i) => (i && i < words.length - 1 && SMALL.has(w.toLowerCase()) ? w.toLowerCase()
    : w.replace(/(^|-)(\p{L})/gu, (_, a, b) => a + b.toUpperCase()))).join(" ");
}

/** A cell's text: no attributes ("rowspan=4 |"), bold, templates or tags. */
const clean = (c) => c
  .replace(/^\s*(?:[a-z-]+\s*=\s*("[^"]*"|[^\s|]+)\s*)+\|(?!\|)/i, "")
  .replace(/'''?/g, "").replace(/<[^>]+>/g, "").trim();

/** A score cell: a number, "DQ", or null for a dash/blank. */
function score(c) {
  const t = clean(c);
  if (/^DQ\b/i.test(t)) return "DQ";
  const m = t.match(/^-?\d+/);
  return m ? +m[0] : null;
}

/**
 * The scores table → { tasks: [{ no, t, name, scores: [5] }], tiebreak, totals, names }.
 * names: the contestants' full names in the table's column order.
 */
export function parseEpisode(text) {
  const start = text.indexOf('{| class="tmtable"');
  if (start < 0) throw new Error("No scores table on the episode page yet");
  const table = text.slice(start, text.indexOf("\n|}", start));
  const pieces = table.split(/\n\|-[^\n]*/), h = pieces.findIndex((p) => /^!\s*Task/m.test(p));
  const head = pieces[h] || "", rows = pieces.slice(h + 1);
  const names = [...head.matchAll(/^!\s*(.+)$/gm)].map((m) => m[1]).slice(2)
    .map((n) => n.replace(/\{\{color\|[^|]*\|([^}]+)\}\}/, "$1").replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/, "$1").replace(/<[^>]+>/g, "").trim());
  const tasks = [];
  const N = names.length, span = (c) => +(c.match(/^\s*(?:[a-z-]+\s*=[^|]*)?rowspan\s*=\s*"?(\d+)/i)?.[1] || 1);
  let tiebreak = null, totals = null, task = null, rowsLeft = 0, cover = [];
  for (const row of rows) {
    const cells = row.split("\n").filter((l) => /^[|!]/.test(l)).flatMap((l) => l.slice(1).split(/\|\||!!/));
    if (!cells.length) continue;
    if (/^\s*!/.test(row.trim())) { totals = cells.slice(-N).map(score); continue; }
    const link = cells[0].match(/\[\[([^|\]]+)\|([^\]]+)\]\]/);
    if (link) {
      const label = link[2].trim(), vals = cells.slice(2, 2 + N);
      task = null;
      if (label === "T") { const i = vals.findIndex((v) => /✔|✓/.test(v)); tiebreak = i >= 0 ? i : null; continue; }
      if (!/^\d+$/.test(label)) continue; // "S": a series-long task, scored in its last episode
      const kind = cells[1]?.match(/^\s*'''\s*([A-Za-z ]+):/)?.[1] || "";
      const t = /live/i.test(kind) ? "L" : /prize/i.test(kind) ? "P" : /team/i.test(kind) ? "T" : "F";
      task = { no: +label, t, name: link[1].trim(), scores: vals.map(score), parts: [] };
      tasks.push(task);
      rowsLeft = span(cells[0]) - 1;
      cover = cells.slice(1, 2 + N).map((c) => span(c) - 1); // description + a column per contestant
      continue;
    }
    if (!task) continue;
    // A row under a task: its cells fill the columns not still covered by a
    // rowspan from above. A bonus row ("Bonus: most unexpected thing…") is
    // added on; any other is a part of a split task.
    const bonus0 = cover[0] === 0, vals = Array(N).fill(null), free = cover.map((c, j) => (c > 0 ? -1 : j)).filter((j) => j >= 0);
    free.forEach((j, k) => { if (j > 0 && cells[k] != null) vals[j - 1] = score(cells[k]); });
    cover = cover.map((c) => Math.max(0, c - 1));
    const bonus = (bonus0 && /bonus/i.test(cells[0])) || rowsLeft === 0;
    if (rowsLeft > 0) rowsLeft--;
    if (!bonus) task.parts.push(vals);
    else task.scores = task.scores.map((v, i) => (typeof vals[i] === "number" ? (typeof v === "number" ? v : 0) + vals[i] : v));
  }
  // A split task: each contestant scores in the part they did (the parent row
  // is usually 0s, or the total), so take the larger of the two.
  for (const t of tasks) {
    if (t.parts.length) t.scores = t.scores.map((v, i) => {
      const got = t.parts.map((p) => p[i]).filter((x) => typeof x === "number");
      if (!got.length) return v;
      return Math.max(typeof v === "number" ? v : 0, got.reduce((a, b) => a + b, 0));
    });
    delete t.parts;
  }
  return { tasks, tiebreak, totals, names };
}

/**
 * An episode's scores for the grid, in the series cast's order.
 * cast: [{ key, full }]. Returns { page, title, tasks: [{ no, t, name, scores }],
 * tiebreak (cast key or ""), warnings, complete }.
 */
export async function fetchEpisode(seriesKey, ep, cast) {
  const page = episodePage(await wikitext(`Series ${seriesKey}`), ep);
  if (!page) throw new Error(`The wiki's Series ${seriesKey} page doesn't list episode ${ep} yet`);
  const { tasks, tiebreak, totals, names } = parseEpisode(await wikitext(page));
  if (!tasks.length) throw new Error(`"${page}" has no scores yet`);
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
  const col = cast.map((c) => names.findIndex((n) => norm(n) === norm(c.full) || norm(n).startsWith(norm(c.key))));
  const missing = cast.filter((c, i) => col[i] < 0).map((c) => c.full);
  if (missing.length) throw new Error(`Couldn't find ${missing.join(", ")} in the wiki's table`);
  const warnings = [];
  const out = tasks.map((t) => ({ no: t.no, t: t.t, name: t.name, scores: col.map((j) => t.scores[j]) }));
  const blank = out.some((t) => t.scores.some((v) => v == null));
  if (blank) warnings.push("Some scores are blank on the wiki; fill them in");
  let off = [];
  if (totals) {
    off = cast.filter((c, i) => totals[col[i]] != null && out.reduce((a, t) => a + (typeof t.scores[i] === "number" ? t.scores[i] : 0), 0) !== totals[col[i]]);
    if (off.length) warnings.push(`The tasks don't add up to the wiki's total for ${off.map((c) => c.key).join(", ")}; check them`);
  }
  // Looks finished: every score in, a total for everyone that the tasks add
  // up to, and the closing live task (the scheduled sync waits for this, as
  // the wiki's table fills in while the episode streams).
  const complete = !blank && !!totals && cast.every((c, i) => totals[col[i]] != null) && !off.length && out.some((t) => t.t === "L");
  return { page, title: titleCase(page), tasks: out, tiebreak: tiebreak == null ? "" : cast[col.indexOf(tiebreak)]?.key || "", warnings, complete };
}
