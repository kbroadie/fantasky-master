// The data file's edits as ops on its rows (parseRows / toCSV in csv.js), so
// untouched rows never change. Shared by edit mode (edit.js), which replays
// them onto the file on Save, and tools/sync-wiki.mjs, the scheduled sync with
// the Taskmaster Wiki, so both put rows exactly where a person would.

export const PREFIX = { P: "Prize: ", T: "Team: ", L: "Live: ", F: "" };

export const colsOf = (rows) => Object.fromEntries(rows[0].map((h, i) => [h.replace(/^﻿/, "").trim(), i]));

/** Where an episode's rows are: its episode row, and the end of its block. */
function block(rows, C, s, ep) {
  const at = rows.findIndex((r) => r[C.record] === "episode" && r[C.series] === s && +r[C.episode] === ep);
  let end = at + 1;
  while (end < rows.length && rows[end][C.series] === s && rows[end][C.record] !== "episode" && rows[end][C.record] !== "contestant" && rows[end][C.record] !== "player") end++;
  return { at, end };
}

export function applyPick(rows, { s, ep, player, c }) {
  const C = colsOf(rows);
  const i = rows.findIndex((r) => r[C.record] === "pick" && r[C.series] === s && +r[C.episode] === ep && r[C.player] === player);
  if (i >= 0) { if (c) rows[i][C.contestant] = c; else rows.splice(i, 1); return; }
  if (!c) return;
  const row = Array(rows[0].length).fill("");
  Object.assign(row, { [C.record]: "pick", [C.series]: s, [C.episode]: String(ep), [C.player]: player, [C.contestant]: c });
  // In the episode's block, among its picks in player order.
  const { at, end } = block(rows, C, s, ep);
  if (at < 0) throw new Error(`Series ${s} has no episode ${ep}`);
  let pos = end;
  for (let j = at + 1; j < end; j++) if (rows[j][C.record] === "pick" && rows[j][C.player].localeCompare(player) > 0) { pos = j; break; }
  rows.splice(pos, 0, row);
}

export function applyScores(rows, { s, ep, tasks, cast, tb, title }) {
  const C = colsOf(rows);
  for (let j = rows.length - 1; j >= 0; j--) if (rows[j][C.record] === "score" && rows[j][C.series] === s && +rows[j][C.episode] === ep) rows.splice(j, 1);
  const { at } = block(rows, C, s, ep);
  if (at < 0) throw new Error(`Series ${s} has no episode ${ep}`);
  const out = tasks.flatMap((t, i) => cast.map((key, j) => {
    const row = Array(rows[0].length).fill("");
    Object.assign(row, { [C.record]: "score", [C.series]: s, [C.episode]: String(ep), [C.task_no]: String(i + 1),
      [C.task_type]: t.t, [C.task_name]: PREFIX[t.t] + t.name, [C.contestant]: key, [C.score]: String(t.scores[j]) });
    return row;
  }));
  rows.splice(at + 1, 0, ...out);
  rows[at][C.tiebreak_winner] = tb || "";
  if (title) rows[at][C.title] = title;
}

export function applyTitle(rows, { s, ep, title }) {
  const C = colsOf(rows), { at } = block(rows, C, s, ep);
  if (at < 0) throw new Error(`Series ${s} has no episode ${ep}`);
  rows[at][C.title] = title;
}

export const APPLY = { pick: applyPick, scores: applyScores, title: applyTitle };
/** Apply one op ({ kind: "pick" | "scores" | "title", … }) to the rows, in place. */
export const apply = (rows, op) => APPLY[op.kind](rows, op);
