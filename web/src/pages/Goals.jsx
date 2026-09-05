import React, { useMemo, useState } from 'react';
import { useGoals, useTrades, useEntries } from '../lib/hooks.js';
import { saveRow, softDelete } from '../lib/db.js';
import { scheduleSync } from '../lib/sync.js';
import { Card, EmptyState, Field, Select, Confirm, Modal, ProgressBar, Money } from '../components/ui.jsx';
import { summary, journalStreak } from '../lib/metrics.js';
import { Target, Plus, Trash2, Pencil } from 'lucide-react';

const TYPES = [
  { value: 'profit', label: 'Monthly profit target (₹)', unit: '₹' },
  { value: 'winRate', label: 'Win rate (%)', unit: '%' },
  { value: 'maxTrades', label: 'Max trades per month', unit: ' trades' },
  { value: 'journalStreak', label: 'Journal streak (days)', unit: ' days' },
  { value: 'custom', label: 'Custom number', unit: '' }
];

export default function Goals() {
  const goals = useGoals();
  const trades = useTrades();
  const entries = useEntries();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const now = new Date();
  const monthTrades = useMemo(
    () =>
      trades.filter((t) => {
        const d = new Date(t.exitDate || t.entryDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }),
    [trades, now.getMonth(), now.getFullYear()]
  );
  const s = useMemo(() => summary(monthTrades), [monthTrades]);
  const streak = useMemo(() => journalStreak(entries.map((e) => e.date)), [entries]);

  const progress = (g) => {
    if (g.type === 'profit') return { cur: s.net, pct: (s.net / (g.targetValue || 1)) * 100 };
    if (g.type === 'winRate') return { cur: s.winRate, pct: (s.winRate / (g.targetValue || 1)) * 100 };
    if (g.type === 'maxTrades') return { cur: s.closedTrades, pct: (s.closedTrades / (g.targetValue || 1)) * 100 };
    if (g.type === 'journalStreak') return { cur: streak.current, pct: (streak.current / (g.targetValue || 1)) * 100 };
    return { cur: 0, pct: 0 };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Goals &amp; limits</h1>
          <p className="text-[13px] text-slate-500">
            This month: {s.closedTrades} trades · <Money value={s.net} /> · {s.winRate.toFixed(0)}% win rate
          </p>
        </div>
        <button
          className="btn-primary btn-sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus size={15} /> New goal
        </button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals set"
          body="Set a monthly profit target, a win-rate goal or a max-trades limit. Limits stop you from overtrading."
          action={
            <button
              className="btn-primary btn-sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              Set a goal
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((g) => {
            const p = progress(g);
            const unit = TYPES.find((t) => t.value === g.type)?.unit || '';
            const over = g.type === 'maxTrades' && p.cur > g.targetValue;
            return (
              <Card key={g.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-bold text-slate-100">{g.title}</h3>
                    <p className="text-[11px] text-slate-500">{TYPES.find((t) => t.value === g.type)?.label}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-700 hover:text-slate-200"
                      onClick={() => {
                        setEditing({ ...g });
                        setOpen(true);
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-700 hover:text-loss"
                      onClick={() => setConfirmId(g.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between text-[13px]">
                  <span className="tabular font-semibold text-slate-200">
                    {g.type === 'profit' ? `₹${Math.round(p.cur)}` : `${Math.round(p.cur)}${unit}`}
                    <span className="text-slate-500"> / {g.type === 'profit' ? `₹${g.targetValue}` : `${g.targetValue}${unit}`}</span>
                  </span>
                  <span className={`text-[12px] font-semibold ${p.pct >= 100 ? 'text-profit' : 'text-slate-500'}`}>
                    {p.pct >= 100 ? (over ? 'Limit crossed' : 'Achieved 🎉') : `${p.pct.toFixed(0)}%`}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={Math.min(100, p.pct)} tone={over ? 'loss' : p.pct >= 100 ? 'profit' : 'brand'} />
                </div>
                {g.note && <p className="mt-2 text-[11px] text-slate-500">{g.note}</p>}
              </Card>
            );
          })}
        </div>
      )}

      <GoalModal open={open} initial={editing} onClose={() => setOpen(false)} />

      <Confirm
        open={!!confirmId}
        title="Delete this goal?"
        body=""
        onCancel={() => setConfirmId(null)}
        onConfirm={async () => {
          await softDelete('goals', confirmId);
          scheduleSync();
        }}
      />
    </div>
  );
}

function GoalModal({ open, initial, onClose }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('profit');
  const [targetValue, setTargetValue] = useState('');
  const [note, setNote] = useState('');

  React.useEffect(() => {
    if (open) {
      setTitle(initial?.title || '');
      setType(initial?.type || 'profit');
      setTargetValue(initial?.targetValue ?? '');
      setNote(initial?.note || '');
    }
  }, [open, initial]);

  const save = async () => {
    await saveRow('goals', {
      ...(initial?.id ? { id: initial.id } : {}),
      title: title.trim() || 'Goal',
      type,
      targetValue: Number(targetValue) || 0,
      period: 'monthly',
      note: note.trim()
    });
    scheduleSync(500);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Edit goal' : 'New goal'}
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
        <Field label="Goal name">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. August target" />
        </Field>
        <Field label="Type">
          <Select options={TYPES} value={type} onChange={setType} />
        </Field>
        <Field label="Target">
          <input className="input tabular" type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="10000" />
        </Field>
        <Field label="Note (optional)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this matters" />
        </Field>
      </div>
    </Modal>
  );
}
