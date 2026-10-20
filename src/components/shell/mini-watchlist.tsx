"use client";

import Link from "next/link";
import type { Quote } from "@/lib/types";
import { useApi, useMounted } from "@/lib/hooks";
import { usePrefs } from "@/lib/store";
import { displaySymbol, fmtPrice } from "@/lib/format";
import { Change } from "@/components/ui/change";

export function MiniWatchlist() {
  const mounted = useMounted();
  const lists = usePrefs((s) => s.watchlists);
  const activeId = usePrefs((s) => s.activeWatchlist);
  const list = lists.find((l) => l.id === activeId) ?? lists[0];
  const symbols = mounted ? (list?.symbols ?? []) : [];
  const { data } = useApi<Quote[]>(symbols.length ? `/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}` : null, { refetchInterval: 30_000 });
  const by = new Map((data?.data ?? []).map((q) => [q.symbol, q]));

  if (!mounted || !list) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{list.name}</span>
        <Link href="/watchlist" className="text-[11px] text-accent hover:underline">
          Manage
        </Link>
      </div>
      {list.symbols.length === 0 && <p className="px-2 text-xs text-muted">Add symbols from any stock page.</p>}
      <ul className="space-y-px">
        {list.symbols.map((s) => {
          const q = by.get(s);
          return (
            <li key={s}>
              <Link href={`/stock/${encodeURIComponent(s)}`} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-white/[0.04]">
                <span className="truncate font-medium">{displaySymbol(s)}</span>
                <span className="flex items-center gap-2">
                  <span className="num text-muted">{fmtPrice(q?.price)}</span>
                  <Change value={q?.changePercent} className="w-14 text-right" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
