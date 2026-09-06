# TradeVault v2.0 — The Professional Layer

The trading + life journal you already know, upgraded with the tools a serious desk would ask for.

## 🆕 New in v2.0

### 📅 P&L Calendar (`/calendar`)
A full month heatmap of your daily net P&L. Green and red intensity scale with size, best/worst days are
summarised up top, and every trading day carries the mood emoji you logged in your life journal — see in one
glance how your state and your P&L move together. Tap any day for its trades and journal entry.

### 📋 Reviews (`/reports`)
Your weekly / monthly / quarterly review, written by your own data:
- **The verdict** — a one-paragraph summary of the period
- Headline stats (net P&L, win rate, profit factor, expectancy, avg R, max drawdown)
- Best & worst trade cards
- Strategy performance and setup-grade tables
- What your mistakes cost you
- Psychology: average mood on green vs red days, journaling consistency
- Monthly goals vs actual
- **Copy / download `.md` / share** — send it to your mentor or your Telegram journal in one tap

### 🛡️ Discipline score
One number, 0-100: plan adherence (35%) · risk management (25%) · journaling consistency (25%) · habit
completion (15%). Graded Elite / Strong / Slipping / Rebuild, shown on the dashboard and inside every review.
Parts with no data drop out and re-weight — no punishment for what you haven't started yet.

### 📥 CSV import
Trades → **Import**: paste CSV text or pick a file. Columns are auto-mapped (and editable), Indian formats are
understood (`dd/mm/yyyy`, `14-Jun-2026`, ISO dates, ₹1,234.50 numbers, buy/sell direction), instruments are
inferred from the symbol (FUT/CE/PE), and a live preview shows the computed net P&L before anything is saved.
Works with TradeVault's own CSV export and generic broker P&L sheets.

### 📊 Analytics v2
- **Underwater curve** — how deep below peak equity you've been
- **P&L by holding time** — <15m / 15-60m / 1-3h / >3h buckets
- **Session heatmap** — weekday × entry-hour grid with trade counts and net P&L
- **Setup grades** — A+ → D breakdown of the trades you graded
- Quick links to Calendar and Reviews from the analytics header

### ✨ Interface v2
Dashboard hero band with big net P&L, equity sparkline and discipline ring · KPI cards with sparklines ·
gradient score rings · toast notifications · Calendar and Reviews wired into the sidebar, More menu and
analytics — all in the same offline-first, cloud-syncing shell.

## ✅ Also
- `npm run test:csv` — unit tests for the CSV engine
- Smoke test now walks the Calendar and Reviews pages too
- Version 2.0.0 across app, web and server

**Install:** grab `TradeVault.apk` from the release assets (debug-signed build). Existing v1 data is
untouched — same database, same sync, just new views on top.
