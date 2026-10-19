import type { AssetRow, DataSource } from "@/lib/types";
import type { Instrument } from "@/lib/universe";
import { cached } from "./cache";
import { liveQuotes } from "./quotes";
import { performanceFrom, yahooSparkSeries } from "./yahoo";

export async function assetRows(instruments: Instrument[], { perf = false }: { perf?: boolean } = {}): Promise<{ data: AssetRow[]; source: DataSource }> {
  const symbols = instruments.map((i) => i.symbol);
  const [{ data: quotes, source }, yearly] = await Promise.all([
    liveQuotes(symbols, { spark: true, ttl: 20 }),
    perf
      ? cached(`perf:${symbols.join(",")}`, 1800, () => yahooSparkSeries(symbols, "1y", "1d"))
          .then((r) => r.value)
          .catch(() => ({}) as Awaited<ReturnType<typeof yahooSparkSeries>>)
      : Promise.resolve({} as Awaited<ReturnType<typeof yahooSparkSeries>>),
  ]);
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  const data = instruments
    .map((inst): AssetRow | null => {
      const q = bySymbol.get(inst.symbol);
      if (!q) return null;
      return {
        ...q,
        label: inst.name,
        group: inst.group,
        unit: inst.unit,
        perf: perf ? performanceFrom(yearly[inst.symbol], q.changePercent) : undefined,
      };
    })
    .filter((r): r is AssetRow => !!r);
  return { data, source };
}
