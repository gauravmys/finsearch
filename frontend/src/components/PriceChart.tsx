"use client";

import { useEffect, useRef, useState } from "react";
import { AreaSeries, ColorType, createChart } from "lightweight-charts";
import { api, PERIODS, type Period, type PricePoint } from "@/lib/api";
import { signedPct } from "@/lib/format";

const LABELS: Record<Period, string> = { "1mo": "1M", "6mo": "6M", "1y": "1Y", "5y": "5Y", max: "Max" };

export default function PriceChart({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<Period>("1y");
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .history(symbol, period)
      .then((p) => {
        if (!cancelled) setPoints(p);
      })
      .catch((e) => {
        if (cancelled) return;
        setPoints([]);
        setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, period]);

  const change =
    points.length > 1 ? ((points[points.length - 1].close - points[0].close) / points[0].close) * 100 : null;
  const up = (change ?? 0) >= 0;

  useEffect(() => {
    if (!container.current || points.length === 0) return;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const line = up ? "#16a34a" : "#dc2626";
    const chart = createChart(container.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: dark ? "#a3a3a3" : "#525252",
        attributionLogo: true,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: dark ? "#262626" : "#ececec" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: line,
      topColor: `${line}55`,
      bottomColor: `${line}05`,
      lineWidth: 2,
    });
    series.setData(points.map((p) => ({ time: p.date, value: p.close })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [points, up]);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-neutral-500">
          Price performance{" "}
          {change != null && (
            <span className={`font-medium ${up ? "text-green-600" : "text-red-600"}`}>
              {signedPct(change)} ({LABELS[period]})
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                p === period
                  ? "bg-blue-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
              }`}
            >
              {LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <p className="py-16 text-center text-sm text-red-600">{error}</p>
      ) : (
        <div ref={container} className="h-72 w-full" />
      )}
    </section>
  );
}
