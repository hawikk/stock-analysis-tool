import { Activity, BarChart3, DollarSign, Gem, Landmark } from "lucide-react";
import { AssetGroupPanel } from "@/components/market/asset-group-panel";
import { BriefCard } from "@/components/market/brief-card";
import { MarketClockList } from "@/components/market/market-clock";
import { MoversPanel } from "@/components/market/movers";
import { NewsFeed } from "@/components/market/news-list";
import { PerformanceBars } from "@/components/market/performance-bars";
import { SectorTreemap } from "@/components/market/treemap";
import { UpcomingEvents } from "@/components/market/upcoming-events";
import { WorldGlobe } from "@/components/market/world-globe";

export default function OverviewPage() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <WorldGlobe />
      </div>
      <div className="xl:col-span-4">
        <BriefCard />
      </div>

      <AssetGroupPanel group="headline" title="Key indices" icon={<Activity className="size-4" />} className="xl:col-span-4" />
      <AssetGroupPanel group="rates" title="Rates & volatility" icon={<Landmark className="size-4" />} className="xl:col-span-4" spark={false} />
      <UpcomingEvents className="xl:col-span-4" limit={8} />

      <SectorTreemap height={420} compact className="xl:col-span-8" />
      <PerformanceBars group="sectors" title="US sectors" icon={<BarChart3 className="size-4" />} className="xl:col-span-4" />

      <AssetGroupPanel group="fx" title="Currencies" icon={<DollarSign className="size-4" />} perf={["1W", "1M"]} limit={8} className="xl:col-span-4" />
      <AssetGroupPanel group="commodities" title="Commodities" icon={<Gem className="size-4" />} perf={["1W", "1M"]} limit={8} className="xl:col-span-4" />
      <MoversPanel className="xl:col-span-4" limit={8} />

      <NewsFeed className="xl:col-span-8" limit={10} />
      <MarketClockList className="xl:col-span-4" />
    </div>
  );
}
