import { parseCsv, guessMapping, rowsToTrades, parseNumber, toLocalIso } from '../web/src/lib/csv.js';
import assert from 'node:assert';

// 1. TradeVault-style export with quoted Indian number
const tv = parseCsv(
  'date,symbol,instrument,direction,qty,entry,exit,stop_loss,strategy\n' +
    '2026-09-01,RELIANCE,EQUITY_INTRADAY,LONG,50,"1,420.50",1455,1410,Breakout\n' +
    '01-09-2026,TATAMOTORS,EQUITY_INTRADAY,LONG,100,960,,945,ORB'
);
let map = guessMapping(tv[0]);
assert.equal(map[2], 'instrument', 'instrument column mapped');
let { trades, skipped } = rowsToTrades(tv, map);
assert.equal(trades.length, 2);
assert.equal(skipped.length, 0);
assert.equal(trades[0].priceEntry, 1420.5);
assert.equal(trades[0].stopLoss, 1410);
assert.equal(trades[0].strategy, 'Breakout');
assert.equal(trades[0].status, 'CLOSED');
assert.equal(trades[1].status, 'OPEN');

// 2. Zerodha-style columns + option/futures inference + short detection
const zd = parseCsv(
  'tradingsymbol,trade_type,quantity,buy_average,sell_average,trade_date\n' +
    'NIFTY 24SEP 24500 CE,buy,50,102.5,131.25,14-Jun-2026\n' +
    'BANKNIFTY FUT,sell,15,51000.00,50500.00,2026-06-16'
);
map = guessMapping(zd[0]);
({ trades } = rowsToTrades(zd, map));
assert.equal(trades[0].instrument, 'OPT');
assert.equal(trades[0].direction, 'LONG');
assert.equal(trades[0].priceExit, 131.25);
assert.equal(trades[1].instrument, 'FUT');
assert.equal(trades[1].direction, 'SHORT');

// 3. value coercion
assert.equal(parseNumber('₹1,234.50'), 1234.5);
assert.equal(parseNumber('(500)'), -500);
assert.equal(toLocalIso('14-Jun-2026 9:20', ''), '2026-06-14T09:20');
assert.equal(toLocalIso('2026-06-14', '9:20 AM'), '2026-06-14T09:20');
assert.equal(toLocalIso('05/06/2026', '', { fallbackTime: '10:00' }), '2026-06-05T10:00'); // dd/mm Indian

// 4. broken rows skipped with reasons
const bad = parseCsv('symbol,qty,entry,exit\n,10,10,11\nX,0,10,11\nY,10,10,11');
({ skipped } = rowsToTrades(bad, guessMapping(bad[0])));
assert.equal(skipped.length, 3);

console.log('✅ csv.js: all parser tests passed');
