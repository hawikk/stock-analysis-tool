import type { Candle, ChartData, ChartRange, FinancialPoint, NewsItem, OptionChain, OptionContract, Performance, Quote, SearchResult } from "@/lib/types";
import { HttpError, httpJson, httpText } from "./http";

const BASE = "https://query1.finance.yahoo.com";

type Session = { cookie: string; crumb: string; createdAt: number };
const globalForYahoo = globalThis as unknown as { __yahooSession?: Session; __yahooSessionPromise?: Promise<Session> };

async function readCookie(url: string): Promise<string> {
  // fc.yahoo.com answers 404 but still sets the A3 cookie the crumb endpoint requires.
  const { headers } = await httpText(url, { acceptAnyStatus: true });
  return headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function createSession(): Promise<Session> {
  const cookie = (await readCookie("https://fc.yahoo.com/")) || (await readCookie("https://finance.yahoo.com/quote/AAPL/"));
  const { text: crumb } = await httpText(`${BASE}/v1/test/getcrumb`, { headers: { cookie } });
  if (!crumb || crumb.includes("<") || crumb.length > 32) throw new Error("Yahoo crumb unavailable");
  return { cookie, crumb, createdAt: Date.now() };
}

async function session(force = false): Promise<Session> {
  const s = globalForYahoo.__yahooSession;
  if (!force && s && Date.now() - s.createdAt < 60 * 60 * 1000) return s;
  if (!globalForYahoo.__yahooSessionPromise) {
    globalForYahoo.__yahooSessionPromise = createSession()
      .then((ns) => {
        globalForYahoo.__yahooSession = ns;
        return ns;
      })
      .finally(() => {
        globalForYahoo.__yahooSessionPromise = undefined;
      });
  }
  return globalForYahoo.__yahooSessionPromise;
}

async function yget<T>(path: string, params: Record<string, string | number | undefined> = {}, needsCrumb = true): Promise<T> {
  const build = (s?: Session) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
    if (s && needsCrumb) qs.set("crumb", s.crumb);
    return `${BASE}${path}?${qs.toString()}`;
  };
  if (!needsCrumb) return httpJson<T>(build());
  let s = await session();
  try {
    return await httpJson<T>(build(s), { headers: { cookie: s.cookie } });
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
      s = await session(true);
      return httpJson<T>(build(s), { headers: { cookie: s.cookie } });
    }
    throw err;
  }
}

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && "raw" in v) return num((v as { raw: unknown }).raw);
  return null;
};

type RawQuote = Record<string, unknown> & { symbol: string };

function mapQuote(q: RawQuote): Quote {
  const s = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : undefined);
  return {
    symbol: q.symbol,
    name: s("shortName") ?? s("longName") ?? q.symbol,
    price: num(q.regularMarketPrice),
    change: num(q.regularMarketChange),
    changePercent: num(q.regularMarketChangePercent),
    previousClose: num(q.regularMarketPreviousClose),
    open: num(q.regularMarketOpen),
    dayHigh: num(q.regularMarketDayHigh),
    dayLow: num(q.regularMarketDayLow),
    volume: num(q.regularMarketVolume),
    avgVolume: num(q.averageDailyVolume3Month),
    marketCap: num(q.marketCap),
    fiftyTwoWeekHigh: num(q.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: num(q.fiftyTwoWeekLow),
    currency: s("currency"),
    exchange: s("fullExchangeName") ?? s("exchange"),
    quoteType: s("quoteType"),
    marketState: s("marketState"),
    preMarketPrice: num(q.preMarketPrice),
    preMarketChangePercent: num(q.preMarketChangePercent),
    postMarketPrice: num(q.postMarketPrice),
    postMarketChangePercent: num(q.postMarketChangePercent),
    trailingPE: num(q.trailingPE),
    forwardPE: num(q.forwardPE),
    epsTtm: num(q.epsTrailingTwelveMonths),
    dividendYield: num(q.trailingAnnualDividendYield),
    earningsTimestamp: num(q.earningsTimestamp),
    time: num(q.regularMarketTime),
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function yahooQuotes(symbols: string[]): Promise<Quote[]> {
  const unique = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))];
  const batches = await Promise.all(chunk(unique, 50).map((batch) => yget<{ quoteResponse: { result: RawQuote[] } }>("/v7/finance/quote", { symbols: batch.join(",") })));
  const bySymbol = new Map(batches.flatMap((b) => b.quoteResponse.result).map((q) => [q.symbol, mapQuote(q)]));
  return unique.map((s) => bySymbol.get(s)).filter((q): q is Quote => !!q);
}

export type SparkSeries = { timestamps: number[]; closes: number[]; previousClose: number | null };

