// Syncs the data file with the Taskmaster Wiki: the scores of the next
// episode to score, once its livestream started at least an hour ago and the
// wiki's table looks finished, and the titles of the episodes still to come.
// Run by .github/workflows/wiki-sync.yml an hour after each Thursday stream
// starts and then hourly until the scores are in; it commits what changed.
//   node tools/sync-wiki.mjs [--message file] [--now 2026-10-15T22:05Z]
// Edits data/fantasky_master_data.csv in place (with the same ops as edit mode,
// js/ops.js, so rows land where a person would put them) only if the result
// passes the same checks as CI. Writes the commit message to --message when
// something changed. Exits 1 on an error, 0 otherwise (nothing new included).
// Picks aren't on the wiki; they're still entered in edit mode.

import { readFileSync, writeFileSync } from "node:fs";
import { parseRows, parseCSV, toCSV, buildSeries } from "../js/csv.js";
import { derive, currentSeriesKey } from "../js/league.js";
import { checkData } from "../js/checks.js";
import { apply } from "../js/ops.js";
import { fetchEpisode, fetchTitles } from "../js/wiki.js";

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const CSV = process.env.FM_CSV || new URL("../data/fantasky_master_data.csv", import.meta.url);
const STATS = new URL("../data/taskmaster_stats.csv", import.meta.url);
const now = arg("--now") ? new Date(arg("--now")) : new Date();
const HOUR = 3600e3;

const text = readFileSync(CSV, "utf8");
const series = buildSeries(parseCSV(text));
const key = currentSeriesKey(series, now);
const d = derive(series[key], now);
const placeholder = (t) => !t || /^Episode \d+$/.test(t.trim());
const same = (a, b) => a.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const ops = [], lines = [];
const log = (m) => console.log(m);

// Scores: only the next episode (scored episodes run from 1 with no gaps), and
// only once an hour has passed since it started streaming and the wiki's
// table is complete. Otherwise it waits for the next run.
const next = d.weeksScored + 1, e = d.episodes[next - 1];
if (!e) log(`Series ${key} is fully scored.`);
else if (now - e.air < HOUR) log(`Series ${key} Ep ${next} started streaming less than an hour ago (or hasn't yet); scores wait.`);
else {
  try {
    const cast = d.names.map((n) => ({ key: n, full: d.cast[n].full }));
    const w = await fetchEpisode(key, next, cast);
    if (!w.complete) log(`Series ${key} Ep ${next}: the wiki's table isn't finished yet (${w.warnings.join("; ") || "no totals or live task yet"}); trying again next run.`);
    else {
      ops.push({ kind: "scores", s: key, ep: next, cast: d.names, tb: w.tiebreak,
        title: placeholder(e.title) ? w.title : "",
        tasks: w.tasks.map((t) => ({ t: t.t, name: t.name, scores: t.scores.map((v) => String(v).toUpperCase()) })) });
      lines.push(`Scores: Series ${key} Ep ${next} (Taskmaster Wiki)`);
      log(`Series ${key} Ep ${next}: ${w.tasks.length} tasks from "${w.page}".`);
    }
  } catch (err) { log(`Series ${key} Ep ${next}: ${err.message}; trying again next run.`); }
}

// Titles: every episode still to score whose title is a placeholder or
// differs from the wiki's (ignoring case and punctuation, so a hand-tidied
// title stays as it is).
try {
  const titles = await fetchTitles(key);
  for (const ep of d.episodes.filter((x) => x.ep > d.weeksScored)) {
    const t = titles[ep.ep];
    if (!t || (!placeholder(ep.title) && same(ep.title, t))) continue;
    if (ops.some((o) => o.kind === "scores" && o.ep === ep.ep && o.title)) continue; // set with the scores
    ops.push({ kind: "title", s: key, ep: ep.ep, title: t });
    lines.push(`Title: Series ${key} Ep ${ep.ep}: ${t}`);
  }
} catch (err) { log(`Titles: ${err.message}`); }

if (!ops.length) { log("Nothing new."); process.exit(0); }

const run = (list) => { const rows = parseRows(text); for (const op of list) apply(rows, op); return toCSV(rows); };
let stats = [];
try { stats = parseCSV(readFileSync(STATS, "utf8")); } catch { /* the cross-check is skipped, as in edit mode */ }
let out = run(ops);
let { errors, warnings } = checkData(parseCSV(out), stats);
// A tie for first the wiki has no tiebreak for yet: the scores wait, the titles don't.
const before = new Set(checkData(parseCSV(text), stats).warnings);
const fresh = warnings.filter((w) => !before.has(w) && new RegExp(`Series ${key} ep ${next}\\b`).test(w));
if (fresh.length) {
  log(`Series ${key} Ep ${next}: ${fresh.join("; ")}; scores wait for the next run.`);
  const rest = ops.filter((o) => o.kind !== "scores");
  const keep = lines.filter((l) => !l.startsWith("Scores:"));
  lines.length = 0;
  lines.push(...keep);
  if (!rest.length) { log("Nothing new."); process.exit(0); }
  out = run(rest);
  ({ errors, warnings } = checkData(parseCSV(out), stats));
}
if (errors.length) { for (const m of errors) console.error(`error: ${m}`); console.error("✗ Not saved: the result doesn't pass the data checks."); process.exit(1); }

writeFileSync(CSV, out);
const message = `${lines.length > 1 ? `${lines.length} edits from the wiki sync` : lines[0]}\n\n${lines.join("\n")}\n\nSynced from the Taskmaster Wiki by tools/sync-wiki.mjs.`;
if (arg("--message")) writeFileSync(arg("--message"), message);
log(`✓ ${lines.join(" · ")}`);
