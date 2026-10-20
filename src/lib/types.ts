export type DataSource =
  | "yahoo"
  | "nasdaq"
  | "treasury"
  | "cnbc"
  | "coingecko"
  | "finnhub"
  | "fred"
  | "forexfactory"
  | "ai"
  | "quant"
  | "mock";

export type Meta = {
  source: DataSource | DataSource[];
  asOf: string;
  stale?: boolean;
  note?: string;
};

export type ApiResponse<T> = { data: T; meta: Meta };

export type MarketState = "PRE" | "REGULAR" | "POST" | "CLOSED" | "PREPRE" | "POSTPOST" | string;

export type Quote = {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose?: number | null;
  open?: number | null;
  dayHigh?: number | null;
  dayLow?: number | null;
  volume?: number | null;
  avgVolume?: number | null;
  marketCap?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  currency?: string;
  exchange?: string;
  quoteType?: string;
  marketState?: MarketState;
  preMarketPrice?: number | null;
  preMarketChangePercent?: number | null;
  postMarketPrice?: number | null;
  postMarketChangePercent?: number | null;
  trailingPE?: number | null;
  forwardPE?: number | null;
  epsTtm?: number | null;
  dividendYield?: number | null;
  earningsTimestamp?: number | null;
  time?: number | null;
  sparkline?: number[];
};

export type PerfWindow = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y";
export type Performance = Record<PerfWindow, number | null>;

export type AssetRow = Quote & { label: string; group?: string; unit?: string; perf?: Performance };

export type WorldIndexRow = AssetRow & {
  country: string;
  iso: string;
  flag: string;
  region: string;
  exchangeId: string;
  lat: number;
  lng: number;
  primary?: boolean;
};

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

export type ChartRange = "1d" | "5d" | "1mo" | "6mo" | "ytd" | "1y" | "5y" | "max";

export type ChartData = {
  symbol: string;
  range: ChartRange;
  interval: string;
  currency?: string;
  exchangeTimezone?: string;
  previousClose?: number | null;
  candles: Candle[];
};

export type SearchResult = {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
  sector?: string;
};

export type NewsItem = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  thumbnail?: string | null;
  tickers?: string[];
};

export type EarningsQuarter = {
  quarter: string;
  date?: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePercent: number | null;
};

export type FinancialPoint = { date: string; value: number };

export type Financials = {
  quarterlyRevenue: FinancialPoint[];
  quarterlyNetIncome: FinancialPoint[];
  quarterlyEps: FinancialPoint[];
  quarterlyFreeCashFlow: FinancialPoint[];
  annualRevenue: FinancialPoint[];
  annualNetIncome: FinancialPoint[];
  annualFreeCashFlow: FinancialPoint[];
};

export type StatFormat = "currency" | "compact" | "percent" | "ratio" | "number" | "date";

export type StatItem = {
  key: string;
  label: string;
  value: number | string | null;
  format: StatFormat;
  group: "Valuation" | "Growth & Profitability" | "Balance sheet" | "Dividends" | "Trading";
};

export type StockProfile = {
  symbol: string;
  name: string;
  quote: Quote;
  profile: {
    sector?: string;
    industry?: string;
    country?: string;
    city?: string;
    website?: string;
    employees?: number;
    summary?: string;
    officers?: { name: string; title: string }[];
  };
  stats: StatItem[];
  analyst: {
    targetMean: number | null;
    targetHigh: number | null;
    targetLow: number | null;
    targetMedian: number | null;
    recommendationMean: number | null;
    recommendationKey: string | null;
    analystCount: number | null;
    trend: { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }[];
  };
  earnings: {
    history: EarningsQuarter[];
    nextDate: string | null;
    nextDateIsEstimate: boolean;
    nextEpsEstimate: number | null;
    nextRevenueEstimate: number | null;
    currentYearEpsEstimate: number | null;
    nextYearEpsEstimate: number | null;
  };
};

export type EarningsTiming = "bmo" | "amc" | "dmh" | "unknown";

export type EarningsEvent = {
  symbol: string;
  name: string;
  /** Calendar date of the report in US/Eastern (YYYY-MM-DD). */
  date: string;
  timing: EarningsTiming;
  /** Best-effort instant of the release (ISO). BMO ≈ 08:00 ET, AMC ≈ 16:05 ET. */
  approxTime: string;
  epsEstimate: number | null;
  lastYearEps: number | null;
  marketCap: number | null;
  fiscalQuarter?: string;
};

export type EconomicImpact = "high" | "medium" | "low";

export type EconomicEvent = {
  id: string;
  title: string;
  country: string;
  currency?: string;
  time: string;
  allDay?: boolean;
  impact: EconomicImpact;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
  description?: string;
};

export type YieldPoint = { tenor: string; months: number; value: number | null };

export type YieldCurveData = {
  date: string;
  curve: YieldPoint[];
  comparisons: { label: string; date: string; curve: YieldPoint[] }[];
  history: { date: string; y2: number | null; y10: number | null; m3: number | null }[];
};

export type GlobalBond = {
  symbol: string;
  country: string;
  name: string;
  yield: number | null;
  change: number | null;
};

export type MacroIndicator = {
  id: string;
  label: string;
  region: "US" | "Euro Area";
  unit: string;
  value: number | null;
  previous: number | null;
  date: string | null;
  series: { date: string; value: number }[];
  description: string;
};

export type CryptoAsset = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  price: number;
  change24h: number | null;
  change7d: number | null;
  marketCap: number | null;
  volume24h: number | null;
  sparkline: number[];
};

export type HeatmapStock = {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  changePercent: number | null;
  price: number | null;
};

export type Rating = "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";

export type StockAnalysis = {
  symbol: string;
  engine: "ai" | "quant";
  model?: string;
  generatedAt: string;
  rating: Rating;
  conviction: number;
  headline: string;
  thesis: string;
  bullCase: string[];
  bearCase: string[];
  risks: { title: string; detail: string; severity: "low" | "medium" | "high" }[];
  valuation: {
    verdict: "Undervalued" | "Fairly valued" | "Overvalued";
    summary: string;
    fairValue: { low: number | null; base: number | null; high: number | null };
    keyMetrics: string[];
  };
  technicals: {
    trend: "Uptrend" | "Downtrend" | "Sideways";
    summary: string;
    support: number[];
    resistance: number[];
    momentum: string;
  };
  earnings: { summary: string; nextDate: string | null; whatToWatch: string[] };
  news: { sentiment: "Positive" | "Neutral" | "Negative" | "Mixed"; summary: string; catalysts: string[] };
  scenarios: {
    bull: { price: number | null; rationale: string };
    base: { price: number | null; rationale: string };
    bear: { price: number | null; rationale: string };
  };
  scorecard: { label: string; score: number; note: string }[];
};

export type MarketBrief = {
  engine: "ai" | "quant";
  model?: string;
  generatedAt: string;
  headline: string;
  summary: string;
  bullets: string[];
  mood: "Risk-on" | "Risk-off" | "Mixed";
  moodScore: number;
};
