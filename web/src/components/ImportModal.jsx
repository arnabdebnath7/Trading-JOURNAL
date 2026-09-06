import React, { useMemo, useState } from 'react';
import { Modal, Field, Select, Money, toast } from './ui.jsx';
import {
  parseCsv,
  guessMapping,
  rowsToTrades,
  IMPORT_FIELDS
} from '../lib/csv.js';
import { computeCharges, deriveTrade } from '../../../shared/tradeMath.js';
import { saveRow } from '../lib/db.js';
import { scheduleSync } from '../lib/sync.js';
import { Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * 3-step CSV importer:
 *  1. paste or upload CSV
 *  2. check the auto-guessed column mapping (+ live preview)
 *  3. import -> rows saved offline, queued for cloud sync
 */
export default function ImportModal({ open, onClose, brokerage }) {
  const [text, setText] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const rows = useMemo(() => (text.trim() ? parseCsv(text) : []), [text]);
  const header = rows[0] || [];
  const map = useMemo(
    () => mapping || guessMapping(hasHeader ? header : header.map((_, i) => `Column ${i + 1}`)),
    [mapping, header, hasHeader]
  );
  const parsed = useMemo(
    () => (rows.length ? rowsToTrades(rows, map, { header: hasHeader }) : { trades: [], skipped: [] }),
    [rows, map, hasHeader]
  );

  const reset = () => {
    setText('');
    setMapping(null);
    setResult(null);
    setBusy(false);
  };

  const onFile = async (f) => {
    if (!f) return;
    setText(await f.text());
    setMapping(null);
    setResult(null);
  };

  const runImport = async () => {
    if (!parsed.trades.length) return;
    setBusy(true);
    let ok = 0;
    try {
      for (const row of parsed.trades) {
        await saveRow('trades', {
          ...row,
          chargesManual: 0,
          charges: row.status === 'CLOSED' ? computeCharges(row, brokerage || undefined).total : 0
        });
        ok++;
      }
      scheduleSync();
      setResult({ ok, skipped: parsed.skipped.length });
      toast.success(`Imported ${ok} trade${ok === 1 ? '' : 's'}`);
    } catch (e) {
      toast.error('Import failed: ' + (e?.message || e));
    }
    setBusy(false);
  };

  const setMap = (colIdx, field) => {
    const next = { ...map, [colIdx]: field };
    if (field !== 'ignore') {
      Object.keys(next).forEach((k) => {
        if (k !== String(colIdx) && next[k] === field) next[k] = 'ignore';
      });
    }
    setMapping(next);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        setTimeout(reset, 200);
      }}
      title="Import trades from CSV"
      size="lg"
      footer={
        !result ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-slate-500">
              {parsed.trades.length} trade{parsed.trades.length === 1 ? '' : 's'} detected
              {parsed.skipped.length ? ` · ${parsed.skipped.length} rows skipped` : ''}
            </span>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn-primary" disabled={!parsed.trades.length || busy} onClick={runImport}>
                <Upload size={15} /> {busy ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn-primary w-full" onClick={() => { onClose(); setTimeout(reset, 200); }}>
            Done
          </button>
        )
      }
    >
      {result ? (
        <div className="space-y-3 py-2 text-center">
          <CheckCircle2 size={40} className="mx-auto text-profit" />
          <p className="text-sm font-semibold text-slate-200">
            Imported {result.ok} trade{result.ok === 1 ? '' : 's'} into your journal.
          </p>
          {result.skipped > 0 && (
            <p className="text-[12px] text-slate-500">{result.skipped} row(s) were skipped — missing symbol, date, quantity or entry price.</p>
          )}
          <p className="text-[12px] text-slate-500">Charges and net P&L are auto-calculated with your brokerage settings.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {!rows.length ? (
            <>
              <Field label="Paste CSV text">
                <textarea
                  className="input min-h-28 font-mono text-[12px]"
                  placeholder={'symbol,date,qty,entry,exit,stop_loss\nRELIANCE,2026-09-01,50,1420,1455,1410\nTATAMOTORS,01-09-2026,100,960,,945'}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setMapping(null);
                  }}
                />
              </Field>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-slate-500">or</span>
                <label className="btn-ghost btn-sm cursor-pointer">
                  <FileText size={14} /> Choose a .csv file
                  <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                </label>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Works with TradeVault&apos;s own CSV export, broker P&amp;L files and generic spreadsheets. Dates in
                <b className="text-slate-500"> dd/mm/yyyy</b>, <b className="text-slate-500">yyyy-mm-dd</b> or
                <b className="text-slate-500"> 14-Jun-2026</b> format are auto-detected; you can fix the column mapping in the next step.
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] text-slate-400">
                  {rows.length} row{rows.length === 1 ? '' : 's'} · {header.length} columns
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[12px] text-slate-400">
                    <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} className="accent-brand-500" />
                    First row is header
                  </label>
                  <button className="btn-ghost btn-sm" onClick={reset}>
                    Start over
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="label !mb-0">Column mapping</div>
                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                  {header.map((h, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr] items-center gap-2">
                      <span className="truncate rounded-lg bg-ink-800 px-2.5 py-1.5 font-mono text-[12px] text-slate-400">
                        {hasHeader ? h || `(column ${i + 1})` : `Column ${i + 1}`}
                      </span>
                      <Select options={IMPORT_FIELDS} value={map[i] ?? 'ignore'} onChange={(v) => setMap(i, v)} />
                    </div>
                  ))}
                </div>
              </div>

              {parsed.skipped.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    {parsed.skipped.length} row(s) will be skipped (missing symbol, date, qty or entry price).
                    {parsed.skipped[0] && ` First skip at line ${parsed.skipped[0].line}: ${parsed.skipped[0].reason}.`}
                  </span>
                </div>
              )}

              <div>
                <div className="label">Preview (first 5)</div>
                <div className="overflow-x-auto rounded-xl border border-ink-700">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-ink-700 bg-ink-800/60">
                        <th className="th">Symbol</th>
                        <th className="th">Dir</th>
                        <th className="th text-right">Qty</th>
                        <th className="th text-right">Entry</th>
                        <th className="th text-right">Exit</th>
                        <th className="th text-right">Net P&amp;L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.trades.slice(0, 5).map((t, i) => {
                        const d = deriveTrade(t, brokerage || undefined);
                        return (
                          <tr key={i} className="border-b border-ink-800/70 last:border-0">
                            <td className="td font-semibold">{t.symbol}</td>
                            <td className="td text-slate-400">{t.direction === 'SHORT' ? 'S' : 'L'}</td>
                            <td className="td tabular text-right">{t.qty}</td>
                            <td className="td tabular text-right">{t.priceEntry}</td>
                            <td className="td tabular text-right">{t.priceExit || <span className="text-amber-400">open</span>}</td>
                            <td className="td text-right">
                              {t.status === 'CLOSED' ? <Money value={d.netPnl} /> : <span className="text-slate-500">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {!parsed.trades.length && (
                        <tr>
                          <td colSpan={6} className="td text-center text-slate-500">
                            Nothing importable yet — check the column mapping.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
