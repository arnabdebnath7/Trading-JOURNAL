/**
 * Headless smoke test: bundle the real app with esbuild and render it in jsdom
 * with a fake IndexedDB, so we catch runtime crashes without a browser.
 *
 *   node scripts/smoke.mjs
 */
import esbuild from 'esbuild';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const project = path.join(root, '..');

const result = await esbuild.build({
  entryPoints: [path.join(project, 'web/src/main.jsx')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  write: false,
  loader: { '.css': 'text' },
  define: {
    'import.meta.env.PROD': 'true',
    'import.meta.env.DEV': 'false',
    'import.meta.env.VITE_API_URL': '""'
  },
  logLevel: 'error'
});

const code = result.outputFiles[0].text;

const dom = new JSDOM(
  `<!doctype html><html><body><div id="root"></div></body></html>`,
  { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' }
);

const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: window.navigator,
  configurable: true,
  writable: true
});
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.getComputedStyle = window.getComputedStyle;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
window.matchMedia = globalThis.matchMedia;
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.ResizeObserver = window.ResizeObserver;
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { indexedDB, IDBKeyRange } = await import('fake-indexeddb');
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;
window.indexedDB = indexedDB;
window.IDBKeyRange = IDBKeyRange;

// --- optionally seed a signed-in user with data before booting the app ---
if (process.env.SEED === '1') {
  const { db, saveRow, setMeta, seedIfEmpty } = await import('../web/src/lib/db.js');
  await setMeta('user', { id: 'local', name: 'Test Trader', email: 'test@tradevault.app' });
  await setMeta('localOnly', true);
  await seedIfEmpty();

  const symbols = ['RELIANCE', 'TATAMOTORS', 'NIFTY 24500 CE', 'BANKNIFTY FUT', 'INFY', 'HDFCBANK'];
  const strategies = ['Breakout', 'VWAP Bounce', 'ORB'];
  const mistakes = ['FOMO entry', 'Revenge trading', ''];
  const emotions = ['Confident', 'Anxious', 'Patient'];
  let seedTs = Date.now() - 40 * 86400000;
  for (let i = 0; i < 24; i++) {
    const entry = 100 + (i % 7) * 13;
    const win = i % 3 !== 0;
    const exit = win ? entry * 1.03 : entry * 0.98;
    const entryDate = new Date(seedTs + i * 86400000).toISOString().slice(0, 16);
    const exitDate = new Date(seedTs + i * 86400000 + 3600000).toISOString().slice(0, 16);
    await saveRow('trades', {
      symbol: symbols[i % symbols.length],
      instrument: i % 5 === 0 ? 'OPT' : i % 3 === 0 ? 'FUT' : 'EQUITY_INTRADAY',
      direction: i % 4 === 0 ? 'SHORT' : 'LONG',
      entryDate,
      exitDate,
      qty: 50 + i * 5,
      multiplier: i % 5 === 0 ? 25 : 1,
      priceEntry: entry,
      priceExit: exit,
      stopLoss: entry * 0.98,
      target: entry * 1.05,
      strategy: strategies[i % strategies.length],
      setup: '15m Breakout',
      mistakes: mistakes[i % 3] ? [mistakes[i % 3]] : [],
      emotions: [emotions[i % 3]],
      notes: 'Test trade notes for the smoke test.',
      rating: (i % 5) + 1,
      status: 'CLOSED'
    });
  }
  // one open trade
  await saveRow('trades', {
    symbol: 'RELIANCE',
    instrument: 'EQUITY_INTRADAY',
    direction: 'LONG',
    entryDate: new Date().toISOString().slice(0, 16),
    exitDate: '',
    qty: 100,
    priceEntry: 1400,
    priceExit: 0,
    stopLoss: 1385,
    status: 'OPEN'
  });

  for (let i = 0; i < 10; i++) {
    const date = new Date(Date.now() - i * 86400000);
    const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const habits = await db.habits.toArray();
    await saveRow('journal_entries', {
      date: iso,
      mood: (i % 5) + 1,
      energy: (i % 4) + 1,
      stress: (i % 3) + 1,
      sleepHours: 5 + (i % 4),
      waterGlasses: 4 + (i % 6),
      exerciseMin: (i % 3) * 20,
      gratitude: ['family', 'health', 'a good trade'],
      habits: Object.fromEntries(habits.slice(0, 2).map((h) => [h.id, i % 2 === 0])),
      highlights: `Day ${i} highlight`,
      notes: 'Reflection text for the day. Felt focused and followed the plan.',
      rating: (i % 5) + 1,
      tags: ['trading']
    });
  }
  await saveRow('watchlist', { symbol: 'TATASTEEL', name: 'Tata Steel', target: 180, stopLoss: 150, notes: 'Watch for breakout' });
  await saveRow('goals', { title: 'Monthly target', type: 'profit', targetValue: 25000, period: 'monthly' });
  console.log('seeded:', (await db.trades.count()), 'trades,', (await db.journal_entries.count()), 'entries');
}

