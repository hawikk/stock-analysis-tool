"use client";

import { BarChart3, CalendarClock } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import type { FinancialPoint, Financials, StockProfile } from "@/lib/types";
import { useApi, useMounted } from "@/lib/hooks";
import { useTimeZone } from "@/lib/store";
import { currencySymbol, fmtCompact, fmtDate, fmtPct, fmtTime } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";

const TOOLTIP_STYLE = { background: "#0b0f16", border: "1px solid #1b2330", borderRadius: 10, fontSize: 12 };
const AXIS = { fill: "#7d8aa0", fontSize: 11 };

const quarterLabel = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  return `Q${Math.ceil(m / 3)} '${String(y).slice(2)}`;
};

export function FinancialsTab({ symbol, currency }: { symbol: string; currency?: string }) {
  const [period, setPeriod] = useState<"quarterly" | "annual">("quarterly");
  const { data, isLoading, error, refetch } = useApi<Financials>(`/api/stock/${encodeURIComponent(symbol)}/financials`, { staleTime: 3_600_000 });
  const f = data?.data;
  const sym = currencySymbol(currency);

  if (isLoading) return <Skeleton className="h-96" />;
  if (error)
    return (
      <Panel>
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </Panel>
    );
  if (!f) return null;

  const revenue = period === "quarterly" ? f.quarterlyRevenue : f.annualRevenue;
  const income = period === "quarterly" ? f.quarterlyNetIncome : f.annualNetIncome;
  const fcf = period === "quarterly" ? f.quarterlyFreeCashFlow : f.annualFreeCashFlow;
  const label = period === "quarterly" ? quarterLabel : (d: string) => `FY${d.slice(2, 4)}`;

  const merged = mergeSeries({ Revenue: revenue, "Net income": income, "Free cash flow": fcf }, label);
  const margins = revenue.map((r) => {
    const ni = income.find((x) => x.date === r.date)?.value;
    return { label: label(r.date), margin: ni != null && r.value ? (ni / r.value) * 100 : null };
  });
  const growth = revenue.length >= 2 ? ((revenue[revenue.length - 1].value - revenue[revenue.length - 2].value) / Math.abs(revenue[revenue.length - 2].value)) * 100 : null;

  if (!merged.length)
    return (
      <Panel>
        <EmptyState title="No financial statements available" hint="ETFs, indices, FX and crypto don't report financials." />
      </Panel>
    );

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel
        title="Revenue, earnings & cash flow"
        icon={<BarChart3 className="size-4" />}
        subtitle={growth != null ? `Latest revenue ${fmtPct(growth, 1)} vs prior ${period === "quarterly" ? "quarter" : "year"}` : undefined}
        meta={data?.meta}
        className="xl:col-span-2"
        actions={
          <Segmented
            value={period}
            onChange={setPeriod}
            size="xs"
            options={[
              { value: "quarterly", label: "Quarterly" },
              { value: "annual", label: "Annual" },
            ]}
          />
        }
      >
        <div className="h-80 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="#1b2330" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#1b2330" }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtCompact(v, sym)} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} formatter={(v) => fmtCompact(Number(v), sym)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#334155" />
              <Bar dataKey="Revenue" fill="#38bdf8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Net income" fill="#a78bfa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Free cash flow" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Net margin" subtitle="Net income ÷ revenue">
        <div className="h-80 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={margins} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#1b2330" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#1b2330" }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <ReferenceLine y={0} stroke="#334155" />
              <Bar dataKey="margin" name="Net margin" radius={[3, 3, 0, 0]}>
                {margins.map((m) => (
                  <Cell key={m.label} fill={(m.margin ?? 0) >= 0 ? "#22c55e" : "#f43f5e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

function mergeSeries(series: Record<string, FinancialPoint[]>, label: (d: string) => string) {
  const dates = [...new Set(Object.values(series).flatMap((s) => s.map((p) => p.date)))].sort();
  return dates.map((d) => {
    const row: Record<string, string | number | null> = { label: label(d) };
    for (const [k, s] of Object.entries(series)) row[k] = s.find((p) => p.date === d)?.value ?? null;
    return row;
  });
}

export function EarningsTab({ p }: { p: StockProfile }) {
  const mounted = useMounted();
  const tz = useTimeZone();
  const e = p.earnings;
  const rows = e.history.map((h) => ({ label: quarterLabel(h.quarter), Actual: h.epsActual, Estimate: h.epsEstimate, surprise: h.surprisePercent }));
  if (e.nextEpsEstimate != null && e.nextDate) rows.push({ label: "Next", Actual: null, Estimate: e.nextEpsEstimate, surprise: null });
  const beats = e.history.filter((h) => (h.surprisePercent ?? 0) > 0).length;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel title="Next report" icon={<CalendarClock className="size-4" />}>
        <div className="space-y-4 p-4">
          {e.nextDate && mounted ? (
            <div>
              <div className="text-2xl font-semibold">{fmtDate(e.nextDate, tz, { weekday: "long", month: "long", day: "numeric" })}</div>
              <div className="text-sm text-muted">{e.nextDateIsEstimate ? "Estimated date" : <>~{fmtTime(e.nextDate, tz, true)} your time</>}</div>
            </div>
          ) : (
            <div className="text-sm text-muted">{e.nextDate ? "—" : "No upcoming date announced"}</div>
          )}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="EPS estimate" value={e.nextEpsEstimate?.toFixed(2)} />
            <Stat label="Revenue estimate" value={fmtCompact(e.nextRevenueEstimate, currencySymbol(p.quote.currency))} />
            <Stat label="This FY EPS est." value={e.currentYearEpsEstimate?.toFixed(2)} />
            <Stat label="Next FY EPS est." value={e.nextYearEpsEstimate?.toFixed(2)} />
          </dl>
          {e.history.length > 0 && (
            <p className="text-xs text-muted">
              Beat estimates in {beats} of the last {e.history.length} quarters.
            </p>
          )}
        </div>
      </Panel>
      <Panel title="EPS: actual vs estimate" className="xl:col-span-2">
        {rows.length === 0 ? (
          <EmptyState title="No earnings history" />
        ) : (
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#1b2330" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#1b2330" }} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  formatter={(v, name) => [typeof v === "number" ? v.toFixed(2) : String(v), String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Estimate" fill="rgba(125,138,160,0.35)" radius={[3, 3, 0, 0]} />
                <Scatter dataKey="Actual" fill="#38bdf8" shape="circle" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        {e.history.length > 0 && (
          <div className="grid grid-cols-4 gap-px border-t border-line bg-line/60 text-center text-xs">
            {e.history.slice(-4).map((h) => (
              <div key={h.quarter} className="bg-panel py-2">
                <div className="text-muted">{quarterLabel(h.quarter)}</div>
                <div className={(h.surprisePercent ?? 0) >= 0 ? "num text-up" : "num text-down"}>{fmtPct(h.surprisePercent, 1)} surprise</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num">{value ?? "—"}</dd>
    </div>
  );
}
