import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { useTrades, useEntries, useHabits, useGoals, todayKey, MOODS } from '../lib/hooks.js';
import { summary, equityCurve, dailyPnl, filterTrades, journalStreak, groupBy, moodVsPnl, disciplineScore } from '../lib/metrics.js';
import { Card, SectionTitle, Stat, Chip, Money, EmptyState, Spinner, ProgressBar, Ring, Sparkline } from '../components/ui.jsx';
import { EquityChart, PnlBars, Donut, CalendarHeatmap } from '../components/Charts.jsx';
import { TrendingUp, Plus, NotebookPen, Flame, ArrowRight, Target, CalendarDays, ShieldCheck } from 'lucide-react';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' }
];

function rangeToFilter(key) {
  const now = new Date();
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (key === 'today') return { from: iso(now), to: iso(now) };
  if (key === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: iso(d), to: iso(now) };
  }
  if (key === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: iso(d), to: iso(now) };
  }
  return {};
}

export default function Dashboard() {
  const { settings, ready } = useApp();
  const trades = useTrades();
  const entries = useEntries();
  const habits = useHabits();
  const goals = useGoals();
  const [range, setRange] = useState('month');
  const navigate = useNavigate();

  const filtered = useMemo(() => filterTrades(trades, rangeToFilter(range)), [trades, range]);
  const s = useMemo(() => summary(filtered), [filtered]);
  const curve = useMemo(() => {
    const c = equityCurve(filtered, { startCapital: 0 });
    return {
      ...c,
      points: c.points.map((p, i) => ({ ...p, label: p.date?.slice(5) || `#${i + 1}` }))
    };
  }, [filtered]);

  const daily = useMemo(() => dailyPnl(trades), [trades]);
  const today = todayKey();
  const todayRow = daily.find((d) => d.date === today);
  const todayEntry = entries.find((e) => e.date === today);
  const streak = useMemo(() => journalStreak(entries.map((e) => e.date)), [entries]);
  const last30 = useMemo(() => daily.slice(-30), [daily]);
  const recent = useMemo(() => [...trades].sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate)).slice(0, 6), [trades]);
  const mistakes = useMemo(() => groupBy(filtered, (t) => t.mistakes).slice(0, 5), [filtered]);
  const mood = useMemo(() => moodVsPnl(daily, entries), [daily, entries]);
  const discipline = useMemo(() => disciplineScore(trades, entries, habits), [trades, entries, habits]);
  const spark = useMemo(() => curve.points.map((p) => p.equity), [curve]);
  const nowD = new Date();
  const monthDaily = useMemo(
    () => daily.filter((d) => d.date.startsWith(`${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}`)),
    [daily]
  );
  const moodMap = useMemo(() => {
    const m = new Map();
    for (const e of entries) if (e.mood) m.set(e.date, MOODS[e.mood]?.emoji || '•');
    return m;
  }, [entries]);
  const rangeLabel = RANGES.find((r) => r.key === range)?.label || '';

  const doneToday = todayEntry?.habits ? Object.values(todayEntry.habits).filter(Boolean).length : 0;

  if (!ready) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}
          </h1>
          <p className="text-[13px] text-slate-500">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/journal/new" className="btn-ghost btn-sm">
            <NotebookPen size={15} /> Life entry
          </Link>
          <Link to="/trades/new" className="btn-primary btn-sm">
            <Plus size={15} /> Log trade
          </Link>
        </div>
      </div>

      {/* Range */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {RANGES.map((r) => (
          <Chip key={r.key} active={range === r.key} onClick={() => setRange(r.key)}>
            {r.label}
          </Chip>
        ))}
      </div>

      {/* Hero */}
      <Card className="border-ink-600/60 bg-gradient-to-br from-brand-600/15 via-ink-850 to-ink-850">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <div className="stat-label">Net P&amp;L · {rangeLabel}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-4xl font-black tracking-tight">
                <Money value={s.net} />
              </span>
              {spark.length > 1 && (
                <Sparkline data={spark} width={130} height={38} tone={s.net >= 0 ? 'profit' : 'loss'} />
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-400">
              <span>
                <b className={s.winRate >= 50 ? 'text-slate-200' : 'text-slate-200'}>{s.winRate.toFixed(0)}%</b> win rate
              </span>
              <span>
                PF <b className="text-slate-200">{s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}</b>
              </span>
              <span>
                expectancy{' '}
                <b className={s.expectancy >= 0 ? 'text-profit' : 'text-loss'}>
                  {s.expectancy >= 0 ? '+' : '-'}₹{Math.abs(Math.round(s.expectancy)).toLocaleString('en-IN')}
                </b>{' '}
                /trade
              </span>
              {s.currentStreak > 0 && (
                <span className={s.currentStreakType === 'W' ? 'text-profit' : 'text-loss'}>
                  {s.currentStreak} {s.currentStreakType === 'W' ? 'win' : 'loss'} streak
                </span>
              )}
            </div>
          </div>
          <Link
            to="/reports"
            className="group flex items-center gap-4 rounded-2xl border border-ink-700 bg-ink-900/70 px-4 py-3 transition hover:border-amber-500/40"
          >
            <Ring
              value={discipline.score ?? 0}
              size={74}
              stroke={7.5}
              label={discipline.score ?? '—'}
              sub="discipline"
              tone={discipline.score >= 70 ? 'profit' : discipline.score >= 50 ? 'gold' : 'loss'}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-200">
                <ShieldCheck size={14} className="text-amber-400" />
                {discipline.grade}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 transition group-hover:text-amber-400">
                Weekly review →
              </div>
            </div>
          </Link>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        <Stat
          label="Net P&L"
          value={<Money value={s.net} />}
          tone={s.net > 0 ? 'profit' : s.net < 0 ? 'loss' : 'default'}
          sub={`${s.closedTrades} closed trades`}
          spark={spark}
          sparkTone={s.net >= 0 ? 'profit' : 'loss'}
        />
        <Stat label="Win rate" value={`${s.winRate.toFixed(1)}%`} sub={`${s.wins}W / ${s.losses}L`} />
        <Stat
          label="Profit factor"
          value={s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}
          tone={s.profitFactor >= 1 ? 'profit' : 'loss'}
          sub={`Expectancy ${s.expectancy.toFixed(0) >= 0 ? '+' : ''}₹${s.expectancy.toFixed(0)}`}
        />
        <Stat
          label="Avg R"
          value={s.avgR ? `${s.avgR > 0 ? '+' : ''}${s.avgR.toFixed(2)}R` : '—'}
          tone={s.avgR > 0 ? 'profit' : s.avgR < 0 ? 'loss' : 'default'}
          sub={`Payoff ${s.payoff ? s.payoff.toFixed(2) : '—'}`}
        />
        <Stat label="Gross profit" value={<Money value={s.grossProfit} />} tone="profit" sub={`Avg win ₹${s.avgWin.toFixed(0)}`} />
        <Stat label="Gross loss" value={<Money value={-s.grossLoss} />} tone="loss" sub={`Avg loss ₹${s.avgLoss.toFixed(0)}`} />
        <Stat label="Charges paid" value={<Money value={-s.totalCharges} />} tone="loss" sub="STT + GST + brokerage" />
        <Stat
          label="Max drawdown"
          value={<Money value={-curve.maxDrawdown} />}
          tone="loss"
          sub={`${curve.maxDrawdownPct.toFixed(1)}% of peak`}
        />
      </div>

      {/* Equity curve */}
      <Card>
        <SectionTitle
          right={
            <span className="text-[11px] text-slate-500">
              {s.currentStreak > 0 && (
                <span className={s.currentStreakType === 'W' ? 'text-profit' : 'text-loss'}>
                  {s.currentStreak} {s.currentStreakType === 'W' ? 'win' : 'loss'} streak
                </span>
              )}
            </span>
          }
        >
          Equity curve
        </SectionTitle>
        {curve.points.length ? (
          <EquityChart data={curve.points} />
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No closed trades in this range"
            body="Log your first trade and the equity curve will build itself."
            action={
              <Link to="/trades/new" className="btn-primary btn-sm">
                Log a trade
              </Link>
            }
          />
        )}
      </Card>

      {/* Today row */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <SectionTitle>Today</SectionTitle>
          <div className="space-y-2 text-sm">
            <Row label="P&L" value={todayRow ? <Money value={todayRow.net} /> : <span className="text-slate-500">No trades</span>} />
            <Row label="Trades" value={todayRow?.trades || 0} />
            <Row label="Charges" value={todayRow ? <Money value={-todayRow.charges} /> : '—'} />
            <Row
              label="Mood today"
              value={todayEntry?.mood ? `${MOODS[todayEntry.mood].emoji} ${MOODS[todayEntry.mood].label}` : <span className="text-slate-500">Not logged</span>}
            />
          </div>
          {!todayEntry && (
            <Link to="/journal/new" className="btn-ghost btn-sm mt-3 w-full">
              <NotebookPen size={14} /> Write today's entry
            </Link>
          )}
        </Card>

        <Card>
          <SectionTitle right={<Flame size={15} className={streak.current ? 'text-amber-400' : 'text-slate-600'} />}>
            Journal streak
          </SectionTitle>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-100">{streak.current}</span>
            <span className="text-[13px] text-slate-500">day{streak.current === 1 ? '' : 's'} in a row</span>
          </div>
          <p className="mt-1 text-[12px] text-slate-500">Longest streak: {streak.longest} days</p>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
              <span>Habits today</span>
              <span>
                {doneToday}/{habits.length}
              </span>
            </div>
            <ProgressBar value={doneToday} max={Math.max(1, habits.length)} tone="profit" />
          </div>
        </Card>

        <Card>
          <SectionTitle right={<Target size={15} className="text-brand-400" />}>Goals this month</SectionTitle>
          {goals.length === 0 ? (
            <p className="text-[13px] text-slate-500">
              No goals yet.{' '}
              <Link to="/goals" className="text-brand-400">
                Add one
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {goals.slice(0, 3).map((g) => {
                const cur = goalProgress(g, filtered, entries, streak);
                return (
                  <div key={g.id}>
                    <div className="mb-1 flex justify-between text-[12px]">
                      <span className="truncate text-slate-300">{g.title}</span>
                      <span className="tabular text-slate-500">
                        {cur.label}
                      </span>
                    </div>
                    <ProgressBar value={cur.pct} tone={cur.pct >= 100 ? 'profit' : 'brand'} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Last 30 days bars */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <SectionTitle right={<Link to="/analytics" className="flex items-center gap-1 text-[11px] text-brand-400">Full analytics <ArrowRight size={12} /></Link>}>
            Last 30 trading days
          </SectionTitle>
          {last30.length ? (
            <PnlBars
              data={last30.map((d) => ({ ...d, label: d.date.slice(5).replace('-', '/') }))}
              height={180}
            />
          ) : (
            <EmptyState title="No data yet" body="Closed trades will appear here." />
          )}
        </Card>

        {/* Month heatmap */}
        <Card>
          <SectionTitle
            right={
              <Link to="/calendar" className="flex items-center gap-1 text-[11px] text-brand-400">
                <CalendarDays size={12} /> Open calendar <ArrowRight size={12} />
              </Link>
            }
          >
            {nowD.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </SectionTitle>
          <CalendarHeatmap
            data={monthDaily}
            month={nowD.getMonth()}
            year={nowD.getFullYear()}
            today={today}
            moodByDate={moodMap}
            onSelect={() => navigate('/calendar')}
          />
          <p className="mt-2 text-[11px] text-slate-500">
            {monthDaily.length} trading days this month ·{' '}
            {monthDaily.filter((d) => d.net > 0).length} green ·{' '}
            {monthDaily.filter((d) => d.net < 0).length} red
          </p>
        </Card>
      </div>

      {/* Mistakes + mood */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <SectionTitle>Costliest mistakes</SectionTitle>
          {mistakes.length ? (
            <div className="space-y-2">
              {mistakes.map((m) => (
                <div key={m.raw} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-300">{m.raw}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[11px] text-slate-500">{m.trades}x</span>
                    <Money value={m.net} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">No mistakes tagged yet — good.</p>
          )}
        </Card>

        <Card>
          <SectionTitle>Mood vs P&L</SectionTitle>
          {mood.length ? (
            <div className="space-y-2">
              {mood.map((m) => (
                <div key={m.mood} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-300">
                    {MOODS[m.mood].emoji} {MOODS[m.mood].label}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500">{m.days}d</span>
                    <Money value={m.net} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">
              Log both a life entry and a trade on the same day to see how your mood affects your P&L.
            </p>
          )}
        </Card>
      </div>

      {/* Recent trades */}
      <Card pad={false}>
        <div className="flex items-center justify-between px-4 pt-4">
          <SectionTitle className="mb-0">Recent trades</SectionTitle>
          <Link to="/trades" className="text-[11px] text-brand-400">
            View all
          </Link>
        </div>
        {recent.length ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-y border-ink-700">
                  <th className="th">Symbol</th>
                  <th className="th">Entry</th>
                  <th className="th">Qty</th>
                  <th className="th">Exit</th>
                  <th className="th text-right">Net P&L</th>
                  <th className="th text-right">R</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/trades/${t.id}`)}
                    className="cursor-pointer border-b border-ink-800 transition hover:bg-ink-800/60"
                  >
                    <td className="td">
                      <div className="font-semibold">{t.symbol || '—'}</div>
                      <div className="text-[11px] text-slate-500">
                        {t.strategy || t.instrument?.replace('EQUITY_', '') || ''}
                      </div>
                    </td>
                    <td className="td tabular">{t.priceEntry || '—'}</td>
                    <td className="td tabular">{t.qty || '—'}</td>
                    <td className="td tabular">{t.priceExit || <span className="text-amber-400">open</span>}</td>
                    <td className="td text-right">
                      {t.closed ? <Money value={t.net} /> : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="td text-right tabular text-slate-400">
                      {t.r != null ? `${t.r > 0 ? '+' : ''}${t.r.toFixed(2)}R` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={TrendingUp}
              title="Your trade log is empty"
              body="Add your first trade — entry, exit, stop loss, strategy and how you felt."
              action={
                <Link to="/trades/new" className="btn-primary btn-sm">
                  Log your first trade
                </Link>
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="tabular font-semibold text-slate-200">{value}</span>
    </div>
  );
}

function goalProgress(goal, trades, entries, streak) {
  const s = summary(trades);
  if (goal.type === 'profit') {
    const cur = s.net;
    return { pct: (cur / (goal.targetValue || 1)) * 100, label: `₹${cur.toFixed(0)} / ₹${goal.targetValue}` };
  }
  if (goal.type === 'winRate') {
    return { pct: (s.winRate / (goal.targetValue || 1)) * 100, label: `${s.winRate.toFixed(0)}% / ${goal.targetValue}%` };
  }
  if (goal.type === 'journalStreak') {
    return { pct: (streak.current / (goal.targetValue || 1)) * 100, label: `${streak.current} / ${goal.targetValue} days` };
  }
  if (goal.type === 'maxTrades') {
    return { pct: (s.closedTrades / (goal.targetValue || 1)) * 100, label: `${s.closedTrades} / ${goal.targetValue} trades` };
  }
  return { pct: 0, label: `${goal.targetValue}` };
}
