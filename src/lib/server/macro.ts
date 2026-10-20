import type { CryptoAsset, GlobalBond, MacroIndicator, YieldCurveData, YieldPoint } from "@/lib/types";
import { GLOBAL_BONDS } from "@/lib/universe";
import { httpJson, httpText } from "./http";

const TENORS: { col: string[]; tenor: string; months: number }[] = [
  { col: ["1 Mo"], tenor: "1M", months: 1 },
  { col: ["2 Mo"], tenor: "2M", months: 2 },
  { col: ["3 Mo"], tenor: "3M", months: 3 },
  { col: ["4 Mo"], tenor: "4M", months: 4 },
  { col: ["6 Mo"], tenor: "6M", months: 6 },
  { col: ["1 Yr"], tenor: "1Y", months: 12 },
  { col: ["2 Yr"], tenor: "2Y", months: 24 },
  { col: ["3 Yr"], tenor: "3Y", months: 36 },
  { col: ["5 Yr"], tenor: "5Y", months: 60 },
  { col: ["7 Yr"], tenor: "7Y", months: 84 },
  { col: ["10 Yr"], tenor: "10Y", months: 120 },
  { col: ["20 Yr"], tenor: "20Y", months: 240 },
  { col: ["30 Yr"], tenor: "30Y", months: 360 },
];

type TreasuryRow = { date: string; values: Record<string, number | null> };

function parseCsvLine(line: string): string[] {
  return line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
}

async function treasuryYear(year: number): Promise<TreasuryRow[]> {
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
  const { text } = await httpText(url, { plain: true, timeoutMs: 15_000 });
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = parseCsvLine(header);
  return lines.map((line) => {
    const cells = parseCsvLine(line);
    const [mm, dd, yyyy] = cells[0].split("/");
    const values: Record<string, number | null> = {};
    for (const t of TENORS) {
      const idx = cols.findIndex((c) => t.col.includes(c));
      const v = idx >= 0 ? Number(cells[idx]) : NaN;
      values[t.tenor] = Number.isFinite(v) && cells[idx] !== "" ? v : null;
    }
    return { date: `${yyyy}-${mm}-${dd}`, values };
  });
}

const toCurve = (r: TreasuryRow): YieldPoint[] => TENORS.map((t) => ({ tenor: t.tenor, months: t.months, value: r.values[t.tenor] }));

function closestOnOrBefore(rows: TreasuryRow[], date: string): TreasuryRow | undefined {
  return rows.find((r) => r.date <= date);
}

