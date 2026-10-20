import type { DataSource, Quote } from "@/lib/types";
import { cached } from "./cache";
import { finnhubEnabled, finnhubQuotes } from "./finnhub";
import { mockQuote } from "./mock";
import { yahooQuotes, yahooSparks } from "./yahoo";

export async function liveQuotes(symbols: string[], { spark = false, ttl = 15 }: { spark?: boolean; ttl?: number } = {}): Promise<{ data: Quote[]; source: DataSource }> {
  const key = `quotes:${[...symbols].sort().join(",")}:${spark}`;
  try {
    const { value } = await cached(key, ttl, async () => {
      const [quotes, sparks] = await Promise.all([
        yahooQuotes(symbols),
        spark
          ? cached(`spark:${[...symbols].sort().join(",")}`, 120, () => yahooSparks(symbols))
              .then((r) => r.value)
              .catch(() => ({}) as Record<string, number[]>)
          : Promise.resolve({} as Record<string, number[]>),
      ]);
      if (!quotes.length) throw new Error("Yahoo returned no quotes");
      return quotes.map((q) => ({ ...q, sparkline: sparks[q.symbol] }));
    });
    return { data: value, source: "yahoo" };
  } catch (err) {
    if (finnhubEnabled()) {
      try {
        const data = await finnhubQuotes(symbols);
        if (data.length) return { data, source: "finnhub" };
      } catch {
        // fall through to mock
      }
    }
    console.error("quotes fallback to mock:", err instanceof Error ? err.message : err);
    return { data: symbols.map(mockQuote), source: "mock" };
  }
}
