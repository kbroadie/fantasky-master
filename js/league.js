// League engine: a pure, deterministic calculator over the data in data.js.
// Mirrors the rules in README.md and FANTASKY_MASTER_EXPLAINED.md.

export const EPISODES = 10;
export const AIR_TZ = "Europe/London";
export const AIR_HOUR = 22;

// ── Time ─────────────────────────────────────────────────────────────────────

const partsFmt = new Map();
function tzParts(date, tz) {
  let f = partsFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
    });
    partsFmt.set(tz, f);
  }
  const o = {};
  for (const p of f.formatToParts(date)) if (p.type !== "literal") o[p.type] = +p.value;
  return o;
}

/** Offset of `tz` from UTC at `date`, in minutes. */
export function tzOffset(date, tz) {
  const p = tzParts(date, tz);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime()) / 60000;
}

/** Wall-clock time in a named zone → absolute Date (DST-aware). */
export function zonedTimeToDate(y, m, d, h, mi, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - tzOffset(new Date(guess), tz) * 60000;
  t = guess - tzOffset(new Date(t), tz) * 60000; // second pass settles DST edges
  return new Date(t);
}

export function airInstant(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return zonedTimeToDate(y, m, d, AIR_HOUR, 0, AIR_TZ);
}

export function currentSeriesKey(series, now) {
  const keys = Object.keys(series).map(Number).sort((a, b) => a - b);
  const live = keys.filter((k) => airInstant(series[k].episodes[0].date) <= now);
  return String(live.length ? live.at(-1) : keys.at(-1));
}

// ── Ranking ──────────────────────────────────────────────────────────────────

/** Standard competition ranking ("1-2-2-4") over a best-first sorted list. */
export function rankWithTies(sorted, key) {
  const ranks = new Map();
  sorted.forEach((item, i) => {
    const prev = sorted[i - 1];
    ranks.set(item, i && key(item) === key(prev) ? ranks.get(prev) : i + 1);
  });
  return ranks;
}

// ── Derivation ───────────────────────────────────────────────────────────────

