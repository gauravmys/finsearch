// Thin client for the FinSearch Python API. All data comes from the backend.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type WatchlistItem = { symbol: string; name: string; added_at: string };

export type Overview = {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  country: string | null;
  website: string | null;
  employees: number | null;
  summary: string | null;
  exchange: string | null;
  currency: string | null;
};

export type Metrics = {
  symbol: string;
  currency: string | null;
  price: number | null;
  change_pct: number | null;
  market_cap: number | null;
  pe_trailing: number | null;
  pe_forward: number | null;
  eps: number | null;
  revenue: number | null;
  profit_margin: number | null;
  price_to_book: number | null;
  roe: number | null;
  week52_high: number | null;
  week52_low: number | null;
  dividend_yield: number | null;
  beta: number | null;
};

export type PricePoint = { date: string; close: number };

export type NextResults = { date: string | null; purpose: string | null; source: string | null };

export const PERIODS = ["1mo", "6mo", "1y", "5y", "max"] as const;
export type Period = (typeof PERIODS)[number];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const enc = encodeURIComponent;

export const api = {
  watchlist: () => request<WatchlistItem[]>("/api/watchlist"),
  addStock: (symbol: string) =>
    request<{ symbol: string; name: string }>("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),
  removeStock: (symbol: string) => request<void>(`/api/watchlist/${enc(symbol)}`, { method: "DELETE" }),
  overview: (symbol: string) => request<Overview>(`/api/stocks/${enc(symbol)}/overview`),
  metrics: (symbol: string) => request<Metrics>(`/api/stocks/${enc(symbol)}/metrics`),
  history: (symbol: string, period: Period) =>
    request<PricePoint[]>(`/api/stocks/${enc(symbol)}/history?period=${period}`),
  nextResults: (symbol: string) => request<NextResults>(`/api/stocks/${enc(symbol)}/next-results`),
};
