"use client";

import Link from "next/link";
import type { AssetRow, PerfWindow } from "@/lib/types";
import { cn, displaySymbol, fmtPrice } from "@/lib/format";
import { usePriceFlash } from "@/lib/hooks";
import { Change } from "@/components/ui/change";
import { Sparkline } from "@/components/ui/sparkline";

export function AssetTable({
  rows,
  perf,
  showSymbol = false,
  dense = false,
  spark = true,
  prefix,
}: {
  rows: AssetRow[];
  perf?: PerfWindow[];
  showSymbol?: boolean;
  dense?: boolean;
  spark?: boolean;
  prefix?: (r: AssetRow) => React.ReactNode;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-muted">
          <th className="px-4 py-2 text-left font-medium">Name</th>
          <th className="px-2 py-2 text-right font-medium">Last</th>
          <th className="px-2 py-2 text-right font-medium">Chg</th>
          {perf?.map((p) => (
            <th key={p} className="hidden px-2 py-2 text-right font-medium md:table-cell">
              {p}
            </th>
          ))}
          {spark && <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Today</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Row key={r.symbol} r={r} perf={perf} showSymbol={showSymbol} dense={dense} spark={spark} prefix={prefix} />
        ))}
      </tbody>
    </table>
  );
}

function Row({ r, perf, showSymbol, dense, spark, prefix }: { r: AssetRow; perf?: PerfWindow[]; showSymbol: boolean; dense: boolean; spark: boolean; prefix?: (r: AssetRow) => React.ReactNode }) {
  const flash = usePriceFlash(r.price);
  const href = `/stock/${encodeURIComponent(r.symbol)}`;
  return (
    <tr className="table-row">
      <td className={cn("px-4", dense ? "py-1.5" : "py-2")}>
        <Link href={href} className="flex min-w-0 items-center gap-2 hover:text-accent">
          {prefix?.(r)}
          <span className="min-w-0">
            <span className="block truncate font-medium">{r.label}</span>
            {showSymbol && <span className="block text-[11px] text-muted">{displaySymbol(r.symbol)}</span>}
          </span>
        </Link>
      </td>
      <td className={cn("num px-2 text-right", flash === "up" && "animate-flash-up", flash === "down" && "animate-flash-down")}>
        {fmtPrice(r.price)}
        {r.unit && <span className="ml-1 hidden text-[10px] text-muted xl:inline">{r.unit}</span>}
      </td>
      <td className="px-2 text-right">
        <Change value={r.changePercent} pill />
      </td>
      {perf?.map((p) => (
        <td key={p} className="hidden px-2 text-right text-xs md:table-cell">
          <Change value={r.perf?.[p]} digits={1} />
        </td>
      ))}
      {spark && (
        <td className="hidden px-4 py-1 text-right sm:table-cell">
          <Sparkline data={r.sparkline} baseline={r.previousClose} width={84} height={24} className="ml-auto" />
        </td>
      )}
    </tr>
  );
}
