import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEntries, useTrades, todayKey, MOODS } from '../lib/hooks.js';
import { dailyPnl, journalStreak } from '../lib/metrics.js';
import { Card, SectionTitle, Stat, EmptyState, Chip, Money } from '../components/ui.jsx';
import { CalendarHeatmap, MONTHS } from '../components/Charts.jsx';
import { NotebookPen, Flame, Plus, Search } from 'lucide-react';

export default function Journal() {
  const entries = useEntries();
  const trades = useTrades();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { month: d.getMonth(), year: d.getFullYear() };
  });
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('mood');

  const daily = useMemo(() => dailyPnl(trades), [trades]);
  const streak = useMemo(() => journalStreak(entries.map((e) => e.date)), [entries]);

  const calendarData = useMemo(() => {
    if (mode === 'pnl') return daily;
    return entries
      .filter((e) => e.mood)
      .map((e) => ({ date: e.date, net: (e.mood - 3) * 100, trades: 1 }));
  }, [mode, daily, entries]);

  const monthEntries = useMemo(
    () =>
      entries.filter((e) => {
        const d = new Date(e.date + 'T00:00:00');
        return d.getMonth() === cursor.month && d.getFullYear() === cursor.year;
      }),
    [entries, cursor]
  );

  const avg = (key) => {
    const vals = monthEntries.map((e) => Number(e[key]) || 0).filter((v) => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries.slice(0, 40);
    return entries
      .filter((e) =>
        [e.notes, e.highlights, ...(e.gratitude || []), ...(e.tags || [])].join(' ').toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [entries, query]);

  const shift = (delta) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { month: d.getMonth(), year: d.getFullYear() };
    });
  };

  const today = todayKey();
  const hasToday = entries.some((e) => e.date === today);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Life journal</h1>
          <p className="text-[13px] text-slate-500">
            {entries.length} entries · {streak.current} day streak
          </p>
        </div>
        <Link to="/journal/new" className="btn-primary btn-sm">
          {hasToday ? <Plus size={15} /> : <NotebookPen size={15} />} {hasToday ? "Add entry" : "Write today"}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Journal streak" value={`${streak.current}d`} sub={`best ${streak.longest}d`} tone={streak.current ? 'profit' : 'default'} />
        <Stat label="Avg mood" value={avg('mood') ? `${avg('mood').toFixed(1)}/5` : '—'} sub="this month" />
        <Stat label="Avg sleep" value={avg('sleepHours') ? `${avg('sleepHours').toFixed(1)}h` : '—'} sub="this month" />
        <Stat label="Entries" value={monthEntries.length} sub={`${MONTHS[cursor.month]} ${cursor.year}`} />
      </div>

      <Card>
        <SectionTitle
          right={
            <div className="flex gap-1">
              <Chip active={mode === 'mood'} onClick={() => setMode('mood')}>
                Mood
              </Chip>
              <Chip active={mode === 'pnl'} onClick={() => setMode('pnl')}>
                P&amp;L
              </Chip>
            </div>
          }
        >
          <div className="flex items-center gap-2">
            <button onClick={() => shift(-1)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-ink-800">
              ‹
            </button>
            <span className="min-w-[110px] text-center text-[13px] font-semibold text-slate-200">
              {MONTHS[cursor.month]} {cursor.year}
            </span>
            <button onClick={() => shift(1)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-ink-800">
              ›
            </button>
          </div>
        </SectionTitle>
        <CalendarHeatmap data={calendarData} month={cursor.month} year={cursor.year} />
      </Card>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input pl-9"
          placeholder="Search your entries…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title={query ? 'No matching entries' : 'Your life journal starts today'}
          body={
            query
              ? 'Try a different word.'
              : 'Two minutes a day: how you slept, how you feel, what you are grateful for. It shows up in your trading stats.'
          }
          action={
            !query ? (
              <Link to="/journal/new" className="btn-primary btn-sm">
                Write your first entry
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => {
            const pnl = daily.find((d) => d.date === e.date)?.net;
            return (
              <Link key={e.id} to={`/journal/${e.date}`}>
                <Card className="transition hover:border-ink-600">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-slate-100">
                          {new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short'
                          })}
                        </span>
                        {e.mood ? (
                          <span className="text-[13px]">
                            {MOODS[e.mood].emoji} <span className="text-slate-400">{MOODS[e.mood].label}</span>
                          </span>
                        ) : null}
                        {e.habits && Object.values(e.habits).filter(Boolean).length > 0 && (
                          <span className="chip !px-1.5 !py-0.5 text-[10px]">
                            ✅ {Object.values(e.habits).filter(Boolean).length}
                          </span>
                        )}
                      </div>
                      {e.highlights && <p className="mt-1 truncate text-[13px] text-slate-300">{e.highlights}</p>}
                      {e.notes && <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-500">{e.notes}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      {pnl != null && <Money value={pnl} />}
                      {e.sleepHours > 0 && <div className="text-[10px] text-slate-600">{e.sleepHours}h sleep</div>}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
