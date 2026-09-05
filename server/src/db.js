import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLES } from '../../shared/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dataDir, 'tradevault.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    capital REAL DEFAULT 100000,
    created_at INTEGER NOT NULL
  );
`);

for (const [name, def] of Object.entries(TABLES)) {
  db.exec(`CREATE TABLE IF NOT EXISTS ${name} (${def.ddl});`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_${name}_user ON ${name}(user_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_${name}_upd ON ${name}(updated_at);`);
}

// ---- lightweight migrations (add columns missing from older DBs) ----
function ensureColumn(table, col, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${decl};`);
  }
}
try {
  ensureColumn('trades', 'charges_manual', 'charges_manual INTEGER DEFAULT 0');
  ensureColumn('trades', 'risk_amount_override', 'risk_amount_override REAL DEFAULT 0');
  ensureColumn('trades', 'account_size', 'account_size REAL DEFAULT 0');
  ensureColumn('trades', 'segment', "segment TEXT DEFAULT 'INTRADAY'");
  ensureColumn('trades', 'multiplier', 'multiplier REAL DEFAULT 1');
  ensureColumn('journal_entries', 'stress', 'stress INTEGER DEFAULT 0');
  ensureColumn('journal_entries', 'screen_hours', 'screen_hours REAL DEFAULT 0');
} catch (e) {
  console.warn('migration warning:', e.message);
}

export default db;
