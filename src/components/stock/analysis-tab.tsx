"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, Bot, CalendarClock, Calculator, Newspaper, RefreshCw, Scale, ShieldAlert, ThumbsDown, ThumbsUp, Waypoints } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ApiResponse, Rating, StockAnalysis } from "@/lib/types";
import { fetchApi, useApi, useMounted } from "@/lib/hooks";
import { useTimeZone } from "@/lib/store";
import { cn, fmtDate, fmtPct, fmtPrice, fmtRelative, fmtTime } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { RichText } from "@/components/ui/rich-text";
import { ErrorState, Skeleton } from "@/components/ui/states";

const RATING_STYLE: Record<Rating, string> = {
  "Strong Buy": "bg-emerald-500/20 text-emerald-300 ring-emerald-400/40",
  Buy: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30",
  Hold: "bg-slate-500/20 text-slate-200 ring-slate-400/30",
  Sell: "bg-rose-500/10 text-rose-300 ring-rose-400/30",
  "Strong Sell": "bg-rose-500/20 text-rose-300 ring-rose-400/40",
};

const SEVERITY_STYLE = { high: "bg-rose-500/15 text-rose-300", medium: "bg-amber-500/15 text-amber-300", low: "bg-slate-500/20 text-slate-300" } as const;

export function AnalysisTab({ symbol, price, currency }: { symbol: string; price: number | null; currency?: string }) {
  const url = `/api/stock/${encodeURIComponent(symbol)}/analysis`;
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, error, refetch } = useApi<StockAnalysis>(url, { staleTime: 10 * 60_000 });
  const a = data?.data;

  const refresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await fetchApi<StockAnalysis>(`${url}?refresh=1`);
      qc.setQueryData<ApiResponse<StockAnalysis>>([url], fresh);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) return <AnalysisLoading />;
  if (error)
    return (
      <Panel>
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </Panel>
    );
  if (!a) return null;

  const px = price;
  const vsPrice = (v: number | null) => (v != null && px ? ((v - px) / px) * 100 : null);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5">
                {a.engine === "ai" ? <Bot className="size-3.5 text-accent" /> : <Calculator className="size-3.5 text-accent" />}
                {a.engine === "ai"
                  ? `AI analyst · ${a.model}`
                  : a.aiUnavailable
                    ? "Quant engine (AI models are busy, refresh later)"
                    : "Quant engine (add an AI key for a written thesis)"}
              </span>
              <span>Generated {fmtRelative(a.generatedAt)}</span>
              <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-accent hover:bg-accent/10 disabled:opacity-50">
                <RefreshCw className={cn("size-3", refreshing && "animate-spin")} /> {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            <h2 className="mt-3 text-xl font-semibold leading-snug tracking-tight">{a.headline}</h2>
            <div className="prose-analysis mt-3 text-sm leading-relaxed text-fg/90">
              {a.thesis.split(/\n{2,}/).map((para, i) => (
                <p key={i}>
                  <RichText text={para} />
                </p>
              ))}
            </div>
          </div>
          <div className="flex min-w-56 flex-col items-center gap-3 rounded-xl border border-line bg-black/20 p-4">
            <span className={cn("rounded-lg px-4 py-1.5 text-lg font-semibold ring-1", RATING_STYLE[a.rating])}>{a.rating}</span>
            <ConvictionMeter value={a.conviction} />
            {a.valuation.fairValue.base != null && (
              <div className="text-center text-xs text-muted">
                Base-case fair value
                <div className="num text-lg text-fg">{fmtPrice(a.valuation.fairValue.base, { currency })}</div>
                <span className={cn("num", (vsPrice(a.valuation.fairValue.base) ?? 0) >= 0 ? "text-up" : "text-down")}>
                  {fmtPct(vsPrice(a.valuation.fairValue.base), 1)} vs price
                </span>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Scorecard" icon={<Activity className="size-4" />} subtitle="0–100, higher is better">
          <ul className="space-y-3 p-4">
            {a.scorecard.map((s) => (
              <li key={s.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{s.label}</span>
                  <span className="num">{Math.round(s.score)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/5">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(2, Math.min(100, s.score))}%`, background: scoreColor(s.score) }} />
                </div>
                <p className="mt-1 text-xs text-muted">{s.note}</p>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="grid grid-cols-1 gap-4">
          <CaseList title="Bull case" icon={<ThumbsUp className="size-4 text-up" />} items={a.bullCase} tone="up" />
          <CaseList title="Bear case" icon={<ThumbsDown className="size-4 text-down" />} items={a.bearCase} tone="down" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Valuation" icon={<Scale className="size-4" />} subtitle={a.valuation.verdict}>
          <div className="space-y-4 p-4">
            <p className="text-sm leading-relaxed text-fg/90">
              <RichText text={a.valuation.summary} />
            </p>
            <FairValueBar low={a.valuation.fairValue.low} base={a.valuation.fairValue.base} high={a.valuation.fairValue.high} price={px} />
            {a.valuation.keyMetrics.length > 0 && (
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {a.valuation.keyMetrics.map((m) => (
                  <li key={m} className="rounded-md bg-white/[0.03] px-2 py-1 text-xs text-fg/85">
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Scenarios (12 months)" icon={<Waypoints className="size-4" />}>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            {(["bear", "base", "bull"] as const).map((k) => {
              const s = a.scenarios[k];
              const chg = vsPrice(s.price);
              return (
                <div
                  key={k}
                  className={cn(
                    "rounded-xl border p-3",
                    k === "bull" ? "border-up/30 bg-up/[0.04]" : k === "bear" ? "border-down/30 bg-down/[0.04]" : "border-line bg-white/[0.02]",
                  )}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</div>
                  <div className="num mt-1 text-lg font-semibold">{fmtPrice(s.price, { currency })}</div>
                  <div className={cn("num text-xs", (chg ?? 0) >= 0 ? "text-up" : "text-down")}>{fmtPct(chg, 1)}</div>
                  <p className="mt-2 text-xs leading-relaxed text-fg/80">
                    <RichText text={s.rationale} />
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Technicals" icon={<Activity className="size-4" />} subtitle={a.technicals.trend}>
          <div className="space-y-3 p-4 text-sm">
            <p className="leading-relaxed text-fg/90">
              <RichText text={a.technicals.summary} />
            </p>
            <p className="text-xs text-muted">{a.technicals.momentum}</p>
            <Levels label="Resistance" values={a.technicals.resistance} cls="text-down" price={px} />
            <Levels label="Support" values={a.technicals.support} cls="text-up" price={px} />
          </div>
        </Panel>
        <EarningsWatch e={a.earnings} />
        <Panel title="News flow" icon={<Newspaper className="size-4" />} subtitle={`Sentiment: ${a.news.sentiment}`}>
          <div className="space-y-3 p-4 text-sm">
            <p className="leading-relaxed text-fg/90">
              <RichText text={a.news.summary} />
            </p>
            {a.news.catalysts.length > 0 && (
              <ul className="space-y-1.5">
                {a.news.catalysts.map((c) => (
                  <li key={c} className="flex gap-2 text-xs text-fg/85">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                    <RichText text={c} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Key risks" icon={<ShieldAlert className="size-4" />}>
        <ul className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
          {a.risks.map((r) => (
            <li key={r.title} className="rounded-xl border border-line bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{r.title}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", SEVERITY_STYLE[r.severity])}>{r.severity}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                <RichText text={r.detail} />
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <AlertTriangle className="size-3.5" /> Generated automatically from market data, filings-derived fundamentals and headlines. Not investment advice; verify before acting.
      </p>
    </div>
  );
}

function EarningsWatch({ e }: { e: StockAnalysis["earnings"] }) {
  const mounted = useMounted();
  const tz = useTimeZone();
  return (
    <Panel
      title="Earnings watch"
      icon={<CalendarClock className="size-4" />}
      subtitle={e.nextDate && mounted ? `${fmtDate(e.nextDate, tz, { weekday: "short", month: "short", day: "numeric" })} · ${fmtTime(e.nextDate, tz, true)}` : "Next report"}
    >
      <div className="space-y-3 p-4 text-sm">
        <p className="leading-relaxed text-fg/90">
          <RichText text={e.summary} />
        </p>
        {e.whatToWatch.length > 0 && (
          <ul className="space-y-1.5">
            {e.whatToWatch.map((w) => (
              <li key={w} className="flex gap-2 text-xs text-fg/85">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent-2" />
                <RichText text={w} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function CaseList({ title, icon, items, tone }: { title: string; icon: ReactNode; items: string[]; tone: "up" | "down" }) {
  return (
    <Panel title={title} icon={icon}>
      <ul className="space-y-2 p-4">
        {items.map((s) => (
          <li key={s} className="flex gap-2 text-sm leading-relaxed text-fg/90">
            <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", tone === "up" ? "bg-up" : "bg-down")} />
            <RichText text={s} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Levels({ label, values, cls, price }: { label: string; values: number[]; cls: string; price: number | null }) {
  if (!values.length) return null;
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className={cn("num rounded-md bg-white/[0.04] px-2 py-0.5 text-xs", cls)}>
            {fmtPrice(v)} {price ? <span className="text-muted">({fmtPct(((v - price) / price) * 100, 1)})</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function FairValueBar({ low, base, high, price }: { low: number | null; base: number | null; high: number | null; price: number | null }) {
  const vals = [low, base, high, price].filter((v): v is number => v != null);
  if (vals.length < 2 || low == null || high == null) return null;
  const min = Math.min(...vals) * 0.95;
  const max = Math.max(...vals) * 1.05;
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="pt-4">
      <div className="relative h-3 rounded-full bg-white/5">
        <div
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-amber-500/40 via-emerald-500/40 to-emerald-400/60"
          style={{ left: `${pos(low)}%`, width: `${pos(high) - pos(low)}%` }}
        />
        {base != null && <span className="absolute -top-1 h-5 w-0.5 bg-fg" style={{ left: `${pos(base)}%` }} />}
        {price != null && (
          <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos(price)}%` }}>
            <span className="block size-3.5 rounded-full border-2 border-bg bg-accent" />
            <span className="num absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-accent">now {fmtPrice(price)}</span>
          </span>
        )}
      </div>
      <div className="num mt-1.5 flex justify-between text-[11px] text-muted">
        <span>Low {fmtPrice(low)}</span>
        {base != null && <span className="text-fg">Base {fmtPrice(base)}</span>}
        <span>High {fmtPrice(high)}</span>
      </div>
    </div>
  );
}

function ConvictionMeter({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 34;
  const c = Math.PI * r;
  return (
    <div className="relative">
      <svg width={92} height={52} viewBox="0 0 92 52" aria-hidden>
        <path d={`M 12 46 A ${r} ${r} 0 0 1 80 46`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} strokeLinecap="round" />
        <path d={`M 12 46 A ${r} ${r} 0 0 1 80 46`} fill="none" stroke="url(#conv)" strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
        <defs>
          <linearGradient id="conv" x1="0" x2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="num text-base font-semibold leading-none">{Math.round(v)}</div>
        <div className="text-[10px] text-muted">conviction</div>
      </div>
    </div>
  );
}

function scoreColor(s: number) {
  if (s >= 70) return "#22c55e";
  if (s >= 55) return "#84cc16";
  if (s >= 45) return "#94a3b8";
  if (s >= 30) return "#f59e0b";
  return "#f43f5e";
}

function AnalysisLoading() {
  return (
    <Panel>
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Bot className="size-4 animate-pulse text-accent" /> Analysing fundamentals, price action, earnings and the latest headlines…
        </div>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    </Panel>
  );
}
