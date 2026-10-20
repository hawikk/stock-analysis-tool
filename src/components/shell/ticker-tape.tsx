"use client";

import Link from "next/link";
import type { AssetRow } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { fmtPrice } from "@/lib/format";
import { Change } from "@/components/ui/change";

export function TickerTape() {
  const { data } = useApi<AssetRow[]>("/api/markets/assets?group=tape", { refetchInterval: 30_000 });
  const rows = data?.data ?? [];
  if (!rows.length) return <div className="h-9 border-b border-line" />;
  const items = [...rows, ...rows];
  return (
    <div className="group relative h-9 overflow-hidden border-b border-line bg-black/30">
      <div className="flex w-max animate-marquee items-center gap-7 whitespace-nowrap px-4 py-2 group-hover:[animation-play-state:paused]">
        {items.map((r, i) => (
          <Link key={`${r.symbol}-${i}`} href={`/stock/${encodeURIComponent(r.symbol)}`} className="flex items-center gap-2 text-xs hover:text-accent">
            <span className="font-medium text-muted">{r.label}</span>
            <span className="num">{fmtPrice(r.price)}</span>
            <Change value={r.changePercent} />
          </Link>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg to-transparent" />
    </div>
  );
}
