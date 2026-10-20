import type { NextRequest } from "next/server";
import { assetRows } from "@/lib/server/assets";
import { badRequest, serve } from "@/lib/server/respond";
import { COMMODITIES, CRYPTO_FALLBACK, FX_PAIRS, HEADLINE_INDICES, RATES_QUICK, SECTOR_ETFS, THEME_ETFS, WORLD_INDICES, type Instrument } from "@/lib/universe";

const headline: Instrument[] = HEADLINE_INDICES.map((s) => ({
  symbol: s,
  name: WORLD_INDICES.find((w) => w.symbol === s)?.name ?? (s === "^VIX" ? "VIX" : s),
}));

const TAPE: Instrument[] = [
  ...headline.slice(0, 5),
  { symbol: "^TNX", name: "US 10Y" },
  { symbol: "DX-Y.NYB", name: "DXY" },
  { symbol: "EURUSD=X", name: "EUR/USD" },
  { symbol: "CL=F", name: "WTI" },
  { symbol: "GC=F", name: "Gold" },
  { symbol: "BTC-USD", name: "Bitcoin" },
  ...headline.slice(5),
];

const GROUPS: Record<string, { list: Instrument[]; perf: boolean }> = {
  fx: { list: FX_PAIRS, perf: true },
  commodities: { list: COMMODITIES, perf: true },
  rates: { list: RATES_QUICK, perf: false },
  crypto: { list: CRYPTO_FALLBACK, perf: true },
  sectors: { list: SECTOR_ETFS, perf: true },
  themes: { list: THEME_ETFS, perf: true },
  headline: { list: headline, perf: false },
  tape: { list: TAPE, perf: false },
};

export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get("group") ?? "";
  const spec = GROUPS[group];
  if (!spec) return badRequest(`unknown group; use one of ${Object.keys(GROUPS).join(", ")}`);
  return serve({
    key: `assets:${group}`,
    ttl: 20,
    load: () => assetRows(spec.list, { perf: spec.perf }),
  });
}
