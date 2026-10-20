import type { Metadata } from "next";
import { BarChart3, Sparkles } from "lucide-react";
import { MoversPanel } from "@/components/market/movers";
import { PerformanceBars } from "@/components/market/performance-bars";
import { SectorTreemap } from "@/components/market/treemap";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Heatmap" };

export default function HeatmapPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Heatmap & sectors" description="Where money is moving today across US large caps, sectors and themes." />
      <SectorTreemap />
      <div className="grid gap-4 xl:grid-cols-3">
        <PerformanceBars group="sectors" title="Sector ETFs" icon={<BarChart3 className="size-4" />} />
        <PerformanceBars group="themes" title="Themes" icon={<Sparkles className="size-4" />} />
        <MoversPanel limit={12} />
      </div>
    </div>
  );
}