export function derive(raw, now = new Date()) {
  const names = raw.cast.map((c) => c.key);
  const idx = Object.fromEntries(names.map((n, i) => [n, i]));
  const cast = Object.fromEntries(raw.cast.map((c) => [c.key, c]));

  const episodes = raw.episodes.map((e) => ({ ...e, air: airInstant(e.date) }));
  const weeksAired = episodes.filter((e) => e.air <= now).length;
  const weeksScored = raw.tasks.reduce((m, t) => Math.max(m, t.ep), 0);
  const nextEp = episodes.find((e) => e.air > now) || null;

  // EPS[c][e] and TY[c][type]
  const EPS = {}, TY = {};
  for (const n of names) {
    EPS[n] = Array(EPISODES + 1).fill(0);
    TY[n] = { P: 0, F: 0, T: 0, L: 0 };
  }
  for (const t of raw.tasks) names.forEach((n, i) => {
    EPS[n][t.ep] += t.s[i];
    TY[n][t.t] += t.s[i];
  });

  // Placement points per scored episode, with tiebreak adjustment.
  const rankPts = {}, placing = {}, winners = {};
  for (let e = 1; e <= weeksScored; e++) {
    const sorted = [...names].sort((a, b) => EPS[b][e] - EPS[a][e]);
    const r = rankWithTies(sorted, (n) => EPS[n][e]);
    const tb = raw.episodes[e - 1]?.tb;
    const tied = names.filter((n) => r.get(n) === 1);
    if (tb && tied.length > 1 && tied.includes(tb)) for (const n of tied) if (n !== tb) r.set(n, 2);
    placing[e] = Object.fromEntries(names.map((n) => [n, r.get(n)]));
    rankPts[e] = Object.fromEntries(names.map((n) => [n, 6 - r.get(n)]));
    const winner = tied.length > 1 && tb && tied.includes(tb) ? tb : tied[0];
    winners[e] = { winner, tiebreak: tied.length > 1, tied, top: EPS[tied[0]][e] };
  }

  // Players: the roster plus anyone with picks.
  const allPlayers = [...new Set([...(raw.players || []), ...Object.keys(raw.picks)])];
  const pickOf = (p, e) => raw.picks[p]?.[e - 1] || null;
  const active = allPlayers.filter((p) => (raw.picks[p] || []).some(Boolean));
  const inactive = allPlayers.filter((p) => !active.includes(p));

  function boardsAsOf(w) {
    const show = {}, league = {};
    for (const p of allPlayers) {
      show[p] = 0; league[p] = 0;
      for (let e = 1; e <= w; e++) {
        const c = pickOf(p, e);
        if (c && idx[c] !== undefined) { show[p] += EPS[c][e]; league[p] += rankPts[e][c]; }
      }
    }
    const rank = (pts) => {
      const sorted = [...allPlayers].sort((a, b) =>
        (active.includes(b) - active.includes(a)) || pts[b] - pts[a]);
      return rankWithTies(sorted, (p) => `${active.includes(p)}:${pts[p]}`);
    };
    return { show, league, showRank: rank(show), leagueRank: rank(league) };
  }

  const history = Array.from({ length: weeksScored }, (_, i) => boardsAsOf(i + 1));
  const cur = weeksScored ? history.at(-1) : boardsAsOf(0);
  const prev = weeksScored > 1 ? history.at(-2) : cur;

  const players = active.map((p) => {
    const weeks = [];
    for (let e = 1; e <= EPISODES; e++) {
      const c = pickOf(p, e);
      const scored = e <= weeksScored;
      weeks.push({
        ep: e, pick: c, scored,
        show: c && scored ? EPS[c][e] : null,
        league: c && scored ? rankPts[e][c] : null,
        won: !!(c && scored && winners[e].winner === c),
      });
    }
    const played = weeks.filter((w) => w.show != null);
    const byShow = [...played].sort((a, b) => b.show - a.show);
    return {
      name: p, weeks,
      show: cur.show[p], league: cur.league[p],
      showRank: cur.showRank.get(p), leagueRank: cur.leagueRank.get(p),
      showDelta: prev.showRank.get(p) - cur.showRank.get(p),
      leagueDelta: prev.leagueRank.get(p) - cur.leagueRank.get(p),
      history: history.map((h) => ({ show: h.show[p], league: h.league[p], showRank: h.showRank.get(p), leagueRank: h.leagueRank.get(p) })),
      hits: played.filter((w) => w.won).length,
      best: byShow[0] || null,
      worst: byShow.at(-1) || null,
      status: pickStatus(names, weeks.filter((w) => w.ep <= weeksScored).map((w) => w.pick), weeksScored),
    };
  });
  const byName = Object.fromEntries(players.map((p) => [p.name, p]));

  // How the league fared each scored week.
  const weekly = {};
  for (let e = 1; e <= weeksScored; e++) {
    const voters = players.filter((p) => p.weeks[e - 1].pick);
    const by = Object.fromEntries(names.map((n) => [n, []]));
    for (const p of voters) by[p.weeks[e - 1].pick].push(p.name);
    weekly[e] = {
      voters: voters.length,
      by,
      hits: by[winners[e].winner],
    };
  }

  // Contestant stats
  const seriesTotal = Object.fromEntries(names.map((n) => [n, EPS[n].reduce((a, b) => a + b, 0)]));
  const order = [...names].sort((a, b) => seriesTotal[b] - seriesTotal[a]);
  const catRank = (f) => rankWithTies([...names].sort((a, b) => f(b) - f(a)), f);
  const prizeR = catRank((n) => TY[n].P), filmedR = catRank((n) => TY[n].F + TY[n].T), liveR = catRank((n) => TY[n].L);
  const seriesRank = rankWithTies(order, (n) => seriesTotal[n]);
  const contestants = names.map((n) => {
    const eps = EPS[n].slice(1, weeksScored + 1);
    return {
      ...cast[n], key: n,
      total: seriesTotal[n],
      rank: seriesRank.get(n),
      avg: weeksScored ? seriesTotal[n] / weeksScored : 0,
      prizeRank: prizeR.get(n), filmedRank: filmedR.get(n), liveRank: liveR.get(n),
      ty: TY[n],
      eps: EPS[n].slice(1),
      best: eps.length ? Math.max(...eps) : 0,
      worst: eps.length ? Math.min(...eps) : 0,
      wins: Object.values(winners).filter((w) => w.winner === n).length,
    };
  });

  return {
    raw, names, idx, cast, episodes, EPS, TY, rankPts, placing, winners,
    weeksAired, weeksScored, nextEp, players, byName, inactive, contestants, weekly, allPlayers,
    complete: weeksAired === EPISODES,
    epTasks: (e) => raw.tasks.filter((t) => t.ep === e),
  };
}

/** The pick-every-contestant rule, reported only when mathematically binding. */
export function pickStatus(names, knownPicks, weeksKnown) {
  const known = new Set(knownPicks.filter(Boolean));
  const needed = names.filter((n) => !known.has(n));
  const left = EPISODES - weeksKnown;
  if (!needed.length || needed.length < left) return null;
  if (left === 0) return { kind: "never", needed };
  if (needed.length === left) return { kind: "must", needed };
  return { kind: "cannot", needed };
}
