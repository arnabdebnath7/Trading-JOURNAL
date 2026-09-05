import Dexie from 'dexie';
import { newId, now } from '../../../shared/schema.js';

export const db = new Dexie('tradevault');

db.version(1).stores({
  trades:
    'id, user_id, entry_date, exit_date, symbol, strategy, status, outcome, _dirty, updated_at, deleted',
  journal_entries: 'id, user_id, date, mood, _dirty, updated_at, deleted',
  habits: 'id, user_id, name, _dirty, updated_at, deleted',
  playbooks: 'id, user_id, _dirty, updated_at, deleted',
  watchlist: 'id, user_id, symbol, _dirty, updated_at, deleted',
  goals: 'id, user_id, _dirty, updated_at, deleted',
  settings: 'id, user_id, _dirty, updated_at, deleted',
  meta: 'key'
});

export const TABLES = [
  'trades',
  'journal_entries',
  'habits',
  'playbooks',
  'watchlist',
  'goals',
  'settings'
];

export const table = (name) => db[name];

// ---------------- meta (local key/value) ----------------
export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key);
  return row ? row.value : fallback;
}
export async function setMeta(key, value) {
  await db.meta.put({ key, value });
  return value;
}

// ---------------- generic CRUD ----------------
export async function saveRow(t, row) {
  const t0 = table(t);
  const existing = row.id ? await t0.get(row.id) : null;
  const record = {
    ...(existing || {}),
    ...row,
    id: row.id || existing?.id || newId(),
    updated_at: now(),
    deleted: 0,
    _dirty: 1
  };
  await t0.put(record);
  return record;
}

export async function softDelete(t, id) {
  const t0 = table(t);
  const existing = await t0.get(id);
  if (!existing) return;
  await t0.put({ ...existing, deleted: 1, updated_at: now(), _dirty: 1 });
}

/** Query rows that are not deleted, newest-updated first. */
export async function live(t) {
  const rows = await table(t).toArray();
  return rows.filter((r) => !r.deleted);
}

// ---------------- defaults / seeding ----------------
const DEFAULT_HABITS = [
  { name: 'Exercise / Gym', icon: '💪', color: '#22c55e' },
  { name: 'Read 20 pages', icon: '📚', color: '#60a5fa' },
  { name: 'Meditation', icon: '🧘', color: '#a78bfa' },
  { name: 'Sleep before 11pm', icon: '😴', color: '#f59e0b' },
  { name: 'No revenge trading', icon: '🧊', color: '#ef4444' }
];

export async function seedIfEmpty() {
  const seeded = await getMeta('seeded', false);
  if (seeded) return;
  const ts = now();
  for (const [i, h] of DEFAULT_HABITS.entries()) {
    await db.habits.put({
      id: newId(),
      user_id: 'local',
      name: h.name,
      icon: h.icon,
      color: h.color,
      archived: 0,
      sort_order: i,
      updated_at: ts + i,
      deleted: 0,
      _dirty: 1
    });
  }
  await db.playbooks.put({
    id: newId(),
    user_id: 'local',
    title: 'My Core Setup',
    description: 'Write down exactly what a perfect A+ setup looks like for you.',
    rules: [
      'Only take trades that match my written setup',
      'Risk is fixed at 1% of capital per trade',
      'Stop loss is placed before entry, never moved against me',
      'No trading in the first 15 minutes unless it is a planned ORB',
      'Stop for the day after 2 consecutive losses'
    ],
    checklist: [],
    updated_at: ts + 100,
    deleted: 0,
    _dirty: 1
  });
  await setMeta('seeded', true);
}

export async function factoryReset() {
  await db.transaction('rw', db.trades, db.journal_entries, db.habits, db.playbooks, db.watchlist, db.goals, db.settings, db.meta, async () => {
    for (const t of TABLES) await table(t).clear();
    await db.meta.clear();
  });
}
