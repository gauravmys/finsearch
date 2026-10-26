"""All market data calls live here, so a data source can be swapped without touching the API or UI.

Sources:
- yfinance (Yahoo Finance, unofficial) for company profile, metrics and price history.
- NSE India website (unofficial JSON) for upcoming board meetings that will approve results,
  with yfinance's earnings calendar as a fallback.
"""

import re
import time
from datetime import date, datetime
from functools import wraps

import requests
import yfinance as yf


class SymbolNotFound(Exception):
    pass


def ttl_cache(seconds: int):
    """Cache a function's results in memory for a fixed time, so we don't hammer free data sources."""

    def decorator(fn):
        store: dict = {}

        @wraps(fn)
        def wrapper(*args):
            hit = store.get(args)
            if hit and time.monotonic() - hit[0] < seconds:
                return hit[1]
            value = fn(*args)
            store[args] = (time.monotonic(), value)
            return value

        wrapper.cache_clear = store.clear
        return wrapper

    return decorator


def normalize_symbol(raw: str) -> str:
    """Turn what a user types into a Yahoo symbol: RELIANCE -> RELIANCE.NS, 500325 -> 500325.BO."""
    symbol = raw.strip().upper()
    if not symbol or not re.fullmatch(r"[A-Z0-9&.\-^]+", symbol):
        raise SymbolNotFound(raw)
    if "." in symbol or symbol.startswith("^"):
        return symbol
    if symbol.isdigit():
        return f"{symbol}.BO"
    return f"{symbol}.NS"


def nse_code(symbol: str) -> str | None:
    """RELIANCE.NS -> RELIANCE. Only NSE symbols can be looked up on NSE."""
    return symbol[:-3] if symbol.endswith(".NS") else None


@ttl_cache(seconds=6 * 3600)
def _info(symbol: str) -> dict:
    info = yf.Ticker(symbol).info or {}
    if not (info.get("longName") or info.get("shortName")):
        raise SymbolNotFound(symbol)
    return info


# Yahoo exchange codes -> names people know.
EXCHANGES = {"NSI": "NSE", "BSE": "BSE"}


def get_profile(symbol: str) -> dict:
    info = _info(symbol)
    return {
        "symbol": symbol,
        "name": info.get("longName") or info.get("shortName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "country": info.get("country"),
        "website": info.get("website"),
        "employees": info.get("fullTimeEmployees"),
        "summary": info.get("longBusinessSummary"),
        "exchange": EXCHANGES.get(info.get("exchange"), info.get("exchange")),
        "currency": info.get("currency"),
    }


def get_metrics(symbol: str) -> dict:
    info = _info(symbol)
    price = info.get("currentPrice") or info.get("regularMarketPrice")
    prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")
    change_pct = (price - prev_close) / prev_close * 100 if price and prev_close else None
    dividend_rate = info.get("dividendRate")
    return {
        "symbol": symbol,
        "currency": info.get("currency"),
        "price": price,
        "change_pct": change_pct,
        "market_cap": info.get("marketCap"),
        "pe_trailing": info.get("trailingPE"),
        "pe_forward": info.get("forwardPE"),
        "eps": info.get("trailingEps"),
        "revenue": info.get("totalRevenue"),
        "profit_margin": info.get("profitMargins"),
        "price_to_book": info.get("priceToBook"),
        "roe": info.get("returnOnEquity"),
        "roce": _roce(symbol),
        "week52_high": info.get("fiftyTwoWeekHigh"),
        "week52_low": info.get("fiftyTwoWeekLow"),
        "dividend_yield": dividend_rate / price if dividend_rate and price else None,
        "beta": info.get("beta"),
    }


# Rows shown in each statement: (label on screen, Yahoo row names to try in order).
STATEMENTS = {
    "pnl": [
        ("Sales", ["Total Revenue", "Operating Revenue"]),
        ("Expenses", ["Total Expenses"]),
        ("Operating profit (EBITDA)", ["EBITDA", "Normalized EBITDA"]),
        ("Depreciation", ["Reconciled Depreciation", "Depreciation And Amortization In Income Statement"]),
        ("EBIT", ["EBIT", "Operating Income"]),
        ("Interest", ["Interest Expense", "Interest Expense Non Operating"]),
        ("Profit before tax", ["Pretax Income"]),
        ("Tax", ["Tax Provision"]),
        ("Net profit", ["Net Income", "Net Income Common Stockholders"]),
        ("EPS", ["Diluted EPS", "Basic EPS"]),
    ],
    "balance_sheet": [
        ("Share capital + reserves (equity)", ["Stockholders Equity", "Common Stock Equity"]),
        ("Total debt", ["Total Debt"]),
        ("Current liabilities", ["Current Liabilities"]),
        ("Total liabilities", ["Total Liabilities Net Minority Interest"]),
        ("Fixed assets (net)", ["Net PPE"]),
        ("Investments", ["Investments And Advances", "Long Term Equity Investment"]),
        ("Cash and equivalents", ["Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments"]),
        ("Current assets", ["Current Assets"]),
        ("Total assets", ["Total Assets"]),
    ],
    "cash_flow": [
        ("Cash from operations", ["Operating Cash Flow"]),
        ("Cash from investing", ["Investing Cash Flow"]),
        ("Cash from financing", ["Financing Cash Flow"]),
        ("Net cash flow", ["Changes In Cash"]),
        ("Capital expenditure", ["Capital Expenditure"]),
        ("Free cash flow", ["Free Cash Flow"]),
        ("Dividends paid", ["Cash Dividends Paid", "Common Stock Dividend Paid"]),
    ],
}

FREQUENCIES = ("annual", "quarterly")
PER_SHARE = {"EPS"}  # shown in rupees, not crore


@ttl_cache(seconds=24 * 3600)
def _statement_frames(symbol: str, freq: str) -> dict:
    t = yf.Ticker(symbol)
    if freq == "annual":
        return {"pnl": t.income_stmt, "balance_sheet": t.balance_sheet, "cash_flow": t.cashflow}
    return {"pnl": t.quarterly_income_stmt, "balance_sheet": t.quarterly_balance_sheet,
            "cash_flow": t.quarterly_cashflow}


def _pick(df, names: list[str]):
    """The first Yahoo row that exists, as a Series by period; None if none do."""
    for name in names:
        if df is not None and not df.empty and name in df.index:
            return df.loc[name]
    return None


def _number(value) -> float | None:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    return None if v != v else v  # NaN -> None


def get_financials(symbol: str, freq: str) -> dict:
    """P&L, balance sheet and cash flow, oldest period first, values in the stock's currency."""
    if freq not in FREQUENCIES:
        raise ValueError(f"freq must be one of {', '.join(FREQUENCIES)}")
    frames = _statement_frames(symbol, freq)
    result = {}
    for key, rows in STATEMENTS.items():
        df = frames.get(key)
        if df is None or df.empty:
            result[key] = {"periods": [], "rows": []}
            continue
        periods = sorted(df.columns)[-(10 if freq == "annual" else 8):]
        out_rows = []
        for label, names in rows:
            series = _pick(df, names)
            if series is None:
                continue
            values = [_number(series.get(p)) for p in periods]
            if any(v is not None for v in values):
                out_rows.append({"label": label, "values": values, "per_share": label in PER_SHARE})
        result[key] = {"periods": [p.strftime("%Y-%m-%d") for p in periods], "rows": out_rows}
    return result


def _roce(symbol: str) -> float | None:
    """Return on capital employed = EBIT / (total assets - current liabilities), latest financial year."""
    try:
        frames = _statement_frames(symbol, "annual")
        pnl, bs = frames["pnl"], frames["balance_sheet"]
        ebit, assets, cur_liab = (_pick(pnl, ["EBIT", "Operating Income"]), _pick(bs, ["Total Assets"]),
                                  _pick(bs, ["Current Liabilities"]))
        if ebit is None or assets is None or cur_liab is None:
            return None
        year = max(set(pnl.columns) & set(bs.columns))
        e, a, c = _number(ebit.get(year)), _number(assets.get(year)), _number(cur_liab.get(year))
    except Exception:  # ROCE is a nice-to-have; never fail the metrics card over it
        return None
    if e is None or a is None or c is None or a - c <= 0:
        return None
    return e / (a - c)


# period -> bar interval; long periods use weekly bars to keep the chart light.
PERIODS = {"1mo": "1d", "6mo": "1d", "1y": "1d", "5y": "1wk", "max": "1mo"}


@ttl_cache(seconds=15 * 60)
def get_history(symbol: str, period: str) -> list[dict]:
    if period not in PERIODS:
        raise ValueError(f"period must be one of {', '.join(PERIODS)}")
    df = yf.Ticker(symbol).history(period=period, interval=PERIODS[period], auto_adjust=True)
    if df.empty:
        raise SymbolNotFound(symbol)
    return [
        {"date": idx.strftime("%Y-%m-%d"), "close": round(float(row["Close"]), 2)}
        for idx, row in df.iterrows()
    ]


NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}


