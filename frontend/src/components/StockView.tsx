"use client";

import { useEffect, useState } from "react";
import { api, type Metrics, type NextResults, type Overview } from "@/lib/api";
import { crore, daysUntil, longDate, money, num, pct, signedPct } from "@/lib/format";
import FinancialStatements from "./FinancialStatements";
import PriceChart from "./PriceChart";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-base font-medium tabular-nums">{value}</div>
    </div>
  );
}

function ResultsBadge({ results }: { results: NextResults | null }) {
  if (!results) return null;
  if (!results.date)
    return <span className="text-sm text-neutral-500">Next results date not announced yet</span>;
  const days = daysUntil(results.date);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 rounded-2xl bg-amber-50 px-3 py-1 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
      Next results: <strong>{longDate(results.date)}</strong>
      <span className="text-xs">
        ({days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}, via {results.source})
      </span>
    </span>
  );
}

export default function StockView({ symbol }: { symbol: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [results, setResults] = useState<NextResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOverview(null);
    setMetrics(null);
    setResults(null);
    setError(null);
    Promise.all([api.overview(symbol), api.metrics(symbol)])
      .then(([o, m]) => {
        if (cancelled) return;
        setOverview(o);
        setMetrics(m);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    // Results date comes from a slower source; load it separately so it doesn't hold up the page.
    api
      .nextResults(symbol)
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!overview || !metrics) return <p className="text-neutral-500">Loading {symbol}…</p>;

  const cur = metrics.currency;
  const up = (metrics.change_pct ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-2xl font-semibold">{overview.name}</h1>
          <span className="text-sm text-neutral-500">
            {symbol} · {overview.exchange}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-semibold tabular-nums">{money(metrics.price, cur)}</span>
          <span className={`text-lg font-medium ${up ? "text-green-600" : "text-red-600"}`}>
            {signedPct(metrics.change_pct)} today
          </span>
        </div>
        <ResultsBadge results={results} />
      </header>

      <Card title="Overview">
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Sector" value={overview.sector ?? "—"} />
          <Stat label="Industry" value={overview.industry ?? "—"} />
          <Stat label="Employees" value={num(overview.employees, 0)} />
          <div>
            <div className="text-xs text-neutral-500">Website</div>
            {overview.website ? (
              <a
                href={overview.website}
                target="_blank"
                rel="noreferrer"
                className="text-base font-medium text-blue-600 hover:underline"
              >
                {overview.website.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            ) : (
              "—"
            )}
          </div>
        </div>
        {overview.summary && (
          <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{overview.summary}</p>
        )}
      </Card>

      <PriceChart symbol={symbol} />

      <Card title="Key metrics">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Market cap" value={crore(metrics.market_cap, cur)} />
          <Stat label="P/E (TTM)" value={num(metrics.pe_trailing)} />
          <Stat label="P/E (forward)" value={num(metrics.pe_forward)} />
          <Stat label="EPS (TTM)" value={money(metrics.eps, cur)} />
          <Stat label="Sales (TTM)" value={crore(metrics.revenue, cur)} />
          <Stat label="Profit margin" value={pct(metrics.profit_margin)} />
          <Stat label="ROE" value={pct(metrics.roe)} />
          <Stat label="ROCE" value={pct(metrics.roce)} />
          <Stat label="Price / book" value={num(metrics.price_to_book)} />
          <Stat label="52-week high" value={money(metrics.week52_high, cur)} />
          <Stat label="52-week low" value={money(metrics.week52_low, cur)} />
          <Stat label="Dividend yield" value={pct(metrics.dividend_yield)} />
          <Stat label="Beta" value={num(metrics.beta)} />
        </div>
      </Card>

      <FinancialStatements symbol={symbol} />

      <p className="text-xs text-neutral-500">
        Data from Yahoo Finance and NSE India (unofficial sources, may be delayed). Not investment advice.
      </p>
    </div>
  );
}
