"use client";

import Image from "next/image";
import Link from "next/link";
import { Bitcoin } from "lucide-react";
import type { CryptoAsset } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { fmtCompact, fmtPrice } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { Change } from "@/components/ui/change";
import { Sparkline } from "@/components/ui/sparkline";
import { ErrorState, SkeletonRows } from "@/components/ui/states";

export function CryptoPanel({ className, limit = 15 }: { className?: string; limit?: number }) {
  const { data, isLoading, error, refetch } = useApi<CryptoAsset[]>("/api/macro/crypto", { refetchInterval: 60_000 });
  const rows = (data?.data ?? []).slice(0, limit);
  return (
    <Panel title="Crypto" icon={<Bitcoin className="size-4" />} subtitle="Top assets by market cap · 7-day trend" meta={data?.meta} className={className}>
      {isLoading && <SkeletonRows rows={8} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2 text-left font-medium">Asset</th>
                <th className="px-2 py-2 text-right font-medium">Price</th>
                <th className="px-2 py-2 text-right font-medium">24h</th>
                <th className="hidden px-2 py-2 text-right font-medium md:table-cell">7d</th>
                <th className="hidden px-2 py-2 text-right font-medium lg:table-cell">Mkt cap</th>
                <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">7d chart</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="px-4 py-1.5">
                    <Link href={`/stock/${encodeURIComponent(`${c.symbol.toUpperCase()}-USD`)}`} className="flex items-center gap-2 hover:text-accent">
                      {c.image ? (
                        <Image src={c.image} alt="" width={18} height={18} unoptimized className="rounded-full" />
                      ) : (
                        <span className="size-[18px] rounded-full bg-white/10" />
                      )}
                      <span className="font-medium">{c.name}</span>
                      <span className="text-[11px] uppercase text-muted">{c.symbol}</span>
                    </Link>
                  </td>
                  <td className="num px-2 text-right">{fmtPrice(c.price, { currency: "USD" })}</td>
                  <td className="px-2 text-right">
                    <Change value={c.change24h} pill />
                  </td>
                  <td className="hidden px-2 text-right text-xs md:table-cell">
                    <Change value={c.change7d} digits={1} />
                  </td>
                  <td className="num hidden px-2 text-right text-xs text-muted lg:table-cell">{fmtCompact(c.marketCap, "$")}</td>
                  <td className="hidden px-4 py-1 sm:table-cell">
                    <Sparkline data={c.sparkline} width={96} height={24} className="ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
