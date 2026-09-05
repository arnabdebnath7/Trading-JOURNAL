import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db.js';
import { enrich } from './metrics.js';
import { useMemo } from 'react';

export function useRows(table) {
  const rows = useLiveQuery(() => db[table].toArray(), [table], []);
  return useMemo(() => (rows || []).filter((r) => !r.deleted), [rows]);
}

export function useTrades() {
  const rows = useRows('trades');
  return useMemo(() => rows.map(enrich), [rows]);
}

export function useEntries() {
  const rows = useRows('journal_entries');
  return useMemo(() => [...rows].sort((a, b) => (a.date < b.date ? 1 : -1)), [rows]);
}

export function useHabits() {
  const rows = useRows('habits');
  return useMemo(() => rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)), [rows]);
}

export function usePlaybooks() {
  return useRows('playbooks');
}

export function useWatchlist() {
  return useRows('watchlist');
}

export function useGoals() {
  return useRows('goals');
}

export const todayKey = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const prettyDate = (iso, opts = {}) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: opts.year ? 'numeric' : undefined,
    ...(opts.time ? { hour: '2-digit', minute: '2-digit' } : {})
  });
};

export const MOODS = [
  { v: 0, label: '—', emoji: '⚪' },
  { v: 1, label: 'Rough', emoji: '😞' },
  { v: 2, label: 'Low', emoji: '🙁' },
  { v: 3, label: 'Okay', emoji: '😐' },
  { v: 4, label: 'Good', emoji: '🙂' },
  { v: 5, label: 'Great', emoji: '😄' }
];
