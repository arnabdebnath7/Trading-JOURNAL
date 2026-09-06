/**
 * CSV import engine — parse pasted/downloaded CSVs and map them to TradeVault trades.
 *
 * Handles:
 *  - quoted cells, commas & newlines inside quotes, \r\n
 *  - Indian number formats (₹1,234.50, (123.00) negatives)
 *  - dates: 2024-06-14, 14-06-2024, 14/06/2024, 14-Jun-2024, ISO datetimes
 *  - separate date + time columns, 9:20 AM style times
 *  - smart header synonym mapping (TradeVault export, generic, Zerodha-style)
 */

// ---------------- parser ----------------

export function parseCsv(text) {
  const src = String(text || '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (c !== '\r') {
      cell += c;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((s) => String(s).trim())).filter((r) => r.some((c) => c !== ''));
}

// ---------------- value coercion ----------------

export function parseNumber(v) {
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (/^-/.test(s)) {
    neg = true;
    s = s.replace(/^-/, '');
  }
  s = s.replace(/[₹$,\s]/g, '');
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

const MONTH_NAMES = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
};

/** Returns { y, m, d, hh, mm } or null. */
export function parseDateParts(str) {
  const s = String(str || '').trim();
  if (!s) return null;

  // ISO: 2024-06-14 / 2024-06-14T09:15 / 2024-06-14 09:15:20
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ,]+(\d{1,2}):(\d{2}))?/);
  if (m) return mk(+m[1], +m[2], +m[3], m[4] ? +m[4] : null, m[5] ? +m[5] : null);

  // 14-Jun-2024 / 14 June 2024 (+ optional time)
  m = s.match(/^(\d{1,2})[ \-\/]([A-Za-z]{3,9})[ \-\/](\d{2,4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const mo = MONTH_NAMES[m[2].slice(0, 4).toLowerCase()] ?? MONTH_NAMES[m[2].slice(0, 3).toLowerCase()];
    if (mo != null) return mk(fixYear(+m[3]), mo + 1, +m[1], m[4] ? +m[4] : null, m[5] ? +m[5] : null);
  }

  // Jun 14, 2024
  m = s.match(/^([A-Za-z]{3,9})[ \-\/](\d{1,2}),?\s*(\d{2,4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const mo = MONTH_NAMES[m[1].slice(0, 4).toLowerCase()] ?? MONTH_NAMES[m[1].slice(0, 3).toLowerCase()];
    if (mo != null) return mk(fixYear(+m[3]), mo + 1, +m[2], m[4] ? +m[4] : null, m[5] ? +m[5] : null);
  }

  // numeric slash/dash: dd/mm/yyyy (Indian default) unless clearly mm/dd
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    if (a > 12 && b <= 12) {
      // dd/mm
    } else if (b > 12 && a <= 12) {
      [a, b] = [b, a]; // mm/dd -> normalize to dd/mm
    }
    return mk(fixYear(+m[3]), b, a, m[4] ? +m[4] : null, m[5] ? +m[5] : null);
  }

  // time only
  m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return { y: null, m: null, d: null, hh: +m[1], mm: +m[2] };
  return null;
}

const mk = (y, m, d, hh, mm) => ({ y, m, d, hh: hh ?? null, mm: mm ?? null });
const fixYear = (y) => (y < 100 ? 2000 + y : y);

/** "9:20", "09:20:00", "9:20 AM", "13:40 pm" -> { hh, mm } */
export function parseTimeParts(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  if (!m) return null;
  let hh = +m[1];
  const mm = +m[2];
  const ap = (m[4] || '').toLowerCase();
  if (ap === 'pm' && hh < 12) hh += 12;
  if (ap === 'am' && hh === 12) hh = 0;
  return { hh, mm };
}

const pad = (n) => String(n).padStart(2, '0');

/** Build the datetime-local string ("YYYY-MM-DDTHH:mm") used by TradeVault rows. */
export function toLocalIso(dateStr, timeStr, { fallbackDate = null, fallbackTime = '09:15' } = {}) {
  const dp = parseDateParts(dateStr);
  const tp = parseTimeParts(timeStr);
  const fb = fallbackDate ? parseDateParts(fallbackDate) : null;
  const y = dp?.y ?? fb?.y;
  const mo = dp?.m ?? fb?.m;
  const d = dp?.d ?? fb?.d;
  const hh = tp?.hh ?? dp?.hh;
  const mm = tp?.mm ?? dp?.mm;
  if (y == null || mo == null || d == null) return null;
  const time = `${pad(hh ?? Number(fallbackTime.slice(0, 2)))}:${pad(mm ?? Number(fallbackTime.slice(3, 5)))}`;
  return `${y}-${pad(mo)}-${pad(d)}T${time}`;
}

// ---------------- column mapping ----------------

export const IMPORT_FIELDS = [
  { value: 'ignore', label: '— ignore —' },
  { value: 'symbol', label: 'Symbol' },
  { value: 'direction', label: 'Direction (buy/sell)' },
  { value: 'instrument', label: 'Instrument type' },
  { value: 'entryDate', label: 'Entry date' },
  { value: 'entryTime', label: 'Entry time' },
  { value: 'exitDate', label: 'Exit date' },
  { value: 'exitTime', label: 'Exit time' },
  { value: 'qty', label: 'Quantity' },
  { value: 'multiplier', label: 'Multiplier / lot size' },
  { value: 'priceEntry', label: 'Entry price' },
  { value: 'priceExit', label: 'Exit price' },
  { value: 'stopLoss', label: 'Stop loss' },
  { value: 'target', label: 'Target' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'setup', label: 'Setup' },
  { value: 'rating', label: 'Setup grade (1-5)' },
  { value: 'mistakes', label: 'Mistakes ( | separated)' },
  { value: 'emotions', label: 'Emotions ( | separated)' },
  { value: 'notes', label: 'Notes' }
];

const SYNONYMS = [
  ['symbol', ['symbol', 'stock', 'scrip', 'tradingsymbol', 'tradesymbol', 'ticker', 'instrumentname', 'underlying']],
  ['direction', ['direction', 'side', 'buysell', 'buysellflag', 'tradetype', 'position', 'longshort', 'transactiontype']],
  ['instrument', ['instrumenttype', 'producttype', 'segmenttype', 'instrument', 'segment', 'product', 'asset']],
  ['entryDate', ['entrydate', 'date', 'tradedate', 'buydate', 'opendate', 'datetime', 'signaldatetime']],
  ['entryTime', ['entrytime', 'buytime', 'starttime']],
  ['exitDate', ['exitdate', 'selldate', 'closedate', 'squareoffdate']],
  ['exitTime', ['exittime', 'selltime', 'endtime']],
  ['qty', ['qty', 'quantity', 'shares', 'tradedqty', 'lotqty']],
  ['multiplier', ['multiplier', 'lotsize']],
  ['priceEntry', ['entryprice', 'entry', 'buyprice', 'buyavg', 'buyaverage', 'averagebuy', 'buyavgprice', 'entryavgprice', 'openprice']],
  ['priceExit', ['exitprice', 'exit', 'sellprice', 'sellavg', 'sellaverage', 'averagesell', 'sellavgprice', 'exitavgprice', 'closeprice']],
  ['stopLoss', ['stoploss', 'stop', 'sl', 'initialstop']],
  ['target', ['target', 'tgt', 'tp']],
  ['strategy', ['strategy', 'setupname', 'playbook']],
  ['setup', ['setup', 'pattern']],
  ['rating', ['rating', 'grade', 'score', 'stars']],
  ['mistakes', ['mistakes', 'mistake', 'errors']],
  ['emotions', ['emotions', 'emotion', 'feeling']],
  ['notes', ['notes', 'note', 'remarks', 'comment', 'comments', 'reason']]
];

const norm = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Guess a column -> field mapping from the header row. */
export function guessMapping(header = []) {
  const map = {};
  const used = new Set();
  header.forEach((h, i) => {
    const n = norm(h);
    if (!n) {
      map[i] = 'ignore';
      return;
    }
    // exact synonym hit first
    for (const [field, syns] of SYNONYMS) {
      if (used.has(field)) continue;
      if (syns.includes(n)) {
        map[i] = field;
        used.add(field);
        return;
      }
    }
    // contains-style fallback
    for (const [field, syns] of SYNONYMS) {
      if (used.has(field)) continue;
      if (syns.some((s) => n.includes(s) && s.length > 3)) {
        map[i] = field;
        used.add(field);
        return;
      }
    }
    map[i] = 'ignore';
  });
  return map;
}

// ---------------- row -> trade ----------------

export function inferInstrument(symbol, explicit) {
  const e = String(explicit || '').toUpperCase();
  if (e.includes('DELIV')) return 'EQUITY_DELIVERY';
  if (e.includes('OPT') || e.includes('OPTION')) return 'OPT';
  if (e.includes('FUT')) return 'FUT';
  if (e.includes('COMM') || e.includes('MCX')) return 'COMMODITY';
  if (e) return 'EQUITY_INTRADAY';
  const s = String(symbol || '').toUpperCase();
  if (/\b(CE|PE)\b/.test(s) || /\s(CALL|PUT)\s/i.test(s)) return 'OPT';
  if (/FUT/.test(s)) return 'FUT';
  return 'EQUITY_INTRADAY';
}

export function normalizeDirection(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return 'LONG';
  if (s.startsWith('s') || s.includes('short')) return 'SHORT';
  return 'LONG';
}

const listVal = (v) =>
  String(v || '')
    .split(/[|;]/)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Convert mapped raw cells into a TradeVault trade row.
 * Returns { row } or { error } — caller decides to skip or keep.
 */
export function rowToTrade(cells, mapping, header = []) {
  const get = {};
  Object.entries(mapping).forEach(([i, f]) => {
    if (f && f !== 'ignore') get[f] = cells[i];
  });

  const symbol = String(get.symbol || '').trim().toUpperCase();
  if (!symbol) return { error: 'missing symbol' };
  const priceEntry = parseNumber(get.priceEntry);
  if (!priceEntry) return { error: 'missing entry price' };
  const qty = parseNumber(get.qty);
  if (!qty) return { error: 'missing quantity' };

  const priceExit = parseNumber(get.priceExit);
  const closed = priceExit > 0;

  const entryDate = toLocalIso(get.entryDate, get.entryTime || '', { fallbackTime: '09:15' });
  if (!entryDate) return { error: 'missing/unknown date' };
  const exitDate = closed
    ? toLocalIso(get.exitDate || get.entryDate, get.exitTime || '', { fallbackDate: get.entryDate, fallbackTime: '15:20' })
    : '';

  const direction = normalizeDirection(get.direction);
  const instrument = inferInstrument(symbol, get.instrument);
  let multiplier = parseNumber(get.multiplier);
  if (!multiplier) multiplier = instrument === 'OPT' || instrument === 'FUT' ? 1 : 1;

  let rating = Math.round(parseNumber(get.rating));
  if (rating > 0) rating = Math.max(1, Math.min(5, rating));
  else rating = 0;

  return {
    row: {
      symbol,
      instrument,
      direction,
      entryDate,
      exitDate,
      qty,
      multiplier,
      priceEntry,
      priceExit: closed ? priceExit : 0,
      stopLoss: parseNumber(get.stopLoss),
      target: parseNumber(get.target),
      strategy: String(get.strategy || '').trim(),
      setup: String(get.setup || '').trim(),
      mistakes: listVal(get.mistakes),
      emotions: listVal(get.emotions),
      notes: String(get.notes || '').trim(),
      rating,
      status: closed ? 'CLOSED' : 'OPEN'
    }
  };
}

/** Full pass: rows + mapping -> { trades, skipped } */
export function rowsToTrades(rows, mapping, { header = true } = {}) {
  const data = header ? rows.slice(1) : rows;
  const head = header ? rows[0] || [] : [];
  const trades = [];
  const skipped = [];
  data.forEach((cells, i) => {
    const res = rowToTrade(cells, mapping, head);
    if (res.row) trades.push(res.row);
    else skipped.push({ line: (header ? 2 : 1) + i, reason: res.error });
  });
  return { trades, skipped };
}
