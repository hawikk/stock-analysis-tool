import type { Metadata } from "next";
import { DollarSign, Gem } from "lucide-react";
import { AssetGroupPanel } from "@/components/market/asset-group-panel";
import { CryptoPanel } from "@/components/market/crypto-table";
import { MarketTimeline } from "@/components/market/market-clock";
import { WorldGlobe } from "@/components/market/world-globe";
import { WorldIndicesPanel } from "@/components/market/world-indices";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "World markets" };

export default function MarketsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="World markets" description="Global equity benchmarks, trading sessions, currencies, commodities and crypto." />
      <WorldGlobe height={540} />
      <MarketTimeline />
      <WorldIndicesPanel />
      <div className="grid gap-4 xl:grid-cols-2">
        <AssetGroupPanel group="fx" title="Currencies" icon={<DollarSign className="size-4" />} perf={["1W", "1M", "YTD", "1Y"]} />
        <AssetGroupPanel group="commodities" title="Commodities" icon={<Gem className="size-4" />} perf={["1W", "1M", "YTD", "1Y"]} />
      </div>
      <CryptoPanel />
    </div>
  );
}
