import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';

const axis = { stroke: '#475569', fontSize: 11 };
const grid = '#1a2432';

export function ChartTip({ active, payload, label, unit = '₹' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900/95 px-2.5 py-1.5 text-xs shadow-lg">
      <div className="mb-0.5 font-semibold text-slate-300">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-slate-400">{p.name}</span>
          <span className="tabular font-semibold text-slate-100">
            {typeof p.value === 'number'
              ? `${p.value < 0 ? '-' : ''}${unit}${Math.abs(p.value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EquityChart({ data, height = 220 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 6, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="label" stroke={axis.stroke} fontSize={axis.fontSize} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis stroke={axis.stroke} fontSize={axis.fontSize} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => `₹${Math.round(v).toLocaleString('en-IN')}`} />
          <Tooltip content={<ChartTip />} />
          <ReferenceLine y={0} stroke="#334155" />
          <Area type="monotone" dataKey="equity" name="Equity" stroke="#60a5fa" strokeWidth={2} fill="url(#eqFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PnlBars({ data, dataKey = 'net', labelKey = 'label', height = 200, horizontal = false }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {horizontal ? (
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 10, bottom: 0 }}>
            <CartesianGrid stroke={grid} horizontal={false} />
            <XAxis type="number" stroke={axis.stroke} fontSize={axis.fontSize} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${Math.round(v)}`} />
            <YAxis type="category" dataKey={labelKey} stroke={axis.stroke} fontSize={axis.fontSize} tickLine={false} axisLine={false} width={78} />
            <Tooltip content={<ChartTip />} cursor={{ fill: '#ffffff08' }} />
            <Bar dataKey={dataKey} name="P&L" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d[dataKey] >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <BarChart data={data} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey={labelKey} stroke={axis.stroke} fontSize={axis.fontSize} tickLine={false} axisLine={false} />
            <YAxis stroke={axis.stroke} fontSize={axis.fontSize} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => `₹${Math.round(v)}`} />
            <Tooltip content={<ChartTip />} cursor={{ fill: '#ffffff08' }} />
            <Bar dataKey={dataKey} name="P&L" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d[dataKey] >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, height = 180, centerLabel }) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTip unit="" />} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-slate-100">{centerLabel.value}</span>
          <span className="text-[11px] text-slate-500">{centerLabel.label}</span>
        </div>
      )}
    </div>
  );
}

export function LineSeries({ data, dataKey = 'value', labelKey = 'label', height = 180, color = '#a78bfa', name = 'Value' }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey={labelKey} stroke={axis.stroke} fontSize={axis.fontSize} tickLine={false} axisLine={false} />
          <YAxis stroke={axis.stroke} fontSize={axis.fontSize} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<ChartTip unit="" />} />
          <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarHeatmap({ data, month, year, onSelect, selected }) {
  const byDate = new Map(data.map((d) => [d.date, d]));
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(iso);
  }
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.net)));
  const colorFor = (net) => {
    if (!net) return 'bg-ink-800';
    const t = Math.min(1, Math.abs(net) / maxAbs);
    return net > 0
      ? `rgba(34,197,94,${0.18 + t * 0.72})`
      : `rgba(239,68,68,${0.18 + t * 0.72})`;
  };
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500">
        {WEEK.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`p${i}`} />;
          const d = byDate.get(iso);
          const isSel = selected === iso;
          return (
            <button
              key={iso}
              onClick={() => onSelect?.(iso)}
              style={{ background: d ? colorFor(d.net) : undefined }}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] font-semibold transition ${
                d ? 'text-white' : 'bg-ink-800 text-slate-500 hover:bg-ink-700'
              } ${isSel ? 'ring-2 ring-brand-400' : ''}`}
              title={d ? `${iso}: ₹${d.net.toFixed(0)} (${d.trades} trades)` : iso}
            >
              <span>{Number(iso.slice(-2))}</span>
              {d && d.net !== 0 && (
                <span className="text-[9px] leading-none opacity-90">
                  {Math.abs(d.net) >= 1000 ? `${(d.net / 1000).toFixed(1)}k` : Math.round(d.net)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { MONTHS };
