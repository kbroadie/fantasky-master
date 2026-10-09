// Validates data/fantasky_master_data.csv (the rules are in js/checks.js,
// shared with edit mode) and checks the scoring engine against the worked
// example in FANTASKY_MASTER_EXPLAINED.md. No dependencies:
//   node tools/check-data.mjs
// Exits non-zero on any error; warnings are printed but don't fail.

import { readFileSync, existsSync } from "node:fs";
import { parseCSV } from "../js/csv.js";
import { derive } from "../js/league.js";
import { checkData } from "../js/checks.js";

const CSV = process.env.FM_CSV || new URL("../data/fantasky_master_data.csv", import.meta.url);
const STATS = new URL("../data/taskmaster_stats.csv", import.meta.url);
const rows = parseCSV(readFileSync(CSV, "utf8"));
let stats = [];
const early = [];
try { stats = parseCSV(readFileSync(STATS, "utf8")); } catch { early.push("data/taskmaster_stats.csv is missing; run node tools/import-stats.mjs"); }
const { errors, warnings, series } = checkData(rows, stats);
warnings.unshift(...early);
const err = (m) => errors.push(m);

// Every portrait is a file in the repo (served by GitHub Pages; Imgur is blocked in the UK).
const ROOT = new URL("..", import.meta.url);
for (const r of rows) if (r.record === "contestant" && r.portrait_url && !existsSync(new URL(r.portrait_url, ROOT))) err(`Series ${r.series}: ${r.contestant}'s portrait ${r.portrait_url} doesn't exist`);

// Regression: the worked example in FANTASKY_MASTER_EXPLAINED.md §7.
if (series[22]) {
  const d = derive(series[22], new Date());
  const riley = d.byName.Riley?.history?.[3];
  if (!riley || riley.knap !== 18) err(`Worked example: Riley's Knappett points after Series 22 ep 4 should be 18, got ${riley?.knap}`);
  if (!riley || riley.show !== 67 || riley.league !== 14) err(`Worked example: Riley after Series 22 ep 4 should be 67 Show / 14 League, got ${riley ? `${riley.show} / ${riley.league}` : "nothing"}`);
  const ep2 = d.rankPts[2];
  const want = { Richard: 5, Matt: 4, Nina: 4, Isy: 2, Chloe: 1 };
  if (!ep2 || Object.entries(want).some(([n, p]) => ep2[n] !== p)) err(`Worked example: Series 22 ep 2 placement points should be ${JSON.stringify(want)}, got ${JSON.stringify(ep2)}`);
}

for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
console.log(errors.length ? `✗ ${errors.length} error(s)` : `✓ ${rows.length} rows OK${warnings.length ? `, ${warnings.length} warning(s)` : ""}`);
process.exit(errors.length ? 1 : 0);
