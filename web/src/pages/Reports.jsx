import React, { useMemo, useState } from 'react';
import { useTrades, useEntries, useHabits, useGoals, MOODS } from '../lib/hooks.js';
import {
  summary,
  equityCurve,
  groupBy,
  dailyPnl,
  filterTrades,
  disciplineScore,
  DISCIPLINE_PARTS,
  moodOnGreenRedDays,
  ratingBreakdown,
  GRADE_LABELS
} from '../lib/metrics.js';
import { Card, SectionTitle, Stat, Chip, Money, EmptyState, Ring, ProgressBar, PageHeader, toast } from '../components/ui.jsx';
import { ClipboardList, Copy, Download, Share2, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';

const PERIODS = [
  { key: 'week', label: 'This week' },
  { key: 'lweek', label: 'Last week' },
  { key: 'month', label: 'This month' },
  { key: 'lmonth', label: 'Last month' },
  { key: 'quarter', label: 'This quarter' }
];

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function periodRange(key) {
  const now = new Date();
  const startOfWeek = (d) => {
    const x = new Date(d);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
    return x;
  };
  const monday = startOfWeek(now);
  if (key === 'week') return { from: iso(monday), to: iso(now), label: 'This week', noun: 'week' };
  if (key === 'lweek') {
    const lm = new Date(monday);
    lm.setDate(lm.getDate() - 7);
    const end = new Date(monday);
    end.setDate(end.getDate() - 1);
    return { from: iso(lm), to: iso(end), label: 'Last week', noun: 'week' };
  }
  if (key === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: iso(d), to: iso(now), label: 'This month', noun: 'month' };
  }
  if (key === 'lmonth') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: iso(d), to: iso(end), label: 'Last month', noun: 'month' };
  }
  const q = Math.floor(now.getMonth() / 3);
  const d = new Date(now.getFullYear(), q * 3, 1);
  return { from: iso(d), to: iso(now), label: 'This quarter', noun: 'quarter' };
}

