import type { NextRequest } from "next/server";
import { badRequest, serve, SYMBOL_RE } from "@/lib/server/respond";
import { stockFinancials } from "@/lib/server/stock";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/stock/[symbol]/financials">) {
  const symbol = decodeURIComponent((await ctx.params).symbol).toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return badRequest("invalid symbol");
  return serve({
    key: `financials:${symbol}`,
    ttl: 6 * 3600,
    load: async () => ({ data: await stockFinancials(symbol), source: "yahoo" }),
  });
}
