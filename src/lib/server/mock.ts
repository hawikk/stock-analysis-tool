import type { Candle, ChartData, ChartRange, CryptoAsset, EarningsEvent, EconomicEvent, GlobalBond, NewsItem, Quote, StockProfile, YieldCurveData } from "@/lib/types";
import { addDays, dateRange, weekdayOf, zonedTimeToUtc } from "@/lib/time";
import { GLOBAL_BONDS } from "@/lib/universe";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const today = () => new Date().toISOString().slice(0, 10);

function basePrice(symbol: string) {
  if (symbol.endsWith("=X")) return 0.5 + (hash(symbol) % 150) / 100;
  if (symbol.startsWith("^")) return 1000 + (hash(symbol) % 30000);
  return 20 + (hash(symbol) % 480);
}

export function mockQuote(symbol: string): Quote {
  const r = rng(symbol + today());
  const price = basePrice(symbol) * (0.95 + r() * 0.1);
  const changePercent = (r() - 0.5) * 4;
  const prev = price / (1 + changePercent / 100);
  return {
    symbol,
    name: symbol.replace(/^\^/, ""),
    price,
    change: price - prev,
    changePercent,
    previousClose: prev,
    open: prev * (1 + (r() - 0.5) / 100),
    dayHigh: price * 1.01,
    dayLow: price * 0.99,
    volume: Math.round(r() * 5e7),
    avgVolume: Math.round(r() * 5e7),
    marketCap: Math.round(price * (1e8 + r() * 5e9)),
    fiftyTwoWeekHigh: price * 1.25,
    fiftyTwoWeekLow: price * 0.7,
    currency: "USD",
    exchange: "DEMO",
    marketState: "CLOSED",
  };
}

export function mockChart(symbol: string, range: ChartRange): ChartData {
  const r = rng(symbol + range);
  const spec: Record<ChartRange, { n: number; step: number }> = {
    "1d": { n: 195, step: 120 },
    "5d": { n: 130, step: 900 },
    "1mo": { n: 280, step: 1800 },
    "6mo": { n: 126, step: 86400 },
    ytd: { n: 200, step: 86400 },
    "1y": { n: 252, step: 86400 },
    "5y": { n: 260, step: 604800 },
    max: { n: 300, step: 2592000 },
  };
  const { n, step } = spec[range];
  const end = Math.floor(Date.now() / 1000);
  let p = basePrice(symbol);
  const vol = range === "1d" ? 0.002 : 0.015;
  const candles: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const o = p;
    p = p * (1 + (r() - 0.48) * vol * 2);
    const h = Math.max(o, p) * (1 + r() * vol);
    const l = Math.min(o, p) * (1 - r() * vol);
    candles.push({ time: end - (n - i) * step, open: o, high: h, low: l, close: p, volume: Math.round(1e6 + r() * 1e7) });
  }
  return { symbol, range, interval: "demo", currency: "USD", previousClose: candles[0]?.open ?? null, candles };
}

export function mockProfile(symbol: string): StockProfile {
  const q = mockQuote(symbol);
  return {
    symbol,
    name: q.name,
    quote: q,
    profile: { sector: "Technology", industry: "Software", country: "United States", summary: "Demo company profile. Live data is temporarily unavailable." },
    stats: [
      { key: "marketCap", label: "Market cap", value: q.marketCap ?? null, format: "compact", group: "Valuation" },
      { key: "trailingPE", label: "P/E (TTM)", value: 24.1, format: "ratio", group: "Valuation" },
      { key: "forwardPE", label: "Forward P/E", value: 21.3, format: "ratio", group: "Valuation" },
      { key: "beta", label: "Beta", value: 1.1, format: "ratio", group: "Trading" },
    ],
    analyst: {
      targetMean: (q.price ?? 0) * 1.12,
      targetHigh: (q.price ?? 0) * 1.4,
      targetLow: (q.price ?? 0) * 0.8,
      targetMedian: (q.price ?? 0) * 1.1,
      recommendationMean: 2.1,
      recommendationKey: "buy",
      analystCount: 25,
      trend: [],
    },
    earnings: {
      history: [],
      nextDate: addDays(today(), 21),
      nextDateIsEstimate: true,
      nextEpsEstimate: 1.2,
      nextRevenueEstimate: null,
      currentYearEpsEstimate: 5,
      nextYearEpsEstimate: 5.6,
    },
  };
}

