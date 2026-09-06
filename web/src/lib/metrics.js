import { deriveTrade } from '../../../shared/tradeMath.js';

const DAY = 86400000;

export const dayKey = (d) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  const off = dt.getTimezoneOffset();
  return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 10);
};

export const monthKey = (d) => (dayKey(d) || '').slice(0, 7);

export const enrich = (t) => {
  const d = deriveTrade(t);
  return {
    ...t,
    net: d.netPnl,
    gross: d.grossPnl,
    r: d.rMultiple,
    outcome: d.outcome,
    closed: d.closed,
    holdingMinutes: d.holdingMinutes,
    dk: dayKey(t.exitDate || t.entryDate),
    mk: monthKey(t.exitDate || t.entryDate)
  };
};

const sum = (a, f) => a.reduce((acc, x) => acc + (Number(f(x)) || 0), 0);

export function summary(trades) {
  const closed = trades.filter((t) => t.closed);
  const wins = closed.filter((t) => t.net > 0);
  const losses = closed.filter((t) => t.net < 0);
  const be = closed.filter((t) => t.net === 0);

  const grossProfit = sum(wins, (t) => t.net);
  const grossLoss = Math.abs(sum(losses, (t) => t.net));
  const net = sum(closed, (t) => t.net);
  const totalCharges = sum(closed, (t) => t.charges);

  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const expectancy = closed.length ? net / closed.length : 0;
  const payoff = avgLoss > 0 ? avgWin / avgLoss : 0;

  const rTrade = closed.filter((t) => t.r != null);
  const avgR = rTrade.length ? sum(rTrade, (t) => t.r) / rTrade.length : 0;
  const expectancyR = rTrade.length ? sum(rTrade, (t) => t.r) / closed.length || 0 : 0;

  const largestWin = wins.length ? Math.max(...wins.map((t) => t.net)) : 0;
  const largestLoss = losses.length ? Math.min(...losses.map((t) => t.net)) : 0;

  // streaks (chronological)
  const chrono = [...closed].sort(
    (a, b) => new Date(a.exitDate || 0) - new Date(b.exitDate || 0)
  );
  let cur = 0;
  let curType = null;
  let longestWin = 0;
  let longestLoss = 0;
  let run = 0;
  for (const t of chrono) {
    const type = t.net > 0 ? 'W' : t.net < 0 ? 'L' : 'B';
    if (type === curType && type !== 'B') run += 1;
    else {
      run = type === 'B' ? 0 : 1;
      curType = type === 'B' ? null : type;
    }
    if (type === 'W') longestWin = Math.max(longestWin, run);
    if (type === 'L') longestLoss = Math.max(longestLoss, run);
  }
  // current streak = trailing run
  cur = 0;
  for (let i = chrono.length - 1; i >= 0; i--) {
    const type = chrono[i].net > 0 ? 'W' : chrono[i].net < 0 ? 'L' : 'B';
    if (type === 'B') break;
    if (cur === 0) curType = type;
    if (type !== curType) break;
    cur += 1;
  }

  const holding = closed.filter((t) => t.holdingMinutes != null);
  const avgHolding = holding.length ? sum(holding, (t) => t.holdingMinutes) / holding.length : 0;

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.length - closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: be.length,
    net,
    grossProfit,
    grossLoss,
    totalCharges,
    winRate,
    profitFactor,
    expectancy,
    expectancyR,
    avgWin,
    avgLoss,
    payoff,
    avgR,
    largestWin,
    largestLoss,
    currentStreak: cur,
    currentStreakType: curType,
    longestWin,
    longestLoss,
    avgHolding
  };
}