export async function yahooSparkSeries(symbols: string[], range = "1d", interval = "15m"): Promise<Record<string, SparkSeries>> {
  const unique = [...new Set(symbols)];
  const batches = await Promise.all(
    chunk(unique, 20).map((batch) =>
      yget<Record<string, { timestamp?: number[]; close?: (number | null)[]; chartPreviousClose?: number | null }>>(
        "/v8/finance/spark",
        { symbols: batch.join(","), range, interval },
        false,
      ),
    ),
  );
  const out: Record<string, SparkSeries> = {};
  for (const b of batches) {
    for (const [sym, v] of Object.entries(b)) {
      const ts: number[] = [];
      const cs: number[] = [];
      (v.close ?? []).forEach((c, i) => {
        if (typeof c === "number" && v.timestamp?.[i]) {
          ts.push(v.timestamp[i]);
          cs.push(c);
        }
      });
      out[sym] = { timestamps: ts, closes: cs, previousClose: v.chartPreviousClose ?? null };
    }
  }
  return out;
}

export async function yahooSparks(symbols: string[], range = "1d", interval = "15m"): Promise<Record<string, number[]>> {
  const series = await yahooSparkSeries(symbols, range, interval);
  return Object.fromEntries(Object.entries(series).map(([k, v]) => [k, v.closes]));
}

export function performanceFrom(series: SparkSeries | undefined, dayChange: number | null): Performance {
  const empty: Performance = { "1D": dayChange, "1W": null, "1M": null, "3M": null, YTD: null, "1Y": null };
  if (!series || series.closes.length < 2) return empty;
  const { timestamps: ts, closes } = series;
  const lastClose = closes[closes.length - 1];
  const lastTs = ts[ts.length - 1];
  const at = (secondsAgo: number) => {
    const target = lastTs - secondsAgo;
    let idx = 0;
    for (let i = 0; i < ts.length; i++) if (ts[i] <= target) idx = i;
    return closes[idx];
  };
  const r = (base: number | undefined) => (base ? (lastClose / base - 1) * 100 : null);
  const yearStart = Date.UTC(new Date(lastTs * 1000).getUTCFullYear(), 0, 1) / 1000;
  const ytdBase = (() => {
    let idx = -1;
    for (let i = 0; i < ts.length; i++) if (ts[i] < yearStart) idx = i;
    return idx >= 0 ? closes[idx] : undefined;
  })();
  return {
    "1D": dayChange,
    "1W": r(at(7 * 86400)),
    "1M": r(at(30 * 86400)),
    "3M": r(at(91 * 86400)),
    YTD: r(ytdBase),
    "1Y": r(closes[0]),
  };
}

const RANGE_INTERVAL: Record<ChartRange, string> = {
  "1d": "2m",
  "5d": "15m",
  "1mo": "30m",
  "6mo": "1d",
  ytd: "1d",
  "1y": "1d",
  "5y": "1wk",
  max: "1mo",
};

