"use client";

import { FormEvent, useState } from "react";
import type { WatchlistItem } from "@/lib/api";

type Props = {
  items: WatchlistItem[];
  selected: string | null;
  onSelect: (symbol: string) => void;
  onAdd: (symbol: string) => Promise<void>;
  onRemove: (symbol: string) => Promise<void>;
};

export default function Watchlist({ items, selected, onSelect, onAdd, onRemove }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(input.trim());
      setInput("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Watchlist</h2>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add stock, e.g. TCS"
          aria-label="Stock symbol"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "…" : "Add"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-neutral-500">NSE symbol (RELIANCE) or BSE code (500325).</p>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Your watchlist is empty.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.symbol}>
              <div
                className={`group flex items-center justify-between rounded-md px-3 py-2 ${
                  item.symbol === selected
                    ? "bg-blue-50 dark:bg-blue-950"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                }`}
              >
                <button onClick={() => onSelect(item.symbol)} className="min-w-0 flex-1 text-left">
                  <div className="text-sm font-medium">{item.symbol.replace(/\.(NS|BO)$/, "")}</div>
                  <div className="truncate text-xs text-neutral-500">{item.name}</div>
                </button>
                <button
                  onClick={() => onRemove(item.symbol)}
                  aria-label={`Remove ${item.symbol}`}
                  title="Remove"
                  className="ml-2 rounded px-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
