# TradeVault — Trading Journal + Daily Life Journal

A complete journal for a serious trader: log every trade with **automatic Indian brokerage & charges
(STT, GST, stamp duty, exchange + SEBI fees)**, see where your edge really comes from, and keep a
**daily life journal** (mood, sleep, habits, gratitude) that shows how your state of mind moves your P&L.

Works as a **website**, an **installable PWA**, and a **native Android APK** — with **cloud sync and offline
support**, so the data is never lost.

> Built for Indian markets: NSE/BSE equity (intraday & delivery), Futures, Options and Commodity, in ₹.

---

## ✨ Features

### Trading journal
| | |
|---|---|
| **Trade log** | Symbol, instrument, direction, date/time in & out, quantity, lot size, entry/exit/stop/target |
| **Auto charges** | Real NSE-style calculation — brokerage, STT, exchange transaction, SEBI turnover, stamp duty + 18% GST. Editable per broker. |
| **Auto P&L** | Gross, net, R-multiple, risk amount, planned R:R, holding time — computed instantly |
| **Analytics** | Net P&L, win rate, profit factor, expectancy, payoff ratio, avg R, max drawdown, streaks |
| **Breakdowns** | By strategy, symbol, instrument, direction, weekday, entry hour, mistake, emotion |
| **R-distribution** | See whether your winners are actually bigger than your losers |
| **Equity curve** | Cumulative P&L with drawdown |
| **Psychology** | Tag emotions and mistakes on every trade and see exactly what they cost you |
| **Screenshots** | Attach entry/exit charts (compressed & stored with the trade) |
| **Playbook** | Write your setups and rules; keep them next to the trade form |
| **Watchlist** | Track ideas with target, stop and thesis |
| **Goals & limits** | Monthly profit target, win-rate goal, max-trades limit |

### Daily life journal
| | |
|---|---|
| **Daily entry** | Mood, energy, stress, day rating, sleep, water, exercise, screen time |
| **Gratitude** | Three good things, every day |
| **Habits** | Custom habit tracker with a 30-day completion grid and streaks |
| **Free writing** | Highlights + long-form reflection with a daily prompt |
| **Journal streak** | Current & longest streak |
| **Mood vs P&L** | The killer feature — how much money you make on "good mood" vs "bad mood" days |
| **Sleep trend** | Track sleep against your trading results |

### Platform
- **Offline-first**: everything is stored locally (IndexedDB) — the app works with no internet
- **Cloud sync**: sign in to sync every device; last-write-wins merge, no data loss
- **Login/signup** (JWT) or **device-only mode** (no account needed)
- **Backup/restore** as JSON, plus CSV export of trades
- **PWA**: "Add to Home screen" on mobile
- **Android APK** built by GitHub Actions

---

## 🚀 Quick start (on this machine)

```bash
npm install       # install everything (workspaces: server + web)
npm run build     # build the web app
npm start         # serve API + app on http://localhost:3001
```

Development (hot reload):

```bash
npm run dev       # web on :5173 (proxies /api) + API on :3001
```

The server keeps its database at `server/data/tradevault.db`.

---

## ☁️ Cloud sync — deploying the server

The APK and the website talk to this Node API. For permanent cloud sync, deploy the `server/` folder to
any Node host (Render, Railway, Fly.io, VPS, …):

