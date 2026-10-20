"use client";

import { Check, ChevronDown, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Quote, StockProfile } from "@/lib/types";
import { usePriceFlash } from "@/lib/hooks";
import { usePrefs } from "@/lib/store";
import { cn, currencySymbol, displaySymbol, fmtChange, fmtCompact, fmtPct, fmtPrice } from "@/lib/format";
import { Change } from "@/components/ui/change";

const STATE_LABEL: Record<string, string> = {
  PRE: "Pre-market",
  PREPRE: "Closed",
  REGULAR: "Market open",
  POST: "After hours",
  POSTPOST: "Closed",
  CLOSED: "Closed",
};

export function StockHeader({ symbol, quote, profile }: { symbol: string; quote?: Quote; profile?: StockProfile }) {
  const flash = usePriceFlash(quote?.price);
  const cur = quote?.currency;
  const priceCurrency = quote?.quoteType === "CURRENCY" || quote?.quoteType === "INDEX" ? undefined : cur;
  const ext =
    quote?.marketState === "PRE" && quote.preMarketPrice
      ? { label: "Pre-market", price: quote.preMarketPrice, pct: quote.preMarketChangePercent }
      : (quote?.marketState === "POST" || quote?.marketState === "POSTPOST" || quote?.marketState === "CLOSED") && quote.postMarketPrice
        ? { label: "After hours", price: quote.postMarketPrice, pct: quote.postMarketChangePercent }
        : null;
  const lo = quote?.dayLow;
  const hi = quote?.dayHigh;
  const dayPos = lo != null && hi != null && quote?.price != null && hi > lo ? ((quote.price - lo) / (hi - lo)) * 100 : null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-semibold text-fg">{displaySymbol(symbol)}</span>
          {quote?.exchange && <span>{quote.exchange}</span>}
          {cur && <span>· {cur}</span>}
          {profile?.profile.sector && <span>· {profile.profile.sector}</span>}
          {profile?.profile.industry && <span className="hidden sm:inline">· {profile.profile.industry}</span>}
          {quote?.marketState && (
            <span className={cn("flex items-center gap-1", quote.marketState === "REGULAR" ? "text-up" : "text-muted")}>
              · <span className={cn("size-1.5 rounded-full", quote.marketState === "REGULAR" ? "bg-up" : "bg-slate-500")} />
              {STATE_LABEL[quote.marketState] ?? quote.marketState}
            </span>
          )}
        </div>
        <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{quote?.name ?? profile?.name ?? symbol}</h1>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
          <span className={cn("num rounded px-1 text-4xl font-semibold tracking-tight", flash === "up" && "animate-flash-up", flash === "down" && "animate-flash-down")}>
            {fmtPrice(quote?.price, { currency: priceCurrency })}
          </span>
          <span className="flex items-center gap-2 pb-1">
            <span className={cn("num text-lg", (quote?.change ?? 0) >= 0 ? "text-up" : "text-down")}>{fmtChange(quote?.change)}</span>
            <Change value={quote?.changePercent} pill className="text-sm" />
          </span>
          {ext && (
            <span className="pb-1.5 text-sm text-muted">
              {ext.label} <span className="num text-fg">{fmtPrice(ext.price, { currency: priceCurrency })}</span> <Change value={ext.pct} />
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-3">
        <WatchButton symbol={symbol} />
        <div className="grid grid-cols-3 gap-4 text-right text-xs">
          <div>
            <div className="text-muted">Day range</div>
            <div className="num">
              {fmtPrice(lo)} – {fmtPrice(hi)}
            </div>
            {dayPos != null && (
              <div className="relative mt-1 h-1 rounded-full bg-white/10">
                <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={{ left: `${dayPos}%` }} />
              </div>
            )}
          </div>
          <div>
            <div className="text-muted">Volume</div>
            <div className="num">{fmtCompact(quote?.volume)}</div>
            <div className="num text-[10px] text-muted">avg {fmtCompact(quote?.avgVolume)}</div>
          </div>
          <div>
            <div className="text-muted">Mkt cap</div>
            <div className="num">{fmtCompact(quote?.marketCap, currencySymbol(cur))}</div>
            <div className="num text-[10px] text-muted">P/E {quote?.trailingPE?.toFixed(1) ?? "—"}</div>
          </div>
        </div>
        {quote?.fiftyTwoWeekLow != null && quote.fiftyTwoWeekHigh != null && quote.price != null && (
          <div className="text-[10px] text-muted">{fmtPct(((quote.price - quote.fiftyTwoWeekHigh) / quote.fiftyTwoWeekHigh) * 100, 1)} from 52-week high</div>
        )}
      </div>
    </div>
  );
}

function WatchButton({ symbol }: { symbol: string }) {
  const lists = usePrefs((s) => s.watchlists);
  const add = usePrefs((s) => s.addToWatchlist);
  const remove = usePrefs((s) => s.removeFromWatchlist);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inAny = lists.some((l) => l.symbols.includes(symbol));

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={cn("btn-ghost text-xs", inAny && "border-accent/50 text-accent")}>
        <Star className={cn("size-3.5", inAny && "fill-accent")} />
        {inAny ? "In watchlist" : "Add to watchlist"}
        <ChevronDown className="size-3" />
      </button>
      {open && (
        <ul className="panel absolute right-0 top-full z-30 mt-1 w-56 p-1 shadow-2xl">
          {lists.map((l) => {
            const has = l.symbols.includes(symbol);
            return (
              <li key={l.id}>
                <button
                  onClick={() => (has ? remove(symbol, l.id) : add(symbol, l.id))}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/[0.06]"
                >
                  {l.name}
                  {has && <Check className="size-3.5 text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
