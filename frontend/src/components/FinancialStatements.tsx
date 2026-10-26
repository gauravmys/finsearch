"use client";

import { useEffect, useState } from "react";
import { api, type Financials, type Frequency, type Statement } from "@/lib/api";

const SECTIONS: { key: keyof Financials; title: string }[] = [
  { key: "pnl", title: "Profit & Loss" },
  { key: "balance_sheet", title: "Balance Sheet" },
  { key: "cash_flow", title: "Cash Flows" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-03-31" -> "Mar 2025" */
function periodLabel(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** Amounts in ₹ crore without decimals; per-share figures (EPS) in rupees with two. */
function cell(value: number | null, perShare: boolean): string {
  if (value == null) return "—";
  return perShare
    ? value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : (value / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function StatementTable({ title, statement }: { title: string; statement: Statement }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
        <span className="text-xs text-neutral-500">
          ₹ Crore{statement.rows.some((r) => r.per_share) && " (EPS in ₹)"}
        </span>
      </div>
      {statement.rows.length === 0 ? (
        <p className="text-sm text-neutral-500">Not available for this stock.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
                <th className="sticky left-0 bg-white py-2 pr-4 text-left font-medium dark:bg-neutral-950"></th>
                {statement.periods.map((p) => (
                  <th key={p} className="whitespace-nowrap px-2 py-2 text-right font-medium">
                    {periodLabel(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statement.rows.map((row) => (
                <tr key={row.label} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                  <td className="sticky left-0 whitespace-nowrap bg-white py-2 pr-4 dark:bg-neutral-950">
                    {row.label}
                  </td>
                  {row.values.map((v, i) => (
                    <td
                      key={statement.periods[i]}
                      className={`whitespace-nowrap px-2 py-2 text-right ${v != null && v < 0 ? "text-red-600" : ""}`}
                    >
                      {cell(v, row.per_share)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function FinancialStatements({ symbol }: { symbol: string }) {
  const [freq, setFreq] = useState<Frequency>("annual");
  const [data, setData] = useState<Financials | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    api
      .financials(symbol, freq)
      .then((f) => {
        if (!cancelled) setData(f);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, freq]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Financial statements</h2>
        <div className="flex gap-1">
          {(["annual", "quarterly"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFreq(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${
                f === freq
                  ? "bg-blue-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !data ? (
        <p className="text-sm text-neutral-500">Loading financial statements…</p>
      ) : (
        SECTIONS.map((s) => <StatementTable key={s.key} title={s.title} statement={data[s.key]} />)
      )}
    </div>
  );
}
