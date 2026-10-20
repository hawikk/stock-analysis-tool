"use client";

import { useMounted, useNow } from "@/lib/hooks";
import { exchangeStatus } from "@/lib/market-hours";
import { EXCHANGES } from "@/lib/universe";
import { cn, fmtDuration } from "@/lib/format";

const KEY = ["NYSE", "XETRA", "TSE"];

export function MarketStatusPill() {
  const mounted = useMounted();
  const now = useNow(30_000);
  if (!mounted) return null;
  return (
    <div className="hidden items-center gap-3 rounded-lg border border-line px-3 py-1.5 text-[11px] md:flex">
      {KEY.map((id) => {
        const ex = EXCHANGES.find((e) => e.id === id)!;
        const s = exchangeStatus(ex, now);
        return (
          <span key={id} className="flex items-center gap-1.5" title={`${ex.name}: ${s.state === "open" ? "closes" : s.nextLabel} in ${fmtDuration(s.nextChange - now)}`}>
            <span className={cn("size-1.5 rounded-full", s.state === "open" ? "bg-up shadow-[0_0_8px] shadow-up" : s.state === "break" ? "bg-warn" : "bg-muted/50")} />
            <span className="text-muted">{ex.city === "New York" ? "NY" : ex.city === "Frankfurt" ? "EU" : "Asia"}</span>
          </span>
        );
      })}
    </div>
  );
}
