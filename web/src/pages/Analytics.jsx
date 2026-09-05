import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrades, useEntries, MOODS, todayKey } from '../lib/hooks.js';
import {
  summary, equityCurve, groupBy, monthlyPnl, weekdayStats, hourStats,
  rDistribution, moodVsPnl, dailyPnl, filterTrades, journalStreak
} from '../lib/metrics.js';
import { Card, SectionTitle, Stat, Chip, Money, EmptyState, Field } from '../components/ui.jsx';
import { EquityChart, PnlBars, Donut, LineSeries } from '../components/Charts.jsx';
import { BarChart3, Lightbulb } from 'lucide-react';

const RANGES = [
  { key: 'week', label: '1W' },
  { key: 'month', label: '1M' },
  { key: 'quarter', label: '3M' },
  { key: 'year', label: '1Y' },
  { key: 'all', label: 'All' }
];

function rangeFilter(key) {
  const now = new Date();
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (key === 'week') return { from: iso(new Date(Date.now() - 7 * 864e5)), to: iso(now) };
  if (key === 'month') return { from: iso(new Date(Date.now() - 30 * 864e5)), to: iso(now) };
  if (key === 'quarter') return { from: iso(new Date(Date.now() - 90 * 864e5)), to: iso(now) };
  if (key === 'year') return { from: iso(new Date(Date.now() - 365 * 864e5)), to: iso(now) };
  return {};
}

