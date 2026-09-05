import React, { useState } from 'react';
import { useWatchlist } from '../lib/hooks.js';
import { saveRow, softDelete } from '../lib/db.js';
import { scheduleSync } from '../lib/sync.js';
import { Card, EmptyState, Field, Confirm, Modal, Money } from '../components/ui.jsx';
import { Eye, Plus, Trash2, Pencil } from 'lucide-react';

export default function Watchlist() {
  const items = useWatchlist();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Watchlist</h1>
          <p className="text-[13px] text-slate-500">Ideas you are waiting on, with levels and thesis.</p>
        </div>
        <button
          className="btn-primary btn-sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus size={15} /> Add symbol
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Eye}
          title="Nothing on your watchlist"
          body="Add the stocks you are tracking with your levels, so you only trade what you planned."
          action={
            <button
              className="btn-primary btn-sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              Add a symbol
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((w) => (
            <Card key={w.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold uppercase text-slate-100">{w.symbol}</span>
                    <span className="chip !px-1.5 !py-0.5 text-[10px]">{w.exchange || 'NSE'}</span>
                  </div>
                  {w.name && <p className="truncate text-[12px] text-slate-500">{w.name}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-700 hover:text-slate-200"
                    onClick={() => {
                      setEditing({ ...w });
                      setOpen(true);
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-700 hover:text-loss"
                    onClick={() => setConfirmId(w.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div>
                  <span className="text-slate-500">Target </span>
                  <span className="tabular font-semibold text-profit">{w.target ? `₹${w.target}` : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Stop </span>
                  <span className="tabular font-semibold text-loss">{w.stopLoss ? `₹${w.stopLoss}` : '—'}</span>
                </div>
              </div>
              {w.notes && <p className="mt-2 whitespace-pre-wrap text-[12px] text-slate-400">{w.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      <WatchModal open={open} initial={editing} onClose={() => setOpen(false)} />

      <Confirm
        open={!!confirmId}
        title="Remove from watchlist?"
        body="This idea will be deleted."
        onCancel={() => setConfirmId(null)}
        onConfirm={async () => {
          await softDelete('watchlist', confirmId);
          scheduleSync();
        }}
      />
    </div>
  );
}

function WatchModal({ open, initial, onClose }) {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (open) {
      setSymbol(initial?.symbol || '');
      setName(initial?.name || '');
      setTarget(initial?.target || '');
      setStopLoss(initial?.stopLoss || '');
      setNotes(initial?.notes || '');
    }
  }, [open, initial]);

  const save = async () => {
    await saveRow('watchlist', {
      ...(initial?.id ? { id: initial.id } : {}),
      symbol: symbol.trim().toUpperCase(),
      name: name.trim(),
      exchange: initial?.exchange || 'NSE',
      target: Number(target) || 0,
      stopLoss: Number(stopLoss) || 0,
      notes: notes.trim()
    });
    scheduleSync(500);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Edit idea' : 'Add to watchlist'}
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
        <Field label="Symbol">
          <input className="input uppercase" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="RELIANCE" />
        </Field>
        <Field label="Name (optional)">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Reliance Industries" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target">
            <input className="input tabular" type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
          <Field label="Stop">
            <input className="input tabular" type="number" step="0.01" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
          </Field>
        </div>
        <Field label="Thesis / trigger">
          <textarea className="input min-h-[100px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why this idea, what would confirm entry" />
        </Field>
      </div>
    </Modal>
  );
}
