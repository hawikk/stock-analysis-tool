import type { NextRequest } from "next/server";
import { serve } from "@/lib/server/respond";
import { yahooSearch } from "@/lib/server/yahoo";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (!q) return Response.json({ data: [], meta: { source: "yahoo", asOf: new Date().toISOString() } });
  return serve({
    key: `search:${q.toLowerCase()}`,
    ttl: 3600,
    load: async () => ({ data: await yahooSearch(q), source: "yahoo" }),
    fallback: () => [],
  });
}
