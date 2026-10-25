"""API tests with the data sources stubbed out, so they run offline."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import data, db
from app.main import app

FAKE_INFO = {
    "RELIANCE.NS": {
        "longName": "Reliance Industries Limited",
        "sector": "Energy",
        "industry": "Oil & Gas Refining & Marketing",
        "currency": "INR",
        "currentPrice": 1400.0,
        "previousClose": 1386.0,
        "trailingPE": 25.5,
        "totalRevenue": 9_800_000_000_000,
        "dividendRate": 7.0,
    }
}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")

    def fake_info(symbol):
        if symbol not in FAKE_INFO:
            raise data.SymbolNotFound(symbol)
        return FAKE_INFO[symbol]

    monkeypatch.setattr(data, "_info", fake_info)
    with TestClient(app) as c:
        yield c


@pytest.mark.parametrize(
    "raw, expected",
    [("reliance", "RELIANCE.NS"), (" TCS ", "TCS.NS"), ("500325", "500325.BO"),
     ("INFY.BO", "INFY.BO"), ("^NSEI", "^NSEI"), ("M&M", "M&M.NS")],
)
def test_normalize_symbol(raw, expected):
    assert data.normalize_symbol(raw) == expected


def test_normalize_symbol_rejects_junk():
    with pytest.raises(data.SymbolNotFound):
        data.normalize_symbol("drop table;")


def test_watchlist_add_list_remove(client):
    assert client.get("/api/watchlist").json() == []

    r = client.post("/api/watchlist", json={"symbol": "reliance"})
    assert r.status_code == 201
    assert r.json() == {"symbol": "RELIANCE.NS", "name": "Reliance Industries Limited"}

    assert client.post("/api/watchlist", json={"symbol": "RELIANCE"}).status_code == 409
    assert [s["symbol"] for s in client.get("/api/watchlist").json()] == ["RELIANCE.NS"]

    assert client.delete("/api/watchlist/RELIANCE.NS").status_code == 204
    assert client.get("/api/watchlist").json() == []
    assert client.delete("/api/watchlist/RELIANCE.NS").status_code == 404


def test_add_unknown_symbol(client):
    assert client.post("/api/watchlist", json={"symbol": "NOSUCHCO"}).status_code == 404


def test_metrics(client):
    m = client.get("/api/stocks/RELIANCE/metrics").json()
    assert m["price"] == 1400.0
    assert m["pe_trailing"] == 25.5
    assert m["change_pct"] == pytest.approx(1.0101, rel=1e-3)
    assert m["dividend_yield"] == pytest.approx(0.005)


def test_overview(client):
    o = client.get("/api/stocks/RELIANCE.NS/overview").json()
    assert o["name"] == "Reliance Industries Limited"
    assert o["sector"] == "Energy"


def test_history_rejects_bad_period(client):
    assert client.get("/api/stocks/RELIANCE/history?period=7y").status_code == 400


def test_data_source_failure_is_502(client, monkeypatch):
    def boom(*args):
        raise RuntimeError("yahoo down")

    monkeypatch.setattr(data, "get_history", boom)
    assert client.get("/api/stocks/RELIANCE/history").status_code == 502


def test_next_results_from_nse_picks_earliest_future_results_meeting(monkeypatch):
    meetings = [
        {"bm_date": "10-Jul-2026", "bm_purpose": "Financial Results"},          # past
        {"bm_date": "20-Jan-2027", "bm_purpose": "Financial Results/Dividend"},
        {"bm_date": "05-Nov-2026", "bm_purpose": "Fund Raising"},               # not results
        {"bm_date": "14-Nov-2026", "bm_purpose": "Financial Results"},
    ]
    monkeypatch.setattr(data, "_nse_board_meetings", lambda code: meetings)
    found = data.next_results_from_nse("RELIANCE", date(2026, 10, 25))
    assert found == {"date": "2026-11-14", "purpose": "Financial Results", "source": "NSE"}


def test_next_results_falls_back_to_yahoo(monkeypatch):
    def nse_down(code):
        raise data.requests.ConnectionError()

    monkeypatch.setattr(data, "_nse_board_meetings", nse_down)
    monkeypatch.setattr(
        data, "next_results_from_yahoo",
        lambda symbol, today: {"date": "2027-01-15", "purpose": "Earnings (Yahoo estimate)", "source": "Yahoo"},
    )
    data.get_next_results.cache_clear()
    assert data.get_next_results("TCS.NS")["source"] == "Yahoo"