def _nse_board_meetings(code: str) -> list[dict]:
    """Upcoming and recent board meetings for an NSE symbol. NSE needs its cookies, so visit the homepage first."""
    with requests.Session() as s:
        s.headers.update(NSE_HEADERS)
        s.get("https://www.nseindia.com", timeout=10)
        r = s.get(
            "https://www.nseindia.com/api/corporate-board-meetings",
            params={"index": "equities", "symbol": code},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
    return data if isinstance(data, list) else data.get("data", [])


def _parse_nse_date(value: str) -> date | None:
    for fmt in ("%d-%b-%Y", "%d-%b-%Y %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    return None


def next_results_from_nse(code: str, today: date) -> dict | None:
    upcoming = []
    for m in _nse_board_meetings(code):
        purpose = f"{m.get('bm_purpose', '')} {m.get('bm_desc', '')}"
        when = _parse_nse_date(m.get("bm_date", ""))
        if when and when >= today and "result" in purpose.lower():
            upcoming.append((when, m.get("bm_purpose") or "Financial Results"))
    if not upcoming:
        return None
    when, purpose = min(upcoming)
    return {"date": when.isoformat(), "purpose": purpose, "source": "NSE"}


def next_results_from_yahoo(symbol: str, today: date) -> dict | None:
    cal = yf.Ticker(symbol).calendar or {}
    dates = cal.get("Earnings Date") or []
    future = sorted(d for d in dates if isinstance(d, date) and d >= today)
    if not future:
        return None
    return {"date": future[0].isoformat(), "purpose": "Earnings (Yahoo estimate)", "source": "Yahoo"}


@ttl_cache(seconds=12 * 3600)
def get_next_results(symbol: str) -> dict:
    """Next financial results date. NSE first (official board meeting intimation), Yahoo as fallback."""
    today = date.today()
    code = nse_code(symbol)
    if code:
        try:
            found = next_results_from_nse(code, today)
            if found:
                return found
        except (requests.RequestException, ValueError):
            pass  # NSE's unofficial API is flaky; fall back to Yahoo.
    try:
        found = next_results_from_yahoo(symbol, today)
        if found:
            return found
    except Exception:  # yfinance raises a variety of errors when Yahoo changes its pages
        pass
    return {"date": None, "purpose": None, "source": None}
