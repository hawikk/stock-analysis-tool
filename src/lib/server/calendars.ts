import type { EarningsEvent, EarningsTiming, EconomicEvent, EconomicImpact } from "@/lib/types";
import { dateRange, weekdayOf, zonedTimeToUtc } from "@/lib/time";
import { httpJson } from "./http";

const ET = "America/New_York";

const money = (s: string | undefined | null): number | null => {
  if (!s) return null;
  const neg = s.includes("(") || s.trim().startsWith("-");
  const v = Number(s.replace(/[^0-9.]/g, ""));
  if (!s.match(/[0-9]/) || !Number.isFinite(v)) return null;
  return neg ? -v : v;
};

const TIMING: Record<string, EarningsTiming> = {
  "time-pre-market": "bmo",
  "time-after-hours": "amc",
  "time-not-supplied": "unknown",
};

const TIMING_ET: Record<EarningsTiming, string> = { bmo: "08:00", amc: "16:05", dmh: "12:00", unknown: "12:00" };

type NasdaqEarningsRow = {
  time: string;
  symbol: string;
  name: string;
  marketCap: string;
  fiscalQuarterEnding: string;
  epsForecast: string;
  lastYearEPS: string;
};

async function nasdaqEarningsForDate(date: string): Promise<EarningsEvent[]> {
  const res = await httpJson<{ data: { rows: NasdaqEarningsRow[] | null } | null }>(
    `https://api.nasdaq.com/api/calendar/earnings?date=${date}`,
    { plain: true },
  );
  return (res.data?.rows ?? []).map((r) => {
    const timing = TIMING[r.time] ?? "unknown";
    return {
      symbol: r.symbol.trim(),
      name: r.name.trim(),
      date,
      timing,
      approxTime: zonedTimeToUtc(date, TIMING_ET[timing], ET).toISOString(),
      epsEstimate: money(r.epsForecast),
      lastYearEps: money(r.lastYearEPS),
      marketCap: money(r.marketCap),
      fiscalQuarter: r.fiscalQuarterEnding,
    };
  });
}

export async function nasdaqEarnings(from: string, to: string): Promise<EarningsEvent[]> {
  const days = dateRange(from, to, 21).filter((d) => ![0, 6].includes(weekdayOf(d)));
  const results = await Promise.allSettled(days.map(nasdaqEarningsForDate));
  const ok = results.filter((r): r is PromiseFulfilledResult<EarningsEvent[]> => r.status === "fulfilled");
  if (!ok.length) throw new Error("Nasdaq earnings calendar unavailable");
  return ok.flatMap((r) => r.value);
}

const COUNTRY_CCY: Record<string, string> = {
  "United States": "USD",
  "Euro Zone": "EUR",
  Germany: "EUR",
  France: "EUR",
  Italy: "EUR",
  Spain: "EUR",
  "United Kingdom": "GBP",
  Japan: "JPY",
  China: "CNY",
  Canada: "CAD",
  Australia: "AUD",
  "New Zealand": "NZD",
  Switzerland: "CHF",
  India: "INR",
  "South Korea": "KRW",
  Brazil: "BRL",
  Mexico: "MXN",
};

const CCY_COUNTRY: Record<string, string> = {
  USD: "United States",
  EUR: "Euro Zone",
  GBP: "United Kingdom",
  JPY: "Japan",
  CNY: "China",
  CAD: "Canada",
  AUD: "Australia",
  NZD: "New Zealand",
  CHF: "Switzerland",
  All: "Global",
};

const HIGH = [/\bCPI\b/i, /consumer price/i, /non-?farm/i, /payrolls/i, /unemployment rate/i, /\bGDP\b/i, /rate decision/i, /interest rate/i, /\bFOMC\b/i, /\bPCE\b/i, /retail sales/i, /monetary policy/i, /press conference/i, /ISM (manufacturing|services|non-manufacturing)/i];
const MEDIUM = [/\bPMI\b/i, /jobless claims/i, /industrial production/i, /trade balance/i, /\bPPI\b/i, /producer price/i, /housing starts/i, /building permits/i, /confidence/i, /durable goods/i, /\bZEW\b/i, /\bIfo\b/i, /sentiment/i, /employment change/i, /average earnings/i, /\bJOLTS\b/i, /home sales/i, /crude oil inventories/i, /speaks/i];

const MAJOR_ECONOMIES = new Set(["United States", "Euro Zone", "Germany", "United Kingdom", "Japan", "China", "Canada", "Australia", "Switzerland"]);

