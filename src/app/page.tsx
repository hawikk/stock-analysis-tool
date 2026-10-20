import { Activity, BarChart3, DollarSign, Gem, Landmark } from "lucide-react";
import { BriefCard } from "@/components/market/brief-card";
import { AssetGroupPanel } from "@/components/market/asset-group-panel";
import { MarketClockList } from "@/components/market/market-clock";
import { PerformanceBars } from "@/components/market/performance-bars";
import { WorldGlobe } from "@/components/market/world-globe";

export default function OverviewPage() {
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <WorldGlobe />
      </div>
      <div className="xl:col-span-4">
        <BriefCard />
      </div>
      <AssetGroupPanel group="headline" title="Key indices" icon={<Activity className="size-4" />} className="xl:col-span-6" />
      <PerformanceBars group="sectors" title="US sectors" icon={<BarChart3 className="size-4" />} className="xl:col-span-6" />
      <AssetGroupPanel group="rates" title="Rates & volatility" icon={<Landmark className="size-4" />} className="xl:col-span-4" spark={false} />
      <AssetGroupPanel group="fx" title="Currencies" icon={<DollarSign className="size-4" />} perf={["1W", "1M"]} limit={8} className="xl:col-span-4" />
      <AssetGroupPanel group="commodities" title="Commodities" icon={<Gem className="size-4" />} perf={["1W", "1M"]} limit={8} className="xl:col-span-4" />
      <MarketClockList className="xl:col-span-12" />
    </div>
  );
}
