"use client";

import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy";
import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { HeatmapStock } from "@/lib/types";
import { useApi, useElementSize } from "@/lib/hooks";
import { changeColor, cn, fmtCompact, fmtPct, fmtPrice } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { ErrorState, Skeleton } from "@/components/ui/states";

type Node = { name: string; children?: Node[]; stock?: HeatmapStock };

const SCALE = 3;

export function SectorTreemap({ height = 620, className, compact = false }: { height?: number; className?: string; compact?: boolean }) {
  const { data, isLoading, error, refetch } = useApi<HeatmapStock[]>("/api/markets/heatmap", { refetchInterval: 60_000 });
  const [ref, size] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<HeatmapStock | null>(null);
  const stocks = useMemo(() => data?.data ?? [], [data]);

  const sectors = useMemo(() => {
    const by = new Map<string, HeatmapStock[]>();
    for (const s of stocks) by.set(s.sector, [...(by.get(s.sector) ?? []), s]);
    return [...by.entries()]
      .map(([name, list]) => {
        const cap = list.reduce((a, s) => a + s.marketCap, 0);
        const chg = list.reduce((a, s) => a + (s.changePercent ?? 0) * s.marketCap, 0) / (cap || 1);
        return { name, cap, chg };
      })
      .sort((a, b) => b.cap - a.cap);
  }, [stocks]);

  const leaves = useMemo(() => {
    if (!size.width || !stocks.length) return { sectors: [] as HierarchyRectangularNode<Node>[], stocks: [] as HierarchyRectangularNode<Node>[] };
    const root: Node = {
      name: "S&P 500",
      children: sectors.map((sec) => ({
        name: sec.name,
        children: stocks.filter((s) => s.sector === sec.name).map((s) => ({ name: s.symbol, stock: s })),
      })),
    };
    const h = hierarchy(root)
      .sum((d) => d.stock?.marketCap ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const laid = treemap<Node>()
      .tile(treemapSquarify.ratio(1.2))
      .size([size.width, size.height])
      .paddingOuter(2)
      .paddingTop((n) => (n.depth === 1 ? 18 : 0))
      .paddingInner(1.5)
      .round(true)(h);
    return { sectors: laid.descendants().filter((n) => n.depth === 1), stocks: laid.leaves() };
  }, [size, stocks, sectors]);

  const total = sectors.reduce((a, s) => a + s.cap, 0);
  const indexChg = sectors.reduce((a, s) => a + s.chg * s.cap, 0) / (total || 1);

  return (
    <Panel
      title="S&P 500 heatmap"
      icon={<LayoutGrid className="size-4" />}
      subtitle={stocks.length ? `${stocks.length} largest constituents · size = market cap · cap-weighted ${fmtPct(indexChg)}` : "Size = market cap, colour = today's move"}
      meta={data?.meta}
      className={className}
      actions={<ColorLegend />}
    >
      {!compact && sectors.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2 scrollbar-none">
          {sectors.map((s) => (
            <span key={s.name} className="shrink-0 rounded-md px-2 py-1 text-[11px]" style={{ background: changeColor(s.chg, SCALE, 0.35) }}>
              <span className="text-fg/90">{s.name}</span> <span className="num font-semibold">{fmtPct(s.chg)}</span>
            </span>
          ))}
        </div>
      )}
      <div className="relative" style={{ height }}>
        <div ref={ref} className="absolute inset-1">
          {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
          {isLoading && <Skeleton className="h-full w-full" />}
          {leaves.sectors.map((n) => (
            <div key={n.data.name} className="pointer-events-none absolute truncate px-1 text-[10px] font-semibold uppercase tracking-wide text-muted" style={{ left: n.x0, top: n.y0 + 2, width: n.x1 - n.x0 }}>
              {n.data.name}
            </div>
          ))}
          {leaves.stocks.map((n) => {
            const s = n.data.stock as HeatmapStock;
            const w = n.x1 - n.x0;
            const h = n.y1 - n.y0;
            const big = w > 70 && h > 44;
            const show = w > 30 && h > 18;
            return (
              <Link
                key={s.symbol}
                href={`/stock/${encodeURIComponent(s.symbol)}`}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover((cur) => (cur?.symbol === s.symbol ? null : cur))}
                className="absolute flex flex-col items-center justify-center overflow-hidden rounded-[3px] text-center ring-white/60 transition-[filter] hover:z-10 hover:ring-1 hover:brightness-125"
                style={{ left: n.x0, top: n.y0, width: w, height: h, background: changeColor(s.changePercent, SCALE) }}
              >
                {show && <span className={cn("font-semibold leading-tight text-white", big ? "text-sm" : "text-[10px]")}>{s.symbol}</span>}
                {big && <span className="num text-[11px] text-white/85">{fmtPct(s.changePercent)}</span>}
              </Link>
            );
          })}
        </div>
        {hover && (
          <div className="panel pointer-events-none absolute bottom-3 right-3 z-20 w-60 p-3 text-xs shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{hover.symbol}</span>
              <span className="text-muted">{hover.sector}</span>
            </div>
            <div className="mt-0.5 truncate text-muted">{hover.name}</div>
            <div className="mt-2 flex items-end justify-between">
              <span className="num text-lg">{fmtPrice(hover.price, { currency: "USD" })}</span>
              <span className="num text-sm" style={{ color: (hover.changePercent ?? 0) >= 0 ? "var(--color-up)" : "var(--color-down)" }}>
                {fmtPct(hover.changePercent)}
              </span>
            </div>
            <div className="mt-1 text-muted">Market cap {fmtCompact(hover.marketCap, "$")}</div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function ColorLegend() {
  const stops = [-3, -2, -1, 0, 1, 2, 3];
  return (
    <div className="hidden items-center gap-px text-[10px] sm:flex">
      {stops.map((s) => (
        <span key={s} className="num w-8 py-0.5 text-center text-white/90 first:rounded-l last:rounded-r" style={{ background: changeColor(s, SCALE) }}>
          {s > 0 ? `+${s}` : s}%
        </span>
      ))}
    </div>
  );
}
