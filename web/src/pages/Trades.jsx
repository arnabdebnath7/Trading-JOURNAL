import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTrades } from '../lib/hooks.js';
import { filterTrades, summary } from '../lib/metrics.js';
import { Card, Chip, Money, EmptyState, Field, Select, Spinner, Confirm } from '../components/ui.jsx';
import ImportModal from '../components/ImportModal.jsx';
import { saveRow, softDelete } from '../lib/db.js';
import { scheduleSync } from '../lib/sync.js';
import { useApp } from '../state/AppContext.jsx';
import { BookOpen, Search, SlidersHorizontal, Trash2, Copy, Pencil, Download, Upload } from 'lucide-react';
import { INSTRUMENTS } from '../../../shared/tradeMath.js';

const INSTRUMENT_OPTS = Object.entries(INSTRUMENTS).map(([v, o]) => ({ value: v, label: o.label }));

export default function Trades() {
  const trades = useTrades();
  const navigate = useNavigate();
  const { settings } = useApp();
  const [showFilters, setShowFilters] = useState(false);
  const [f, setF] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const strategies = useMemo(
    () => [...new Set(trades.map((t) => t.strategy).filter(Boolean))].sort(),
    [trades]
  );

  const rows = useMemo(
    () => filterTrades(trades, f).sort((a, b) => new Date(b.entryDate || 0) - new Date(a.entryDate || 0)),
    [trades, f]
  );
  const s = useMemo(() => summary(rows), [rows]);

  const exportCsv = () => {
    const header = [
      'date', 'symbol', 'instrument', 'direction', 'qty', 'multiplier', 'entry', 'exit',
      'stop_loss', 'strategy', 'setup', 'gross_pnl', 'charges', 'net_pnl', 'r_multiple',
      'mistakes', 'emotions', 'notes'
    ];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [header.join(',')];
    for (const t of rows) {
      lines.push(
        [
          (t.exitDate || t.entryDate || '').slice(0, 10),
          t.symbol, t.instrument, t.direction, t.qty, t.multiplier ?? 1,
          t.priceEntry, t.priceExit, t.stopLoss, t.strategy, t.setup,
          t.gross, t.charges, t.net, t.r ?? '',
          (t.mistakes || []).join(' | '), (t.emotions || []).join(' | '),
          (t.notes || '').replace(/\n/g, ' ')
        ].map(esc).join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradevault-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const duplicate = async (t) => {
    const { id, updated_at, _dirty, deleted, ...rest } = t;
    const copy = await saveRow('trades', {
      ...rest,
      id: undefined,
      status: 'OPEN',
      priceExit: 0,
      exitDate: '',
      entryDate: new Date().toISOString().slice(0, 16)
    });
    scheduleSync();
    navigate(`/trades/${copy.id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Trade log</h1>
          <p className="text-[13px] text-slate-500">
            {rows.length} trades · <Money value={s.net} /> · {s.winRate.toFixed(0)}% win rate
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setImportOpen(true)}>
            <Upload size={14} /> Import
          </button>
          <button className="btn-ghost btn-sm" onClick={exportCsv}>
            <Download size={14} /> CSV
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal size={14} /> Filters
          </button>
          <Link to="/trades/new" className="btn-primary btn-sm">
            New trade
          </Link>
        </div>
      </div>

      {showFilters && (
        <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className="input pl-9"
                placeholder="Symbol, note, tag…"
                value={f.search || ''}
                onChange={(e) => setF({ ...f, search: e.target.value })}
              />
            </div>
          </Field>
          <Field label="From">
            <input type="date" className="input" value={f.from || ''} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </Field>
          <Field label="To">
            <input type="date" className="input" value={f.to || ''} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </Field>
          <Field label="Direction">
            <Select
              options={[
                { value: 'LONG', label: 'Long' },
                { value: 'SHORT', label: 'Short' }
              ]}
              placeholder="All"
              value={f.direction || ''}
              onChange={(v) => setF({ ...f, direction: v })}
            />
          </Field>
          <Field label="Instrument">
            <Select
              options={INSTRUMENT_OPTS}
              placeholder="All"
              value={f.instrument || ''}
              onChange={(v) => setF({ ...f, instrument: v })}
            />
          </Field>
          <Field label="Strategy">
            <Select
              options={strategies}
              placeholder="All"
              value={f.strategy || ''}
              onChange={(v) => setF({ ...f, strategy: v })}
            />
          </Field>
          <Field label="Outcome">
            <Select
              options={[
                { value: 'WIN', label: 'Win' },
                { value: 'LOSS', label: 'Loss' },
                { value: 'BE', label: 'Breakeven' },
                { value: 'OPEN', label: 'Open' }
              ]}
              placeholder="All"
              value={f.outcome || ''}
              onChange={(v) => setF({ ...f, outcome: v })}
            />
          </Field>
          <div className="flex items-end">
            <button className="btn-ghost w-full" onClick={() => setF({})}>
              Clear filters
            </button>
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No trades found"
          body={Object.keys(f).length ? 'Try clearing your filters.' : 'Start building your edge — log your first trade.'}
          action={
            <Link to="/trades/new" className="btn-primary btn-sm">
              Log a trade
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <TradeRow
              key={t.id}
              t={t}
              onOpen={() => navigate(`/trades/${t.id}`)}
              onDelete={() => setConfirmId(t.id)}
              onDuplicate={() => duplicate(t)}
            />
          ))}
        </div>
      )}

      <Confirm
        open={!!confirmId}
        title="Delete this trade?"
        body="It will be removed from this device and from your account on the next sync."
        confirmText="Delete"
        onCancel={() => setConfirmId(null)}
        onConfirm={async () => {
          await softDelete('trades', confirmId);
          scheduleSync();
        }}
      />

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} brokerage={settings.brokerage} />
    </div>
  );
}

function TradeRow({ t, onOpen, onDelete, onDuplicate }) {
  const outcome = t.closed ? (t.net > 0 ? 'WIN' : t.net < 0 ? 'LOSS' : 'BE') : 'OPEN';
  const badge =
    outcome === 'WIN'
      ? 'bg-profit/15 text-profit'
      : outcome === 'LOSS'
      ? 'bg-loss/15 text-loss'
      : outcome === 'BE'
      ? 'bg-slate-500/15 text-slate-300'
      : 'bg-amber-500/15 text-amber-400';

  return (
    <Card className="group transition hover:border-ink-600">
      <div className="flex items-start gap-3">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${badge}`}>{outcome}</span>
            <span className="text-[15px] font-bold text-slate-100">{t.symbol || 'Untitled'}</span>
            <span className="chip !px-2 !py-0.5 text-[10px] uppercase">
              {t.direction}
            </span>
            <span className="text-[11px] text-slate-500">
              {INSTRUMENTS[t.instrument]?.label || t.instrument}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
            <span>
              {(t.entryDate || '').slice(0, 10) || '—'}
              {t.exitDate ? ` → ${(t.exitDate || '').slice(0, 10)}` : ''}
            </span>
            <span className="tabular">
              {t.qty} × {t.priceEntry}
              {t.priceExit ? ` → ${t.priceExit}` : ''}
            </span>
            {t.strategy && <span>· {t.strategy}</span>}
            {t.r != null && (
              <span className={t.r > 0 ? 'text-profit' : 'text-loss'}>
                · {t.r > 0 ? '+' : ''}
                {t.r.toFixed(2)}R
              </span>
            )}
          </div>
          {(t.mistakes?.length || t.emotions?.length) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(t.mistakes || []).map((m) => (
                <span key={m} className="rounded bg-loss/10 px-1.5 py-0.5 text-[10px] text-loss/90">
                  {m}
                </span>
              ))}
              {(t.emotions || []).map((m) => (
                <span key={m} className="rounded bg-brand-600/10 px-1.5 py-0.5 text-[10px] text-brand-400">
                  {m}
                </span>
              ))}
            </div>
          )}
        </button>
        <div className="flex flex-col items-end gap-1.5">
          <div className="text-right">
            {t.closed ? <Money value={t.net} className="text-base font-bold" /> : <span className="text-xs text-amber-400">Open</span>}
            {t.closed && <div className="text-[10px] text-slate-600">charges ₹{(t.charges || 0).toFixed(0)}</div>}
          </div>
          <div className="flex gap-1 opacity-60 transition group-hover:opacity-100">
            <button onClick={onDuplicate} className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-700 hover:text-slate-200" title="Duplicate">
              <Copy size={14} />
            </button>
            <button onClick={onOpen} className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-700 hover:text-slate-200" title="Edit">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-700 hover:text-loss" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
