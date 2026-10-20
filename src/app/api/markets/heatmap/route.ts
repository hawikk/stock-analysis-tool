import { connection } from "next/server";
import type { HeatmapStock } from "@/lib/types";
import { liveQuotes } from "@/lib/server/quotes";
import { serve } from "@/lib/server/respond";
import { HEATMAP_UNIVERSE } from "@/lib/universe";

export async function GET() {
  await connection();
  return serve({
    key: "markets:heatmap",
    ttl: 60,
    load: async () => {
      const sectorOf = new Map(Object.entries(HEATMAP_UNIVERSE).flatMap(([sector, syms]) => syms.map((s) => [s, sector] as const)));
      const { data: quotes, source } = await liveQuotes([...sectorOf.keys()], { ttl: 60 });
      const data: HeatmapStock[] = quotes
        .filter((q) => q.marketCap)
        .map((q) => ({
          symbol: q.symbol,
          name: q.name,
          sector: sectorOf.get(q.symbol) ?? "Other",
          marketCap: q.marketCap as number,
          changePercent: q.changePercent,
          price: q.price,
        }));
      return { data, source };
    },
  });
}