type RawChart = {
  chart: {
    result?: {
      meta: { currency?: string; exchangeTimezoneName?: string; chartPreviousClose?: number; previousClose?: number; regularMarketPrice?: number };
      timestamp?: number[];
      indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
};

export async function yahooChart(symbol: string, range: ChartRange, intervalOverride?: string): Promise<ChartData> {
  const interval = intervalOverride ?? RANGE_INTERVAL[range];
  const raw = await yget<RawChart>(`/v8/finance/chart/${encodeURIComponent(symbol)}`, { range, interval, includePrePost: "false", events: "div,splits" }, false);
  const r = raw.chart.result?.[0];
  if (!r) throw new Error(raw.chart.error?.description ?? `No chart for ${symbol}`);
  const q = r.indicators.quote[0];
  const candles: Candle[] = [];
  (r.timestamp ?? []).forEach((t, i) => {
    const o = q.open[i],
      h = q.high[i],
      l = q.low[i],
      c = q.close[i];
    if (o == null || h == null || l == null || c == null) return;
    candles.push({ time: t, open: o, high: h, low: l, close: c, volume: q.volume[i] ?? 0 });
  });
  return {
    symbol,
    range,
    interval,
    currency: r.meta.currency,
    exchangeTimezone: r.meta.exchangeTimezoneName,
    previousClose: r.meta.chartPreviousClose ?? r.meta.previousClose ?? null,
    candles,
  };
}

type RawSearch = {
  quotes?: { symbol: string; shortname?: string; longname?: string; exchDisp?: string; typeDisp?: string; sector?: string; quoteType?: string }[];
  news?: {
    uuid: string;
    title: string;
    publisher: string;
    link: string;
    providerPublishTime: number;
    thumbnail?: { resolutions?: { url: string; width: number }[] };
    relatedTickers?: string[];
  }[];
};

export async function yahooSearch(q: string): Promise<SearchResult[]> {
  const raw = await yget<RawSearch>("/v1/finance/search", { q, quotesCount: 10, newsCount: 0, enableFuzzyQuery: "true" }, false);
  return (raw.quotes ?? [])
    .filter((x) => x.symbol && x.quoteType !== "OPTION")
    .map((x) => ({
      symbol: x.symbol,
      name: x.longname ?? x.shortname ?? x.symbol,
      exchange: x.exchDisp,
      type: x.typeDisp,
      sector: x.sector,
    }));
}

export async function yahooNews(q: string, count = 20): Promise<NewsItem[]> {
  const raw = await yget<RawSearch>("/v1/finance/search", { q, quotesCount: 0, newsCount: count }, false);
  return (raw.news ?? []).map((n) => ({
    id: n.uuid,
    title: n.title,
    publisher: n.publisher,
    url: n.link,
    publishedAt: new Date(n.providerPublishTime * 1000).toISOString(),
    thumbnail: n.thumbnail?.resolutions?.sort((a, b) => a.width - b.width).find((r) => r.width >= 100)?.url ?? null,
    tickers: n.relatedTickers,
  }));
}

export type QuoteSummary = Record<string, Record<string, unknown> | undefined>;

export async function yahooQuoteSummary(symbol: string, modules: string[]): Promise<QuoteSummary> {
  const raw = await yget<{ quoteSummary: { result?: QuoteSummary[]; error?: { description?: string } } }>(`/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`, {
    modules: modules.join(","),
    formatted: "false",
  });
  const r = raw.quoteSummary.result?.[0];
  if (!r) throw new Error(raw.quoteSummary.error?.description ?? `No summary for ${symbol}`);
  return r;
}

export async function yahooTimeseries(symbol: string, types: string[]): Promise<Record<string, FinancialPoint[]>> {
  const now = Math.floor(Date.now() / 1000);
  const raw = await yget<{ timeseries: { result?: (Record<string, unknown> & { meta: { type: string[] } })[] } }>(
    `/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`,
    { type: types.join(","), period1: now - 6 * 365 * 86400, period2: now + 86400, merge: "false" },
    false,
  );
  const out: Record<string, FinancialPoint[]> = {};
  for (const r of raw.timeseries.result ?? []) {
    const type = r.meta.type[0];
    const rows = (r[type] as ({ asOfDate: string; reportedValue?: { raw: number } } | null)[] | undefined) ?? [];
    out[type] = rows.filter((x): x is { asOfDate: string; reportedValue: { raw: number } } => !!x?.reportedValue).map((x) => ({ date: x.asOfDate, value: x.reportedValue.raw }));
  }
  return out;
}

export async function yahooScreener(scrId: "day_gainers" | "day_losers" | "most_actives", count = 15): Promise<Quote[]> {
  const raw = await yget<{ finance: { result?: { quotes: RawQuote[] }[] } }>("/v1/finance/screener/predefined/saved", {
    scrIds: scrId,
    count,
  });
  return (raw.finance.result?.[0]?.quotes ?? []).map(mapQuote);
}

export async function yahooOptions(symbol: string, date?: number): Promise<OptionChain> {
  const raw = await yget<{
    optionChain: {
      result?: {
        expirationDates: number[];
        quote?: { regularMarketPrice?: number };
        options: { expirationDate: number; calls: Record<string, unknown>[]; puts: Record<string, unknown>[] }[];
      }[];
    };
  }>(`/v7/finance/options/${encodeURIComponent(symbol)}`, { date });
  const r = raw.optionChain.result?.[0];
  if (!r) throw new Error(`No options for ${symbol}`);
  const mapC = (c: Record<string, unknown>): OptionContract => ({
    contractSymbol: String(c.contractSymbol),
    strike: num(c.strike) ?? 0,
    lastPrice: num(c.lastPrice),
    bid: num(c.bid),
    ask: num(c.ask),
    change: num(c.percentChange),
    volume: num(c.volume),
    openInterest: num(c.openInterest),
    impliedVolatility: num(c.impliedVolatility),
    inTheMoney: Boolean(c.inTheMoney),
  });
  const o = r.options[0];
  return {
    symbol,
    underlyingPrice: num(r.quote?.regularMarketPrice),
    expirations: r.expirationDates,
    expiration: o?.expirationDate ?? null,
    calls: (o?.calls ?? []).map(mapC),
    puts: (o?.puts ?? []).map(mapC),
  };
}

export { num as yNum };
