import type { NextRequest } from "next/server";
import { mockProfile } from "@/lib/server/mock";
import { badRequest, serve, SYMBOL_RE } from "@/lib/server/respond";
import { stockProfile } from "@/lib/server/stock";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/stock/[symbol]">) {
  const symbol = decodeURIComponent((await ctx.params).symbol).toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return badRequest("invalid symbol");
  return serve({
    key: `profile:${symbol}`,
    ttl: 60,
    load: async () => ({ data: await stockProfile(symbol), source: "yahoo" }),
    fallback: () => mockProfile(symbol),
  });
}
