"use client";

import { useMemo, useState } from "react";
import type { OptionChain, OptionContract } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { cn, fmtCompact, fmtDate, fmtPrice } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";

export function OptionsTab({ symbol }: { symbol: string }) {
  const [date, setDate] = useState<number | null>(null);
  const url = `/api/stock/${encodeURIComponent(symbol)}/options${date ? `?date=${date}` : ""}`;
  const { data, isLoading, error, refetch } = useApi<OptionChain>(url, { staleTime: 120_000 });
  const chain = data?.data;
  const spot = chain?.underlyingPrice ?? null;

  const rows = useMemo(() => {
    if (!chain) return [];
    const strikes = [...new Set([...chain.calls, ...chain.puts].map((c) => c.strike))].sort((a, b) => a - b);
    const near = spot ? strikes.filter((s) => Math.abs(s - spot) / spot < 0.25) : strikes;
    const list = near.length >= 6 ? near : strikes;
    return list.map((k) => ({ strike: k, call: chain.calls.find((c) => c.strike === k), put: chain.puts.find((c) => c.strike === k) }));
  }, [chain, spot]);

  const pcr = useMemo(() => {
    if (!chain) return null;
    const c = chain.calls.reduce((a, x) => a + (x.openInterest ?? 0), 0);
    const p = chain.puts.reduce((a, x) => a + (x.openInterest ?? 0), 0);
    return c ? p / c : null;
  }, [chain]);

  const atmIv = useMemo(() => {
    if (!rows.length || !spot) return null;
    const atm = rows.reduce((a, b) => (Math.abs(b.strike - spot) < Math.abs(a.strike - spot) ? b : a));
    const ivs = [atm.call?.impliedVolatility, atm.put?.impliedVolatility].filter((v): v is number => v != null && v > 0);
    return ivs.length ? ivs.reduce((a, b) => a + b, 0) / ivs.length : null;
  }, [rows, spot]);

  return (
    <Panel
      title="Options chain"
      subtitle={chain ? `Spot ${fmtPrice(spot)} · put/call OI ${pcr?.toFixed(2) ?? "—"} · ATM IV ${atmIv ? (atmIv * 100).toFixed(1) + "%" : "—"}` : "Calls and puts by strike"}
      meta={data?.meta}
      actions={
        chain && chain.expirations.length > 0 ? (
          <select value={chain.expiration ?? ""} onChange={(e) => setDate(Number(e.target.value))} className="input py-1 text-xs">
            {chain.expirations.map((d) => (
              <option key={d} value={d}>
                {fmtDate(new Date(d * 1000).toISOString(), "UTC", { month: "short", day: "numeric", year: "numeric" })}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      {isLoading && <SkeletonRows rows={10} />}
      {error && (error.message.includes("No options") ? <EmptyState title="No listed options" hint="Options data is available for US-listed stocks and ETFs." /> : <ErrorState message={error.message} onRetry={() => refetch()} />)}
      {chain && rows.length > 0 && (
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="sticky top-0 z-[1] bg-panel-2">
              <tr className="text-[10px] uppercase tracking-wide text-muted">
                <th colSpan={5} className="border-b border-line py-1.5 text-center font-semibold text-up">Calls</th>
                <th className="border-b border-line py-1.5" />
                <th colSpan={5} className="border-b border-line py-1.5 text-center font-semibold text-down">Puts</th>
              </tr>
              <tr className="text-[10px] uppercase tracking-wide text-muted">
                {["OI", "Vol", "IV", "Bid", "Ask"].map((h) => (
                  <th key={`c${h}`} className="px-2 py-1.5 text-right font-medium">{h}</th>
                ))}
                <th className="px-2 py-1.5 text-center font-semibold text-fg">Strike</th>
                {["Bid", "Ask", "IV", "Vol", "OI"].map((h) => (
                  <th key={`p${h}`} className="px-2 py-1.5 text-right font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.strike} className="table-row">
                  <Side c={r.call} cols={["openInterest", "volume", "impliedVolatility", "bid", "ask"]} itm={r.call?.inTheMoney} />
                  <td className={cn("num px-2 py-1 text-center font-semibold", spot && Math.abs(r.strike - spot) / spot < 0.01 && "text-accent")}>{fmtPrice(r.strike, { digits: 2 })}</td>
                  <Side c={r.put} cols={["bid", "ask", "impliedVolatility", "volume", "openInterest"]} itm={r.put?.inTheMoney} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

type Col = "openInterest" | "volume" | "impliedVolatility" | "bid" | "ask";

function Side({ c, cols, itm }: { c?: OptionContract; cols: Col[]; itm?: boolean }) {
  return (
    <>
      {cols.map((k) => {
        const v = c?.[k] ?? null;
        const text = v == null ? "—" : k === "impliedVolatility" ? `${(v * 100).toFixed(0)}%` : k === "bid" || k === "ask" ? fmtPrice(v, { digits: 2 }) : fmtCompact(v);
        return (
          <td key={k} className={cn("num px-2 py-1 text-right", itm && "bg-accent/[0.05]", v == null && "text-muted")}>
            {text}
          </td>
        );
      })}
    </>
  );
}
