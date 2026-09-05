import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveRow, softDelete } from '../lib/db.js';
import { scheduleSync } from '../lib/sync.js';
import { useApp } from '../state/AppContext.jsx';
import { useTrades, useWatchlist, usePlaybooks } from '../lib/hooks.js';
import { deriveTrade, computeCharges, INSTRUMENTS, fmtMoney } from '../../../shared/tradeMath.js';
import { Card, Field, Select, Chip, Money, TagInput, Rating, Confirm, Segmented, Switch } from '../components/ui.jsx';
import { ArrowLeft, Trash2, Save, Camera, X, ListChecks, Calculator } from 'lucide-react';

const INSTRUMENT_OPTS = Object.entries(INSTRUMENTS).map(([v, o]) => ({ value: v, label: o.label }));

const blank = () => ({
  symbol: '',
  instrument: 'EQUITY_INTRADAY',
  direction: 'LONG',
  segment: 'INTRADAY',
  entryDate: new Date().toISOString().slice(0, 16),
  exitDate: '',
  qty: '',
  multiplier: 1,
  priceEntry: '',
  priceExit: '',
  stopLoss: '',
  target: '',
  strategy: '',
  setup: '',
  mistakes: [],
  emotions: [],
  tags: [],
  notes: '',
  rating: 0,
  charges: 0,
  chargesManual: 0,
  images: [],
  status: 'OPEN',
  accountSize: ''
});

