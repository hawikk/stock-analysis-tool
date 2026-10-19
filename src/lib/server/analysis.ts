import { z } from "zod";
import type { Candle, Financials, NewsItem, Rating, StockAnalysis, StockProfile } from "@/lib/types";
import { atr, last, macd, maxDrawdown, pctReturn, realizedVol, rsi, sma, supportResistance } from "@/lib/indicators";
import { completeJson, aiConfig } from "./ai";

export type AnalysisInput = {
  profile: StockProfile;
  candles: Candle[];
  benchmark: Candle[];
  financials: Financials | null;
  news: NewsItem[];
};

type Technicals = ReturnType<typeof computeTechnicals>;

export function computeTechnicals(candles: Candle[], benchmark: Candle[]) {
  const closes = candles.map((c) => c.close);
  const price = closes.at(-1) ?? null;
  const sma20 = last(sma(closes, 20));
  const sma50 = last(sma(closes, 50));
  const sma200 = last(sma(closes, 200));
  const rsi14 = last(rsi(closes, 14));
  const m = macd(closes);
  const macdHist = last(m.hist);
  const atr14 = atr(candles, 14);
  const benchCloses = benchmark.map((c) => c.close);
  const r3m = pctReturn(closes, 63);
  const b3m = pctReturn(benchCloses, 63);
  const levels = price ? supportResistance(candles, price) : { support: [], resistance: [] };
  const high52 = Math.max(...candles.slice(-252).map((c) => c.high));
  const low52 = Math.min(...candles.slice(-252).map((c) => c.low));
  return {
    price,
    sma20,
    sma50,
    sma200,
    rsi14,
    macdHist,
    atrPct: atr14 && price ? (atr14 / price) * 100 : null,
    return1m: pctReturn(closes, 21),
    return3m: r3m,
    return6m: pctReturn(closes, 126),
    return1y: pctReturn(closes, Math.min(251, closes.length - 1)),
    relativeStrength3m: r3m !== null && b3m !== null ? r3m - b3m : null,
    vol30d: realizedVol(closes, 30),
    maxDrawdown1y: maxDrawdown(closes.slice(-252)),
    pctFrom52wHigh: price && Number.isFinite(high52) ? (price / high52 - 1) * 100 : null,
    pctFrom52wLow: price && Number.isFinite(low52) ? (price / low52 - 1) * 100 : null,
    support: levels.support,
    resistance: levels.resistance,
  };
}

const POS = /\b(beat|beats|surge|soar|jump|rall|record|upgrade|raises?|strong|growth|bullish|outperform|buy|wins?|expands?|launch|partnership|approval|boost|gain|tops?|exceeds?)/i;
const NEG = /\b(miss|misses|plunge|slump|fall|drop|downgrade|cuts?|weak|lawsuit|probe|investigation|recall|bearish|underperform|sell|warns?|layoffs?|decline|loss|fraud|halt|delay|tariff|antitrust|fine)/i;

