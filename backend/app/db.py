"""SQLite storage for the watchlist."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(os.environ.get("FINSEARCH_DB", Path(__file__).resolve().parent.parent / "finsearch.db"))


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS watchlist (
                symbol   TEXT PRIMARY KEY,
                name     TEXT NOT NULL,
                added_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )


def list_watchlist() -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT symbol, name, added_at FROM watchlist ORDER BY added_at").fetchall()
    return [dict(r) for r in rows]


def add_to_watchlist(symbol: str, name: str) -> bool:
    """Add a stock. Returns False if it was already in the list."""
    with connect() as conn:
        cur = conn.execute(
            "INSERT OR IGNORE INTO watchlist (symbol, name) VALUES (?, ?)", (symbol, name)
        )
        return cur.rowcount == 1


def remove_from_watchlist(symbol: str) -> bool:
    """Remove a stock. Returns False if it was not in the list."""
    with connect() as conn:
        cur = conn.execute("DELETE FROM watchlist WHERE symbol = ?", (symbol,))
        return cur.rowcount == 1
