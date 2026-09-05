import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { db, saveRow, softDelete } from '../lib/db.js';
import { scheduleSync } from '../lib/sync.js';
import { useEntries, useHabits, useTrades, todayKey, MOODS } from '../lib/hooks.js';
import { dailyPnl } from '../lib/metrics.js';
import { Card, Field, Rating, Confirm, Chip, Money, TagInput } from '../components/ui.jsx';
import { ArrowLeft, Trash2, Save, Sparkles, Check } from 'lucide-react';
import { newId } from '../../../shared/schema.js';

const PROMPTS = [
  'What went well today?',
  'What did I learn about myself?',
  'What will I do differently tomorrow?',
  'Where did I follow my plan — and where did I not?',
  'What am I avoiding right now?'
];

const blank = (date) => ({
  date,
  mood: 0,
  energy: 0,
  stress: 0,
  sleepHours: '',
  waterGlasses: '',
  exerciseMin: '',
  screenHours: '',
  gratitude: ['', '', ''],
  habits: {},
  highlights: '',
  notes: '',
  rating: 0,
  tags: []
});

export default function JournalEntry() {
  const { date } = useParams();
  const navigate = useNavigate();
  const initialDate = !date || date === 'new' ? todayKey() : date;
  const [form, setForm] = useState(() => blank(initialDate));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [existingId, setExistingId] = useState(null);
  const [prompt] = useState(() => PROMPTS[new Date().getDate() % PROMPTS.length]);

  const habits = useHabits();
  const entries = useEntries();
  const trades = useTrades();

  useEffect(() => {
    let alive = true;
    db.journal_entries
      .where('date')
      .equals(initialDate)
      .first()
      .then((e) => {
        if (!alive) return;
        if (e && !e.deleted) {
          setForm({ ...blank(initialDate), ...e, gratitude: [...(e.gratitude || []), '', '', ''].slice(0, 3) });
          setExistingId(e.id);
        } else {
          setForm(blank(initialDate));
          setExistingId(null);
        }
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [initialDate]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const dayPnl = useMemo(() => {
    const d = dailyPnl(trades).find((x) => x.date === form.date);
    return d?.net ?? null;
  }, [trades, form.date]);

  const save = async () => {
    setSaving(true);
    try {
      const rec = await saveRow('journal_entries', {
        ...(existingId ? { id: existingId } : {}),
        ...form,
        sleepHours: Number(form.sleepHours) || 0,
        waterGlasses: Number(form.waterGlasses) || 0,
        exerciseMin: Number(form.exerciseMin) || 0,
        screenHours: Number(form.screenHours) || 0,
        gratitude: (form.gratitude || []).filter((g) => String(g).trim())
      });
      scheduleSync(500);
      navigate('/journal');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-64" />;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex gap-2">
          {existingId && (
            <button className="btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button className="btn-primary btn-sm" onClick={save} disabled={saving}>
            <Save size={15} /> Save
          </button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Field label="Date" className="min-w-[150px] flex-1">
            <input type="date" className="input" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          {dayPnl != null && (
            <div className="text-right">
              <div className="stat-label">Trading P&L</div>
              <Money value={dayPnl} className="text-lg font-bold" />
            </div>
          )}
        </div>
      </Card>

      {/* Mood */}
      <Card>
        <h2 className="section-title mb-3">How was today?</h2>
        <div className="grid grid-cols-5 gap-1.5">
          {MOODS.slice(1).map((m) => (
            <button
              key={m.v}
              onClick={() => set({ mood: m.v })}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition ${
                form.mood === m.v
                  ? 'border-brand-500 bg-brand-600/20'
                  : 'border-ink-700 bg-ink-900 hover:bg-ink-800'
              }`}
            >
              <span className="text-xl">{m.emoji}</span>
              <span className={`text-[10px] ${form.mood === m.v ? 'text-brand-400' : 'text-slate-500'}`}>{m.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <span className="label">Energy level</span>
            <Rating value={form.energy} onChange={(v) => set({ energy: v })} />
          </div>
          <div>
            <span className="label">Stress level</span>
            <Rating value={form.stress} onChange={(v) => set({ stress: v })} labels={['Calm','Mild','Moderate','High','Very high']} />
          </div>
          <div>
            <span className="label">Overall rating of the day</span>
            <Rating value={form.rating} onChange={(v) => set({ rating: v })} />
          </div>
        </div>
      </Card>

      {/* Body metrics */}
      <Card className="space-y-3">
        <h2 className="section-title">Body &amp; routine</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sleep (hours)">
            <input
              className="input tabular"
              type="number"
              step="0.5"
              inputMode="decimal"
              placeholder="7"
              value={form.sleepHours}
              onChange={(e) => set({ sleepHours: e.target.value })}
            />
          </Field>
          <Field label="Water (glasses)">
            <input
              className="input tabular"
              type="number"
              inputMode="numeric"
              placeholder="8"
              value={form.waterGlasses}
              onChange={(e) => set({ waterGlasses: e.target.value })}
            />
          </Field>
          <Field label="Exercise (minutes)">
            <input
              className="input tabular"
              type="number"
              inputMode="numeric"
              placeholder="30"
              value={form.exerciseMin}
              onChange={(e) => set({ exerciseMin: e.target.value })}
            />
          </Field>
          <Field label="Screen time (hours)">
            <input
              className="input tabular"
              type="number"
              step="0.5"
              inputMode="decimal"
              placeholder="6"
              value={form.screenHours}
              onChange={(e) => set({ screenHours: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      {/* Habits */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Today's habits</h2>
          <Link to="/habits" className="text-[11px] text-brand-400">
            Manage
          </Link>
        </div>
        {habits.length === 0 ? (
          <p className="text-[13px] text-slate-500">
            No habits yet. <Link to="/habits" className="text-brand-400">Add some</Link> to build your streak.
          </p>
        ) : (
          <div className="space-y-1.5">
            {habits
              .filter((h) => !h.archived)
              .map((h) => {
                const done = !!form.habits?.[h.id];
                return (
                  <button
                    key={h.id}
                    onClick={() => set({ habits: { ...form.habits, [h.id]: !done } })}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      done ? 'border-profit/40 bg-profit/10' : 'border-ink-700 bg-ink-900'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        done ? 'border-profit bg-profit text-ink-950' : 'border-ink-600'
                      }`}
                    >
                      {done && <Check size={13} strokeWidth={4} />}
                    </span>
                    <span className="text-[15px]">{h.icon}</span>
                    <span className={`text-[14px] ${done ? 'text-slate-100' : 'text-slate-400'}`}>{h.name}</span>
                  </button>
                );
              })}
          </div>
        )}
      </Card>

      {/* Gratitude */}
      <Card className="space-y-3">
        <h2 className="section-title flex items-center gap-2">
          <Sparkles size={15} className="text-amber-400" /> Three good things
        </h2>
        {[0, 1, 2].map((i) => (
          <input
            key={i}
            className="input"
            placeholder={`Grateful for… (${i + 1})`}
            value={form.gratitude?.[i] || ''}
            onChange={(e) => {
              const g = [...(form.gratitude || ['', '', ''])];
              g[i] = e.target.value;
              set({ gratitude: g });
            }}
          />
        ))}
      </Card>

      {/* Writing */}
      <Card className="space-y-3">
        <h2 className="section-title">Your day</h2>
        <Field label="Highlight of the day">
          <input
            className="input"
            placeholder="One line about the best part"
            value={form.highlights}
            onChange={(e) => set({ highlights: e.target.value })}
          />
        </Field>
        <Field label={`Reflection — ${prompt}`}>
          <textarea
            className="input min-h-[160px]"
            placeholder="Write freely. What happened, how you reacted, what you want to remember…"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>
        <Field label="Tags">
          <TagInput
            values={form.tags || []}
            onChange={(v) => set({ tags: v })}
            suggestions={['family', 'work', 'health', 'trading', 'travel', 'study']}
            placeholder="tag"
          />
        </Field>
      </Card>

      {entries.length > 1 && (
        <Card>
          <h2 className="section-title mb-2">Recently</h2>
          <div className="flex flex-wrap gap-1.5">
            {entries.slice(0, 8).map((e) => (
              <Chip key={e.id} active={e.date === form.date} onClick={() => navigate(`/journal/${e.date}`)}>
                {MOODS[e.mood || 0].emoji} {e.date.slice(5)}
              </Chip>
            ))}
          </div>
        </Card>
      )}

      <Confirm
        open={confirmDelete}
        title="Delete this entry?"
        body="Your journal entry for this day will be removed."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await softDelete('journal_entries', existingId);
          scheduleSync(500);
          navigate('/journal');
        }}
      />
    </div>
  );
}
