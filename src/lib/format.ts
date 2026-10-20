import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { StatFormat } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nf = (min: number, max: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: max });
const NF2 = nf(2, 2);
const NF0 = nf(0, 0);
const NF4 = nf(2, 4);

export function fmtPrice(v: number | null | undefined, opts: { currency?: string; digits?: number } = {}): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const digits = opts.digits ?? (Math.abs(v) >= 1000 ? 2 : Math.abs(v) < 10 ? 4 : 2);
  const s = digits === 4 ? NF4.format(v) : digits === 0 ? NF0.format(v) : NF2.format(v);
  const sym = opts.currency ? currencySymbol(opts.currency) : "";
  return `${sym}${s}`;
}

export function currencySymbol(c?: string) {
  switch (c) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "GBp":
      return "p";
    case "JPY":
      return "¥";
    default:
      return "";
  }
}

export function fmtPct(v: number | null | undefined, digits = 2, signed = true): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${signed && v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function fmtChange(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}`;
}

export function fmtCompact(v: number | null | undefined, prefix = ""): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${abs.toFixed(0)}`;
}

export function fmtStat(v: number | string | null, format: StatFormat, currency?: string): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return format === "date" ? fmtDate(v, undefined, { month: "short", day: "numeric", year: "numeric" }) : v;
  switch (format) {
    case "percent":
      return fmtPct(v * 100, 2, false);
    case "compact":
      return fmtCompact(v, currency ? currencySymbol(currency) : "");
    case "currency":
      return fmtPrice(v, { currency, digits: 2 });
    case "ratio":
      return v.toFixed(2);
    case "number":
      return NF0.format(v);
    case "date":
      return fmtDate(new Date(v * 1000).toISOString());
    default: {
      const exhaustive: never = format;
      return String(exhaustive);
    }
  }
}

export function fmtDate(iso: string, timeZone?: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function fmtTime(iso: string | Date, timeZone?: string, withZone = false): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
      timeZoneName: withZone ? "short" : undefined,
    }).format(typeof iso === "string" ? new Date(iso) : iso);
  } catch {
    return String(iso);
  }
}

export function fmtRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function fmtDuration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm.toString().padStart(2, "0")}m`;
  return `${mm}m`;
}

/** Diverging red→neutral→green colour for a % change, saturating at ±`scale`. */
export function changeColor(v: number | null | undefined, scale = 3, alpha = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return `rgba(71,85,105,${alpha})`;
  const t = Math.max(-1, Math.min(1, v / scale));
  const neutral = [51, 65, 85];
  const up = [22, 163, 74];
  const down = [220, 38, 38];
  const target = t >= 0 ? up : down;
  const k = Math.pow(Math.abs(t), 0.7);
  const c = neutral.map((n, i) => Math.round(n + (target[i] - n) * k));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

export function displaySymbol(s: string) {
  return s.replace(/=X$/, "").replace(/=F$/, "").replace(/^\^/, "");
}
