# Fantasky Master

Fantasy league for *Taskmaster*. Each player picks one contestant per episode. Show points are that contestant's score; League points go 5-4-3-2-1 by finishing place. Rules: `README.md`. Every calculation: `FANTASKY_MASTER_EXPLAINED.md` (the systems doc).

**`NOTES.md` is the full record:** every feature in detail, the user's requests in their own words, what was tried and removed, and measurements. Before changing a feature, grep NOTES.md for it, so nothing removed comes back and nothing asked for is undone. This file is the short version.

- **Live app:** https://kbroadie.github.io/fantasky-master/. GitHub Pages serves `main` as-is. The repo is `kbroadie/fantasky-master`, lower case (Pages paths are case-sensitive).

## Layout

```
data/fantasky_master_data.csv   the ONLY league data (hand-edited; schema in data/README.md)
data/taskmaster_stats.csv       all-time stats, S1–22 (imported by tools/import-stats.mjs, never hand-edited)
index.html, styles.css          the page; styles are mobile-first, wider layouts in @media at the end
js/main.js                      render, tabs, swipers, top bar, footer lift, routing (#/series/page/arg)
js/ui.js                        shared helpers ($, esc, framed, icon, fmtWhen…) and `state`
js/views/{table,episodes,cast}.js   one per tab (Standings, Episodes, Cast); each returns HTML strings
js/league.js                    pure scoring engine (derive): must match the systems doc
js/csv.js, js/checks.js, js/ops.js  CSV parsing and round-trip, the data rules, edits as row ops
js/alltime.js, js/heroes.js     all-time stats (radar, badges, facts); profile photo crops
js/edit.js, js/wiki.js          edit mode; Taskmaster Wiki reader
js/switches.js                  hidden per-device settings (Maurice Moss's cards): toggles and sliders, applied live
js/version.js                   the PR number this page came in with (set in every PR), and the latest merged one
js/tune.js                      auto-tune: the heavy effects time their frames and step their quality to the device
js/tools.js                     diagnostics: the frame rate graphs (draggable)
js/podium-fx.js                 podium effects (gold light, stink gas): one canvas between portraits and text
js/flip.js, js/fall.js, js/fall-worker.js   Fantastikal Delusion (below): switching it, and its falling background
js/slam-fx.js                   Slam's dust, sparks, smoke and shine: a live canvas named in its transition
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
  - Pacifico: only "Fantastikal" in Fantastikal Delusion's brand.
  - `font-synthesis: none`, so use only loaded weights. Add any new face to `FACES` in `main.js`. Use tabular figures for numbers.
- **Nothing smaller than 11px.** Use weight and colour for hierarchy.
- **Underlines** are dotted (`underline dotted 1px`, 3px offset).
- **Icons:** task types use the monoline set (`icon()` in `ui.js`), never emoji. No 👑/🏆 on the Standings or on names.
- **Times are local:** the device's time zone and locale (`fmtDay`, `fmtWhen`). Never hard-code London. Episodes air at 10pm London time (`airInstant`).
- **Emotion comes from faces, gold and colour, not motion.** The only decorative motion is the podium effects, the scoring cards' drifting light and Fantastikal Delusion. All of it stops under `prefers-reduced-motion`, and **all of it is at its lowest quality by default, and off but for the podium effects, Fantasy Land's footer** (its sea, ducks and dolphins) **and its transition** (Slam in Chromium, Iris elsewhere): frame pacing comes first (the user's rule); Moss's cards turn it on and up. Other transitions are for navigation and touch feedback only.
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
  - On SVG elements, animate `transform`, not the separate `translate`, `rotate` or `scale` (Chrome won't composite them: the dolphins' `rotate` kept Fantasy Land's main thread restyling every frame, ~2.1s per 3.3s at a 4× throttled CPU).
  - Measure only what's near the screen: reading a size inside an off-screen slide lays out that whole slide (`content-visibility`); `fitTitles` measures the slides on show and either side.
- **Phones first:** the user mostly uses phones. Check the 390px screenshots first.

## The app, briefly

- **Top bar** (fixed, frosted):
  - The brand; the series chip (tap it to switch series); a countdown line ("Ep 5 airs in 5d 18h PDT", gold numbers, the device's time zone); three segmented tabs with a sliding gold panel.
  - It compacts over the first 50px of scroll, in step with it: scroll-driven CSS on the compositor, or `--p` from `barP` where unsupported. It hides on scroll down past 120px.
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
  - **Maurice Moss, an Easter egg** (`cast.js`, `state.moss`): tapping Richard Ayoade's portrait (Series 22) renames him Maurice Moss and swaps his cards for the hidden settings; tap again to go back. Nothing on the site mentions it. Tiles, two to a row, with no descriptions (`CARDS` in `switches.js`; `fm-sw-*` in localStorage, per device; every effect defaults to its lowest quality, and off but for the podium effects and the Footer: resolutions 25%, the fall at 15 fps; the transition is Slam in Chromium and Iris elsewhere, Safari and every iOS browser, `CHROMIUM` in `switches.js`). Each kind of setting has its control: an effect's on/off a switch in its card's head; a small fixed set segmented buttons (`steps`: the resolutions as 25–100%, the fall's frame rate; `choice`); a strength a gold slider whose value is dim as designed and gold once changed, and a tap on it resets it. An effect with settings spans the row; a lone slider is a tile with its value in the head. The Defaults card says how many settings are changed, and its Reset is off when none are. The Revision card shows the PR this page came in with (`PR` in `version.js`) and says "Latest" or "#N is live: reload", from the latest "Merge pull request #N" on `main` (GitHub's API, asked once a visit when Moss's cards show). Only the cards for the view on show appear (`view: "fz"`, `cardsShown`). The Fantasy Land card has the dream's switch in its head and the Transition grid under it (Off last, across the row), so a pick is tried at once, and Moss's own page previews the settings live: the fall behind his see-through cards, their opacity and the podium light on his header (he leads Fantasy Land's standings). Each applies live: a class while a toggle is off or a CSS variable (`apply`), or an `fm-switch` event the effect listens for (`onSwitch`). **Auto-tune** (`tune.js`, off by default; switched on, it starts at the lowest quality and climbs): the falling background (its worker's frames and drawing time, and the page's own frames for 4s after it starts, once a visit unless a step down needs checking: watching makes the page draw every frame) and the podium effects (their ms a frame) report each second; three great seconds climb a level (the fall: 15, 20 then 30 fps at 25%, then 50%, then 60 fps, then 75% and 100%; the podiums: resolution), two bad ones step down; a level that fails within 10s of being reached is never tried again on that device (`_fallBest`, `_podBest`); never during a transition. Frame rates are only those a 60 or 120Hz screen divides evenly (15, 20, 30, 60), for even pacing. The levels are kept per device (`fm-auto`); a setting chosen on the cards is pinned (`fm-pinned`) and left alone; `val()` is what an effect uses; an Auto tag marks what it chose; Defaults starts it again. The cards: Fantasy Land and its Transition (below), Auto-tune, Frame rate (graphs of the main thread's fps and frame time, `tools.js`, draggable anywhere, the place kept per device), Podium effects (on, resolution, light, gas) and Scoring cards (their light); in Fantasy Land also Background effects (the fall: on, resolution, fps, streaks, figures, brightness, speed), Footer (`no-sea`, on: the rolling sea, the ducks bobbing on it and the leaping dolphins; off, still and the dolphins hidden), Decorations (`no-deco`, off: the sparkles' twinkle, the glint on Fantasy, the sliding tab rainbow; off, all still) and Card opacity (`--fz-a`). Add any new setting there.
  - Per contestant: a header (portrait; first place gets the gold light), All-time records badges (top 3, finished series only), Points per episode bars with the median line, the Every task heat strip (DQ crosses, n/a dashes), a Performance radar (z-scores vs all 110 contestants, −3σ centre to +3σ edge), and a Profile (bio and facts over their face, never performance).
- **Swipers:**
  - Swiping past an end goes to the neighbouring tab (`edgeNav`).
  - `fit` sizes each swiper to its slide and reaches the screen's bottom. Mid-swipe, the footer follows (`lift`, scroll-driven).
- **Footer:** seven rubber ducks and nothing else, in a 136px band under an 8px margin, the dolphins' footer's height, so both views end alike. They sit low, where they float on the dolphins' sea in Fantasy Land, riding its waves (the Footer card): each bob starts where the wave under it is (`ducksOnWaves`), so their bottoms stay in the water. Embrace Failure and the ducks pass behind the slides mid-swipe (`.swiper` z-index). Tapping all seven opens edit mode.
  - **It moves with the page's height** (`footGlide`, every part `lift` moves): when a slide on show changes size at once (a row opening, a card switching), its parts are moved at once and glide from where they were on the screen, in step with the rows (FLIP, by `transform`, added together); a closing row takes them up with it (`slideShut`) before the page shortens. A height that animates (the race chart, the scoring cards) they already follow frame by frame. Not on navigation, a new render or a transition.
- **Edit mode** (`edit.js`):
  - Picks and scores are entered on the page. Episodes are edited in place, with a "Get scores from the wiki" button.
  - Every change is an op, replayed onto a fresh copy from GitHub on Save. It must pass `checkData` first.
  - The commissioner's fine-grained token stays only in that browser's localStorage (`fm-gh-key`), never in the site.
- **Wiki sync** (`.github/workflows/wiki-sync.yml`, `tools/sync-wiki.mjs`):
  - Runs Thursday nights and hourly through Friday.
  - Fills in the next episode's scores once the wiki's table is complete, and titles that are placeholders or differ. It never touches scored episodes and never touches picks.
  - It commits to `main` as github-actions[bot].
- **Link preview and icons:** `tools/share-images.mjs` (`npm run share`). Re-run it each new series.
- **Fantastikal Delusion, low scores win** (`flip.js`, `html.fz`; "Fantasy mode" or "Fantasy Land" in the code): a feature, not an Easter egg (on request): a happy, deluded place for the bottom of the table, so low scorers stay engaged.
  - **"Embrace Failure"** under every tab (`#dq`, `EMBRACE` in `table.js`), a pill with a rainbow hairline and rainbow DM Mono caps, switches the whole app into a Lisa Frank dream where low scores win; there it reads **"Embrace Success"** in the normal view's gold, and switches back. What was tapped stays where it was on the screen. The masthead there reads **"Fantastikal DELUSION"** ("Fantastikal" in rainbow Pacifico, `.fz-word`; `DELUSION` in Bungee, `.fz-del`, in place of `FANTASKY MASTER`). The contestants' quotes that were the way in are gone (on request). The switch animates by the browser's View Transitions (`document.startViewTransition`, `html[data-vt]`), after film's dream sequences, chosen on Moss's Transition card (by default Slam in Chromium, Iris elsewhere): Off (an instant switch), Iris (a circle opens from the point tapped; Zoom and Vertigo centre there too, `tapAt` in `main.js`), Ripple (the classic sitcom dream ripple: large ripples both ways, as if through a lagoon's surface, over a 1.5s cross-fade; an SVG displacement filter, `#vt-wave` in `index.html`), Blur (a rack blur), Lens (edges blur into a halo as the other opens from the centre), Flare (a prismatic glare), Swirl (a vortex), Slow (a slow-motion dissolve), Flash (three white flashes, no more than three a second), Grade (a wipe with a colour-grade shift), Zoom (into the tapped point and out), Roll (upside down), Tilt (up to the sky and back down), Vertigo (a dolly zoom around the tapped thing, which holds still), Dream (blur and colour), Turn (the players' halves on screen and the Cast tabs glide to their inverted places; `nameMovers`), Slam (on the Standings only, else Iris: the camera zooms in on last place's row, which shakes loose, dropping dust in its old colours, and lifts out as the page scrolls to the top behind it and the other rows slide down a place, then slams down as the new top row in sparks and smoke, with a shine across it (`slam-fx.js`, its clock the transition's own); the screen shakes and a shockwave flips each row as the new colours radiate from the impact; the week's blocks, its hero and board, are pictured whole, and the bar open with solid glass (`.vt-open`, `.vt-glass`), so the page scrolls in its old style with the new layout and only the style changes, a circle from the impact on each at one speed; its last frame matches the page it lands on pixel for pixel; `slamAfter` writes its keyframes from where the rows are). Every curve is an easy ease, `cubic-bezier(.33, 0, .67, 1)`; all but Ripple and Lens animate only transform, opacity, clip-path and filter. No animation under reduced motion or without the API. It's always right side up: the turned page, the motion sensors and their permission were removed on request (the phone's own scrolling and taps beat every turned version; NOTES.md has the history).
  - It has the same pages, inverted ranks and emphases, and a rainbow fall drawn in a worker (off by default, and 15 fps at 25% when first turned on; stopped in hidden tabs); its footer's sea, ducks and dolphins move (the Footer card); its other decorations are still unless Moss's Decorations card turns them on, and then hold still while anything scrolls. The dolphins' footer comes in under the ducks. Its titles are plain, not rainbow.
  - README's "Using the site" describes it, and §6.12 of the systems doc has its rules.

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

- Work on the session's `claude/…` branch, one PR per round of feedback. **Set `PR` in `js/version.js` to that PR's number in every PR** (create the PR, then push the number), so Moss's Revision card knows the page is the latest. Merge only when the user says so. Merge commits get their own title ("Merge pull request #N: <PR title>", via `commit_title`), never the branch name.
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
