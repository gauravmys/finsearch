"use client";

import { useCallback, useEffect, useState } from "react";
import StockView from "@/components/StockView";
import Watchlist from "@/components/Watchlist";
import { api, type WatchlistItem } from "@/lib/api";

export default function Home() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = await api.watchlist();
    setItems(list);
    return list;
  }, []);

  useEffect(() => {
    refresh()
      .then((list) => setSelected((s) => s ?? list[0]?.symbol ?? null))
      .catch(() => setError("Can't reach the FinSearch API. Is the backend running on port 8000?"));
  }, [refresh]);

  async function add(symbol: string) {
    const added = await api.addStock(symbol);
    await refresh();
    setSelected(added.symbol);
  }

  async function remove(symbol: string) {
    await api.removeStock(symbol);
    const list = await refresh();
    if (symbol === selected) setSelected(list[0]?.symbol ?? null);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row">
      <div className="md:w-72 md:shrink-0">
        <div className="mb-6 text-xl font-bold">
          Fin<span className="text-blue-600">Search</span>
        </div>
        <Watchlist items={items} selected={selected} onSelect={setSelected} onAdd={add} onRemove={remove} />
      </div>
      <main className="min-w-0 flex-1">
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : selected ? (
          <StockView key={selected} symbol={selected} />
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-500 dark:border-neutral-700">
            Add a stock to your watchlist to start researching it.
          </div>
        )}
      </main>
    </div>
  );
}
