"use client";

import { Gauge } from "lucide-react";
import type { MacroIndicator } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { cn, fmtDate } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { Sparkline } from "@/components/ui/sparkline";

function fmtValue(v: number | null, unit: string) {
  if (v == null) return "—";
  if (unit.startsWith("k")) return `${v > 0 ? "+" : ""}${Math.round(v)}K`;
  return `${v.toFixed(2)}${unit.includes("%") ? "%" : ""}`;
}

export function MacroIndicatorsPanel({ className }: { className?: string }) {
  const { data, isLoading, error, refetch } = useApi<MacroIndicator[]>("/api/macro/indicators", { staleTime: 3_600_000 });
  return (
    <Panel title="Economic dashboard" icon={<Gauge className="size-4" />} subtitle="Latest prints from FRED · 3-year trend" meta={data?.meta} className={className}>
      {isLoading && (
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && (
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.data.map((m) => {
            const delta = m.value != null && m.previous != null ? m.value - m.previous : null;
            return (
              <div key={m.id} title={m.description} className="rounded-xl border border-line bg-black/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-fg">{m.label}</div>
                    <div className="text-[10px] text-muted">
                      {m.region} · {m.unit}
                    </div>
                  </div>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted">
                    {m.date ? fmtDate(m.date + "T12:00:00Z", "UTC", { month: "short", year: "2-digit" }) : "—"}
                  </span>
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="num text-xl font-semibold">{fmtValue(m.value, m.unit)}</div>
                    <div className={cn("num text-[11px]", delta == null || delta === 0 ? "text-muted" : delta > 0 ? "text-amber-300" : "text-sky-300")}>
                      {delta == null ? "—" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(m.unit.startsWith("k") ? 0 : 2)} vs prior`}
                    </div>
                  </div>
                  <Sparkline data={m.series.slice(-36).map((p) => p.value)} width={96} height={36} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
