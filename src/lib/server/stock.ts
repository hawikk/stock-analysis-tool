import type { Financials, StatItem, StockProfile } from "@/lib/types";
import { yahooQuoteSummary, yahooQuotes, yahooTimeseries, yNum, type QuoteSummary } from "./yahoo";
import { NotFoundError } from "./respond";

const MODULES = ["price", "summaryDetail", "defaultKeyStatistics", "financialData", "assetProfile", "calendarEvents", "earningsHistory", "earningsTrend", "recommendationTrend"];

type Obj = Record<string, unknown>;
const get = (o: Obj | undefined, k: string) => yNum(o?.[k]);

function stat(key: string, label: string, value: number | string | null, format: StatItem["format"], group: StatItem["group"]): StatItem {
  return { key, label, value, format, group };
}

export async function stockProfile(symbol: string): Promise<StockProfile> {
  const [quotes, summary] = await Promise.all([yahooQuotes([symbol]), yahooQuoteSummary(symbol, MODULES).catch(() => ({}) as QuoteSummary)]);
  const quote = quotes[0];
  if (!quote || quote.price == null) throw new NotFoundError(`No market data found for ${symbol}`);

  const sd = summary.summaryDetail as Obj | undefined;
  const ks = summary.defaultKeyStatistics as Obj | undefined;
  const fd = summary.financialData as Obj | undefined;
  const ap = summary.assetProfile as Obj | undefined;
  const ce = (summary.calendarEvents as Obj | undefined)?.earnings as Obj | undefined;
  const eh = ((summary.earningsHistory as Obj | undefined)?.history as Obj[] | undefined) ?? [];
  const et = ((summary.earningsTrend as Obj | undefined)?.trend as Obj[] | undefined) ?? [];
  const rt = ((summary.recommendationTrend as Obj | undefined)?.trend as Obj[] | undefined) ?? [];

  const marketCap = quote.marketCap ?? get(sd, "marketCap");
  const fcf = get(fd, "freeCashflow");

  const stats: StatItem[] = [
    stat("marketCap", "Market cap", marketCap, "compact", "Valuation"),
    stat("enterpriseValue", "Enterprise value", get(ks, "enterpriseValue"), "compact", "Valuation"),
    stat("trailingPE", "P/E (TTM)", get(sd, "trailingPE") ?? quote.trailingPE ?? null, "ratio", "Valuation"),
    stat("forwardPE", "Forward P/E", get(ks, "forwardPE") ?? quote.forwardPE ?? null, "ratio", "Valuation"),
    stat("pegRatio", "PEG", get(ks, "pegRatio"), "ratio", "Valuation"),
    stat("priceToSales", "P/S (TTM)", get(sd, "priceToSalesTrailing12Months"), "ratio", "Valuation"),
    stat("priceToBook", "P/B", get(ks, "priceToBook"), "ratio", "Valuation"),
    stat("evToEbitda", "EV/EBITDA", get(ks, "enterpriseToEbitda"), "ratio", "Valuation"),
    stat("evToRevenue", "EV/Revenue", get(ks, "enterpriseToRevenue"), "ratio", "Valuation"),
    stat("fcfYield", "FCF yield", fcf && marketCap ? fcf / marketCap : null, "percent", "Valuation"),
    stat("trailingEps", "EPS (TTM)", get(ks, "trailingEps") ?? quote.epsTtm ?? null, "currency", "Valuation"),
    stat("forwardEps", "Forward EPS", get(ks, "forwardEps"), "currency", "Valuation"),

    stat("totalRevenue", "Revenue (TTM)", get(fd, "totalRevenue"), "compact", "Growth & Profitability"),
    stat("revenueGrowth", "Revenue growth (y/y)", get(fd, "revenueGrowth"), "percent", "Growth & Profitability"),
    stat("earningsGrowth", "Earnings growth (y/y)", get(fd, "earningsGrowth"), "percent", "Growth & Profitability"),
    stat("grossMargins", "Gross margin", get(fd, "grossMargins"), "percent", "Growth & Profitability"),
    stat("operatingMargins", "Operating margin", get(fd, "operatingMargins"), "percent", "Growth & Profitability"),
    stat("profitMargins", "Net margin", get(fd, "profitMargins"), "percent", "Growth & Profitability"),
    stat("returnOnEquity", "ROE", get(fd, "returnOnEquity"), "percent", "Growth & Profitability"),
    stat("returnOnAssets", "ROA", get(fd, "returnOnAssets"), "percent", "Growth & Profitability"),
    stat("freeCashflow", "Free cash flow", fcf, "compact", "Growth & Profitability"),
    stat("ebitda", "EBITDA", get(fd, "ebitda"), "compact", "Growth & Profitability"),

    stat("totalCash", "Total cash", get(fd, "totalCash"), "compact", "Balance sheet"),
    stat("totalDebt", "Total debt", get(fd, "totalDebt"), "compact", "Balance sheet"),
    stat("debtToEquity", "Debt/Equity", get(fd, "debtToEquity") !== null ? (get(fd, "debtToEquity") as number) / 100 : null, "ratio", "Balance sheet"),
    stat("currentRatio", "Current ratio", get(fd, "currentRatio"), "ratio", "Balance sheet"),
    stat("bookValue", "Book value / share", get(ks, "bookValue"), "currency", "Balance sheet"),

    stat("dividendYield", "Dividend yield", get(sd, "dividendYield") ?? null, "percent", "Dividends"),
    stat("dividendRate", "Dividend / share", get(sd, "dividendRate"), "currency", "Dividends"),
    stat("payoutRatio", "Payout ratio", get(sd, "payoutRatio"), "percent", "Dividends"),
    stat("exDividendDate", "Ex-dividend date", get(sd, "exDividendDate") ? new Date((get(sd, "exDividendDate") as number) * 1000).toISOString() : null, "date", "Dividends"),

    stat("beta", "Beta", get(sd, "beta") ?? get(ks, "beta"), "ratio", "Trading"),
    stat("fiftyDayAverage", "50-day avg", get(sd, "fiftyDayAverage"), "currency", "Trading"),
    stat("twoHundredDayAverage", "200-day avg", get(sd, "twoHundredDayAverage"), "currency", "Trading"),
    stat("52WeekChange", "52-week change", get(ks, "52WeekChange"), "percent", "Trading"),
    stat("averageVolume", "Avg volume (3M)", get(sd, "averageVolume") ?? quote.avgVolume ?? null, "compact", "Trading"),
    stat("sharesOutstanding", "Shares outstanding", get(ks, "sharesOutstanding"), "compact", "Trading"),
    stat("shortPercentOfFloat", "Short % of float", get(ks, "shortPercentOfFloat"), "percent", "Trading"),
    stat("shortRatio", "Short ratio (days)", get(ks, "shortRatio"), "ratio", "Trading"),
    stat("heldPercentInsiders", "Insider ownership", get(ks, "heldPercentInsiders"), "percent", "Trading"),
    stat("heldPercentInstitutions", "Institutional ownership", get(ks, "heldPercentInstitutions"), "percent", "Trading"),
  ].filter((s) => s.value !== null && s.value !== undefined);

  const trendFor = (p: string) => et.find((t) => t.period === p);
  const nextTs = (ce?.earningsDate as unknown[] | undefined)?.map(yNum).find((x): x is number => x !== null);

  return {
    symbol,
    name: ((summary.price as Obj | undefined)?.longName as string | undefined) ?? quote.name,
    quote,
    profile: {
      sector: (ap?.sectorDisp as string | undefined) ?? (ap?.sector as string | undefined),
      industry: (ap?.industryDisp as string | undefined) ?? (ap?.industry as string | undefined),
      country: ap?.country as string | undefined,
      city: ap?.city as string | undefined,
      website: ap?.website as string | undefined,
      employees: (ap?.fullTimeEmployees as number | undefined) ?? undefined,
      summary: ap?.longBusinessSummary as string | undefined,
      officers: ((ap?.companyOfficers as Obj[] | undefined) ?? []).slice(0, 6).map((o) => ({ name: String(o.name), title: String(o.title) })),
    },
    stats,
    analyst: {
      targetMean: get(fd, "targetMeanPrice"),
      targetHigh: get(fd, "targetHighPrice"),
      targetLow: get(fd, "targetLowPrice"),
      targetMedian: get(fd, "targetMedianPrice"),
      recommendationMean: get(fd, "recommendationMean"),
      recommendationKey: (fd?.recommendationKey as string | undefined) ?? null,
      analystCount: get(fd, "numberOfAnalystOpinions"),
      trend: rt.map((t) => ({
        period: String(t.period),
        strongBuy: Number(t.strongBuy ?? 0),
        buy: Number(t.buy ?? 0),
        hold: Number(t.hold ?? 0),
        sell: Number(t.sell ?? 0),
        strongSell: Number(t.strongSell ?? 0),
      })),
    },
    earnings: {
      history: eh.map((h) => {
        const q = yNum(h.quarter);
        return {
          quarter: q ? new Date(q * 1000).toISOString().slice(0, 10) : String(h.period),
          epsActual: yNum(h.epsActual),
          epsEstimate: yNum(h.epsEstimate),
          surprisePercent: yNum(h.surprisePercent) !== null ? (yNum(h.surprisePercent) as number) * 100 : null,
        };
      }),
      nextDate: nextTs ? new Date(nextTs * 1000).toISOString() : quote.earningsTimestamp ? new Date(quote.earningsTimestamp * 1000).toISOString() : null,
      nextDateIsEstimate: Boolean(ce?.isEarningsDateEstimate),
      nextEpsEstimate: get(ce, "earningsAverage") ?? yNum((trendFor("0q")?.earningsEstimate as Obj | undefined)?.avg),
      nextRevenueEstimate: get(ce, "revenueAverage") ?? yNum((trendFor("0q")?.revenueEstimate as Obj | undefined)?.avg),
      currentYearEpsEstimate: yNum((trendFor("0y")?.earningsEstimate as Obj | undefined)?.avg),
      nextYearEpsEstimate: yNum((trendFor("+1y")?.earningsEstimate as Obj | undefined)?.avg),
    },
  };
}

export async function stockFinancials(symbol: string): Promise<Financials> {
  const ts = await yahooTimeseries(symbol, [
    "quarterlyTotalRevenue",
    "quarterlyNetIncome",
    "quarterlyDilutedEPS",
    "quarterlyFreeCashFlow",
    "annualTotalRevenue",
    "annualNetIncome",
    "annualFreeCashFlow",
  ]);
  return {
    quarterlyRevenue: ts.quarterlyTotalRevenue ?? [],
    quarterlyNetIncome: ts.quarterlyNetIncome ?? [],
    quarterlyEps: ts.quarterlyDilutedEPS ?? [],
    quarterlyFreeCashFlow: ts.quarterlyFreeCashFlow ?? [],
    annualRevenue: ts.annualTotalRevenue ?? [],
    annualNetIncome: ts.annualNetIncome ?? [],
    annualFreeCashFlow: ts.annualFreeCashFlow ?? [],
  };
}