export default function TradeEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useApp();
  const trades = useTrades();
  const watchlist = useWatchlist();
  const playbooks = usePlaybooks();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState(blank());
  const [loading, setLoading] = useState(!isNew);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCharges, setShowCharges] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    db.trades.get(id).then((t) => {
      if (!alive) return;
      if (t) setForm({ ...blank(), ...t });
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id, isNew]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const brokerage = settings.brokerage || {};
  const derived = useMemo(() => deriveTrade(form, brokerage), [form, brokerage]);
  const chargesBreakup = useMemo(() => computeCharges(form, brokerage), [form, brokerage]);

  const symbols = useMemo(
    () => [...new Set([...trades.map((t) => t.symbol), ...watchlist.map((w) => w.symbol)].filter(Boolean))].slice(0, 40),
    [trades, watchlist]
  );

  const save = async (close = false) => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        qty: Number(form.qty) || 0,
        multiplier: Number(form.multiplier) || 1,
        priceEntry: Number(form.priceEntry) || 0,
        priceExit: Number(form.priceExit) || 0,
        stopLoss: Number(form.stopLoss) || 0,
        target: Number(form.target) || 0,
        accountSize: Number(form.accountSize) || 0,
        charges: form.chargesManual ? Number(form.charges) || 0 : chargesBreakup.total,
        status: form.priceExit ? 'CLOSED' : 'OPEN',
        ...(isNew ? {} : { id })
      };
      await saveRow('trades', payload);
      scheduleSync(500);
      if (close) navigate('/trades');
      else if (isNew) navigate('/trades');
    } finally {
      setSaving(false);
    }
  };

  const onPickImages = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 3);
    for (const f of files) {
      const dataUrl = await compressImage(f);
      setForm((f2) => ({ ...f2, images: [...(f2.images || []), dataUrl].slice(0, 3) }));
    }
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Calculator className="animate-pulse" size={22} />
      </div>
    );
  }

  const gross = derived.grossPnl;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex gap-2">
          {!isNew && (
            <button className="btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button className="btn-primary btn-sm" onClick={() => save(true)} disabled={saving}>
            <Save size={15} /> {isNew ? 'Save trade' : 'Save'}
          </button>
        </div>
      </div>

      {/* Live result preview */}
      <Card className="border-brand-600/30 bg-gradient-to-br from-brand-600/10 to-transparent">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="stat-label">Gross</div>
            <Money value={gross} className="text-base font-bold" />
          </div>
          <div>
            <div className="stat-label">Charges</div>
            <div className="tabular text-base font-bold text-loss">-{fmtMoney(form.chargesManual ? Number(form.charges) || 0 : chargesBreakup.total)}</div>
          </div>
          <div>
            <div className="stat-label">Net P&amp;L</div>
            <Money
              value={form.chargesManual ? gross - (Number(form.charges) || 0) : derived.netPnl}
              className="text-base font-bold"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 border-t border-ink-700 pt-3 text-[12px] text-slate-400">
          <span>
            Risk: <b className="text-slate-200">{derived.riskAmount ? fmtMoney(derived.riskAmount) : '—'}</b>
          </span>
          <span>
            R: <b className={derived.rMultiple > 0 ? 'text-profit' : 'text-loss'}>{derived.rMultiple != null ? `${derived.rMultiple > 0 ? '+' : ''}${derived.rMultiple.toFixed(2)}R` : '—'}</b>
          </span>
          <span>
            Holding: <b className="text-slate-200">{derived.holdingMinutes != null ? fmtHolding(derived.holdingMinutes) : '—'}</b>
          </span>
          <button className="text-brand-400 underline" onClick={() => setShowCharges((v) => !v)}>
            {showCharges ? 'hide' : 'charges breakdown'}
          </button>
        </div>
        {showCharges && (
          <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-ink-700 pt-3 text-[12px] sm:grid-cols-3">
            {Object.entries(chargesBreakup)
              .filter(([k]) => k !== 'total' && k !== 'turnover')
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="capitalize text-slate-500">{k.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="tabular text-slate-300">{fmtMoney(v)}</span>
                </div>
              ))}
            <div className="flex justify-between gap-2 font-semibold">
              <span className="text-slate-400">Total</span>
              <span className="tabular text-loss">{fmtMoney(chargesBreakup.total)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Turnover</span>
              <span className="tabular text-slate-400">{fmtMoney(chargesBreakup.turnover)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Trade details */}
      <Card className="space-y-3">
        <h2 className="section-title">Trade</h2>
        <Field label="Symbol / Scrip">
          <input
            className="input uppercase"
            list="symbols"
            placeholder="RELIANCE, NIFTY 24500 CE, BANKNIFTY FUT…"
            value={form.symbol}
            onChange={(e) => set({ symbol: e.target.value.toUpperCase() })}
          />
          <datalist id="symbols">
            {symbols.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Instrument">
            <Select
              options={INSTRUMENT_OPTS}
              value={form.instrument}
              onChange={(v) => set({ instrument: v, segment: v === 'EQUITY_DELIVERY' ? 'DELIVERY' : 'INTRADAY' })}
            />
          </Field>
          <Field label="Direction">
            <Segmented
              options={[
                { value: 'LONG', label: 'Long' },
                { value: 'SHORT', label: 'Short' }
              ]}
              value={form.direction}
              onChange={(v) => set({ direction: v })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">
            <input
              className="input tabular"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={form.qty}
              onChange={(e) => set({ qty: e.target.value })}
            />
          </Field>
          <Field label={form.instrument === 'OPT' || form.instrument === 'FUT' ? 'Lot size' : 'Multiplier'}>
            <input
              className="input tabular"
              type="number"
              inputMode="numeric"
              value={form.multiplier}
              onChange={(e) => set({ multiplier: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Entry price">
            <input
              className="input tabular"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={form.priceEntry}
              onChange={(e) => set({ priceEntry: e.target.value })}
            />
          </Field>
          <Field label="Exit price">
            <input
              className="input tabular"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder={form.status === 'OPEN' ? 'still open' : '0.00'}
              value={form.priceExit}
              onChange={(e) => set({ priceExit: e.target.value, status: e.target.value ? 'CLOSED' : 'OPEN' })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Entry time">
            <input className="input" type="datetime-local" value={form.entryDate} onChange={(e) => set({ entryDate: e.target.value })} />
          </Field>
          <Field label="Exit time">
            <input className="input" type="datetime-local" value={form.exitDate} onChange={(e) => set({ exitDate: e.target.value })} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stop loss">
            <input
              className="input tabular"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.stopLoss}
              onChange={(e) => set({ stopLoss: e.target.value })}
            />
          </Field>
          <Field label="Target">
            <input
              className="input tabular"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.target}
              onChange={(e) => set({ target: e.target.value })}
            />
          </Field>
        </div>

        {(form.stopLoss || form.target) && form.priceEntry && (
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-3 text-[12px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Planned R:R</span>
              <span className="tabular font-semibold text-slate-200">{plannedRR(form)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-slate-500">Risk per unit</span>
              <span className="tabular text-slate-300">
                {fmtMoney(Math.abs(Number(form.priceEntry) - Number(form.stopLoss || 0)))}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Plan & psychology */}
      <Card className="space-y-4">
        <h2 className="section-title">Plan &amp; psychology</h2>
        <Field label="Strategy">
          <input
            className="input"
            list="strategies"
            placeholder="e.g. VWAP Bounce"
            value={form.strategy}
            onChange={(e) => set({ strategy: e.target.value })}
          />
          <datalist id="strategies">
            {(settings.strategies || []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(settings.strategies || [])
              .filter((s) => s !== form.strategy)
              .slice(0, 8)
              .map((s) => (
                <Chip key={s} onClick={() => set({ strategy: s })}>
                  {s}
                </Chip>
              ))}
          </div>
        </Field>

        <Field label="Setup / trigger">
          <input
            className="input"
            list="setups"
            placeholder="e.g. 15m breakout with volume"
            value={form.setup}
            onChange={(e) => set({ setup: e.target.value })}
          />
          <datalist id="setups">
            {(settings.setups || []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>

        <Field label="Mistakes made">
          <TagInput
            values={form.mistakes || []}
            onChange={(v) => set({ mistakes: v })}
            suggestions={settings.mistakes || []}
            placeholder="mistake"
          />
        </Field>

        <Field label="How you felt">
          <TagInput
            values={form.emotions || []}
            onChange={(v) => set({ emotions: v })}
            suggestions={settings.emotions || []}
            placeholder="emotion"
          />
        </Field>

        <Field label="Tags">
          <TagInput values={form.tags || []} onChange={(v) => set({ tags: v })} suggestions={[]} placeholder="tag" />
        </Field>

        <Field label="Execution quality (1-5)">
          <Rating value={form.rating} onChange={(v) => set({ rating: v })} />
        </Field>

        <Field label="Notes — what happened, what you'll do differently">
          <textarea
            className="input min-h-[110px]"
            placeholder="Entry reason, what the market did, how you managed it, lesson learned…"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>
      </Card>

      {/* Screenshots */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Chart screenshots</h2>
          <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            <Camera size={15} /> Add
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickImages} />
        <div className="grid grid-cols-3 gap-2">
          {(form.images || []).map((src, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl border border-ink-700">
              <img src={src} alt={`chart ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
              <button
                onClick={() => set({ images: form.images.filter((_, j) => j !== i) })}
                className="absolute right-1 top-1 rounded-lg bg-black/70 p-1 text-white"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {(form.images || []).length === 0 && (
            <button
              onClick={() => fileRef.current?.click()}
              className="col-span-3 flex h-24 items-center justify-center gap-2 rounded-xl border border-dashed border-ink-700 text-[13px] text-slate-500"
            >
              <Camera size={16} /> Attach entry &amp; exit charts
            </button>
          )}
        </div>
      </Card>

      {/* Charges override */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">Charges</h2>
          <span className="text-[11px] text-slate-500">auto-calculated for Indian markets</span>
        </div>
        <Switch
          checked={!!form.chargesManual}
          onChange={(v) => set({ chargesManual: v ? 1 : 0, charges: v ? chargesBreakup.total : 0 })}
          label="Enter charges manually"
        />
        {form.chargesManual ? (
          <div className="mt-3">
            <Field label="Total charges (₹)">
              <input
                className="input tabular"
                type="number"
                step="0.01"
                value={form.charges}
                onChange={(e) => set({ charges: e.target.value })}
              />
            </Field>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[12px] sm:grid-cols-3">
            {Object.entries(chargesBreakup)
              .filter(([k]) => k !== 'total' && k !== 'turnover')
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="capitalize text-slate-500">{k.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="tabular text-slate-300">{fmtMoney(v)}</span>
                </div>
              ))}
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
          Rates: STT, exchange transaction, SEBI turnover, stamp duty and 18% GST with ₹
          {brokerage.flatPerOrder ?? 20} or {(brokerage.pct ?? 0.0003) * 100}% brokerage per order — change these in{' '}
          <Link to="/settings" className="text-brand-400">
            Settings
          </Link>
          .
        </p>
      </Card>

      {playbooks.length > 0 && (
        <Card pad={false}>
          <button
            onClick={() => setShowRules((v) => !v)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <span className="flex items-center gap-2 section-title">
              <ListChecks size={16} className="text-brand-400" /> Pre-trade checklist
            </span>
            <span className="text-[11px] text-slate-500">{showRules ? 'hide' : 'show'}</span>
          </button>
          {showRules && (
            <div className="space-y-3 border-t border-ink-700 p-4">
              {playbooks.map((p) => (
                <div key={p.id}>
                  <div className="text-[13px] font-semibold text-slate-200">{p.title}</div>
                  <ul className="mt-1 space-y-1">
                    {(p.rules || []).map((r, i) => (
                      <li key={i} className="flex gap-2 text-[12px] text-slate-400">
                        <span className="text-slate-600">{i + 1}.</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Confirm
        open={confirmDelete}
        title="Delete this trade?"
        body="This removes the trade from this device and your account on the next sync."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await softDelete('trades', id);
          scheduleSync(500);
          navigate('/trades');
        }}
      />
    </div>
  );
}

function plannedRR(form) {
  const e = Number(form.priceEntry);
  const sl = Number(form.stopLoss);
  const tg = Number(form.target);
  if (!e || !sl) return '—';
  const risk = Math.abs(e - sl);
  if (!tg || risk === 0) return '—';
  return `1 : ${(Math.abs(tg - e) / risk).toFixed(2)}`;
}

function fmtHolding(min) {
  if (min == null) return '—';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `${h}h ${m}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function compressImage(file, maxSide = 1280, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
