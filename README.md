# FinSearch

A personal research app for Indian stocks (NSE/BSE).

**Phase 1 (this version)**
- Watchlist: add a stock by NSE symbol (`TCS`) or BSE code (`500325`), remove it with ×
- Company overview: sector, industry, employees, website, business summary
- Key metrics: price and day change, market cap, P/E, EPS, sales, profit margin, ROE, ROCE, P/B, 52-week range, dividend yield, beta
- Price chart with 1M / 6M / 1Y / 5Y / Max ranges
- Financial statements: Profit & Loss, Balance Sheet and Cash Flows, annual or quarterly, in ₹ crore
- Next financial results date (NSE board meeting announcements, Yahoo as fallback)

## Stack

| Part | Tech | Folder |
|---|---|---|
| Backend API | Python, FastAPI, yfinance, SQLite | `backend/` |
| Frontend | Next.js (React, TypeScript), Tailwind, TradingView Lightweight Charts | `frontend/` |

All market data calls live in `backend/app/data.py`, so data sources can be changed without touching the UI. No API keys are needed.

## Run it in your browser (no installs): GitHub Codespaces

Good for a work laptop where you can't install software. Free for personal GitHub accounts (60 hours a month).

1. On the repo page click **Code → Codespaces → Create codespace on main**. Setup takes a few minutes the first time.
2. In the Codespace terminal, start the backend:
   ```bash
   cd backend && uvicorn app.main:app --reload
   ```
3. Open a second terminal (the **+** button) and start the frontend:
   ```bash
   cd frontend && npm run dev
   ```
4. A pop-up offers to open port 3000 in the browser. If you miss it, open the **Ports** tab and click the globe icon next to port 3000.

## Run it locally

You need Python 3.11+ and Node.js 20+.

**1. Backend** (http://localhost:8000, API docs at http://localhost:8000/docs)

Windows (PowerShell):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

If PowerShell refuses to run `activate`, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Command Prompt (`cmd`), where the same commands work.

macOS / Linux: the same, but activate with `source .venv/bin/activate`.

**2. Frontend** (http://localhost:3000), in a second terminal

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000. The frontend forwards `/api/*` to the backend at `http://localhost:8000`; set `BACKEND_URL` if the backend runs elsewhere.

## Tests

```bash
cd backend && pytest
```

The tests stub out the data sources, so they run offline.

## API

| Method | Path | What it does |
|---|---|---|
| GET | `/api/watchlist` | List saved stocks |
| POST | `/api/watchlist` | Add a stock: `{"symbol": "TCS"}` |
| DELETE | `/api/watchlist/{symbol}` | Remove a stock |
| GET | `/api/stocks/{symbol}/overview` | Company profile |
| GET | `/api/stocks/{symbol}/metrics` | Key metrics |
| GET | `/api/stocks/{symbol}/history?period=1y` | Closing prices (`1mo`, `6mo`, `1y`, `5y`, `max`) |
| GET | `/api/stocks/{symbol}/financials?freq=annual` | Profit & loss, balance sheet, cash flow (`annual` or `quarterly`) |
| GET | `/api/stocks/{symbol}/next-results` | Next results date and its source |

## Data caveats

Yahoo Finance (via yfinance) and the NSE website are free but unofficial. They can be delayed, throttle requests, or change without notice. Responses are cached in memory (prices 15 minutes, fundamentals 6 hours, results dates 12 hours) to keep requests low. Not investment advice.

## Roadmap

- **Phase 2:** returns vs Nifty 50, buy price and gain/loss, quarterly sales and profit trends, watchlist summary table
- **Phase 3:** business segment revenue and profit, Nifty sectoral index comparison, peer table
- **Phase 4:** results calendar for the whole watchlist, news, notes, deployment
