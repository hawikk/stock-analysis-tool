"use client";

import { Banknote } from "lucide-react";
import type { GlobalBond } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/format";
import { GLOBAL_BONDS } from "@/lib/universe";
import { Panel } from "@/components/ui/panel";
import { ErrorState, SkeletonRows } from "@/components/ui/states";

const FLAGS = new Map(GLOBAL_BONDS.map((b) => [b.symbol, b.flag]));

export function GlobalBondsPanel({ className }: { className?: string }) {
  const { data, isLoading, error, refetch } = useApi<GlobalBond[]>("/api/macro/bonds", { refetchInterval: 120_000 });
  const rows = [...(data?.data ?? [])].sort((a, b) => (b.yield ?? -99) - (a.yield ?? -99));
  const max = Math.max(1, ...rows.map((r) => r.yield ?? 0));
  return (
    <Panel title="Global 10Y yields" icon={<Banknote className="size-4" />} subtitle="Sovereign benchmarks · daily change in bp" meta={data?.meta} className={className}>
      {isLoading && <SkeletonRows rows={10} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && (
        <ul className="divide-y divide-line/60">
          {rows.map((b) => {
            const bp = b.change != null ? Math.round(b.change * 100) : null;
            return (
              <li key={b.symbol} className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,6rem)_3.5rem_3.5rem] items-center gap-2 px-4 py-1.5 text-sm">
                <span>{FLAGS.get(b.symbol)}</span>
                <span className="truncate">{b.country}</span>
                <span className="h-1.5 rounded-full bg-white/5">
                  <span className="block h-full rounded-full bg-accent/60" style={{ width: `${Math.max(2, ((b.yield ?? 0) / max) * 100)}%` }} />
                </span>
                <span className="num text-right font-medium">{b.yield?.toFixed(2) ?? "—"}%</span>
                <span className={cn("num text-right text-xs", bp == null || bp === 0 ? "text-muted" : bp > 0 ? "text-down" : "text-up")}>
                  {bp == null ? "—" : `${bp > 0 ? "+" : ""}${bp}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
