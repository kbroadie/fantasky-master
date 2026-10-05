# League data file — `fantasky_master_data.csv`

This CSV holds **every hand-entered piece of league data**, for all series. Nothing in it is calculated. Show and League points, placings, ranks, rank changes, winners and every statistic are worked out from it.

> **Status:** the app (the site's root: `index.html` and `js/`) reads this file directly, so an edit here shows up there on the next page load.

- Save as **CSV, UTF-8**. The file starts with a byte-order mark so Excel shows `—` and `’` correctly.
- Row order doesn't matter to the data, but keeping each episode's rows together makes weekly edits easy.
- Text fields may use `<strong>…</strong>` for bold. Everything else is plain text.

> **`taskmaster_stats.csv`** is the other file here: all-time stats for every Taskmaster contestant (series 1–22), used on the app's Cast tab. It is **imported, not hand-edited**. Refresh it with `node tools/import-stats.mjs`, which downloads the first tab of the community stats Google Sheet and keeps only the columns the app uses. Then run `node tools/check-data.mjs`, which warns if a finished series here disagrees with it.

## Columns

`record, series, episode, task_no, task_type, task_name, player, contestant, score, title, air_date, tiebreak_winner, full_name, accent_color, portrait_url, bio, analysis`

Each row has a `record` type that says which columns it uses. Leave the other columns blank.

| `record` | One row per… | Columns used |
|---|---|---|
| `contestant` | contestant per series | `series`, `contestant` (short name), `full_name`, `accent_color` (hex), `portrait_url` (a file in the repo, `img/s<series>/<name>-portrait.webp`: GitHub Pages serves it, as Imgur is blocked in the UK), `bio` (who they are, in a sentence or two; no performance) |
| `player` | league player per series (the roster) | `series`, `player` |
| `episode` | episode per series, 1–10, including future ones | `series`, `episode`, `title`, `air_date` (London date, e.g. `1 Oct 2026`), `tiebreak_winner` (only if contestants tied for the top score), `analysis` |
| `score` | contestant per task | `series`, `episode`, `task_no` (1, 2, 3… within the episode), `task_type` (`P` prize, `F` filmed, `T` team, `L` live), `task_name`, `contestant`, `score` (a whole number from −1 to 10, or `DQ` for a disqualification, which counts as 0) |
| `pick` | player per episode they voted in | `series`, `episode`, `player`, `contestant` (their final poll vote) |

**No `pick` row = no vote** for that player and episode.

## Weekly update (after an episode airs)

The easy way is the app's edit mode (tap all seven rubber ducks at the bottom of any tab; see [`APP.md`](../APP.md#edit-mode)): it fetches the scores from the Taskmaster Wiki, takes picks with a tap, and writes the rows below for you. By hand, for episode *N* of the current series:

1. **Scores.** Add a `score` row for every contestant on every task; that's 5 rows per task, so usually 25 rows. The five rows of a task share `task_no`, `task_type` and `task_name`.
2. **Picks.** Add a `pick` row for each player who voted, with their final vote from the WhatsApp poll.
3. **Episode row.** If contestants tied for the top score, put the tiebreak winner in `tiebreak_winner`. Correct the `title` if it was a placeholder. (`analysis` isn't shown in the app any more; filling it is optional.)
4. **Optional.** `bio` is only who they are, so it rarely changes.

Example rows:

```csv
score,22,4,1,P,Prize: Juiciest thing,,Isy,5,,,,,,,,,
pick,22,4,,,,Riley,Chloe,,,,,,,,,,
episode,22,2,,,,,,,This Is Food Glue,10 Sep 2026,Richard,,,,,,"<strong>Richard Ayoade</strong> wins …"
```

## New series

- **Contestants:** 5 `contestant` rows (add their portraits to `img/s<series>/` first, as WebP about 225 × 266).
- **Link preview:** once the contestants are in, run `node tools/share-images.mjs` so the WhatsApp preview shows the new cast.
- **Roster:** a `player` row for each league member.
- **Schedule:** 10 `episode` rows with titles, if known, and London air dates.

The series number goes in the `series` column (e.g. `23`).
