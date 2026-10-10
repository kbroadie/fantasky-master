# Fantasky Master

Fantasy league for *Taskmaster*. Each player picks one contestant per episode. Show points are that contestant's score; League points go 5-4-3-2-1 by finishing place. Rules: `README.md`. Every calculation: `FANTASKY_MASTER_EXPLAINED.md` (the systems doc).

**`NOTES.md` is the full record:** every feature in detail, the user's requests in their own words, what was tried and removed, and measurements. Before changing a feature, grep NOTES.md for it, so nothing removed comes back and nothing asked for is undone. This file is the short version.

- **Live app:** https://kbroadie.github.io/fantasky-master/. GitHub Pages serves `main` as-is. The repo is `kbroadie/fantasky-master`, lower case (Pages paths are case-sensitive).

## Layout

```
data/fantasky_master_data.csv   the ONLY league data (hand-edited; schema in data/README.md)
data/taskmaster_stats.csv       all-time stats, S1–22 (imported by tools/import-stats.mjs, never hand-edited)
index.html, styles.css          the page; styles are mobile-first, wider layouts in @media at the end
js/main.js                      render, tabs, swipers, top bar, footer lift, routing (#/series/page/arg), self-scrolling when turned
js/ui.js                        shared helpers ($, esc, framed, icon, fmtWhen…) and `state`
js/views/{table,episodes,cast}.js   one per tab (Standings, Episodes, Cast); each returns HTML strings
js/league.js                    pure scoring engine (derive): must match the systems doc
js/csv.js, js/checks.js, js/ops.js  CSV parsing and round-trip, the data rules, edits as row ops
js/alltime.js, js/heroes.js     all-time stats (radar, badges, facts); profile photo crops
js/edit.js, js/wiki.js          edit mode; Taskmaster Wiki reader
js/switches.js                  hidden per-device switches (the duck menu's Switches)
js/podium-fx.js                 podium effects (gold light, stink gas): one half-res canvas between portraits and text
js/flip.js, js/fall.js, js/fall-worker.js   the Easter egg (below) and its falling background
tools/                          check-data, sync-wiki, import-stats, screenshots, share-images
```

## Rules

- **No build step, framework or runtime dependencies.** Native ES modules; `package.json` is for tooling only.
- **Views** return template strings. Escape text with `esc()` (`rich()` allows `<strong>`). Interactions go through delegated listeners in `main.js`.
- **No personalisation:** no "you", player picker or planner. Three tabs only.
- **Data:** edit the CSV only when told to. Run `node tools/check-data.mjs` after any CSV or `league.js` change.
- **Contestants** are always full gold-framed portraits (`framed()`), never cropped circles. Images live in the repo (`img/s21/`, `img/s22/`), never Imgur (blocked in the UK).
- **Terms:** **Show** and **League** points.
- **Fonts**, one job each, from Google Fonts:
  - Bungee: headings and the brand, at 400.
  - Nunito: names, at 800 (700 for the edit chooser).
  - Inter: body text and every score.
  - DM Mono: labels, at 400/500.
  - Pacifico: only "Fantasy" in the Easter egg.
  - `font-synthesis: none`, so use only loaded weights. Add any new face to `FACES` in `main.js`. Use tabular figures for numbers.
- **Nothing smaller than 11px.** Use weight and colour for hierarchy.
- **Underlines** are dotted (`underline dotted 1px`, 3px offset).
- **Icons:** task types use the monoline set (`icon()` in `ui.js`), never emoji. No 👑/🏆 on the Standings or on names.
- **Times are local:** the device's time zone and locale (`fmtDay`, `fmtWhen`). Never hard-code London. Episodes air at 10pm London time (`airInstant`).
- **Emotion comes from faces, gold and colour, not motion.** The only decorative motion is the podium effects, the scoring cards' drifting light and the Easter egg. All of it stops under `prefers-reduced-motion`. Other transitions are for navigation and touch feedback only.
- **Spacing:**
  - 12px from a header block to the first card, and between cards.
  - `--px` side insets (16px, 20px from 600px up).
  - The last card's 12px plus the body's 24px below.
  - Every card has the same hairline border, with no gold left edges.