export function equityCurve(trades, { startCapital = 0 } = {}) {
  const closed = trades
    .filter((t) => t.closed)
    .sort((a, b) => new Date(a.exitDate || 0) - new Date(b.exitDate || 0));
  let cum = startCapital;
  let peak = startCapital;
  let maxDD = 0;
  let maxDDPct = 0;
  let curDD = 0;
  const points = [];
  for (const t of closed) {
    cum += t.net;
    peak = Math.max(peak, cum);
    const dd = peak - cum;
    maxDD = Math.max(maxDD, dd);
    if (peak > 0) maxDDPct = Math.max(maxDDPct, (dd / peak) * 100);
    curDD = dd;
    points.push({
      date: dayKey(t.exitDate),
      ts: new Date(t.exitDate).getTime(),
      net: t.net,
      equity: cum,
      drawdown: dd,
      symbol: t.symbol,
      id: t.id
    });
  }
  return { points, finalEquity: cum, maxDrawdown: maxDD, maxDrawdownPct: maxDDPct, currentDrawdown: curDD };
}

export function groupBy(trades, keyFn, labelFn = (k) => k) {
  const map = new Map();
  for (const t of trades) {
    if (!t.closed) continue;
    const keys = keyFn(t);
    if (keys == null) continue;
    const arr = Array.isArray(keys) ? keys : [keys];
    for (const k of arr) {
      if (k == null || k === '') continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    }
  }
  return [...map.entries()]
    .map(([key, rows]) => {
      const s = summary(rows);
      return { key: labelFn(key) || '—', raw: key, ...s, trades: rows.length };
    })
    .sort((a, b) => b.net - a.net);
}

