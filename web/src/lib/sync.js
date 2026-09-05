import { db, TABLES, table, getMeta, setMeta } from './db.js';
import { api, getToken } from './api.js';

let syncing = false;
let listeners = new Set();

export function onSync(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(state) {
  listeners.forEach((cb) => cb(state));
}

export async function lastSyncedAt() {
  return (await getMeta('lastPulledAt', 0)) || 0;
}

/**
 * Bidirectional sync:
 *  - push every locally-dirty row
 *  - pull everything the server changed since the last pull
 *  - last-write-wins on both sides
 */
export async function runSync({ silent = false } = {}) {
  const token = await getToken();
  if (!token) return { ok: false, reason: 'offline-mode' };
  if (syncing) return { ok: false, reason: 'in-progress' };
  syncing = true;
  emit({ status: 'syncing' });
  try {
    const since = Number(await getMeta('lastPulledAt', 0)) || 0;

    const changes = {};
    for (const t of TABLES) {
      const rows = await table(t).where('_dirty').equals(1).toArray();
      if (rows.length) changes[t] = rows.map(toWire);
    }

    const res = await api.sync({ since, changes });

    await db.transaction('rw', db.trades, db.journal_entries, db.habits, db.playbooks, db.watchlist, db.goals, db.settings, async () => {
      for (const t of TABLES) {
        const remoteRows = res.changes?.[t] || [];
        for (const remote of remoteRows) {
          const local = await table(t).get(remote.id);
          if (!local || Number(remote.updated_at) > Number(local.updated_at)) {
            await table(t).put({ ...remote, _dirty: 0 });
          } else if (local._dirty) {
            // local is newer or equal and still dirty -> will be pushed again
            await table(t).put({ ...local, _dirty: Number(local.updated_at) > Number(remote.updated_at) ? 1 : 0 });
          }
        }
      }
    });

    // rows the server echoed back with OUR timestamp were accepted -> no longer dirty
    const accepted = new Map();
    for (const t of TABLES) {
      for (const r of res.changes?.[t] || []) accepted.set(r.id, r.updated_at);
    }
    for (const t of TABLES) {
      const rows = await table(t).where('_dirty').equals(1).toArray();
      for (const row of rows) {
        if (accepted.get(row.id) === row.updated_at) {
          await table(t).update(row.id, { _dirty: 0 });
        }
      }
    }

    await setMeta('lastPulledAt', res.serverTime || Date.now());
    await setMeta('lastSyncError', null);
    emit({ status: 'idle', at: res.serverTime });
    return { ok: true, pushed: Object.values(changes).reduce((a, b) => a + b.length, 0) };
  } catch (e) {
    if (!silent) console.warn('sync failed', e);
    await setMeta('lastSyncError', e.message || 'Sync failed');
    emit({ status: 'error', error: e.message });
    return { ok: false, reason: e.message };
  } finally {
    syncing = false;
  }
}

function toWire(row) {
  const { _dirty, ...rest } = row;
  return rest;
}

let timer = null;
export function scheduleSync(delay = 2000) {
  clearTimeout(timer);
  timer = setTimeout(() => runSync().catch(() => {}), delay);
}

export function startAutoSync(intervalMs = 30000) {
  const tick = () => {
    if (document.visibilityState === 'visible') runSync().catch(() => {});
  };
  const id = setInterval(tick, intervalMs);
  window.addEventListener('visibilitychange', tick);
  window.addEventListener('online', tick);
  tick();
  return () => {
    clearInterval(id);
    window.removeEventListener('visibilitychange', tick);
    window.removeEventListener('online', tick);
  };
}
