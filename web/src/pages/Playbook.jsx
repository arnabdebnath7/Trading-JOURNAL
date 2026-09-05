import React, { useState } from 'react';
import { usePlaybooks } from '../lib/hooks.js';
import { saveRow, softDelete } from '../lib/db.js';
import { scheduleSync } from '../lib/sync.js';
import { Card, EmptyState, Field, Confirm, Modal } from '../components/ui.jsx';
import { ListChecks, Plus, Trash2, Pencil } from 'lucide-react';
import { newId } from '../../../shared/schema.js';

export default function Playbook() {
  const playbooks = usePlaybooks();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const startNew = () => {
    setEditing({ id: null, title: '', description: '', rules: [] });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Playbook</h1>
          <p className="text-[13px] text-slate-500">Your setups, rules and non-negotiables.</p>
        </div>
        <button className="btn-primary btn-sm" onClick={startNew}>
          <Plus size={15} /> New strategy
        </button>
      </div>

      {playbooks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No strategies written yet"
          body="Write down what a good trade looks like for you. Traders who journal their rules stop repeating their mistakes."
          action={
            <button className="btn-primary btn-sm" onClick={startNew}>
              Write your first setup
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {playbooks.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-bold text-slate-100">{p.title || 'Untitled'}</h3>
                  {p.description && <p className="mt-0.5 text-[12px] text-slate-500">{p.description}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-700 hover:text-slate-200"
                    onClick={() => {
                      setEditing({ ...p });
                      setOpen(true);
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-700 hover:text-loss"
                    onClick={() => setConfirmId(p.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {(p.rules || []).map((r, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-slate-300">
                    <span className="text-brand-400">{i + 1}.</span> {r}
                  </li>
                ))}
                {(!p.rules || p.rules.length === 0) && (
                  <li className="text-[13px] text-slate-600">No rules yet.</li>
                )}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <PlaybookModal
        open={open}
        initial={editing}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      />

      <Confirm
        open={!!confirmId}
        title="Delete this strategy?"
        body="Your written rules will be removed."
        onCancel={() => setConfirmId(null)}
        onConfirm={async () => {
          await softDelete('playbooks', confirmId);
          scheduleSync();
        }}
      />
    </div>
  );
}

function PlaybookModal({ open, initial, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rulesText, setRulesText] = useState('');

  React.useEffect(() => {
    if (open) {
      setTitle(initial?.title || '');
      setDescription(initial?.description || '');
      setRulesText((initial?.rules || []).join('\n'));
    }
  }, [open, initial]);

  const save = async () => {
    await saveRow('playbooks', {
      ...(initial?.id ? { id: initial.id } : {}),
      title: title.trim() || 'Untitled strategy',
      description: description.trim(),
      rules: rulesText
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean)
    });
    scheduleSync(500);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Edit strategy' : 'New strategy'}
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
        <Field label="Name">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. VWAP Bounce" />
        </Field>
        <Field label="What is this setup?">
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Market condition, timeframe, when it works"
          />
        </Field>
        <Field label="Rules — one per line">
          <textarea
            className="input min-h-[160px]"
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
            placeholder={'Entry trigger\nStop loss placement\nPosition sizing\nExit rules\nWhen NOT to take it'}
          />
        </Field>
      </div>
    </Modal>
  );
}
