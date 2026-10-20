"use client";

import { Landmark } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { YieldCurveData } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { cn, fmtDate } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { ErrorState, Skeleton } from "@/components/ui/states";

const COMPARISON_COLORS = ["#a78bfa", "#f59e0b", "#64748b"];
const TOOLTIP_STYLE = { background: "#0b0f16", border: "1px solid #1b2330", borderRadius: 10, fontSize: 12 };

type SpreadKey = "2s10s" | "3m10y";

export function YieldCurvePanel({ className }: { className?: string }) {
  const { data, isLoading, error, refetch } = useApi<YieldCurveData>("/api/macro/yields", { staleTime: 600_000 });
  const [spread, setSpread] = useState<SpreadKey>("2s10s");
  const d = data?.data;

  const curveRows = useMemo(() => {
    if (!d) return [];
    return d.curve.map((p) => {
      const row: Record<string, string | number | null> = { tenor: p.tenor, Today: p.value };
      for (const c of d.comparisons) row[c.label] = c.curve.find((x) => x.tenor === p.tenor)?.value ?? null;
      return row;
    });
  }, [d]);

  const spreadRows = useMemo(
    () =>
      (d?.history ?? [])
        .map((h) => {
          const short = spread === "2s10s" ? h.y2 : h.m3;
          return { date: h.date, value: h.y10 != null && short != null ? Math.round((h.y10 - short) * 100) : null };
        })
        .filter((r) => r.value !== null),
    [d, spread],
  );

  const point = (tenor: string) => d?.curve.find((p) => p.tenor === tenor)?.value ?? null;
  const s2s10 = point("10Y") != null && point("2Y") != null ? Math.round(((point("10Y") as number) - (point("2Y") as number)) * 100) : null;
  const s3m10 = point("10Y") != null && point("3M") != null ? Math.round(((point("10Y") as number) - (point("3M") as number)) * 100) : null;

  return (
    <Panel
      title="US Treasury yield curve"
      icon={<Landmark className="size-4" />}
      subtitle={d ? `Daily par yields · ${fmtDate(d.date + "T12:00:00Z", "UTC", { month: "short", day: "numeric", year: "numeric" })}` : "Daily par yields"}
      meta={data?.meta}
      className={className}
    >
      {isLoading && <Skeleton className="m-4 h-72" />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {d && (
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[3fr_2fr]">
          <div>
            <div className="mb-2 flex flex-wrap gap-4 text-xs">
              {(["3M", "2Y", "10Y", "30Y"] as const).map((t) => (
                <div key={t}>
                  <div className="text-muted">{t}</div>
                  <div className="num text-base font-semibold">{point(t)?.toFixed(2) ?? "—"}%</div>
                </div>
              ))}
              <SpreadStat label="2s10s" bp={s2s10} />
              <SpreadStat label="3m10y" bp={s3m10} />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curveRows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="#1b2330" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="tenor" tick={{ fill: "#7d8aa0", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#1b2330" }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "#7d8aa0", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => (typeof v === "number" ? `${v.toFixed(2)}%` : String(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {d.comparisons.map((c, i) => (
                    <Line
                      key={c.label}
                      type="monotone"
                      dataKey={c.label}
                      stroke={COMPARISON_COLORS[i % COMPARISON_COLORS.length]}
                      strokeDasharray="4 3"
                      dot={false}
                      strokeWidth={1.5}
                      connectNulls
                    />
                  ))}
                  <Line type="monotone" dataKey="Today" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 2.5, fill: "#38bdf8" }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs text-muted">Spread history (bp) · below zero = inverted</div>
              <Segmented value={spread} onChange={setSpread} options={["2s10s", "3m10y"] as const} size="xs" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spreadRows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="spreadFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1b2330" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#7d8aa0", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#1b2330" }}
                    minTickGap={40}
                    tickFormatter={(v: string) => v.slice(0, 7)}
                  />
                  <YAxis tick={{ fill: "#7d8aa0", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v} bp`} />
                  <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 3" />
                  <Area type="monotone" dataKey="value" name={spread} stroke="#a78bfa" fill="url(#spreadFill)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function SpreadStat({ label, bp }: { label: string; bp: number | null }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className={cn("num text-base font-semibold", bp == null ? "" : bp < 0 ? "text-down" : "text-up")}>{bp == null ? "—" : `${bp > 0 ? "+" : ""}${bp} bp`}</div>
    </div>
  );
}
