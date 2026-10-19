import type { NextRequest } from "next/server";
import { finnhubEnabled, finnhubNews } from "@/lib/server/finnhub";
import { mockNews } from "@/lib/server/mock";
import { badRequest, serve, SYMBOL_RE } from "@/lib/server/respond";
import { yahooNews } from "@/lib/server/yahoo";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/stock/[symbol]/news">) {
  const symbol = decodeURIComponent((await ctx.params).symbol).toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return badRequest("invalid symbol");
  return serve({
    key: `news:${symbol}`,
    ttl: 600,
    load: async () => {
      try {
        const data = await yahooNews(symbol, 25);
        if (data.length || !finnhubEnabled()) return { data, source: "yahoo" };
      } catch (err) {
        if (!finnhubEnabled()) throw err;
      }
      return { data: await finnhubNews(symbol), source: "finnhub" };
    },
    fallback: () => mockNews(symbol),
  });
}
