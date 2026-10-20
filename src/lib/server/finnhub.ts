import type { EarningsEvent, EarningsTiming, NewsItem, Quote } from "@/lib/types";
import { zonedTimeToUtc } from "@/lib/time";
import { httpJson } from "./http";

const BASE = "https://finnhub.io/api/v1";

export const finnhubEnabled = () => Boolean(process.env.FINNHUB_API_KEY);

function url(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, token: process.env.FINNHUB_API_KEY ?? "" });
  return `${BASE}${path}?${qs}`;
}

export async function finnhubQuotes(symbols: string[]): Promise<Quote[]> {
  // Finnhub's free tier covers US-listed symbols only; skip indices/FX/futures.
  const eligible = symbols.filter((s) => /^[A-Z.\-]+$/.test(s)).slice(0, 30);
  const results = await Promise.allSettled(
    eligible.map(async (symbol): Promise<Quote> => {
      const q = await httpJson<{ c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number }>(url("/quote", { symbol }), { plain: true });
      if (!q.c) throw new Error("no quote");
      return { symbol, name: symbol, price: q.c, change: q.d, changePercent: q.dp, dayHigh: q.h, dayLow: q.l, open: q.o, previousClose: q.pc, time: q.t };
    }),
  );
  return results.filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled").map((r) => r.value);
}

export async function finnhubNews(symbol: string): Promise<NewsItem[]> {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
  const rows = await httpJson<{ id: number; headline: string; source: string; url: string; datetime: number; image: string }[]>(url("/company-news", { symbol, from, to }), {
    plain: true,
  });
  return rows.slice(0, 25).map((n) => ({
    id: String(n.id),
    title: n.headline,
    publisher: n.source,
    url: n.url,
    publishedAt: new Date(n.datetime * 1000).toISOString(),
    thumbnail: n.image || null,
  }));
}

export async function finnhubEarnings(from: string, to: string): Promise<EarningsEvent[]> {
  const res = await httpJson<{
    earningsCalendar: { symbol: string; date: string; hour: string; epsEstimate: number | null; revenueEstimate: number | null; quarter: number; year: number }[];
  }>(url("/calendar/earnings", { from, to }), { plain: true });
  const map: Record<string, EarningsTiming> = { bmo: "bmo", amc: "amc", dmh: "dmh" };
  return res.earningsCalendar.map((e) => {
    const timing = map[e.hour] ?? "unknown";
    return {
      symbol: e.symbol,
      name: e.symbol,
      date: e.date,
      timing,
      approxTime: zonedTimeToUtc(e.date, timing === "bmo" ? "08:00" : timing === "amc" ? "16:05" : "12:00", "America/New_York").toISOString(),
      epsEstimate: e.epsEstimate,
      lastYearEps: null,
      marketCap: null,
      fiscalQuarter: `Q${e.quarter} ${e.year}`,
    };
  });
}
