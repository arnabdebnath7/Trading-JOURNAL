import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTrades, useEntries, MOODS, todayKey, prettyDate } from '../lib/hooks.js';
import { dailyPnl, summary } from '../lib/metrics.js';
import { Card, SectionTitle, Money, EmptyState, Stat, PageHeader, Chip } from '../components/ui.jsx';
import { CalendarHeatmap, MONTHS } from '../components/Charts.jsx';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  NotebookPen,
  TrendingUp,
  Undo2
} from 'lucide-react';

/** Monthly P&L calendar — every trading day of the month at a glance. */
export default function Calendar() {
  const trades = useTrades();
  const entries = useEntries();
  const navigate = useNavigate();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(todayKey());

  const daily = useMemo(() => dailyPnl(trades), [trades]);
  const moodByDate = useMemo(() => {
    const map = new Map();
    for (const e of entries) if (e.mood) map.set(e.date, MOODS[e.mood]?.emoji || '•');
    return map;
  }, [entries]);

  const prefix = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`;
  const monthDaily = useMemo(() => daily.filter((d) => d.date.startsWith(prefix)), [daily, prefix]);
  const monthTrades = useMemo(
    () => trades.filter((t) => t.closed && t.dk && t.dk.startsWith(prefix)),
    [trades, prefix]
  );
  const s = useMemo(() => summary(monthTrades), [monthTrades]);

  const greenDays = monthDaily.filter((d) => d.net > 0).length;
  const redDays = monthDaily.filter((d) => d.net < 0).length;
  const best = useMemo(() => [...monthDaily].sort((a, b) => b.net - a.net)[0], [monthDaily]);
  const worst = useMemo(() => [...monthDaily].sort((a, b) => a.net - b.net)[0], [monthDaily]);

  const canNext = ym.y < now.getFullYear() || (ym.y === now.getFullYear() && ym.m < now.getMonth());
  const shift = (delta) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };

  const selTrades = useMemo(
    () => trades.filter((t) => t.dk === selected).sort((a, b) => (a.entryDate < b.entryDate ? -1 : 1)),
    [trades, selected]
  );
  const selDaily = daily.find((d) => d.date === selected);
  const selEntry = entries.find((e) => e.date === selected);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={CalendarDays}
        title="P&L Calendar"
        sub={`${MONTHS[ym.m]} ${ym.y} · every trading day, colour-coded`}
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft size={15} />
            </button>
            <button
              className="btn-ghost btn-sm"
              disabled={!canNext}
              onClick={() => shift(1)}
              aria-label="Next month"
            >
              <ChevronRight size={15} />
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                setYm({ y: now.getFullYear(), m: now.getMonth() });
                setSelected(todayKey());
              }}
            >
              <Undo2 size={14} /> Today
            </button>
          </>
        }
      />

      {/* Month summary */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label={`${MONTHS[ym.m]} net P&L`}
          value={<Money value={s.net} />}
          tone={s.net > 0 ? 'profit' : s.net < 0 ? 'loss' : 'default'}
          sub={`${s.closedTrades} closed trades`}
        />
        <Stat label="Green days" value={`${greenDays}`} tone="profit" sub={`${redDays} red · ${monthDaily.length} traded`} />
        <Stat label="Win rate" value={`${s.winRate.toFixed(0)}%`} sub={`${s.wins}W / ${s.losses}L`} />
        <Stat label="Best day" value={best ? <Money value={best.net} compact /> : '—'} tone="profit" sub={best?.date?.slice(5) || ''} />
        <Stat label="Worst day" value={worst ? <Money value={worst.net} compact /> : '—'} tone="loss" sub={worst?.date?.slice(5) || ''} />
        <Stat label="Charges" value={<Money value={-s.totalCharges} compact />} tone="loss" sub="STT + GST + brokerage" />
      </div>

      {/* Heatmap */}
      <Card>
        <SectionTitle
          right={
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(239,68,68,0.75)' }} /> loss
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(34,197,94,0.75)' }} /> profit
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm border border-amber-400/70" /> today
              </span>
            </div>
          }
        >
          {MONTHS[ym.m]} {ym.y}
        </SectionTitle>
        <CalendarHeatmap
          data={monthDaily}
          month={ym.m}
          year={ym.y}
          selected={selected}
          today={todayKey()}
          moodByDate={moodByDate}
          onSelect={setSelected}
        />
        <p className="mt-3 text-[11px] text-slate-500">
          The small emoji on a day is the mood you logged in your life journal that day — spot the patterns between
          how you felt and what you made.
        </p>
      </Card>

      {/* Selected day */}
      <Card>
        <SectionTitle
          right={
            <div className="flex gap-2">
              <Link to={`/journal/${selected}`} className="btn-ghost btn-sm">
                <NotebookPen size={14} /> {selEntry ? 'Journal entry' : 'Add entry'}
              </Link>
              <button className="btn-primary btn-sm" onClick={() => navigate('/trades/new')}>
                <Plus size={14} /> Trade
              </button>
            </div>
          }
        >
          {selected === todayKey() ? 'Today' : prettyDate(selected, { year: true })}
          <span className="ml-2 font-normal text-slate-500">
            {selDaily ? `${selDaily.trades} trade${selDaily.trades === 1 ? '' : 's'} · ` : 'no trades · '}
            {selDaily ? <Money value={selDaily.net} /> : <span className="text-slate-500">—</span>}
          </span>
        </SectionTitle>

        {selEntry && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Chip>
              {MOODS[selEntry.mood]?.emoji || '⚪'} {MOODS[selEntry.mood]?.label || 'mood n/a'}
            </Chip>
            {selEntry.sleepHours > 0 && <Chip>😴 {selEntry.sleepHours}h sleep</Chip>}
            {selEntry.energy > 0 && <Chip>⚡ energy {selEntry.energy}/5</Chip>}
            {selEntry.stress > 0 && <Chip>🧯 stress {selEntry.stress}/5</Chip>}
          </div>
        )}

        {selTrades.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-ink-700">
                  <th className="th">Symbol</th>
                  <th className="th">Strategy</th>
                  <th className="th">In → Out</th>
                  <th className="th text-right">Qty</th>
                  <th className="th text-right">Net P&L</th>
                  <th className="th text-right">R</th>
                </tr>
              </thead>
              <tbody>
                {selTrades.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/trades/${t.id}`)}
                    className="cursor-pointer border-b border-ink-800/70 transition hover:bg-ink-800/60"
                  >
                    <td className="td font-semibold">{t.symbol}</td>
                    <td className="td text-slate-400">{t.strategy || '—'}</td>
                    <td className="td tabular text-slate-400">
                      {t.priceEntry} → {t.priceExit || <span className="text-amber-400">open</span>}
                    </td>
                    <td className="td tabular text-right text-slate-400">{t.qty}</td>
                    <td className="td text-right">{t.closed ? <Money value={t.net} /> : <span className="text-slate-500">—</span>}</td>
                    <td className="td tabular text-right text-slate-400">
                      {t.r != null ? `${t.r > 0 ? '+' : ''}${t.r.toFixed(2)}R` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No trades on this day"
            body="A rest day is a valid decision too. Log trades on another day, or add a life entry for today."
          />
        )}
      </Card>
    </div>
  );
}
