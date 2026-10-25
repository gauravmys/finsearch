# FinSearch

A personal research app for Indian stocks (NSE/BSE).

**Phase 1 (this version)**
- Watchlist: add a stock by NSE symbol (`TCS`) or BSE code (`500325`), remove it with ×
- Company overview: sector, industry, employees, website, business summary
- Key metrics: price and day change, market cap, P/E, EPS, sales, profit margin, ROE, P/B, 52-week range, dividend yield, beta
- Price chart with 1M / 6M / 1Y / 5Y / Max ranges
- Next financial results date (NSE board meeting announcements, Yahoo as fallback)

## Stack

| Part | Tech | Folder |
|---|---|---|
| Backend API | Python, FastAPI, yfinance, SQLite | `backend/` |
| Frontend | Next.js (React, TypeScript), Tailwind, TradingView Lightweight Charts | `frontend/` |

All market data calls live in `backend/app/data.py`, so data sources can be changed without touching the UI. No API keys are needed.

## Run it locally

You need Python 3.11+ and Node.js 20+.

**1. Backend** (http://localhost:8000, API docs at http://localhost:8000/docs)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**2. Frontend** (http://localhost:3000), in a second terminal

```bash
cd frontend
npm install
npm run dev
```

If the backend runs somewhere else, set `NEXT_PUBLIC_API_URL` (e.g. in `frontend/.env.local`).

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
| GET | `/api/stocks/{symbol}/next-results` | Next results date and its source |

## Data caveats

Yahoo Finance (via yfinance) and the NSE website are free but unofficial. They can be delayed, throttle requests, or change without notice. Responses are cached in memory (prices 15 minutes, fundamentals 6 hours, results dates 12 hours) to keep requests low. Not investment advice.

## Roadmap

- **Phase 2:** returns vs Nifty 50, buy price and gain/loss, quarterly sales and profit trends, watchlist summary table
- **Phase 3:** business segment revenue and profit, Nifty sectoral index comparison, peer table
- **Phase 4:** results calendar for the whole watchlist, news, notes, deployment
