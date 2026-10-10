# Fantasky Master — Systems Design

This document specifies the Fantasky Master system: its purpose, inputs, data model, state derivation, and every calculation it performs. It is a systems-design reference, written to be read by a language model (or a new developer) who has not seen the code: terms are defined before use, formulas are explicit, and a worked example is included.

- **Live app:** <https://kbroadie.github.io/fantasky-master/>
- **Source:** <https://github.com/kbroadie/fantasky-master> (the app: `index.html`, `js/`; the scoring engine: `js/league.js`)

> **The site was rebuilt.** The single-file site this document was first written about (its architecture in §4 and its code in §10) has been replaced by the app at the site's root, which reads all league data from `data/fantasky_master_data.csv` at run time. The calculations (§5–§8) are unchanged: `js/league.js` implements them, and `tools/check-data.mjs` checks it against the worked example in §7. The old file is in the repository's git history.
- **Taskmaster YouTube channel** (where episodes livestream): <https://www.youtube.com/@Taskmaster>
- **Player-facing rules and how to vote:** [README.md](README.md)
- **Contestant image albums (Imgur):** Series 22 <https://imgur.com/a/taskmaster-series-22-r7FwUp3> · Series 21 <https://imgur.com/a/taskmaster-series-21-sQsejvk>

---

## 1. Purpose

Fantasky Master runs a **fantasy league for the British TV comedy show _Taskmaster_**.
- **The show:** each series of Taskmaster has 5 celebrity **contestants** who compete over 10 **episodes**. In every episode they attempt several **tasks**, and each contestant receives points for each task (normally 0–5; occasionally 6).
- **The league:** a group of friends (**players**) each **pick one contestant per episode**, and earn points according to how that contestant performed.

The system computes, for every series it holds:
- two league tables (Show and League points);
- week-over-week rank movement;
- per-episode results, including winners and tiebreaks;
- per-contestant statistics;
- the pick-every-contestant rule status for each player;
- the schedule state (aired, scored, next episode).

---

## 2. System context: how data enters

The system does not collect votes; it is a deterministic calculator over data the host enters.

