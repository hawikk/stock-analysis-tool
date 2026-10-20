"use client";

import { Globe } from "lucide-react";
import { useMemo, useState } from "react";
import type { WorldIndexRow } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { ErrorState, SkeletonRows } from "@/components/ui/states";
import { AssetTable } from "./asset-table";

const REGIONS = ["All", "Americas", "Europe", "Asia-Pacific", "Middle East & Africa"] as const;
type RegionFilter = (typeof REGIONS)[number];

export function WorldIndicesPanel({ className }: { className?: string }) {
  const [region, setRegion] = useState<RegionFilter>("All");
  const { data, isLoading, error, refetch } = useApi<WorldIndexRow[]>("/api/markets/world", { refetchInterval: 60_000 });
  const groups = useMemo(() => {
    const rows = data?.data ?? [];
    const regions = region === "All" ? REGIONS.slice(1) : [region];
    return regions.map((r) => ({ region: r, rows: rows.filter((x) => x.region === r) })).filter((g) => g.rows.length);
  }, [data, region]);

  return (
    <Panel
      title="World indices"
      icon={<Globe className="size-4" />}
      subtitle="Local-currency performance"
      meta={data?.meta}
      className={className}
      actions={<Segmented value={region} onChange={setRegion} options={REGIONS.map((r) => ({ value: r, label: r === "Middle East & Africa" ? "MEA" : r }))} size="xs" />}
    >
      {isLoading && <SkeletonRows rows={12} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {groups.map((g) => (
        <div key={g.region}>
          <div className="sticky top-0 z-[1] border-y border-line bg-panel-2/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted backdrop-blur">{g.region}</div>
          <AssetTable
            rows={g.rows}
            perf={["1W", "1M", "YTD", "1Y"]}
            dense
            prefix={(r) => <span className="w-5 text-base leading-none">{(r as WorldIndexRow).flag}</span>}
          />
        </div>
      ))}
    </Panel>
  );
}
