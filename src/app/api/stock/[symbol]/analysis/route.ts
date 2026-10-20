import type { NextRequest } from "next/server";
import type { Candle, Financials, NewsItem } from "@/lib/types";
import { analyzeStock } from "@/lib/server/analysis";
import { aiEnabled } from "@/lib/server/ai";
import { cached, invalidate } from "@/lib/server/cache";
import { badRequest, SYMBOL_RE } from "@/lib/server/respond";
import { stockFinancials, stockProfile } from "@/lib/server/stock";
import { yahooChart, yahooNews } from "@/lib/server/yahoo";

export const maxDuration = 120;

const lastRefresh = new Map<string, number>();

export async function GET(req: NextRequest, ctx: RouteContext<"/api/stock/[symbol]/analysis">) {
  const symbol = decodeURIComponent((await ctx.params).symbol).toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return badRequest("invalid symbol");
  const key = `analysis:${aiEnabled() ? "ai" : "quant"}:${symbol}`;

  // Refreshes are rate-limited per symbol so a shared deployment can't burn through AI credits.
  if (req.nextUrl.searchParams.get("refresh") === "1" && Date.now() - (lastRefresh.get(symbol) ?? 0) > 5 * 60_000) {
    lastRefresh.set(symbol, Date.now());
    invalidate(key);
  }

  try {
    const { value } = await cached(
      key,
      (v) => (v.engine === "ai" ? 6 * 3600 : 900),
      async () => {
        const [profile, chart, bench, financials, news] = await Promise.all([
          stockProfile(symbol),
          yahooChart(symbol, "1y"),
          yahooChart("^GSPC", "1y").catch(() => ({ candles: [] as Candle[] })),
          stockFinancials(symbol).catch(() => null as Financials | null),
          yahooNews(symbol, 15).catch(() => [] as NewsItem[]),
        ]);
        return analyzeStock({ profile, candles: chart.candles, benchmark: bench.candles, financials, news });
      },
      { staleSeconds: 3600 },
    );
    return Response.json({ data: value, meta: { source: value.engine, asOf: value.generatedAt } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Could not analyse ${symbol}: ${message}` }, { status: 502 });
  }
}
