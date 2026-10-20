import type { NextRequest } from "next/server";
import { badRequest, serve, SYMBOL_RE } from "@/lib/server/respond";
import { yahooOptions } from "@/lib/server/yahoo";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/stock/[symbol]/options">) {
  const symbol = decodeURIComponent((await ctx.params).symbol).toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return badRequest("invalid symbol");
  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam && /^\d{9,11}$/.test(dateParam) ? Number(dateParam) : undefined;
  return serve({
    key: `options:${symbol}:${date ?? "next"}`,
    ttl: 300,
    load: async () => ({ data: await yahooOptions(symbol, date), source: "yahoo" }),
  });
}