const fmt = (n) =>
  `${n < 0 ? '-' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;

/** Auto-generated weekly / monthly performance review — the report a coach would ask for. */
export default function Reports() {
  const trades = useTrades();
  const entries = useEntries();
  const habits = useHabits();
  const goals = useGoals();
  const [period, setPeriod] = useState('month');

  const range = periodRange(period);
  const inPeriod = useMemo(() => filterTrades(trades, range), [trades, range]);
  const s = useMemo(() => summary(inPeriod), [inPeriod]);
  const curve = useMemo(() => equityCurve(inPeriod), [inPeriod]);

  const periodEntries = useMemo(
    () => entries.filter((e) => e.date >= range.from && e.date <= range.to),
    [entries, range]
  );
  const daily = useMemo(() => dailyPnl(inPeriod), [inPeriod]);
  const discipline = useMemo(() => disciplineScore(inPeriod, periodEntries, habits), [inPeriod, periodEntries, habits]);

  const byStrategy = useMemo(() => groupBy(inPeriod, (t) => t.strategy), [inPeriod]);
  const byMistake = useMemo(() => groupBy(inPeriod, (t) => t.mistakes), [inPeriod]);
  const byGrade = useMemo(() => ratingBreakdown(inPeriod), [inPeriod]);
  const moodGR = useMemo(() => moodOnGreenRedDays(daily, periodEntries), [daily, periodEntries]);

  const best = useMemo(() => [...inPeriod].filter((t) => t.closed).sort((a, b) => b.net - a.net)[0], [inPeriod]);
  const worst = useMemo(() => [...inPeriod].filter((t) => t.closed).sort((a, b) => a.net - b.net)[0], [inPeriod]);

  const journalPct = useMemo(() => {
    const tradingDays = new Set(inPeriod.filter((t) => t.closed).map((t) => t.dk).filter(Boolean));
    if (!tradingDays.size) return null;
    const entryDays = new Set(periodEntries.map((e) => e.date));
    return Math.round(([...tradingDays].filter((d) => entryDays.has(d)).length / tradingDays.size) * 100);
  }, [inPeriod, periodEntries]);

  const monthGoals = useMemo(() => goals.filter((g) => g.type === 'profit' && g.period === 'monthly'), [goals]);

  const verdict = useMemo(() => {
    if (!s.closedTrades) return null;
    const noun = range.noun;
    const head =
      s.net >= 0
        ? `Profitable ${noun}: ${fmt(s.net)} across ${s.closedTrades} trades (${s.winRate.toFixed(0)}% win rate, PF ${s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}).`
        : `Down ${fmt(Math.abs(s.net))} this ${noun} across ${s.closedTrades} trades — cut size, protect capital, rebuild with A+ setups only.`;
    const parts = [head];
    if (discipline.score != null) parts.push(`Discipline ${discipline.score}/100 (${discipline.grade}).`);
    const leak = byMistake.filter((x) => x.net < 0).sort((a, b) => a.net - b.net)[0];
    if (leak) parts.push(`Biggest leak: "${leak.raw}" — ${fmt(leak.net)} over ${leak.trades} trades.`);
    const top = byStrategy.filter((x) => x.trades >= 2).sort((a, b) => b.net - a.net)[0];
    if (top) parts.push(`Best edge: "${top.key}" at ${fmt(top.net)} (${top.winRate.toFixed(0)}% win rate).`);
    return parts.join(' ');
  }, [s, range, discipline, byMistake, byStrategy]);

  const reportText = useMemo(
    () => buildReportText({ range, s, curve, discipline, byStrategy, byMistake, byGrade, moodGR, journalPct, best, worst, monthGoals, goalsMet: monthGoals.map((g) => s.net >= g.targetValue) }),
    [range, s, curve, discipline, byStrategy, byMistake, byGrade, moodGR, journalPct, best, worst, monthGoals]
  );

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      toast.success('Report copied — paste it anywhere');
    } catch {
      toast.error('Clipboard blocked — use Download instead');
    }
  };
  const downloadReport = () => {
    const blob = new Blob([reportText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradevault-report-${range.from}-to-${range.to}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const shareReport = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `TradeVault report — ${range.label}`, text: reportText });
        return;
      } catch {}
    }
    copyReport();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ClipboardList}
        title="Reviews"
        sub="Your auto-generated performance report — read it, share it, act on it"
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={copyReport}>
              <Copy size={14} /> Copy
            </button>
            <button className="btn-ghost btn-sm" onClick={downloadReport}>
              <Download size={14} /> .md
            </button>
            <button className="btn-primary btn-sm" onClick={shareReport}>
              <Share2 size={14} /> Share
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <Chip key={p.key} active={period === p.key} onClick={() => setPeriod(p.key)}>
            {p.label}
          </Chip>
        ))}
        <span className="ml-1 text-[11px] text-slate-500 tabular">
          {range.from} → {range.to}
        </span>
      </div>

      {!s.closedTrades && !periodEntries.length ? (
        <EmptyState
          icon={ClipboardList}
          title={`Nothing recorded for ${range.label.toLowerCase()}`}
          body="Log a few trades (and life entries) in this period and the report writes itself."
        />
      ) : (
        <>
          {/* Verdict */}
          {verdict && (
            <Card className="border-brand-600/30 bg-gradient-to-br from-brand-600/10 via-ink-850 to-ink-850">
              <SectionTitle>The verdict</SectionTitle>
              <p className="text-[14px] leading-relaxed text-slate-200">{verdict}</p>
            </Card>
          )}

          {/* Headline stats */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Net P&L" value={<Money value={s.net} />} tone={s.net >= 0 ? 'profit' : 'loss'} sub={`${s.closedTrades} trades`} />
            <Stat label="Win rate" value={`${s.winRate.toFixed(0)}%`} sub={`${s.wins}W / ${s.losses}L`} />
            <Stat label="Profit factor" value={s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)} tone={s.profitFactor >= 1 ? 'profit' : 'loss'} />
            <Stat label="Expectancy" value={<Money value={s.expectancy} />} sub="per trade" />
            <Stat label="Avg R" value={s.avgR ? `${s.avgR > 0 ? '+' : ''}${s.avgR.toFixed(2)}R` : '—'} tone={s.avgR >= 0 ? 'profit' : 'loss'} />
            <Stat label="Max drawdown" value={<Money value={-curve.maxDrawdown} />} tone="loss" sub={`${curve.maxDrawdownPct.toFixed(1)}% of peak`} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* Discipline */}
            <Card>
              <SectionTitle right={<ShieldCheck size={16} className="text-amber-400" />}>Discipline score</SectionTitle>
              <div className="flex items-center gap-5">
                <Ring
                  value={discipline.score ?? 0}
                  label={discipline.score ?? '—'}
                  sub={discipline.grade}
                  tone={discipline.score >= 70 ? 'profit' : discipline.score >= 50 ? 'gold' : 'loss'}
                />
                <div className="min-w-0 flex-1 space-y-2.5">
                  {DISCIPLINE_PARTS.map((p) => {
                    const v = discipline.parts[p.key];
                    return (
                      <div key={p.key} title={p.hint}>
                        <div className="mb-0.5 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">
                            {p.label} <span className="text-slate-600">{p.weight}</span>
                          </span>
                          <span className="tabular text-slate-300">{v == null ? 'n/a' : `${Math.round(v * 100)}%`}</span>
                        </div>
                        <ProgressBar value={v == null ? 0 : v * 100} tone={v != null && v < 0.5 ? 'loss' : 'profit'} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Psychology */}
            <Card>
              <SectionTitle>Psychology</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-profit/25 bg-profit/5 p-3 text-center">
                  <div className="stat-label">Green days mood</div>
                  <div className="mt-1 text-2xl font-black text-profit">
                    {moodGR.green ? `${moodGR.green.avg.toFixed(1)}/5` : '—'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{moodGR.green ? `${moodGR.green.days} days` : 'no data'}</div>
                </div>
                <div className="rounded-xl border border-loss/25 bg-loss/5 p-3 text-center">
                  <div className="stat-label">Red days mood</div>
                  <div className="mt-1 text-2xl font-black text-loss">
                    {moodGR.red ? `${moodGR.red.avg.toFixed(1)}/5` : '—'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{moodGR.red ? `${moodGR.red.days} days` : 'no data'}</div>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Journaling on trading days</span>
                  <span className="tabular font-semibold text-slate-200">{journalPct == null ? '—' : `${journalPct}%`}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Life entries this period</span>
                  <span className="tabular font-semibold text-slate-200">{periodEntries.length}</span>
                </div>
                {moodGR.green && moodGR.red && (
                  <p className="text-[12px] leading-relaxed text-slate-500">
                    You feel {(moodGR.green.avg - moodGR.red.avg).toFixed(1)} points better on profitable days. Protect
                    the routines behind that gap.
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Best / worst */}
          {(best || worst) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {best && best.net > 0 && (
                <Card className="border-profit/25">
                  <SectionTitle>Best trade</SectionTitle>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="font-bold text-slate-100">{best.symbol}</div>
                      <div className="text-[12px] text-slate-500">
                        {best.strategy || '—'} · {best.rating ? `grade ${GRADE_LABELS[best.rating] || best.rating}` : 'ungraded'}
                      </div>
                    </div>
                    <Money value={best.net} />
                  </div>
                </Card>
              )}
              {worst && worst.net < 0 && (
                <Card className="border-loss/25">
                  <SectionTitle>Worst trade</SectionTitle>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="font-bold text-slate-100">{worst.symbol}</div>
                      <div className="text-[12px] text-slate-500">
                        {worst.strategy || '—'}
                        {worst.mistakes?.length ? ` · ${worst.mistakes.join(', ')}` : ''}
                      </div>
                    </div>
                    <Money value={worst.net} />
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Strategy + grades */}
          <div className="grid gap-3 lg:grid-cols-2">
            <MiniTable title="Strategy performance" rows={byStrategy} empty="No strategies tagged this period." />
            <MiniTable title="By setup grade" rows={byGrade} empty="Grade trades A+ to D while reviewing to unlock this." />
          </div>

          {/* Mistakes */}
          <Card>
            <SectionTitle>What mistakes cost you</SectionTitle>
            {byMistake.length ? (
              <div className="space-y-2">
                {byMistake.map((m) => (
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
              <p className="text-[13px] text-profit">No mistakes tagged this period — that is what elite looks like.</p>
            )}
          </Card>

          {/* Goals */}
          {monthGoals.length > 0 && (period === 'month' || period === 'lmonth' || period === 'quarter') && (
            <Card>
              <SectionTitle>Monthly goals vs actual</SectionTitle>
              <div className="space-y-3">
                {monthGoals.map((g, i) => {
                  const pct = Math.max(0, Math.min(100, (s.net / (g.targetValue || 1)) * 100));
                  const met = s.net >= g.targetValue;
                  return (
                    <div key={g.id}>
                      <div className="mb-1 flex justify-between text-[12px]">
                        <span className="truncate text-slate-300">{g.title}</span>
                        <span className={`tabular font-semibold ${met ? 'text-profit' : 'text-slate-400'}`}>
                          {fmt(s.net)} / {fmt(g.targetValue)} {met ? '✓' : ''}
                        </span>
                      </div>
                      <ProgressBar value={pct} tone={met ? 'profit' : 'brand'} />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MiniTable({ title, rows, empty }) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[380px]">
            <thead>
              <tr className="border-b border-ink-700">
                <th className="th">{title.split(' ')[0] === 'Strategy' ? 'Strategy' : 'Grade'}</th>
                <th className="th text-right">Trades</th>
                <th className="th text-right">Win %</th>
                <th className="th text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((r) => (
                <tr key={r.raw} className="border-b border-ink-800/70">
                  <td className="td font-medium">{r.key}</td>
                  <td className="td tabular text-right text-slate-400">{r.trades}</td>
                  <td className="td tabular text-right">{r.winRate.toFixed(0)}%</td>
                  <td className="td text-right">
                    <Money value={r.net} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[13px] text-slate-500">{empty}</p>
      )}
    </Card>
  );
}

function buildReportText({ range, s, curve, discipline, byStrategy, byMistake, byGrade, moodGR, journalPct, best, worst, monthGoals, goalsMet }) {
  const L = [];
  L.push(`# TradeVault report — ${range.label} (${range.from} to ${range.to})`);
  L.push('');
  L.push(`## Headline`);
  L.push(`- Net P&L: ${fmt(s.net)} across ${s.closedTrades} closed trades`);
  L.push(`- Win rate: ${s.winRate.toFixed(1)}% (${s.wins}W / ${s.losses}L / ${s.breakeven}BE)`);
  L.push(`- Profit factor: ${s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)} · Expectancy: ${fmt(s.expectancy)}/trade`);
  L.push(`- Avg R: ${s.avgR ? s.avgR.toFixed(2) + 'R' : '—'} · Max drawdown: ${fmt(curve.maxDrawdown)} (${curve.maxDrawdownPct.toFixed(1)}%)`);
  if (discipline.score != null) {
    L.push(`- Discipline score: ${discipline.score}/100 (${discipline.grade})`);
    for (const p of DISCIPLINE_PARTS) {
      const v = discipline.parts[p.key];
      L.push(`  - ${p.label}: ${v == null ? 'n/a' : Math.round(v * 100) + '%'}`);
    }
  }
  L.push('');
  if (best && best.net > 0) L.push(`Best trade: ${best.symbol} ${fmt(best.net)}${best.strategy ? ` (${best.strategy})` : ''}`);
  if (worst && worst.net < 0) L.push(`Worst trade: ${worst.symbol} ${fmt(worst.net)}${worst.mistakes?.length ? ` — ${worst.mistakes.join(', ')}` : ''}`);
  L.push('');
  if (byStrategy.length) {
    L.push('## Strategies');
    byStrategy.forEach((r) => L.push(`- ${r.key}: ${r.trades} trades · ${r.winRate.toFixed(0)}% win · ${fmt(r.net)}`));
    L.push('');
  }
  if (byGrade.length) {
    L.push('## By setup grade');
    byGrade.forEach((r) => L.push(`- ${r.key}: ${r.trades} trades · ${fmt(r.net)}`));
    L.push('');
  }
  if (byMistake.length) {
    L.push('## Mistakes');
    byMistake.forEach((r) => L.push(`- ${r.raw}: ${r.trades}x · ${fmt(r.net)}`));
    L.push('');
  }
  L.push('## Psychology');
  if (moodGR.green) L.push(`- Avg mood on green days: ${moodGR.green.avg.toFixed(1)}/5 (${moodGR.green.days}d)`);
  if (moodGR.red) L.push(`- Avg mood on red days: ${moodGR.red.avg.toFixed(1)}/5 (${moodGR.red.days}d)`);
  if (journalPct != null) L.push(`- Journaled ${journalPct}% of trading days`);
  if (monthGoals?.length) {
    L.push('');
    L.push('## Goals');
    monthGoals.forEach((g, i) => L.push(`- ${g.title}: ${fmt(s.net)} / ${fmt(g.targetValue)}${goalsMet?.[i] ? ' ✓' : ''}`));
  }
  L.push('');
  L.push('_Generated by TradeVault — trading + life journal_');
  return L.join('\n');
}
