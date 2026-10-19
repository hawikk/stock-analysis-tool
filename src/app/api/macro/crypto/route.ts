import type { CryptoAsset } from "@/lib/types";
import { assetRows } from "@/lib/server/assets";
import { cryptoMarkets } from "@/lib/server/macro";
import { mockCrypto } from "@/lib/server/mock";
import { serve } from "@/lib/server/respond";
import { CRYPTO_FALLBACK } from "@/lib/universe";

export async function GET() {
  return serve({
    key: "macro:crypto",
    ttl: 60,
    load: async () => {
      try {
        return { data: await cryptoMarkets(), source: "coingecko" };
      } catch {
        const { data, source } = await assetRows(CRYPTO_FALLBACK, { perf: true });
        const assets: CryptoAsset[] = data.map((r) => ({
          id: r.symbol,
          symbol: r.symbol.replace("-USD", ""),
          name: r.label,
          price: r.price ?? 0,
          change24h: r.changePercent,
          change7d: r.perf?.["1W"] ?? null,
          marketCap: r.marketCap ?? null,
          volume24h: r.volume ?? null,
          sparkline: r.sparkline ?? [],
        }));
        return { data: assets, source };
      }
    },
    fallback: mockCrypto,
  });
}
