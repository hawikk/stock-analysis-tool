"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { AssetRow, PerfWindow } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { cn, fmtPct } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { ErrorState, SkeletonRows } from "@/components/ui/states";

const WINDOWS: PerfWindow[] = ["1D", "1W", "1M", "3M", "YTD", "1Y"];

export function valueFor(r: AssetRow, w: PerfWindow) {
  return (w === "1D" ? r.changePercent : r.perf?.[w]) ?? null;
}

/** Diverging horizontal bars ranking an asset group over a selectable window. */
export function PerformanceBars({
  group,
  title,
  subtitle,
  icon,
  className,
  defaultWindow = "1D",
}: {
  group: "sectors" | "themes" | "commodities" | "fx" | "crypto";
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
  defaultWindow?: PerfWindow;
}) {
  const [win, setWin] = useState<PerfWindow>(defaultWindow);
  const { data, isLoading, error, refetch } = useApi<AssetRow[]>(`/api/markets/assets?group=${group}`, { refetchInterval: 60_000 });

  const rows = useMemo(
    () =>
      (data?.data ?? [])
        .map((r) => ({ r, v: valueFor(r, win) }))
        .filter((x) => x.v !== null)
        .sort((a, b) => (b.v ?? 0) - (a.v ?? 0)),
    [data, win],
  );
  const maxAbs = Math.max(0.5, ...rows.map((x) => Math.abs(x.v ?? 0)));

  return (
    <Panel title={title} subtitle={subtitle} icon={icon} meta={data?.meta} className={className} actions={<Segmented value={win} onChange={setWin} options={WINDOWS} size="xs" />}>
      {isLoading && <SkeletonRows rows={8} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {!isLoading && !error && (
        <ul className="space-y-1.5 p-4">
          {rows.map(({ r, v }) => {
            const w = (Math.abs(v ?? 0) / maxAbs) * 50;
            const up = (v ?? 0) >= 0;
            return (
              <li key={r.symbol}>
                <Link href={`/stock/${encodeURIComponent(r.symbol)}`} className="group grid grid-cols-[minmax(0,9rem)_1fr_4rem] items-center gap-3 text-xs">
                  <span className="truncate text-fg group-hover:text-accent">{r.label}</span>
                  <span className="relative h-5 rounded bg-white/[0.03]">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                    <span
                      className={cn("absolute inset-y-0.5 rounded-sm transition-all duration-500", up ? "bg-up/70" : "bg-down/70")}
                      style={up ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
                    />
                  </span>
                  <span className={cn("num text-right", up ? "text-up" : "text-down")}>{fmtPct(v, win === "1D" ? 2 : 1)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
