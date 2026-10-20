"use client";

import Link from "next/link";
import { useState } from "react";
import { Flame } from "lucide-react";
import type { Quote } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { fmtCompact, fmtPrice } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Change } from "@/components/ui/change";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";

type Tab = "gainers" | "losers" | "active";
type Movers = Record<Tab, Quote[]>;

export function MoversPanel({ className, limit = 10 }: { className?: string; limit?: number }) {
  const [tab, setTab] = useState<Tab>("gainers");
  const { data, isLoading, error, refetch } = useApi<Movers>("/api/markets/movers", { refetchInterval: 120_000 });
  const rows = (data?.data[tab] ?? []).slice(0, limit);
  return (
    <Panel
      title="US movers"
      icon={<Flame className="size-4" />}
      meta={data?.meta}
      className={className}
      actions={
        <Segmented
          value={tab}
          onChange={setTab}
          size="xs"
          options={[
            { value: "gainers", label: "Gainers" },
            { value: "losers", label: "Losers" },
            { value: "active", label: "Active" },
          ]}
        />
      }
    >
      {isLoading && <SkeletonRows rows={8} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && rows.length === 0 && <EmptyState title="No movers right now" hint="The screener is empty outside US trading days." />}
      {rows.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((q) => (
              <tr key={q.symbol} className="table-row">
                <td className="px-4 py-1.5">
                  <Link href={`/stock/${encodeURIComponent(q.symbol)}`} className="block hover:text-accent">
                    <span className="font-medium">{q.symbol}</span>
                    <span className="block max-w-[14rem] truncate text-[11px] text-muted">{q.name}</span>
                  </Link>
                </td>
                <td className="num hidden px-2 text-right text-xs text-muted sm:table-cell">{fmtCompact(q.volume)}</td>
                <td className="num px-2 text-right">{fmtPrice(q.price)}</td>
                <td className="px-4 text-right">
                  <Change value={q.changePercent} pill />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
