import express from 'express';
import db from '../db.js';
import { TABLES, TABLE_NAMES, toServer, toClient } from '../../../shared/schema.js';
import { withDerived, computeCharges, DEFAULT_BROKERAGE } from '../../../shared/tradeMath.js';

const router = express.Router();

// column names per table, parsed from the DDL so it can never drift
const COLUMNS = Object.fromEntries(
  Object.entries(TABLES).map(([t, def]) => [
    t,
    def.ddl
      .split(',')
      .map((l) => l.trim().split(/\s+/)[0])
      .filter(Boolean)
  ])
);

function brokerageFor(userId) {
  const row = db.prepare('SELECT value FROM settings WHERE id = ?').get(userId + ':brokerage');
  try {
    return { ...DEFAULT_BROKERAGE, ...(row ? JSON.parse(row.value) : {}) };
  } catch {
    return { ...DEFAULT_BROKERAGE };
  }
}

function prepareRow(table, clientRow, userId) {
  const row = toServer(table, clientRow);
  row.user_id = userId;
  row.updated_at = Number(row.updated_at) || Date.now();
  row.deleted = row.deleted ? 1 : 0;
  const allowed = new Set(COLUMNS[table]);
  const clean = {};
  for (const [k, v] of Object.entries(row)) {
    if (!allowed.has(k)) continue;
    clean[k] = v;
  }
  if (table === 'trades' && !clean.charges_manual) {
    const d = withDerived(
      {
        instrument: clean.instrument,
        qty: clean.qty,
        multiplier: clean.multiplier ?? 1,
        priceEntry: clean.price_entry,
        priceExit: clean.price_exit,
        direction: clean.direction,
        status: clean.status,
        stopLoss: clean.stop_loss,
        entryDate: clean.entry_date,
        exitDate: clean.exit_date,
        riskAmountOverride: clean.risk_amount_override,
        charges: clean.charges
      },
      brokerageFor(userId)
    );
    const br = computeCharges(
      {
        instrument: clean.instrument,
        qty: clean.qty,
        multiplier: clean.multiplier ?? 1,
        priceEntry: clean.price_entry,
        priceExit: clean.price_exit
      },
      brokerageFor(userId)
    );
    clean.charges = d.charges;
    clean.charges_breakup = JSON.stringify(br);
    clean.gross_pnl = d.grossPnl;
    clean.net_pnl = d.netPnl;
    clean.r_multiple = d.rMultiple;
    clean.holding_minutes = d.holdingMinutes;
    clean.outcome = d.outcome;
  }
  return clean;
}

function upsert(table, clean) {
  const existing = db.prepare(`SELECT user_id, updated_at FROM ${table} WHERE id = ?`).get(clean.id);
  if (existing) {
    if (existing.user_id !== clean.user_id) return 'forbidden';
    if (Number(clean.updated_at) <= Number(existing.updated_at)) return 'stale';
    const sets = Object.keys(clean)
      .filter((k) => k !== 'id')
      .map((k) => `${k} = @${k}`)
      .join(', ');
    db.prepare(`UPDATE ${table} SET ${sets} WHERE id = @id`).run(clean);
    return 'updated';
  }
  const cols = Object.keys(clean);
  db.prepare(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')})`
  ).run(clean);
  return 'inserted';
}

/**
 * One-shot bidirectional sync.
 * POST /api/sync  { since, changes: { trades: [...], journal_entries: [...] } }
 * -> { serverTime, changes: { trades: [...], ... } }
 */
router.post('/sync', (req, res) => {
  const userId = req.user.id;
  const since = Number(req.body?.since) || 0;
  const incoming = req.body?.changes || {};
  const result = { inserted: 0, updated: 0, stale: 0, forbidden: 0 };

  const run = db.transaction(() => {
    for (const table of TABLE_NAMES) {
      const rows = incoming[table];
      if (!Array.isArray(rows)) continue;
      for (const raw of rows) {
        if (!raw || !raw.id) continue;
        const clean = prepareRow(table, raw, userId);
        const r = upsert(table, clean);
        result[r] = (result[r] || 0) + 1;
      }
    }
  });
  run();

  const changes = {};
  for (const table of TABLE_NAMES) {
    const rows = db
      .prepare(`SELECT * FROM ${table} WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC`)
      .all(userId, since);
    changes[table] = rows.map((r) => toClient(table, r));
  }

  res.json({ serverTime: Date.now(), changes, result });
});

/** Full account export */
router.get('/export', (req, res) => {
  const out = {};
  for (const table of TABLE_NAMES) {
    out[table] = db
      .prepare(`SELECT * FROM ${table} WHERE user_id = ?`)
      .all(req.user.id)
      .map((r) => toClient(table, r));
  }
  res.json({ exportedAt: Date.now(), user: req.user, data: out });
});

/** Replace everything (used by "restore backup") */
router.post('/import', (req, res) => {
  const data = req.body?.data || {};
  const run = db.transaction(() => {
    for (const table of TABLE_NAMES) {
      const rows = data[table];
      if (!Array.isArray(rows)) continue;
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(req.user.id);
      for (const raw of rows) {
        if (!raw || !raw.id) continue;
        const clean = prepareRow(table, raw, req.user.id);
        const cols = Object.keys(clean);
        db.prepare(
          `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols
            .map((c) => '@' + c)
            .join(', ')})`
        ).run(clean);
      }
    }
  });
  run();
  res.json({ ok: true });
});

/** Permanently wipe all data for this account */
router.delete('/data', (req, res) => {
  const run = db.transaction(() => {
    for (const table of TABLE_NAMES) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(req.user.id);
    }
  });
  run();
  res.json({ ok: true });
});

export default router;
