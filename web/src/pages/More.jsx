import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui.jsx';
import { MORE } from '../components/Layout.jsx';
import { ChevronRight } from 'lucide-react';

export default function More() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">More</h1>
        <p className="text-[13px] text-slate-500">Everything else in your journal.</p>
      </div>
      <Card pad={false}>
        {MORE.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="flex items-center gap-3 border-b border-ink-800 px-4 py-3.5 last:border-0 active:bg-ink-800/60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-800 text-brand-400">
              <m.icon size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-slate-100">{m.label}</span>
              <span className="block truncate text-[12px] text-slate-500">{m.desc}</span>
            </span>
            <ChevronRight size={16} className="text-slate-600" />
          </Link>
        ))}
      </Card>
    </div>
  );
}