1. **Polls.** At the start of each series, the host posts **10 WhatsApp polls in a private group chat**, one per episode. Each poll lists the 5 contestants in the show's **seating order, which is always alphabetical by first name** (Series 22: Chloe, Isy, Matt, Nina, Richard).
2. **Voting.** Each player votes for one contestant per poll. They may change their vote any number of times until the poll closes.
3. **League rule — pick every contestant at least once.** Across the 10 polls of a series, each player must vote for each of the 5 contestants at least once. The other 5 picks are free, including repeats. The system does not enforce or score this rule, but it computes each player's compliance status (§6.9).
4. **Deadline.** A WhatsApp poll timer closes each poll when its episode starts **livestreaming on the [Taskmaster YouTube channel](https://www.youtube.com/@Taskmaster) at 22:00 London time**. That is normally 17:00 US Eastern / 14:00 US Pacific, and one hour later in the US for any episode that falls between the UK and US clock changes (e.g. 29 Oct 2026).
5. **Data entry.** At any time after an episode airs, the host adds that episode's task scores and the players' final poll votes to `data/fantasky_master_data.csv` (§9), in the app's edit mode or by hand, and shares the link.

Therefore `PICKS[player][ep]` is exactly that player's final vote in the episode-`ep` poll. A missing or `null` pick means they did not vote.

---

## 3. Glossary

| Term | Meaning |
|---|---|
| **Series** | One season of Taskmaster, keyed `"s" + number` (e.g. `s21`, `s22`). |
| **Contestant** | One of the 5 comedians competing in a series. |
| **Episode** (`ep`) | One of 10 episodes in a series, numbered 1–10. `EPISODES_PER_SERIES = 10` is a fixed constant. |
| **Task** | A single challenge in an episode; each contestant gets a score for it. |
| **Task type** | **P** = Prize, **F** = Filmed, **T** = Team, **L** = Live (studio). |
| **Player** | A person in the fantasy league (not a contestant). |
| **Pick** | The contestant a player chose for a given episode. |
| **Air instant** | The moment an episode starts livestreaming: 22:00 Europe/London on its date. |
| **Aired weeks** (`WEEKS_AIRED`) | Number of episodes whose air instant is at or before the current time. Their polls are closed. |
| **Scored weeks** (`WEEKS_SCORED`) | The highest episode number with task scores entered. **Only scored weeks count toward any score.** |
| **Show points** (internally **PvE**) | Sum of the actual episode scores of the contestants a player picked. |
| **League points** (internally **PvP**) | Sum of placement points (5/4/3/2/1) earned by a player's picks, based on where each pick finished in that episode. |
| **Tiebreak** | When contestants tie for an episode's top score, the show plays a tiebreak task. Its winner (`EM[ep].tb`) is the episode winner. Tiebreaks affect only League points. |
| **Rank delta** | Change in a player's rank on a board since the previous scored week (positive = moved up). |

---

## 4. Architecture

- **Static files.** The original system was one static file, `index.html`, containing the data and the logic as plain JavaScript; the rebuilt app is static files (`index.html`, `styles.css`, `js/`) that load the data from `data/` at run time. Either way there is no framework, no build step and no dependencies.
- **Hosting.** Served as a static file by GitHub Pages from the `main` branch of `kbroadie/fantasky-master`.
- **No backend, no persistence.** All league data are constants in the file. Nothing is written back, and there are no accounts. Updating the league means editing the file and republishing (§9).
- **Execution model.** On load, the client:
  1. selects the current series (§5.3);
  2. derives the schedule state from the client clock (§5);
  3. computes all derived data (§6).

  Selecting another series repeats the same pipeline for that series.
- **Inputs to computation:** the series data (§4.1) and the client's current time. The clock drives only the schedule state (`WEEKS_AIRED`, current series, next episode); scores are independent of it.

### 4.1 Data model

All series live in one object, keyed by series:

```js
SERIES_RAW = {
  s21: { NAMES, PORT, CONT, TASKS, EM, EI, PICKS },
  s22: { NAMES, PORT, CONT, TASKS, EM, EI, PICKS },
}
```

- **Series number:** read from the key (`seriesNum("s22") = 22`). `SERIES_KEYS` lists the keys, oldest first.
- **No stored progress:** no field records how many episodes have aired or been scored, or any rank change. All of it is derived.

| Field | Type | Meaning |
|---|---|---|
| `NAMES` | array of 5 strings | Contestant short names. Every score array `s` in `TASKS` is aligned to this order. |
| `PORT` | `{name: imageURL}` | Contestant portrait: a direct Imgur image link, `https://i.imgur.com/<id>.png`, to an image in that series' album (§4.2). |
| `CONT` | `{name: {full, acc, bio, stat}}` | Full name `full`; `acc`, a hex value not used by any calculation; and two free-text paragraphs, `bio` and `stat` (statistical insight), authored outside the system. |
| `TASKS` | array of `{ep, n, t, s}` | One entry per task: episode number `ep`; task name `n` (may carry a "Prize:", "Team:" or "Live:" prefix); type `t` ∈ {P, F, T, L}; and `s`, 5 scores aligned to `NAMES`. |
| `EM` | `{ep: {t, d, tb?}}` | Episode metadata for all 10 episodes: title `t`; London air date `d` (e.g. `"1 Oct 2026"`); and, only when contestants tied for the top score, `tb`, the tiebreak winner's name. |
| `EI` | `{ep: text}` | Free-text episode analysis, authored outside the system. |
| `PICKS` | `{player: {ep: name or null}}` | Each player's final vote per episode. Missing or `null` = no vote. An empty object = the player has never voted. |

Example task and tiebreak entries (Series 22):

```js
{ep:1, n:"Prize: The droopiest object", t:"P", s:[1,3,5,2,4]}
// NAMES_S22 = ["Richard","Matt","Isy","Chloe","Nina"]  =>  Richard 1, Matt 3, Isy 5, Chloe 2, Nina 4

EM_S22[2] = {t:"This Is Food Glue", d:"10 Sep 2026", tb:"Richard"}   // Richard, Matt, Nina tied on 14
```

### 4.2 Image hosting

Contestant images are not stored in the repository. They are hosted in one Imgur album per series, maintained by the host:

| Series | Album | Image IDs referenced by `PORT` |
|---|---|---|
| 22 | <https://imgur.com/a/taskmaster-series-22-r7FwUp3> (album id `r7FwUp3`) | Chloe `8ZFXOSZ`, Isy `Mqxwewi`, Matt `A4Eabuj`, Nina `Tf5CoeT`, Richard `Az8PJmE` |
| 21 | <https://imgur.com/a/taskmaster-series-21-sQsejvk> (album id `sQsejvk`) | Amy `KXhQLQQ`, Armando `JZSgjrb`, Joanna `IuSCsrt`, Joel `nRfy6Um`, Kumail `u0hZhnG` |

- **Link format.** `PORT` uses the **direct image link** (`https://i.imgur.com/<id>.png`), not the album or post URL, so the file can be fetched as an image. The `<id>` is the image's own Imgur ID, distinct from the album id.
- **Extra images.** The albums may hold images that `PORT` doesn't reference (at the time of writing, six extra in the Series 22 album and one in the Series 21 album). Only the five `PORT` entries per series are used.
- **External dependency.** Images are fetched from Imgur at run time. If Imgur is unreachable or an image is deleted, the system still computes everything; only the image is missing. No calculation reads `PORT`.
- **Replacing an image.** Upload the new image to the series' album, then point that contestant's `PORT` entry at the new image's direct link. Deleting an image from the album breaks any `PORT` entry still pointing at it.

### 4.3 Data source: `data/fantasky_master_data.csv`

All hand-entered data (§4.1) lives in one CSV file, `data/fantasky_master_data.csv`, the single editable source. The app loads it at run time (`js/csv.js`). The file was first generated from the original site's in-file constants, and rebuilding every series from the CSV alone reproduced them exactly.

The CSV holds inputs only; nothing derived (§5–§6) is stored. Each row has a `record` type; columns not used by that type are blank:

| `record` | Maps to | Columns |
|---|---|---|
| `contestant` | `NAMES`, `CONT`, `PORT` | `series`, `contestant`, `full_name`, `accent_color`, `portrait_url`, `bio` |
| `player` | keys of `PICKS` (the roster, including players who never vote) | `series`, `player` |
| `episode` | `EM`, `EI` | `series`, `episode`, `title`, `air_date`, `tiebreak_winner` (→ `tb`), `analysis` |
| `score` | `TASKS` (one row per task × contestant) | `series`, `episode`, `task_no`, `task_type`, `task_name`, `contestant`, `score` (`DQ` marks a disqualification and counts as 0 in every calculation) |
| `pick` | `PICKS` | `series`, `episode`, `player`, `contestant` |

Conventions:
- **Encoding.** UTF-8 with a byte-order mark; a parser must strip it.
- **Text.** Text fields use plain characters instead of HTML entities, and may contain `<strong>` markup.
- **Missing picks.** A missing `pick` row means no vote.
- **Contestant order.** Contestants are listed in seating (alphabetical) order. When the CSV becomes the source, that becomes `NAMES` order, which only matters for the fallbacks in §6.8 and §6.10 (an unrecorded top tie, or tied series totals).

The editing guide is in `data/README.md`.

---

## 5. Schedule state (clock-derived)

### 5.1 Air instant

```
airInstant(ep) = zonedTimeToDate(date of EM[ep].d, 22:00, "Europe/London")
```

- `zonedTimeToDate` converts a wall-clock time in a named time zone to an absolute instant, using the runtime's time-zone database (`Intl`).
- BST/GMT and every daylight-saving transition are therefore handled without hard-coded offsets.
- Constants: `AIR_TZ = "Europe/London"`, `AIR_HOUR = 22`, `AIR_MIN = 0`.

### 5.2 Aired and scored weeks

```
WEEKS_AIRED  = count of ep in 1..10 with airInstant(ep) ≤ now
WEEKS_SCORED = max(ep over TASKS), or 0 if TASKS is empty
```

- **Normally equal.** Between an episode airing and the host entering its results, `WEEKS_SCORED = WEEKS_AIRED − 1`.
- **Rule:** everything about **scores** uses `WEEKS_SCORED`; everything about the **schedule or open/closed polls** uses `WEEKS_AIRED`.
- **Why the split matters:** an unscored episode has all contestants on 0. If it were counted, the League points rule would read it as a five-way tie for 1st and award every pick 5 League points.

### 5.3 Current series

```
currentSeriesKey = the highest-numbered series whose Episode 1 airInstant ≤ now
                   (falls back to the highest-numbered series if none has premiered)
```

- The system loads this series at start-up.
- A series added before its premiere is not current until its Episode 1 airs.
- A series is **complete** when `WEEKS_AIRED = 10`.

### 5.4 Next episode

```
nextEpisode = the first ep in 1..10 with airInstant(ep) > now, or none
remaining   = airInstant(nextEpisode) − now, expressed as days / hours / minutes
```

- The air instant is absolute. Converting it to the viewer's local date, time and zone name uses the client's time-zone data (`localAirtimeText`).
- The remaining time is recomputed every second.
- When it reaches zero, `nextEpisode` advances to the following episode.

---

## 6. Calculations

All derived values are recomputed each time a series is loaded (`loadSeries` → `computeDerived`).

### 6.1 Tie-aware ranking: `rankWithTies`

Takes a list already sorted best-first and assigns **standard competition ranking** ("1-2-2-4"):

```
rank[item_0] = 1
rank[item_i] = (key(item_i) == key(item_{i−1})) ? rank[item_{i−1}] : i + 1
```

Example: `[67, 63, 63, 61]` → `[1, 2, 2, 4]`.

### 6.2 Contestant episode totals: `EPS`

```
EPS[c][e] = Σ task.s[index of c in NAMES] over tasks with task.ep = e
```

Unscored episodes total 0.

### 6.3 Contestant totals by task type: `TY`

```
TY[c][type] = Σ task.s[index of c] over all tasks with task.t = type      (type ∈ P, F, T, L)
```

### 6.4 Show points (PvE)

For each player `p`:

```
epPts[e]    = EPS[pick_e][e]   if p picked someone for e AND e ≤ WEEKS_SCORED
            = null             otherwise
Show points = Σ epPts[e], treating null as 0
```

### 6.5 Weekly placement points: `CAST_EP_RANK_PTS`

For each episode `e`:

1. Rank the 5 contestants by `EPS[·][e]` with `rankWithTies`.
2. **Tiebreak adjustment.** If `tb = EM[e].tb` exists and `tb` is ranked 1st, every other contestant ranked 1st is moved to rank 2. The tiebreak winner keeps rank 1; lower ranks are unchanged.
3. Convert rank to points:

   ```
   rankPoints[e][c] = 6 − rank(c)          // 1st = 5, 2nd = 4, 3rd = 3, 4th = 2, 5th = 1
   ```

   Ties other than a resolved tie for 1st share points (e.g. two tied 4th both get 2). An unresolved tie for 1st (no `tb`) is shared.

Example (Series 22, ep 2): totals Richard 14, Matt 14, Nina 14, Isy 13, Chloe 8, with `tb = Richard`:
- ranks before the tiebreak: 1, 1, 1, 4, 5;
- ranks after: 1, 2, 2, 4, 5;
- League points: 5, 4, 4, 2, 1.

The tiebreak never changes `EPS`, so Show points are unaffected.

### 6.6 League points (PvP)

```
League points = Σ rankPoints[e][pick_e] over e in 1..WEEKS_SCORED where p has a pick
```

### 6.7 Boards, ranks and rank deltas

`boardsAsOf(w)` computes, for every player in `PICKS`, their Show and League points counting episodes `1..w` only. It then ranks both totals with `rankWithTies`.

```
cur  = boardsAsOf(WEEKS_SCORED)
prev = boardsAsOf(WEEKS_SCORED − 1)        (prev = cur when WEEKS_SCORED ≤ 1)

PVE_RANK[p] = cur.pveRank[p]      PVP_RANK[p] = cur.pvpRank[p]      PVP_SCORE[p] = cur.pvp[p]
RD[p]       = prev.pveRank[p] − cur.pveRank[p]
RD_PVP[p]   = prev.pvpRank[p] − cur.pvpRank[p]
```

- **Who is ranked:** every player in `PICKS`, including players with no votes (they score 0 and rank last).
- **Active players:** those with at least one pick. Outputs list only active players. Inactive players always sit below every active player, so they never change an active player's rank.

### 6.8 Episode winner: `episodeWinner(ep)`

```
top  = max over c of EPS[c][ep]
tied = contestants with EPS[c][ep] = top
winner   = tb if |tied| > 1 and tb ∈ tied, else tied[0] (NAMES order)
tiebreak = |tied| > 1
```

### 6.9 Pick-every-contestant status

For each player, judged only on weeks with known picks (`WEEKS_SCORED`):

```
known  = contestants picked in episodes 1..WEEKS_SCORED
needed = NAMES − known
left   = 10 − WEEKS_SCORED

status = none                        if needed is empty or |needed| < left
       = MUST_PICK(needed)           if |needed| = left > 0
       = CANNOT_FIT(needed)          if |needed| > left > 0
       = NEVER_PICKED(needed)        if left = 0 and needed is non-empty
```

The site shows it as a red line at the top of the player's opened row on the Standings ("Must pick: …", "Can't fit all: …", "Never picked: …"), as it stood after the week on show. The status is reported only when mathematically binding. Aired-but-unentered weeks count as still available, because their picks aren't known yet, so late data entry can't produce a false status.

### 6.10 Contestant statistics

| Value | Formula |
|---|---|
| Series total | `Σ EPS[c][1..10]` |
| Series order and rank | Contestants sorted by series total, descending; rank = position (not tie-aware; ties fall back to `NAMES` order). |
| Average per episode | `series total ÷ WEEKS_SCORED` (0 when nothing is scored). |
| Category ranks | `rankWithTies` by `TY.P` (prize), by `TY.F + TY.T` (filmed, with team tasks counted as filmed), and by `TY.L` (live). |
| Best / worst episode | Max / min of `EPS[c][1..WEEKS_SCORED]`. |
| Per-type episode breakdown | For each scored episode: prize, filmed + team, and live subtotals, plus the episode total. |

### 6.11 Other derived values

| Value | Formula |
|---|---|
| League leader | The active player with the highest Show points (ties go to `PICKS` insertion order). |
| Per-task extremes | In each task, the highest and lowest scores, flagged only if not all 5 scores are equal. |
| Player best / worst week | Max / min of the player's scored weekly values: raw `epPts`, or `rankPoints` on the League board (where 5 is best and 1 is worst). |

### 6.12 Fantasy mode (low scores win)

An Easter egg: tapping the quote under every tab (`flip.js`) switches the whole app to show the same data as a dream where low scores win ("Fantasy Fantasky Master"). Nothing else mentions it, README.md included. Nothing in `league.js` changes; the views turn the order round (`state.fantasy`):

| Output | Normal | Fantasy mode |
|---|---|---|
| Board rank (Show, League) | standard competition rank, highest first | `1 + count of players with a lower total` (ties share), lowest first |
| Board leader(s) | everyone on the highest total | everyone on the lowest total |
| Gap meter | `p / top` | `(top − p) / (top − low)` (the lowest full) |
| Race chart gap | `total − leader's total` (≤ 0) | `−(total − lowest)` (≤ 0), so the lowest runs flat along the top |
| Episode winner (gold light) | `winner` (tiebreak applied) | every contestant on the episode's lowest score |
| Stink | last place, 5+ behind the next-lowest | the top scorer, 5+ clear of the next-highest |
| A pick that "won" (gold bar) | the pick won the episode | the pick scored the episode's lowest |
| Cast order and rank | series total, highest first | `1 + count of contestants with a lower total`, lowest first |
| Cast wins | episodes won | episodes on the lowest score |
| Radar | z-score per axis, −3σ at the centre | the same z, the scale turned inside out (+3σ at the centre) |

The How scoring works cards read "fewest points" and "worst episode placements". The All-time records card isn't shown.

---

## 7. Worked example (Series 22, player "Riley")

Riley's picks: ep1 Richard, ep2 Matt, ep3 Chloe, ep4 Chloe. Episode totals (`EPS`):

| Ep | Richard | Matt | Isy | Chloe | Nina |
|---|---|---|---|---|---|
| 1 | 13 | 17 | 13 | 19 | 18 |
| 2 | 14 | 14 | 13 | 8 | 14 |
| 3 | 11 | 13 | 9 | 21 | 17 |
| 4 | 9 | 12 | 24 | 19 | 21 |

**Show points** = 13 + 14 + 21 + 19 = **67**.

**League points:**
- **Ep 1:** Chloe 5, Nina 4, Matt 3, Richard and Isy tied 4th (2 each). Richard = **2**.
- **Ep 2:** three-way tie on 14, `tb = Richard`, so Richard 5, Matt 4, Nina 4, Isy 2, Chloe 1. Matt = **4**.
- **Ep 3:** Chloe 5, Nina 4, Matt 3, Richard 2, Isy 1. Chloe = **5**.
- **Ep 4:** Isy 5, Nina 4, Chloe 3, Matt 2, Richard 1. Chloe = **3**.

League points = 2 + 4 + 5 + 3 = **14**.

**Other outputs:**
- **Show rank:** Riley is 1st on the Show board.
- **Pick status:** known = {Richard, Matt, Chloe}, needed = {Isy, Nina}, left = 6, so status = none.

---

## 8. Invariants, edge cases and conventions

1. **Only scored weeks score.** A pick for an unscored episode (not aired, or aired but not entered) contributes to neither board.
2. **The clock never affects scores.** The client clock only drives `WEEKS_AIRED`, the current series and the next episode. A misconfigured device clock can misreport schedule state but cannot change any points or ranks.
3. **Tiebreaks affect League points only**, and only for a tie for 1st.
4. **Ties.** Board ranks, category ranks and placement points are tie-aware (standard competition ranking). The contestant series rank is not.
5. **Scores above 5 are valid.** One Series 22 task awarded a 6; it is kept as entered so totals match the source.
6. **Inactive players.** Players with no picks (Series 22: Ellen, Katherine) are ranked but excluded from the active set.
7. **Known rule violation in data.** Series 21 player Riley never picked Joanna, so their Series 21 status is `NEVER_PICKED(Joanna)`.
8. **Fixed series length.** Every series has exactly 10 episodes (`EPISODES_PER_SERIES`).
9. **Deadline consistency.** The system's air instant and the league's voting deadline are the same moment (22:00 London livestream). Enforcement is by the WhatsApp poll timer, not the system.

---

## 9. Operations: data maintenance

All league data is in `data/fantasky_master_data.csv`; its columns and record types are in `data/README.md`. After an episode airs, either use the app's edit mode (tap all seven rubber ducks at the bottom of any tab; see `APP.md`), which fetches the scores from the Taskmaster Wiki and writes the rows, or add them by hand:

1. **Scores:** a `score` row for every contestant on every task of the episode. This alone marks the episode as scored.
2. **Picks:** a `pick` row for each player's final poll vote (no row for a player who didn't vote). Votes for future episodes may be entered early; they don't score until their episode is scored.
3. **Tiebreak:** only if contestants tied for the top score, `tiebreak_winner` on that episode's `episode` row.
4. **Title (optional):** the `title` on the `episode` row.

