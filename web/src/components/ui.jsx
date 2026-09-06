import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, ChevronDown, AlertTriangle, Loader2 } from 'lucide-react';

export function Card({ children, className = '', pad = true, ...rest }) {
  return (
    <div className={`card ${pad ? 'card-pad' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right, className = '' }) {
  return (
    <div className={`mb-3 flex items-center justify-between gap-2 ${className}`}>
      <h2 className="section-title">{children}</h2>
      {right}
    </div>
  );
}

export function Stat({ label, value, sub, tone = 'default', className = '', spark, sparkTone }) {
  const toneClass =
    tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : tone === 'brand' ? 'text-brand-400' : 'text-slate-100';
  return (
    <div className={`card p-3 transition hover:border-ink-600 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="stat-label truncate">{label}</div>
        {spark && (
          <div className="shrink-0 opacity-80">
            <Sparkline data={spark} tone={sparkTone || (tone === 'loss' ? 'loss' : 'profit')} />
          </div>
        )}
      </div>
      <div className={`mt-1 truncate text-lg font-bold tabular ${toneClass}`}>{value}</div>
      {sub != null && <div className="mt-0.5 truncate text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

/** Lightweight inline SVG sparkline (no chart lib) for KPI cards. */
export function Sparkline({ data = [], width = 88, height = 28, tone = 'profit' }) {
  const pts = (data || []).filter((v) => Number.isFinite(v));
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const zero = min < 0 && max > 0 ? height - 2 - (0 - min) / span * (height - 4) : null;
  const path = pts
    .map((v, i) => {
      const x = 1 + (i / (pts.length - 1)) * (width - 2);
      const y = height - 2 - ((v - min) / span) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const color = tone === 'loss' ? '#ef4444' : tone === 'brand' ? '#60a5fa' : tone === 'gold' ? '#fbbf24' : '#22c55e';
  return (
    <svg width={width} height={height} className="block">
      {zero != null && (
        <line x1={1} y1={zero} x2={width - 1} y2={zero} stroke="#334155" strokeWidth={0.8} strokeDasharray="3 3" />
      )}
      <polyline points={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Gradient progress ring — used for discipline score & goal gauges. */
export function Ring({ value, max = 100, size = 96, stroke = 9, label, sub, tone = 'gold' }) {
  const id = React.useId ? React.useId() : 'ring-grad';
  const pct = Math.max(0, Math.min(1, (Number(value) || 0) / max));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const palette = {
    gold: ['#fbbf24', '#f59e0b'],
    profit: ['#34d399', '#22c55e'],
    brand: ['#60a5fa', '#2563eb'],
    loss: ['#f87171', '#ef4444']
  };
  const [c1, c2] = palette[tone] || palette.gold;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a2432" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black leading-none text-slate-100">{label ?? (value ?? '—')}</span>
        {sub && <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">{sub}</span>}
      </div>
    </div>
  );
}

/** Consistent page title block with icon chip + actions. */
export function PageHeader({ title, sub, icon: Icon, actions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-ink-700 bg-gradient-to-br from-ink-800 to-ink-900 text-brand-400 shadow-card">
            <Icon size={19} />
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">{title}</h1>
          {sub && <p className="text-[13px] text-slate-500">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-ink-700/50 ${className}`} />;
}

// ---------------- toasts ----------------
const toastListeners = new Set();
export const toast = {
  push(msg, tone = 'info') {
    const item = { id: Math.random().toString(36).slice(2), msg: String(msg), tone };
    toastListeners.forEach((l) => l(item));
  },
  success(msg) {
    this.push(msg, 'success');
  },
  error(msg) {
    this.push(msg, 'error');
  }
};

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const on = (t) => {
      setItems((x) => [...x.slice(-2), t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 3600);
    };
    toastListeners.add(on);
    return () => toastListeners.delete(on);
  }, []);
  if (!items.length) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          className={`animate-in pointer-events-auto flex max-w-md items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold shadow-2xl backdrop-blur ${
            t.tone === 'success'
              ? 'border-profit/40 bg-profit/15 text-profit'
              : t.tone === 'error'
              ? 'border-loss/40 bg-loss/15 text-loss'
              : 'border-ink-600 bg-ink-800/95 text-slate-200'
          }`}
        >
          {t.tone === 'success' ? <Check size={14} /> : t.tone === 'error' ? <AlertTriangle size={14} /> : null}
          <span className="truncate">{t.msg}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}

export function Chip({ active, onClick, children, className = '' }) {
  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`chip ${active ? 'chip-active' : ''} ${onClick ? 'transition active:scale-95' : ''} ${className}`}
    >
      {children}
    </Comp>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-1"
    >
      <span className="text-sm text-slate-200">{label}</span>
      <span className="switch" data-on={!!checked} />
    </button>
  );
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex rounded-xl border border-ink-700 bg-ink-900 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
            value === o.value ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md', full = false }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open || !mounted) return null;
  const width = full ? 'sm:max-w-3xl' : size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-xl' : 'sm:max-w-md';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${width} animate-in max-h-[92vh] overflow-y-auto rounded-t-3xl border border-ink-700 bg-ink-850 sm:rounded-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700 bg-ink-850/95 px-4 py-3 backdrop-blur">
          <h3 className="text-[15px] font-bold text-slate-100">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-ink-700 hover:text-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="sticky bottom-0 border-t border-ink-700 bg-ink-850/95 px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-700 px-6 py-12 text-center">
      {Icon && (
        <div className="mb-3 rounded-2xl bg-ink-800 p-3 text-slate-400">
          <Icon size={24} />
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-[13px] text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Confirm({ open, title = 'Are you sure?', body, confirmText = 'Delete', onConfirm, onCancel, danger = true }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={danger ? 'btn-danger flex-1' : 'btn-primary flex-1'}
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-400">{body}</p>
    </Modal>
  );
}

export function ProgressBar({ value, max = 100, tone = 'brand' }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const bg = tone === 'profit' ? 'bg-profit' : tone === 'loss' ? 'bg-loss' : 'bg-brand-500';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700">
      <div className={`h-full rounded-full ${bg} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Select({ options, value, onChange, placeholder, className = '', ...rest }) {
  return (
    <div className="relative">
      <select
        className={`select ${className}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export function Money({ value, compact = false, className = '' }) {
  const v = Number(value) || 0;
  const sign = v > 0 ? '+' : '';
  return (
    <span className={`tabular ${v > 0 ? 'text-profit' : v < 0 ? 'text-loss' : 'text-slate-300'} ${className}`}>
      {sign}
      {compact ? fmtC(v) : fmtM(v)}
    </span>
  );
}

const fmtM = (v) =>
  `${v < 0 ? '-' : ''}₹${Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
const fmtC = (v) => {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)}K`;
  return `${s}₹${a.toFixed(0)}`;
};

export function Spinner({ size = 18, className = '' }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

export function TagInput({ values = [], onChange, suggestions = [], placeholder = 'Add and press Enter' }) {
  const [text, setText] = useState('');
  const add = (v) => {
    const clean = String(v).trim();
    if (!clean || values.includes(clean)) return;
    onChange([...values, clean]);
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="chip chip-active">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="ml-0.5 text-slate-400 hover:text-loss"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        className="input mt-2"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(text);
            setText('');
          } else if (e.key === 'Backspace' && !text && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        list={`sugg-${placeholder}`}
      />
      {suggestions.length > 0 && (
        <datalist id={`sugg-${placeholder}`}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions
            .filter((s) => !values.includes(s))
            .slice(0, 10)
            .map((s) => (
              <Chip key={s} onClick={() => add(s)}>
                + {s}
              </Chip>
            ))}
        </div>
      )}
    </div>
  );
}

export function Rating({ value, onChange, count = 5, labels }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(value === n ? 0 : n)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition ${
            value >= n
              ? 'border-brand-500 bg-brand-600/20 text-brand-400'
              : 'border-ink-700 bg-ink-900 text-slate-500'
          }`}
          title={labels?.[n - 1]}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
