import React, { useMemo, useState } from 'react';
import { useHabits, useEntries, todayKey } from '../lib/hooks.js';
import { saveRow, softDelete } from '../lib/db.js';
import { scheduleSync } from '../lib/sync.js';
import { Card, EmptyState, Field, Confirm, Modal } from '../components/ui.jsx';
import { HeartPulse, Plus, Trash2, Pencil, Check } from 'lucide-react';

const ICONS = ['✅','💪','📚','🧘','😴','🧊','💧','🏃','🥗','📵','🧠','🙏','🌅','✍️','🚭','💰'];

export default function Habits() {
  const habits = useHabits();
  const entries = useEntries();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const last30 = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
    }
    return days;
  }, []);

  const doneMap = useMemo(() => {
    const m = new Map();
    for (const e of entries) for (const [hid, v] of Object.entries(e.habits || {})) {
      if (v) {
        if (!m.has(hid)) m.set(hid, new Set());
        m.get(hid).add(e.date);
      }
    }
    return m;
  }, [entries]);

  const toggleToday = async (h) => {
    const today = todayKey();
    const existing = entries.find((e) => e.date === today);
    const habitsState = { ...(existing?.habits || {}) };
    habitsState[h.id] = !habitsState[h.id];
    await saveRow('journal_entries', {
      ...(existing?.id ? { id: existing.id } : {}),
      date: today,
      habits: habitsState,
      mood: existing?.mood ?? 0,
      energy: existing?.energy ?? 0,
      stress: existing?.stress ?? 0,
      rating: existing?.rating ?? 0,
      gratitude: existing?.gratitude ?? [],
      tags: existing?.tags ?? [],
      notes: existing?.notes ?? '',
      highlights: existing?.highlights ?? ''
    });
    scheduleSync(600);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Habits</h1>
          <p className="text-[13px] text-slate-500">Daily routines that keep your mind fit for trading.</p>
        </div>
        <button
          className="btn-primary btn-sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus size={15} /> New habit
        </button>
      </div>

      {habits.length === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title="No habits yet"
          body="Add the routines you want to keep — exercise, reading, sleep, no revenge trading."
          action={
            <button
              className="btn-primary btn-sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              Add a habit
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {habits.map((h) => {
            const done = doneMap.get(h.id) || new Set();
            const rate = Math.round((last30.filter((d) => done.has(d)).length / 30) * 100);
            const todayDone = done.has(todayKey());
            return (
              <Card key={h.id}>
                <div className="flex items-start justify-between gap-3">
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => toggleToday(h)}>
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        borderColor: todayDone ? h.color : '#24303f',
                        background: todayDone ? `${h.color}22` : 'transparent',
                        color: todayDone ? h.color : '#64748b'
                      }}
                    >
                      {todayDone ? <Check size={15} strokeWidth={4} /> : <span className="text-[14px]">{h.icon}</span>}
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-[14px] ${h.archived ? 'text-slate-600 line-through' : 'text-slate-100'}`}>
                        {h.name}
                      </span>
                      <span className="text-[11px] text-slate-500">{rate}% of the last 30 days</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-700 hover:text-slate-200"
                      onClick={() => {
                        setEditing({ ...h });
                        setOpen(true);
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-700 hover:text-loss"
                      onClick={() => setConfirmId(h.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex gap-[3px]">
                  {last30.map((d) => (
                    <div
                      key={d}
                      title={d}
                      className="h-4 flex-1 rounded-[3px]"
                      style={{
                        background: done.has(d) ? h.color : '#131b27',
                        opacity: done.has(d) ? 0.9 : 1
                      }}
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <HabitModal open={open} initial={editing} count={habits.length} onClose={() => setOpen(false)} />

      <Confirm
        open={!!confirmId}
        title="Delete habit?"
        body="Habit history in past journal entries will stay, but the habit disappears from your list."
        onCancel={() => setConfirmId(null)}
        onConfirm={async () => {
          await softDelete('habits', confirmId);
          scheduleSync();
        }}
      />
    </div>
  );
}

function HabitModal({ open, initial, count, onClose }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('✅');
  const [color, setColor] = useState('#22c55e');
  const [archived, setArchived] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(initial?.name || '');
      setIcon(initial?.icon || '✅');
      setColor(initial?.color || '#22c55e');
      setArchived(!!initial?.archived);
    }
  }, [open, initial]);

  const save = async () => {
    await saveRow('habits', {
      ...(initial?.id ? { id: initial.id } : {}),
      name: name.trim() || 'Habit',
      icon,
      color,
      archived: archived ? 1 : 0,
      sort_order: initial?.sort_order ?? count
    });
    scheduleSync(500);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Edit habit' : 'New habit'}
      footer={
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary flex-1" onClick={save}>
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Habit">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Read 20 pages" />
        </Field>
        <Field label="Icon">
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((i) => (
              <button
                key={i}
                onClick={() => setIcon(i)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[15px] ${
                  icon === i ? 'border-brand-500 bg-brand-600/20' : 'border-ink-700 bg-ink-900'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Colour">
          <div className="flex flex-wrap items-center gap-2">
            {['#22c55e', '#60a5fa', '#a78bfa', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#eab308'].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
        {initial?.id && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="h-4 w-4 rounded" />
            Archive (hide from daily list)
          </label>
        )}
      </div>
    </Modal>
  );
}