Run `node tools/check-data.mjs` after editing by hand (CI runs it on every push). Everything else is derived: aired and scored weeks, totals, both boards, ranks, episode winners, pick-rule statuses, contestant statistics, the next episode and the current series.

**New series:** 5 `contestant` rows (with portraits uploaded to a new Imgur album, §4.2), a `player` row per league member, and 10 `episode` rows with their London air dates.

The series becomes current automatically when its Episode 1 airs.

---

## 10. Logic map

| Function / constant | Responsibility |
|---|---|
| `SERIES_RAW`, `*_S21`, `*_S22` | Series data (§4.1); `PORT_*` point into the Imgur albums (§4.2). |
| `EPISODES_PER_SERIES`, `AIR_TZ`, `AIR_HOUR`, `AIR_MIN` | Schedule constants (§5.1). |
| `zonedTimeToDate`, `parseEpDate` | Air instants, DST-aware (§5.1). |
| `seriesNum`, `SERIES_KEYS`, `currentSeriesKey` | Series identity and current-series selection (§5.3). |
| `loadSeries` | Selects a series, derives `WEEKS_AIRED` / `WEEKS_SCORED`, runs `computeDerived`. |
| `computeDerived` | `EPS`, `TY`, player records, `CAST_EP_RANK_PTS` (with tiebreaks), boards, ranks, deltas (§6). |
| `rankWithTies` | Standard competition ranking (§6.1). |
| `boardsAsOf` | Both boards and ranks as of a given week (§6.7). |
| `episodeWinner` | Episode winner and tiebreak flag (§6.8). |
| `nextEpisodeInfo`, `tickCountdown`, `localAirtimeText` | Next episode, time remaining, local-time conversion (§5.4). |
