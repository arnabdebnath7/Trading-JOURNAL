// Table + column definitions shared by server (SQLite) and client (Dexie).
// Any change here must be mirrored in BOTH stores.

// name -> { columns: sqlite DDL fragment, jsonFields: [], pk }
export const TABLES = {
  trades: {
    jsonFields: ['mistakes', 'emotions', 'images', 'tags', 'chargesBreakup'],
    ddl: `
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT,
      instrument TEXT DEFAULT 'EQUITY_INTRADAY',
      direction TEXT DEFAULT 'LONG',
      segment TEXT DEFAULT 'INTRADAY',
      entry_date TEXT,
      exit_date TEXT,
      qty REAL DEFAULT 0,
      multiplier REAL DEFAULT 1,
      price_entry REAL DEFAULT 0,
      price_exit REAL DEFAULT 0,
      stop_loss REAL DEFAULT 0,
      target REAL DEFAULT 0,
      strategy TEXT,
      setup TEXT,
      mistakes TEXT DEFAULT '[]',
      emotions TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      notes TEXT,
      rating INTEGER DEFAULT 0,
      charges REAL DEFAULT 0,
      charges_breakup TEXT DEFAULT '{}',
      charges_manual INTEGER DEFAULT 0,
      images TEXT DEFAULT '[]',
      status TEXT DEFAULT 'OPEN',
      risk_amount_override REAL DEFAULT 0,
      account_size REAL DEFAULT 0,
      gross_pnl REAL DEFAULT 0,
      net_pnl REAL DEFAULT 0,
      r_multiple REAL,
      holding_minutes REAL,
      outcome TEXT DEFAULT 'OPEN',
      updated_at INTEGER NOT NULL,
      deleted INTEGER DEFAULT 0
    `
  },
  journal_entries: {
    jsonFields: ['gratitude', 'habits', 'tags'],
    ddl: `
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      mood INTEGER DEFAULT 0,
      energy INTEGER DEFAULT 0,
      stress INTEGER DEFAULT 0,
      sleep_hours REAL DEFAULT 0,
      water_glasses REAL DEFAULT 0,
      exercise_min REAL DEFAULT 0,
      screen_hours REAL DEFAULT 0,
      gratitude TEXT DEFAULT '[]',
      habits TEXT DEFAULT '{}',
      tags TEXT DEFAULT '[]',
      highlights TEXT,
      notes TEXT,
      rating INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      deleted INTEGER DEFAULT 0
    `
  },
  habits: {
    jsonFields: [],
    ddl: `
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      icon TEXT DEFAULT '✅',
      color TEXT DEFAULT '#22c55e',
      archived INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      deleted INTEGER DEFAULT 0
    `
  },
  playbooks: {
    jsonFields: ['rules'],
    ddl: `
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      description TEXT,
      rules TEXT DEFAULT '[]',
      checklist TEXT DEFAULT '[]',
      updated_at INTEGER NOT NULL,
      deleted INTEGER DEFAULT 0
    `
  },
  watchlist: {
    jsonFields: ['tags'],
    ddl: `
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT,
      name TEXT,
      exchange TEXT DEFAULT 'NSE',
      notes TEXT,
      target REAL DEFAULT 0,
      stop_loss REAL DEFAULT 0,
      tags TEXT DEFAULT '[]',
      updated_at INTEGER NOT NULL,
      deleted INTEGER DEFAULT 0
    `
  },
  goals: {
    jsonFields: [],
    ddl: `
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      type TEXT DEFAULT 'custom',
      target_value REAL DEFAULT 0,
      period TEXT DEFAULT 'monthly',
      note TEXT,
      updated_at INTEGER NOT NULL,
      deleted INTEGER DEFAULT 0
    `
  },
  settings: {
    jsonFields: [],
    ddl: `
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      value TEXT DEFAULT '{}',
      updated_at INTEGER NOT NULL,
      deleted INTEGER DEFAULT 0
    `
  }
};

export const TABLE_NAMES = Object.keys(TABLES);

// camelCase (client) <-> snake_case (server) column mapping
const CAMEL = {
  trades: {
    entryDate: 'entry_date', exitDate: 'exit_date', stopLoss: 'stop_loss',
    priceEntry: 'price_entry', priceExit: 'price_exit', chargesBreakup: 'charges_breakup',
    chargesManual: 'charges_manual', riskAmountOverride: 'risk_amount_override',
    accountSize: 'account_size', grossPnl: 'gross_pnl', netPnl: 'net_pnl',
    rMultiple: 'r_multiple', holdingMinutes: 'holding_minutes'
  },
  journal_entries: {
    sleepHours: 'sleep_hours', waterGlasses: 'water_glasses',
    exerciseMin: 'exercise_min', screenHours: 'screen_hours'
  },
  habits: { sortOrder: 'sort_order' },
  watchlist: { stopLoss: 'stop_loss' },
  playbooks: {},
  goals: { targetValue: 'target_value' },
  settings: {}
};

const invert = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const SNAKE = Object.fromEntries(Object.entries(CAMEL).map(([t, m]) => [t, invert(m)]));

/** client row -> server row */
export function toServer(table, row) {
  const map = CAMEL[table] || {};
  const jsonFields = TABLES[table].jsonFields || [];
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const col = map[k] || k;
    if (jsonFields.includes(k)) out[col] = typeof v === 'string' ? v : JSON.stringify(v ?? (k === 'habits' ? {} : []));
    else out[col] = v;
  }
  return out;
}

/** server row -> client row */
export function toClient(table, row) {
  const map = SNAKE[table] || {};
  const jsonFields = new Set(TABLES[table].jsonFields || []);
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = map[k] || k;
    if (jsonFields.has(key)) {
      if (typeof v === 'string') {
        try { out[key] = JSON.parse(v); } catch { out[key] = key === 'habits' ? {} : []; }
      } else out[key] = v ?? (key === 'habits' ? {} : []);
    } else out[key] = v;
  }
  return out;
}

export const newId = () =>
  (globalThis.crypto?.randomUUID?.() ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }));

export const now = () => Date.now();