1. Push this repo to GitHub.
2. Create a **Web Service** on [Render](https://render.com) (or similar):
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Environment variable: `JWT_SECRET` = a long random string, `PORT` = `10000` (Render sets it automatically)
3. Open the URL, create an account — that's your cloud backend.
4. In the app: **Settings → Server URL** → paste `https://your-service.onrender.com` → **Test**.

To bake the URL into the APK instead of typing it, edit `web/.env.production`:

```
VITE_API_URL=https://your-service.onrender.com
```

Then re-run the **Build Android APK** workflow.

> Free hosts sleep after inactivity, so the first request after a break can take ~30s.
> A small VPS or an always-on host gives the best experience.

---

## 📱 Android APK

The APK is built by GitHub Actions — no Android Studio required.

**Trigger a build:**

```bash
git push -f origin <your-branch>:apk-build
```

or run the **Build Android APK** workflow manually from the Actions tab.

**Get the APK:** the workflow force-pushes the result to the `apk` branch of this repo
(`TradeVault.apk` plus build diagnostics). Download it from
`https://github.com/arnabdebnath7/Trading-JOURNAL/tree/apk`.

Install it on the phone: enable **Install unknown apps** for your browser/files app, then tap the APK.
(Minimum: Android 7.0 / API 24.)

**What to do after installing**
1. Open TradeVault → **Create account** (this syncs your data to the cloud), or **Use on this device only**.
2. If sign-in fails on mobile data, open **Settings → Server URL**, paste your deployed server URL and press **Test**.
3. Start logging trades. Everything also works fully offline — it syncs when the internet is back.

---

## 🧱 Project structure

```
.
├── shared/           # trade math + schema, used by BOTH server and client
│   ├── tradeMath.js  # Indian charges model, P&L, R-multiple
│   └── schema.js     # tables, camelCase <-> snake_case, sync helpers
├── server/           # Express + SQLite API (JWT auth, /api/sync, export/import)
│   └── src/
├── web/              # React + Vite + Tailwind PWA
│   └── src/
│       ├── lib/      # Dexie local DB, API client, sync engine, metrics
│       ├── state/    # app context (auth, settings, sync status)
│       ├── components/
│       └── pages/    # Dashboard, Trades, Analytics, Journal, Playbook, …
├── capacitor.config.ts
└── .github/workflows/apk.yml   # builds the Android APK
```

### How sync works
1. Every write goes to the local Dexie/IndexedDB store first and marks the row `_dirty`.
2. A background sync pushes dirty rows and pulls everything the server changed since `lastPulledAt`.
3. Conflicts are resolved **last-write-wins** by `updated_at`; the losing side is re-pushed on the next cycle.
4. IDs are generated client-side (UUID), so trades created offline merge cleanly.

---

## 🔧 Configuration

| Setting | Where | Default |
|---|---|---|
| Brokerage per order | Settings → Trading defaults | ₹20 (or 0.03%, whichever is lower) |
| GST on charges | Settings | On (18%) |
| Starting capital | Settings | ₹1,00,000 |
| Risk per trade | Settings | 1% |
| Strategies / setups / mistakes / emotions | Settings → Your lists | Editable lists |
| Server URL | Settings → Account & sync | Same origin, or `VITE_API_URL` |

Charge rates follow standard NSE schedules and live in `shared/tradeMath.js` if you ever need to tweak them.

---

## 🔐 Security notes

- Passwords are hashed with bcrypt; sessions are JWTs.
- Set `JWT_SECRET` in production (`server/src/auth.js` falls back to a dev secret).
- Every API route is scoped to the signed-in user; rows from other accounts can never be read or written.

---

## 📖 Guide for the trader (हिंदी में)

1. **हर trade भरें** — entry से पहले या तुरंत बाद। Symbol, qty, entry, exit, stop loss और strategy भरें —
   charges और net P&L अपने आप बन जाएँगे (STT/GST/brokerage समेत)।
2. **Emotion और mistake टैग करें** — "FOMO entry", "Revenge trading" जैसे टैग। Analytics में दिखेगा कि
   किस गलती ने कितने पैसे खाए।
3. **Playbook लिखें** — अपने setup और rules। Trade भरते समय ये checklist सामने रहती है।
4. **रोज़ life journal** — 2 मिनट: mood, नींद, 3 gratitude, habits। Streak बढ़ाएँ।
5. **Analytics देखें** — हर हफ्ते कौन-सी strategy चल रही है, कौन-सी खराब; किस mood में पैसे बन रहे हैं।
6. **Goals सैट करें** — monthly target और max trades limit (overtrading रोकने के लिए)।

---

Made for traders who want to stop repeating the same mistakes. Trade less, journal more.