export function mockNews(topic = "markets"): NewsItem[] {
  const titles = [
    "Stocks drift as investors weigh central bank signals",
    "Treasury yields edge higher ahead of key inflation data",
    "Earnings season: what to watch this week",
    "Oil steadies as supply concerns offset demand worries",
    "Dollar firms against major peers",
  ];
  return titles.map((t, i) => ({
    id: `mock-${topic}-${i}`,
    title: `${t} (demo)`,
    publisher: "Demo Wire",
    url: "#",
    publishedAt: new Date(Date.now() - i * 3600_000).toISOString(),
  }));
}

const MOCK_COMPANIES = ["AAPL", "MSFT", "NVDA", "AMZN", "META", "TSLA", "JPM", "NFLX", "INTC", "KO", "PG", "V", "UNH", "XOM", "BA"];

export function mockEarnings(from: string, to: string): EarningsEvent[] {
  const days = dateRange(from, to, 21).filter((d) => ![0, 6].includes(weekdayOf(d)));
  return days.flatMap((date) => {
    const r = rng(date);
    return MOCK_COMPANIES.filter(() => r() > 0.75).map((symbol) => {
      const timing = r() > 0.5 ? ("bmo" as const) : ("amc" as const);
      return {
        symbol,
        name: `${symbol} (demo)`,
        date,
        timing,
        approxTime: zonedTimeToUtc(date, timing === "bmo" ? "08:00" : "16:05", "America/New_York").toISOString(),
        epsEstimate: Math.round(r() * 300) / 100,
        lastYearEps: Math.round(r() * 300) / 100,
        marketCap: Math.round(1e10 + r() * 1e12),
      };
    });
  });
}

export function mockEconomic(from: string, to: string): EconomicEvent[] {
  const templates: [string, string, EconomicEvent["impact"], string][] = [
    ["CPI y/y", "United States", "high", "08:30"],
    ["Initial Jobless Claims", "United States", "medium", "08:30"],
    ["ECB Interest Rate Decision", "Euro Zone", "high", "08:15"],
    ["Manufacturing PMI", "Germany", "medium", "03:30"],
    ["Retail Sales m/m", "United Kingdom", "medium", "02:00"],
    ["BoJ Policy Rate", "Japan", "high", "23:00"],
  ];
  return dateRange(from, to, 21)
    .filter((d) => ![0, 6].includes(weekdayOf(d)))
    .flatMap((date, i) =>
      templates
        .filter((_, j) => (i + j) % 3 === 0)
        .map(([title, country, impact, t], j) => ({
          id: `mock-${date}-${j}`,
          title: `${title} (demo)`,
          country,
          time: zonedTimeToUtc(date, t, "America/New_York").toISOString(),
          impact,
          forecast: "—",
          previous: "—",
          actual: null,
        })),
    );
}

export function mockYieldCurve(): YieldCurveData {
  const tenors: [string, number, number][] = [
    ["1M", 1, 4.3],
    ["2M", 2, 4.3],
    ["3M", 3, 4.28],
    ["4M", 4, 4.25],
    ["6M", 6, 4.2],
    ["1Y", 12, 4.05],
    ["2Y", 24, 3.9],
    ["3Y", 36, 3.85],
    ["5Y", 60, 3.9],
    ["7Y", 84, 4.0],
    ["10Y", 120, 4.15],
    ["20Y", 240, 4.5],
    ["30Y", 360, 4.55],
  ];
  const curve = tenors.map(([tenor, months, value]) => ({ tenor, months, value }));
  return {
    date: today(),
    curve,
    comparisons: [{ label: "1 year ago", date: addDays(today(), -365), curve: curve.map((p) => ({ ...p, value: (p.value ?? 0) + 0.4 })) }],
    history: Array.from({ length: 120 }, (_, i) => ({ date: addDays(today(), i - 120), y2: 3.9 + Math.sin(i / 10) * 0.2, y10: 4.15 + Math.sin(i / 12) * 0.15, m3: 4.3 })),
  };
}

export function mockBonds(): GlobalBond[] {
  return GLOBAL_BONDS.map((b) => {
    const r = rng(b.symbol + today());
    return { symbol: b.symbol, country: `${b.flag} ${b.country}`, name: `${b.country} 10Y (demo)`, yield: 1 + r() * 6, change: (r() - 0.5) / 10 };
  });
}

export function mockCrypto(): CryptoAsset[] {
  return ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE"].map((s) => {
    const r = rng(s + today());
    return {
      id: s.toLowerCase(),
      symbol: s,
      name: `${s} (demo)`,
      price: basePrice(s) * 10,
      change24h: (r() - 0.5) * 8,
      change7d: (r() - 0.5) * 15,
      marketCap: r() * 1e12,
      volume24h: r() * 1e10,
      sparkline: Array.from({ length: 42 }, (_, i) => 100 + Math.sin(i / 5 + r()) * 5),
    };
  });
}
