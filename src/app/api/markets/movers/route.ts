import { serve } from "@/lib/server/respond";
import { yahooScreener } from "@/lib/server/yahoo";

export async function GET() {
  return serve({
    key: "markets:movers",
    ttl: 120,
    load: async () => {
      const [gainers, losers, active] = await Promise.all([
        yahooScreener("day_gainers", 12),
        yahooScreener("day_losers", 12),
        yahooScreener("most_actives", 12),
      ]);
      return { data: { gainers, losers, active }, source: "yahoo" };
    },
    fallback: () => ({ gainers: [], losers: [], active: [] }),
  });
}
