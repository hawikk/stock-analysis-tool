"use client";

import type { ReactNode } from "react";
import type { AssetRow, PerfWindow } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { Panel } from "@/components/ui/panel";
import { ErrorState, SkeletonRows } from "@/components/ui/states";
import { AssetTable } from "./asset-table";

export function AssetGroupPanel({
  group,
  title,
  subtitle,
  icon,
  perf,
  className,
  limit,
  showSymbol,
  dense = true,
  spark = true,
}: {
  group: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  perf?: PerfWindow[];
  className?: string;
  limit?: number;
  showSymbol?: boolean;
  dense?: boolean;
  spark?: boolean;
}) {
  const { data, isLoading, error, refetch } = useApi<AssetRow[]>(`/api/markets/assets?group=${group}`, { refetchInterval: 30_000 });
  const rows = (data?.data ?? []).slice(0, limit);
  return (
    <Panel title={title} subtitle={subtitle} icon={icon} meta={data?.meta} className={className}>
      {isLoading && <SkeletonRows rows={Math.min(limit ?? 8, 8)} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && <AssetTable rows={rows} perf={perf} dense={dense} spark={spark} showSymbol={showSymbol} />}
    </Panel>
  );
}
