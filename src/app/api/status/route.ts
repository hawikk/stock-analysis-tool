import { connection } from "next/server";
import { aiConfig } from "@/lib/server/ai";

export async function GET() {
  await connection();
  const ai = aiConfig();
  const env = process.env;
  return Response.json({
    data: {
      ai: ai ? { enabled: true, provider: ai.provider, model: ai.model } : { enabled: false },
      providers: [
        { id: "yahoo", name: "Yahoo Finance", role: "Quotes, charts, fundamentals, news, options", keyRequired: false, configured: true },
        { id: "nasdaq", name: "Nasdaq", role: "Earnings & economic calendars", keyRequired: false, configured: true },
        { id: "treasury", name: "US Treasury", role: "Daily yield curve", keyRequired: false, configured: true },
        {
          id: "fred",
          name: "FRED (St. Louis Fed)",
          role: "Macro indicators",
          keyRequired: false,
          configured: true,
          optionalKey: "FRED_API_KEY",
          hasKey: Boolean(env.FRED_API_KEY),
        },
        { id: "cnbc", name: "CNBC", role: "Global 10Y government bond yields", keyRequired: false, configured: true },
        {
          id: "coingecko",
          name: "CoinGecko",
          role: "Crypto markets",
          keyRequired: false,
          configured: true,
          optionalKey: "COINGECKO_API_KEY",
          hasKey: Boolean(env.COINGECKO_API_KEY),
        },
        { id: "forexfactory", name: "ForexFactory", role: "Economic event impact levels", keyRequired: false, configured: true },
        {
          id: "finnhub",
          name: "Finnhub",
          role: "Backup quotes, company news & earnings",
          keyRequired: true,
          configured: Boolean(env.FINNHUB_API_KEY),
          optionalKey: "FINNHUB_API_KEY",
          hasKey: Boolean(env.FINNHUB_API_KEY),
        },
      ],
    },
    meta: { source: "status", asOf: new Date().toISOString() },
  });
}
