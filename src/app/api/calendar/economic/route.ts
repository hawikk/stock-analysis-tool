import type { NextRequest } from "next/server";
import { addDays, isoDateInTz } from "@/lib/time";
import { economicCalendar } from "@/lib/server/calendars";
import { mockEconomic } from "@/lib/server/mock";
import { badRequest, serve } from "@/lib/server/respond";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const today = isoDateInTz(new Date(), "America/New_York");
  const from = req.nextUrl.searchParams.get("from") ?? today;
  const to = req.nextUrl.searchParams.get("to") ?? addDays(from, 6);
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) return badRequest("invalid range");
  return serve({
    key: `cal:econ:${from}:${to}`,
    ttl: 900,
    maxAge: 300,
    load: async () => {
      const { events, sources } = await economicCalendar(from, to);
      return { data: events, source: sources };
    },
    fallback: () => mockEconomic(from, to),
  });
}
