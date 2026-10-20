import type { Metadata } from "next";
import { Gem, Landmark } from "lucide-react";
import { AssetGroupPanel } from "@/components/market/asset-group-panel";
import { GlobalBondsPanel } from "@/components/market/global-bonds";
import { MacroIndicatorsPanel } from "@/components/market/macro-indicators";
import { NewsPanel } from "@/components/market/news-list";
import { PerformanceBars } from "@/components/market/performance-bars";
import { UpcomingEvents } from "@/components/market/upcoming-events";
import { YieldCurvePanel } from "@/components/market/yield-curve";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Macro" };

export default function MacroPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Macro" description="Rates, inflation, growth, credit and the cross-asset backdrop." />
      <YieldCurvePanel />
      <MacroIndicatorsPanel />
      <div className="grid gap-4 xl:grid-cols-3">
        <GlobalBondsPanel />
        <AssetGroupPanel group="rates" title="US rates & volatility" icon={<Landmark className="size-4" />} spark={false} showSymbol />
        <PerformanceBars group="commodities" title="Commodities" icon={<Gem className="size-4" />} defaultWindow="1M" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <UpcomingEvents limit={12} />
        <NewsPanel url="/api/news?topic=macro" title="Macro headlines" limit={10} />
      </div>
    </div>
  );
}