function newsSentiment(news: NewsItem[]) {
  let score = 0;
  for (const n of news.slice(0, 15)) {
    if (POS.test(n.title)) score += 1;
    if (NEG.test(n.title)) score -= 1;
  }
  const label: StockAnalysis["news"]["sentiment"] = score >= 2 ? "Positive" : score <= -2 ? "Negative" : news.length && score === 0 ? "Neutral" : "Mixed";
  return { score, label };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const statVal = (p: StockProfile, key: string): number | null => {
  const v = p.stats.find((s) => s.key === key)?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const fmtPct = (v: number | null, d = 1) => (v === null ? "n/a" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`);
const fmtX = (v: number | null) => (v === null ? "n/a" : `${v.toFixed(1)}x`);
const fmtPx = (v: number | null) => (v === null ? "n/a" : v >= 1000 ? v.toFixed(0) : v.toFixed(2));

function scorecard(p: StockProfile, t: Technicals, sentiment: number) {
  const fpe = statVal(p, "forwardPE");
  const peg = statVal(p, "pegRatio");
  const fcfy = statVal(p, "fcfYield");
  const price = p.quote.price;
  const upside = p.analyst.targetMean && price ? (p.analyst.targetMean / price - 1) * 100 : null;

  let value = 50;
  if (fpe !== null) value = fpe <= 0 ? 25 : fpe < 12 ? 85 : fpe < 18 ? 70 : fpe < 25 ? 55 : fpe < 35 ? 40 : fpe < 50 ? 25 : 12;
  if (peg !== null && peg > 0) value += peg < 1 ? 10 : peg > 2.5 ? -10 : 0;
  if (fcfy !== null) value += fcfy > 0.05 ? 10 : fcfy < 0.01 ? -8 : 0;
  if (upside !== null) value += upside > 20 ? 8 : upside < 0 ? -10 : 0;

  const revG = statVal(p, "revenueGrowth");
  const epsG = statVal(p, "earningsGrowth");
  const fwdEpsG =
    p.earnings.currentYearEpsEstimate && p.earnings.nextYearEpsEstimate && p.earnings.currentYearEpsEstimate > 0
      ? (p.earnings.nextYearEpsEstimate / p.earnings.currentYearEpsEstimate - 1) * 100
      : null;
  let growth = 50;
  if (revG !== null) growth = revG > 0.25 ? 88 : revG > 0.1 ? 70 : revG > 0.03 ? 55 : revG > 0 ? 45 : 25;
  if (epsG !== null) growth += epsG > 0.2 ? 8 : epsG < 0 ? -10 : 0;
  if (fwdEpsG !== null) growth += fwdEpsG > 15 ? 6 : fwdEpsG < 0 ? -8 : 0;

  const opm = statVal(p, "operatingMargins");
  const roe = statVal(p, "returnOnEquity");
  let quality = 50;
  if (opm !== null) quality = opm > 0.3 ? 85 : opm > 0.18 ? 70 : opm > 0.08 ? 55 : opm > 0 ? 40 : 20;
  if (roe !== null) quality += roe > 0.25 ? 10 : roe < 0.05 ? -10 : 0;

  let momentum = 50;
  if (t.price && t.sma200) momentum += t.price > t.sma200 ? 12 : -12;
  if (t.price && t.sma50) momentum += t.price > t.sma50 ? 8 : -8;
  if (t.return6m !== null) momentum += clamp(t.return6m / 2, -15, 15);
  if (t.relativeStrength3m !== null) momentum += clamp(t.relativeStrength3m / 2, -10, 10);
  if (t.rsi14 !== null && t.rsi14 > 75) momentum -= 5;

  const cash = statVal(p, "totalCash");
  const debt = statVal(p, "totalDebt");
  const de = statVal(p, "debtToEquity");
  const cr = statVal(p, "currentRatio");
  let balance = 55;
  if (cash !== null && debt !== null) balance += cash > debt ? 15 : debt > cash * 3 ? -15 : 0;
  if (de !== null) balance += de < 0.5 ? 10 : de > 2 ? -15 : 0;
  if (cr !== null) balance += cr > 1.5 ? 5 : cr < 1 ? -8 : 0;

  const beats = p.earnings.history.filter((h) => h.surprisePercent !== null && h.surprisePercent > 0).length;
  const total = p.earnings.history.filter((h) => h.surprisePercent !== null).length;
  let sent = 50;
  if (p.analyst.recommendationMean) sent = ((5 - p.analyst.recommendationMean) / 4) * 100;
  if (total) sent += (beats / total - 0.5) * 20;
  sent += clamp(sentiment * 3, -10, 10);

  const card = [
    { label: "Value", score: Math.round(clamp(value)), note: `Fwd P/E ${fmtX(fpe)}, PEG ${peg?.toFixed(2) ?? "n/a"}, FCF yield ${fcfy !== null ? (fcfy * 100).toFixed(1) + "%" : "n/a"}` },
    { label: "Growth", score: Math.round(clamp(growth)), note: `Revenue ${fmtPct(revG !== null ? revG * 100 : null)}, EPS ${fmtPct(epsG !== null ? epsG * 100 : null)} y/y` },
    { label: "Quality", score: Math.round(clamp(quality)), note: `Op. margin ${opm !== null ? (opm * 100).toFixed(1) + "%" : "n/a"}, ROE ${roe !== null ? (roe * 100).toFixed(1) + "%" : "n/a"}` },
    { label: "Momentum", score: Math.round(clamp(momentum)), note: `6M ${fmtPct(t.return6m)}, vs S&P (3M) ${fmtPct(t.relativeStrength3m)}` },
    { label: "Balance sheet", score: Math.round(clamp(balance)), note: `Cash ${cash !== null && debt !== null ? (cash > debt ? "exceeds" : "below") : "vs"} debt, D/E ${de?.toFixed(2) ?? "n/a"}` },
    { label: "Sentiment", score: Math.round(clamp(sent)), note: `Analysts ${p.analyst.recommendationKey ?? "n/a"}, beat ${beats}/${total} recent quarters` },
  ];
  return { card, upside, fwdEpsG };
}

function ratingFrom(score: number): Rating {
  return score >= 68 ? "Strong Buy" : score >= 57 ? "Buy" : score >= 43 ? "Hold" : score >= 32 ? "Sell" : "Strong Sell";
}

function fairValue(p: StockProfile, fwdEpsG: number | null) {
  const price = p.quote.price;
  const methods: number[] = [];
  if (p.analyst.targetMean) methods.push(p.analyst.targetMean);
  const fwdEps = statVal(p, "forwardEps");
  if (fwdEps && fwdEps > 0) {
    const fairPE = clamp(12 + (fwdEpsG ?? 8) * 0.9, 10, 40);
    methods.push(fwdEps * fairPE);
  }
  const fcf = statVal(p, "freeCashflow");
  const shares = statVal(p, "sharesOutstanding");
  if (fcf && fcf > 0 && shares) methods.push((fcf / shares) * 22);
  // Discard methods that disagree wildly with the market price (bad inputs, distorted FCF, etc.).
  const sane = price ? methods.filter((m) => m > price * 0.4 && m < price * 2.5) : methods;
  if (!sane.length || !price) return { low: null, base: null, high: null };
  const base = sane.reduce((a, b) => a + b, 0) / sane.length;
  const low = Math.max(Math.min(...sane, base * 0.85), base * 0.6);
  const high = Math.min(Math.max(...sane, base * 1.15), base * 1.6);
  return { low, base, high };
}

export function quantAnalysis(input: AnalysisInput): StockAnalysis {
  const { profile: p, news } = input;
  const t = computeTechnicals(input.candles, input.benchmark);
  const sentiment = newsSentiment(news);
  const { card, upside, fwdEpsG } = scorecard(p, t, sentiment.score);
  const weights = [0.2, 0.2, 0.15, 0.2, 0.1, 0.15];
  const composite = card.reduce((a, c, i) => a + c.score * weights[i], 0);
  const rating = ratingFrom(composite);
  const price = p.quote.price ?? t.price;
  const fv = fairValue(p, fwdEpsG);
  const verdict: StockAnalysis["valuation"]["verdict"] =
    fv.base && price ? (price < fv.base * 0.9 ? "Undervalued" : price > fv.base * 1.1 ? "Overvalued" : "Fairly valued") : "Fairly valued";

  const trend: StockAnalysis["technicals"]["trend"] =
    t.price && t.sma50 && t.sma200
      ? t.price > t.sma50 && t.sma50 > t.sma200
        ? "Uptrend"
        : t.price < t.sma50 && t.sma50 < t.sma200
          ? "Downtrend"
          : "Sideways"
      : "Sideways";

  const revG = statVal(p, "revenueGrowth");
  const opm = statVal(p, "operatingMargins");
  const fpe = statVal(p, "forwardPE");
  const de = statVal(p, "debtToEquity");
  const beta = statVal(p, "beta");
  const shortF = statVal(p, "shortPercentOfFloat");

  const bull: string[] = [];
  const bear: string[] = [];
  if (revG !== null) (revG > 0.1 ? bull : revG < 0 ? bear : bull).push(`Revenue ${revG >= 0 ? "growing" : "shrinking"} ${fmtPct(revG * 100)} year over year`);
  if (opm !== null) (opm > 0.2 ? bull : opm < 0.05 ? bear : bull).push(`Operating margin of ${(opm * 100).toFixed(1)}%`);
  if (upside !== null) (upside > 10 ? bull : upside < 0 ? bear : bull).push(`Analyst mean target ${fmtPx(p.analyst.targetMean)} implies ${fmtPct(upside)} from here (${p.analyst.analystCount ?? "?"} analysts)`);
  if (fpe !== null) (fpe < 20 ? bull : fpe > 35 ? bear : bull).push(`Forward P/E of ${fmtX(fpe)}${fwdEpsG !== null ? ` against ${fmtPct(fwdEpsG)} expected EPS growth next year` : ""}`);
  if (trend === "Uptrend") bull.push(`Price above rising 50- and 200-day averages; 6M return ${fmtPct(t.return6m)}`);
  if (trend === "Downtrend") bear.push(`Price below falling 50- and 200-day averages; 6M return ${fmtPct(t.return6m)}`);
  if (t.relativeStrength3m !== null) (t.relativeStrength3m > 0 ? bull : bear).push(`${t.relativeStrength3m > 0 ? "Outperforming" : "Lagging"} the S&P 500 by ${Math.abs(t.relativeStrength3m).toFixed(1)} pts over 3 months`);
  const beats = p.earnings.history.filter((h) => (h.surprisePercent ?? 0) > 0).length;
  if (p.earnings.history.length) (beats >= p.earnings.history.length - 1 ? bull : bear).push(`Beat EPS estimates in ${beats} of the last ${p.earnings.history.length} quarters`);

  const risks: StockAnalysis["risks"] = [];
  if (fpe !== null && fpe > 35) risks.push({ title: "Valuation risk", detail: `At ${fmtX(fpe)} forward earnings, the stock prices in sustained high growth; any guidance cut could compress the multiple.`, severity: fpe > 50 ? "high" : "medium" });
  if (beta !== null && beta > 1.3) risks.push({ title: "High beta", detail: `Beta of ${beta.toFixed(2)} means the stock tends to amplify market drawdowns.`, severity: "medium" });
  if (t.vol30d !== null && t.vol30d > 45) risks.push({ title: "Elevated volatility", detail: `30-day realized volatility is ${t.vol30d.toFixed(0)}% annualized.`, severity: "medium" });
  if (de !== null && de > 1.5) risks.push({ title: "Leverage", detail: `Debt/equity of ${de.toFixed(2)} limits flexibility if conditions tighten.`, severity: de > 3 ? "high" : "medium" });
  if (shortF !== null && shortF > 0.1) risks.push({ title: "Crowded short", detail: `${(shortF * 100).toFixed(1)}% of float is sold short — expect sharp moves either way.`, severity: "medium" });
  if (p.earnings.nextDate) {
    const days = (new Date(p.earnings.nextDate).getTime() - Date.now()) / 86400000;
    if (days >= 0 && days < 21) risks.push({ title: "Earnings event", detail: `Reports in ${Math.ceil(days)} days; options typically price a sizeable move around results.`, severity: "low" });
  }
  if (sentiment.label === "Negative") risks.push({ title: "Negative news flow", detail: "Recent headlines skew negative; watch for follow-through.", severity: "medium" });
  if (!risks.length) risks.push({ title: "Macro sensitivity", detail: "No stock-specific red flags in the data; the main risks are market-wide (rates, growth, risk appetite).", severity: "low" });

  const strongest = [...card].sort((a, b) => b.score - a.score);
  const thesis = [
    `${p.name} (${p.symbol}) screens as a **${rating}** on the multi-factor model with a composite score of ${composite.toFixed(0)}/100. Its strongest factors are ${strongest[0].label.toLowerCase()} (${strongest[0].score}) and ${strongest[1].label.toLowerCase()} (${strongest[1].score}), while ${strongest.at(-1)!.label.toLowerCase()} (${strongest.at(-1)!.score}) is the main drag.`,
    `${p.profile.sector ? `Operating in ${p.profile.industry ?? p.profile.sector}, the` : "The"} business ${revG !== null ? `is growing revenue at ${(revG * 100).toFixed(1)}% y/y` : "has limited growth data"}${opm !== null ? ` with ${(opm * 100).toFixed(1)}% operating margins` : ""}. On valuation it looks **${verdict.toLowerCase()}**: a blended fair value of ${fmtPx(fv.base)} (analyst targets, forward earnings power and free cash flow) versus a price of ${fmtPx(price)}.`,
    `Technically the stock is in a${trend === "Uptrend" ? "n uptrend" : trend === "Downtrend" ? " downtrend" : " sideways range"} with RSI at ${t.rsi14?.toFixed(0) ?? "n/a"}${t.support[0] ? `, nearest support around ${fmtPx(t.support[0])}` : ""}${t.resistance[0] ? ` and resistance near ${fmtPx(t.resistance[0])}` : ""}.`,
  ].join("\n\n");

  const momentumText =
    t.rsi14 === null
      ? "Insufficient data"
      : `RSI ${t.rsi14.toFixed(0)} (${t.rsi14 > 70 ? "overbought" : t.rsi14 < 30 ? "oversold" : "neutral"}), MACD histogram ${t.macdHist !== null && t.macdHist > 0 ? "positive" : "negative"}`;

  const vol = (t.vol30d ?? 30) / 100;
  const scenarios = price
    ? {
        bull: { price: fv.high ?? price * (1 + vol), rationale: "Growth and margins beat expectations; multiple holds or expands." },
        base: { price: fv.base ?? price, rationale: "Fundamentals track consensus; price converges toward blended fair value." },
        bear: { price: Math.max(Math.min(fv.low ?? price, price * (1 - vol * 0.8)), price * 0.45), rationale: "Estimates cut or de-rating on macro/sector pressure." },
      }
    : { bull: { price: null, rationale: "" }, base: { price: null, rationale: "" }, bear: { price: null, rationale: "" } };

  return {
    symbol: p.symbol,
    engine: "quant",
    generatedAt: new Date().toISOString(),
    rating,
    conviction: Math.round(clamp(Math.abs(composite - 50) * 1.6 + 35, 0, 92)),
    headline: `${rating}: ${strongest[0].label} and ${strongest[1].label.toLowerCase()} lead; ${strongest.at(-1)!.label.toLowerCase()} is the weak spot`,
    thesis,
    bullCase: bull.slice(0, 5),
    bearCase: bear.length ? bear.slice(0, 5) : ["No major quantitative red flags; key risk is a broad market de-rating"],
    risks: risks.slice(0, 5),
    valuation: {
      verdict,
      summary: `Blended fair value ${fmtPx(fv.base)} (range ${fmtPx(fv.low)}–${fmtPx(fv.high)}) vs price ${fmtPx(price)}.`,
      fairValue: fv,
      keyMetrics: [`Fwd P/E ${fmtX(fpe)}`, `PEG ${statVal(p, "pegRatio")?.toFixed(2) ?? "n/a"}`, `EV/EBITDA ${fmtX(statVal(p, "evToEbitda"))}`, `FCF yield ${statVal(p, "fcfYield") !== null ? ((statVal(p, "fcfYield") as number) * 100).toFixed(1) + "%" : "n/a"}`],
    },
    technicals: {
      trend,
      summary: `Price ${fmtPx(t.price)} vs 50D ${fmtPx(t.sma50)} / 200D ${fmtPx(t.sma200)}. ${fmtPct(t.pctFrom52wHigh)} from 52-week high. 1Y max drawdown ${fmtPct(t.maxDrawdown1y)}.`,
      support: t.support.map((v) => Math.round(v * 100) / 100),
      resistance: t.resistance.map((v) => Math.round(v * 100) / 100),
      momentum: momentumText,
    },
    earnings: {
      summary: p.earnings.history.length
        ? `Last ${p.earnings.history.length} quarters: ${p.earnings.history.map((h) => `${h.surprisePercent !== null ? fmtPct(h.surprisePercent) : "n/a"}`).join(", ")} EPS surprise.`
        : "No recent earnings history available.",
      nextDate: p.earnings.nextDate,
      whatToWatch: [
        p.earnings.nextEpsEstimate !== null ? `EPS vs consensus ${p.earnings.nextEpsEstimate.toFixed(2)}` : "EPS vs consensus",
        "Forward guidance and margin commentary",
        revG !== null ? `Whether revenue growth (${(revG * 100).toFixed(0)}% y/y) holds` : "Revenue trajectory",
      ],
    },
    news: {
      sentiment: sentiment.label,
      summary: news.length ? `Headline tone over the last ${news.length} stories is ${sentiment.label.toLowerCase()} (lexicon score ${sentiment.score >= 0 ? "+" : ""}${sentiment.score}).` : "No recent headlines.",
      catalysts: news.slice(0, 4).map((n) => n.title),
    },
    scenarios,
    scorecard: card,
  };
}

const num = z.preprocess((v) => (v === null || v === undefined || v === "" ? null : Number(String(v).replace(/[^0-9.-]/g, ""))), z.number().finite().nullable()).catch(null);
const str = z.string().catch("");
const strArr = z.array(z.string()).catch([]);

const AiSchema = z.object({
  rating: z.enum(["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"]).catch("Hold"),
  conviction: z.coerce.number().min(0).max(100).catch(50),
  headline: str,
  thesis: str,
  bullCase: strArr,
  bearCase: strArr,
  risks: z.array(z.object({ title: str, detail: str, severity: z.enum(["low", "medium", "high"]).catch("medium") })).catch([]),
  valuation: z.object({
    verdict: z.enum(["Undervalued", "Fairly valued", "Overvalued"]).catch("Fairly valued"),
    summary: str,
    fairValue: z.object({ low: num, base: num, high: num }).catch({ low: null, base: null, high: null }),
    keyMetrics: strArr,
  }),
  technicals: z.object({
    trend: z.enum(["Uptrend", "Downtrend", "Sideways"]).catch("Sideways"),
    summary: str,
    support: z.array(num).catch([]),
    resistance: z.array(num).catch([]),
    momentum: str,
  }),
  earnings: z.object({ summary: str, whatToWatch: strArr }),
  news: z.object({ sentiment: z.enum(["Positive", "Neutral", "Negative", "Mixed"]).catch("Mixed"), summary: str, catalysts: strArr }),
  scenarios: z.object({
    bull: z.object({ price: num, rationale: str }),
    base: z.object({ price: num, rationale: str }),
    bear: z.object({ price: num, rationale: str }),
  }),
});

const SYSTEM = `You are a senior buy-side equity analyst writing a concise, evidence-based research note for an experienced private investor.
Rules:
- Ground every claim in the data packet provided (prices, ratios, growth, estimates, technicals, headlines). Quote specific numbers.
- Be decisive but balanced: a clear rating with the strongest bull and bear arguments.
- Valuation: triangulate fair value using forward P/E vs growth, EV/EBITDA, FCF yield and analyst targets; give low/base/high 12-month values in the stock's trading currency.
- Technicals: use the provided moving averages, RSI, MACD, support/resistance levels.
- News/earnings: synthesise what recent headlines and the last quarters' surprises imply, and what to watch next quarter.
- Do not invent facts that are not in the packet; if something is unknown, say so briefly.
- Output ONLY a JSON object, no markdown fences.`;

const SHAPE = `JSON shape:
{
 "rating": "Strong Buy|Buy|Hold|Sell|Strong Sell",
 "conviction": 0-100,
 "headline": "one sentence",
 "thesis": "2-3 short paragraphs separated by \\n\\n; **bold** allowed",
 "bullCase": ["3-5 bullets"], "bearCase": ["3-5 bullets"],
 "risks": [{"title": "", "detail": "", "severity": "low|medium|high"}],
 "valuation": {"verdict": "Undervalued|Fairly valued|Overvalued", "summary": "", "fairValue": {"low": n, "base": n, "high": n}, "keyMetrics": ["..."]},
 "technicals": {"trend": "Uptrend|Downtrend|Sideways", "summary": "", "support": [n], "resistance": [n], "momentum": ""},
 "earnings": {"summary": "recent results recap", "whatToWatch": ["..."]},
 "news": {"sentiment": "Positive|Neutral|Negative|Mixed", "summary": "", "catalysts": ["upcoming/ongoing catalysts"]},
 "scenarios": {"bull": {"price": n, "rationale": ""}, "base": {"price": n, "rationale": ""}, "bear": {"price": n, "rationale": ""}}
}`;

function packet(input: AnalysisInput, quant: StockAnalysis) {
  const { profile: p } = input;
  const t = computeTechnicals(input.candles, input.benchmark);
  const round = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d);
  const f = input.financials;
  return {
    asOf: new Date().toISOString().slice(0, 10),
    symbol: p.symbol,
    name: p.name,
    currency: p.quote.currency,
    sector: p.profile.sector,
    industry: p.profile.industry,
    country: p.profile.country,
    business: p.profile.summary?.slice(0, 700),
    quote: {
      price: round(p.quote.price),
      changePctToday: round(p.quote.changePercent),
      marketCap: p.quote.marketCap,
      week52: [round(p.quote.fiftyTwoWeekLow), round(p.quote.fiftyTwoWeekHigh)],
    },
    keyStats: Object.fromEntries(p.stats.filter((s) => typeof s.value === "number").map((s) => [s.label, round(s.value as number, 4)])),
    analysts: p.analyst,
    earnings: {
      lastQuarters: p.earnings.history,
      next: { date: p.earnings.nextDate, epsEstimate: p.earnings.nextEpsEstimate, revenueEstimate: p.earnings.nextRevenueEstimate },
      epsEstimates: { currentFY: p.earnings.currentYearEpsEstimate, nextFY: p.earnings.nextYearEpsEstimate },
    },
    quarterlyRevenue: f?.quarterlyRevenue.slice(-8),
    quarterlyNetIncome: f?.quarterlyNetIncome.slice(-8),
    technicals: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => round(x)) : round(v as number | null)])),
    headlines: input.news.slice(0, 12).map((n) => ({ date: n.publishedAt.slice(0, 10), source: n.publisher, title: n.title })),
    quantFactorScores: quant.scorecard,
  };
}

export async function analyzeStock(input: AnalysisInput): Promise<StockAnalysis> {
  const quant = quantAnalysis(input);
  if (!aiConfig()) return quant;
  try {
    const { json, model } = await completeJson(SYSTEM, `${SHAPE}\n\nDATA PACKET:\n${JSON.stringify(packet(input, quant))}`);
    const ai = AiSchema.parse(json);
    return {
      ...ai,
      symbol: input.profile.symbol,
      engine: "ai",
      model,
      generatedAt: new Date().toISOString(),
      earnings: { ...ai.earnings, nextDate: input.profile.earnings.nextDate },
      technicals: {
        ...ai.technicals,
        support: ai.technicals.support.filter((x): x is number => x !== null),
        resistance: ai.technicals.resistance.filter((x): x is number => x !== null),
      },
      scorecard: quant.scorecard,
    };
  } catch (err) {
    console.error("AI analysis failed, falling back to quant engine:", err);
    return { ...quant, headline: quant.headline };
  }
}