function heuristicImpact(title: string, country: string): EconomicImpact {
  const major = MAJOR_ECONOMIES.has(country);
  if (HIGH.some((r) => r.test(title))) return major ? "high" : "medium";
  if (MEDIUM.some((r) => r.test(title))) return major ? "medium" : "low";
  return "low";
}

const clean = (s: string | undefined | null): string | null => {
  if (!s) return null;
  const t = s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;BR\/&gt;/gi, " ")
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#?[a-z0-9]+;/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t || null;
};

type FfEvent = { title: string; country: string; date: string; impact: string; forecast: string; previous: string };

async function forexFactoryWeek(): Promise<FfEvent[]> {
  return httpJson<FfEvent[]>("https://nfs.faireconomy.media/ff_calendar_thisweek.json", { plain: true });
}

const IMPACT_MAP: Record<string, EconomicImpact> = { High: "high", Medium: "medium", Low: "low", Holiday: "low" };

function normalizeTitle(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type NasdaqEconRow = { gmt: string; country: string; eventName: string; actual: string; consensus: string; previous: string; description: string };

async function nasdaqEconomicForDate(date: string): Promise<EconomicEvent[]> {
  const res = await httpJson<{ data: { rows: NasdaqEconRow[] | null } | null }>(
    `https://api.nasdaq.com/api/calendar/economicevents?date=${date}`,
    { plain: true },
  );
  return (res.data?.rows ?? []).map((r, i) => {
    // Despite the field name, Nasdaq's "gmt" column is US/Eastern wall-clock time.
    const hasTime = /^\d{1,2}:\d{2}$/.test(r.gmt.trim());
    const time = hasTime ? zonedTimeToUtc(date, r.gmt.trim(), ET) : zonedTimeToUtc(date, "00:00", ET);
    return {
      id: `nq-${date}-${i}`,
      title: r.eventName.trim(),
      country: r.country,
      currency: COUNTRY_CCY[r.country],
      time: time.toISOString(),
      allDay: !hasTime,
      impact: heuristicImpact(r.eventName, r.country),
      actual: clean(r.actual),
      forecast: clean(r.consensus),
      previous: clean(r.previous),
      description: clean(r.description) ?? undefined,
    };
  });
}

export async function economicCalendar(from: string, to: string): Promise<{ events: EconomicEvent[]; sources: ("nasdaq" | "forexfactory")[] }> {
  const days = dateRange(from, to, 21);
  const [nasdaq, ff] = await Promise.all([
    Promise.allSettled(days.map(nasdaqEconomicForDate)),
    forexFactoryWeek().catch(() => [] as FfEvent[]),
  ]);
  const nqOk = nasdaq.filter((r): r is PromiseFulfilledResult<EconomicEvent[]> => r.status === "fulfilled").flatMap((r) => r.value);
  const sources: ("nasdaq" | "forexfactory")[] = [];
  if (nqOk.length) sources.push("nasdaq");
  if (ff.length) sources.push("forexfactory");

  const ffIndex = ff.map((e) => ({ ...e, t: new Date(e.date).getTime(), n: normalizeTitle(e.title) }));

  const events = nqOk.map((e) => {
    const t = new Date(e.time).getTime();
    const n = normalizeTitle(e.title);
    const match = ffIndex.find(
      (f) => Math.abs(f.t - t) < 90_000 && CCY_COUNTRY[f.country] && e.currency === f.country && (n.includes(f.n.slice(0, 6)) || f.n.includes(n.slice(0, 6))),
    );
    return match ? { ...e, impact: IMPACT_MAP[match.impact] ?? e.impact } : e;
  });

  if (!events.length && ff.length) {
    const fromT = zonedTimeToUtc(from, "00:00", ET).getTime();
    const toT = zonedTimeToUtc(to, "23:59", ET).getTime();
    for (const [i, f] of ffIndex.entries()) {
      if (f.t < fromT || f.t > toT) continue;
      events.push({
        id: `ff-${i}`,
        title: f.title,
        country: CCY_COUNTRY[f.country] ?? f.country,
        currency: f.country,
        time: new Date(f.t).toISOString(),
        impact: IMPACT_MAP[f.impact] ?? "low",
        forecast: f.forecast || null,
        previous: f.previous || null,
        actual: null,
      });
    }
  }

  if (!events.length) throw new Error("Economic calendar unavailable");
  events.sort((a, b) => a.time.localeCompare(b.time));
  return { events, sources };
}
