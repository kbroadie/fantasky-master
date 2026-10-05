# Fantasky Master: the app

The league site, designed for phones first and built around the players. It follows the rules in [README.md](README.md) and the calculations in [FANTASKY_MASTER_EXPLAINED.md](FANTASKY_MASTER_EXPLAINED.md).

Live at **https://kbroadie.github.io/fantasky-master/**.

## Data

The app reads **[`data/fantasky_master_data.csv`](data/fantasky_master_data.csv)** every time it loads (always the newest copy). To update the league, use edit mode (below) or edit that file as described in [`data/README.md`](data/README.md); nothing in the app needs changing.

### Edit mode

Tap all seven rubber ducks at the bottom of any tab to open edit mode. The first time on a device it asks for a GitHub key: a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with access to only this repository and **Contents: Read and write**. The key stays in that browser; it's never part of the site.

- **Picks:** on Standings, pick an episode, open a player's row and tap their pick (or None).
- **Episodes:** edit the page itself. Tap the title to change it. On an aired episode the task table's names and scores become boxes you can type in (tap a task's icon to change its type); your changes apply when you tap away from the table. **Get scores from the wiki** fills in the table from the [Taskmaster Wiki](https://taskmaster.fandom.com); check it and add any DQs. Before an episode airs the button gets its title instead, as soon as the wiki lists it.
- **Save** writes everything into the data file on GitHub in one commit. The data is checked first with the same rules as `tools/check-data.mjs`. Everyone sees the change about a minute later, when the site redeploys. **Done** leaves edit mode (asking first if anything isn't saved).
- Scores, standings and every chart are worked out from the data file, so nothing else needs doing.

- `js/csv.js` parses the CSV.
- `js/league.js` derives the boards, ranks, tiebreak placings, rank history, pick-rule status and contestant stats.

It also reads **[`data/taskmaster_stats.csv`](data/taskmaster_stats.csv)**, all-time stats for every Taskmaster contestant (series 1–22), for the Cast tab. `js/alltime.js` reads it. It's imported from a community Google Sheet with `node tools/import-stats.mjs`; don't edit it by hand. If it fails to load, the Cast tab still works and the radar compares against the league's own series.

## Layout

The layout follows the v1 prototype. A sticky, frosted-glass top bar holds:

- the title
- the series number, a gold chip: tap it to switch series
- a one-line countdown to the next episode: "Ep 5 airs in 5d 18h"
- three tabs: **Standings · Episodes · Cast**

On scroll the bar shrinks to one thin line. All three pages are drawn when the app loads, so switching tabs is instant. There is no personal "you" view; the app is the same for everyone.

| Tab | What's on it |
|---|---|
| **Standings** | On a device's first visit, a welcome card at the top explains how the league works and what's in the app (close it with ✕ or **Close** at its end; **Read the welcome**, under the How scoring works cards, brings it back). A strip of Ep 1–10 above swipeable weeks: each shows the standings as they were after that episode (episodes still to come show only when they air, in your time). Each week has a headline ("Episode 4 Standings"), who leads the Show and the League, and a **How scoring works** button that explains both. Then the two boards side by side, **Show** on the left and **League** on the right, one row per place, each half showing that place's player and points with a coloured bar for how close they are to that board's leader. Tap the **Show** or **League** heading to open that board's race above the rows: every player's gap to the leader after each week, each player in their own colour (tap a line to follow one player; tap the heading again to close it). Tap a player to open their card under the row: their points on that board every episode, with each week's pick; tap the card's title to switch it to their race. If the pick-every-contestant rule is binding for them, a red line at the top of the card says so: **"Must pick: …"**, **"Can't fit all: …"** or **"Never picked: …"**. |
| **Episodes** | A strip of Ep 1–10 above swipeable episodes. Each has the five framed portraits in their studio seat order (as is the task table), with scores and how many players picked each. The winner glows in gold light that spills onto the portraits beside them; a last place 5 or more points behind the next-lowest score gives off a heavy green gas that sinks behind the portraits to the bottom of the card and spreads like dry ice, sloshing when you scroll. Then come the task-by-task table (long names show two lines; tap for the rest) and the race so far: a line chart of how far each contestant is behind the leader after every episode up to that one, as smooth curves (tap a line to follow one contestant, or a point for that week). An episode not yet scored shows only when it airs, in your time. You can swipe anywhere down to the bottom of the screen. |
| **Cast** | A strip of names in standings order above swipeable contestant pages: a header like an episode's (portrait, place, name, total, average and wins; the leader's portrait bathed in the winner's gold light). Then, for finished series, **All-time records**: every stat where they rank in the top 3 of the 105 contestants in finished series (e.g. Dara Ó Briain's "Task winner #1: won 40% of solo tasks"); the series still airing gets none until its final, because a few episodes are too few to rank. Then **Points per episode** as bars in their colour on one scale (a win's number in gold), with a dashed line at the series median; **Every task**, a heat strip of every task by type and episode (tap one for its tasks and scores); a **Performance** radar of their Prize, Filmed and Live points per episode as z-scores against all 110 contestants in Taskmaster history (rings every σ from −3σ at the centre to +3σ at the edge, the dashed ring is average; team tasks aren't counted); and their **Profile** (a short bio and personal facts: birthday, age, star sign, height (in feet and inches on US devices, cm elsewhere), birthplace, education, family, awards and more), with their face from the cast photos behind it. |

Every tab ends with a row of rubber ducks.

Swiping left on Standings' Episode 10 opens Episodes, swiping past the last episode carries on into the Cast tab, and swiping back from the first episode returns to Standings.

## Look

- **Palette:** Taskmaster red and gold on near-black.
- **Colour has one meaning each:** gold is the best result, red is the Show and blue is the League; a brighter red marks the pick-rule warning.
- **Type:** nothing is smaller than 11px.
- **Times:** every date, time and countdown is shown in the device's own time zone and format.
- **Faces:** contestants always appear as their gold-framed portraits.
- **Fonts:** as in v1, from Google Fonts: **Bungee** for headings, **Nunito** for names (Fredoka in v1, replaced for legibility), **Inter** for text and scores, **DM Mono** for labels.
- **Motion:** used for navigation (the sliding tab, a row opening), plus the winner's gold light and last place's stink gas on each episode (drawn on canvas, only while on screen). Reduced-motion settings switch these off.

## Performance

- **No framework, no build step, no dependencies.**
- **First visit:** a welcome card at the top of the Standings explains the league and the app (the host's welcome message) until it's closed (its ✕, or **Close** at its end); **Read the welcome**, under the How scoring works cards, brings it back.
- **Sharing:** a link to the site shows a preview card (the brand and this series' cast) in WhatsApp and other apps, and adding it to a home screen gives a gold "FM" icon named Fantasky.
- **Portraits** are small WebP files in `img/`, served by GitHub Pages with the site (Imgur is blocked in the UK), loaded lazily.
- **Reduced motion** settings are respected.

## Checks and screenshots

- `node tools/check-data.mjs` validates the CSV and re-checks the scoring against the worked example. It catches:
  - misspelt contestant or player names
  - missing or duplicate scores
  - gaps in scored episodes
  - ties without a tiebreak winner
  - totals that disagree with the all-time stats file, e.g. a live task entered as a prize task
- CI runs this check on every push and pull request.
- Pull requests also get a **screenshots** artifact of every view at phone and desktop size (from `tools/screenshots.mjs`); download it from the PR's Checks tab.

## Run locally

Serve the repository root (the app loads `data/…`):

```sh
npm run serve   # then open http://localhost:8000/
```
