import { z } from "zod";
import type { AssetRow, EconomicEvent, MarketBrief, NewsItem } from "@/lib/types";
import { aiEnabled, completeJson } from "./ai";

export type BriefInput = {
  indices: AssetRow[];
  sectors: AssetRow[];
  macro: AssetRow[];
  events: EconomicEvent[];
  headlines: NewsItem[];
};

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "n/a" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);

function find(qs: AssetRow[], s: string) {
  return qs.find((q) => q.symbol === s);
}

export function quantBrief(input: BriefInput): MarketBrief {
  const spx = find(input.indices, "^GSPC");
  const ndx = find(input.indices, "^IXIC");
  const sx5e = find(input.indices, "^STOXX50E");
  const nikkei = find(input.indices, "^N225");
  const vix = find(input.macro, "^VIX") ?? find(input.indices, "^VIX");
  const tnx = find(input.macro, "^TNX");
  const dxy = find(input.macro, "DX-Y.NYB");
  const oil = find(input.macro, "CL=F");
  const gold = find(input.macro, "GC=F");
  const btc = find(input.macro, "BTC-USD");

  const sectors = [...input.sectors].filter((s) => s.changePercent !== null).sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  const leaders = sectors.slice(0, 2).map((s) => `${s.label} ${pct(s.changePercent)}`);
  const laggards = sectors.slice(-2).map((s) => `${s.label} ${pct(s.changePercent)}`);

  const breadth = input.indices.filter((q) => (q.changePercent ?? 0) > 0).length / Math.max(1, input.indices.length);
  const riskScore = 50 + (spx?.changePercent ?? 0) * 12 + (ndx?.changePercent ?? 0) * 6 - (vix?.changePercent ?? 0) * 0.8 + (breadth - 0.5) * 30 + (btc?.changePercent ?? 0) * 1.5;
  const moodScore = Math.round(Math.max(0, Math.min(100, riskScore)));
  const mood: MarketBrief["mood"] = moodScore >= 60 ? "Risk-on" : moodScore <= 40 ? "Risk-off" : "Mixed";

  const now = Date.now();
  const highImpact = [
    ...new Map(input.events.filter((e) => e.impact === "high" && new Date(e.time).getTime() > now - 3600_000).map((e) => [`${e.country}:${e.title}`, e])).values(),
  ].slice(0, 4);

  const headline =
    spx?.changePercent !== undefined && spx?.changePercent !== null
      ? `S&P 500 ${pct(spx.changePercent)}, ${mood.toLowerCase()} tone with ${Math.round(breadth * 100)}% of tracked indices higher`
      : `Global markets: ${mood.toLowerCase()} tone`;

  const bullets = [
    `US: S&P 500 ${pct(spx?.changePercent)}, Nasdaq ${pct(ndx?.changePercent)}; VIX ${vix?.price?.toFixed(1) ?? "n/a"} (${pct(vix?.changePercent)})`,
    `Europe/Asia: Euro Stoxx 50 ${pct(sx5e?.changePercent)}, Nikkei ${pct(nikkei?.changePercent)}`,
    leaders.length ? `Sector leaders: ${leaders.join(", ")}; laggards: ${laggards.join(", ")}` : "",
    `Rates & FX: US 10Y ${tnx?.price?.toFixed(2) ?? "n/a"}%, Dollar index ${dxy?.price?.toFixed(2) ?? "n/a"} (${pct(dxy?.changePercent)})`,
    `Commodities & crypto: WTI ${pct(oil?.changePercent)}, Gold ${pct(gold?.changePercent)}, Bitcoin ${pct(btc?.changePercent)}`,
    highImpact.length ? `On the calendar: ${highImpact.map((e) => `${e.title} (${e.country})`).join("; ")}` : "",
  ].filter(Boolean);

  return {
    engine: "quant",
    generatedAt: new Date().toISOString(),
    headline,
    summary: `Cross-asset snapshot built from live prices. Risk appetite gauge: ${moodScore}/100 (${mood}).`,
    bullets,
    mood,
    moodScore,
  };
}

const BriefSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().catch(""),
  bullets: z.array(z.string()).catch([]),
  mood: z.enum(["Risk-on", "Risk-off", "Mixed"]).catch("Mixed"),
  moodScore: z.coerce.number().min(0).max(100).catch(50),
});

export async function marketBrief(input: BriefInput): Promise<MarketBrief> {
  const quant = quantBrief(input);
  if (!aiEnabled()) return quant;
  const compact = (qs: AssetRow[]) =>
    qs.map((q) => ({ s: q.symbol, n: q.label, p: q.price, chg: q.changePercent !== null ? Math.round((q.changePercent ?? 0) * 100) / 100 : null }));
  const data = {
    now: new Date().toISOString(),
    indices: compact(input.indices),
    sectorsUS: compact(input.sectors),
    macro: compact(input.macro),
    upcomingEvents: input.events.slice(0, 15).map((e) => ({ t: e.time, title: e.title, c: e.country, impact: e.impact, f: e.forecast, p: e.previous, a: e.actual })),
    headlines: input.headlines.slice(0, 15).map((h) => h.title),
    ruleBasedMoodScore: quant.moodScore,
  };
  try {
    const { value, model } = await completeJson(
      "You are a global macro strategist writing a crisp morning brief for a sophisticated investor. Use only the provided data; cite numbers. Output JSON only.",
      `Return {"headline": one line, "summary": 2-3 sentences on what is driving markets, "bullets": 4-6 bullets covering US, Europe, Asia, rates/FX, commodities/crypto and what to watch next, "mood": "Risk-on|Risk-off|Mixed", "moodScore": 0-100}.\nDATA:\n${JSON.stringify(data)}`,
      (json) => BriefSchema.parse(json),
      { budgetMs: 75_000 },
    );
    return { ...value, engine: "ai", model, generatedAt: new Date().toISOString() };
  } catch (err) {
    console.error("AI brief failed:", err);
    return { ...quant, aiUnavailable: true };
  }
}
