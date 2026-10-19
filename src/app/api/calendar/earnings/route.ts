import type { NextRequest } from "next/server";
import { addDays, isoDateInTz } from "@/lib/time";
import { nasdaqEarnings } from "@/lib/server/calendars";
import { finnhubEarnings, finnhubEnabled } from "@/lib/server/finnhub";
import { mockEarnings } from "@/lib/server/mock";
import { badRequest, serve } from "@/lib/server/respond";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const today = isoDateInTz(new Date(), "America/New_York");
  const from = req.nextUrl.searchParams.get("from") ?? today;
  const to = req.nextUrl.searchParams.get("to") ?? addDays(from, 6);
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) return badRequest("invalid range");
  return serve({
    key: `cal:earnings:${from}:${to}`,
    ttl: 1800,
    maxAge: 600,
    load: async () => {
      try {
        const data = await nasdaqEarnings(from, to);
        return { data: data.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)), source: "nasdaq" };
      } catch (err) {
        if (!finnhubEnabled()) throw err;
        return { data: await finnhubEarnings(from, to), source: "finnhub" };
      }
    },
    fallback: () => mockEarnings(from, to),
  });
}
