import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import data, db


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="FinSearch API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("FINSEARCH_CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def resolve(raw: str) -> str:
    try:
        return data.normalize_symbol(raw)
    except data.SymbolNotFound:
        raise HTTPException(status_code=404, detail=f"Unknown symbol: {raw}")


def fetch(fn, *args):
    """Call a data function and turn data-source failures into clean HTTP errors."""
    try:
        return fn(*args)
    except data.SymbolNotFound:
        raise HTTPException(status_code=404, detail=f"No data found for {args[0]}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=502, detail="The market data source is unavailable, try again shortly")


@app.get("/api/health")
def health():
    return {"ok": True}


class AddStock(BaseModel):
    symbol: str


@app.get("/api/watchlist")
def get_watchlist():
    return db.list_watchlist()


@app.post("/api/watchlist", status_code=201)
def add_stock(body: AddStock):
    symbol = resolve(body.symbol)
    profile = fetch(data.get_profile, symbol)
    if not db.add_to_watchlist(symbol, profile["name"]):
        raise HTTPException(status_code=409, detail=f"{symbol} is already in your watchlist")
    return {"symbol": symbol, "name": profile["name"]}


@app.delete("/api/watchlist/{symbol}", status_code=204)
def remove_stock(symbol: str):
    if not db.remove_from_watchlist(symbol.upper()):
        raise HTTPException(status_code=404, detail=f"{symbol} is not in your watchlist")


@app.get("/api/stocks/{symbol}/overview")
def overview(symbol: str):
    return fetch(data.get_profile, resolve(symbol))


@app.get("/api/stocks/{symbol}/metrics")
def metrics(symbol: str):
    return fetch(data.get_metrics, resolve(symbol))


@app.get("/api/stocks/{symbol}/history")
def history(symbol: str, period: str = "1y"):
    return fetch(data.get_history, resolve(symbol), period)


@app.get("/api/stocks/{symbol}/next-results")
def next_results(symbol: str):
    return fetch(data.get_next_results, resolve(symbol))
