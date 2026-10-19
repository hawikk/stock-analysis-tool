import type { WorldIndexRow } from "@/lib/types";
import { assetRows } from "@/lib/server/assets";
import { serve } from "@/lib/server/respond";
import { EXCHANGES, WORLD_INDICES } from "@/lib/universe";

const exchangeFor = (symbol: string) => EXCHANGES.find((e) => e.indexSymbol === symbol)?.id ?? "";

export async function GET() {
  return serve({
    key: "markets:world",
    ttl: 30,
    load: async () => {
      const { data, source } = await assetRows(
        WORLD_INDICES.map((i) => ({ symbol: i.symbol, name: i.name })),
        { perf: true },
      );
      const by = new Map(data.map((r) => [r.symbol, r]));
      const rows: WorldIndexRow[] = WORLD_INDICES.flatMap((i) => {
        const r = by.get(i.symbol);
        return r
          ? [{ ...r, label: i.name, country: i.country, iso: i.iso, flag: i.flag, region: i.region, exchangeId: exchangeFor(i.symbol), lat: i.lat, lng: i.lng, primary: i.primary }]
          : [];
      });
      return { data: rows, source };
    },
  });
}
