import { connection } from "next/server";
import type { EconomicEvent, NewsItem } from "@/lib/types";
import { addDays, isoDateInTz } from "@/lib/time";
import { aiConfig } from "@/lib/server/ai";
import { assetRows } from "@/lib/server/assets";
import { marketBrief } from "@/lib/server/brief";
import { economicCalendar } from "@/lib/server/calendars";
import { serve } from "@/lib/server/respond";
import { yahooNews } from "@/lib/server/yahoo";
import { SECTOR_ETFS, WORLD_INDICES } from "@/lib/universe";

export const maxDuration = 90;

const MACRO = [
  { symbol: "^VIX", name: "VIX" },
  { symbol: "^TNX", name: "US 10Y yield" },
  { symbol: "^IRX", name: "US 3M yield" },
  { symbol: "DX-Y.NYB", name: "Dollar index" },
  { symbol: "EURUSD=X", name: "EUR/USD" },
  { symbol: "USDJPY=X", name: "USD/JPY" },
  { symbol: "CL=F", name: "WTI crude" },
  { symbol: "GC=F", name: "Gold" },
  { symbol: "HG=F", name: "Copper" },
  { symbol: "BTC-USD", name: "Bitcoin" },
];

export async function GET() {
  await connection();
  const engine = aiConfig() ? "ai" : "quant";
  return serve({
    key: `brief:${engine}`,
    ttl: engine === "ai" ? 1800 : 120,
    load: async () => {
      const today = isoDateInTz(new Date(), "America/New_York");
      const [indices, sectors, macro, events, headlines] = await Promise.all([
        assetRows(WORLD_INDICES.filter((i) => i.primary || i.symbol === "^IXIC" || i.symbol === "^STOXX50E").map((i) => ({ symbol: i.symbol, name: i.name }))),
        assetRows(SECTOR_ETFS),
        assetRows(MACRO),
        economicCalendar(today, addDays(today, 1)).then((r) => r.events).catch(() => [] as EconomicEvent[]),
        yahooNews("stock market", 15).catch(() => [] as NewsItem[]),
      ]);
      const brief = await marketBrief({ indices: indices.data, sectors: sectors.data, macro: macro.data, events, headlines });
      return { data: brief, source: brief.engine };
    },
  });
}
