// All-time stats (data/taskmaster_stats.csv): the radar baseline, record badges and profile facts.

import { parseCSV } from "./csv.js";

export const STATS_URL = "data/taskmaster_stats.csv";

/** The stats rows, or [] if the file can't be loaded (the features then hide). */
export async function loadStats() {
  try {
    const res = await fetch(STATS_URL);
    return res.ok ? parseCSV(await res.text()) : [];
  } catch { return []; }
}

const num = (v) => (v === "" || v == null ? null : +v);
const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const statsFor = (rows, series, full) => rows.find((r) => +r.series === +series && norm(r.name) === norm(full)) || null;

/** Mean and SD of points per episode for Prize, solo Filmed and Live tasks, over every contestant. */
export function allTimePerEpisode(rows) {
  const vals = { P: [], F: [], L: [] };
  for (const r of rows) {
    const eps = num(r.episodes);
    if (!eps) continue;
    vals.P.push(num(r.prize_per_ep));
    vals.F.push(num(r.solo_filmed_points) / eps);
    vals.L.push(num(r.live_per_ep));
  }
  const out = { n: vals.P.length };
  for (const [k, v] of Object.entries(vals)) {
    const mean = v.reduce((a, x) => a + x, 0) / v.length;
    out[k] = { mean, sd: Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / v.length) };
  }
  return out;
}

const pct = (v) => `${Math.round(v)}%`;
const BADGES = [
  { key: "first_or_last_pct", label: "Chaos agent", say: (v) => `First or last in ${pct(v)} of solo tasks` },
  { key: "solo_win_pct", label: "Task winner", say: (v) => `Won ${pct(v)} of solo tasks` },
  { key: "episode_win_pct", label: "Episode machine", say: (v) => `Won ${pct(v)} of episodes` },
  { key: "subj_minus_obj", label: "Greg's favourite", say: (v) => `Scores ${v.toFixed(2)} more per task when Greg judges than on measured tasks` },
  { key: "subj_minus_obj", low: true, label: "By the numbers", say: (v) => `Scores ${Math.abs(v).toFixed(2)} more per task on measured tasks than when Greg judges` },
  { key: "fastest_ppt", label: "Speed demon", say: (v) => `${v.toFixed(2)} points per fastest-wins task` },
  { key: "prize_per_ep", label: "Prize hoarder", say: (v) => `${v.toFixed(2)} prize-task points an episode` },
  { key: "live_per_ep", label: "Live wire", say: (v) => `${v.toFixed(2)} live-task points an episode` },
  { key: "team_ppt", label: "Team player", say: (v) => `${v.toFixed(2)} points per team task` },
  { key: "dq_pct", label: "DQ magnet", say: (v) => `${pct(v)} of tasks ended in a DQ or zero` },
  { key: "solo_last_pct", label: "Wooden spoon", say: (v) => `Last in ${pct(v)} of solo tasks` },
];
const TOP = 3;

/** The series still airing, if the latest series has fewer than ten episodes. */
const airing = (rows) => {
  const latest = Math.max(...rows.map((r) => +r.series));
  return rows.some((r) => +r.series === latest && num(r.episodes) < 10) ? latest : null;
};

// Finished series only, on both sides: a few episodes are too few to rank
export function badgesFor(rows, row) {
  const live = airing(rows);
  if (!row || +row.series === live) return [];
  const pool = rows.filter((r) => +r.series !== live);
  const out = [];
  for (const b of BADGES) {
    const v = num(row[b.key]);
    if (v == null) continue;
    const sign = b.low ? -1 : 1;
    const better = pool.filter((r) => num(r[b.key]) != null && sign * num(r[b.key]) > sign * v).length;
    const tied = pool.filter((r) => num(r[b.key]) === v).length > 1;
    if (better < TOP) out.push({ label: b.label, rank: better + 1, tied, of: pool.length, text: b.say(v) });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

const yes = (v) => /^y/i.test(v || "");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "28-Jan-1957" as a date in the device's locale, e.g. "28 January 1957". */
function birthday(dob) {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(dob || "");
  const mon = m && MONTHS.indexOf(m[2]);
  if (!m || mon < 0) return "";
  const date = new Date(Date.UTC(+m[3], mon, +m[1]));
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Is the device set to the US (e.g. en-US)? Its heights are in feet and inches. */
const inUS = (() => {
  try { return new Intl.Locale(navigator.language).maximize().region === "US"; } catch { return false; }
})();

/** "173 cm", or "5′ 8″" on US devices. */
function height(cm) {
  if (!inUS) return `${Math.round(+cm)} cm`;
  const inches = Math.round(+cm / 2.54);
  return `${Math.floor(inches / 12)}′ ${inches % 12}″`;
}

const DEGREE = { OXBRIDGE: "Oxbridge", RADA: "RADA", YALE: "Yale", Y: "Degree", N: "No degree" };

/** Label/value pairs for the profile; blanks are left out. */
export function factsFor(row) {
  if (!row) return [];
  const f = [];
  const add = (label, value) => { if (value != null && value !== "") f.push([label, String(value)]); };
  add("Birthday", birthday(row.dob));
  add("Age", row.age && `${row.age} at the start`);
  add("Star sign", row.star_sign);
  add("Height", row.height_cm && height(row.height_cm));
  add("Born", [row.birth_place, row.birth_country].filter((x, i, a) => x && x !== "NA" && a.indexOf(x) === i).join(", "));
  add("Education", [DEGREE[row.degree] || "", yes(row.footlights) ? "Footlights" : ""].filter(Boolean).join(" · "));
  add("Children", row.children);
  add("Siblings", row.siblings);
  if (yes(row.edinburgh_award)) add("Edinburgh Comedy Award", "Winner");
  else if (/^nom/i.test(row.edinburgh_award || "")) add("Edinburgh Comedy Award", "Nominated");
  add("Biggest film", row.biggest_film);
  const tv = [yes(row.doctor_who) && "Doctor Who", yes(row.ghosts) && "Ghosts"].filter(Boolean).join(", ");
  add("Also in", tv);
  if (row.marathon && !/^n/i.test(row.marathon)) add("Marathon", yes(row.marathon) ? "Yes" : row.marathon);
  return f;
}