export function dailyPnl(trades) {
  const map = new Map();
  for (const t of trades) {
    if (!t.closed || !t.dk) continue;
    if (!map.has(t.dk)) map.set(t.dk, { date: t.dk, net: 0, trades: 0, wins: 0, charges: 0 });
    const e = map.get(t.dk);
    e.net += t.net;
    e.charges += t.charges || 0;
    e.trades += 1;
    if (t.net > 0) e.wins += 1;
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function monthlyPnl(trades) {
  const map = new Map();
  for (const t of trades) {
    if (!t.closed || !t.mk) continue;
    if (!map.has(t.mk)) map.set(t.mk, { month: t.mk, net: 0, trades: 0, wins: 0 });
    const e = map.get(t.mk);
    e.net += t.net;
    e.trades += 1;
    if (t.net > 0) e.wins += 1;
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weekdayStats(trades) {
  const arr = WEEKDAYS.map((d) => ({ day: d, net: 0, trades: 0, wins: 0 }));
  for (const t of trades) {
    if (!t.closed) continue;
    const dt = new Date(t.exitDate || t.entryDate);
    if (isNaN(dt.getTime())) continue;
    const i = dt.getDay();
    arr[i].net += t.net;
    arr[i].trades += 1;
    if (t.net > 0) arr[i].wins += 1;
  }
  return arr;
}

export function hourStats(trades) {
  const arr = Array.from({ length: 11 }, (_, i) => ({ hour: `${9 + i}:00`, net: 0, trades: 0 }));
  for (const t of trades) {
    if (!t.closed) continue;
    const dt = new Date(t.entryDate);
    if (isNaN(dt.getTime())) continue;
    const h = dt.getHours();
    const idx = h - 9;
    if (idx < 0 || idx > 10) continue;
    arr[idx].net += t.net;
    arr[idx].trades += 1;
  }
  return arr;
}

export function rDistribution(trades) {
  const buckets = [
    { label: '< -2R', min: -Infinity, max: -2 },
    { label: '-2 to -1R', min: -2, max: -1 },
    { label: '-1 to 0R', min: -1, max: 0 },
    { label: '0 to 1R', min: 0, max: 1 },
    { label: '1 to 2R', min: 1, max: 2 },
    { label: '2 to 3R', min: 2, max: 3 },
    { label: '> 3R', min: 3, max: Infinity }
  ];
  const out = buckets.map((b) => ({ ...b, count: 0 }));
  for (const t of trades) {
    if (!t.closed || t.r == null) continue;
    const i = buckets.findIndex((b) => t.r >= b.min && t.r < b.max);
    if (i >= 0) out[i].count += 1;
  }
  return out;
}

/** Mood (1-5) vs that day's trading P&L — the psychology edge. */
export function moodVsPnl(daily, entries) {
  const pnlByDate = new Map(daily.map((d) => [d.date, d.net]));
  const buckets = new Map();
  for (const e of entries) {
    const pnl = pnlByDate.get(e.date);
    if (pnl == null || !e.mood) continue;
    if (!buckets.has(e.mood)) buckets.set(e.mood, { mood: e.mood, net: 0, days: 0, wins: 0 });
    const b = buckets.get(e.mood);
    b.net += pnl;
    b.days += 1;
    if (pnl > 0) b.wins += 1;
  }
  return [...buckets.values()].sort((a, b) => a.mood - b.mood);
}

/** Consecutive-day journaling streak ending today (or yesterday). */
export function journalStreak(dates) {

  const set = new Set(dates);
  if (!set.size) return { current: 0, longest: 0, today: false };
  const today = dayKey(new Date());
  const sorted = [...set].sort();
  let longest = 0;
  let runPrev = 0;
  let prev = null;
  for (const d of sorted) {
    if (prev && new Date(d) - new Date(prev) === DAY) runPrev += 1;
    else runPrev = 1;
    longest = Math.max(longest, runPrev);
    prev = d;
  }
  let current = 0;
  let cursor = new Date();
  if (!set.has(today)) cursor = new Date(Date.now() - DAY);
  while (set.has(dayKey(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return { current, longest, today: set.has(today) };
}

export function filterTrades(trades, f = {}) {
  const from = f.from ? new Date(f.from + 'T00:00:00').getTime() : null;
  const to = f.to ? new Date(f.to + 'T23:59:59').getTime() : null;
  return trades.filter((t) => {
    const ts = new Date(t.exitDate || t.entryDate).getTime();
    if (from && ts && ts < from) return false;
    if (to && ts && ts > to) return false;
    if (f.symbol && !(t.symbol || '').toUpperCase().includes(f.symbol.toUpperCase())) return false;
    if (f.strategy && t.strategy !== f.strategy) return false;
    if (f.instrument && t.instrument !== f.instrument) return false;
    if (f.direction && t.direction !== f.direction) return false;
    if (f.outcome) {
      const o = t.closed ? (t.net > 0 ? 'WIN' : t.net < 0 ? 'LOSS' : 'BE') : 'OPEN';
      if (o !== f.outcome) return false;
    }
    if (f.tag) {
      const tags = Array.isArray(t.tags) ? t.tags : [];
      const mistakes = Array.isArray(t.mistakes) ? t.mistakes : [];
      const emos = Array.isArray(t.emotions) ? t.emotions : [];
      if (![...tags, ...mistakes, ...emos].includes(f.tag)) return false;
    }
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = [t.symbol, t.strategy, t.setup, t.notes, ...(t.tags || [])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ================= v2: professional layer =================

export const GRADE_LABELS = { 5: 'A+', 4: 'A', 3: 'B', 2: 'C', 1: 'D' };

/** P&L broken down by the setup grade (rating 1-5) given at review time. */
export function ratingBreakdown(trades) {
  return groupBy(trades, (t) => (t.rating > 0 ? t.rating : null), (k) => GRADE_LABELS[k] || k).sort(
    (a, b) => Number(b.raw) - Number(a.raw)
  );
}

/** P&L by holding-time bucket — exposes overtrading vs patience. */
export function holdingBuckets(trades) {
  const defs = [
    { label: '< 15m', max: 15 },
    { label: '15–60m', max: 60 },
    { label: '1–3h', max: 180 },
    { label: '> 3h', max: Infinity }
  ];
  const out = defs.map((d) => ({ ...d, net: 0, trades: 0, wins: 0 }));
  for (const t of trades) {
    if (!t.closed || t.holdingMinutes == null) continue;
    const i = defs.findIndex((d) => t.holdingMinutes < d.max);
    if (i < 0) continue;
    out[i].net += t.net;
    out[i].trades += 1;
    if (t.net > 0) out[i].wins += 1;
  }
  return out;
}

const HEAT_DAYS = [1, 2, 3, 4, 5, 6]; // Mon..Sat
const HEAT_HOURS = [9, 10, 11, 12, 13, 14, 15];

/** Weekday x entry-hour net P&L matrix. */
export function sessionHeatmap(trades) {
  const grid = new Map(HEAT_DAYS.map((d) => [d, new Map(HEAT_HOURS.map((h) => [h, { net: 0, trades: 0 }]))]));
  for (const t of trades) {
    if (!t.closed) continue;
    const dt = new Date(t.entryDate);
    if (isNaN(dt.getTime())) continue;
    const row = grid.get(dt.getDay());
    if (!row) continue;
    const cell = row.get(dt.getHours());
    if (!cell) continue;
    cell.net += t.net;
    cell.trades += 1;
  }
  const maxAbs = Math.max(
    1,
    ...[...grid.values()].flatMap((row) => [...row.values()].map((c) => Math.abs(c.net)))
  );
  return {
    days: HEAT_DAYS,
    hours: HEAT_HOURS,
    maxAbs,
    cell: (d, h) => grid.get(d)?.get(h) || { net: 0, trades: 0 }
  };
}

/**
 * Discipline score (0-100) — the habit layer of a professional trader:
 *   plan adherence (no mistakes tagged)      35%
 *   risk management (stop loss on entries)   25%
 *   journaling on trading days               25%
 *   habit checklist adherence                15%
 * Parts without data drop out and re-weight the rest.
 */
export function disciplineScore(trades, entries = [], habits = []) {
  const closed = trades.filter((t) => t.closed);
  const parts = {
    plan: closed.length
      ? closed.filter((t) => !(Array.isArray(t.mistakes) ? t.mistakes : []).length).length / closed.length
      : null,
    risk: trades.length ? trades.filter((t) => Number(t.stopLoss) > 0).length / trades.length : null
  };

  const tradingDays = new Set(closed.map((t) => t.dk).filter(Boolean));
  const entryDays = new Set(entries.map((e) => e.date));
  parts.journal = tradingDays.size
    ? [...tradingDays].filter((d) => entryDays.has(d)).length / tradingDays.size
    : null;

  const recent = entries.slice(0, 30);
  if (recent.length && habits.length) {
    let done = 0;
    let total = 0;
    for (const e of recent) {
      const h = e.habits || {};
      for (const hb of habits) {
        total += 1;
        if (h[hb.id]) done += 1;
      }
    }
    parts.habits = total ? done / total : null;
  } else parts.habits = null;

  const active = [
    ['plan', parts.plan, 0.35],
    ['risk', parts.risk, 0.25],
    ['journal', parts.journal, 0.25],
    ['habits', parts.habits, 0.15]
  ].filter(([, v]) => v != null);
  const wSum = active.reduce((a, [, , w]) => a + w, 0) || 1;
  const score = active.length ? Math.round(active.reduce((a, [, v, w]) => a + v * (w / wSum), 0) * 100) : null;
  const grade =
    score == null ? '—' : score >= 85 ? 'Elite' : score >= 70 ? 'Strong' : score >= 50 ? 'Slipping' : 'Rebuild';
  return { score, grade, parts };
}

export const DISCIPLINE_PARTS = [
  { key: 'plan', label: 'Plan adherence', weight: '35%', hint: 'closed trades without a tagged mistake' },
  { key: 'risk', label: 'Risk management', weight: '25%', hint: 'entries with a stop loss placed' },
  { key: 'journal', label: 'Journaling', weight: '25%', hint: 'trading days with a life entry' },
  { key: 'habits', label: 'Habits', weight: '15%', hint: 'daily habit checklist completion' }
];

/** Average mood on green vs red trading days — the psychology edge, quantified. */
export function moodOnGreenRedDays(daily, entries) {
  const pnlByDate = new Map(daily.map((d) => [d.date, d.net]));
  let gSum = 0;
  let gN = 0;
  let rSum = 0;
  let rN = 0;
  for (const e of entries) {
    const pnl = pnlByDate.get(e.date);
    if (pnl == null || !e.mood) continue;
    if (pnl >= 0) {
      gSum += e.mood;
      gN += 1;
    } else {
      rSum += e.mood;
      rN += 1;
    }
  }
  return {
    green: gN ? { avg: gSum / gN, days: gN } : null,
    red: rN ? { avg: rSum / rN, days: rN } : null
  };
}
