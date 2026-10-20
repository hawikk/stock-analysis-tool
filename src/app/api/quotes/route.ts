import type { NextRequest } from "next/server";
import { badRequest, parseSymbols } from "@/lib/server/respond";
import { liveQuotes } from "@/lib/server/quotes";

export async function GET(req: NextRequest) {
  const symbols = parseSymbols(req.nextUrl.searchParams.get("symbols"));
  if (!symbols.length) return badRequest("symbols required");
  const spark = req.nextUrl.searchParams.get("spark") === "1";
  const { data, source } = await liveQuotes(symbols, { spark });
  return Response.json({ data, meta: { source, asOf: new Date().toISOString() } }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=30" } });
}