export default function Analytics() {
  const allTrades = useTrades();
  const entries = useEntries();
  const [range, setRange] = useState('all');
  const [custom, setCustom] = useState({ from: '', to: '' });

  const trades = useMemo(
    () => filterTrades(allTrades, range === 'custom' ? custom : rangeFilter(range)),
    [allTrades, range, custom]
  );

  const s = useMemo(() => summary(trades), [trades]);
  const curve = useMemo(() => {
    const c = equityCurve(trades);
    return { ...c, points: c.points.map((p, i) => ({ ...p, label: p.date?.slice(5) || `#${i + 1}` })) };
  }, [trades]);
  const monthly = useMemo(() => monthlyPnl(trades), [trades]);
  const weekday = useMemo(() => weekdayStats(trades), [trades]);
  const hourly = useMemo(() => hourStats(trades), [trades]);
  const rdist = useMemo(() => rDistribution(trades), [trades]);
  const daily = useMemo(() => dailyPnl(trades), [trades]);
  const mood = useMemo(() => moodVsPnl(dailyPnl(allTrades), entries), [allTrades, entries]);

  const byStrategy = useMemo(() => groupBy(trades, (t) => t.strategy), [trades]);
  const bySymbol = useMemo(() => groupBy(trades, (t) => t.symbol), [trades]);
  const byMistake = useMemo(() => groupBy(trades, (t) => t.mistakes), [trades]);
  const byEmotion = useMemo(() => groupBy(trades, (t) => t.emotions), [trades]);
  const byDirection = useMemo(() => groupBy(trades, (t) => t.direction), [trades]);
  const byInstrument = useMemo(() => groupBy(trades, (t) => t.instrument), [trades]);

  const winLoss = [
    { name: 'Wins', value: s.wins, color: '#22c55e' },
    { name: 'Losses', value: s.losses, color: '#ef4444' },
    { name: 'Breakeven', value: s.breakeven, color: '#64748b' }
  ].filter((d) => d.value > 0);

  const moodSeries = useMemo(
    () =>
      [...entries]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(-30)
        .filter((e) => e.mood)
        .map((e) => ({ label: e.date.slice(5), value: e.mood })),
    [entries]
  );

  const sleepSeries = useMemo(
    () =>
      [...entries]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(-30)
        .filter((e) => e.sleepHours)
        .map((e) => ({ label: e.date.slice(5), value: e.sleepHours })),
    [entries]
  );

  const insights = useMemo(() => buildInsights(trades, s, byStrategy, byMistake, weekday, mood), [
    trades, s, byStrategy, byMistake, weekday, mood
  ]);

  if (!allTrades.length) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No trades to analyse yet"
        body="Once you log a few closed trades, this page shows expectancy, drawdown, your best strategies and the mistakes that cost you the most."
        action={
          <Link to="/trades/new" className="btn-primary btn-sm">
            Log your first trade
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-[13px] text-slate-500">
            {trades.length} trades in range · {s.closedTrades} closed
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <Chip key={r.key} active={range === r.key} onClick={() => setRange(r.key)}>
              {r.label}
            </Chip>
          ))}
          <Chip active={range === 'custom'} onClick={() => setRange('custom')}>
            Custom
          </Chip>
        </div>
      </div>

      {range === 'custom' && (
        <Card className="grid gap-3 sm:grid-cols-2">
          <Field label="From">
            <input type="date" className="input" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          </Field>
          <Field label="To">
            <input type="date" className="input" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </Field>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Net P&L" value={<Money value={s.net} />} tone={s.net >= 0 ? 'profit' : 'loss'} />
        <Stat label="Win rate" value={`${s.winRate.toFixed(1)}%`} sub={`${s.wins}W / ${s.losses}L`} />
        <Stat
          label="Profit factor"
          value={s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}
          tone={s.profitFactor >= 1 ? 'profit' : 'loss'}
        />
        <Stat label="Expectancy" value={<Money value={s.expectancy} />} sub="per trade" />
        <Stat label="Avg win" value={<Money value={s.avgWin} />} tone="profit" />
        <Stat label="Avg loss" value={<Money value={-s.avgLoss} />} tone="loss" />
        <Stat label="Payoff ratio" value={s.payoff ? s.payoff.toFixed(2) : '—'} sub="avg win / avg loss" />
        <Stat label="Avg R" value={s.avgR ? `${s.avgR > 0 ? '+' : ''}${s.avgR.toFixed(2)}R` : '—'} tone={s.avgR >= 0 ? 'profit' : 'loss'} />
        <Stat label="Largest win" value={<Money value={s.largestWin} />} tone="profit" />
        <Stat label="Largest loss" value={<Money value={s.largestLoss} />} tone="loss" />
        <Stat label="Max drawdown" value={<Money value={-curve.maxDrawdown} />} tone="loss" sub={`${curve.maxDrawdownPct.toFixed(1)}%`} />
        <Stat label="Longest streak" value={`${s.longestWin}W / ${s.longestLoss}L`} />
        <Stat label="Avg holding" value={s.avgHolding ? `${Math.round(s.avgHolding)}m` : '—'} />
        <Stat label="Total charges" value={<Money value={-s.totalCharges} />} tone="loss" sub="taxes + brokerage" />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card className="border-brand-600/30 bg-gradient-to-br from-brand-600/10 to-transparent">
          <SectionTitle right={<Lightbulb size={16} className="text-amber-400" />}>What the data says</SectionTitle>
          <ul className="space-y-1.5 text-[13px] text-slate-300">
            {insights.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-brand-400">•</span> {t}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle>Equity curve &amp; drawdown</SectionTitle>
        {curve.points.length ? (
          <EquityChart data={curve.points} height={240} />
        ) : (
          <p className="text-[13px] text-slate-500">No closed trades in this range.</p>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <SectionTitle>Monthly P&amp;L</SectionTitle>
          <PnlBars data={monthly.map((m) => ({ ...m, label: m.month }))} labelKey="label" />
        </Card>
        <Card>
          <SectionTitle>Win / loss split</SectionTitle>
          {winLoss.length ? (
            <Donut data={winLoss} centerLabel={{ value: `${s.winRate.toFixed(0)}%`, label: 'win rate' }} />
          ) : (
            <p className="text-[13px] text-slate-500">No closed trades.</p>
          )}
          <div className="mt-2 flex justify-center gap-4 text-[11px]">
            {winLoss.map((w) => (
              <span key={w.name} className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full" style={{ background: w.color }} /> {w.name} {w.value}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <SectionTitle>P&amp;L by weekday</SectionTitle>
          <PnlBars data={weekday} labelKey="day" />
        </Card>
        <Card>
          <SectionTitle>P&amp;L by entry hour</SectionTitle>
          <PnlBars data={hourly} labelKey="hour" />
        </Card>
      </div>

      <Card>
        <SectionTitle>R-multiple distribution</SectionTitle>
        <PnlBars data={rdist.map((r) => ({ ...r, label: r.label }))} labelKey="label" dataKey="count" />
        <p className="mt-2 text-[11px] text-slate-500">
          R-multiple needs a stop loss on the trade. Trades without a stop are excluded.
        </p>
      </Card>

      <GroupTable title="By strategy" rows={byStrategy} />
      <GroupTable title="By symbol" rows={bySymbol} />
      <div className="grid gap-3 md:grid-cols-2">
        <GroupTable title="By mistake" rows={byMistake} tone="loss" />
        <GroupTable title="By emotion" rows={byEmotion} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <GroupTable title="Long vs short" rows={byDirection} />
        <GroupTable title="By instrument" rows={byInstrument} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <SectionTitle>Mood vs P&amp;L</SectionTitle>
          {mood.length ? (
            <div className="space-y-2">
              {mood.map((m) => (
                <div key={m.mood} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {MOODS[m.mood].emoji} {MOODS[m.mood].label}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500">
                      {m.days}d · {((m.wins / m.days) * 100).toFixed(0)}% green
                    </span>
                    <Money value={m.net} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">Log a life entry and a trade on the same day.</p>
          )}
        </Card>
        <Card>
          <SectionTitle>Mood trend (last 30 entries)</SectionTitle>
          {moodSeries.length ? (
            <LineSeries data={moodSeries} color="#a78bfa" name="Mood" height={170} />
          ) : (
            <p className="text-[13px] text-slate-500">No mood entries yet.</p>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>Sleep hours (last 30 entries)</SectionTitle>
        {sleepSeries.length ? (
          <LineSeries data={sleepSeries} color="#38bdf8" name="Sleep" height={170} />
        ) : (
          <p className="text-[13px] text-slate-500">Log sleep in your daily journal to see this.</p>
        )}
      </Card>
    </div>
  );
}

function GroupTable({ title, rows, tone }) {
  if (!rows.length) return null;
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px]">
          <thead>
            <tr className="border-b border-ink-700">
              <th className="th">{title.replace('By ', '').replace('vs', '/')}</th>
              <th className="th text-right">Trades</th>
              <th className="th text-right">Win %</th>
              <th className="th text-right">Avg R</th>
              <th className="th text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((r) => (
              <tr key={r.raw} className="border-b border-ink-800/70">
                <td className="td truncate font-medium">{r.key}</td>
                <td className="td tabular text-right text-slate-400">{r.trades}</td>
                <td className="td tabular text-right">{r.winRate.toFixed(0)}%</td>
                <td className={`td tabular text-right ${r.avgR >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {r.avgR ? `${r.avgR > 0 ? '+' : ''}${r.avgR.toFixed(2)}` : '—'}
                </td>
                <td className="td text-right">
                  <Money value={r.net} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function buildInsights(trades, s, byStrategy, byMistake, weekday, mood) {
  const out = [];
  if (!s.closedTrades) return out;

  if (s.profitFactor !== Infinity) {
    out.push(
      s.profitFactor >= 1.5
        ? `Profit factor of ${s.profitFactor.toFixed(2)} is strong — you make ₹${s.profitFactor.toFixed(2)} for every ₹1 lost.`
        : s.profitFactor >= 1
        ? `Profit factor ${s.profitFactor.toFixed(2)} is profitable but thin. Cutting your worst mistake could move this a lot.`
        : `Profit factor ${s.profitFactor.toFixed(2)} is below 1 — you are paying more in losses than you make in wins.`
    );
  }
  const best = byStrategy.filter((x) => x.trades >= 3).sort((a, b) => b.net - a.net)[0];
  const worst = byStrategy.filter((x) => x.trades >= 3).sort((a, b) => a.net - b.net)[0];
  if (best) out.push(`Your best strategy is "${best.key}" at ₹${Math.round(best.net)} across ${best.trades} trades (${best.winRate.toFixed(0)}% win rate).`);
  if (worst && worst.raw !== best?.raw && worst.net < 0)
    out.push(`"${worst.key}" is costing you ₹${Math.abs(Math.round(worst.net))} over ${worst.trades} trades — consider dropping or fixing it.`);

  const badMistake = byMistake.filter((x) => x.net < 0).sort((a, b) => a.net - b.net)[0];
  if (badMistake) out.push(`"${badMistake.raw}" appears in ${badMistake.trades} trades and cost ₹${Math.abs(Math.round(badMistake.net))}.`);

  const worstDay = [...weekday].filter((d) => d.trades > 0).sort((a, b) => a.net - b.net)[0];
  const bestDay = [...weekday].filter((d) => d.trades > 0).sort((a, b) => b.net - a.net)[0];
  if (worstDay && worstDay.net < 0 && bestDay) out.push(`${worstDay.day} is your weakest day (₹${Math.round(worstDay.net)}), ${bestDay.day} your best (₹${Math.round(bestDay.net)}).`);

  if (s.avgR) {
    out.push(
      s.avgR > 0
        ? `Average trade returns ${s.avgR.toFixed(2)}R — with a 1% risk per trade that is ${(s.avgR * s.closedTrades).toFixed(1)}% account growth over this period.`
        : `Average trade returns ${s.avgR.toFixed(2)}R. Your stop loss and targets need work before sizing up.`
    );
  }
  if (mood.length >= 2) {
    const bestMood = [...mood].sort((a, b) => b.net - a.net)[0];
    const worstMood = [...mood].sort((a, b) => a.net - b.net)[0];
    if (bestMood && worstMood && bestMood.mood !== worstMood.mood)
      out.push(
        `On "${MOODS[bestMood.mood].label}" days you make ₹${Math.round(bestMood.net)}; on "${MOODS[worstMood.mood].label}" days ₹${Math.round(worstMood.net)}. Mood is a real edge.`
      );
  }
  if (s.totalCharges > Math.abs(s.net) * 0.4 && s.net > 0)
    out.push(`Charges (₹${Math.round(s.totalCharges)}) are eating a big part of your profit — fewer, better trades will help.`);
  return out.slice(0, 6);
}