const errors = [];
const origError = console.error;
console.error = (...args) => {
  const msg = args.map(String).join(' ');
  errors.push(msg);
  origError('[console.error]', msg.slice(0, 400));
};
window.addEventListener('error', (e) => errors.push('window error: ' + e.message));

try {
  const script = new window.Function(code);
  script();
} catch (e) {
  console.error = origError;
  console.log('❌ CRASH while executing bundle:', e);
  process.exit(1);
}

await new Promise((r) => setTimeout(r, 2500));

const html = window.document.getElementById('root').innerHTML;
console.error = origError;

const checks =
  process.env.SEED === '1'
    ? [
        ['renders the dashboard', html.length > 2000],
        ['shows Net P&L KPI', /Net P&amp;L|Net P&L/i.test(html)],
        ['shows equity curve section', /Equity curve/i.test(html)],
        ['shows a seeded symbol', /RELIANCE/i.test(html)],
        ['shows the trade log summary', /trades/i.test(html)]
      ]
    : [
        ['renders something', html.length > 500],
        ['shows TradeVault brand', /TradeVault/i.test(html)],
        ['shows sign-in screen for a new user', /Sign in/i.test(html)]
      ];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) failed++;
}

// --- walk through the main screens (seeded run) ---
if (process.env.SEED === '1') {
  const clickText = async (text) => {
    const el = [...window.document.querySelectorAll('a,button')].find((e) =>
      (e.textContent || '').trim().toLowerCase().includes(text.toLowerCase())
    );
    if (!el) return false;
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 700));
    return true;
  };

  const routes = [
    ['Trades', /trade log/i],
    ['Journal', /life journal|journal streak/i],
    ['Analytics', /profit factor|expectancy/i],
    ['More', /playbook/i],
    ['Dashboard', /equity curve/i]
  ];
  for (const [label, expect] of routes) {
    const clicked = await clickText(label);
    const h = window.document.getElementById('root').innerHTML;
    const ok = clicked && expect.test(h);
    console.log(`${ok ? '✅' : '❌'} page "${label}" renders (${h.length} chars)`);
    if (!ok) failed++;
  }

  // deep link into the "More" sub-pages
  for (const [label, expect] of [
    ['Playbook', /core setup|playbook/i],
    ['Watchlist', /watchlist/i],
    ['Goals', /goals/i],
    ['Habits', /habits/i],
    ['Settings', /trading defaults|server url/i]
  ]) {
    await clickText('More');
    const clicked = await clickText(label);
    const h = window.document.getElementById('root').innerHTML;
    const ok = clicked && expect.test(h) && h.length > 800;
    console.log(`${ok ? '✅' : '❌'} page "${label}" renders (${h.length} chars)`);
    if (!ok) failed++;
  }
}

const realErrors = errors.filter(
  (e) => !/Warning: .*not wrapped in act|useLayoutEffect does nothing|Not implemented/i.test(e)
);
if (realErrors.length) {
  console.log(`\n⚠️  ${realErrors.length} console error(s):`);
  realErrors.slice(0, 5).forEach((e) => console.log('   -', e.slice(0, 300)));
}

console.log(`\nRendered HTML length: ${html.length}`);
console.log(failed === 0 && realErrors.length === 0 ? '\n✅ SMOKE TEST PASSED' : `\n❌ SMOKE TEST: ${failed} failed check(s)`);
process.exit(failed === 0 && realErrors.length === 0 ? 0 : 1);