export async function treasuryCurve(): Promise<YieldCurveData> {
  const year = new Date().getUTCFullYear();
  const [cur, prev] = await Promise.all([treasuryYear(year), treasuryYear(year - 1).catch(() => [] as TreasuryRow[])]);
  let rows = [...cur, ...prev].sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) {
    rows = (await treasuryYear(year - 1)).sort((a, b) => b.date.localeCompare(a.date));
  }
  const latest = rows[0];
  const shift = (days: number) => {
    const d = new Date(`${latest.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };
  const comparisons = [
    { label: "1 week ago", days: 7 },
    { label: "1 month ago", days: 30 },
    { label: "1 year ago", days: 365 },
  ]
    .map(({ label, days }) => {
      const row = closestOnOrBefore(rows, shift(days));
      return row ? { label, date: row.date, curve: toCurve(row) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const history = [...rows]
    .reverse()
    .map((r) => ({ date: r.date, y2: r.values["2Y"], y10: r.values["10Y"], m3: r.values["3M"] }));

  return { date: latest.date, curve: toCurve(latest), comparisons, history };
}

type CnbcQuote = { symbol: string; name: string; last?: string; change?: string; code?: number };

const pct = (s?: string): number | null => {
  if (!s) return null;
  const v = Number(s.replace(/[%+,]/g, ""));
  return Number.isFinite(v) ? v : null;
};

export async function globalBonds(): Promise<GlobalBond[]> {
  const symbols = GLOBAL_BONDS.map((b) => b.symbol).join("|");
  const res = await httpJson<{ FormattedQuoteResult: { FormattedQuote: CnbcQuote[] } }>(
    `https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=${encodeURIComponent(symbols)}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1`,
    { plain: true },
  );
  const by = new Map(res.FormattedQuoteResult.FormattedQuote.map((q) => [q.symbol, q]));
  return GLOBAL_BONDS.map((b) => {
    const q = by.get(b.symbol);
    return {
      symbol: b.symbol,
      country: `${b.flag} ${b.country}`,
      name: q?.name ?? `${b.country} 10Y`,
      yield: pct(q?.last),
      change: pct(q?.change),
    };
  }).filter((b) => b.yield !== null);
}

type GeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number | null;
  total_volume: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  sparkline_in_7d?: { price: number[] };
};

export async function cryptoMarkets(): Promise<CryptoAsset[]> {
  const key = process.env.COINGECKO_API_KEY;
  const res = await httpJson<GeckoMarket[]>(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=24&page=1&sparkline=true&price_change_percentage=24h,7d",
    { plain: true, headers: key ? { "x-cg-demo-api-key": key } : {} },
  );
  return res.map((c) => {
    const spark = c.sparkline_in_7d?.price ?? [];
    return {
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      image: c.image,
      price: c.current_price,
      change24h: c.price_change_percentage_24h_in_currency ?? null,
      change7d: c.price_change_percentage_7d_in_currency ?? null,
      marketCap: c.market_cap,
      volume24h: c.total_volume,
      sparkline: spark.filter((_, i) => i % 4 === 0),
    };
  });
}


type FredSpec = { id: string; label: string; region: MacroIndicator["region"]; unit: string; transform?: "yoy" | "diff"; description: string };

const FRED_SERIES: FredSpec[] = [
  { id: "CPIAUCSL", label: "CPI inflation", region: "US", unit: "% y/y", transform: "yoy", description: "Headline consumer prices, year over year" },
  { id: "CPILFESL", label: "Core CPI", region: "US", unit: "% y/y", transform: "yoy", description: "CPI ex food & energy, year over year" },
  { id: "PCEPILFE", label: "Core PCE", region: "US", unit: "% y/y", transform: "yoy", description: "The Fed's preferred inflation gauge" },
  { id: "UNRATE", label: "Unemployment", region: "US", unit: "%", description: "U-3 unemployment rate" },
  { id: "PAYEMS", label: "Payrolls", region: "US", unit: "k m/m", transform: "diff", description: "Monthly change in nonfarm payrolls" },
  { id: "A191RL1Q225SBEA", label: "Real GDP", region: "US", unit: "% q/q ann.", description: "Real GDP growth, seasonally adjusted annual rate" },
  { id: "DFF", label: "Fed funds", region: "US", unit: "%", description: "Effective federal funds rate" },
  { id: "T10YIE", label: "10Y breakeven", region: "US", unit: "%", description: "Market-implied 10-year inflation expectation" },
  { id: "BAMLH0A0HYM2", label: "HY credit spread", region: "US", unit: "%", description: "ICE BofA US High Yield option-adjusted spread" },
  { id: "MORTGAGE30US", label: "30Y mortgage", region: "US", unit: "%", description: "Freddie Mac 30-year fixed mortgage rate" },
  { id: "ECBDFR", label: "ECB deposit rate", region: "Euro Area", unit: "%", description: "ECB deposit facility rate" },
  { id: "CP0000EZ19M086NEST", label: "HICP inflation", region: "Euro Area", unit: "% y/y", transform: "yoy", description: "Euro area harmonised consumer prices, y/y" },
];

async function fredSeries(spec: FredSpec): Promise<MacroIndicator> {
  const start = new Date();
  start.setUTCFullYear(start.getUTCFullYear() - 4);
  const apiKey = process.env.FRED_API_KEY;
  let points: { date: string; value: number }[];
  if (apiKey) {
    const res = await httpJson<{ observations: { date: string; value: string }[] }>(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${spec.id}&api_key=${apiKey}&file_type=json&observation_start=${start.toISOString().slice(0, 10)}`,
      { plain: true },
    );
    points = res.observations.map((o) => ({ date: o.date, value: Number(o.value) })).filter((p) => Number.isFinite(p.value));
  } else {
    const { text } = await httpText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${spec.id}&cosd=${start.toISOString().slice(0, 10)}`, {
      headers: { Accept: "text/csv,*/*" },
    });
    points = text
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((l) => {
        const [date, v] = l.split(",");
        return { date, value: Number(v) };
      })
      .filter((p) => Number.isFinite(p.value));
  }
  if (spec.id === "DFF" || spec.id === "T10YIE" || spec.id === "BAMLH0A0HYM2" || spec.id === "ECBDFR") {
    points = points.filter((_, i, arr) => i % 5 === 0 || i === arr.length - 1);
  }
  let series = points;
  if (spec.transform === "yoy") {
    const byDate = new Map(points.map((p) => [p.date, p.value]));
    series = points
      .map((p) => {
        const d = new Date(`${p.date}T00:00:00Z`);
        d.setUTCFullYear(d.getUTCFullYear() - 1);
        const prev = byDate.get(d.toISOString().slice(0, 10));
        return prev ? { date: p.date, value: Math.round(((p.value / prev - 1) * 100) * 100) / 100 } : null;
      })
      .filter((x): x is { date: string; value: number } => !!x);
  } else if (spec.transform === "diff") {
    series = points.slice(1).map((p, i) => ({ date: p.date, value: Math.round(p.value - points[i].value) }));
  }
  const last = series.at(-1);
  const prev = series.at(-2);
  return {
    id: spec.id,
    label: spec.label,
    region: spec.region,
    unit: spec.unit,
    value: last?.value ?? null,
    previous: prev?.value ?? null,
    date: last?.date ?? null,
    series: series.slice(-48),
    description: spec.description,
  };
}

export async function macroIndicators(): Promise<MacroIndicator[]> {
  const results = await Promise.allSettled(FRED_SERIES.map(fredSeries));
  const ok = results.filter((r): r is PromiseFulfilledResult<MacroIndicator> => r.status === "fulfilled").map((r) => r.value);
  if (!ok.length) throw new Error("FRED unavailable");
  return ok;
}
