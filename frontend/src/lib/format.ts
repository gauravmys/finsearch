// Number formatting in Indian style (lakh/crore grouping, ₹ amounts in crore).

const DASH = "—";

export function money(value: number | null, currency: string | null = "INR"): string {
  if (value == null) return DASH;
  const symbol = currency === "INR" ? "₹" : `${currency ?? ""} `;
  return symbol + value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Large amounts such as market cap or revenue, shown in crore (1 Cr = 10 million). */
export function crore(value: number | null, currency: string | null = "INR"): string {
  if (value == null) return DASH;
  if (currency !== "INR") return `${currency ?? ""} ${(value / 1e9).toLocaleString("en-IN", { maximumFractionDigits: 1 })} bn`;
  return `₹${(value / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
}

export function num(value: number | null, digits = 2): string {
  return value == null ? DASH : value.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

/** A fraction such as 0.125 shown as 12.5%. */
export function pct(fraction: number | null): string {
  return fraction == null ? DASH : `${(fraction * 100).toFixed(1)}%`;
}

export function signedPct(percent: number | null): string {
  if (percent == null) return DASH;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
}

export function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}