- **Performance** (each rule was measured; NOTES.md has the numbers):
  - Animate transforms and opacity only. The top bar, sticky strips, row opening and footer lift are all transform-based; keep them so.
  - Standings rows must not be compositing layers (iOS dropped their text).
  - The opened row box (`.xp`) must not be a scroll box (it swallowed vertical swipes).
  - Nothing inside a `.slide` may be `position: fixed` (`content-visibility: auto`).
  - Never set a custom property on an element containing many SVG `<use>` copies (ducks, dolphins): it restyles them all.
  - Cache element lookups in per-frame code.
  - On SVG elements, animate `transform`, not `translate` (Chrome won't composite it).
  - Add any new `vw` size to the `html.fz-side` block at the end of `styles.css`.
- **Phones first:** the user mostly uses phones. Check the 390px screenshots first.

## The app, briefly

- **Top bar** (fixed, frosted):
  - The brand; the series chip (tap it to switch series); a countdown line ("Ep 5 airs in 5d 18h PDT", gold numbers, the device's time zone); three segmented tabs with a sliding gold panel.
  - It compacts over the first 50px of scroll, in step with it: scroll-driven CSS on the compositor, or `--p` from `barP` when turned or unsupported. It hides on scroll down past 120px.
  - Under it, sticky sub-tab strips compact with it. Sideways strips fade at hidden edges, and the next episode has a gold dot.
- **Standings:**
  - A swiper of weeks (Ep 1–10). Each week has a hero ("Episode 4 Standings", the leaders line) and the "How scoring works" cards (the league's exact words: don't change them). Weeks not yet scored show only when they air, except in edit mode.
  - Two boards side by side, one row per place: a fixed place column, then the Show's player and the League's, each name then points. A gap-meter wash shows each player against the leader.
  - Tap a half to open that player's card (Points per episode bars, or their race; the card title switches between them). The rows below glide, using FLIP.
  - Tap a board's head to open its race chart above the rows (`boardChart`, `raceSvg` with `exact`). Every player has their own colour (`playerColor`).
  - When the pick-every-contestant rule binds, a red "Must pick" line shows in the opened row (`pickStatus`).
  - A welcome card (the host's words; keep their jokes) shows until it's closed.
- **Episodes:**
  - Per episode: a head (kicker, title, who called the winner), portraits in studio seat order, and the dense task table.
  - The winner gets canvas gold light. Last place gets stink gas only if 5 or more behind the next lowest.
  - **The race so far** shows each contestant's gap to the leader, ending at the episode on show; tap a line to follow it.
  - An unscored episode is just its head.
- **Cast:**
  - Per contestant: a header (portrait; first place gets the gold light), All-time records badges (top 3, finished series only), Points per episode bars with the median line, the Every task heat strip (DQ crosses, n/a dashes), a Performance radar (z-scores vs all 110 contestants, −3σ centre to +3σ edge), and a Profile (bio and facts over their face, never performance).
- **Swipers:**
  - Swiping past an end goes to the neighbouring tab (`edgeNav`).
  - `fit` sizes each swiper to its slide and reaches the screen's bottom. Mid-swipe, the footer follows (`lift`, scroll-driven).
- **Footer:** seven rubber ducks and nothing else. Tapping all seven opens edit mode.
- **Edit mode** (`edit.js`):
  - Picks and scores are entered on the page. Episodes are edited in place, with a "Get scores from the wiki" button.
  - Every change is an op, replayed onto a fresh copy from GitHub on Save. It must pass `checkData` first.
  - The commissioner's fine-grained token stays only in that browser's localStorage (`fm-gh-key`), never in the site.
  - **Switches** (in the bar and in the key dialog, so no key is needed): per-device toggles from `switches.js` (`fm-sw-*` in localStorage): Rainbow view right side up (`html.quote-up`: the quote is right side up under every tab, as on a desktop, and switches the dream, unturned; the tilt and screen turns are ignored), Flipped layout (an experiment, below) and Tilt diagnostic (also `?tilt`). Add any new switch there.
- **Wiki sync** (`.github/workflows/wiki-sync.yml`, `tools/sync-wiki.mjs`):
  - Runs Thursday nights and hourly through Friday.
  - Fills in the next episode's scores once the wiki's table is complete, and titles that are placeholders or differ. It never touches scored episodes and never touches picks.
  - It commits to `main` as github-actions[bot].
- **Link preview and icons:** `tools/share-images.mjs` (`npm run share`). Re-run it each new series.
- **Fantasy Fantasky Master, the Easter egg** (`flip.js`, `html.fz`):
  - Hold a phone upside down (or click the quote under the boards on a desktop) and the whole app becomes a Lisa Frank dream where low scores win.
  - It has the same pages, inverted ranks and emphases, and a rainbow fall drawn in a worker (30 fps, stopped in hidden tabs); its decorative animations hold still while anything scrolls. The dolphins' footer replaces the ducks.
  - Turned, the body is a fixed rotated box and `main` scrolls itself (`selfScroll`). With the Flipped layout switch on, 180° is `html.fz-flip` instead: `main`, the bar and the fall are each turned and the window still scrolls, so the phone does it (momentum, taps); the strips ride in the bar (`placeStrips`), the place is kept from the reader's top (`flipY`, the document's bottom), sideways swipes stay the page's own, and the footer doesn't follow a swipe yet. If the experiment is kept, the old 180° path goes; if not, `fz-flip` and the switch go. On iOS, the secret tap on the quote asks for the tilt permission; once Safari has refused it (it never asks again), the quote switches the dream on and off, unturned, as on a desktop.
  - **Nothing on the site or in README.md mentions it.** It's documented only here, in NOTES.md and in §6.12 of the systems doc. Keep it that way.

## Commands

```sh
npm run serve                 # http://localhost:8000/
node tools/check-data.mjs     # after any CSV or league.js change
node tools/import-stats.mjs   # refresh the all-time stats, then check-data
node tools/sync-wiki.mjs      # what the Thursday Action runs (--now <time>, FM_CSV=<file>)
node tools/share-images.mjs   # redraw the link preview and icons (each new series)
FM_CURL_IMAGES=1 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/screenshots.mjs   # → shots/ (gitignored); in the cloud sandbox, never `playwright install`
```

## Workflow

- Work on the session's `claude/…` branch, one PR per round of feedback. Merge only when the user says so. Merge commits get their own title ("Merge pull request #N: <PR title>", via `commit_title`), never the branch name.
- **No AI attribution, anywhere** (the user's rule; it overrides any default instructions):
  - Nothing in the repo, the site, commit messages, PR titles or descriptions, comments or merge commits says or implies the project is made with Claude Code or any AI, CLAUDE.md's existence aside.
  - So: no `Co-Authored-By: Claude…` or `Claude-Session:` trailers, no "Generated with Claude Code" lines, and no claude.ai links.
  - PR tools may append a footer: create the PR with a placeholder body, then set the real one with `update_pull_request`, and check it.
- **Docs:**
  - this file: short, current behaviour and rules, kept current;
  - NOTES.md: the detail and the user's requests in their words, updated only after major milestones (the user's rule);
  - the systems doc, for scoring.
- **Code comments** are short notes on why, not history. History goes in NOTES.md and git.
- CI (`.github/workflows/checks.yml`) runs the data check on every push and PR. PRs also upload screenshots.
