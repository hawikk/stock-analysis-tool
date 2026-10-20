"use client";

import { Building2, ExternalLink, Target, Users } from "lucide-react";
import { useState } from "react";
import type { StatItem, StockProfile } from "@/lib/types";
import { cn, fmtPct, fmtPrice, fmtStat } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";

const GROUPS: StatItem["group"][] = ["Valuation", "Growth & Profitability", "Balance sheet", "Dividends", "Trading"];

export function OverviewTab({ p }: { p: StockProfile }) {
  const cur = p.quote.currency;
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel title="Key statistics" className="xl:col-span-2">
        <div className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g) => {
            const items = p.stats.filter((s) => s.group === g && s.value != null);
            if (!items.length) return null;
            return (
              <div key={g}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{g}</div>
                <dl className="space-y-1">
                  {items.map((s) => (
                    <div key={s.key} className="flex items-baseline justify-between gap-2 text-sm">
                      <dt className="truncate text-muted">{s.label}</dt>
                      <dd className="num text-right">{fmtStat(s.value, s.format, cur)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      </Panel>
      <AnalystPanel p={p} />
      <AboutPanel p={p} />
    </div>
  );
}

function AnalystPanel({ p }: { p: StockProfile }) {
  const a = p.analyst;
  const price = p.quote.price;
  const cur = p.quote.currency;
  const hasTargets = a.targetLow != null && a.targetHigh != null && a.targetHigh > a.targetLow;
  const lo = hasTargets ? Math.min(a.targetLow as number, price ?? Infinity) : 0;
  const hi = hasTargets ? Math.max(a.targetHigh as number, price ?? -Infinity) : 1;
  const pos = (v: number | null) => (v == null ? 0 : ((v - lo) / (hi - lo || 1)) * 100);
  const upside = a.targetMean != null && price ? ((a.targetMean - price) / price) * 100 : null;
  const trend = a.trend[0];
  const total = trend ? trend.strongBuy + trend.buy + trend.hold + trend.sell + trend.strongSell : 0;
  const segments = trend
    ? [
        { label: "Strong buy", n: trend.strongBuy, cls: "bg-emerald-500" },
        { label: "Buy", n: trend.buy, cls: "bg-emerald-400/70" },
        { label: "Hold", n: trend.hold, cls: "bg-slate-500" },
        { label: "Sell", n: trend.sell, cls: "bg-rose-400/70" },
        { label: "Strong sell", n: trend.strongSell, cls: "bg-rose-500" },
      ]
    : [];

  return (
    <Panel title="Wall Street view" icon={<Target className="size-4" />} subtitle={a.analystCount ? `${a.analystCount} analysts` : undefined}>
      {!hasTargets && !trend ? (
        <EmptyState title="No analyst coverage" />
      ) : (
        <div className="space-y-5 p-4">
          {a.recommendationKey && (
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-muted">Consensus</div>
                <div className="text-lg font-semibold capitalize">{a.recommendationKey.replace(/_/g, " ")}</div>
              </div>
              {upside != null && (
                <div className="text-right">
                  <div className="text-xs text-muted">Mean target</div>
                  <div className="num text-lg">
                    {fmtPrice(a.targetMean, { currency: cur })} <span className={cn("text-sm", upside >= 0 ? "text-up" : "text-down")}>{fmtPct(upside, 1)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {hasTargets && (
            <div>
              <div className="relative h-2 rounded-full bg-gradient-to-r from-rose-500/40 via-slate-500/40 to-emerald-500/40">
                {a.targetMean != null && <span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-fg" style={{ left: `${pos(a.targetMean)}%` }} title="Mean target" />}
                {price != null && (
                  <span
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-accent"
                    style={{ left: `${pos(price)}%` }}
                    title="Current price"
                  />
                )}
              </div>
              <div className="num mt-1.5 flex justify-between text-[11px] text-muted">
                <span>Low {fmtPrice(a.targetLow)}</span>
                <span className="text-accent">Price {fmtPrice(price)}</span>
                <span>High {fmtPrice(a.targetHigh)}</span>
              </div>
            </div>
          )}
          {trend && total > 0 && (
            <div>
              <div className="mb-1.5 text-xs text-muted">Ratings this month</div>
              <div className="flex h-3 overflow-hidden rounded-full">
                {segments.map((s) => (s.n ? <span key={s.label} className={s.cls} style={{ width: `${(s.n / total) * 100}%` }} title={`${s.label}: ${s.n}`} /> : null))}
              </div>
              <div className="mt-2 grid grid-cols-5 text-center text-[10px] text-muted">
                {segments.map((s) => (
                  <div key={s.label}>
                    <div className="num text-sm text-fg">{s.n}</div>
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function AboutPanel({ p }: { p: StockProfile }) {
  const [more, setMore] = useState(false);
  const pr = p.profile;
  if (!pr.summary && !pr.sector) return null;
  return (
    <Panel title={`About ${p.name}`} icon={<Building2 className="size-4" />} className="xl:col-span-3">
      <div className="grid gap-6 p-4 lg:grid-cols-[2fr_1fr]">
        <div>
          {pr.summary && <p className={cn("text-sm leading-relaxed text-fg/90", !more && "line-clamp-5")}>{pr.summary}</p>}
          {pr.summary && pr.summary.length > 400 && (
            <button className="mt-1 text-xs text-accent hover:underline" onClick={() => setMore((m) => !m)}>
              {more ? "Show less" : "Read more"}
            </button>
          )}
        </div>
        <dl className="space-y-1.5 text-sm">
          {[
            ["Sector", pr.sector],
            ["Industry", pr.industry],
            ["Headquarters", [pr.city, pr.country].filter(Boolean).join(", ")],
            ["Employees", pr.employees?.toLocaleString("en-US")],
          ].map(([k, v]) =>
            v ? (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ) : null,
          )}
          {pr.website && (
            <a href={pr.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent hover:underline">
              {pr.website.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" />
            </a>
          )}
          {pr.officers && pr.officers.length > 0 && (
            <div className="pt-2">
              <div className="mb-1 flex items-center gap-1 text-xs text-muted">
                <Users className="size-3" /> Leadership
              </div>
              {pr.officers.slice(0, 4).map((o) => (
                <div key={o.name} className="text-xs">
                  <span className="text-fg">{o.name}</span> <span className="text-muted">· {o.title}</span>
                </div>
              ))}
            </div>
          )}
        </dl>
      </div>
    </Panel>
  );
}
