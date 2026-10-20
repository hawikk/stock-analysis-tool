import type { NextRequest } from "next/server";
import type { ChartRange } from "@/lib/types";
import { mockChart } from "@/lib/server/mock";
import { badRequest, serve, SYMBOL_RE } from "@/lib/server/respond";
import { yahooChart } from "@/lib/server/yahoo";

const RANGES: ChartRange[] = ["1d", "5d", "1mo", "6mo", "ytd", "1y", "5y", "max"];
const TTL: Record<ChartRange, number> = { "1d": 30, "5d": 120, "1mo": 300, "6mo": 900, ytd: 900, "1y": 900, "5y": 3600, max: 3600 };

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").toUpperCase();
  const range = (req.nextUrl.searchParams.get("range") ?? "1y") as ChartRange;
  if (!SYMBOL_RE.test(symbol)) return badRequest("invalid symbol");
  if (!RANGES.includes(range)) return badRequest("invalid range");
  return serve({
    key: `chart:${symbol}:${range}`,
    ttl: TTL[range],
    load: async () => ({ data: await yahooChart(symbol, range), source: "yahoo" }),
    fallback: () => mockChart(symbol, range),
  });
}
